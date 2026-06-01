---
name: sync-debug
description: Use when data is not syncing from Assetto Corsa to the web app, laps are missing, sessions not appearing, or sync errors occur
---

# Sync Debugging

Skill for diagnosing sync issues between Assetto Corsa → Agent → Supabase → Web.

## Sync Flow

```
Assetto Corsa
    │
    ▼ (writes JSON files)
Content Manager / AC
    │
    ▼ (FileSystemWatcher detects)
CompanionAgent.Tray (SyncWorker.cs)
    │
    ▼ (HTTP POST)
Supabase (PostgreSQL)
    │
    ▼ (query)
Next.js Web App
```

## Quick Diagnosis

### 1. Is the Agent Running?

```bash
# Check if process exists
tasklist | findstr CompanionAgent

# Check if API responds
curl http://127.0.0.1:47832/api/health
```

### 2. Is Data Being Detected?

Check if FileSystemWatcher is detecting changes:
- Look at `SyncWorker.cs` logs
- Verify Content Manager path is correct in settings

### 3. Is Data Being Sent?

Check `SupabaseClient.cs`:
- Are requests being made?
- What's the response status?

### 4. Is Data in Supabase?

```sql
-- Check recent sessions
SELECT * FROM sessions
ORDER BY created_at DESC
LIMIT 5;

-- Check if laps exist for a session
SELECT COUNT(*) FROM laps
WHERE session_id = 'xxx';
```

### 5. Is Web App Querying Correctly?

Check `lib/queries.ts` and browser Network tab.

## Known Bugs

Reference: `docs/sync-spec.md`

| Bug | Symptom | Location | Fix |
|-----|---------|----------|-----|
| Sessions marked synced before laps | Laps missing | SyncCache.cs | Separate tracking |
| batchSize = 1 | Slow track sync | SupabaseClient.cs | Increase to 50 |
| No debounce | Duplicate syncs | SyncWorker.cs | Add 500ms debounce |
| No retry | Failed laps lost | SyncWorker.cs | Add retry queue |
| No mutex on token refresh | 401 errors | SupabaseClient.cs | Add lock |

## Key Files

```
apps/CompanionAgent/CompanionAgent.Tray/
├── SyncWorker.cs       # FileSystemWatcher, sync orchestration
├── SyncCache.cs        # Tracks what's been synced
├── SupabaseClient.cs   # API calls to Supabase
└── AgentSettings.cs    # Configuration (paths, tokens)

packages/Companion.Infrastructure/
└── History/
    └── LocalHistoryService.cs  # Parses AC JSON files
```

## Debugging Steps

### Laps Not Appearing

1. **Check SyncCache.cs**
   ```csharp
   // Is session marked as synced?
   _syncedSessionIds.Contains(sessionId)
   ```

2. **Check if laps were parsed**
   - Look at `LocalHistoryService.cs`
   - Verify JSON file exists and is valid

3. **Check Supabase response**
   - 401 = auth issue (token expired?)
   - 400 = data validation failed
   - 500 = server error

### Sessions Not Detecting

1. **Check FileSystemWatcher path**
   ```csharp
   // In SyncWorker.cs
   _watcher.Path = settings.ContentManagerPath;
   ```

2. **Verify Content Manager path is correct**
   - Default: `%LOCALAPPDATA%\AcTools Content Manager\`

3. **Check if filter is correct**
   ```csharp
   _watcher.Filter = "*.json";
   ```

### Sync Stuck / Slow

1. **Check batch size**
   ```csharp
   // In SupabaseClient.cs
   const int batchSize = 1; // Should be 50
   ```

2. **Check for infinite loop**
   - Is same item being re-synced?
   - Check SyncCache persistence

3. **Check network**
   ```bash
   curl -X POST https://your-project.supabase.co/rest/v1/sessions \
     -H "apikey: your-key" \
     -H "Content-Type: application/json" \
     -d '{}'
   ```

## Testing Sync Manually

1. **Start agent with logging**
   ```bash
   dotnet run --project apps/CompanionAgent/CompanionAgent.Tray/CompanionAgent.Tray.csproj
   ```

2. **Complete a session in AC**
   - Do a few laps
   - Return to pits
   - Wait for Content Manager to save

3. **Observe agent logs**
   - File change detected?
   - Parse successful?
   - Sync request made?
   - Response received?

4. **Check Supabase**
   - Session exists?
   - Laps exist?
   - Data correct?

5. **Check web app**
   - Refresh dashboard
   - Data appears?

## Common Fixes

### Reset Sync Cache

```csharp
// Delete the cache file
// Location: %APPDATA%\SimRacingCompanion\sync-cache.json
```

### Force Re-sync

```csharp
// Clear synced IDs and restart agent
_syncedSessionIds.Clear();
_syncedLapSessionIds.Clear();
```

### Check Token

```csharp
// In SupabaseClient.cs, log the token status
Console.WriteLine($"Token valid: {!IsTokenExpired()}");
```
