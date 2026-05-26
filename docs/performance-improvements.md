# Performance Improvements Roadmap

## Status: Nível 1 Implementado ✅

Data: 2026-05-26

---

## Nível 1: Quick Wins (IMPLEMENTADO)

### 1.1 Cache Components (Next.js 16)
- [x] Habilitado `cacheComponents: true` no `next.config.ts`
- [x] Criado `lib/queries.ts` com 20+ funções usando `'use cache'`
- [x] Tags de cache por usuário: `user:${userId}`, `user:${userId}:sessions`, etc.

### 1.2 Refatoração das páginas
- [x] Dashboard: 15 queries → funções cached
- [x] Garage: 4 queries → funções cached
- [x] Analytics: 5 queries → funções cached
- [x] Personal Bests: 1 query → função cached

### 1.3 Revalidação inteligente
- [x] Server actions em `lib/actions.ts`
- [x] `revalidateUserData(userId)` invalida cache do usuário
- [x] SyncButton atualizado para invalidar cache após sync

### 1.4 Service Client para queries cached
- [x] `createServiceClient()` em `lib/supabase/server.ts`
- [x] Usa service role key (não depende de cookies)
- [x] **REQUER**: Variável `SUPABASE_SERVICE_ROLE_KEY` configurada

---

## Nível 2: Melhorias Estruturais (PENDENTE)

### 2.1 Materialized Views no Supabase

**Problema**: As views `profile_summary`, `top_cars`, `top_tracks` recalculam agregações a cada query.

**Solução**: Converter para Materialized Views com refresh periódico.

```sql
-- Criar materialized view
CREATE MATERIALIZED VIEW mv_profile_summary AS
SELECT
  user_id,
  count(*) AS total_sessions,
  sum(laps) AS total_laps,
  round(sum(distance_km), 2) AS total_distance_km,
  count(DISTINCT car_id) AS unique_cars,
  count(DISTINCT track_id) AS unique_tracks,
  max(started_at) AS last_session_at,
  min(best_lap_ms) FILTER (WHERE best_lap_ms > 0) AS fastest_lap_ms
FROM sessions
GROUP BY user_id;

-- Índice para queries rápidas
CREATE UNIQUE INDEX ON mv_profile_summary (user_id);

-- Função para refresh após sync
CREATE OR REPLACE FUNCTION refresh_user_stats()
RETURNS trigger AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_profile_summary;
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_top_cars;
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_top_tracks;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Trigger após insert/update em sessions
CREATE TRIGGER trg_refresh_stats
AFTER INSERT OR UPDATE ON sessions
FOR EACH STATEMENT
EXECUTE FUNCTION refresh_user_stats();
```

**Impacto**: Queries de agregação passam de O(n) para O(1).

---

### 2.2 Prefetch de dados via layout

**Problema**: Navegação entre páginas recarrega dados do zero.

**Solução**: Carregar dados comuns no layout do dashboard.

```tsx
// app/(dashboard)/layout.tsx
export default async function DashboardLayout({ children }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // Prefetch dados comuns (cached)
  const [summary, topCars, topTracks] = await Promise.all([
    getProfileSummary(user.id),
    getTopCars(user.id),
    getTopTracks(user.id),
  ]);

  return (
    <DashboardContext.Provider value={{ summary, topCars, topTracks }}>
      <Sidebar />
      <main>{children}</main>
    </DashboardContext.Provider>
  );
}
```

**Impacto**: Dados comuns carregados 1x, compartilhados entre páginas.

---

### 2.3 React Server Components + Streaming

**Problema**: Página inteira espera todas as queries completarem.

**Solução**: Usar Suspense para streaming progressivo.

```tsx
// Dashboard com streaming
export default async function DashboardPage() {
  return (
    <div>
      {/* Renderiza imediatamente */}
      <Header />

      {/* Streamed quando pronto */}
      <Suspense fallback={<HeroCardSkeleton />}>
        <HeroCard />
      </Suspense>

      <Suspense fallback={<ActivityCalendarSkeleton />}>
        <ActivityCalendar />
      </Suspense>

      <Suspense fallback={<PaceChartSkeleton />}>
        <PaceChart />
      </Suspense>
    </div>
  );
}
```

**Impacto**: Percepção de velocidade muito maior (progressive rendering).

---

## Nível 3: Arquitetura de Longo Prazo (FUTURO)

### 3.1 API centralizada com cache Redis

**Problema**: Cache em memória não persiste entre deploys/instâncias.

**Solução**: Implementar cache handler com Redis/KV.

```ts
// next.config.ts
export default {
  cacheComponents: true,
  cacheHandlers: {
    default: require.resolve('./cache-handler.js'),
  },
};

// cache-handler.js (Vercel KV ou Redis)
module.exports = class CacheHandler {
  async get(key) {
    return await kv.get(key);
  }
  async set(key, data, ctx) {
    await kv.set(key, data, { ex: ctx.revalidate });
  }
};
```

**Impacto**: Cache persistente, compartilhado entre instâncias.

---

### 3.2 Denormalização de dados

**Problema**: Múltiplas queries para dados relacionados.

**Solução**: Tabela `user_stats` atualizada via trigger.

```sql
CREATE TABLE user_stats (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id),
  total_sessions INT DEFAULT 0,
  total_laps INT DEFAULT 0,
  total_distance_km NUMERIC DEFAULT 0,
  unique_cars INT DEFAULT 0,
  unique_tracks INT DEFAULT 0,
  last_session_at TIMESTAMPTZ,
  fastest_lap_ms INT,
  current_streak INT DEFAULT 0,
  best_streak INT DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Atualizado automaticamente via trigger após cada sessão
```

**Impacto**: Dashboard carrega com 1 query em vez de 15.

---

### 3.3 Suporte a App Mobile

**Problema**: App mobile precisará consumir os mesmos dados.

**Solução**: A arquitetura atual com Supabase já suporta isso!

- Supabase tem SDK para React Native, Flutter, Swift, Kotlin
- Mesmas tabelas, mesmo RLS, mesma autenticação
- Opcional: Supabase Edge Functions para lógica customizada

```ts
// React Native
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Mesmas queries funcionam!
const { data } = await supabase
  .from('sessions')
  .select('*')
  .eq('user_id', userId);
```

---

## Métricas para Acompanhar

| Métrica | Antes | Depois Nível 1 | Meta Nível 2 |
|---------|-------|----------------|--------------|
| Dashboard TTFB | ~800ms | ~200ms | <100ms |
| Queries/request | 15 | 15 (cached) | 1-3 |
| Cache hit rate | 0% | ~80% | >95% |
| Navegação entre páginas | ~500ms | ~300ms | <100ms |

---

## Configuração Necessária

### Variáveis de Ambiente

```bash
# Obrigatório para Nível 1
SUPABASE_SERVICE_ROLE_KEY=sua_chave_aqui

# Opcional para Nível 3 (Redis)
KV_REST_API_URL=
KV_REST_API_TOKEN=
```

### Onde encontrar a Service Role Key

1. Acesse o dashboard do Supabase
2. Vá em Settings → API
3. Copie a **service_role key** (secret)
4. Adicione no `.env.local` e na Vercel

---

## Referências

- [Next.js 16 Cache Components](https://nextjs.org/docs/app/getting-started/caching)
- [Supabase Materialized Views](https://supabase.com/docs/guides/database/tables#materialized-views)
- [Vercel KV](https://vercel.com/docs/storage/vercel-kv)
