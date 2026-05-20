namespace CompanionAgent.Tray;

public sealed class SettingsForm : Form
{
    private readonly SupabaseClient _supabase;
    private readonly Action<AgentSettings> _onSave;

    private readonly TextBox _tokenBox;
    private readonly TextBox _refreshTokenBox;
    private readonly NumericUpDown _intervalBox;
    private readonly CheckBox _autoStartBox;
    private readonly Label _statusLabel;
    private readonly Button _verifyBtn;
    private readonly Button _saveBtn;

    public SettingsForm(AgentSettings current, SupabaseClient supabase, Action<AgentSettings> onSave)
    {
        _supabase = supabase;
        _onSave = onSave;

        Text = "Sim Racing Companion — Configurações";
        FormBorderStyle = FormBorderStyle.FixedDialog;
        MaximizeBox = false;
        MinimizeBox = false;
        StartPosition = FormStartPosition.CenterScreen;
        ClientSize = new Size(480, 320);

        int y = 16, lx = 16, fx = 140, fw = 320;

        AddLabel("Token de acesso (JWT):", lx, y);
        _tokenBox = AddTextBox(fx, y, fw - 60, current.UserToken, passwordChar: '●');
        _verifyBtn = AddButton("Verificar", fx + fw - 56, y, 56, 24, OnVerifyAsync);
        y += 36;

        AddLabel("Refresh Token:", lx, y);
        _refreshTokenBox = AddTextBox(fx, y, fw, current.RefreshToken, passwordChar: '●');
        y += 36;

        AddLabel("Sync a cada (min):", lx, y);
        _intervalBox = new NumericUpDown
        {
            Location = new Point(fx, y), Size = new Size(60, 24),
            Minimum = 1, Maximum = 60, Value = current.SyncIntervalMinutes
        };
        Controls.Add(_intervalBox);
        y += 36;

        _autoStartBox = new CheckBox
        {
            Text = "Iniciar com o Windows",
            Location = new Point(fx, y), AutoSize = true,
            Checked = AutoStartManager.IsEnabled()
        };
        Controls.Add(_autoStartBox);
        y += 36;

        _statusLabel = new Label
        {
            Location = new Point(lx, y), Size = new Size(fx + fw - lx, 20),
            ForeColor = Color.Gray, Text = FormatLastSync(current)
        };
        Controls.Add(_statusLabel);
        y += 32;

        _saveBtn = AddButton("Salvar", fx + fw - 80, y, 80, 28, OnSave);
        AddButton("Cancelar", fx + fw - 168, y, 80, 28, (_, _) => Close());
    }

    private static string FormatLastSync(AgentSettings s) =>
        s.LastSyncAt.HasValue
            ? $"Última sync: {s.LastSyncAt:dd/MM/yyyy HH:mm} ({s.LastSyncSessionCount} sessões)"
            : "Nunca sincronizado";

    private async void OnVerifyAsync(object? sender, EventArgs e)
    {
        _verifyBtn.Enabled = false;
        _statusLabel.Text = "Verificando...";
        _statusLabel.ForeColor = Color.Gray;
        var ok = await _supabase.ValidateTokenAsync(_tokenBox.Text.Trim());
        _statusLabel.Text = ok ? "Token válido!" : "Token inválido ou expirado.";
        _statusLabel.ForeColor = ok ? Color.Green : Color.Red;
        _verifyBtn.Enabled = true;
    }

    private void OnSave(object? sender, EventArgs e)
    {
        var settings = SettingsStore.Load();
        settings.UserToken = _tokenBox.Text.Trim();
        settings.RefreshToken = _refreshTokenBox.Text.Trim();
        settings.SyncIntervalMinutes = (int)_intervalBox.Value;
        settings.AutoStart = _autoStartBox.Checked;
        SettingsStore.Save(settings);

        if (_autoStartBox.Checked) AutoStartManager.Enable();
        else AutoStartManager.Disable();

        _onSave(settings);
        Close();
    }

    private Label AddLabel(string text, int x, int y)
    {
        var lbl = new Label { Text = text, Location = new Point(x, y + 4), AutoSize = true };
        Controls.Add(lbl);
        return lbl;
    }

    private TextBox AddTextBox(int x, int y, int w, string value, char? passwordChar = null)
    {
        var tb = new TextBox { Location = new Point(x, y), Size = new Size(w, 24), Text = value };
        if (passwordChar.HasValue) tb.PasswordChar = passwordChar.Value;
        Controls.Add(tb);
        return tb;
    }

    private Button AddButton(string text, int x, int y, int w, int h, EventHandler onClick)
    {
        var btn = new Button { Text = text, Location = new Point(x, y), Size = new Size(w, h) };
        btn.Click += onClick;
        Controls.Add(btn);
        return btn;
    }
}
