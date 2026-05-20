namespace Companion.SharedContracts.Agent;

public sealed record AgentHealthResponse(
    string Status,
    string Agent,
    string Version,
    DateTimeOffset ServerTime,
    string LocalApiBaseUrl);
