namespace Companion.SharedContracts.History;

public sealed record HistoryResponse(
    ProfileSummaryDto Summary,
    SessionDto? LatestSession,
    SessionDto? FastestSessionLap,
    PersonalBestDto? FastestPersonalBest,
    IReadOnlyList<TopCarDto> TopCars,
    IReadOnlyList<TopTrackDto> TopTracks,
    IReadOnlyList<SessionDto> Sessions,
    IReadOnlyList<PersonalBestDto> PersonalBests,
    HistorySourceDto Sources);

public sealed record ProfileSummaryDto(
    int Sessions,
    int PersonalBests,
    int Cars,
    int Tracks,
    int Laps,
    double DistanceKm);

public sealed record SessionDto(
    string Id,
    DateTimeOffset StartedAt,
    string DriverName,
    string CarId,
    string TrackId,
    string SessionTypes,
    int Laps,
    double? DistanceKm,
    int? BestLapMs,
    int? LastLapMs);

public sealed record PersonalBestDto(
    string CarId,
    string TrackId,
    int TimeMs,
    long? SourceDate);

public sealed record TopCarDto(
    string CarId,
    int Sessions,
    int Laps,
    double DistanceKm,
    int? BestLapMs);

public sealed record TopTrackDto(
    string TrackId,
    int Sessions,
    int Laps,
    double DistanceKm,
    int? BestLapMs);

public sealed record HistorySourceDto(
    string ContentManagerSessionsPath,
    bool ContentManagerSessionsFound,
    string PersonalBestPath,
    bool PersonalBestFound);

public sealed record LapDto(
    string SessionSourceId,
    int LapNumber,
    int TimeMs,
    int? S1Ms,
    int? S2Ms,
    int? S3Ms,
    int Cuts,
    string? Tyre);

public sealed record SessionLapsResponse(
    string SessionSourceId,
    IReadOnlyList<LapDto> Laps);
