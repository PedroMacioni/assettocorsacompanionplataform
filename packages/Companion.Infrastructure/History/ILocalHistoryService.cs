using Companion.SharedContracts.History;

namespace Companion.Infrastructure.History;

public interface ILocalHistoryService
{
    HistoryResponse GetHistory();
    SessionLapsResponse GetSessionLaps(string sessionSourceId);
    void SetCustomPaths(string? sessionsPath, string? personalBestPath);
    (string SessionsPath, string PersonalBestPath) GetCurrentPaths();
}
