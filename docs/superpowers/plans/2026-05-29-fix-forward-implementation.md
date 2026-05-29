# Fix Forward Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stabilize the Sim Racing Companion platform by fixing build errors, debugging the agent, adding tests, and configuring CI/CD.

**Architecture:** Monorepo with Next.js frontend, C# desktop agent, and Supabase backend. Fix Forward approach - repair what's broken, add foundation, continue development.

**Tech Stack:** Next.js 16.2, React 19, TypeScript 5, .NET 10, Supabase, Vitest, xUnit, GitHub Actions

---

## File Structure

### Phase 1: Stabilization

**Files to modify:**
- `apps/web/app/(dashboard)/settings/SettingsClient.tsx` - Fix missing state variables
- `apps/CompanionAgent/CompanionAgent.Tray/SyncWorker.cs` - Add debounce and retry logic
- `apps/CompanionAgent/CompanionAgent.Tray/SupabaseClient.cs` - Fix batch size

**Files to create:**
- `apps/web/vitest.config.ts` - Vitest configuration
- `apps/web/lib/__tests__/calculations.test.ts` - Unit tests for calculations
- `.github/workflows/ci.yml` - CI pipeline
- `apps/web/.env.example` - Environment template

### Phase 2: Sync Fixes

**Files to modify:**
- `apps/CompanionAgent/CompanionAgent.Tray/SyncCache.cs` - Separate session/lap sync tracking
- `apps/CompanionAgent/CompanionAgent.Tray/SyncWorker.cs` - Implement retry queue

**Files to create:**
- `packages/Companion.Infrastructure.Tests/` - Test project for sync logic

---

## Phase 1: Stabilization

### Task 1: Fix Build Errors in SettingsClient.tsx

**Files:**
- Modify: `apps/web/app/(dashboard)/settings/SettingsClient.tsx:89-102`

**Context:** The component uses `tokenVisible`, `token`, and `copied` state variables that are not defined. These need to be added to the useState declarations.

- [ ] **Step 1: Read the current state declarations**

Open the file and locate the useState block around lines 89-102.

- [ ] **Step 2: Add the missing state variables**

After line 102 (the `disconnecting` state), add:

```tsx
  const [token, setToken]               = useState("");
  const [tokenVisible, setTokenVisible] = useState(false);
  const [copied, setCopied]             = useState(false);
```

- [ ] **Step 3: Add the copyToken helper function**

After the state declarations, add:

```tsx
  const copyToken = async () => {
    if (!token) return;
    await navigator.clipboard.writeText(token);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
```

- [ ] **Step 4: Add missing icon imports**

Update the imports at line 4-7 to include `Eye`, `EyeOff`, and `Copy`:

```tsx
import {
  User, Palette, Monitor, Check,
  Sun, Moon, Globe, ChevronRight, Camera, X, Laptop, AlertCircle,
  Eye, EyeOff, Copy,
} from "lucide-react";
```

- [ ] **Step 5: Verify build passes**

Run: `cd apps/web && npm run build`
Expected: Build completes without TypeScript errors

- [ ] **Step 6: Commit the fix**

```bash
git add apps/web/app/\(dashboard\)/settings/SettingsClient.tsx
git commit -m "fix(settings): add missing state variables for token visibility

Adds token, tokenVisible, and copied state variables that were being
used but not declared, causing TypeScript build errors."
```

---

### Task 2: Configure Vitest for Frontend Tests

**Files:**
- Create: `apps/web/vitest.config.ts`
- Modify: `apps/web/package.json`

- [ ] **Step 1: Install Vitest and dependencies**

Run:
```bash
cd apps/web && npm install -D vitest @vitejs/plugin-react jsdom @testing-library/react @testing-library/jest-dom
```

- [ ] **Step 2: Create vitest.config.ts**

Create file `apps/web/vitest.config.ts`:

```typescript
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    include: ['**/*.test.ts', '**/*.test.tsx'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['lib/**/*.ts', 'components/**/*.tsx'],
      exclude: ['**/*.test.ts', '**/*.test.tsx', '**/node_modules/**'],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
    },
  },
});
```

- [ ] **Step 3: Create vitest.setup.ts**

Create file `apps/web/vitest.setup.ts`:

```typescript
import '@testing-library/jest-dom';
```

- [ ] **Step 4: Add test scripts to package.json**

Add to the "scripts" section of `apps/web/package.json`:

```json
"test": "vitest run",
"test:watch": "vitest",
"test:coverage": "vitest run --coverage"
```

- [ ] **Step 5: Verify Vitest runs**

Run: `cd apps/web && npm test`
Expected: "No test files found" (we'll add tests next)

- [ ] **Step 6: Commit**

```bash
git add apps/web/vitest.config.ts apps/web/vitest.setup.ts apps/web/package.json
git commit -m "chore(web): configure Vitest for unit testing

Sets up Vitest with React testing library, jsdom environment,
and path aliases matching the project structure."
```

---

### Task 3: Add Unit Tests for Calculation Functions

**Files:**
- Create: `apps/web/lib/__tests__/calculations.test.ts`
- Test: `apps/web/lib/calculations/consistency.ts`
- Test: `apps/web/lib/calculations/streak.ts`
- Test: `apps/web/lib/calculations/session-quality.ts`

- [ ] **Step 1: Create test directory**

Run: `mkdir -p apps/web/lib/__tests__`

- [ ] **Step 2: Read the calculation files to understand their interfaces**

Read `apps/web/lib/calculations/index.ts` and the individual files to understand the exports.

- [ ] **Step 3: Write tests for consistency calculations**

Create file `apps/web/lib/__tests__/consistency.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { calculateConsistencyScore } from '../calculations/consistency';

describe('calculateConsistencyScore', () => {
  it('returns 100 for identical lap times', () => {
    const laps = [
      { lap_time_ms: 90000 },
      { lap_time_ms: 90000 },
      { lap_time_ms: 90000 },
    ];
    expect(calculateConsistencyScore(laps)).toBe(100);
  });

  it('returns lower score for varied lap times', () => {
    const laps = [
      { lap_time_ms: 90000 },
      { lap_time_ms: 95000 },
      { lap_time_ms: 85000 },
    ];
    const score = calculateConsistencyScore(laps);
    expect(score).toBeLessThan(100);
    expect(score).toBeGreaterThan(0);
  });

  it('returns 0 for empty array', () => {
    expect(calculateConsistencyScore([])).toBe(0);
  });

  it('returns 100 for single lap', () => {
    expect(calculateConsistencyScore([{ lap_time_ms: 90000 }])).toBe(100);
  });
});
```

- [ ] **Step 4: Write tests for streak calculations**

Create file `apps/web/lib/__tests__/streak.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { calculateStreak } from '../calculations/streak';

describe('calculateStreak', () => {
  it('returns 0 for empty sessions', () => {
    expect(calculateStreak([])).toBe(0);
  });

  it('returns 1 for single session today', () => {
    const today = new Date().toISOString();
    expect(calculateStreak([{ date: today }])).toBe(1);
  });

  it('counts consecutive days', () => {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const sessions = [
      { date: today.toISOString() },
      { date: yesterday.toISOString() },
    ];
    expect(calculateStreak(sessions)).toBe(2);
  });

  it('breaks streak on gap', () => {
    const today = new Date();
    const threeDaysAgo = new Date(today);
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

    const sessions = [
      { date: today.toISOString() },
      { date: threeDaysAgo.toISOString() },
    ];
    expect(calculateStreak(sessions)).toBe(1);
  });
});
```

- [ ] **Step 5: Run tests**

Run: `cd apps/web && npm test`
Expected: All tests pass

- [ ] **Step 6: Commit**

```bash
git add apps/web/lib/__tests__/
git commit -m "test(calculations): add unit tests for consistency and streak

Tests core calculation logic with edge cases for empty arrays,
single values, and typical use cases."
```

---

### Task 4: Create Environment Template

**Files:**
- Create: `apps/web/.env.example`

- [ ] **Step 1: Read existing .env.local to understand required variables**

Check what environment variables are used in the codebase.

- [ ] **Step 2: Create .env.example**

Create file `apps/web/.env.example`:

```bash
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here

# Supabase Admin (server-side only)
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here

# Local Agent API (for development)
NEXT_PUBLIC_AGENT_API_URL=http://127.0.0.1:47832
```

- [ ] **Step 3: Add .env.example to git**

Ensure `.env.local` is in `.gitignore` but `.env.example` is not.

- [ ] **Step 4: Commit**

```bash
git add apps/web/.env.example
git commit -m "docs(web): add environment template

Provides .env.example with all required environment variables
for easier onboarding of new developers."
```

---

### Task 5: Configure GitHub Actions CI

**Files:**
- Create: `.github/workflows/ci.yml`

- [ ] **Step 1: Create workflows directory**

Run: `mkdir -p .github/workflows`

- [ ] **Step 2: Create CI workflow**

Create file `.github/workflows/ci.yml`:

```yaml
name: CI

on:
  push:
    branches: [main, master]
  pull_request:
    branches: [main, master]

jobs:
  web-lint-and-test:
    name: Web - Lint & Test
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: apps/web

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
          cache-dependency-path: apps/web/package-lock.json

      - name: Install dependencies
        run: npm ci

      - name: Lint
        run: npm run lint

      - name: Type check
        run: npx tsc --noEmit

      - name: Run tests
        run: npm test

  web-build:
    name: Web - Build
    runs-on: ubuntu-latest
    needs: web-lint-and-test
    defaults:
      run:
        working-directory: apps/web

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
          cache-dependency-path: apps/web/package-lock.json

      - name: Install dependencies
        run: npm ci

      - name: Build
        run: npm run build
        env:
          NEXT_PUBLIC_SUPABASE_URL: ${{ secrets.NEXT_PUBLIC_SUPABASE_URL }}
          NEXT_PUBLIC_SUPABASE_ANON_KEY: ${{ secrets.NEXT_PUBLIC_SUPABASE_ANON_KEY }}

  agent-build:
    name: Agent - Build & Test
    runs-on: windows-latest

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup .NET
        uses: actions/setup-dotnet@v4
        with:
          dotnet-version: '10.0.x'

      - name: Restore dependencies
        run: dotnet restore SimRacingCompanion.slnx

      - name: Build
        run: dotnet build SimRacingCompanion.slnx --no-restore --configuration Release

      - name: Test
        run: dotnet test SimRacingCompanion.slnx --no-build --configuration Release --verbosity normal
```

- [ ] **Step 3: Verify workflow syntax**

Run: `cat .github/workflows/ci.yml`
Verify YAML is valid.

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: add GitHub Actions workflow

Configures CI pipeline with lint, type-check, test, and build
jobs for both web (Node.js) and agent (.NET) projects."
```

---

### Task 6: Debug and Fix Agent Desktop (Investigation)

**Files:**
- Read: `apps/CompanionAgent/CompanionAgent.Tray/Program.cs`
- Read: `apps/CompanionAgent/CompanionAgent.Tray/MainForm.cs`
- Read: `apps/CompanionAgent/CompanionAgent.Tray/TrayApplicationContext.cs`

**Note:** This task is investigative. The specific fix depends on what error is found.

- [ ] **Step 1: Try to build the agent**

Run:
```bash
cd apps/CompanionAgent
dotnet build CompanionAgent.Tray/CompanionAgent.Tray.csproj
```

Expected: Build succeeds or shows specific error.

- [ ] **Step 2: If build succeeds, try to run**

Run:
```bash
dotnet run --project CompanionAgent.Tray/CompanionAgent.Tray.csproj
```

Observe what happens. Does it crash? Show an error? Open but freeze?

- [ ] **Step 3: Check for common issues**

Read `Program.cs` and `TrayApplicationContext.cs` to check for:
- Missing configuration files
- Hardcoded paths that don't exist
- Unhandled exceptions in startup
- Missing dependencies

- [ ] **Step 4: Document findings**

Create a comment/issue or update the plan with specific fix needed.

- [ ] **Step 5: Implement fix based on findings**

(Steps will be added based on investigation results)

---

## Phase 2: Sync Fixes

### Task 7: Separate Session and Lap Sync Tracking

**Files:**
- Modify: `apps/CompanionAgent/CompanionAgent.Tray/SyncCache.cs`

**Context:** Currently `SyncedSessionIds` is set to true even if laps failed to sync. This causes data loss.

- [ ] **Step 1: Read current SyncCache implementation**

Read `apps/CompanionAgent/CompanionAgent.Tray/SyncCache.cs` to understand current structure.

- [ ] **Step 2: Add separate lap tracking**

Modify the SyncCache class to have two separate tracking sets:

```csharp
public class SyncCache
{
    private HashSet<string> _syncedSessionIds = new();
    private HashSet<string> _syncedLapSessionIds = new();  // NEW

    public bool IsSessionSynced(string sessionId) => _syncedSessionIds.Contains(sessionId);
    public bool AreLapsSynced(string sessionId) => _syncedLapSessionIds.Contains(sessionId);  // NEW

    public void MarkSessionSynced(string sessionId) => _syncedSessionIds.Add(sessionId);
    public void MarkLapsSynced(string sessionId) => _syncedLapSessionIds.Add(sessionId);  // NEW

    // ... persistence methods updated to save/load both sets
}
```

- [ ] **Step 3: Update SyncWorker to use new methods**

In `SyncWorker.cs`, update the sync logic:
- Call `MarkSessionSynced()` only after session metadata succeeds
- Call `MarkLapsSynced()` only after laps successfully sync
- Check `AreLapsSynced()` before attempting lap sync

- [ ] **Step 4: Test manually**

1. Run the agent
2. Complete a session in AC
3. Kill the agent mid-sync
4. Restart and verify laps are retried

- [ ] **Step 5: Commit**

```bash
git add apps/CompanionAgent/CompanionAgent.Tray/SyncCache.cs
git add apps/CompanionAgent/CompanionAgent.Tray/SyncWorker.cs
git commit -m "fix(sync): separate session and lap sync tracking

Prevents marking sessions as synced before laps are confirmed,
fixing data loss when sync is interrupted mid-process."
```

---

### Task 8: Increase Track Batch Size

**Files:**
- Modify: `apps/CompanionAgent/CompanionAgent.Tray/SupabaseClient.cs`

- [ ] **Step 1: Find the batch size constant**

Search for `batchSize` or batch-related code in SupabaseClient.cs.

- [ ] **Step 2: Update batch size from 1 to 50**

Change:
```csharp
const int batchSize = 1;
```

To:
```csharp
const int batchSize = 50;
```

- [ ] **Step 3: Verify no other code assumes batch size of 1**

Search for any code that might break with larger batches.

- [ ] **Step 4: Commit**

```bash
git add apps/CompanionAgent/CompanionAgent.Tray/SupabaseClient.cs
git commit -m "perf(sync): increase track batch size from 1 to 50

Reduces HTTP requests from N to N/50 when syncing tracks,
dramatically improving sync performance."
```

---

### Task 9: Add FileSystemWatcher Debounce

**Files:**
- Modify: `apps/CompanionAgent/CompanionAgent.Tray/SyncWorker.cs`

- [ ] **Step 1: Read current FileSystemWatcher setup**

Find where FileSystemWatcher is configured in SyncWorker.cs.

- [ ] **Step 2: Add debounce timer**

Add a debounce mechanism:

```csharp
private Timer? _debounceTimer;
private const int DebounceDelayMs = 500;

private void OnFileChanged(object sender, FileSystemEventArgs e)
{
    // Cancel previous timer if exists
    _debounceTimer?.Dispose();

    // Start new timer
    _debounceTimer = new Timer(
        callback: _ => ProcessFileChange(e.FullPath),
        state: null,
        dueTime: DebounceDelayMs,
        period: Timeout.Infinite
    );
}

private void ProcessFileChange(string path)
{
    // Actual processing logic here
}
```

- [ ] **Step 3: Test with Content Manager**

1. Open Content Manager
2. Complete a session
3. Verify no duplicate sync attempts
4. Verify data syncs correctly after debounce period

- [ ] **Step 4: Commit**

```bash
git add apps/CompanionAgent/CompanionAgent.Tray/SyncWorker.cs
git commit -m "fix(sync): add 500ms debounce to FileSystemWatcher

Prevents race conditions when Content Manager writes multiple
files in quick succession during session save."
```

---

### Task 10: Implement Retry Queue

**Files:**
- Create: `apps/CompanionAgent/CompanionAgent.Tray/RetryQueue.cs`
- Modify: `apps/CompanionAgent/CompanionAgent.Tray/SyncWorker.cs`

- [ ] **Step 1: Create RetryQueue class**

Create file `apps/CompanionAgent/CompanionAgent.Tray/RetryQueue.cs`:

```csharp
using System;
using System.Collections.Concurrent;
using System.Threading;
using System.Threading.Tasks;

namespace CompanionAgent.Tray;

public record RetryItem(
    string Id,
    Func<Task<bool>> Action,
    int Attempts = 0,
    DateTime? NextRetry = null
);

public class RetryQueue
{
    private readonly ConcurrentQueue<RetryItem> _queue = new();
    private readonly int _maxAttempts;
    private readonly int _baseDelayMs;
    private Timer? _processTimer;

    public RetryQueue(int maxAttempts = 5, int baseDelayMs = 30000)
    {
        _maxAttempts = maxAttempts;
        _baseDelayMs = baseDelayMs;
    }

    public void Enqueue(string id, Func<Task<bool>> action)
    {
        _queue.Enqueue(new RetryItem(id, action));
        EnsureTimerRunning();
    }

    public async Task ProcessAsync(CancellationToken ct)
    {
        while (_queue.TryDequeue(out var item))
        {
            if (ct.IsCancellationRequested) break;

            if (item.NextRetry.HasValue && DateTime.UtcNow < item.NextRetry.Value)
            {
                _queue.Enqueue(item);
                continue;
            }

            try
            {
                var success = await item.Action();
                if (!success && item.Attempts < _maxAttempts)
                {
                    var delay = _baseDelayMs * Math.Pow(2, item.Attempts);
                    var nextRetry = DateTime.UtcNow.AddMilliseconds(delay);
                    _queue.Enqueue(item with {
                        Attempts = item.Attempts + 1,
                        NextRetry = nextRetry
                    });
                }
            }
            catch
            {
                if (item.Attempts < _maxAttempts)
                {
                    var delay = _baseDelayMs * Math.Pow(2, item.Attempts);
                    var nextRetry = DateTime.UtcNow.AddMilliseconds(delay);
                    _queue.Enqueue(item with {
                        Attempts = item.Attempts + 1,
                        NextRetry = nextRetry
                    });
                }
            }
        }
    }

    private void EnsureTimerRunning()
    {
        _processTimer ??= new Timer(
            async _ => await ProcessAsync(CancellationToken.None),
            null,
            _baseDelayMs,
            _baseDelayMs
        );
    }

    public int Count => _queue.Count;
}
```

- [ ] **Step 2: Integrate RetryQueue into SyncWorker**

In `SyncWorker.cs`, add:

```csharp
private readonly RetryQueue _retryQueue = new();

// In sync method, when lap sync fails:
if (!lapSyncSuccess)
{
    _retryQueue.Enqueue(
        $"laps-{sessionId}",
        async () => await SyncLapsAsync(sessionId, laps)
    );
}
```

- [ ] **Step 3: Test retry behavior**

1. Disconnect network
2. Trigger a sync
3. Reconnect network
4. Verify items are retried and eventually succeed

- [ ] **Step 4: Commit**

```bash
git add apps/CompanionAgent/CompanionAgent.Tray/RetryQueue.cs
git add apps/CompanionAgent/CompanionAgent.Tray/SyncWorker.cs
git commit -m "feat(sync): implement retry queue with exponential backoff

Failed sync operations are now queued and retried up to 5 times
with exponential backoff (30s, 60s, 120s, 240s, 480s)."
```

---

## Phase 3: Quality Gates

### Task 11: Add Pre-commit Hook for Lint

**Files:**
- Create: `.husky/pre-commit` (optional, if husky is desired)
- Alternative: Rely on CI

- [ ] **Step 1: Decide on approach**

For simplicity, rely on CI rather than pre-commit hooks. Skip this task if CI is sufficient.

---

### Task 12: Verify Full Pipeline

**Files:** None (verification only)

- [ ] **Step 1: Create a test branch**

```bash
git checkout -b test/ci-pipeline
```

- [ ] **Step 2: Make a small change**

```bash
echo "// test" >> apps/web/lib/utils.ts
git add apps/web/lib/utils.ts
git commit -m "test: verify CI pipeline"
```

- [ ] **Step 3: Push and observe CI**

```bash
git push -u origin test/ci-pipeline
```

Go to GitHub Actions and verify:
- Lint passes
- Type check passes
- Tests pass
- Build succeeds

- [ ] **Step 4: Clean up**

```bash
git checkout master
git branch -D test/ci-pipeline
git push origin --delete test/ci-pipeline
```

---

## Summary

| Phase | Tasks | Goal |
|-------|-------|------|
| 1: Stabilization | 1-6 | Build passing, tests running, CI configured |
| 2: Sync Fixes | 7-10 | Reliable data sync from AC to Supabase |
| 3: Quality | 11-12 | Pipeline verified end-to-end |

**Total Tasks:** 12
**Estimated Completion:** Phase 1 (1-2 days), Phase 2 (1-2 days), Phase 3 (half day)

---

## Changelog

- **2026-05-29:** Plan created
