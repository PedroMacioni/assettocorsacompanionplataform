using Companion.SharedContracts.History;

namespace Companion.Infrastructure.History;

public interface ILocalHistoryService
{
    HistoryResponse GetHistory();
}
