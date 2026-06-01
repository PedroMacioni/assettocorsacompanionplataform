---
name: new-feature
description: Use when implementing a new feature, adding functionality, or building new components - enforces the planning workflow before coding
---

# New Feature Development

Skill that enforces the correct workflow for implementing new features in Sim Racing Companion.

## MANDATORY: Never Code Without Planning

```
Ideia → Brainstorming → Spec → Plano → TDD → Verificação → PR
```

**Before writing ANY code, you MUST:**

1. Use `superpowers:brainstorming` to explore the feature
2. Create a spec in `docs/superpowers/specs/`
3. Create a plan in `docs/superpowers/plans/`
4. Get user approval

## Workflow

### Step 1: Understand Context

Read these files FIRST:
- `docs/architecture.md` - System overview
- `docs/api-contracts.md` - API endpoints
- `docs/superpowers/specs/2026-05-29-fix-forward-platform-redesign.md` - Current design

### Step 2: Brainstorm

```
Invoke: superpowers:brainstorming
```

This will:
- Ask clarifying questions
- Propose 2-3 approaches
- Present design for approval
- Write spec document

### Step 3: Plan

```
Invoke: superpowers:writing-plans
```

This will:
- Create detailed task list
- Define exact files to create/modify
- Include test steps
- Set commit checkpoints

### Step 4: Implement

```
Invoke: superpowers:subagent-driven-development
   OR: superpowers:executing-plans
```

Follow TDD:
1. Write failing test
2. Implement minimal code
3. Verify test passes
4. Commit

### Step 5: Verify

```
Invoke: superpowers:verification-before-completion
```

Before claiming done:
- All tests pass
- Build succeeds
- Lint passes

## Feature Types

### Frontend Feature (React/Next.js)

**Files typically involved:**
```
apps/web/
├── app/(dashboard)/[feature]/
│   └── page.tsx              # Page component
├── components/[feature]/
│   ├── FeatureCard.tsx       # UI components
│   └── index.ts              # Exports
├── lib/
│   ├── queries.ts            # Add query function
│   └── types.ts              # Add types
```

**Conventions:**
- Server Components by default
- Client components only when needed ("use client")
- Use shadcn/ui components from `components/ui/`
- Follow existing patterns in similar features

### Backend Feature (Agent/Supabase)

**Files typically involved:**
```
apps/CompanionAgent/
├── CompanionAgent.Tray/
│   └── [Feature]Worker.cs    # Business logic
├── CompanionAgent.Api/
│   └── Controllers/
│       └── [Feature]Controller.cs

packages/
├── Companion.Domain/
│   └── [Feature]/
│       └── [Model].cs
├── Companion.SharedContracts/
│   └── [Feature]/
│       └── [Dto].cs

supabase/migrations/
└── YYYYMMDD_add_[feature].sql
```

**Conventions:**
- Models in Domain (no dependencies)
- DTOs in SharedContracts
- Services in Infrastructure
- Always add RLS policies to migrations

### Full-Stack Feature

1. Start with database schema (Supabase migration)
2. Add backend logic (Agent if needed)
3. Add API endpoint (if needed)
4. Add frontend UI
5. Connect with queries

## Quick Reference: Where Things Go

| What | Where |
|------|-------|
| React page | `apps/web/app/(dashboard)/[route]/page.tsx` |
| React component | `apps/web/components/[feature]/` |
| UI primitive | `apps/web/components/ui/` (shadcn) |
| Data query | `apps/web/lib/queries.ts` |
| Server action | `apps/web/lib/actions.ts` |
| TypeScript type | `apps/web/lib/types.ts` |
| C# model | `packages/Companion.Domain/` |
| C# DTO | `packages/Companion.SharedContracts/` |
| C# service | `packages/Companion.Infrastructure/` |
| Agent logic | `apps/CompanionAgent/CompanionAgent.Tray/` |
| API endpoint | `apps/CompanionAgent/CompanionAgent.Api/Controllers/` |
| DB migration | `supabase/migrations/` |
| Design spec | `docs/superpowers/specs/` |
| Impl plan | `docs/superpowers/plans/` |

## Anti-Patterns

**DO NOT:**
- Start coding before brainstorming
- Skip the spec document
- Implement without a plan
- Add features not requested
- Create new patterns (follow existing)
- Skip tests for "simple" features

## Example: Adding a New Card to Dashboard

1. **Brainstorm** - What data? Where in UI? Interactions?
2. **Spec** - Document decisions
3. **Plan** - Tasks: query, component, integration, tests
4. **Implement**:
   - Add query to `lib/queries.ts`
   - Create component in `components/dashboard/`
   - Add to dashboard page
   - Write test
5. **Verify** - Build, lint, test pass
