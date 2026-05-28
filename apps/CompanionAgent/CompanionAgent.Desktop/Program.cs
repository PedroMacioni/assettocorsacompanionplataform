using Microsoft.Windows.ApplicationModel.DynamicDependency;
using Microsoft.UI.Xaml;
using Microsoft.UI.Dispatching;
using Velopack;
using System.Runtime.InteropServices;

namespace CompanionAgent.Desktop;

public static class Program
{
    [DllImport("user32.dll", CharSet = CharSet.Unicode)]
    private static extern int MessageBox(IntPtr hWnd, string text, string caption, uint type);

    private static readonly string LogPath = System.IO.Path.Combine(
        Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData),
        "SimRacingCompanion", "startup.log");

    [STAThread]
    static void Main(string[] args)
    {
        AppDomain.CurrentDomain.UnhandledException += (_, e) =>
        {
            var msg = (e.ExceptionObject as Exception)?.ToString() ?? e.ExceptionObject?.ToString() ?? "Unknown error";
            WriteLog($"[FATAL] UnhandledException: {msg}");
            MessageBox(IntPtr.Zero,
                $"Apex Agent crashed.\n\nError: {(e.ExceptionObject as Exception)?.Message ?? msg}\n\nLog: {LogPath}",
                "Apex Agent — Crash", 0x10);
        };

        WriteLog("[START] Apex Agent starting");

        try
        {
            WriteLog("[1] VelopackApp.Build().Run()");
            VelopackApp.Build().Run();
            WriteLog("[1] OK");
        }
        catch (Exception ex)
        {
            WriteLog($"[1] FAIL: {ex}");
        }

        try
        {
            WriteLog("[2] Bootstrap.Initialize");
            Bootstrap.Initialize(0x00020001);
            WriteLog("[2] OK");
        }
        catch (Exception ex)
        {
            WriteLog($"[2] FAIL: {ex}");
            MessageBox(IntPtr.Zero,
                $"Apex Agent failed to start.\n\nWindows App SDK not found.\nError: {ex.Message}\n\nLog: {LogPath}",
                "Apex Agent — Startup Error", 0x10);
            return;
        }

        try
        {
            WriteLog("[3] WinUI Application.Start");
            WinRT.ComWrappersSupport.InitializeComWrappers();
            Application.Start(p =>
            {
                try
                {
                    var context = new DispatcherQueueSynchronizationContext(
                        DispatcherQueue.GetForCurrentThread());
                    System.Threading.SynchronizationContext.SetSynchronizationContext(context);
                    WriteLog("[3] new App()");
                    _ = new App();
                    WriteLog("[3] App() OK");
                }
                catch (Exception ex)
                {
                    WriteLog($"[3] App() FAIL: {ex}");
                    MessageBox(IntPtr.Zero,
                        $"Apex Agent failed to initialize.\n\nError: {ex.Message}\n\nLog: {LogPath}",
                        "Apex Agent — Init Error", 0x10);
                }
            });
            WriteLog("[3] Application.Start returned");
        }
        catch (Exception ex)
        {
            WriteLog($"[3] FAIL: {ex}");
            MessageBox(IntPtr.Zero,
                $"Apex Agent failed to start WinUI.\n\nError: {ex.Message}\n\nLog: {LogPath}",
                "Apex Agent — Error", 0x10);
        }
        finally
        {
            WriteLog("[END] Bootstrap.Shutdown");
            Bootstrap.Shutdown();
        }
    }

    private static void WriteLog(string message)
    {
        try
        {
            System.IO.Directory.CreateDirectory(System.IO.Path.GetDirectoryName(LogPath)!);
            System.IO.File.AppendAllText(LogPath, $"{DateTime.Now:HH:mm:ss.fff} {message}\r\n");
        }
        catch { }
    }
}
