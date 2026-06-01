namespace CompanionAgent.Core;

using System.Text.Json;

public static class SettingsStore
{
    private static readonly string Path = System.IO.Path.Combine(
        Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData),
        "SimRacingCompanion", "settings.json");

    private static readonly JsonSerializerOptions JsonOpts = new() { WriteIndented = true };

    public static AgentSettings Load()
    {
        try
        {
            if (File.Exists(Path))
                return JsonSerializer.Deserialize<AgentSettings>(File.ReadAllText(Path)) ?? new AgentSettings();
        }
        catch { }
        return new AgentSettings();
    }

    public static void Save(AgentSettings settings)
    {
        Directory.CreateDirectory(System.IO.Path.GetDirectoryName(Path)!);
        File.WriteAllText(Path, JsonSerializer.Serialize(settings, JsonOpts));
    }
}
