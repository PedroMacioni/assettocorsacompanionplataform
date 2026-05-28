using Microsoft.UI.Dispatching;
using Microsoft.UI.Xaml;
using CompanionAgent.Desktop.Pages;
using CompanionAgent.Desktop.Pages.Settings;

namespace CompanionAgent.Desktop;

public sealed partial class MainWindow : Window
{
    public static new MainWindow? Current { get; private set; }

    private DispatcherQueue? _dispatcher;

    public MainWindow()
    {
        Current = this;
        InitializeComponent();
        ExtendsContentIntoTitleBar = true;
        SetTitleBar(AppTitleBar);
        AppWindow.SetIcon("Assets/AppIcon.ico");
        AppWindow.Resize(new Windows.Graphics.SizeInt32(420, 600));
        ContentFrame.Navigate(typeof(LoadingPage));

        _dispatcher = DispatcherQueue.GetForCurrentThread();
        UpdateService.Instance.UpdateAvailable += OnUpdateAvailable;
    }

    public void NavigateTo(Type pageType) => ContentFrame.Navigate(pageType);
    public void GoBack() { if (ContentFrame.CanGoBack) ContentFrame.GoBack(); }

    private void OnUpdateAvailable(string version)
    {
        _dispatcher?.TryEnqueue(() =>
        {
            UpdateVersionLabel.Text = $"New version: v{version}";
            UpdateOverlay.Visibility = Visibility.Visible;
        });
    }

    private async void UpdateNow_Click(object sender, RoutedEventArgs e)
    {
        UpdateNowButton.IsEnabled = false;
        UpdateProgressRing.Visibility = Visibility.Visible;
        UpdateProgressRing.IsActive = true;
        UpdateNowLabel.Text = "Downloading…";

        await UpdateService.Instance.DownloadAndApplyAsync();
        // ApplyUpdatesAndRestart terminates the process — code below never runs
    }

    private void UpdateLater_Click(object sender, RoutedEventArgs e)
    {
        UpdateOverlay.Visibility = Visibility.Collapsed;
    }
}
