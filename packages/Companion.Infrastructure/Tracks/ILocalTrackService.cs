using Companion.SharedContracts.Tracks;

namespace Companion.Infrastructure.Tracks;

public interface ILocalTrackService
{
    IReadOnlyList<TrackDto> GetTracks();
    byte[]? GetOutlineBytes(string trackId);
}
