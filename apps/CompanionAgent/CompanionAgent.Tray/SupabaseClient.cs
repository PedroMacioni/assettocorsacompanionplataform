namespace CompanionAgent.Tray;

using Companion.SharedContracts.History;
using Companion.SharedContracts.Tracks;
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

    public event Action<string, string>? TokensRefreshed;

    public bool IsConfigured => !string.IsNullOrEmpty(_accessToken);
    public string UserId { get; private set; } = "";

    public SupabaseClient(string url, string anonKey)
    {
        _url = url.TrimEnd('/');
        _anonKey = anonKey;
    }

    public void ClearTokens()
    {
        _accessToken  = "";
        _refreshToken = "";
        UserId        = "";
        UserEmail     = "";
        _tokenExpiry  = DateTimeOffset.MinValue;
    }

    public void SetTokens(string accessToken, string refreshToken)
    {
        _accessToken = accessToken;
        _refreshToken = refreshToken;
        (UserId, UserEmail, _tokenExpiry) = ParseJwt(accessToken);
    }

    public string UserEmail { get; private set; } = "";

    public async Task<(string AccessToken, string RefreshToken)?> SignInAsync(string email, string password)
    {
        var body = JsonSerializer.Serialize(new { email, password });
        var req = new HttpRequestMessage(HttpMethod.Post, $"{_url}/auth/v1/token?grant_type=password");
        req.Headers.Add("apikey", _anonKey);
        req.Content = new StringContent(body, Encoding.UTF8, "application/json");
        var res = await _http.SendAsync(req);
        if (!res.IsSuccessStatusCode) return null;
        using var doc = JsonDocument.Parse(await res.Content.ReadAsStringAsync());
        var at = doc.RootElement.GetProperty("access_token").GetString()!;
        var rt = doc.RootElement.GetProperty("refresh_token").GetString()!;
        SetTokens(at, rt);
        return (at, rt);
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
        if (!res.IsSuccessStatusCode)
        {
            var errorBody = await res.Content.ReadAsStringAsync();
            throw new HttpRequestException($"refresh_token {(int)res.StatusCode}: {errorBody}", null, res.StatusCode);
        }

        using var doc = JsonDocument.Parse(await res.Content.ReadAsStringAsync());
        var at = doc.RootElement.GetProperty("access_token").GetString()!;
        var rt = doc.RootElement.GetProperty("refresh_token").GetString()!;
        SetTokens(at, rt);
        TokensRefreshed?.Invoke(at, rt);
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

        var req = BuildRequest(HttpMethod.Post, "/rest/v1/personal_bests?on_conflict=user_id,car_id,track_id");
        req.Headers.Add("Prefer", "resolution=merge-duplicates");
        req.Content = new StringContent(JsonSerializer.Serialize(payload), Encoding.UTF8, "application/json");
        var res = await _http.SendAsync(req);
        if (!res.IsSuccessStatusCode)
        {
            var body = await res.Content.ReadAsStringAsync();
            throw new HttpRequestException($"personal_bests {(int)res.StatusCode}: {body}", null, res.StatusCode);
        }
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
        var res = await _http.SendAsync(req);
        if (!res.IsSuccessStatusCode)
        {
            var body = await res.Content.ReadAsStringAsync();
            throw new HttpRequestException($"agent_status {(int)res.StatusCode}: {body}", null, res.StatusCode);
        }
    }

    public async Task UpsertTracksAsync(
        IReadOnlyList<TrackDto> tracks,
        IReadOnlyDictionary<string, string> outlineUrls,
        Action<int, int>? onBatchProgress = null)
    {
        await EnsureValidTokenAsync();
        const int batchSize = 1;

        for (int i = 0; i < tracks.Count; i += batchSize)
        {
            var batch = tracks.Skip(i).Take(batchSize).Select(t =>
            {
                var obj = new Dictionary<string, object?>
                {
                    ["track_id"] = t.TrackId,
                    ["name"] = t.Name,
                    ["country"] = t.Country,
                    ["city"] = t.City,
                    ["length_km"] = t.LengthKm,
                    ["pitboxes"] = t.Pitboxes,
                    ["run"] = t.Run,
                    ["tags"] = t.Tags,
                    ["description"] = t.Description
                };
                if (outlineUrls.TryGetValue(t.TrackId, out var url))
                    obj["outline_url"] = url;
                return obj;
            }).ToList();

            var req = BuildRequest(HttpMethod.Post, "/rest/v1/tracks?on_conflict=track_id");
            req.Headers.Add("Prefer", "resolution=merge-duplicates,return=minimal");
            req.Content = new StringContent(JsonSerializer.Serialize(batch), Encoding.UTF8, "application/json");

            using var cts = new CancellationTokenSource(TimeSpan.FromSeconds(30));
            var res = await _http.SendAsync(req, cts.Token);
            if (!res.IsSuccessStatusCode)
            {
                var body = await res.Content.ReadAsStringAsync(cts.Token);
                throw new HttpRequestException($"tracks {(int)res.StatusCode}: {body}", null, res.StatusCode);
            }

            onBatchProgress?.Invoke(Math.Min(i + batchSize, tracks.Count), tracks.Count);
        }
    }

    public async Task<bool> UploadCarBadgeAsync(string carId, byte[] imageBytes)
    {
        await EnsureValidTokenAsync();
        var storagePath = $"{UserId}/{carId}.png";
        var req = BuildRequest(HttpMethod.Post, $"/storage/v1/object/car-previews/{storagePath}");
        req.Headers.Add("x-upsert", "true");
        req.Content = new ByteArrayContent(imageBytes);
        req.Content.Headers.ContentType = new MediaTypeHeaderValue("image/png");
        var res = await _http.SendAsync(req);
        return res.IsSuccessStatusCode;
    }

    public async Task<string?> UploadTrackOutlineAsync(string trackId, byte[] imageBytes)
    {
        await EnsureValidTokenAsync();
        var storagePath = $"{trackId}/map.png";
        var req = BuildRequest(HttpMethod.Post, $"/storage/v1/object/track-outlines/{storagePath}");
        req.Headers.Add("x-upsert", "true");
        req.Content = new ByteArrayContent(imageBytes);
        req.Content.Headers.ContentType = new MediaTypeHeaderValue("image/png");
        var res = await _http.SendAsync(req);
        if (!res.IsSuccessStatusCode) return null;
        return $"{_url}/storage/v1/object/public/track-outlines/{storagePath}";
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
        {
            try { await RefreshTokenAsync(); }
            catch (HttpRequestException ex) when (ex.StatusCode == System.Net.HttpStatusCode.BadRequest)
            {
                ClearTokens();
                throw new HttpRequestException("Sessão expirada — faça login novamente nas configurações", ex, System.Net.HttpStatusCode.Unauthorized);
            }
        }
    }

    private HttpRequestMessage BuildRequest(HttpMethod method, string path)
    {
        var req = new HttpRequestMessage(method, _url + path);
        req.Headers.Authorization = new AuthenticationHeaderValue("Bearer", _accessToken);
        req.Headers.Add("apikey", _anonKey);
        return req;
    }

    private static (string userId, string email, DateTimeOffset expiry) ParseJwt(string jwt)
    {
        try
        {
            var parts = jwt.Split('.');
            if (parts.Length < 2) return ("", "", DateTimeOffset.MinValue);
            var payload = parts[1].PadRight(parts[1].Length + (4 - parts[1].Length % 4) % 4, '=');
            using var doc = JsonDocument.Parse(Encoding.UTF8.GetString(Convert.FromBase64String(payload)));
            var root  = doc.RootElement;
            var sub   = root.TryGetProperty("sub",   out var s) ? s.GetString() ?? "" : "";
            var email = root.TryGetProperty("email", out var em) ? em.GetString() ?? "" : "";
            var exp   = root.TryGetProperty("exp",   out var e)  ? e.GetInt64()       : 0;
            return (sub, email, DateTimeOffset.FromUnixTimeSeconds(exp));
        }
        catch { return ("", "", DateTimeOffset.MinValue); }
    }

    public void Dispose() => _http.Dispose();
}
