using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;

namespace CompanionAgent.Desktop.Pages;

public sealed partial class LoadingPage : Page
{
    public LoadingPage()
    {
        InitializeComponent();
        Loaded += OnLoaded;
    }

    private async void OnLoaded(object sender, RoutedEventArgs e)
    {
        var minDisplay = Task.Delay(800);

        // Check for updates + initialize agent concurrently
        StatusText.Text = "Checking for updates…";
        var checkTask = UpdateService.Instance.CheckAsync();
        var initTask  = AgentService.Instance.InitializeAsync();

        await Task.WhenAll(checkTask, initTask);

        // Initial sync if connected
        if (await initTask)
        {
            StatusText.Text = "Syncing…";
            await AgentService.Instance.SyncNowAsync();
        }

        await minDisplay;

        MainWindow.Current?.NavigateTo(typeof(OverviewPage));
    }
}
