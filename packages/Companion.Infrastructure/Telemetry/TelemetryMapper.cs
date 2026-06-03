using Companion.Domain.Telemetry;
using Companion.SharedContracts.Telemetry;

namespace Companion.Infrastructure.Telemetry;

public static class TelemetryMapper
{
    public static TelemetryDataDto ToDto(CompletedLapTelemetry lap)
    {
        var points = lap.Frames
            .Select(f => new[]
            {
                (int)(f.X * 10),
                (int)(f.Z * 10),
                (int)f.SpeedKmh,
                (int)(f.Throttle * 100),
                (int)(f.Brake * 100),
            })
            .ToArray();

        return new TelemetryDataDto
        {
            Points = points,
            SectorBoundaries = lap.SectorBoundaries.ToArray(),
            MaxSpeed = (int)lap.MaxSpeed,
            DurationMs = lap.DurationMs,
        };
    }
}
