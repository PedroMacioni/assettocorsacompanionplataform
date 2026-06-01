using Microsoft.UI;
using Microsoft.UI.Dispatching;
using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using Microsoft.UI.Xaml.Media;
using CompanionAgent.Core;
using CompanionAgent.Desktop.Pages.Settings;

namespace CompanionAgent.Desktop.Pages;

public sealed partial class OverviewPage : Page
{
    private DispatcherQueue? _dispatcher;

    public OverviewPage()
    {
        InitializeComponent();
        Loaded   += OnLoaded;
        Unloaded += OnUnloaded;
    }

    private void OnLoaded(object sender, RoutedEventArgs e)
    {
        _dispatcher = DispatcherQueue.GetForCurrentThread();
        AgentService.Instance.StateChanged   += OnStateChanged;
        AgentService.Instance.ActivityLogged += OnActivityLogged;

        var v = System.Reflection.Assembly.GetExecutingAssembly().GetName().Version;
        VersionText.Text = v is null ? "" : $"v{v.Major}.{v.Minor}.{v.Build}";

        RefreshUi();
    }

    private void OnUnloaded(object sender, RoutedEventArgs e)
    {
        AgentService.Instance.StateChanged   -= OnStateChanged;
        AgentService.Instance.ActivityLogged -= OnActivityLogged;
    }

    private void OnStateChanged(SyncState state, string message) =>
        _dispatcher?.TryEnqueue(RefreshUi);

    private void OnActivityLogged(string message) =>
        _dispatcher?.TryEnqueue(() => AppendLog(message));

    private void RefreshUi()
    {
        var s = SettingsStore.Load();
        var connected = !string.IsNullOrEmpty(s.DeviceId) && !string.IsNullOrEmpty(s.DeviceSecret);

        NotConnectedOverlay.Visibility = connected ? Visibility.Collapsed : Visibility.Visible;
        SyncNowButton.IsEnabled        = connected;

        if (!connected)
        {
            StatusDot.Fill    = (SolidColorBrush)Application.Current.Resources["ApexMutedBrush"];
            StatusLabel.Text  = "Offline";
            AccountText.Text  = "";
            LastSyncText.Text = "—";
            SessionsText.Text = "—";
            return;
        }

        AccountText.Text = string.IsNullOrEmpty(s.UserEmail) ? s.UserId : s.UserEmail;

        var state = AgentService.Instance.State;
        (StatusDot.Fill, StatusLabel.Text) = state switch
        {
            SyncState.Syncing => ((SolidColorBrush)Application.Current.Resources["ApexOrangeBrush"], "Syncing…"),
            SyncState.Error   => ((SolidColorBrush)Application.Current.Resources["ApexRedBrush"],    "Error"),
            _                 => ((SolidColorBrush)Application.Current.Resources["ApexGreenBrush"],  "Online"),
        };

        LastSyncText.Text = s.LastSyncAt.HasValue
            ? s.LastSyncAt.Value.ToLocalTime().ToString("dd/MM · HH:mm")
            : "Never";

        SessionsText.Text = s.LastSyncAt.HasValue
            ? (s.LastSyncSessionCount > 0 ? $"{s.LastSyncSessionCount} new" : "Up to date")
            : "—";
    }

    private void AppendLog(string message)
    {
        LogList.Items.Add(message);
        UpdateLogVisibility();
        _dispatcher?.TryEnqueue(DispatcherQueuePriority.Low, () =>
        {
            if (LogList.Items.Count > 0)
                LogList.ScrollIntoView(LogList.Items[^1]);
        });
    }

    private void UpdateLogVisibility()
    {
        var hasItems = LogList.Items.Count > 0;
        LogList.Visibility       = hasItems ? Visibility.Visible   : Visibility.Collapsed;
        LogEmptyState.Visibility = hasItems ? Visibility.Collapsed : Visibility.Visible;
    }

    private async void SyncNow_Click(object sender, RoutedEventArgs e)
    {
        SyncNowButton.IsEnabled = false;
        try   { await AgentService.Instance.SyncNowAsync(); }
        finally { SyncNowButton.IsEnabled = true; RefreshUi(); }
    }

    private void Settings_Click(object sender, RoutedEventArgs e) =>
        MainWindow.Current?.NavigateTo(typeof(SettingsPage));

    private void ClearLog_Click(object sender, RoutedEventArgs e)
    {
        LogList.Items.Clear();
        UpdateLogVisibility();
    }
}
