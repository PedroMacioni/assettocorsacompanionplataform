namespace CompanionAgent.Tray;

using Companion.Infrastructure.History;
using System.Runtime.InteropServices;

public sealed class MainForm : Form
{
    [DllImport("dwmapi.dll")]
    private static extern int DwmSetWindowAttribute(IntPtr hwnd, int attr, ref int attrValue, int attrSize);

    // ── Palette ───────────────────────────────────────────────────────────
    private static readonly Color BgDark    = Color.FromArgb(13,  13,  13);
    private static readonly Color BgCard    = Color.FromArgb(22,  22,  22);
    private static readonly Color BgSub     = Color.FromArgb(18,  18,  18);
    private static readonly Color Border    = Color.FromArgb(40,  40,  40);
    private static readonly Color TxtPri    = Color.FromArgb(230, 230, 230);
    private static readonly Color TxtSec    = Color.FromArgb(110, 110, 110);
    private static readonly Color Green     = Color.FromArgb(74,  222, 128);
    private static readonly Color Red       = Color.FromArgb(248, 113, 113);
    private static readonly Color Yellow    = Color.FromArgb(250, 204,  21);

    // ── State ─────────────────────────────────────────────────────────────
    private readonly SyncWorker _worker;
    private readonly SupabaseClient _supabase;
    private readonly ILocalHistoryService _historyService;
    private AgentSettings _settings;
    private readonly Action<AgentSettings> _onSettingsSaved;
    private bool _allowClose;

    // ── Controls ──────────────────────────────────────────────────────────
    private Label _dotLabel       = null!;
    private Label _connLabel      = null!;
    private Label _stateLabel     = null!;
    private Button _syncBtn       = null!;
    private RichTextBox _logBox   = null!;

    public MainForm(
        SupabaseClient supabase,
        SyncWorker worker,
        ILocalHistoryService historyService,
        AgentSettings settings,
        Action<AgentSettings> onSettingsSaved)
    {
        _worker          = worker;
        _supabase        = supabase;
        _historyService  = historyService;
        _settings        = settings;
        _onSettingsSaved = onSettingsSaved;

        BuildUI();

        _worker.StateChanged   += OnStateChanged;
        _worker.ActivityLogged += OnActivityLogged;

        FormClosing += (_, e) => { if (!_allowClose) e.Cancel = true; if (e.Cancel) Hide(); };
    }

    public void AllowClose() => _allowClose = true;

    protected override void OnHandleCreated(EventArgs e)
    {
        base.OnHandleCreated(e);
        int v = 1;
        DwmSetWindowAttribute(Handle, 20, ref v, 4); // dark title bar
    }

    protected override void Dispose(bool disposing)
    {
        if (disposing)
        {
            _worker.StateChanged   -= OnStateChanged;
            _worker.ActivityLogged -= OnActivityLogged;
        }
        base.Dispose(disposing);
    }

    // ── Event handlers ────────────────────────────────────────────────────

    private void OnStateChanged(SyncState state, string message)
    {
        if (IsDisposed || !IsHandleCreated) return;
        BeginInvoke(() =>
        {
            _stateLabel.Text = message;
            _stateLabel.ForeColor = state switch
            {
                SyncState.Syncing      => Yellow,
                SyncState.Error        => Red,
                SyncState.Unconfigured => TxtSec,
                _                      => Green
            };

            _syncBtn.Enabled = state != SyncState.Syncing;

            _dotLabel.ForeColor  = _supabase.IsConfigured ? Green : Red;
            _connLabel.Text      = _supabase.IsConfigured ? "Conectado" : "Não configurado";
            _connLabel.ForeColor = _supabase.IsConfigured ? TxtPri : TxtSec;
        });
    }

    private void OnActivityLogged(string message)
    {
        if (IsDisposed || !IsHandleCreated) return;
        BeginInvoke(() =>
        {
            var time = DateTime.Now.ToString("HH:mm");

            _logBox.SelectionStart  = _logBox.TextLength;
            _logBox.SelectionLength = 0;
            _logBox.SelectionColor  = TxtSec;
            _logBox.AppendText($"[{time}]  ");
            _logBox.SelectionColor  = TxtPri;
            _logBox.AppendText(message + "\n");
            _logBox.ScrollToCaret();
        });
    }

    // ── UI construction ───────────────────────────────────────────────────

    private void BuildUI()
    {
        Text              = "Sim Racing Companion";
        ClientSize        = new Size(460, 510);
        FormBorderStyle   = FormBorderStyle.FixedSingle;
        MaximizeBox       = false;
        StartPosition     = FormStartPosition.CenterScreen;
        BackColor         = BgDark;
        ForeColor         = TxtPri;
        Font              = new Font("Segoe UI", 9f);

        // ── Header ────────────────────────────────────────────────────────
        var header = MakePanel(0, 0, 460, 64, BgDark);
        header.Controls.Add(MakeLabel("APEX", 20, 14, TxtPri, 15f, FontStyle.Bold));
        header.Controls.Add(MakeLabel("Sim Racing Companion  v1.0", 20, 40, TxtSec, 8f));

        // ── Connection bar ────────────────────────────────────────────────
        var connBar = MakePanel(0, 64, 460, 36, BgSub);
        connBar.Paint += (_, e) =>
            e.Graphics.DrawLine(new Pen(Border), 0, 0, 460, 0);

        _dotLabel  = MakeLabel("●", 18, 11, _supabase.IsConfigured ? Green : Red, 10f);
        _connLabel = MakeLabel(
            _supabase.IsConfigured ? "Conectado" : "Não configurado",
            36, 11, _supabase.IsConfigured ? TxtPri : TxtSec, 8.5f);
        connBar.Controls.AddRange(new Control[] { _dotLabel, _connLabel });

        // ── Sync status card ──────────────────────────────────────────────
        var syncCard = MakeCard(12, 112, 436, 96);
        syncCard.Controls.Add(MakeLabel("STATUS", 14, 12, TxtSec, 7f, FontStyle.Bold));

        _stateLabel = MakeLabel("Iniciando...", 14, 32, TxtSec, 10f);

        _syncBtn = new Button
        {
            Text      = "Sincronizar agora",
            Location  = new Point(298, 58),
            Size      = new Size(124, 26),
            FlatStyle = FlatStyle.Flat,
            BackColor = Color.FromArgb(35, 35, 35),
            ForeColor = TxtPri,
            Cursor    = Cursors.Hand,
            Font      = new Font("Segoe UI", 8.5f)
        };
        _syncBtn.FlatAppearance.BorderColor        = Border;
        _syncBtn.FlatAppearance.MouseOverBackColor = Color.FromArgb(45, 45, 45);
        _syncBtn.Click += (_, _) =>
        {
            _syncBtn.Enabled = false;
            _ = _worker.SyncAsync().ContinueWith(_ =>
            {
                if (IsDisposed || !IsHandleCreated) return;
                BeginInvoke(() => { if (_stateLabel.Text != "Sincronizando...") _syncBtn.Enabled = true; });
            });
        };

        var resyncBtn = new Button
        {
            Text      = "Re-sync voltas",
            Location  = new Point(14, 58),
            Size      = new Size(110, 26),
            FlatStyle = FlatStyle.Flat,
            BackColor = Color.FromArgb(28, 28, 28),
            ForeColor = TxtSec,
            Cursor    = Cursors.Hand,
            Font      = new Font("Segoe UI", 8f)
        };
        resyncBtn.FlatAppearance.BorderColor        = Border;
        resyncBtn.FlatAppearance.MouseOverBackColor = Color.FromArgb(38, 38, 38);
        resyncBtn.Click += (_, _) =>
        {
            resyncBtn.Enabled = false;
            _syncBtn.Enabled  = false;
            _ = _worker.ForceResyncLapsAsync().ContinueWith(_ =>
            {
                if (IsDisposed || !IsHandleCreated) return;
                BeginInvoke(() => { resyncBtn.Enabled = true; _syncBtn.Enabled = true; });
            });
        };

        syncCard.Controls.AddRange(new Control[] { _stateLabel, _syncBtn, resyncBtn });

        // ── Activity log card ─────────────────────────────────────────────
        var logCard = MakeCard(12, 220, 436, 232);
        logCard.Controls.Add(MakeLabel("ATIVIDADE RECENTE", 14, 12, TxtSec, 7f, FontStyle.Bold));

        _logBox = new RichTextBox
        {
            Location    = new Point(14, 32),
            Size        = new Size(408, 186),
            BackColor   = BgCard,
            ForeColor   = TxtSec,
            BorderStyle = BorderStyle.None,
            ReadOnly    = true,
            ScrollBars  = RichTextBoxScrollBars.Vertical,
            Font        = new Font("Consolas", 8f),
            DetectUrls  = false
        };
        logCard.Controls.Add(_logBox);

        // ── Footer ────────────────────────────────────────────────────────
        var footer = MakePanel(0, 464, 460, 46, BgSub);
        footer.Paint += (_, e) =>
            e.Graphics.DrawLine(new Pen(Border), 0, 0, 460, 0);

        var btnDash = MakeFooterButton("Abrir Dashboard", 12);
        btnDash.Click += (_, _) =>
            System.Diagnostics.Process.Start(
                new System.Diagnostics.ProcessStartInfo("https://sim-racing-companion.vercel.app")
                    { UseShellExecute = true });

        var btnCfg = MakeFooterButton("Configurações", 158);
        btnCfg.Click += (_, _) =>
        {
            var form = new SettingsForm(_settings, _supabase, _historyService, saved =>
            {
                _settings = saved;
                _onSettingsSaved(saved);
                BeginInvoke(() =>
                {
                    _dotLabel.ForeColor  = _supabase.IsConfigured ? Green : Red;
                    _connLabel.Text      = _supabase.IsConfigured ? "Conectado" : "Não configurado";
                    _connLabel.ForeColor = _supabase.IsConfigured ? TxtPri : TxtSec;
                });
            });
            form.Show();
        };

        var btnMin = MakeFooterButton("Minimizar ▼", 304);
        btnMin.Click += (_, _) => Hide();

        footer.Controls.AddRange(new Control[] { btnDash, btnCfg, btnMin });

        Controls.AddRange(new Control[] { header, connBar, syncCard, logCard, footer });
    }

    // ── Helpers ───────────────────────────────────────────────────────────

    private static Panel MakePanel(int x, int y, int w, int h, Color bg)
        => new() { Location = new Point(x, y), Size = new Size(w, h), BackColor = bg };

    private Panel MakeCard(int x, int y, int w, int h)
    {
        var p = new Panel
        {
            Location  = new Point(x, y),
            Size      = new Size(w, h),
            BackColor = BgCard
        };
        p.Paint += (_, e) =>
        {
            using var pen = new Pen(Border);
            e.Graphics.DrawRectangle(pen, 0, 0, w - 1, h - 1);
        };
        return p;
    }

    private static Label MakeLabel(
        string text, int x, int y, Color color,
        float size = 9f, FontStyle style = FontStyle.Regular)
        => new()
        {
            Text      = text,
            Location  = new Point(x, y),
            AutoSize  = true,
            ForeColor = color,
            BackColor = Color.Transparent,
            Font      = new Font("Segoe UI", size, style)
        };

    private static Button MakeFooterButton(string text, int x)
    {
        var btn = new Button
        {
            Text      = text,
            Location  = new Point(x, 8),
            Size      = new Size(136, 28),
            FlatStyle = FlatStyle.Flat,
            BackColor = Color.FromArgb(30, 30, 30),
            ForeColor = Color.FromArgb(150, 150, 150),
            Cursor    = Cursors.Hand,
            Font      = new Font("Segoe UI", 8.5f)
        };
        btn.FlatAppearance.BorderColor        = Color.FromArgb(40, 40, 40);
        btn.FlatAppearance.MouseOverBackColor = Color.FromArgb(40, 40, 40);
        return btn;
    }
}
