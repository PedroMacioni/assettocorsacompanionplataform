namespace Companion.Domain.History;

public sealed record ImportedSession(
    string SourceId,
    DateTimeOffset StartedAt,
    string DriverName,
    string CarId,
    string TrackId,
    string SessionTypes,
    int Laps,
    double? DistanceKm,
    int? BestLapMs,
    int? LastLapMs);
