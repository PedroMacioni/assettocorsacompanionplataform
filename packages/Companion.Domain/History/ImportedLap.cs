namespace Companion.Domain.History;

public sealed record ImportedLap(
    string SessionSourceId,
    int LapNumber,
    int TimeMs,
    int? S1Ms,
    int? S2Ms,
    int? S3Ms,
    int Cuts,
    string? Tyre);
