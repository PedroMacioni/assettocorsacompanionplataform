namespace CompanionAgent.Tray;

using Companion.Infrastructure.History;

public sealed class TrayApplicationContext : ApplicationContext
{
    private readonly NotifyIcon _tray;
    private readonly SupabaseClient _supabase;
    private readonly SyncWorker _worker;
    private readonly SynchronizationContext _ui;
    private AgentSettings _settings;

    private ToolStripMenuItem _statusItem = null!;
    private ToolStripMenuItem _syncNowItem = null!;
    private ToolStripMenuItem _autoStartItem = null!;

    public TrayApplicationContext()
    {
        _ui = SynchronizationContext.Current!;
        _settings = SettingsStore.Load();

        _supabase = new SupabaseClient(_settings.SupabaseUrl, _settings.SupabaseAnonKey);
        if (!string.IsNullOrEmpty(_settings.UserToken))
            _supabase.SetTokens(_settings.UserToken, _settings.RefreshToken);

        _worker = new SyncWorker(_supabase, new LocalHistoryService());
        _worker.StateChanged += OnStateChanged;

        _tray = new NotifyIcon
        {
            Icon = SystemIcons.Application,
            Visible = true,
            Text = "Sim Racing Companion"
        };
        _tray.DoubleClick += (_, _) => OpenSettings();
        _tray.ContextMenuStrip = BuildMenu();

        _worker.Start(_settings.SyncIntervalMinutes);
    }

    private ContextMenuStrip BuildMenu()
    {
        var menu = new ContextMenuStrip();

        menu.Items.Add(new ToolStripMenuItem("Sim Racing Companion") { Enabled = false, Font = new Font(SystemFonts.DefaultFont, FontStyle.Bold) });
        menu.Items.Add(new ToolStripSeparator());

        _statusItem = new ToolStripMenuItem("Iniciando...") { Enabled = false };
        menu.Items.Add(_statusItem);
        menu.Items.Add(new ToolStripSeparator());

        _syncNowItem = new ToolStripMenuItem("Sincronizar agora", null, (_, _) => _ = _worker.SyncAsync());
        menu.Items.Add(_syncNowItem);
        menu.Items.Add(new ToolStripMenuItem("Abrir dashboard", null, (_, _) =>
            System.Diagnostics.Process.Start(new System.Diagnostics.ProcessStartInfo("https://sim-racing-companion.vercel.app") { UseShellExecute = true })));
        menu.Items.Add(new ToolStripSeparator());

        menu.Items.Add(new ToolStripMenuItem("Configurações...", null, (_, _) => OpenSettings()));

        _autoStartItem = new ToolStripMenuItem("Iniciar com o Windows")
        {
            Checked = AutoStartManager.IsEnabled(),
            CheckOnClick = true
        };
        _autoStartItem.CheckedChanged += (_, _) =>
        {
            if (_autoStartItem.Checked) AutoStartManager.Enable();
            else AutoStartManager.Disable();
        };
        menu.Items.Add(_autoStartItem);
        menu.Items.Add(new ToolStripSeparator());
        menu.Items.Add(new ToolStripMenuItem("Sair", null, (_, _) => ExitApp()));

        return menu;
    }

    private void OnStateChanged(SyncState state, string message)
    {
        _ui?.Post(_ =>
        {
            var text = $"Sim Racing Companion — {message}";
            _tray.Text = text.Length > 63 ? text[..63] : text;
            _statusItem.Text = message;

            _tray.Icon = state switch
            {
                SyncState.Unconfigured => SystemIcons.Question,
                SyncState.Syncing      => SystemIcons.Information,
                SyncState.Error        => SystemIcons.Error,
                _                      => SystemIcons.Application
            };

            if (state == SyncState.Error && message.Contains("Token"))
            {
                _tray.BalloonTipTitle = "Sim Racing Companion";
                _tray.BalloonTipText = message;
                _tray.BalloonTipIcon = ToolTipIcon.Warning;
                _tray.ShowBalloonTip(5000);
            }
        }, null);
    }

    private void OpenSettings()
    {
        var form = new SettingsForm(_settings, _supabase, OnSettingsSaved);
        form.Show();
    }

    private void OnSettingsSaved(AgentSettings updated)
    {
        _settings = updated;
        _supabase.SetTokens(updated.UserToken, updated.RefreshToken);
        _worker.UpdateInterval(updated.SyncIntervalMinutes);
        _ = _worker.SyncAsync();
    }

    private void ExitApp()
    {
        _tray.Visible = false;
        _worker.Dispose();
        _supabase.Dispose();
        Application.Exit();
    }

    protected override void Dispose(bool disposing)
    {
        if (disposing)
        {
            _tray.Dispose();
            _worker.Dispose();
            _supabase.Dispose();
        }
        base.Dispose(disposing);
    }
}
