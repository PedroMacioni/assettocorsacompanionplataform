namespace CompanionAgent.Tray;

using System.Text.Json;

public sealed class SyncCache
{
    private static readonly string CachePath = System.IO.Path.Combine(
        Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData),
        "SimRacingCompanion", "synced_ids.json");

    private static readonly JsonSerializerOptions JsonOpts = new() { WriteIndented = true };

    public HashSet<string> SyncedSessionIds { get; private set; } = [];
    public HashSet<string> SyncedLapSessionIds { get; private set; } = [];
    public HashSet<string> SyncedTrackOutlineIds { get; private set; } = [];
    public HashSet<string> SyncedCarBadgeIds { get; private set; } = [];
    public DateTimeOffset? PersonalBestsSyncedAt { get; private set; }
    public DateTimeOffset? TracksSyncedAt { get; private set; }

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
                        SyncedSessionIds    = new HashSet<string>(data.Sessions ?? []),
                        SyncedLapSessionIds = new HashSet<string>(data.LapSessions ?? []),
                        SyncedTrackOutlineIds = new HashSet<string>(data.TrackOutlines ?? []),
                        SyncedCarBadgeIds   = new HashSet<string>(data.CarBadges ?? []),
                        PersonalBestsSyncedAt = data.PersonalBestsSyncedAt,
                        TracksSyncedAt      = data.TracksSyncedAt
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

    public void MarkLapsSynced(IEnumerable<string> ids)
    {
        foreach (var id in ids) SyncedLapSessionIds.Add(id);
        Persist();
    }

    public void ClearLapSessions()
    {
        SyncedLapSessionIds.Clear();
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

    public void MarkCarBadgesSynced(IEnumerable<string> carIds)
    {
        foreach (var id in carIds) SyncedCarBadgeIds.Add(id);
        Persist();
    }

    public void MarkTracksSynced()
    {
        TracksSyncedAt = DateTimeOffset.UtcNow;
        Persist();
    }

    private void Persist()
    {
        Directory.CreateDirectory(System.IO.Path.GetDirectoryName(CachePath)!);
        File.WriteAllText(CachePath, JsonSerializer.Serialize(
            new CacheData
            {
                Sessions    = [.. SyncedSessionIds],
                LapSessions = [.. SyncedLapSessionIds],
                TrackOutlines = [.. SyncedTrackOutlineIds],
                CarBadges   = [.. SyncedCarBadgeIds],
                PersonalBestsSyncedAt = PersonalBestsSyncedAt,
                TracksSyncedAt = TracksSyncedAt
            },
            JsonOpts));
    }

    private sealed class CacheData
    {
        public List<string>? Sessions { get; set; }
        public List<string>? LapSessions { get; set; }
        public List<string>? TrackOutlines { get; set; }
        public List<string>? CarBadges { get; set; }
        public DateTimeOffset? PersonalBestsSyncedAt { get; set; }
        public DateTimeOffset? TracksSyncedAt { get; set; }
    }
}
