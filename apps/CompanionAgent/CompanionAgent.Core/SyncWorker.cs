namespace CompanionAgent.Core;

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
    private System.Threading.Timer? _debounceTimer;
    private readonly object _debounceLock = new();
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

    private void ScheduleDebounced()
    {
        lock (_debounceLock)
        {
            _debounceTimer?.Dispose();
            _debounceTimer = new System.Threading.Timer(
                _ => _ = SyncAsync(), null, 800, System.Threading.Timeout.Infinite);
        }
    }

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

            // Pass A: new sessions — sync metadata then fetch laps
            var newSessions = history.Sessions
                .Where(s => !_cache.SyncedSessionIds.Contains(s.Id))
                .ToList();

            int totalNewLaps = 0;
            var lapSyncedIds = new List<string>();

            if (newSessions.Count > 0)
            {
                await _supabase.UpsertSessionsAsync(newSessions);

                foreach (var session in newSessions)
                {
                    try
                    {
                        var laps = _history.GetSessionLaps(session.Id).Laps;
                        var shortId = session.Id[..Math.Min(8, session.Id.Length)];
                        if (laps.Count > 0)
                        {
                            await _supabase.UpsertLapsAsync(laps);
                            totalNewLaps += laps.Count;
                            lapSyncedIds.Add(session.Id);
                            ActivityLogged?.Invoke($"  ✓ Sessão {shortId}: {laps.Count} voltas");
                        }
                        else
                        {
                            ActivityLogged?.Invoke($"  ⚠ Sessão {shortId}: 0 voltas — retry no próximo ciclo");
                        }
                    }
                    catch (Exception ex)
                    {
                        var shortId = session.Id[..Math.Min(8, session.Id.Length)];
                        ActivityLogged?.Invoke($"  ✗ Sessão {shortId}: erro ao ler voltas — {ex.Message}");
                    }
                }

                _cache.AddSessions(newSessions.Select(s => s.Id));
                if (lapSyncedIds.Count > 0)
                    _cache.MarkLapsSynced(lapSyncedIds);

                ActivityLogged?.Invoke($"✓ {newSessions.Count} {(newSessions.Count == 1 ? "sessão nova" : "sessões novas")} sincronizadas ({totalNewLaps} voltas)");
            }
            else
            {
                ActivityLogged?.Invoke("✓ Sessões em dia — nenhuma novidade");
            }

            // Pass B: retry laps for sessions synced without laps
            var lapRetryIds = _cache.SyncedSessionIds
                .Except(_cache.SyncedLapSessionIds)
                .ToList();

            if (lapRetryIds.Count > 0)
            {
                ActivityLogged?.Invoke($"↺ Retentando voltas para {lapRetryIds.Count} {(lapRetryIds.Count == 1 ? "sessão" : "sessões")}...");
                var recoveredIds = new List<string>();

                foreach (var id in lapRetryIds)
                {
                    try
                    {
                        var laps = _history.GetSessionLaps(id).Laps;
                        if (laps.Count > 0)
                        {
                            await _supabase.UpsertLapsAsync(laps);
                            recoveredIds.Add(id);
                            ActivityLogged?.Invoke($"  ✓ Sessão {id[..Math.Min(8, id.Length)]}: {laps.Count} voltas recuperadas");
                        }
                    }
                    catch { /* individual retry failure is non-fatal */ }
                }

                if (recoveredIds.Count > 0)
                {
                    _cache.MarkLapsSynced(recoveredIds);
                    ActivityLogged?.Invoke($"  ✓ {recoveredIds.Count} sessões com voltas recuperadas");
                }
            }

            if (history.PersonalBests.Count > 0)
                await _supabase.UpsertPersonalBestsAsync(history.PersonalBests);

            _cache.MarkPersonalBestsSynced();
            _consecutiveFailures = 0;

            var settings = SettingsStore.Load();
            settings.LastSyncAt = DateTimeOffset.UtcNow;
            settings.LastSyncSessionCount = newSessions.Count;
            SettingsStore.Save(settings);

            try { await _supabase.UpdateAgentStatusAsync(newSessions.Count); } catch { /* non-fatal */ }

            ActivityLogged?.Invoke($"─────────────────────────────────────");
            ActivityLogged?.Invoke($"✓ Sincronização concluída às {DateTime.Now:HH:mm:ss}");

            StateChanged?.Invoke(SyncState.Idle, $"Sincronizado às {DateTime.Now:HH:mm}");

            using var tracksCts = new CancellationTokenSource(TimeSpan.FromSeconds(90));
            try { await SyncTracksAsync(tracksCts.Token); } catch { /* non-fatal */ }

            using var badgesCts = new CancellationTokenSource(TimeSpan.FromSeconds(90));
            try { await SyncCarBadgesAsync(badgesCts.Token); } catch { /* non-fatal */ }

            using var specsCts = new CancellationTokenSource(TimeSpan.FromSeconds(60));
            try { await SyncCarSpecsAsync(specsCts.Token); } catch { /* non-fatal */ }

            using var setupsCts = new CancellationTokenSource(TimeSpan.FromSeconds(90));
            try { await SyncCarSetupsAsync(setupsCts.Token); } catch { /* non-fatal */ }

            ActivityLogged?.Invoke("─────────────────────────────────────");
            ActivityLogged?.Invoke("✓ Agente pronto · abra o dashboard para ver seus dados");
        }
        catch (HttpRequestException ex) when (ex.StatusCode == HttpStatusCode.Unauthorized)
        {
            _consecutiveFailures++;
            ActivityLogged?.Invoke($"✗ Erro: {ex.Message}");
            StateChanged?.Invoke(SyncState.Error, "Conta desconectada — abra as configurações");
        }
        catch (HttpRequestException ex) when (ex.StatusCode == HttpStatusCode.BadRequest)
        {
            _consecutiveFailures++;
            ActivityLogged?.Invoke($"✗ Erro de dados: {ex.Message}");
            StateChanged?.Invoke(SyncState.Error, "Erro nos dados de sincronização");
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

    public async Task ForceResyncLapsAsync()
    {
        _cache.ClearLapSessions();
        await SyncAsync();
    }

    private async Task SyncTracksAsync(CancellationToken ct = default)
    {
        var allTracks = _trackService.GetTracks();
        if (allTracks.Count == 0) return;

        var pendingOutlines = allTracks
            .Where(t => t.HasOutline && !_cache.SyncedTrackOutlineIds.Contains(t.TrackId))
            .Take(25)
            .ToList();

        if ((_tracksSyncedThisSession || _cache.TracksSyncedAt.HasValue) && pendingOutlines.Count == 0) return;

        var outlineUrls = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);

        if (pendingOutlines.Count > 0)
            ActivityLogged?.Invoke($"↑ Enviando outlines de pistas (0/{pendingOutlines.Count})...");

        for (int i = 0; i < pendingOutlines.Count; i++)
        {
            ct.ThrowIfCancellationRequested();
            var track = pendingOutlines[i];
            try
            {
                var bytes = _trackService.GetOutlineBytes(track.TrackId);
                if (bytes is { Length: > 0 })
                {
                    var url = await _supabase.UploadTrackOutlineAsync(track.TrackId, bytes, ct);
                    if (url != null) outlineUrls[track.TrackId] = url;
                }
            }
            catch (OperationCanceledException) { throw; }
            catch { /* individual upload failure should not block metadata sync */ }

            if ((i + 1) % 5 == 0 || i == pendingOutlines.Count - 1)
                ActivityLogged?.Invoke($"↑ Enviando outlines de pistas ({i + 1}/{pendingOutlines.Count})...");
        }

        await _supabase.UpsertTracksAsync(allTracks, outlineUrls,
            (done, total) => ActivityLogged?.Invoke($"↑ Pistas sincronizadas ({done}/{total})..."), ct);

        if (outlineUrls.Count > 0)
            _cache.MarkTrackOutlinesSynced(outlineUrls.Keys);

        _tracksSyncedThisSession = true;
        _cache.MarkTracksSynced();
        ActivityLogged?.Invoke($"✓ {allTracks.Count} pistas catalogadas · {outlineUrls.Count} outlines enviados");
    }

    private async Task SyncCarBadgesAsync(CancellationToken ct = default)
    {
        var carsPath = FindAcCarsPath();
        if (carsPath == null) return;

        var allCarIds = _history.GetHistory().Sessions
            .Select(s => s.CarId)
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .Where(id => !_cache.SyncedCarBadgeIds.Contains(id))
            .ToList();

        if (allCarIds.Count == 0) return;

        ActivityLogged?.Invoke($"↑ Enviando previews de carros (0/{allCarIds.Count})...");

        var uploaded = new List<string>();
        var attempted = new List<string>();
        for (int i = 0; i < allCarIds.Count; i++)
        {
            ct.ThrowIfCancellationRequested();
            var carId = allCarIds[i];

            var candidates = new[]
            {
                (Path.Combine(carsPath, carId, "ui", "car_preview.jpg"), "image/jpeg"),
                (Path.Combine(carsPath, carId, "ui", "preview.jpg"),     "image/jpeg"),
                (Path.Combine(carsPath, carId, "ui", "badge.png"),       "image/png"),
            };

            string? foundPath = null;
            string contentType = "image/png";
            foreach (var (path, mime) in candidates)
            {
                if (File.Exists(path)) { foundPath = path; contentType = mime; break; }
            }

            if (foundPath == null)
            {
                attempted.Add(carId);
                continue;
            }

            try
            {
                var bytes = File.ReadAllBytes(foundPath);
                using var linkedCts = CancellationTokenSource.CreateLinkedTokenSource(ct);
                linkedCts.CancelAfter(TimeSpan.FromSeconds(15));
                if (bytes.Length > 0 && await _supabase.UploadCarPreviewAsync(carId, bytes, contentType, linkedCts.Token))
                    uploaded.Add(carId);
                else
                    ActivityLogged?.Invoke($"  ↳ preview não enviado: {carId}");
            }
            catch (OperationCanceledException) when (ct.IsCancellationRequested) { throw; }
            catch (Exception ex)
            {
                ActivityLogged?.Invoke($"  ↳ erro no preview {carId}: {ex.Message}");
            }

            attempted.Add(carId);

            if ((i + 1) % 5 == 0 || i == allCarIds.Count - 1)
                ActivityLogged?.Invoke($"↑ Enviando previews de carros ({i + 1}/{allCarIds.Count})...");
        }

        if (attempted.Count > 0)
            _cache.MarkCarBadgesSynced(attempted);

        ActivityLogged?.Invoke(uploaded.Count > 0
            ? $"✓ {uploaded.Count}/{attempted.Count} previews de carros enviados"
            : $"✓ Previews de carros: nenhum novo para enviar");
    }

    private async Task SyncCarSpecsAsync(CancellationToken ct = default)
    {
        var carsPath = FindAcCarsPath();
        if (carsPath == null) return;

        var carIds = _history.GetHistory().Sessions
            .Select(s => s.CarId)
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .Where(id => !_cache.SyncedCarSpecIds.Contains(id))
            .ToList();

        if (carIds.Count == 0) return;

        ActivityLogged?.Invoke($"↑ Lendo specs de carros (0/{carIds.Count})...");

        var specs = new List<object>();
        var synced = new List<string>();

        for (int i = 0; i < carIds.Count; i++)
        {
            ct.ThrowIfCancellationRequested();
            var carId = carIds[i];
            var uiCarPath = Path.Combine(carsPath, carId, "ui", "ui_car.json");
            if (!File.Exists(uiCarPath)) continue;

            try
            {
                var spec = ParseUiCarJson(carId, uiCarPath);
                if (spec != null) specs.Add(spec);
                synced.Add(carId);
            }
            catch { /* skip malformed files */ }

            if ((i + 1) % 10 == 0 || i == carIds.Count - 1)
                ActivityLogged?.Invoke($"↑ Lendo specs de carros ({i + 1}/{carIds.Count})...");
        }

        if (specs.Count > 0)
        {
            await _supabase.UpsertCarSpecsAsync(specs);
            _cache.MarkCarSpecsSynced(synced);
            ActivityLogged?.Invoke($"✓ {specs.Count} specs de carros sincronizadas");
        }
        else
        {
            ActivityLogged?.Invoke("✓ Specs: nenhuma nova para sincronizar");
        }
    }

    private async Task SyncCarSetupsAsync(CancellationToken ct = default)
    {
        var setupsBasePath = Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.MyDocuments),
            "Assetto Corsa", "setups");

        if (!Directory.Exists(setupsBasePath)) return;

        var iniFiles = Directory.GetFiles(setupsBasePath, "*.ini", SearchOption.AllDirectories);
        if (iniFiles.Length == 0) return;

        var setups = new List<object>();

        foreach (var iniPath in iniFiles)
        {
            ct.ThrowIfCancellationRequested();
            try
            {
                // Structure: setups/<car_id>/<track_id>/<name>.ini
                var relative = Path.GetRelativePath(setupsBasePath, iniPath);
                var parts = relative.Split(Path.DirectorySeparatorChar);
                if (parts.Length != 3) continue;

                var carId = parts[0];
                var trackId = parts[1];
                var setupName = Path.GetFileNameWithoutExtension(parts[2]);

                var data = ParseIniFile(iniPath);
                if (data.Count == 0) continue;

                setups.Add(new
                {
                    user_id = _supabase.UserId,
                    car_id = carId,
                    track_id = trackId,
                    name = setupName,
                    data,
                    updated_at = File.GetLastWriteTimeUtc(iniPath).ToString("o")
                });
            }
            catch { /* skip malformed files */ }
        }

        if (setups.Count > 0)
        {
            await _supabase.UpsertCarSetupsAsync(setups);
            ActivityLogged?.Invoke($"✓ {setups.Count} setups sincronizados");
        }
        else
        {
            ActivityLogged?.Invoke("✓ Setups: nenhum encontrado");
        }
    }

    private static object? ParseUiCarJson(string carId, string path)
    {
        using var doc = System.Text.Json.JsonDocument.Parse(File.ReadAllText(path));
        var root = doc.RootElement;

        var name = root.TryGetProperty("name", out var n) ? n.GetString() : null;
        if (string.IsNullOrWhiteSpace(name)) name = carId;

        var brand = root.TryGetProperty("brand", out var b) ? b.GetString() : null;
        var carClass = root.TryGetProperty("class", out var c) ? c.GetString() : null;
        var drivetrain = root.TryGetProperty("drivetrain", out var d) ? d.GetString() : null;

        int? year = null;
        if (root.TryGetProperty("year", out var y))
            year = y.ValueKind == System.Text.Json.JsonValueKind.Number ? y.GetInt32()
                 : int.TryParse(y.GetString(), out var yi) ? yi : null;

        int? bhp = null, torque = null, weight = null, topSpeed = null, acceleration = null;

        if (root.TryGetProperty("specs", out var specs))
        {
            bhp       = ParseSpecInt(specs, "bhp");
            torque    = ParseSpecInt(specs, "torque");
            weight    = ParseSpecInt(specs, "weight");
            topSpeed  = ParseSpecInt(specs, "topspeed");

            if (specs.TryGetProperty("acceleration", out var acc))
            {
                var accStr = acc.GetString() ?? "";
                var numStr = new string(accStr.Where(ch => ch == '.' || char.IsDigit(ch)).ToArray());
                if (double.TryParse(numStr, System.Globalization.NumberStyles.Any,
                    System.Globalization.CultureInfo.InvariantCulture, out var accVal))
                    acceleration = (int)Math.Round(accVal * 10);
            }
        }

        return new
        {
            car_id = carId,
            name,
            brand,
            @class = carClass,
            year,
            bhp,
            torque,
            weight,
            top_speed = topSpeed,
            drivetrain,
            acceleration,
            updated_at = DateTimeOffset.UtcNow
        };
    }

    private static int? ParseSpecInt(System.Text.Json.JsonElement specs, string key)
    {
        if (!specs.TryGetProperty(key, out var el)) return null;
        var str = el.GetString() ?? "";
        var numStr = new string(str.TakeWhile(ch => char.IsDigit(ch) || ch == '.').ToArray()).Trim();
        return int.TryParse(numStr, out var v) ? v : null;
    }

    private static Dictionary<string, Dictionary<string, object>> ParseIniFile(string path)
    {
        var result = new Dictionary<string, Dictionary<string, object>>(StringComparer.OrdinalIgnoreCase);
        string? currentSection = null;

        foreach (var rawLine in File.ReadLines(path))
        {
            var line = rawLine.Trim();
            if (string.IsNullOrEmpty(line) || line.StartsWith(';') || line.StartsWith('#')) continue;

            if (line.StartsWith('[') && line.EndsWith(']'))
            {
                currentSection = line[1..^1].Trim();
                if (!result.ContainsKey(currentSection))
                    result[currentSection] = new Dictionary<string, object>(StringComparer.OrdinalIgnoreCase);
                continue;
            }

            if (currentSection == null) continue;

            var eqIdx = line.IndexOf('=');
            if (eqIdx < 1) continue;

            var key = line[..eqIdx].Trim();
            var val = line[(eqIdx + 1)..].Trim();

            var commentIdx = val.IndexOf(';');
            if (commentIdx >= 0) val = val[..commentIdx].Trim();

            if (double.TryParse(val, System.Globalization.NumberStyles.Any,
                System.Globalization.CultureInfo.InvariantCulture, out var numVal))
                result[currentSection][key] = numVal;
            else
                result[currentSection][key] = val;
        }

        return result;
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
            _sessionWatcher.Created += (_, _) => ScheduleDebounced();
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
            _pbWatcher.Changed += (_, _) => ScheduleDebounced();
        }
    }

    public void Dispose()
    {
        _timer?.Dispose();
        lock (_debounceLock) { _debounceTimer?.Dispose(); }
        _sessionWatcher?.Dispose();
        _pbWatcher?.Dispose();
        _lock.Dispose();
    }
}
