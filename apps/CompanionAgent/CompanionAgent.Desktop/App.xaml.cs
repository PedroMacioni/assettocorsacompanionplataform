using Microsoft.UI.Xaml;
using System.Runtime.InteropServices;

namespace CompanionAgent.Desktop;

public partial class App : Application
{
    [DllImport("user32.dll", CharSet = CharSet.Unicode)]
    private static extern int MessageBox(IntPtr hWnd, string text, string caption, uint type);

    internal Window? _window;

    public App()
    {
        InitializeComponent();
        UnhandledException += (_, e) =>
        {
            e.Handled = true;
            MessageBox(IntPtr.Zero,
                $"Apex Agent crashed unexpectedly.\n\nError: {e.Exception?.Message}\n\nType: {e.Exception?.GetType().FullName}",
                "Apex Agent — Error", 0x10);
        };
    }

    protected override void OnLaunched(LaunchActivatedEventArgs args)
    {
        UpdateService.Instance.Initialize();

        _window = new MainWindow();
        _window.Activate();
    }
}
