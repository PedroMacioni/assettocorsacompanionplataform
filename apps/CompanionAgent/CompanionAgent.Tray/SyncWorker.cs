namespace CompanionAgent.Tray;

using Companion.Infrastructure.History;
using Companion.Infrastructure.Tracks;
using System.Net;

public enum SyncState { Unconfigured, Syncing, Idle, Error }

public sealed class SyncWorker : IDisposable
{
    private readonly SupabaseClient _supabase;
    private readonly ILocalHistoryService _history;
    private readonly ILocalTrackService _trackService;
    private SyncCache _cache = SyncCache.Load();
    private System.Threading.Timer? _timer;
    private FileSystemWatcher? _sessionWatcher;
    private FileSystemWatcher? _pbWatcher;
    private int _consecutiveFailures;
    private readonly SemaphoreSlim _lock = new(1, 1);
    private DateTimeOffset? _lastSeenSyncRequest;

    public event Action<SyncState, string>? StateChanged;
    public event Action<string>? ActivityLogged;

    private bool _tracksSyncedThisSession;

    public SyncWorker(SupabaseClient supabase, ILocalHistoryService history, ILocalTrackService trackService)
    {
        _supabase = supabase;
        _history = history;
        _trackService = trackService;
    }

    public void Start(int intervalMinutes)
    {
        SetupWatchers();
        _timer = new System.Threading.Timer(_ => _ = TickAsync(),
            null, TimeSpan.Zero, TimeSpan.FromMinutes(intervalMinutes));
    }

    private async Task TickAsync()
    {
        // Check for web-triggered sync request before the regular sync
        if (_supabase.IsConfigured)
        {
            try
            {
                var requested = await _supabase.GetSyncRequestedAtAsync();
                if (requested.HasValue && requested.Value > (_lastSeenSyncRequest ?? DateTimeOffset.MinValue))
                {
                    _lastSeenSyncRequest = requested.Value;
                    await SyncAsync();
                    return;
                }
            }
            catch { /* non-fatal, fall through to regular sync */ }
        }
        await SyncAsync();
    }

    public void UpdateInterval(int intervalMinutes) =>
        _timer?.Change(TimeSpan.FromMinutes(intervalMinutes), TimeSpan.FromMinutes(intervalMinutes));

    public async Task SyncAsync()
    {
        if (!await _lock.WaitAsync(0))
        {
            ActivityLogged?.Invoke("⏳ Sincronização já em andamento...");
            return;
        }
        try
        {
            if (!_supabase.IsConfigured)
            {
                StateChanged?.Invoke(SyncState.Unconfigured, "Configure seu token nas configurações");
                return;
            }

            StateChanged?.Invoke(SyncState.Syncing, "Sincronizando...");
            ActivityLogged?.Invoke("Iniciando sincronização...");

            var history = _history.GetHistory();

            var unsynced = history.Sessions
                .Where(s => !_cache.SyncedSessionIds.Contains(s.Id))
                .ToList();

            if (unsynced.Count > 0)
            {
                await _supabase.UpsertSessionsAsync(unsynced);

                var allLaps = unsynced
                    .SelectMany(s => _history.GetSessionLaps(s.Id).Laps)
                    .ToList();

                if (allLaps.Count > 0)
                    await _supabase.UpsertLapsAsync(allLaps);

                _cache.AddSessions(unsynced.Select(s => s.Id));
                ActivityLogged?.Invoke($"✓ {unsynced.Count} {(unsynced.Count == 1 ? "sessão nova" : "sessões novas")} sincronizadas ({allLaps.Count} voltas)");
            }
            else
            {
                ActivityLogged?.Invoke("✓ Sessões em dia — nenhuma novidade");
            }

            if (history.PersonalBests.Count > 0)
                await _supabase.UpsertPersonalBestsAsync(history.PersonalBests);

            _cache.MarkPersonalBestsSynced();
            _consecutiveFailures = 0;

            var settings = SettingsStore.Load();
            settings.LastSyncAt = DateTimeOffset.UtcNow;
            settings.LastSyncSessionCount = unsynced.Count;
            SettingsStore.Save(settings);

            try { await _supabase.UpdateAgentStatusAsync(unsynced.Count); } catch { /* non-fatal */ }

            ActivityLogged?.Invoke($"─────────────────────────────────────");
            ActivityLogged?.Invoke($"✓ Sincronização concluída às {DateTime.Now:HH:mm:ss}");

            // Report Idle BEFORE heavy non-critical syncs
            StateChanged?.Invoke(SyncState.Idle, $"Sincronizado às {DateTime.Now:HH:mm}");

            try { await SyncTracksAsync(); } catch { /* non-fatal */ }
            try { await SyncCarBadgesAsync(); } catch { /* non-fatal */ }
        }
        catch (HttpRequestException ex) when (ex.StatusCode == HttpStatusCode.Unauthorized)
        {
            _consecutiveFailures++;
            ActivityLogged?.Invoke($"✗ Erro: Token inválido (401 Unauthorized)");
            StateChanged?.Invoke(SyncState.Error, "Token inválido — abra as configurações");
        }
        catch (Exception ex)
        {
            _consecutiveFailures++;
            ActivityLogged?.Invoke($"✗ Erro: {ex.GetType().Name}: {ex.Message}");
            var msg = _consecutiveFailures >= 3
                ? "Sem conexão — sincronização pausada"
                : "Erro de sincronização";
            StateChanged?.Invoke(SyncState.Error, msg);
        }
        finally
        {
            _lock.Release();
        }
    }

    private async Task SyncTracksAsync()
    {
        var allTracks = _trackService.GetTracks();
        if (allTracks.Count == 0) return;

        var pendingOutlines = allTracks
            .Where(t => t.HasOutline && !_cache.SyncedTrackOutlineIds.Contains(t.TrackId))
            .Take(25)
            .ToList();

        // Skip metadata upsert if already done this session and no new outlines
        if (_tracksSyncedThisSession && pendingOutlines.Count == 0) return;

        var outlineUrls = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);

        if (pendingOutlines.Count > 0)
            ActivityLogged?.Invoke($"↑ Enviando outlines de pistas (0/{pendingOutlines.Count})...");

        for (int i = 0; i < pendingOutlines.Count; i++)
        {
            var track = pendingOutlines[i];
            try
            {
                var bytes = _trackService.GetOutlineBytes(track.TrackId);
                if (bytes is { Length: > 0 })
                {
                    var url = await _supabase.UploadTrackOutlineAsync(track.TrackId, bytes);
                    if (url != null) outlineUrls[track.TrackId] = url;
                }
            }
            catch { /* individual upload failure should not block metadata sync */ }

            if ((i + 1) % 5 == 0 || i == pendingOutlines.Count - 1)
                ActivityLogged?.Invoke($"↑ Enviando outlines de pistas ({i + 1}/{pendingOutlines.Count})...");
        }

        await _supabase.UpsertTracksAsync(allTracks, outlineUrls,
            (done, total) => ActivityLogged?.Invoke($"↑ Pistas sincronizadas ({done}/{total})..."));

        if (outlineUrls.Count > 0)
            _cache.MarkTrackOutlinesSynced(outlineUrls.Keys);

        _tracksSyncedThisSession = true;
        ActivityLogged?.Invoke($"✓ {allTracks.Count} pistas catalogadas · {outlineUrls.Count} outlines enviados");
    }

    private async Task SyncCarBadgesAsync()
    {
        var carsPath = FindAcCarsPath();
        if (carsPath == null) return;

        var allCarIds = _history.GetHistory().Sessions
            .Select(s => s.CarId)
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .Where(id => !_cache.SyncedCarBadgeIds.Contains(id))
            .ToList();

        if (allCarIds.Count == 0) return;

        ActivityLogged?.Invoke($"↑ Enviando badges de carros (0/{allCarIds.Count})...");

        var uploaded = new List<string>();
        for (int i = 0; i < allCarIds.Count; i++)
        {
            var carId = allCarIds[i];
            var badgePath = Path.Combine(carsPath, carId, "ui", "badge.png");
            if (!File.Exists(badgePath)) continue;

            try
            {
                var bytes = File.ReadAllBytes(badgePath);
                if (bytes.Length > 0 && await _supabase.UploadCarBadgeAsync(carId, bytes))
                    uploaded.Add(carId);
            }
            catch { /* individual failure should not block remaining uploads */ }

            if ((i + 1) % 5 == 0 || i == allCarIds.Count - 1)
                ActivityLogged?.Invoke($"↑ Enviando badges de carros ({i + 1}/{allCarIds.Count})...");
        }

        if (uploaded.Count > 0)
        {
            _cache.MarkCarBadgesSynced(uploaded);
            ActivityLogged?.Invoke($"✓ {uploaded.Count} badges de carros enviados");
        }
    }

    private static string? FindAcCarsPath()
    {
        string? steamPath = null;
        try
        {
#pragma warning disable CA1416
            using var key = Microsoft.Win32.Registry.CurrentUser.OpenSubKey(@"SOFTWARE\Valve\Steam");
            steamPath = key?.GetValue("SteamPath") as string;
#pragma warning restore CA1416
        }
        catch { }

        if (string.IsNullOrEmpty(steamPath))
        {
            steamPath = new[] { @"C:\Program Files (x86)\Steam", @"C:\Program Files\Steam" }
                .FirstOrDefault(Directory.Exists);
        }

        if (string.IsNullOrEmpty(steamPath)) return null;

        var path = Path.Combine(steamPath, "steamapps", "common", "assettocorsa", "content", "cars");
        return Directory.Exists(path) ? path : null;
    }

    private void SetupWatchers()
    {
        var sessionsPath = System.IO.Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
            "AcTools Content Manager", "Progress", "Sessions");

        if (Directory.Exists(sessionsPath))
        {
            _sessionWatcher = new FileSystemWatcher(sessionsPath, "*.json")
            {
                NotifyFilter = NotifyFilters.FileName | NotifyFilters.LastWrite,
                EnableRaisingEvents = true
            };
            _sessionWatcher.Created += (_, _) => _ = SyncAsync();
        }

        var acDocPath = System.IO.Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.MyDocuments),
            "Assetto Corsa");

        if (Directory.Exists(acDocPath))
        {
            _pbWatcher = new FileSystemWatcher(acDocPath, "personalbest.ini")
            {
                NotifyFilter = NotifyFilters.LastWrite,
                EnableRaisingEvents = true
            };
            _pbWatcher.Changed += (_, _) => _ = SyncAsync();
        }
    }

    public void Dispose()
    {
        _timer?.Dispose();
        _sessionWatcher?.Dispose();
        _pbWatcher?.Dispose();
        _lock.Dispose();
    }
}
