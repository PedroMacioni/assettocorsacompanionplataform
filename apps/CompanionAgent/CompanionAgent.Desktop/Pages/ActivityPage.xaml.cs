using Microsoft.UI.Dispatching;
using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;

namespace CompanionAgent.Desktop.Pages;

public sealed partial class ActivityPage : Page
{
    private DispatcherQueue? _dispatcher;

    public ActivityPage()
    {
        InitializeComponent();
        Loaded   += OnLoaded;
        Unloaded += OnUnloaded;
    }

    private void OnLoaded(object sender, RoutedEventArgs e)
    {
        _dispatcher = DispatcherQueue.GetForCurrentThread();
        AgentService.Instance.ActivityLogged += OnActivityLogged;

        // Show current state if already syncing/synced
        var state = AgentService.Instance.Message;
        if (!string.IsNullOrEmpty(state))
            AppendLine(state);
    }

    private void OnUnloaded(object sender, RoutedEventArgs e)
    {
        AgentService.Instance.ActivityLogged -= OnActivityLogged;
    }

    private void OnActivityLogged(string message)
    {
        _dispatcher?.TryEnqueue(() => AppendLine(message));
    }

    private void AppendLine(string message)
    {
        LogList.Items.Add(message);
        LogList.ScrollIntoView(LogList.Items[^1]);
    }

    private void Clear_Click(object sender, RoutedEventArgs e)
    {
        LogList.Items.Clear();
    }
}
