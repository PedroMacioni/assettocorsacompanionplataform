namespace CompanionAgent.Tray;

using Companion.Infrastructure.History;
using System.Drawing.Drawing2D;
using System.Runtime.InteropServices;

public sealed class SettingsForm : Form
{
    [DllImport("dwmapi.dll")]
    private static extern int DwmSetWindowAttribute(IntPtr hwnd, int attr, ref int attrValue, int attrSize);

    private static readonly Color BgDark  = Color.FromArgb(13,  13,  13);
    private static readonly Color BgCard  = Color.FromArgb(22,  22,  22);
    private static readonly Color BgSub   = Color.FromArgb(18,  18,  18);
    private static readonly Color Border  = Color.FromArgb(40,  40,  40);
    private static readonly Color TxtPri  = Color.FromArgb(230, 230, 230);
    private static readonly Color TxtSec  = Color.FromArgb(110, 110, 110);
    private static readonly Color Green   = Color.FromArgb(74,  222, 128);
    private static readonly Color Red     = Color.FromArgb(248, 113, 113);

    private readonly SupabaseClient _supabase;
    private readonly ILocalHistoryService _historyService;
    private readonly Action<AgentSettings> _onSave;

    private Panel         _authCard        = null!;
    private NumericUpDown _intervalBox     = null!;
    private CheckBox      _autoStartBox    = null!;
    private TextBox       _sessionsPathBox = null!;
    private TextBox       _pbPathBox       = null!;

    public SettingsForm(AgentSettings current, SupabaseClient supabase, ILocalHistoryService historyService, Action<AgentSettings> onSave)
    {
        _supabase       = supabase;
        _historyService = historyService;
        _onSave         = onSave;

        Text            = "Settings";
        FormBorderStyle = FormBorderStyle.FixedSingle;
        MaximizeBox     = false;
        MinimizeBox     = false;
        StartPosition   = FormStartPosition.CenterScreen;
        ClientSize      = new Size(420, 520);
        BackColor       = BgDark;
        ForeColor       = TxtPri;
        Font            = new Font("Segoe UI", 9f);

        BuildUI(current);
    }

    protected override void OnHandleCreated(EventArgs e)
    {
        base.OnHandleCreated(e);
        int v = 1;
        DwmSetWindowAttribute(Handle, 20, ref v, 4);
    }

    private void BuildUI(AgentSettings current)
    {
        // ── Header ────────────────────────────────────────────────────────
        var header = MakePanel(0, 0, 420, 50, BgDark);
        header.Controls.Add(MakeLabel("Settings", 16, 10, TxtPri, 11f, FontStyle.Bold));
        header.Controls.Add(MakeLabel("Sim Racing Companion", 16, 32, TxtSec, 8f));

        // ── Auth card (dynamic) ───────────────────────────────────────────
        _authCard = MakeCard(12, 62, 396, 152);
        _authCard.Controls.Add(MakeLabel("ACCOUNT", 14, 12, TxtSec, 7f, FontStyle.Bold));
        PopulateAuthCard();

        // ── Sync card ─────────────────────────────────────────────────────
        var syncCard = MakeCard(12, 226, 396, 84);
        syncCard.Controls.Add(MakeLabel("SYNC", 14, 12, TxtSec, 7f, FontStyle.Bold));

        syncCard.Controls.Add(MakeLabel("Interval (min):", 14, 36, TxtSec, 8.5f));
        _intervalBox = new NumericUpDown
        {
            Location  = new Point(130, 33),
            Size      = new Size(60, 24),
            Minimum   = 1, Maximum = 60,
            Value     = current.SyncIntervalMinutes,
            BackColor = BgCard,
            ForeColor = TxtPri
        };
        syncCard.Controls.Add(_intervalBox);

        _autoStartBox = new CheckBox
        {
            Text      = "Start with Windows",
            Location  = new Point(14, 58),
            AutoSize  = true,
            Checked   = AutoStartManager.IsEnabled(),
            ForeColor = TxtSec
        };
        syncCard.Controls.Add(_autoStartBox);

        // ── Data sources card ─────────────────────────────────────────────
        var (currentSessionsPath, currentPbPath) = _historyService.GetCurrentPaths();

        var dataCard = MakeCard(12, 322, 396, 140);
        dataCard.Controls.Add(MakeLabel("DATA SOURCES", 14, 12, TxtSec, 7f, FontStyle.Bold));
        dataCard.Controls.Add(MakeLabel("Leave empty to use the default path", 14, 30, TxtSec, 7f));

        dataCard.Controls.Add(MakeLabel("Sessions:", 14, 52, TxtSec, 8.5f));
        _sessionsPathBox = MakeTextBox(14, 70, 330, current.CustomSessionsPath);
        _sessionsPathBox.PlaceholderText = currentSessionsPath;
        dataCard.Controls.Add(_sessionsPathBox);

        var browseSessionsBtn = MakeButton("...", 350, 70, 32, 24, (_, _) => BrowseFolder(_sessionsPathBox));
        dataCard.Controls.Add(browseSessionsBtn);

        dataCard.Controls.Add(MakeLabel("Personal Bests:", 14, 98, TxtSec, 8.5f));
        _pbPathBox = MakeTextBox(14, 116, 330, current.CustomPersonalBestPath);
        _pbPathBox.PlaceholderText = currentPbPath;
        dataCard.Controls.Add(_pbPathBox);

        var browsePbBtn = MakeButton("...", 350, 116, 32, 24, (_, _) => BrowseFile(_pbPathBox, "INI files (*.ini)|*.ini|All files (*.*)|*.*"));
        dataCard.Controls.Add(browsePbBtn);

        // ── Footer ────────────────────────────────────────────────────────
        var footer = MakePanel(0, 474, 420, 46, BgSub);
        footer.Paint += (_, e) => e.Graphics.DrawLine(new Pen(Border), 0, 0, 420, 0);

        var saveBtn   = MakeButton("Save",   210, 8, 90, 28, OnSave);
        var cancelBtn = MakeButton("Cancel", 310, 8, 90, 28, (_, _) => Close());
        footer.Controls.AddRange(new Control[] { saveBtn, cancelBtn });

        Controls.AddRange(new Control[] { header, _authCard, syncCard, dataCard, footer });
    }

    private void BrowseFolder(TextBox target)
    {
        using var dialog = new FolderBrowserDialog();
        if (!string.IsNullOrEmpty(target.Text) && Directory.Exists(target.Text))
            dialog.SelectedPath = target.Text;
        if (dialog.ShowDialog() == DialogResult.OK)
            target.Text = dialog.SelectedPath;
    }

    private void BrowseFile(TextBox target, string filter)
    {
        using var dialog = new OpenFileDialog { Filter = filter };
        if (!string.IsNullOrEmpty(target.Text) && File.Exists(target.Text))
            dialog.FileName = target.Text;
        if (dialog.ShowDialog() == DialogResult.OK)
            target.Text = dialog.FileName;
    }

    // ── Auth card content (swappable) ─────────────────────────────────────

    private void PopulateAuthCard()
    {
        // Remove all controls except the title label (first one added)
        while (_authCard.Controls.Count > 1)
            _authCard.Controls.RemoveAt(1);

        if (_supabase.IsConfigured)
            BuildUserCard();
        else
            BuildLoginForm();
    }

    private void BuildUserCard()
    {
        var email    = _supabase.UserEmail;
        var initials = GetInitials(email);

        // Avatar circle
        var avatar = new Panel
        {
            Location  = new Point(14, 36),
            Size      = new Size(56, 56),
            BackColor = Color.Transparent
        };
        avatar.Paint += (_, e) =>
        {
            e.Graphics.SmoothingMode = SmoothingMode.AntiAlias;
            using var bgBrush = new SolidBrush(Color.FromArgb(30, 74, 222, 128));
            using var borderPen = new Pen(Green, 1.5f);
            e.Graphics.FillEllipse(bgBrush, 1, 1, 54, 54);
            e.Graphics.DrawEllipse(borderPen, 1, 1, 54, 54);
            using var font = new Font("Segoe UI", 17f, FontStyle.Bold, GraphicsUnit.Pixel);
            using var textBrush = new SolidBrush(Green);
            var sz = e.Graphics.MeasureString(initials, font);
            e.Graphics.DrawString(initials, font, textBrush,
                (56 - sz.Width) / 2f, (56 - sz.Height) / 2f);
        };
        _authCard.Controls.Add(avatar);

        // Email
        var emailLabel = MakeLabel(email, 82, 42, TxtPri, 9f);
        _authCard.Controls.Add(emailLabel);

        // "Conectado" dot + text
        var connDot  = MakeLabel("●", 82, 64, Green, 7f);
        var connText = MakeLabel("Connected", 96, 64, TxtSec, 7.5f);
        _authCard.Controls.Add(connDot);
        _authCard.Controls.Add(connText);

        // Divider line
        var sep = new Panel
        {
            Location  = new Point(14, 106),
            Size      = new Size(368, 1),
            BackColor = Border
        };
        _authCard.Controls.Add(sep);

        // Logout button
        var logoutBtn = MakeButton("Sign out", 14, 116, 120, 26, OnLogout);
        logoutBtn.ForeColor = Red;
        logoutBtn.FlatAppearance.BorderColor = Color.FromArgb(60, 40, 40);
        _authCard.Controls.Add(logoutBtn);
    }

    private void BuildLoginForm()
    {
        _authCard.Controls.Add(MakeLabel("Email:", 14, 36, TxtSec, 8.5f));
        var emailBox = MakeTextBox(90, 32, 290, "");
        _authCard.Controls.Add(emailBox);

        _authCard.Controls.Add(MakeLabel("Password:", 14, 70, TxtSec, 8.5f));
        var passBox = MakeTextBox(90, 66, 290, "", passwordChar: '●');
        _authCard.Controls.Add(passBox);

        var statusLabel = MakeLabel("", 90, 106, TxtSec, 8f);
        _authCard.Controls.Add(statusLabel);

        var loginBtn = MakeButton("Sign in", 90, 100, 110, 28, null!);
        loginBtn.Click += async (_, _) =>
        {
            var email = emailBox.Text.Trim();
            var pass  = passBox.Text;
            if (string.IsNullOrEmpty(email) || string.IsNullOrEmpty(pass))
            {
                statusLabel.Text      = "Enter email and password.";
                statusLabel.ForeColor = Red;
                return;
            }

            loginBtn.Enabled      = false;
            statusLabel.Text      = "Signing in…";
            statusLabel.ForeColor = TxtSec;

            var result = await _supabase.SignInAsync(email, pass);
            if (result is null)
            {
                statusLabel.Text      = "Invalid credentials.";
                statusLabel.ForeColor = Red;
                loginBtn.Enabled      = true;
                return;
            }

            var settings = SettingsStore.Load();
            settings.UserToken    = result.Value.AccessToken;
            settings.RefreshToken = result.Value.RefreshToken;
            SettingsStore.Save(settings);

            // Rebuild to show user card
            BeginInvoke(PopulateAuthCard);
        };
        _authCard.Controls.Add(loginBtn);
    }

    private void OnLogout(object? sender, EventArgs e)
    {
        _supabase.ClearTokens();
        var settings = SettingsStore.Load();
        settings.UserToken    = "";
        settings.RefreshToken = "";
        SettingsStore.Save(settings);
        PopulateAuthCard();
    }

    private void OnSave(object? sender, EventArgs e)
    {
        var settings = SettingsStore.Load();
        settings.SyncIntervalMinutes   = (int)_intervalBox.Value;
        settings.AutoStart             = _autoStartBox.Checked;
        settings.CustomSessionsPath    = _sessionsPathBox.Text.Trim();
        settings.CustomPersonalBestPath = _pbPathBox.Text.Trim();
        SettingsStore.Save(settings);

        if (_autoStartBox.Checked) AutoStartManager.Enable();
        else AutoStartManager.Disable();

        _onSave(settings);
        Close();
    }

    // ── Helpers ───────────────────────────────────────────────────────────

    private static string GetInitials(string email)
    {
        var local = email.Split('@')[0];
        var letters = local.Where(char.IsLetter).ToArray();
        return letters.Length >= 2
            ? $"{char.ToUpper(letters[0])}{char.ToUpper(letters[1])}"
            : letters.Length == 1
                ? char.ToUpper(letters[0]).ToString()
                : "?";
    }

    private static Panel MakePanel(int x, int y, int w, int h, Color bg)
        => new() { Location = new Point(x, y), Size = new Size(w, h), BackColor = bg };

    private Panel MakeCard(int x, int y, int w, int h)
    {
        var p = new Panel { Location = new Point(x, y), Size = new Size(w, h), BackColor = BgCard };
        p.Paint += (_, e) =>
        {
            using var pen = new Pen(Border);
            e.Graphics.DrawRectangle(pen, 0, 0, w - 1, h - 1);
        };
        return p;
    }

    private static Label MakeLabel(string text, int x, int y, Color color,
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

    private TextBox MakeTextBox(int x, int y, int w, string value, char? passwordChar = null)
    {
        var tb = new TextBox
        {
            Location    = new Point(x, y),
            Size        = new Size(w, 24),
            Text        = value,
            BackColor   = BgSub,
            ForeColor   = TxtPri,
            BorderStyle = BorderStyle.FixedSingle
        };
        if (passwordChar.HasValue) tb.PasswordChar = passwordChar.Value;
        return tb;
    }

    private static Button MakeButton(string text, int x, int y, int w, int h, EventHandler? onClick)
    {
        var btn = new Button
        {
            Text      = text,
            Location  = new Point(x, y),
            Size      = new Size(w, h),
            FlatStyle = FlatStyle.Flat,
            BackColor = Color.FromArgb(35, 35, 35),
            ForeColor = Color.FromArgb(200, 200, 200),
            Cursor    = Cursors.Hand,
            Font      = new Font("Segoe UI", 8.5f)
        };
        btn.FlatAppearance.BorderColor        = Color.FromArgb(50, 50, 50);
        btn.FlatAppearance.MouseOverBackColor = Color.FromArgb(45, 45, 45);
        if (onClick != null) btn.Click += onClick;
        return btn;
    }
}
