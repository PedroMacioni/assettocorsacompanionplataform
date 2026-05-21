using Companion.SharedContracts.History;

namespace Companion.Infrastructure.History;

public interface ILocalHistoryService
{
    HistoryResponse GetHistory();
    void SetCustomPaths(string? sessionsPath, string? personalBestPath);
    (string SessionsPath, string PersonalBestPath) GetCurrentPaths();
}
