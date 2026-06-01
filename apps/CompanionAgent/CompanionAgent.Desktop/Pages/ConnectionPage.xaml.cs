using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using CompanionAgent.Core;

namespace CompanionAgent.Desktop.Pages;

public sealed partial class ConnectionPage : Page
{
    private CancellationTokenSource? _pollCts;

    public ConnectionPage()
    {
        InitializeComponent();
        Loaded += (_, _) => RefreshUi();
    }

    private void RefreshUi()
    {
        var s = SettingsStore.Load();
        var connected = !string.IsNullOrEmpty(s.DeviceId) && !string.IsNullOrEmpty(s.DeviceSecret);

        NotConnectedPanel.Visibility = connected ? Visibility.Collapsed : Visibility.Visible;
        ConnectedPanel.Visibility    = connected ? Visibility.Visible   : Visibility.Collapsed;
        WaitingPanel.Visibility      = Visibility.Collapsed;

        if (connected)
        {
            AccountEmail.Text = string.IsNullOrEmpty(s.UserEmail) ? s.UserId : s.UserEmail;
            AccountId.Text    = "Device " + (s.DeviceId.Length >= 8 ? s.DeviceId[..8].ToUpper() : s.DeviceId);
        }
    }

    private async void Connect_Click(object sender, RoutedEventArgs e)
    {
        ConnectButton.IsEnabled = false;
        NotConnectedPanel.Visibility = Visibility.Collapsed;
        WaitingPanel.Visibility      = Visibility.Visible;
        WaitingText.Text = "Opening browser…";

        _pollCts?.Cancel();
        _pollCts = new CancellationTokenSource();
        var ct = _pollCts.Token;

        try
        {
            await StartPairingAsync(ct);
        }
        catch (OperationCanceledException)
        {
            // cancelled by user
        }
        catch (Exception ex)
        {
            WaitingPanel.Visibility      = Visibility.Collapsed;
            NotConnectedPanel.Visibility = Visibility.Visible;
            ErrorText.Text    = ex.Message;
            ErrorText.Visibility = Visibility.Visible;
        }
        finally
        {
            ConnectButton.IsEnabled = true;
        }
    }

    private async Task StartPairingAsync(CancellationToken ct)
    {
        var settings = SettingsStore.Load();

        // Generate random 32-byte secret
        var secretBytes = new byte[32];
        RandomNumberGenerator.Fill(secretBytes);
        var deviceSecret = Convert.ToHexString(secretBytes).ToLower();

        var deviceName = Environment.MachineName;
        var fingerprintRaw = Environment.MachineName + Environment.OSVersion.ToString();
        var fingerprintHash = "sha256:" + Sha256Hex(fingerprintRaw);
        var secretHash      = "sha256:" + Sha256Hex(deviceSecret);

        using var http = new HttpClient { Timeout = TimeSpan.FromSeconds(15) };

        // POST /api/agent/pairing/start
        var startBody = JsonSerializer.Serialize(new
        {
            deviceName,
            machineFingerprintHash = fingerprintHash,
            deviceSecretHash       = secretHash,
            appVersion             = "2.0.0",
            platform               = "windows"
        });

        var startResp = await http.PostAsync(
            settings.WebAppUrl.TrimEnd('/') + "/api/agent/pairing/start",
            new StringContent(startBody, Encoding.UTF8, "application/json"),
            ct);

        if (!startResp.IsSuccessStatusCode)
        {
            var err = await startResp.Content.ReadAsStringAsync(ct);
            throw new Exception($"Failed to start pairing ({(int)startResp.StatusCode}): {err}");
        }

        using var startDoc = JsonDocument.Parse(await startResp.Content.ReadAsStringAsync(ct));
        var pairingId  = startDoc.RootElement.GetProperty("pairingId").GetString()!;
        var connectUrl = startDoc.RootElement.GetProperty("connectUrl").GetString()!;
        var expiresAt  = startDoc.RootElement.GetProperty("expiresAt").GetString()!;

        // Open browser
        System.Diagnostics.Process.Start(new System.Diagnostics.ProcessStartInfo(connectUrl)
        {
            UseShellExecute = true
        });

        var deadline = DateTimeOffset.Parse(expiresAt);
        WaitingText.Text = $"Waiting for browser approval…\nExpires at {deadline.ToLocalTime():HH:mm}";

        // Poll every 3 seconds until approved, cancelled or expired
        while (!ct.IsCancellationRequested)
        {
            await Task.Delay(3000, ct);

            if (DateTimeOffset.UtcNow >= deadline)
                throw new Exception("Pairing code expired. Try again.");

            var pollReq = new HttpRequestMessage(HttpMethod.Get,
                settings.WebAppUrl.TrimEnd('/') + $"/api/agent/pairing/{pairingId}");
            pollReq.Headers.Authorization = new AuthenticationHeaderValue("Bearer", deviceSecret);

            var pollResp = await http.SendAsync(pollReq, ct);
            if (!pollResp.IsSuccessStatusCode) continue;

            using var pollDoc = JsonDocument.Parse(await pollResp.Content.ReadAsStringAsync(ct));
            var status = pollDoc.RootElement.GetProperty("status").GetString();

            switch (status)
            {
                case "approved":
                    var deviceId  = pollDoc.RootElement.TryGetProperty("deviceId",  out var d) ? d.GetString() ?? "" : "";
                    var userId    = pollDoc.RootElement.TryGetProperty("userId",     out var u) ? u.GetString() ?? "" : "";

                    // Persist pairing
                    settings.DeviceId     = deviceId;
                    settings.DeviceSecret = deviceSecret;
                    settings.DeviceName   = deviceName;
                    settings.UserId       = userId;
                    settings.PairedAt     = DateTimeOffset.UtcNow;
                    SettingsStore.Save(settings);

                    DispatcherQueue.TryEnqueue(async () =>
                    {
                        RefreshUi();
                        await Task.Delay(1200);
                        MainWindow.Current?.GoBack();
                    });
                    return;

                case "cancelled":
                case "expired":
                    throw new Exception($"Pairing {status}. Try again.");
            }
            // pending → keep polling
        }
    }

    private void CancelPairing_Click(object sender, RoutedEventArgs e)
    {
        _pollCts?.Cancel();
        WaitingPanel.Visibility      = Visibility.Collapsed;
        NotConnectedPanel.Visibility = Visibility.Visible;
    }

    private void Back_Click(object sender, RoutedEventArgs e) =>
        MainWindow.Current?.GoBack();

    private void Disconnect_Click(object sender, RoutedEventArgs e)
    {
        var s = SettingsStore.Load();
        s.DeviceId     = "";
        s.DeviceSecret = "";
        s.DeviceName   = "";
        s.UserId       = "";
        s.UserEmail    = "";
        s.PairedAt     = null;
        SettingsStore.Save(s);
        MainWindow.Current?.GoBack();
    }

    private static string Sha256Hex(string input)
    {
        var bytes = SHA256.HashData(Encoding.UTF8.GetBytes(input));
        return Convert.ToHexString(bytes).ToLower();
    }
}
