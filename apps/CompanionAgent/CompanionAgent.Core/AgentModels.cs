namespace CompanionAgent.Core;

public sealed record AgentConnectionState(
    bool IsConnected,
    string? UserId,
    string? DeviceId,
    string? DeviceName,
    DateTimeOffset? ConnectedAt);

public sealed record SyncSnapshot(
    SyncState State,
    string Message,
    DateTimeOffset? LastSyncedAt,
    int PendingSessions,
    int PendingLapSessions,
    int LastSyncSessionCount);
