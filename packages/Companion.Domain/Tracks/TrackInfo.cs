namespace Companion.Domain.Tracks;

public sealed record TrackInfo(
    string TrackId,
    string Name,
    string? Country,
    string? City,
    double? LengthKm,
    int? Pitboxes,
    string? Run,
    string[] Tags,
    string? Description,
    string? OutlinePath);
