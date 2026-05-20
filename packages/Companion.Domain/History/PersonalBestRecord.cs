namespace Companion.Domain.History;

public sealed record PersonalBestRecord(
    string CarId,
    string TrackId,
    int TimeMs,
    long? SourceDate);
