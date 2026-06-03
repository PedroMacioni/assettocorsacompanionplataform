namespace Companion.Domain.Telemetry;

public record TelemetryFrame(
    float X,
    float Z,
    float SpeedKmh,
    float Throttle,       // 0-1
    float Brake,          // 0-1
    float NormPos,        // normalizedCarPosition 0-1
    int   LapTimeMs
);

public class LapBuffer
{
    private readonly List<TelemetryFrame> _frames = new();
    private float? _sectorBoundary1;
    private float? _sectorBoundary2;

    public int FrameCount => _frames.Count;

    public void AddFrame(TelemetryFrame frame) => _frames.Add(frame);

    public void RecordSectorBoundary(int sectorIndex, float normPos)
    {
        if (sectorIndex == 0) _sectorBoundary1 = normPos;
        else if (sectorIndex == 1) _sectorBoundary2 = normPos;
    }

    public CompletedLapTelemetry? Finish(int lapTimeMs, bool hasCut)
    {
        if (hasCut || _frames.Count < 100) return null;

        var maxSpeed = _frames.Max(f => f.SpeedKmh);
        var sectors = new List<float>();
        if (_sectorBoundary1.HasValue) sectors.Add(_sectorBoundary1.Value);
        if (_sectorBoundary2.HasValue) sectors.Add(_sectorBoundary2.Value);

        return new CompletedLapTelemetry(_frames.ToList(), sectors, maxSpeed, lapTimeMs);
    }

    public void Clear()
    {
        _frames.Clear();
        _sectorBoundary1 = null;
        _sectorBoundary2 = null;
    }
}

public record CompletedLapTelemetry(
    IReadOnlyList<TelemetryFrame> Frames,
    IReadOnlyList<float> SectorBoundaries,
    float MaxSpeed,
    int DurationMs
);
