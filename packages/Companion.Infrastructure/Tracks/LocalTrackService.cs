using System.Text.Json;
using Companion.SharedContracts.Tracks;

namespace Companion.Infrastructure.Tracks;

public sealed class LocalTrackService : ILocalTrackService
{
    private readonly Lazy<(List<TrackDto> Tracks, Dictionary<string, string> OutlinePaths)> _data =
        new(Load, LazyThreadSafetyMode.ExecutionAndPublication);

    public IReadOnlyList<TrackDto> GetTracks() => _data.Value.Tracks;

    public byte[]? GetOutlineBytes(string trackId)
    {
        if (_data.Value.OutlinePaths.TryGetValue(trackId, out var path) && File.Exists(path))
            return File.ReadAllBytes(path);
        return null;
    }

    private static (List<TrackDto>, Dictionary<string, string>) Load()
    {
        var tracks = new List<TrackDto>();
        var outlinePaths = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);

        var basePath = FindAcTracksPath();
        if (basePath == null) return (tracks, outlinePaths);

        foreach (var trackDir in Directory.EnumerateDirectories(basePath))
        {
            var trackFolderName = Path.GetFileName(trackDir).ToLowerInvariant();

            // Format A: single-layout track — ui/ui_track.json at root
            var baseUiJson = Path.Combine(trackDir, "ui", "ui_track.json");
            if (File.Exists(baseUiJson))
            {
                var outlinePath = Path.Combine(trackDir, "map.png");
                var dto = ParseTrackJson(trackFolderName, baseUiJson, File.Exists(outlinePath));
                if (dto != null)
                {
                    if (File.Exists(outlinePath)) outlinePaths[trackFolderName] = outlinePath;
                    tracks.Add(dto);
                }
            }

            var ignoredDirs = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
                { "ui", "data", "sfx", "animations", "sounds", "texture", "preview", "skins", "extension", "lights" };

            // Format B: Kunos-style multi-layout — ui/{layout}/ui_track.json
            var uiDir = Path.Combine(trackDir, "ui");
            if (Directory.Exists(uiDir))
            {
                foreach (var layoutUiDir in Directory.EnumerateDirectories(uiDir))
                {
                    var layoutName = Path.GetFileName(layoutUiDir).ToLowerInvariant();
                    var layoutUiJson = Path.Combine(layoutUiDir, "ui_track.json");
                    if (!File.Exists(layoutUiJson)) continue;

                    var layoutTrackId = $"{trackFolderName}/{layoutName}";
                    var layoutDataDir = Path.Combine(trackDir, layoutName);
                    var outlinePath = File.Exists(Path.Combine(layoutDataDir, "map.png"))
                        ? Path.Combine(layoutDataDir, "map.png")
                        : File.Exists(Path.Combine(trackDir, "map.png"))
                            ? Path.Combine(trackDir, "map.png")
                            : null;

                    var dto = ParseTrackJson(layoutTrackId, layoutUiJson, outlinePath != null);
                    if (dto != null)
                    {
                        if (outlinePath != null) outlinePaths[layoutTrackId] = outlinePath;
                        tracks.Add(dto);
                    }
                }
            }

            // Format C: MOD-style multi-layout — {layout}/ui/ui_track.json
            foreach (var layoutDir in Directory.EnumerateDirectories(trackDir))
            {
                var layoutName = Path.GetFileName(layoutDir).ToLowerInvariant();
                if (ignoredDirs.Contains(layoutName)) continue;

                var layoutUiJson = Path.Combine(layoutDir, "ui", "ui_track.json");
                if (!File.Exists(layoutUiJson)) continue;

                var layoutTrackId = $"{trackFolderName}/{layoutName}";
                var outlinePath = File.Exists(Path.Combine(layoutDir, "map.png"))
                    ? Path.Combine(layoutDir, "map.png")
                    : File.Exists(Path.Combine(trackDir, "map.png"))
                        ? Path.Combine(trackDir, "map.png")
                        : null;

                var dto = ParseTrackJson(layoutTrackId, layoutUiJson, outlinePath != null);
                if (dto != null)
                {
                    if (outlinePath != null) outlinePaths[layoutTrackId] = outlinePath;
                    tracks.Add(dto);
                }
            }
        }

        return (tracks.OrderBy(t => t.Name).ToList(), outlinePaths);
    }

    private static TrackDto? ParseTrackJson(string trackId, string jsonPath, bool hasOutline)
    {
        try
        {
            using var doc = JsonDocument.Parse(File.ReadAllText(jsonPath));
            var root = doc.RootElement;

            var name = GetString(root, "name");
            if (string.IsNullOrWhiteSpace(name)) return null;

            double? lengthKm = null;
            if (root.TryGetProperty("length", out var lengthEl))
            {
                if (lengthEl.ValueKind == JsonValueKind.Number && lengthEl.TryGetDouble(out var lmD) && lmD > 0)
                    lengthKm = Math.Round(lmD / 1000.0, 3);
                else if (lengthEl.ValueKind == JsonValueKind.String)
                {
                    var s = lengthEl.GetString()?.Trim();
                    if (double.TryParse(s, System.Globalization.NumberStyles.Any,
                            System.Globalization.CultureInfo.InvariantCulture, out var lmS) && lmS > 0)
                        lengthKm = Math.Round(lmS / 1000.0, 3);
                }
            }

            int? pitboxes = null;
            if (root.TryGetProperty("pitboxes", out var pbEl))
            {
                if (pbEl.ValueKind == JsonValueKind.Number && pbEl.TryGetInt32(out var pbN) && pbN > 0)
                    pitboxes = pbN;
                else if (pbEl.ValueKind == JsonValueKind.String &&
                         int.TryParse(pbEl.GetString()?.Trim(), out var pbS) && pbS > 0)
                    pitboxes = pbS;
            }

            var tags = Array.Empty<string>();
            if (root.TryGetProperty("tags", out var tagsEl) && tagsEl.ValueKind == JsonValueKind.Array)
                tags = tagsEl.EnumerateArray()
                    .Where(t => t.ValueKind == JsonValueKind.String)
                    .Select(t => t.GetString()!)
                    .Where(t => !string.IsNullOrWhiteSpace(t))
                    .ToArray();

            return new TrackDto(
                TrackId: trackId,
                Name: name.Trim(),
                Country: NullIfEmpty(GetString(root, "country")),
                City: NullIfEmpty(GetString(root, "city")),
                LengthKm: lengthKm,
                Pitboxes: pitboxes,
                Run: NullIfEmpty(GetString(root, "run")),
                Tags: tags,
                Description: NullIfEmpty(GetString(root, "description")),
                HasOutline: hasOutline);
        }
        catch
        {
            return null;
        }
    }

    private static string? FindAcTracksPath()
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

        var path = Path.Combine(steamPath, "steamapps", "common", "assettocorsa", "content", "tracks");
        return Directory.Exists(path) ? path : null;
    }

    private static string? GetString(JsonElement el, string key) =>
        el.TryGetProperty(key, out var val) && val.ValueKind == JsonValueKind.String
            ? val.GetString()
            : null;

    private static string? NullIfEmpty(string? s) =>
        string.IsNullOrWhiteSpace(s) ? null : s.Trim();
}
