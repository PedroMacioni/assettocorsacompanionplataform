using System.Globalization;
using System.Text.Json;
using System.Text.RegularExpressions;
using Companion.Domain.History;
using Companion.SharedContracts.History;

namespace Companion.Infrastructure.History;

public sealed class LocalHistoryService : ILocalHistoryService
{
    private const string EmptyValue = "--";

    private string? _customSessionsPath;
    private string? _customPersonalBestPath;

    public void SetCustomPaths(string? sessionsPath, string? personalBestPath)
    {
        _customSessionsPath = string.IsNullOrWhiteSpace(sessionsPath) ? null : sessionsPath;
        _customPersonalBestPath = string.IsNullOrWhiteSpace(personalBestPath) ? null : personalBestPath;
    }

    public (string SessionsPath, string PersonalBestPath) GetCurrentPaths()
    {
        var sources = GetSources();
        return (sources.ContentManagerSessionsPath, sources.PersonalBestPath);
    }

    public HistoryResponse GetHistory()
    {
        var sources = GetSources();
        var cmDataFile = Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
            "AcTools Content Manager", "Progress", "Profile (Sessions).data");
        var sampleDataFile = Path.Combine(AppContext.BaseDirectory, "sample-data", "Profile (Sessions).data");
        var dataFilePath = File.Exists(cmDataFile) ? cmDataFile : sampleDataFile;
        var import = new HistoryImportResult(
            LoadSessions(sources.ContentManagerSessionsPath, dataFilePath),
            LoadPersonalBests(sources.PersonalBestPath));

        var sessions = import.Sessions
            .OrderByDescending(session => session.StartedAt)
            .Select(ToDto)
            .ToList();

        var personalBests = import.PersonalBests
            .OrderBy(best => best.TimeMs)
            .Select(ToDto)
            .ToList();

        return new HistoryResponse(
            Summary: BuildSummary(sessions, personalBests),
            LatestSession: sessions.FirstOrDefault(),
            FastestSessionLap: sessions.Where(session => session.BestLapMs is > 0).MinBy(session => session.BestLapMs),
            FastestPersonalBest: personalBests.FirstOrDefault(),
            TopCars: BuildTopCars(sessions),
            TopTracks: BuildTopTracks(sessions),
            Sessions: sessions,
            PersonalBests: personalBests,
            Sources: sources);
    }

    private HistorySourceDto GetSources()
    {
        // Use custom paths if provided
        if (!string.IsNullOrEmpty(_customSessionsPath) || !string.IsNullOrEmpty(_customPersonalBestPath))
        {
            var sessionsPath = _customSessionsPath ?? Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                "AcTools Content Manager", "Progress", "Sessions");

            var personalBestPath = _customPersonalBestPath ?? Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.MyDocuments),
                "Assetto Corsa", "personalbest.ini");

            return new HistorySourceDto(
                ContentManagerSessionsPath: sessionsPath,
                ContentManagerSessionsFound: Directory.Exists(sessionsPath),
                PersonalBestPath: personalBestPath,
                PersonalBestFound: File.Exists(personalBestPath));
        }

        // Default paths
        var defaultSessionsPath = Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
            "AcTools Content Manager", "Progress", "Sessions");

        var defaultPersonalBestPath = Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.MyDocuments),
            "Assetto Corsa", "personalbest.ini");

        // Fall back to bundled sample data when CM is not installed
        if (!Directory.Exists(defaultSessionsPath))
        {
            var sampleBase = Path.Combine(AppContext.BaseDirectory, "sample-data");
            defaultSessionsPath     = Path.Combine(sampleBase, "Sessions");
            defaultPersonalBestPath = Path.Combine(sampleBase, "personalbest.ini");
        }

        return new HistorySourceDto(
            ContentManagerSessionsPath: defaultSessionsPath,
            ContentManagerSessionsFound: Directory.Exists(defaultSessionsPath),
            PersonalBestPath: defaultPersonalBestPath,
            PersonalBestFound: File.Exists(defaultPersonalBestPath));
    }

    private static List<ImportedSession> LoadSessions(string sessionsPath, string dataFilePath)
    {
        // Build a lookup of rich JSON sessions indexed by their filename-derived ID (yyMMdd-HHmmss).
        var jsonById = new Dictionary<string, ImportedSession>(StringComparer.OrdinalIgnoreCase);
        if (Directory.Exists(sessionsPath))
        {
            foreach (var file in Directory.EnumerateFiles(sessionsPath, "*.json"))
            {
                try
                {
                    var session = ParseJsonSession(file);
                    if (session != null)
                        jsonById[session.SourceId] = session;
                }
                catch { }
            }
        }

        // If the CM profile data file exists, use it as the canonical 109-session list.
        if (!File.Exists(dataFilePath))
            return jsonById.Values.ToList();

        var result = new List<ImportedSession>();
        var coveredIds = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

        foreach (var line in File.ReadLines(dataFilePath))
        {
            if (string.IsNullOrWhiteSpace(line)) continue;
            try
            {
                using var doc = JsonDocument.Parse(line);
                var root = doc.RootElement;

                var startedAt = DateTimeOffset.Parse(
                    root.GetProperty("StartedAt").GetString()!,
                    null, System.Globalization.DateTimeStyles.RoundtripKind);

                // Derive the same ID format CM uses for JSON filenames: yyMMdd-HHmmss
                var candidateId = startedAt.ToLocalTime().ToString("yyMMdd-HHmmss");
                coveredIds.Add(candidateId);

                if (jsonById.TryGetValue(candidateId, out var rich))
                {
                    // JSON file present: use the richer data
                    result.Add(rich);
                    continue;
                }

                // No JSON file — build from .data fields only
                var carId   = NormalizeId(root.TryGetProperty("CarId",   out var c) ? c.GetString() ?? EmptyValue : EmptyValue);
                var trackId = NormalizeId(root.TryGetProperty("TrackId", out var t) ? t.GetString() ?? EmptyValue : EmptyValue);
                var bestLapMs = ParseTimeSpanMs(root.TryGetProperty("BestLap", out var bl) ? bl.GetString() : null);
                double? distanceKm = null;
                if (root.TryGetProperty("Distance", out var dist) && dist.TryGetDouble(out var dm) && dm > 0)
                    distanceKm = Math.Round(dm / 1000.0, 2);

                // Optional extended fields present in sample/enriched data
                var laps = root.TryGetProperty("Laps", out var lp) && lp.TryGetInt32(out var lpN) ? lpN : 0;
                var sessionType = root.TryGetProperty("SessionType", out var stEl) && stEl.ValueKind == JsonValueKind.String
                    ? stEl.GetString() ?? EmptyValue : EmptyValue;
                var driverName = root.TryGetProperty("DriverName", out var dnEl) && dnEl.ValueKind == JsonValueKind.String
                    ? dnEl.GetString() ?? EmptyValue : EmptyValue;

                result.Add(new ImportedSession(
                    SourceId:     candidateId,
                    StartedAt:    startedAt,
                    DriverName:   driverName,
                    CarId:        carId,
                    TrackId:      trackId,
                    SessionTypes: sessionType,
                    Laps:         laps,
                    DistanceKm:   distanceKm,
                    BestLapMs:    bestLapMs,
                    LastLapMs:    null));
            }
            catch { }
        }

        // Include any JSON sessions that have no corresponding .data entry (edge case)
        foreach (var (id, s) in jsonById)
        {
            if (!coveredIds.Contains(id))
                result.Add(s);
        }

        return result;
    }

    public SessionLapsResponse GetSessionLaps(string sessionSourceId)
    {
        var sources = GetSources();
        var file = Path.Combine(sources.ContentManagerSessionsPath, $"{sessionSourceId}.json");
        if (!File.Exists(file))
            return new SessionLapsResponse(sessionSourceId, []);

        try
        {
            var laps = ParseJsonLaps(sessionSourceId, file);
            return new SessionLapsResponse(sessionSourceId, laps.Select(ToDto).ToList());
        }
        catch { return new SessionLapsResponse(sessionSourceId, []); }
    }

    private static List<ImportedLap> ParseJsonLaps(string sourceId, string file)
    {
        using var document = JsonDocument.Parse(File.ReadAllText(file));
        var root = document.RootElement;
        var result = new List<ImportedLap>();

        if (!root.TryGetProperty("sessions", out var sessionElements) ||
            sessionElements.ValueKind != JsonValueKind.Array)
        {
            return result;
        }

        var globalLapIndex = 0;
        foreach (var session in sessionElements.EnumerateArray())
        {
            if (!session.TryGetProperty("laps", out var laps) ||
                laps.ValueKind != JsonValueKind.Array)
            {
                continue;
            }

            foreach (var lap in laps.EnumerateArray())
            {
                if (GetInt(lap, "car") != 0) continue;

                var timeMs = GetInt(lap, "time");
                if (timeMs is not > 0) continue;

                int? s1 = null, s2 = null, s3 = null;
                if (lap.TryGetProperty("sectors", out var sectors) &&
                    sectors.ValueKind == JsonValueKind.Array &&
                    sectors.GetArrayLength() >= 3)
                {
                    s1 = sectors[0].TryGetInt32(out var v0) && v0 > 0 ? v0 : null;
                    s2 = sectors[1].TryGetInt32(out var v1) && v1 > 0 ? v1 : null;
                    s3 = sectors[2].TryGetInt32(out var v2) && v2 > 0 ? v2 : null;
                }

                var cuts = GetInt(lap, "cuts") ?? 0;
                var tyre = lap.TryGetProperty("tyre", out var tyreEl) && tyreEl.ValueKind == JsonValueKind.String
                    ? tyreEl.GetString()
                    : null;

                result.Add(new ImportedLap(
                    SessionSourceId: sourceId,
                    LapNumber: globalLapIndex,
                    TimeMs: timeMs.Value,
                    S1Ms: s1,
                    S2Ms: s2,
                    S3Ms: s3,
                    Cuts: cuts,
                    Tyre: tyre));

                globalLapIndex++;
            }
        }

        return result;
    }

    private static LapDto ToDto(ImportedLap lap) =>
        new(lap.SessionSourceId, lap.LapNumber, lap.TimeMs, lap.S1Ms, lap.S2Ms, lap.S3Ms, lap.Cuts, lap.Tyre);

    private static ImportedSession? ParseJsonSession(string file)
    {
        using var document = JsonDocument.Parse(File.ReadAllText(file));
        var root = document.RootElement;

        var track      = GetString(root, "track");
        var driverName = EmptyValue;
        var car        = EmptyValue;

        if (root.TryGetProperty("players", out var players) &&
            players.ValueKind == JsonValueKind.Array &&
            players.GetArrayLength() > 0)
        {
            var player = players[0];
            driverName = GetString(player, "name");
            car        = GetString(player, "car");
        }

        var sessionNames = new List<string>();
        var laps         = 0;
        var bestLapMs    = (int?)null;
        var lastLapMs    = (int?)null;

        if (root.TryGetProperty("sessions", out var sessionElements) &&
            sessionElements.ValueKind == JsonValueKind.Array)
        {
            foreach (var session in sessionElements.EnumerateArray())
            {
                var name = GetString(session, "name");
                if (name != EmptyValue) sessionNames.Add(name);
                laps      += GetPlayerLapTotal(session);
                bestLapMs  = MinNullable(bestLapMs, GetPlayerBestLap(session));
                lastLapMs  = GetPlayerLastLap(session) ?? lastLapMs;
            }
        }

        var raceIni    = GetString(root, "__raceIni");
        var distanceKm = GetDrivenDistanceKm(raceIni);

        return new ImportedSession(
            SourceId:     Path.GetFileNameWithoutExtension(file),
            StartedAt:    new DateTimeOffset(File.GetLastWriteTime(file)),
            DriverName:   driverName,
            CarId:        NormalizeId(car),
            TrackId:      NormalizeId(track),
            SessionTypes: sessionNames.Count > 0 ? string.Join(", ", sessionNames.Distinct()) : EmptyValue,
            Laps:         laps,
            DistanceKm:   distanceKm,
            BestLapMs:    bestLapMs,
            LastLapMs:    lastLapMs);
    }

    private static int? ParseTimeSpanMs(string? value)
    {
        if (string.IsNullOrEmpty(value)) return null;
        if (TimeSpan.TryParse(value, out var ts) && ts.TotalMilliseconds > 0)
            return (int)ts.TotalMilliseconds;
        return null;
    }

    private static List<PersonalBestRecord> LoadPersonalBests(string personalBestPath)
    {
        if (!File.Exists(personalBestPath))
        {
            return [];
        }

        var personalBests = new List<PersonalBestRecord>();
        var currentCombo = string.Empty;
        long? currentDate = null;
        int? currentTime = null;

        foreach (var line in File.ReadLines(personalBestPath))
        {
            if (line.StartsWith('[') && line.EndsWith(']'))
            {
                AddPersonalBest(personalBests, currentCombo, currentDate, currentTime);

                currentCombo = line.Trim('[', ']');
                currentDate = null;
                currentTime = null;
                continue;
            }

            var parts = line.Split('=', 2);
            if (parts.Length != 2)
            {
                continue;
            }

            if (parts[0].Equals("DATE", StringComparison.OrdinalIgnoreCase) &&
                long.TryParse(parts[1], NumberStyles.Integer, CultureInfo.InvariantCulture, out var date))
            {
                currentDate = date;
            }

            if (parts[0].Equals("TIME", StringComparison.OrdinalIgnoreCase) &&
                int.TryParse(parts[1], NumberStyles.Integer, CultureInfo.InvariantCulture, out var time))
            {
                currentTime = time;
            }
        }

        AddPersonalBest(personalBests, currentCombo, currentDate, currentTime);
        return personalBests;
    }

    private static void AddPersonalBest(
        List<PersonalBestRecord> personalBests,
        string combo,
        long? date,
        int? timeMs)
    {
        if (string.IsNullOrWhiteSpace(combo) || timeMs is not > 0)
        {
            return;
        }

        var separatorIndex = combo.IndexOf('@', StringComparison.Ordinal);
        var car = separatorIndex > 0 ? combo[..separatorIndex] : combo;
        var track = separatorIndex > 0 ? combo[(separatorIndex + 1)..] : EmptyValue;

        personalBests.Add(new PersonalBestRecord(
            CarId: NormalizeId(car),
            TrackId: NormalizeId(track),
            TimeMs: timeMs.Value,
            SourceDate: date));
    }

    private static ProfileSummaryDto BuildSummary(
        IReadOnlyList<SessionDto> sessions,
        IReadOnlyList<PersonalBestDto> personalBests)
    {
        return new ProfileSummaryDto(
            Sessions: sessions.Count,
            PersonalBests: personalBests.Count,
            Cars: sessions.Select(session => session.CarId).Where(IsKnownId).Distinct().Count(),
            Tracks: sessions.Select(session => session.TrackId).Where(IsKnownId).Distinct().Count(),
            Laps: sessions.Sum(session => session.Laps),
            DistanceKm: Math.Round(sessions.Sum(session => session.DistanceKm ?? 0), 2));
    }

    private static List<TopCarDto> BuildTopCars(IReadOnlyList<SessionDto> sessions)
    {
        return sessions
            .Where(session => IsKnownId(session.CarId))
            .GroupBy(session => session.CarId)
            .Select(group => new TopCarDto(
                CarId: group.Key,
                Sessions: group.Count(),
                Laps: group.Sum(session => session.Laps),
                DistanceKm: Math.Round(group.Sum(session => session.DistanceKm ?? 0), 2),
                BestLapMs: MinValidLap(group.Select(session => session.BestLapMs))))
            .OrderByDescending(car => car.DistanceKm)
            .ThenByDescending(car => car.Sessions)
            .Take(10)
            .ToList();
    }

    private static List<TopTrackDto> BuildTopTracks(IReadOnlyList<SessionDto> sessions)
    {
        return sessions
            .Where(session => IsKnownId(session.TrackId))
            .GroupBy(session => session.TrackId)
            .Select(group => new TopTrackDto(
                TrackId: group.Key,
                Sessions: group.Count(),
                Laps: group.Sum(session => session.Laps),
                DistanceKm: Math.Round(group.Sum(session => session.DistanceKm ?? 0), 2),
                BestLapMs: MinValidLap(group.Select(session => session.BestLapMs))))
            .OrderByDescending(track => track.Sessions)
            .ThenByDescending(track => track.DistanceKm)
            .Take(10)
            .ToList();
    }

    private static SessionDto ToDto(ImportedSession session)
    {
        return new SessionDto(
            Id: session.SourceId,
            StartedAt: session.StartedAt,
            DriverName: session.DriverName,
            CarId: session.CarId,
            TrackId: session.TrackId,
            SessionTypes: session.SessionTypes,
            Laps: session.Laps,
            DistanceKm: session.DistanceKm.HasValue ? Math.Round(session.DistanceKm.Value, 2) : null,
            BestLapMs: session.BestLapMs,
            LastLapMs: session.LastLapMs);
    }

    private static PersonalBestDto ToDto(PersonalBestRecord personalBest)
    {
        return new PersonalBestDto(
            CarId: personalBest.CarId,
            TrackId: personalBest.TrackId,
            TimeMs: personalBest.TimeMs,
            SourceDate: personalBest.SourceDate);
    }

    private static int GetPlayerLapTotal(JsonElement session)
    {
        if (!session.TryGetProperty("lapstotal", out var lapsTotal) ||
            lapsTotal.ValueKind != JsonValueKind.Array ||
            lapsTotal.GetArrayLength() == 0 ||
            !lapsTotal[0].TryGetInt32(out var laps))
        {
            return 0;
        }

        return laps;
    }

    private static int? GetPlayerBestLap(JsonElement session)
    {
        var bestLapMs = (int?)null;

        if (session.TryGetProperty("bestLaps", out var bestLaps) &&
            bestLaps.ValueKind == JsonValueKind.Array)
        {
            foreach (var bestLap in bestLaps.EnumerateArray())
            {
                if (GetInt(bestLap, "car") == 0)
                {
                    bestLapMs = MinNullable(bestLapMs, GetInt(bestLap, "time"));
                }
            }
        }

        if (bestLapMs.HasValue)
        {
            return bestLapMs;
        }

        if (session.TryGetProperty("laps", out var laps) &&
            laps.ValueKind == JsonValueKind.Array)
        {
            foreach (var lap in laps.EnumerateArray())
            {
                if (GetInt(lap, "car") == 0)
                {
                    bestLapMs = MinNullable(bestLapMs, GetInt(lap, "time"));
                }
            }
        }

        return bestLapMs;
    }

    private static int? GetPlayerLastLap(JsonElement session)
    {
        if (!session.TryGetProperty("laps", out var laps) ||
            laps.ValueKind != JsonValueKind.Array)
        {
            return null;
        }

        var lastLapMs = (int?)null;

        foreach (var lap in laps.EnumerateArray())
        {
            if (GetInt(lap, "car") == 0)
            {
                var time = GetInt(lap, "time");
                if (time is > 0)
                {
                    lastLapMs = time;
                }
            }
        }

        return lastLapMs;
    }

    private static double? GetDrivenDistanceKm(string raceIni)
    {
        if (raceIni == EmptyValue)
        {
            return null;
        }

        var match = Regex.Match(raceIni, @"__CM_DRIVEN_DISTANCE=([0-9.]+)");
        if (!match.Success ||
            !double.TryParse(match.Groups[1].Value, NumberStyles.Float, CultureInfo.InvariantCulture, out var meters))
        {
            return null;
        }

        return meters / 1000;
    }

    private static string GetString(JsonElement element, string propertyName)
    {
        return element.TryGetProperty(propertyName, out var value) && value.ValueKind == JsonValueKind.String
            ? value.GetString() ?? EmptyValue
            : EmptyValue;
    }

    private static int? GetInt(JsonElement element, string propertyName)
    {
        return element.TryGetProperty(propertyName, out var value) && value.TryGetInt32(out var number)
            ? number
            : null;
    }

    private static int? MinNullable(int? current, int? candidate)
    {
        if (candidate is not > 0)
        {
            return current;
        }

        return !current.HasValue || candidate.Value < current.Value ? candidate : current;
    }

    private static int? MinValidLap(IEnumerable<int?> lapTimes)
    {
        return lapTimes
            .Where(time => time is > 0)
            .Order()
            .FirstOrDefault();
    }

    private static bool IsKnownId(string value)
    {
        return !string.IsNullOrWhiteSpace(value) && value != EmptyValue;
    }

    private static string NormalizeId(string value)
    {
        return string.IsNullOrWhiteSpace(value)
            ? EmptyValue
            : value.Trim().ToLowerInvariant().Replace('/', '-');
    }
}
