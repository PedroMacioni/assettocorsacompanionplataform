namespace CompanionAgent.Tray;

using Companion.Infrastructure.History;
using Companion.Infrastructure.Tracks;

public sealed class TrayApplicationContext : ApplicationContext
{
    private readonly NotifyIcon _tray;
    private readonly SupabaseClient _supabase;
    private readonly SyncWorker _worker;
    private readonly MainForm _mainForm;
    private AgentSettings _settings;

    private ToolStripMenuItem _statusItem = null!;

    public TrayApplicationContext()
    {
        _settings = SettingsStore.Load();

        _supabase = new SupabaseClient(_settings.SupabaseUrl, _settings.SupabaseAnonKey);
        if (!string.IsNullOrEmpty(_settings.UserToken))
            _supabase.SetTokens(_settings.UserToken, _settings.RefreshToken);

        _worker = new SyncWorker(_supabase, new LocalHistoryService(), new LocalTrackService());

        _mainForm = new MainForm(_supabase, _worker, _settings, OnSettingsSaved);
        _mainForm.Show();

        _tray = new NotifyIcon
        {
            Icon    = SystemIcons.Application,
            Visible = true,
            Text    = "Sim Racing Companion"
        };
        _tray.DoubleClick  += (_, _) => ShowMainForm();
        _tray.ContextMenuStrip = BuildTrayMenu();

        _worker.StateChanged += OnStateChanged;
        _worker.Start(_settings.SyncIntervalMinutes);
    }

    private void ShowMainForm()
    {
        _mainForm.Show();
        _mainForm.WindowState = FormWindowState.Normal;
        _mainForm.BringToFront();
        _mainForm.Activate();
    }

    private ContextMenuStrip BuildTrayMenu()
    {
        var menu = new ContextMenuStrip();

        menu.Items.Add(new ToolStripMenuItem("Sim Racing Companion")
            { Enabled = false, Font = new Font(SystemFonts.DefaultFont, FontStyle.Bold) });
        menu.Items.Add(new ToolStripSeparator());

        _statusItem = new ToolStripMenuItem("Iniciando...") { Enabled = false };
        menu.Items.Add(_statusItem);
        menu.Items.Add(new ToolStripSeparator());

        menu.Items.Add(new ToolStripMenuItem("Mostrar janela", null,
            (_, _) => ShowMainForm()));
        menu.Items.Add(new ToolStripMenuItem("Sincronizar agora", null,
            (_, _) => _ = _worker.SyncAsync()));
        menu.Items.Add(new ToolStripSeparator());

        menu.Items.Add(new ToolStripMenuItem("Sair", null, (_, _) => ExitApp()));

        return menu;
    }

    private void OnStateChanged(SyncState state, string message)
    {
        var ctx = SynchronizationContext.Current;
        void Update()
        {
            var text = $"Sim Racing Companion — {message}";
            _tray.Text    = text.Length > 63 ? text[..63] : text;
            _statusItem.Text = message;

            _tray.Icon = state switch
            {
                SyncState.Unconfigured => SystemIcons.Question,
                SyncState.Syncing      => SystemIcons.Information,
                SyncState.Error        => SystemIcons.Error,
                _                      => SystemIcons.Application
            };
        }

        if (ctx != null) ctx.Post(_ => Update(), null);
        else Update();
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
        _mainForm.AllowClose();
        _mainForm.Close();
        Application.Exit();
    }

    protected override void Dispose(bool disposing)
    {
        if (disposing)
        {
            _tray.Dispose();
            _worker.Dispose();
            _supabase.Dispose();
            _mainForm.Dispose();
        }
        base.Dispose(disposing);
    }
}
