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
        if (!await _lock.WaitAsync(0)) return;
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
                _cache.AddSessions(unsynced.Select(s => s.Id));
                ActivityLogged?.Invoke($"✓ {unsynced.Count} {(unsynced.Count == 1 ? "sessão nova" : "sessões novas")} sincronizadas");
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

            // Report Idle BEFORE track sync — tracks sync is heavy and non-critical
            StateChanged?.Invoke(SyncState.Idle, $"Sincronizado às {DateTime.Now:HH:mm}");

            try { await SyncTracksAsync(); } catch { /* non-fatal */ }
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

        foreach (var track in pendingOutlines)
        {
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
        }

        await _supabase.UpsertTracksAsync(allTracks, outlineUrls);

        if (outlineUrls.Count > 0)
            _cache.MarkTrackOutlinesSynced(outlineUrls.Keys);

        _tracksSyncedThisSession = true;
        ActivityLogged?.Invoke($"↑ {allTracks.Count} pistas catalogadas · {outlineUrls.Count} outlines novos");
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
