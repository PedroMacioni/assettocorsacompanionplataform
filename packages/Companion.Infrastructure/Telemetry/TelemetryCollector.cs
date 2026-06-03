using Companion.Domain.Telemetry;
using Companion.SharedContracts.Telemetry;

namespace Companion.Infrastructure.Telemetry;

public sealed class TelemetryCollector : IDisposable
{
    private readonly AcSharedMemoryReader _reader = new();
    private readonly LapBuffer _buffer = new();
    private Timer? _timer;

    private int _lastCompletedLaps = -1;
    private int _lastSectorIndex = -1;
    private CompletedLapTelemetry? _bestLap;
    private int _bestLapTime = int.MaxValue;
    private bool _sessionActive;

    public bool IsConnected { get; private set; }

    public event EventHandler<CompletedLapTelemetry>? BestLapCompleted;
    public event EventHandler<SessionTelemetryResult>? SessionEnded;

    public void Start()
    {
        _timer = new Timer(OnTick, null, TimeSpan.Zero, TimeSpan.FromMilliseconds(50));
    }

    private void OnTick(object? _)
    {
        if (!IsConnected)
        {
            IsConnected = _reader.TryConnect();
            return;
        }

        var physics  = _reader.ReadPhysics();
        var graphics = _reader.ReadGraphics();
        if (physics is null || graphics is null) return;

        var g = graphics.Value;
        var p = physics.Value;

        if (g.Status != 2 /* LIVE */)
        {
            if (_sessionActive) EndSession();
            return;
        }

        _sessionActive = true;
        var (x, _, z) = AcStructHelper.GetPlayerPosition(g);

        _buffer.AddFrame(new TelemetryFrame(
            X: x,
            Z: z,
            SpeedKmh: p.SpeedKmh,
            Throttle: p.Gas,
            Brake: p.Brake,
            NormPos: g.NormalizedCarPosition,
            LapTimeMs: g.ICurrentTime
        ));

        if (g.CurrentSectorIndex != _lastSectorIndex && _lastSectorIndex >= 0)
            _buffer.RecordSectorBoundary(_lastSectorIndex, g.NormalizedCarPosition);

        _lastSectorIndex = g.CurrentSectorIndex;

        if (g.CompletedLaps > _lastCompletedLaps && _lastCompletedLaps >= 0)
        {
            var lapTime = g.ILastTime;
            var completed = _buffer.Finish(lapTime, hasCut: false);
            _buffer.Clear();

            if (completed is not null && lapTime > 0 && lapTime < _bestLapTime)
            {
                _bestLapTime = lapTime;
                _bestLap = completed;
                BestLapCompleted?.Invoke(this, completed);
            }
        }

        _lastCompletedLaps = g.CompletedLaps;
    }

    private void EndSession()
    {
        _sessionActive = false;
        if (_bestLap is not null)
        {
            SessionEnded?.Invoke(this, new SessionTelemetryResult(_bestLap, _bestLapTime));
            _bestLap = null;
            _bestLapTime = int.MaxValue;
        }
        _lastCompletedLaps = -1;
        _lastSectorIndex = -1;
        _buffer.Clear();
    }

    public void Dispose()
    {
        _timer?.Dispose();
        _reader.Dispose();
    }
}

public record SessionTelemetryResult(
    CompletedLapTelemetry BestLap,
    int BestLapTimeMs
);
