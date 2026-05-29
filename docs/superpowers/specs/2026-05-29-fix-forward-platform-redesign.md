# Sim Racing Companion Platform - Fix Forward Redesign

**Data:** 2026-05-29
**Status:** Aprovado
**Abordagem:** Fix Forward (refatorar incrementalmente, não reescrever)

## Resumo Executivo

Este documento define a estratégia de estabilização e melhoria da plataforma Sim Racing Companion. O objetivo é transformar o projeto atual em um produto real, mantendo a arquitetura existente e corrigindo problemas conhecidos.

### Objetivos

1. **Estabilizar** - Resolver build errors e bugs do agent
2. **Fundamentar** - Adicionar testes e CI/CD
3. **Evoluir** - Implementar features com qualidade

### Decisões Chave

| Decisão | Escolha | Justificativa |
|---------|---------|---------------|
| Reescrever vs Refatorar | Refatorar | Arquitetura está correta, código tem problemas pontuais |
| Backend | Supabase | Já em uso, escala bem, auth pronto, realtime built-in |
| Frontend | Next.js + React | Stack madura, código existente, performance é questão de práticas |
| Agent | C# Service + Tray | Separação de responsabilidades, service sempre ativo |
| IDs | UUIDs | Padrão Supabase, melhor para sync offline |

---

## 1. Arquitetura

### 1.1 Visão Geral

```
┌─────────────────────────────────────────────────────────────────┐
│                         USUÁRIO                                 │
└─────────────────────────────────────────────────────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        ▼                     ▼                     ▼
┌───────────────┐    ┌───────────────┐    ┌───────────────┐
│   Web App     │    │  Mobile App   │    │  Desktop App  │
│  (Next.js)    │    │   (Futuro)    │    │  Tray (C#)    │
└───────┬───────┘    └───────┬───────┘    └───────┬───────┘
        │                    │                    │
        └────────────────────┼────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                      SUPABASE (Cloud)                           │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐             │
│  │    Auth     │  │  PostgreSQL │  │   Storage   │             │
│  │  (OAuth)    │  │   (Dados)   │  │  (Imagens)  │             │
│  └─────────────┘  └─────────────┘  └─────────────┘             │
│  ┌─────────────┐  ┌─────────────┐                              │
│  │  Realtime   │  │    Edge     │                              │
│  │ (WebSocket) │  │  Functions  │                              │
│  └─────────────┘  └─────────────┘                              │
└─────────────────────────────────────────────────────────────────┘
                             ▲
                             │
┌─────────────────────────────────────────────────────────────────┐
│                    COMPANION AGENT (Local)                      │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐             │
│  │   Service   │  │   Tray UI   │  │  Local API  │             │
│  │  (Windows)  │◄─┤   (Config)  │  │ (127.0.0.1) │             │
│  └──────┬──────┘  └─────────────┘  └──────┬──────┘             │
│         │                                  │                    │
│         ▼                                  ▼                    │
│  ┌─────────────┐                   ┌─────────────┐             │
│  │   Shared    │                   │   Sync      │             │
│  │   Memory    │                   │   Engine    │             │
│  │  (AC/ACC)   │                   │(→ Supabase) │             │
│  └─────────────┘                   └─────────────┘             │
└─────────────────────────────────────────────────────────────────┘
                             ▲
                             │
┌─────────────────────────────────────────────────────────────────┐
│              ASSETTO CORSA / COMPETIZIONE                       │
│         (Shared Memory + JSON History Files)                    │
└─────────────────────────────────────────────────────────────────┘
```

### 1.2 Princípios

1. **Supabase como backend único** - Auth, dados, realtime, storage em um lugar
2. **Agent local faz trabalho pesado** - Lê shared memory, processa, sincroniza
3. **Web app é thin client** - Apenas UI, toda lógica no agent ou Supabase
4. **API local separada** - Web app acessa dados em tempo real via localhost
5. **Mobile-ready** - Arquitetura permite app mobile futuro (mesma API)

---

## 2. Estrutura de Dados

### 2.1 Schema PostgreSQL (Supabase)

```sql
-- ============================================
-- CORE ENTITIES
-- ============================================

-- Perfis de usuário
CREATE TABLE profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id),
    username TEXT UNIQUE NOT NULL,
    avatar_url TEXT,
    preferences JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Sessões de jogo
CREATE TABLE sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id UUID NOT NULL REFERENCES profiles(id),
    track_id TEXT NOT NULL REFERENCES tracks(id),
    car_id TEXT NOT NULL REFERENCES cars(id),
    session_type TEXT NOT NULL CHECK (session_type IN ('practice', 'qualify', 'race')),
    started_at TIMESTAMPTZ NOT NULL,
    ended_at TIMESTAMPTZ,
    weather_conditions JSONB DEFAULT '{}',
    synced_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Voltas individuais
CREATE TABLE laps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    lap_number INT NOT NULL,
    lap_time_ms INT NOT NULL,
    sector_1_ms INT,
    sector_2_ms INT,
    sector_3_ms INT,
    is_valid BOOLEAN DEFAULT true,
    tyre_compound TEXT,
    fuel_used DECIMAL(5,2),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(session_id, lap_number)
);

-- Melhores tempos pessoais
CREATE TABLE personal_bests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id UUID NOT NULL REFERENCES profiles(id),
    track_id TEXT NOT NULL REFERENCES tracks(id),
    car_id TEXT NOT NULL REFERENCES cars(id),
    best_lap_time_ms INT NOT NULL,
    best_sector_1_ms INT,
    best_sector_2_ms INT,
    best_sector_3_ms INT,
    achieved_at TIMESTAMPTZ NOT NULL,
    lap_id UUID REFERENCES laps(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(profile_id, track_id, car_id)
);

-- ============================================
-- REFERENCE DATA
-- ============================================

-- Pistas
CREATE TABLE tracks (
    id TEXT PRIMARY KEY,  -- e.g., "ks_nurburgring"
    name TEXT NOT NULL,
    country TEXT,
    length_meters INT,
    sectors_count INT DEFAULT 3,
    image_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Carros
CREATE TABLE cars (
    id TEXT PRIMARY KEY,  -- e.g., "ks_ferrari_488_gt3"
    name TEXT NOT NULL,
    brand TEXT,
    class TEXT,
    year INT,
    image_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- SOCIAL
-- ============================================

-- Amizades
CREATE TABLE friendships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id),
    friend_id UUID NOT NULL REFERENCES profiles(id),
    status TEXT NOT NULL CHECK (status IN ('pending', 'accepted', 'blocked')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, friend_id),
    CHECK (user_id != friend_id)
);

-- ============================================
-- GARAGE
-- ============================================

-- Carros do usuário
CREATE TABLE user_cars (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id UUID NOT NULL REFERENCES profiles(id),
    car_id TEXT NOT NULL REFERENCES cars(id),
    nickname TEXT,
    livery_url TEXT,
    notes TEXT,
    favorite BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(profile_id, car_id)
);

-- Setups
CREATE TABLE setups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_car_id UUID NOT NULL REFERENCES user_cars(id) ON DELETE CASCADE,
    track_id TEXT REFERENCES tracks(id),
    name TEXT NOT NULL,
    setup_data JSONB NOT NULL,
    is_public BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- INDEXES
-- ============================================

CREATE INDEX idx_sessions_profile ON sessions(profile_id);
CREATE INDEX idx_sessions_track ON sessions(track_id);
CREATE INDEX idx_sessions_car ON sessions(car_id);
CREATE INDEX idx_laps_session ON laps(session_id);
CREATE INDEX idx_personal_bests_profile ON personal_bests(profile_id);
CREATE INDEX idx_friendships_user ON friendships(user_id);
CREATE INDEX idx_friendships_friend ON friendships(friend_id);
CREATE INDEX idx_user_cars_profile ON user_cars(profile_id);

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE laps ENABLE ROW LEVEL SECURITY;
ALTER TABLE personal_bests ENABLE ROW LEVEL SECURITY;
ALTER TABLE friendships ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_cars ENABLE ROW LEVEL SECURITY;
ALTER TABLE setups ENABLE ROW LEVEL SECURITY;

-- Usuário vê apenas seus próprios dados
CREATE POLICY "Users can view own profile" ON profiles
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON profiles
    FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can view own sessions" ON sessions
    FOR ALL USING (auth.uid() = profile_id);

CREATE POLICY "Users can view own laps" ON laps
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM sessions
            WHERE sessions.id = laps.session_id
            AND sessions.profile_id = auth.uid()
        )
    );

CREATE POLICY "Users can view own personal bests" ON personal_bests
    FOR ALL USING (auth.uid() = profile_id);

-- Tracks e cars são públicos (read-only para usuários)
CREATE POLICY "Anyone can view tracks" ON tracks FOR SELECT USING (true);
CREATE POLICY "Anyone can view cars" ON cars FOR SELECT USING (true);
```

### 2.2 Decisões de Dados

| Decisão | Escolha | Justificativa |
|---------|---------|---------------|
| IDs de track/car | Strings | Match com IDs do Assetto Corsa |
| Tempos | Milliseconds (INT) | Precisão sem floating point issues |
| Dados flexíveis | JSONB | Preferences, weather, sectors |
| Segurança | Row Level Security | Usuário só vê seus próprios dados |

---

## 3. Companion Agent (C#)

### 3.1 Estrutura

```
CompanionAgent/
├── CompanionAgent.Service/       # Windows Service (NOVO)
│   ├── Worker.cs                 # Background worker principal
│   ├── TelemetryCollector.cs     # Lê shared memory
│   ├── HistoryWatcher.cs         # FileSystemWatcher com debounce
│   ├── SyncEngine.cs             # Sincroniza com Supabase
│   └── Program.cs                # Service host
│
├── CompanionAgent.Tray/          # Tray app (REFATORAR)
│   ├── TrayIcon.cs               # Ícone na bandeja
│   ├── ConfigWindow.cs           # Janela de configuração
│   └── ServiceController.cs      # Controla o service
│
├── CompanionAgent.Api/           # Local HTTP API (EXISTENTE)
│   ├── Controllers/
│   │   ├── HealthController.cs
│   │   ├── SessionsController.cs
│   │   ├── TelemetryController.cs  # WebSocket para realtime
│   │   └── SyncController.cs
│   └── Program.cs
│
└── Companion.*/                  # Shared libraries (EXISTENTE)
    ├── Domain/                   # Models puros
    ├── Infrastructure/           # I/O, file readers
    └── SharedContracts/          # DTOs
```

### 3.2 Mudanças Necessárias

1. **Separar Service do Tray** - Service roda sempre, Tray é opcional
2. **Debounce no FileSystemWatcher** - 500ms para evitar race conditions
3. **Retry logic no SyncEngine** - Queue de falhas com backoff exponencial
4. **WebSocket para telemetria** - Dados em tempo real para web app
5. **Health checks** - Service reporta status

### 3.3 Fluxo de Sync

```
1. HistoryWatcher detecta mudança em JSON
2. Debounce de 500ms (espera Content Manager terminar)
3. Parser lê novos dados
4. SyncEngine envia para Supabase em batch (50 items)
5. Se falhar, adiciona à retry queue
6. Retry a cada 30s com backoff exponencial (max 5 tentativas)
7. Após 5 falhas, log erro e notifica usuário
```

### 3.4 Bugs Conhecidos a Corrigir

Ref: `docs/sync-spec.md`

| # | Bug | Severidade | Fix |
|---|-----|------------|-----|
| 1 | SyncedSessionIds marca sem voltas | CRÍTICO | Separar `SyncedSessionIds` / `SyncedLapSessionIds` |
| 2 | batchSize = 1 para tracks | CRÍTICO | Aumentar para 50 |
| 3 | FileSystemWatcher sem debounce | ALTO | Adicionar 500ms debounce |
| 4 | Sem retry de voltas | ALTO | Implementar retry queue |
| 5 | Sem timeout global | MÉDIO | Adicionar timeout de 30s |
| 6 | Token refresh sem mutex | MÉDIO | Adicionar lock |

---

## 4. Web App (Next.js)

### 4.1 Estrutura

```
apps/web/
├── app/
│   ├── (auth)/                   # Rotas de autenticação
│   │   ├── login/
│   │   ├── register/
│   │   └── callback/
│   │
│   ├── (dashboard)/              # App principal (autenticado)
│   │   ├── layout.tsx            # Sidebar + header
│   │   ├── page.tsx              # Dashboard home
│   │   ├── garage/
│   │   │   ├── page.tsx          # Lista de carros
│   │   │   └── [carId]/page.tsx  # Detalhe do carro
│   │   ├── sessions/
│   │   │   ├── page.tsx          # Histórico de sessões
│   │   │   └── [sessionId]/      # Detalhe da sessão
│   │   ├── tracks/
│   │   │   ├── page.tsx          # Lista de pistas
│   │   │   └── [trackId]/        # Stats por pista
│   │   ├── friends/
│   │   │   └── page.tsx          # Social
│   │   └── settings/
│   │       └── page.tsx          # Configurações
│   │
│   └── api/                      # API routes (se necessário)
│
├── components/
│   ├── ui/                       # shadcn components
│   ├── charts/                   # Wrappers Recharts
│   ├── layout/                   # Sidebar, Header
│   └── features/                 # Componentes por feature
│       ├── dashboard/
│       ├── garage/
│       ├── sessions/
│       └── friends/
│
├── lib/
│   ├── supabase/
│   │   ├── client.ts             # Browser client
│   │   ├── server.ts             # Server client
│   │   └── middleware.ts         # Auth middleware
│   ├── queries/                  # Server Actions / React Query
│   │   ├── sessions.ts
│   │   ├── laps.ts
│   │   └── profiles.ts
│   ├── hooks/                    # Custom hooks
│   └── utils/                    # Helpers
│
└── types/
    └── database.ts               # Tipos gerados do Supabase
```

### 4.2 Decisões de Frontend

| Decisão | Escolha | Justificativa |
|---------|---------|---------------|
| Rendering | Server Components | Menos JS no client, melhor performance |
| Data fetching | React Query + Server Actions | Cache, retry, optimistic updates |
| UI Components | shadcn/ui | Acessíveis, customizáveis, sem runtime |
| Charts | Recharts | Já em uso, funciona bem |
| Styling | Tailwind CSS | Já em uso, DX excelente |

### 4.3 Performance Fixes

1. **Cache** - `cacheTag()` e `revalidateTag()` para invalidação seletiva
2. **Prefetch** - Dados carregados em hover de links
3. **Skeleton loaders** - Nunca mostrar página em branco
4. **Debounce** - Inputs de busca com 300ms debounce
5. **Suspense boundaries** - Isolar loading states

---

## 5. Testes e CI/CD

### 5.1 Estratégia de Testes

```
Frontend (Next.js)
├── Unit tests (Vitest)
│   └── lib/utils, calculations, formatters
├── Component tests (Testing Library)
│   └── Componentes isolados com mocks
└── E2E tests (Playwright)
    └── Fluxos críticos: login, ver sessão, garage

Backend (C#)
├── Unit tests (xUnit)
│   └── Domain logic, parsers, validators
├── Integration tests
│   └── API endpoints, database queries
└── Service tests
    └── Sync engine, file watcher
```

### 5.2 Cobertura Mínima

| Área | Cobertura | Justificativa |
|------|-----------|---------------|
| Sync engine | 80% | Core do produto |
| Cálculos de tempo | 100% | Bugs aqui são graves |
| Queries/mutations | 60% | Crítico para UX |
| UI components | 40% | Menos crítico inicialmente |

### 5.3 CI/CD Pipeline

```yaml
# .github/workflows/ci.yml
name: CI

on:
  push:
    branches: [main, master]
  pull_request:
    branches: [main, master]

jobs:
  web:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'pnpm'
      - run: pnpm install
      - run: pnpm lint
      - run: pnpm type-check
      - run: pnpm test
      - run: pnpm build

  agent:
    runs-on: windows-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-dotnet@v4
        with:
          dotnet-version: '10.0.x'
      - run: dotnet restore
      - run: dotnet build --no-restore
      - run: dotnet test --no-build

  deploy-preview:
    needs: [web]
    if: github.event_name == 'pull_request'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: amondnet/vercel-action@v25
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}
```

---

## 6. Plano de Execução

### Fase 1: Estabilização

**Objetivo:** Código compilando, agent funcionando, CI rodando

| Task | Descrição | Prioridade |
|------|-----------|------------|
| 1.1 | Resolver 3 build errors do frontend | CRÍTICO |
| 1.2 | Debugar e corrigir agent desktop | CRÍTICO |
| 1.3 | Configurar GitHub Actions (build + lint) | ALTO |
| 1.4 | Adicionar testes para sync engine | ALTO |
| 1.5 | Adicionar testes para cálculos de tempo | ALTO |

**Critério de conclusão:** Build passa, agent abre, CI verde

### Fase 2: Sync Fixes

**Objetivo:** Dados sincronizando corretamente AC → Supabase → Web

| Task | Descrição | Prioridade |
|------|-----------|------------|
| 2.1 | Separar SyncedSessionIds / SyncedLapSessionIds | CRÍTICO |
| 2.2 | Aumentar batchSize de 1 para 50 | CRÍTICO |
| 2.3 | Adicionar debounce no FileSystemWatcher (500ms) | ALTO |
| 2.4 | Implementar retry queue com backoff | ALTO |
| 2.5 | Adicionar timeout global (30s) | MÉDIO |
| 2.6 | Adicionar mutex no token refresh | MÉDIO |
| 2.7 | Testar fluxo completo end-to-end | ALTO |

**Critério de conclusão:** Voltas chegam no Supabase consistentemente

### Fase 3: Features

**Objetivo:** Produto usável com features core

| Task | Descrição | Prioridade |
|------|-----------|------------|
| 3.1 | Implementar Garage redesign (spec existente) | ALTO |
| 3.2 | Melhorar Dashboard performance | ALTO |
| 3.3 | Implementar social features básicas | MÉDIO |
| 3.4 | Adicionar WebSocket para telemetria realtime | MÉDIO |

**Critério de conclusão:** Usuário consegue ver times, garage, amigos

### Fase 4: Polish

**Objetivo:** Produto pronto para beta

| Task | Descrição | Prioridade |
|------|-----------|------------|
| 4.1 | Adicionar E2E tests (Playwright) | ALTO |
| 4.2 | Criar documentação de setup (.env.example) | ALTO |
| 4.3 | Implementar onboarding flow | MÉDIO |
| 4.4 | Performance audit e otimizações | MÉDIO |
| 4.5 | Beta testing com usuários reais | ALTO |

**Critério de conclusão:** Pronto para beta público

---

## 7. Decisões Técnicas

### 7.1 Convenções de Código

**TypeScript:**
- Strict mode sempre
- Prefer `type` over `interface` para consistency
- Nomes de arquivos em kebab-case
- Componentes em PascalCase

**C#:**
- Nullable reference types habilitado
- Async/await para I/O
- Dependency injection via constructor
- Logging estruturado com ILogger

### 7.2 Git Workflow

- `main` é production
- Feature branches: `feat/nome-da-feature`
- Bug fixes: `fix/nome-do-bug`
- PRs requerem review (quando aplicável)
- Commits em inglês, mensagens descritivas

### 7.3 Ambiente de Desenvolvimento

```bash
# Frontend
cd apps/web
pnpm install
pnpm dev

# Agent
cd apps/CompanionAgent
dotnet restore
dotnet run --project CompanionAgent.Api

# Supabase local (opcional)
supabase start
```

---

## 8. Riscos e Mitigações

| Risco | Probabilidade | Impacto | Mitigação |
|-------|--------------|---------|-----------|
| Agent bugs difíceis de debugar | Média | Alto | Logging extensivo, testes |
| Performance web continua ruim | Baixa | Médio | Profiling, Lighthouse audits |
| Sync perde dados | Média | Alto | Retry queue, logs, alertas |
| Supabase limits | Baixa | Médio | Monitorar uso, otimizar queries |

---

## 9. Métricas de Sucesso

| Métrica | Target |
|---------|--------|
| Build time | < 2 min |
| Test coverage (critical paths) | > 60% |
| Lighthouse performance | > 80 |
| Sync success rate | > 99% |
| Time to first meaningful paint | < 2s |

---

## Changelog

- **2026-05-29:** Documento criado e aprovado
