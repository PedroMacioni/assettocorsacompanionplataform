using System.Globalization;
using System.Text.Json;
using System.Text.RegularExpressions;

internal static class HistoryConsole
{
    public static void Print()
    {
        var sessionsPath = Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
            "AcTools Content Manager",
            "Progress",
            "Sessions");

        var personalBestPath = Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.MyDocuments),
            "Assetto Corsa",
            "personalbest.ini");

        var sessions = LoadSessions(sessionsPath)
            .OrderByDescending(session => session.Date)
            .ToList();

        var personalBests = LoadPersonalBests(personalBestPath)
            .OrderBy(best => best.Track)
            .ThenBy(best => best.Car)
            .ToList();

        Console.WriteLine("=== HISTORICO ASSETTO CORSA ===\n");
        Console.WriteLine($"Content Manager: {sessionsPath}");
        Console.WriteLine($"Personal bests : {personalBestPath}");
        Console.WriteLine();

        if (sessions.Count == 0 && personalBests.Count == 0)
        {
            Console.WriteLine("Nenhum historico encontrado nos caminhos padrao.");
            return;
        }

        PrintSummary(sessions, personalBests);
        PrintTopCars(sessions);
        PrintTopTracks(sessions);
        PrintAllSessions(sessions);
        PrintPersonalBests(personalBests);
    }

    private static List<SessionHistoryItem> LoadSessions(string sessionsPath)
    {
        if (!Directory.Exists(sessionsPath))
        {
            return [];
        }

        var sessions = new List<SessionHistoryItem>();

        foreach (var file in Directory.EnumerateFiles(sessionsPath, "*.json"))
        {
            try
            {
                using var document = JsonDocument.Parse(File.ReadAllText(file));
                var root = document.RootElement;

                var track = GetString(root, "track");
                var playerName = "--";
                var car = "--";

                if (root.TryGetProperty("players", out var players) &&
                    players.ValueKind == JsonValueKind.Array &&
                    players.GetArrayLength() > 0)
                {
                    var player = players[0];
                    playerName = GetString(player, "name");
                    car = GetString(player, "car");
                }

                var sessionNames = new List<string>();
                var laps = 0;
                var bestLapMs = (int?)null;
                var lastLapMs = (int?)null;

                if (root.TryGetProperty("sessions", out var sessionElements) &&
                    sessionElements.ValueKind == JsonValueKind.Array)
                {
                    foreach (var session in sessionElements.EnumerateArray())
                    {
                        var name = GetString(session, "name");
                        if (name != "--")
                        {
                            sessionNames.Add(name);
                        }

                        laps += GetPlayerLapTotal(session);
                        bestLapMs = MinNullable(bestLapMs, GetPlayerBestLap(session));
                        lastLapMs = GetPlayerLastLap(session) ?? lastLapMs;
                    }
                }

                var raceIni = GetString(root, "__raceIni");
                var distanceKm = GetDrivenDistanceKm(raceIni);

                sessions.Add(new SessionHistoryItem(
                    FileName: Path.GetFileName(file),
                    Date: File.GetLastWriteTime(file),
                    PlayerName: playerName,
                    Car: car,
                    Track: track,
                    SessionNames: sessionNames.Count > 0 ? string.Join(", ", sessionNames.Distinct()) : "--",
                    Laps: laps,
                    DistanceKm: distanceKm,
                    BestLapMs: bestLapMs,
                    LastLapMs: lastLapMs));
            }
            catch (Exception ex)
            {
                sessions.Add(new SessionHistoryItem(
                    FileName: Path.GetFileName(file),
                    Date: File.GetLastWriteTime(file),
                    PlayerName: "--",
                    Car: "ERRO AO LER",
                    Track: ex.Message,
                    SessionNames: "--",
                    Laps: 0,
                    DistanceKm: null,
                    BestLapMs: null,
                    LastLapMs: null));
            }
        }

        return sessions;
    }

    private static List<PersonalBestItem> LoadPersonalBests(string personalBestPath)
    {
        if (!File.Exists(personalBestPath))
        {
            return [];
        }

        var personalBests = new List<PersonalBestItem>();
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
        List<PersonalBestItem> personalBests,
        string combo,
        long? date,
        int? timeMs)
    {
        if (string.IsNullOrWhiteSpace(combo) || !timeMs.HasValue)
        {
            return;
        }

        var separatorIndex = combo.IndexOf('@', StringComparison.Ordinal);
        var car = separatorIndex > 0 ? combo[..separatorIndex] : combo;
        var track = separatorIndex > 0 ? combo[(separatorIndex + 1)..] : "--";

        personalBests.Add(new PersonalBestItem(
            Car: car.ToLowerInvariant(),
            Track: track.ToLowerInvariant(),
            TimeMs: timeMs.Value,
            RawDate: date));
    }

    private static void PrintSummary(
        IReadOnlyList<SessionHistoryItem> sessions,
        IReadOnlyList<PersonalBestItem> personalBests)
    {
        var totalDistance = sessions.Sum(session => session.DistanceKm ?? 0);
        var totalLaps = sessions.Sum(session => session.Laps);
        var uniqueCars = sessions.Select(session => session.Car).Where(value => value != "--").Distinct().Count();
        var uniqueTracks = sessions.Select(session => session.Track).Where(value => value != "--").Distinct().Count();
        var latestSession = sessions.MaxBy(session => session.Date);
        var fastestSessionLap = sessions.Where(session => session.BestLapMs is > 0).MinBy(session => session.BestLapMs);
        var fastestPersonalBest = personalBests.MinBy(best => best.TimeMs);

        Console.WriteLine("Resumo");
        Console.WriteLine($"Sessoes encontradas       : {sessions.Count}");
        Console.WriteLine($"Melhores tempos encontrados: {personalBests.Count}");
        Console.WriteLine($"Carros diferentes         : {uniqueCars}");
        Console.WriteLine($"Pistas diferentes         : {uniqueTracks}");
        Console.WriteLine($"Voltas registradas        : {totalLaps}");
        Console.WriteLine($"Distancia total           : {totalDistance:0.00} km");
        Console.WriteLine();

        if (latestSession is not null)
        {
            Console.WriteLine("Ultima sessao");
            Console.WriteLine($"{latestSession.Date:g} | {latestSession.Car} | {latestSession.Track} | melhor {FormatLapTime(latestSession.BestLapMs)}");
            Console.WriteLine();
        }

        if (fastestSessionLap is not null)
        {
            Console.WriteLine("Melhor volta em sessoes do Content Manager");
            Console.WriteLine($"{FormatLapTime(fastestSessionLap.BestLapMs)} | {fastestSessionLap.Car} | {fastestSessionLap.Track}");
            Console.WriteLine();
        }

        if (fastestPersonalBest is not null)
        {
            Console.WriteLine("Melhor volta no personalbest.ini");
            Console.WriteLine($"{FormatLapTime(fastestPersonalBest.TimeMs)} | {fastestPersonalBest.Car} | {fastestPersonalBest.Track}");
            Console.WriteLine();
        }
    }

    private static void PrintTopCars(IReadOnlyList<SessionHistoryItem> sessions)
    {
        var cars = sessions
            .Where(session => session.Car != "--")
            .GroupBy(session => session.Car)
            .Select(group => new
            {
                Car = group.Key,
                Sessions = group.Count(),
                Laps = group.Sum(session => session.Laps),
                DistanceKm = group.Sum(session => session.DistanceKm ?? 0),
                BestLapMs = group.Where(session => session.BestLapMs is > 0).Min(session => session.BestLapMs)
            })
            .OrderByDescending(car => car.DistanceKm)
            .ThenByDescending(car => car.Sessions)
            .Take(10)
            .ToList();

        if (cars.Count == 0)
        {
            return;
        }

        Console.WriteLine("Top carros por quilometragem");
        foreach (var car in cars)
        {
            Console.WriteLine($"{car.DistanceKm,9:0.00} km | {car.Sessions,3} sessoes | {car.Laps,4} voltas | melhor {FormatLapTime(car.BestLapMs),12} | {car.Car}");
        }

        Console.WriteLine();
    }

    private static void PrintTopTracks(IReadOnlyList<SessionHistoryItem> sessions)
    {
        var tracks = sessions
            .Where(session => session.Track != "--")
            .GroupBy(session => session.Track)
            .Select(group => new
            {
                Track = group.Key,
                Sessions = group.Count(),
                Laps = group.Sum(session => session.Laps),
                DistanceKm = group.Sum(session => session.DistanceKm ?? 0),
                BestLapMs = group.Where(session => session.BestLapMs is > 0).Min(session => session.BestLapMs)
            })
            .OrderByDescending(track => track.Sessions)
            .ThenByDescending(track => track.DistanceKm)
            .Take(10)
            .ToList();

        if (tracks.Count == 0)
        {
            return;
        }

        Console.WriteLine("Top pistas por sessoes");
        foreach (var track in tracks)
        {
            Console.WriteLine($"{track.Sessions,3} sessoes | {track.DistanceKm,9:0.00} km | {track.Laps,4} voltas | melhor {FormatLapTime(track.BestLapMs),12} | {track.Track}");
        }

        Console.WriteLine();
    }

    private static void PrintAllSessions(IReadOnlyList<SessionHistoryItem> sessions)
    {
        if (sessions.Count == 0)
        {
            return;
        }

        Console.WriteLine("Sessoes importaveis");
        foreach (var session in sessions)
        {
            Console.WriteLine(
                $"{session.Date:yyyy-MM-dd HH:mm} | " +
                $"{session.DistanceKm ?? 0,8:0.00} km | " +
                $"{session.Laps,3} voltas | " +
                $"melhor {FormatLapTime(session.BestLapMs),12} | " +
                $"{session.Car} | {session.Track}");
        }

        Console.WriteLine();
    }

    private static void PrintPersonalBests(IReadOnlyList<PersonalBestItem> personalBests)
    {
        if (personalBests.Count == 0)
        {
            return;
        }

        Console.WriteLine("Personal bests");
        foreach (var best in personalBests.OrderBy(best => best.TimeMs))
        {
            Console.WriteLine($"{FormatLapTime(best.TimeMs),12} | {best.Car} | {best.Track}");
        }
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
                lastLapMs = GetInt(lap, "time") ?? lastLapMs;
            }
        }

        return lastLapMs;
    }

    private static double? GetDrivenDistanceKm(string raceIni)
    {
        if (raceIni == "--")
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
            ? value.GetString() ?? "--"
            : "--";
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

    private static string FormatLapTime(int? milliseconds)
    {
        return milliseconds is > 0
            ? TimeSpan.FromMilliseconds(milliseconds.Value).ToString(@"m\:ss\.fff")
            : "--";
    }
}

internal sealed record SessionHistoryItem(
    string FileName,
    DateTime Date,
    string PlayerName,
    string Car,
    string Track,
    string SessionNames,
    int Laps,
    double? DistanceKm,
    int? BestLapMs,
    int? LastLapMs);

internal sealed record PersonalBestItem(
    string Car,
    string Track,
    int TimeMs,
    long? RawDate);
