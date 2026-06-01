using CompanionAgent.Core;
using Companion.Infrastructure.History;
using Companion.Infrastructure.Tracks;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;

namespace CompanionAgent.Desktop;

public sealed class AgentService : IDisposable
{
    public static AgentService Instance { get; } = new();

    private readonly HttpClient _http = new() { Timeout = TimeSpan.FromSeconds(20) };
    private SupabaseClient? _supabase;
    private SyncWorker? _worker;

    public SyncState State  { get; private set; } = SyncState.Unconfigured;
    public string   Message { get; private set; } = "";

    public event Action<SyncState, string>? StateChanged;
    public event Action<string>? ActivityLogged;

    private AgentService() { }

    public async Task<bool> InitializeAsync()
    {
        var s = SettingsStore.Load();
        if (string.IsNullOrEmpty(s.DeviceId) || string.IsNullOrEmpty(s.DeviceSecret))
            return false;

        try
        {
            // Exchange device credentials for Supabase tokens
            var req = new HttpRequestMessage(HttpMethod.Post,
                s.WebAppUrl.TrimEnd('/') + "/api/agent/auth");
            req.Headers.Authorization = new AuthenticationHeaderValue("Bearer", s.DeviceSecret);
            req.Content = new StringContent(
                JsonSerializer.Serialize(new { deviceId = s.DeviceId }),
                Encoding.UTF8, "application/json");

            var res = await _http.SendAsync(req);
            if (!res.IsSuccessStatusCode) return false;

            using var doc = JsonDocument.Parse(await res.Content.ReadAsStringAsync());
            var at = doc.RootElement.GetProperty("access_token").GetString()!;
            var rt = doc.RootElement.GetProperty("refresh_token").GetString()!;
            var email = doc.RootElement.TryGetProperty("email", out var em) ? em.GetString() ?? "" : "";

            // Persist tokens and email for later re-use
            s.UserToken    = at;
            s.RefreshToken = rt;
            s.UserEmail    = email;
            SettingsStore.Save(s);

            // Build SupabaseClient
            _supabase = new SupabaseClient(s.SupabaseUrl, s.SupabaseAnonKey);
            _supabase.SetTokens(at, rt);
            _supabase.TokensRefreshed += (newAt, newRt) =>
            {
                var cur = SettingsStore.Load();
                cur.UserToken    = newAt;
                cur.RefreshToken = newRt;
                SettingsStore.Save(cur);
            };

            // Build SyncWorker with default infrastructure services
            var history = new LocalHistoryService();
            history.SetCustomPaths(s.CustomSessionsPath, s.CustomPersonalBestPath);
            _worker = new SyncWorker(_supabase, history, new LocalTrackService());
            _worker.StateChanged   += (st, msg) => { State = st; Message = msg; StateChanged?.Invoke(st, msg); };
            _worker.ActivityLogged += msg => ActivityLogged?.Invoke(msg);

            _worker.Start(s.SyncIntervalMinutes);
            return true;
        }
        catch
        {
            return false;
        }
    }

    public void UpdateSyncInterval(int minutes) => _worker?.UpdateInterval(minutes);

    public async Task SyncNowAsync()
    {
        if (_worker is null)
        {
            var ok = await InitializeAsync();
            if (!ok)
            {
                StateChanged?.Invoke(SyncState.Error, "Not connected — go to Connection to pair");
                return;
            }
        }
        await _worker!.SyncAsync();
    }

    public void Dispose()
    {
        _worker?.Dispose();
        _supabase?.Dispose();
        _http.Dispose();
    }
}
