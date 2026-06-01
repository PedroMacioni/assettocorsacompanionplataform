---
name: performance
description: Use when optimizing performance, fixing slow pages, reducing bundle size, or investigating lag in the web app or agent
---

# Performance Optimization

Skill for diagnosing and fixing performance issues in Sim Racing Companion.

## Quick Diagnosis

### Web App (Next.js)

```bash
# Build and analyze
cd apps/web
npm run build

# Check bundle size
npx @next/bundle-analyzer

# Lighthouse audit
npx lighthouse http://localhost:3000 --view
```

### Agent (C#)

```bash
# Build Release mode
dotnet build -c Release

# Profile with dotnet-trace
dotnet trace collect --process-id <PID>
```

## Common Performance Issues

### 1. Slow Page Load

**Symptoms:** Page takes >2s to load, white screen

**Checklist:**
- [ ] Using Server Components? (default, no "use client")
- [ ] Data fetching on server? (not useEffect)
- [ ] Using Suspense boundaries?
- [ ] Images optimized with next/image?

**Fix pattern:**
```tsx
// ❌ BAD: Client-side fetch
"use client"
useEffect(() => { fetch('/api/data') }, [])

// ✅ GOOD: Server Component
async function Page() {
  const data = await fetchData() // Server-side
  return <Component data={data} />
}
```

### 2. Unnecessary Re-renders

**Symptoms:** UI feels sluggish, typing lag

**Checklist:**
- [ ] Using React.memo for expensive components?
- [ ] Callbacks wrapped in useCallback?
- [ ] Objects/arrays memoized with useMemo?
- [ ] State lifted too high?

**Debug:**
```tsx
// Add to component to see renders
useEffect(() => {
  console.log('Component rendered')
})
```

### 3. Large Bundle Size

**Symptoms:** Slow initial load, large JS downloads

**Checklist:**
- [ ] Dynamic imports for heavy components?
- [ ] Tree-shaking working? (named imports)
- [ ] No full library imports?

**Fix pattern:**
```tsx
// ❌ BAD: Imports entire library
import { Chart } from 'recharts'

// ✅ GOOD: Named imports
import { LineChart, Line, XAxis } from 'recharts'

// ✅ GOOD: Dynamic import for heavy components
const Chart = dynamic(() => import('./Chart'), {
  loading: () => <Skeleton />
})
```

### 4. Slow Database Queries

**Symptoms:** API responses >500ms

**Checklist:**
- [ ] Using indexes on filtered columns?
- [ ] Selecting only needed columns?
- [ ] Using pagination?
- [ ] Caching with React Query / cacheTag?

**Fix pattern:**
```tsx
// ❌ BAD: Select all
const { data } = await supabase.from('laps').select('*')

// ✅ GOOD: Select needed, with limit
const { data } = await supabase
  .from('laps')
  .select('id, lap_time_ms, is_valid')
  .eq('session_id', sessionId)
  .order('lap_number')
  .limit(100)
```

### 5. Agent Sync Slow

**Symptoms:** Sync takes minutes, high CPU

**Checklist:**
- [ ] Batch size > 1? (check SupabaseClient.cs)
- [ ] Parallel requests where possible?
- [ ] Not re-syncing already synced items?

**Key files:**
- `apps/CompanionAgent/CompanionAgent.Tray/SupabaseClient.cs`
- `apps/CompanionAgent/CompanionAgent.Tray/SyncWorker.cs`

## Performance Targets

| Metric | Target | How to Measure |
|--------|--------|----------------|
| First Contentful Paint | <1.5s | Lighthouse |
| Time to Interactive | <3s | Lighthouse |
| Largest Contentful Paint | <2.5s | Lighthouse |
| Bundle size (main) | <200kb | Build output |
| API response | <200ms | Network tab |
| Sync (100 laps) | <10s | Agent logs |

## Tools

### Frontend

```bash
# React DevTools Profiler
# Install browser extension, use Profiler tab

# Next.js build analysis
ANALYZE=true npm run build

# Lighthouse CLI
npx lighthouse http://localhost:3000 --output html --output-path ./report.html
```

### Backend

```bash
# Supabase query analysis
# Go to Supabase Dashboard > SQL Editor > Explain

# .NET profiling
dotnet trace collect --process-id <PID> --providers Microsoft-DotNETCore-SampleProfiler
```

## Caching Strategy

### Server-side (Next.js 16)

```tsx
import { cacheLife, cacheTag } from 'next/cache'

async function getData() {
  "use cache"
  cacheLife('hours')
  cacheTag('sessions')

  return await fetchSessions()
}

// Invalidate
import { revalidateTag } from 'next/cache'
revalidateTag('sessions')
```

### Client-side (React Query)

```tsx
const { data } = useQuery({
  queryKey: ['sessions', oderId],
  queryFn: fetchSessions,
  staleTime: 5 * 60 * 1000, // 5 minutes
})
```

## Before Optimizing

1. **Measure first** - Don't guess, profile
2. **Set targets** - Know what "fast" means
3. **Fix biggest issue** - 80/20 rule
4. **Verify improvement** - Measure again
