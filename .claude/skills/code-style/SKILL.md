---
name: code-style
description: Use when writing code to follow project conventions, naming patterns, file organization, and coding standards for this project
---

# Code Style Guide

Reference guide for coding conventions in Sim Racing Companion.

## TypeScript / React (Frontend)

### File Naming

```
components/
├── ui/                    # Primitives: kebab-case
│   ├── button.tsx
│   ├── card.tsx
│   └── skeleton.tsx
├── dashboard/             # Features: PascalCase
│   ├── HeroCard.tsx
│   ├── KpiCard.tsx
│   └── index.ts           # Barrel exports
└── layout/
    ├── Sidebar.tsx
    └── PageHeader.tsx

lib/
├── queries.ts             # kebab-case
├── actions.ts
├── types.ts
└── utils.ts
```

### Component Structure

```tsx
// 1. Imports (grouped)
import { useState } from "react";           // React
import { Card } from "@/components/ui/card"; // Internal
import { cn } from "@/lib/utils";            // Utils
import type { Session } from "@/lib/types"; // Types last

// 2. Types (if not in types.ts)
type Props = {
  session: Session;
  onSelect?: (id: string) => void;
};

// 3. Component (named export preferred)
export function SessionCard({ session, onSelect }: Props) {
  // Hooks first
  const [expanded, setExpanded] = useState(false);

  // Handlers
  const handleClick = () => {
    onSelect?.(session.id);
  };

  // Render
  return (
    <Card onClick={handleClick}>
      {/* ... */}
    </Card>
  );
}
```

### Naming Conventions

| Type | Convention | Example |
|------|------------|---------|
| Component | PascalCase | `SessionCard` |
| Hook | camelCase, use* | `useSession` |
| Utility function | camelCase | `formatLapTime` |
| Constant | SCREAMING_SNAKE | `MAX_LAPS` |
| Type/Interface | PascalCase | `Session`, `LapData` |
| File (component) | PascalCase | `SessionCard.tsx` |
| File (util) | kebab-case | `format-time.ts` |
| CSS class | Tailwind | `className="..."` |

### Server vs Client Components

```tsx
// Server Component (default) - NO directive needed
async function SessionList() {
  const sessions = await getSessions(); // Server fetch
  return <div>{/* ... */}</div>;
}

// Client Component - ONLY when needed
"use client";

import { useState } from "react";

function InteractiveWidget() {
  const [state, setState] = useState(); // Needs client
  return <button onClick={() => setState()}>Click</button>;
}
```

**Use client only for:**
- useState, useEffect, useRef
- Event handlers (onClick, onChange)
- Browser APIs (window, document)
- Third-party client libraries

### Data Fetching

```tsx
// ✅ GOOD: Server Component with cache
async function Dashboard() {
  const data = await getCachedData();
  return <DashboardView data={data} />;
}

// ✅ GOOD: Cache with tags
import { cacheTag, cacheLife } from "next/cache";

async function getData() {
  "use cache";
  cacheLife("hours");
  cacheTag("sessions");
  return await supabase.from("sessions").select();
}

// ❌ BAD: Client-side fetch
"use client";
useEffect(() => {
  fetch("/api/data").then(/* ... */);
}, []);
```

### Styling (Tailwind)

```tsx
// ✅ GOOD: Utility classes
<div className="flex items-center gap-4 p-4 bg-card rounded-lg">

// ✅ GOOD: Conditional with cn()
<div className={cn(
  "px-4 py-2 rounded",
  isActive && "bg-primary text-primary-foreground",
  disabled && "opacity-50 cursor-not-allowed"
)}>

// ❌ BAD: Inline styles
<div style={{ display: "flex", padding: "16px" }}>

// ❌ BAD: CSS modules (not used in this project)
import styles from "./Card.module.css";
```

---

## C# / .NET (Backend)

### File Organization

```
packages/
├── Companion.Domain/           # Pure models, no deps
│   └── History/
│       ├── ImportedSession.cs  # One class per file
│       └── ImportedLap.cs
├── Companion.Infrastructure/   # I/O, external services
│   └── History/
│       ├── ILocalHistoryService.cs  # Interface
│       └── LocalHistoryService.cs   # Implementation
└── Companion.SharedContracts/  # DTOs only
    └── History/
        └── SessionDto.cs
```

### Naming Conventions

| Type | Convention | Example |
|------|------------|---------|
| Class | PascalCase | `SyncWorker` |
| Interface | IPascalCase | `ILocalHistoryService` |
| Method | PascalCase | `GetSessionsAsync` |
| Property | PascalCase | `LapTimeMs` |
| Field (private) | _camelCase | `_syncCache` |
| Constant | PascalCase | `MaxRetries` |
| Parameter | camelCase | `sessionId` |
| Async method | *Async suffix | `SyncAsync` |

### Class Structure

```csharp
public class SyncWorker : IDisposable
{
    // 1. Constants
    private const int MaxRetries = 5;

    // 2. Private fields
    private readonly ILogger<SyncWorker> _logger;
    private readonly SyncCache _cache;
    private Timer? _timer;

    // 3. Constructor
    public SyncWorker(ILogger<SyncWorker> logger, SyncCache cache)
    {
        _logger = logger;
        _cache = cache;
    }

    // 4. Public methods
    public async Task StartAsync(CancellationToken ct)
    {
        // ...
    }

    // 5. Private methods
    private async Task SyncSessionAsync(string sessionId)
    {
        // ...
    }

    // 6. IDisposable
    public void Dispose()
    {
        _timer?.Dispose();
    }
}
```

### Async/Await

```csharp
// ✅ GOOD: Async all the way
public async Task<Session> GetSessionAsync(string id)
{
    return await _client.GetAsync<Session>($"/sessions/{id}");
}

// ✅ GOOD: ConfigureAwait in libraries
await Task.Delay(1000).ConfigureAwait(false);

// ❌ BAD: Blocking on async
var result = GetSessionAsync(id).Result; // Deadlock risk!
```

### Null Handling

```csharp
// Nullable reference types enabled
public string? OptionalField { get; set; }

// ✅ GOOD: Null check
if (session?.Laps is { Count: > 0 })
{
    ProcessLaps(session.Laps);
}

// ✅ GOOD: Null coalescing
var name = user.DisplayName ?? "Unknown";

// ❌ BAD: No null check
ProcessLaps(session.Laps); // NullReferenceException!
```

---

## SQL (Supabase)

### Naming

```sql
-- Tables: snake_case, plural
CREATE TABLE sessions (...)
CREATE TABLE personal_bests (...)

-- Columns: snake_case
lap_time_ms
created_at
profile_id

-- Indexes: idx_table_column
CREATE INDEX idx_sessions_profile ON sessions(profile_id);

-- Foreign keys: table_column_fkey
CONSTRAINT sessions_profile_id_fkey FOREIGN KEY (profile_id)
```

### Migrations

```sql
-- File: supabase/migrations/20260529_add_achievements.sql

-- Always include RLS
ALTER TABLE achievements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own achievements"
ON achievements FOR SELECT
USING (auth.uid() = profile_id);

-- Always include indexes for FKs
CREATE INDEX idx_achievements_profile ON achievements(profile_id);
```

---

## Git

### Commit Messages

```
feat: add garage page with car list
fix: resolve sync race condition in FileSystemWatcher
docs: update API contracts for new endpoints
test: add unit tests for streak calculation
chore: update dependencies
refactor: extract sync logic to SyncEngine class
```

### Branch Names

```
feat/garage-redesign
fix/sync-duplicate-laps
docs/api-documentation
test/calculation-coverage
```
