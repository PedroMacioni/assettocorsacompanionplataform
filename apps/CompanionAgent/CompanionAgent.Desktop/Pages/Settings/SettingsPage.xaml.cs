using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using Windows.Storage.Pickers;
using CompanionAgent.Core;

namespace CompanionAgent.Desktop.Pages.Settings;

public sealed partial class SettingsPage : Page
{
    private bool _loading;

    public SettingsPage()
    {
        InitializeComponent();
        Loaded += OnLoaded;
    }

    private void OnLoaded(object sender, RoutedEventArgs e)
    {
        _loading = true;
        try
        {
            var s = SettingsStore.Load();

            // Connection state
            var connected = !string.IsNullOrEmpty(s.DeviceId) && !string.IsNullOrEmpty(s.DeviceSecret);
            ConnectedSection.Visibility    = connected ? Visibility.Visible   : Visibility.Collapsed;
            NotConnectedSection.Visibility = connected ? Visibility.Collapsed : Visibility.Visible;
            if (connected)
                ConnectedEmailText.Text = string.IsNullOrEmpty(s.UserEmail) ? s.UserId : s.UserEmail;

            // Sync interval
            var intervalTag = s.SyncIntervalMinutes.ToString();
            foreach (ComboBoxItem item in IntervalCombo.Items)
            {
                if ((string?)item.Tag == intervalTag)
                {
                    IntervalCombo.SelectedItem = item;
                    break;
                }
            }
            if (IntervalCombo.SelectedIndex < 0)
                IntervalCombo.SelectedIndex = 0;

            // Data paths
            SessionsPathBox.Text = s.CustomSessionsPath;
            PbPathBox.Text       = s.CustomPersonalBestPath;

            // Auto-start
            AutoStartToggle.IsOn = AutoStartManager.IsEnabled();
        }
        finally
        {
            _loading = false;
        }
    }

    private void Back_Click(object sender, RoutedEventArgs e) =>
        MainWindow.Current?.GoBack();

    private void Connect_Click(object sender, RoutedEventArgs e) =>
        MainWindow.Current?.NavigateTo(typeof(ConnectionPage));

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

        ConnectedSection.Visibility    = Visibility.Collapsed;
        NotConnectedSection.Visibility = Visibility.Visible;
        ConnectedEmailText.Text        = "";
    }

    private void Interval_Changed(object sender, SelectionChangedEventArgs e)
    {
        if (_loading) return;
        if (IntervalCombo.SelectedItem is not ComboBoxItem item) return;
        if (!int.TryParse((string?)item.Tag, out var minutes)) return;

        var s = SettingsStore.Load();
        s.SyncIntervalMinutes = minutes;
        SettingsStore.Save(s);
        AgentService.Instance.UpdateSyncInterval(minutes);
    }

    private async void BrowseSessions_Click(object sender, RoutedEventArgs e)
    {
        var picker = new FolderPicker();
        picker.FileTypeFilter.Add("*");
        InitializePickerWindow(picker);

        var folder = await picker.PickSingleFolderAsync();
        if (folder is null) return;

        SessionsPathBox.Text = folder.Path;
        var s = SettingsStore.Load();
        s.CustomSessionsPath = folder.Path;
        SettingsStore.Save(s);
    }

    private async void BrowsePb_Click(object sender, RoutedEventArgs e)
    {
        var picker = new FileOpenPicker();
        picker.FileTypeFilter.Add(".ini");
        InitializePickerWindow(picker);

        var file = await picker.PickSingleFileAsync();
        if (file is null) return;

        PbPathBox.Text = file.Path;
        var s = SettingsStore.Load();
        s.CustomPersonalBestPath = file.Path;
        SettingsStore.Save(s);
    }

    private void SessionsPath_Changed(object sender, TextChangedEventArgs e)
    {
        if (_loading) return;
        var s = SettingsStore.Load();
        s.CustomSessionsPath = SessionsPathBox.Text.Trim();
        SettingsStore.Save(s);
    }

    private void PbPath_Changed(object sender, TextChangedEventArgs e)
    {
        if (_loading) return;
        var s = SettingsStore.Load();
        s.CustomPersonalBestPath = PbPathBox.Text.Trim();
        SettingsStore.Save(s);
    }

    private void AutoStart_Toggled(object sender, RoutedEventArgs e)
    {
        if (_loading) return;
        if (AutoStartToggle.IsOn)
            AutoStartManager.Enable();
        else
            AutoStartManager.Disable();
    }

    private static void InitializePickerWindow(object picker)
    {
        if (MainWindow.Current is null) return;
        var hwnd = WinRT.Interop.WindowNative.GetWindowHandle(MainWindow.Current);
        WinRT.Interop.InitializeWithWindow.Initialize(picker, hwnd);
    }
}
