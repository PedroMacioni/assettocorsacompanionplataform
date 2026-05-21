namespace CompanionAgent.Tray;

using System.Text.Json;

public sealed class SyncCache
{
    private static readonly string CachePath = System.IO.Path.Combine(
        Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData),
        "SimRacingCompanion", "synced_ids.json");

    private static readonly JsonSerializerOptions JsonOpts = new() { WriteIndented = true };

    public HashSet<string> SyncedSessionIds { get; private set; } = [];
    public HashSet<string> SyncedTrackOutlineIds { get; private set; } = [];
    public DateTimeOffset? PersonalBestsSyncedAt { get; private set; }

    public static SyncCache Load()
    {
        try
        {
            if (File.Exists(CachePath))
            {
                var data = JsonSerializer.Deserialize<CacheData>(File.ReadAllText(CachePath));
                if (data != null)
                    return new SyncCache
                    {
                        SyncedSessionIds = new HashSet<string>(data.Sessions ?? []),
                        SyncedTrackOutlineIds = new HashSet<string>(data.TrackOutlines ?? []),
                        PersonalBestsSyncedAt = data.PersonalBestsSyncedAt
                    };
            }
        }
        catch { }
        return new SyncCache();
    }

    public void AddSessions(IEnumerable<string> ids)
    {
        foreach (var id in ids) SyncedSessionIds.Add(id);
        Persist();
    }

    public void MarkPersonalBestsSynced()
    {
        PersonalBestsSyncedAt = DateTimeOffset.UtcNow;
        Persist();
    }

    public void MarkTrackOutlinesSynced(IEnumerable<string> trackIds)
    {
        foreach (var id in trackIds) SyncedTrackOutlineIds.Add(id);
        Persist();
    }

    private void Persist()
    {
        Directory.CreateDirectory(System.IO.Path.GetDirectoryName(CachePath)!);
        File.WriteAllText(CachePath, JsonSerializer.Serialize(
            new CacheData
            {
                Sessions = [.. SyncedSessionIds],
                TrackOutlines = [.. SyncedTrackOutlineIds],
                PersonalBestsSyncedAt = PersonalBestsSyncedAt
            },
            JsonOpts));
    }

    private sealed class CacheData
    {
        public List<string>? Sessions { get; set; }
        public List<string>? TrackOutlines { get; set; }
        public DateTimeOffset? PersonalBestsSyncedAt { get; set; }
    }
}
