using System.Text.Json.Serialization;

namespace Companion.SharedContracts.Telemetry;

public class LapTelemetryDto
{
    [JsonPropertyName("user_id")]
    public required string UserId { get; init; }

    [JsonPropertyName("session_source_id")]
    public required string SessionSourceId { get; init; }

    [JsonPropertyName("lap_number")]
    public int LapNumber { get; init; }

    [JsonPropertyName("data")]
    public required TelemetryDataDto Data { get; init; }

    [JsonPropertyName("sample_hz")]
    public int SampleHz { get; init; } = 20;
}

public class TelemetryDataDto
{
    // [[x×10, z×10, speed, throttle_pct, brake_pct], ...]
    [JsonPropertyName("p")]
    public required int[][] Points { get; init; }

    [JsonPropertyName("s")]
    public required float[] SectorBoundaries { get; init; }

    [JsonPropertyName("mv")]
    public int MaxSpeed { get; init; }

    [JsonPropertyName("dur")]
    public int DurationMs { get; init; }
}
