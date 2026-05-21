namespace Companion.SharedContracts.Tracks;

public sealed record TrackDto(
    string TrackId,
    string Name,
    string? Country,
    string? City,
    double? LengthKm,
    int? Pitboxes,
    string? Run,
    string[] Tags,
    string? Description,
    bool HasOutline);
