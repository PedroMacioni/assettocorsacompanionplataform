namespace Companion.Domain.History;

public sealed record HistoryImportResult(
    IReadOnlyList<ImportedSession> Sessions,
    IReadOnlyList<PersonalBestRecord> PersonalBests);
