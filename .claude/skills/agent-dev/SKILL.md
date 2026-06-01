---
name: agent-dev
description: Use when working on the C# desktop agent (CompanionAgent.Tray, CompanionAgent.Api), debugging agent issues, or adding agent features
---

# Agent Development

Skill for working on the Sim Racing Companion desktop agent (C# .NET 10).

## Project Structure

```
apps/CompanionAgent/
├── CompanionAgent.Api/         # Local HTTP API (port 47832)
│   └── Program.cs
├── CompanionAgent.Tray/        # Windows tray application
│   ├── Program.cs              # Entry point
│   ├── MainForm.cs             # UI
│   ├── TrayApplicationContext.cs
│   ├── SyncWorker.cs           # Sync logic (CRITICAL)
│   ├── SyncCache.cs            # Tracks synced items
│   ├── SupabaseClient.cs       # API calls to Supabase
│   ├── AgentSettings.cs
│   └── SettingsStore.cs
packages/
├── Companion.Domain/           # Pure models (no dependencies)
├── Companion.Infrastructure/   # I/O, file readers
└── Companion.SharedContracts/  # DTOs for API
```

## Quick Commands

```bash
# Build
dotnet build apps/CompanionAgent/CompanionAgent.Tray/CompanionAgent.Tray.csproj

# Run
dotnet run --project apps/CompanionAgent/CompanionAgent.Tray/CompanionAgent.Tray.csproj

# Build API only
dotnet build apps/CompanionAgent/CompanionAgent.Api/CompanionAgent.Api.csproj

# Run API
dotnet run --project apps/CompanionAgent/CompanionAgent.Api/CompanionAgent.Api.csproj
```

## Key Files to Read First

1. `SyncWorker.cs` - Core sync logic, FileSystemWatcher
2. `SupabaseClient.cs` - API calls, batch operations
3. `SyncCache.cs` - Tracking what's been synced
4. `docs/sync-spec.md` - Known bugs and fixes

## Known Issues

See `docs/sync-spec.md` for full list:

| Issue | File | Fix |
|-------|------|-----|
| Laps not synced | SyncCache.cs | Separate session/lap tracking |
| batchSize=1 | SupabaseClient.cs | Increase to 50 |
| No debounce | SyncWorker.cs | Add 500ms debounce |
| No retry | SyncWorker.cs | Add retry queue |

## Conventions

- Nullable reference types enabled
- Async/await for all I/O
- Dependency injection via constructor
- Structured logging with ILogger
- No hardcoded paths (use settings)

## Testing

```bash
# Run all tests
dotnet test SimRacingCompanion.slnx

# Run specific project tests
dotnet test packages/Companion.Infrastructure.Tests/
```

## Common Tasks

### Adding a new endpoint to local API

1. Create controller in `CompanionAgent.Api/Controllers/`
2. Add DTO in `Companion.SharedContracts/`
3. Implement service in `Companion.Infrastructure/`

### Adding sync for new data type

1. Add model in `Companion.Domain/`
2. Add DTO in `Companion.SharedContracts/`
3. Add parser in `Companion.Infrastructure/`
4. Add sync method in `SyncWorker.cs`
5. Track in `SyncCache.cs`

### Debugging sync issues

1. Check `SyncCache.cs` - is item marked as synced?
2. Check `SupabaseClient.cs` - is request failing?
3. Check FileSystemWatcher in `SyncWorker.cs` - is file change detected?
4. Enable verbose logging
