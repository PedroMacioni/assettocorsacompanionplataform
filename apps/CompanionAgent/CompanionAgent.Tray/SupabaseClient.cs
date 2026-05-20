namespace CompanionAgent.Tray;

using Companion.SharedContracts.History;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;

public sealed class SupabaseClient : IDisposable
{
    private readonly string _url;
    private readonly string _anonKey;
    private readonly HttpClient _http = new() { Timeout = TimeSpan.FromSeconds(30) };

    private string _accessToken = "";
    private string _refreshToken = "";
    private DateTimeOffset _tokenExpiry;

    public bool IsConfigured => !string.IsNullOrEmpty(_accessToken);
    public string UserId { get; private set; } = "";

    public SupabaseClient(string url, string anonKey)
    {
        _url = url.TrimEnd('/');
        _anonKey = anonKey;
    }

    public void SetTokens(string accessToken, string refreshToken)
    {
        _accessToken = accessToken;
        _refreshToken = refreshToken;
        (UserId, _tokenExpiry) = ParseJwt(accessToken);
    }

    public async Task<bool> ValidateTokenAsync(string accessToken)
    {
        try
        {
            var req = new HttpRequestMessage(HttpMethod.Get, $"{_url}/auth/v1/user");
            req.Headers.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);
            req.Headers.Add("apikey", _anonKey);
            var res = await _http.SendAsync(req);
            return res.IsSuccessStatusCode;
        }
        catch { return false; }
    }

    public async Task RefreshTokenAsync()
    {
        var body = JsonSerializer.Serialize(new { refresh_token = _refreshToken });
        var req = new HttpRequestMessage(HttpMethod.Post, $"{_url}/auth/v1/token?grant_type=refresh_token");
        req.Headers.Add("apikey", _anonKey);
        req.Content = new StringContent(body, Encoding.UTF8, "application/json");
        var res = await _http.SendAsync(req);
        res.EnsureSuccessStatusCode();

        using var doc = JsonDocument.Parse(await res.Content.ReadAsStringAsync());
        var at = doc.RootElement.GetProperty("access_token").GetString()!;
        var rt = doc.RootElement.GetProperty("refresh_token").GetString()!;
        SetTokens(at, rt);
    }

    public async Task UpsertSessionsAsync(IReadOnlyList<SessionDto> sessions)
    {
        await EnsureValidTokenAsync();
        const int batchSize = 100;
        for (int i = 0; i < sessions.Count; i += batchSize)
        {
            var batch = sessions.Skip(i).Take(batchSize).Select(s => new
            {
                user_id = UserId,
                source_id = s.Id,
                started_at = s.StartedAt,
                driver_name = s.DriverName,
                car_id = s.CarId,
                track_id = s.TrackId,
                session_types = s.SessionTypes,
                laps = s.Laps,
                distance_km = s.DistanceKm,
                best_lap_ms = s.BestLapMs,
                last_lap_ms = s.LastLapMs
            });

            var req = BuildRequest(HttpMethod.Post, "/rest/v1/sessions");
            req.Headers.Add("Prefer", "resolution=merge-duplicates");
            req.Content = new StringContent(JsonSerializer.Serialize(batch), Encoding.UTF8, "application/json");
            (await _http.SendAsync(req)).EnsureSuccessStatusCode();
        }
    }

    public async Task UpsertPersonalBestsAsync(IReadOnlyList<PersonalBestDto> bests)
    {
        await EnsureValidTokenAsync();
        var payload = bests.Select(b => new
        {
            user_id = UserId,
            car_id = b.CarId,
            track_id = b.TrackId,
            time_ms = b.TimeMs,
            source_date = b.SourceDate
        });

        var req = BuildRequest(HttpMethod.Post, "/rest/v1/personal_bests");
        req.Headers.Add("Prefer", "resolution=merge-duplicates");
        req.Content = new StringContent(JsonSerializer.Serialize(payload), Encoding.UTF8, "application/json");
        (await _http.SendAsync(req)).EnsureSuccessStatusCode();
    }

    public async Task UpdateAgentStatusAsync(int sessionsSynced)
    {
        await EnsureValidTokenAsync();
        var payload = new[]
        {
            new
            {
                user_id = UserId,
                last_synced_at = DateTimeOffset.UtcNow,
                last_sync_sessions_count = sessionsSynced
            }
        };
        var req = BuildRequest(HttpMethod.Post, "/rest/v1/agent_status");
        req.Headers.Add("Prefer", "resolution=merge-duplicates");
        req.Content = new StringContent(JsonSerializer.Serialize(payload), Encoding.UTF8, "application/json");
        (await _http.SendAsync(req)).EnsureSuccessStatusCode();
    }

    public async Task<DateTimeOffset?> GetSyncRequestedAtAsync()
    {
        await EnsureValidTokenAsync();
        var req = BuildRequest(HttpMethod.Get, $"/rest/v1/agent_status?user_id=eq.{UserId}&select=sync_requested_at");
        var res = await _http.SendAsync(req);
        if (!res.IsSuccessStatusCode) return null;
        using var doc = JsonDocument.Parse(await res.Content.ReadAsStringAsync());
        var arr = doc.RootElement;
        if (arr.GetArrayLength() == 0) return null;
        if (arr[0].TryGetProperty("sync_requested_at", out var val) && val.ValueKind != JsonValueKind.Null)
            return DateTimeOffset.Parse(val.GetString()!);
        return null;
    }

    private async Task EnsureValidTokenAsync()
    {
        if (_tokenExpiry - DateTimeOffset.UtcNow < TimeSpan.FromMinutes(5) && !string.IsNullOrEmpty(_refreshToken))
            await RefreshTokenAsync();
    }

    private HttpRequestMessage BuildRequest(HttpMethod method, string path)
    {
        var req = new HttpRequestMessage(method, _url + path);
        req.Headers.Authorization = new AuthenticationHeaderValue("Bearer", _accessToken);
        req.Headers.Add("apikey", _anonKey);
        return req;
    }

    private static (string userId, DateTimeOffset expiry) ParseJwt(string jwt)
    {
        try
        {
            var parts = jwt.Split('.');
            if (parts.Length < 2) return ("", DateTimeOffset.MinValue);
            var payload = parts[1].PadRight(parts[1].Length + (4 - parts[1].Length % 4) % 4, '=');
            using var doc = JsonDocument.Parse(Encoding.UTF8.GetString(Convert.FromBase64String(payload)));
            var sub = doc.RootElement.TryGetProperty("sub", out var s) ? s.GetString() ?? "" : "";
            var exp = doc.RootElement.TryGetProperty("exp", out var e) ? e.GetInt64() : 0;
            return (sub, DateTimeOffset.FromUnixTimeSeconds(exp));
        }
        catch { return ("", DateTimeOffset.MinValue); }
    }

    public void Dispose() => _http.Dispose();
}
