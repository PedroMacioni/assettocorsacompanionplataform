# Spec: Web Frontend

## Stack

- **Framework:** Next.js 15 (App Router)
- **Auth:** `@supabase/ssr` (server-side auth com cookies)
- **Dados:** `@supabase/supabase-js` (queries diretas ao Supabase via client)
- **UI:** Tailwind CSS + shadcn/ui (componentes acessíveis, sem overhead)
- **Deploy:** Vercel (integração nativa com Next.js)
- **Linguagem:** TypeScript

---

## Estrutura de rotas

```
app/
  (public)/
    page.tsx                  → /           Landing page
    login/page.tsx            → /login      Login
    register/page.tsx         → /register   Cadastro
  (dashboard)/
    layout.tsx                → Layout autenticado (sidebar/nav)
    dashboard/page.tsx        → /dashboard  Visão geral
    sessions/page.tsx         → /sessions   Histórico de sessões
    sessions/[id]/page.tsx    → /sessions/:id  Detalhe de sessão
    personal-bests/page.tsx   → /personal-bests  Personal bests
    settings/page.tsx         → /settings   Configurações
```

Middleware Next.js redireciona `/dashboard/*` para `/login` se não autenticado.

---

## Páginas

### `/` — Landing Page

**Objetivo:** converter visitantes em usuários.

**Conteúdo:**
- Hero: "Seu histórico de Assetto Corsa, em qualquer lugar"
- Screenshot do dashboard
- 3 features: sync automático, histórico completo, personal bests
- CTA: "Criar conta grátis"
- Link para download do agente

---

### `/login` e `/register`

- Form simples (email + senha)
- Auth via Supabase Auth
- Após login → redirect para `/dashboard`
- Futuramente: OAuth Google

---

### `/dashboard` — Visão Geral

**Layout:** 4 cards de summary no topo, depois 2 colunas.

```
┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────┐
│  Sessões   │ │   Voltas   │ │ Distância  │ │  Carros    │
│    247     │ │   3.821    │ │ 14.230 km  │ │    18      │
└────────────┘ └────────────┘ └────────────┘ └────────────┘

┌───────────────────────────┐ ┌───────────────────────────┐
│  Top 5 Carros             │ │  Top 5 Pistas             │
│  (por distância)          │ │  (por sessões)            │
│  ─────────────────────    │ │  ─────────────────────    │
│  Ferrari 458 │ 2.100 km   │ │  Monza     │ 42 sessões  │
│  ...         │ ...        │ │  ...       │ ...         │
└───────────────────────────┘ └───────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│  Sessões recentes (últimas 10)                          │
│  Data       │ Carro         │ Pista  │ Voltas │ Melhor │
│  2025-05-19 │ Ferrari 458   │ Monza  │   12   │ 1:45.3 │
└─────────────────────────────────────────────────────────┘
```

**Dados:** `profile_summary`, `top_cars` (limit 5), `top_tracks` (limit 5), `sessions` (limit 10, order by started_at desc)

---

### `/sessions` — Histórico de Sessões

**Features:**
- Tabela com paginação (50 por página)
- Filtros: carro (select), pista (select), período (date range)
- Ordenação por coluna (data, distância, melhor volta)
- Busca por carro ou pista
- Export CSV (v2)

**Colunas da tabela:**
| Data | Carro | Pista | Tipo | Voltas | Distância | Melhor Volta | Última Volta |

**Dados:** `sessions` com filtros via query string → PostgREST params

---

### `/sessions/:id` — Detalhe de Sessão

**Conteúdo:**
- Info da sessão (carro, pista, data, tipo)
- Stats: voltas, distância, melhor volta, última volta
- Link: "Ver outras sessões nesta pista"
- Link: "Ver outras sessões com este carro"

Em v1 não há detalhe por volta (o CM não exporta tempos individuais de volta por padrão).

---

### `/personal-bests` — Personal Bests

**Layout:**
- Tabela ordenável: Carro | Pista | Melhor Tempo | Data
- Filtros: carro, pista
- Destacar o record geral (menor tempo)

**Dados:** `personal_bests` com joins via nomes (car_id e track_id são slugs, não IDs do banco de assets do AC)

---

### `/settings` — Configurações

**Seções:**

**Perfil:**
- Nome de exibição (editável)
- Email (read-only)

**Agente:**
```
┌────────────────────────────────────────────────────────┐
│  Token de Agente                                       │
│                                                        │
│  Use este token para autenticar o CompanionAgent       │
│  instalado no seu PC.                                  │
│                                                        │
│  [eyJhbGc...  ████████████████████  ] [ Copiar ]      │
│                                       [ Renovar ]      │
│                                                        │
│  ✓ Agente conectado — última sync: 19/05/2025 14:32   │
└────────────────────────────────────────────────────────┘
```

**Download do Agente:**
- Link para download do instalador (GitHub Releases ou CDN)
- Instruções de instalação em 3 passos

**Zona de perigo:**
- Deletar todos os dados de sessões
- Deletar conta

---

## Componentes reutilizáveis

```
components/
  LapTime.tsx         → Formata milissegundos como "m:ss.fff"
  DistanceKm.tsx      → Formata distância com unidade
  SessionRow.tsx      → Linha da tabela de sessões
  StatCard.tsx        → Card de summary (número + label)
  TopCarRow.tsx       → Linha da tabela de top carros
  EmptyState.tsx      → Estado vazio (sem dados / agente não conectado)
  AgentStatus.tsx     → Badge de status do agente (último sync)
```

---

## Estado de "sem dados"

Se o usuário logou mas ainda não instalou o agente:

```
┌─────────────────────────────────────────────────────┐
│                                                     │
│    🏎  Seus dados vão aparecer aqui                 │
│                                                     │
│    Instale o CompanionAgent para sincronizar        │
│    automaticamente seu histórico do Assetto Corsa.  │
│                                                     │
│    [ Baixar CompanionAgent ]                        │
│                                                     │
└─────────────────────────────────────────────────────┘
```

---

## Tipagem TypeScript dos dados

```typescript
// Mapeiam diretamente para as views/tabelas do Supabase
export type ProfileSummary = {
  user_id: string;
  total_sessions: number;
  total_laps: number;
  total_distance_km: number;
  unique_cars: number;
  unique_tracks: number;
  last_session_at: string | null;
  fastest_lap_ms: number | null;
};

export type Session = {
  id: string;
  source_id: string;
  started_at: string;
  driver_name: string | null;
  car_id: string;
  track_id: string;
  session_types: string | null;
  laps: number;
  distance_km: number | null;
  best_lap_ms: number | null;
  last_lap_ms: number | null;
};

export type PersonalBest = {
  id: string;
  car_id: string;
  track_id: string;
  time_ms: number;
  source_date: number | null;
};

export type TopCar = {
  car_id: string;
  sessions: number;
  total_laps: number;
  total_distance_km: number;
  best_lap_ms: number | null;
};

export type TopTrack = {
  track_id: string;
  sessions: number;
  total_laps: number;
  total_distance_km: number;
  best_lap_ms: number | null;
};
```

---

## Checklist de implementação

- [ ] Criar projeto Next.js com TypeScript + Tailwind + shadcn
- [ ] Configurar `@supabase/ssr` com middleware de auth
- [ ] Implementar `/login` e `/register`
- [ ] Implementar layout autenticado com sidebar
- [ ] Implementar `/dashboard` com todos os cards e tabelas
- [ ] Implementar `/sessions` com paginação e filtros
- [ ] Implementar `/personal-bests`
- [ ] Implementar `/settings` com exibição do token de agente
- [ ] Implementar empty state para usuários sem dados
- [ ] Landing page `/`
- [ ] Deploy no Vercel
- [ ] Configurar URL de redirect do Supabase Auth para o domínio de produção
