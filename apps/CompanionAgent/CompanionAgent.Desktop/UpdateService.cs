using Velopack;
using Velopack.Sources;

namespace CompanionAgent.Desktop;

internal sealed class UpdateService
{
    public static readonly UpdateService Instance = new();

    public event Action<string>? UpdateAvailable;

    public string? PendingVersion { get; private set; }

    private UpdateManager? _mgr;
    private UpdateInfo?    _pending;

    private UpdateService() { }

    public void Initialize()
    {
        if (string.IsNullOrEmpty(AppConfig.UpdateRepoUrl)) return;
        _mgr = new UpdateManager(new GithubSource(AppConfig.UpdateRepoUrl, null, false));
    }

    public async Task CheckAsync()
    {
        if (_mgr is null || !_mgr.IsInstalled) return;
        try
        {
            using var cts = new CancellationTokenSource(TimeSpan.FromSeconds(10));
            var checkTask = _mgr.CheckForUpdatesAsync();
            if (await Task.WhenAny(checkTask, Task.Delay(Timeout.Infinite, cts.Token)) != checkTask)
                return;

            var info = await checkTask;
            if (info is null) return;
            _pending = info;
            PendingVersion = info.TargetFullRelease.Version.ToString();
            UpdateAvailable?.Invoke(PendingVersion);
        }
        catch { }
    }

    public async Task DownloadAndApplyAsync()
    {
        if (_mgr is null || _pending is null) return;
        await _mgr.DownloadUpdatesAsync(_pending);
        _mgr.ApplyUpdatesAndRestart(_pending);
    }
}
