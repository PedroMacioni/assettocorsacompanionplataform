# Dashboard Redesign Spec

**Data:** 2026-05-20
**Status:** Aprovado
**Objetivo:** Redesenhar a dashboard para melhorar engajamento, reduzir densidade visual e criar hierarquia clara de informação.

---

## Problemas Identificados

1. **Falta de engajamento/gamificação** - Não há streaks, scores ou incentivos para retorno
2. **Densidade excessiva** - Muita informação compactada, difícil escanear
3. **Falta de foco** - Usuário não sabe para onde olhar primeiro
4. **Ausência de feedback de sessão** - Não classifica qualidade das sessões

---

## Solução: Hero-Focused Dashboard

Layout com hero card dominante no topo, seguido de seções bem espaçadas com hierarquia visual clara.

---

## Arquitetura de Componentes

```
app/(dashboard)/dashboard/
├── page.tsx                    # Server component (data fetching)
└── components/
    ├── HeroCard.tsx            # NEW: Weekly digest + streak + consistency
    ├── ActivityCalendar.tsx    # NEW: GitHub-style activity grid
    ├── LastSessionCard.tsx     # REFACTOR: Add quality badges
    ├── PaceEvolutionCard.tsx   # REFACTOR: More compact
    ├── TopRecordsCard.tsx      # REFACTOR: Better spacing
    ├── QuickStatsBar.tsx       # NEW: Lifetime stats bar
    └── QuickNavCards.tsx       # NEW: Navigation shortcuts
```

---

## Seção 1: Hero Card

### Layout
```
┌─────────────────────────────────────────────────────────────────────────┐
│   ┌─────────────────┐   ┌─────────────────┐   ┌─────────────────────┐   │
│   │  STREAK         │   │  CONSISTENCY    │   │  ESTA SEMANA        │   │
│   │      5 dias     │   │      87/100     │   │  23 voltas          │   │
│   │  Recorde: 12    │   │  ████████░░     │   │  4 sessões, 2 PBs   │   │
│   └─────────────────┘   └─────────────────┘   └─────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
```

### Componente: HeroCard.tsx

**Props:**
```typescript
interface HeroCardProps {
  streak: {
    current: number;
    record: number;
  };
  consistency: {
    score: number;        // 0-100
    trend: 'up' | 'down' | 'stable';
  };
  weeklyDigest: {
    laps: number;
    sessions: number;
    pbsBeaten: number;
    deltaVsLastWeek: number;  // percentual
  };
}
```

### Cálculos Necessários

**Streak:**
- Query sessões ordenadas por data DESC
- Contar dias consecutivos com pelo menos 1 sessão
- Streak record: MAX histórico (pode ser campo em `profiles` ou calculado)

**Consistency Score (0-100):**
```typescript
// Baseado no desvio padrão das últimas 20 voltas
const times = last20Laps.map(l => l.time_ms);
const mean = times.reduce((a, b) => a + b, 0) / times.length;
const variance = times.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / times.length;
const stdDev = Math.sqrt(variance);

// Normalizar para 0-100 (menor desvio = maior score)
// stdDev de 0ms = 100, stdDev de 5000ms+ = 0
const score = Math.max(0, Math.min(100, 100 - (stdDev / 50)));
```

**Weekly Digest:**
- Sessões da semana atual (domingo a hoje)
- Comparar com semana anterior para delta

### Estilos

- Background: `#161618`
- Border: 1px `#2a2a2c`
- Border-radius: 12px
- Padding: 24px
- Gap entre blocos: 24px
- Números grandes: 48px, font-weight 700
- Labels: 14px, color `#6b6b72`
- Consistency bar: height 8px, border-radius 4px

### Cores do Consistency Score
| Range | Cor | Label |
|-------|-----|-------|
| 0-59 | `#ef4444` (red) | Inconsistente |
| 60-79 | `#fbbf24` (yellow) | Moderado |
| 80-100 | `#22c55e` (green) | Consistente |

---

## Seção 2: Activity Calendar + Última Sessão

### Layout
```
┌─────────────────────────────────────────────┐  ┌──────────────────────────────┐
│  ATIVIDADE (90 dias)                        │  │  ÚLTIMA SESSÃO               │
│  [GitHub-style grid]                        │  │  Track + Car                 │
│                                             │  │  🏆 PB SESSION               │
│  Total: 47 dias ativos                      │  │  1:48.234 (-0.847s)          │
└─────────────────────────────────────────────┘  └──────────────────────────────┘
```

### Componente: ActivityCalendar.tsx

**Props:**
```typescript
interface ActivityCalendarProps {
  sessions: Array<{
    date: string;      // YYYY-MM-DD
    count: number;     // sessões naquele dia
  }>;
  daysToShow?: number; // default 90
}
```

**Renderização:**
- Grid de 7 linhas (dias da semana) x N colunas (semanas)
- Cada célula: 12x12px com 2px gap
- Tooltip no hover: "{count} sessões em {date}"

**Cores de intensidade:**
```typescript
const getColor = (count: number): string => {
  if (count === 0) return '#1e1e20';
  if (count <= 2) return '#e8612a40';  // 25% opacity
  if (count <= 4) return '#e8612a80';  // 50% opacity
  return '#e8612a';                     // 100%
};
```

### Componente: LastSessionCard.tsx (refactor)

**Props:**
```typescript
interface LastSessionCardProps {
  session: {
    id: string;
    track_id: string;
    car_id: string;
    best_lap_ms: number;
    laps: number;
    started_at: string;
    session_types: string;
  };
  qualityBadge: SessionQualityBadge;
  pbDelta?: number;  // ms, negativo = melhorou
}

type SessionQualityBadge =
  | { type: 'pb'; label: 'PB SESSION' }
  | { type: 'improving'; label: 'IMPROVING' }
  | { type: 'consistent'; label: 'CONSISTENT' }
  | { type: 'warmup'; label: 'WARM-UP' };
```

**Lógica de Badge:**
```typescript
function getSessionBadge(session, previousBest, sessionAvg, prevSessionAvg): SessionQualityBadge {
  // Prioridade: PB > Improving > Consistent > Warm-up
  if (session.best_lap_ms < previousBest) {
    return { type: 'pb', label: 'PB SESSION' };
  }
  if (sessionAvg < prevSessionAvg) {
    return { type: 'improving', label: 'IMPROVING' };
  }
  if (session.laps >= 5 && stdDev < 1000) {
    return { type: 'consistent', label: 'CONSISTENT' };
  }
  return { type: 'warmup', label: 'WARM-UP' };
}
```

**Cores dos Badges:**
| Type | Background | Text |
|------|------------|------|
| pb | `#fbbf2420` | `#fbbf24` |
| improving | `#22c55e20` | `#22c55e` |
| consistent | `#3b82f620` | `#3b82f6` |
| warmup | `#6b6b7220` | `#6b6b72` |

---

## Seção 3: Pace Evolution + Top Records

### Layout
```
┌────────────────────────────────────────────────────────┐  ┌─────────────────────────┐
│  EVOLUÇÃO DE PACE (4 semanas)                          │  │  TOP RECORDS            │
│  [Line chart - top 3 tracks]                           │  │  1. 1:48.234 ★          │
│                                                        │  │  2. 1:52.891            │
│  ── Monza  ── Spa  ── Nürburgring      [Ver análise]  │  │  3. 2:01.445            │
└────────────────────────────────────────────────────────┘  └─────────────────────────┘
```

### Componente: PaceEvolutionCard.tsx (refactor)

**Mudanças:**
- Altura reduzida: 200px (era ~300px)
- Legenda inline no footer do card
- Link "Ver análise →" alinhado à direita
- Animação de entrada: fade-in + line draw

**Props:** Mantém as mesmas, ajusta apenas visual.

### Componente: TopRecordsCard.tsx (refactor)

**Mudanças:**
- Espaçamento vertical aumentado (py-3 por item)
- Número de posição com círculo de fundo
- Item #1 com badge "★ FASTEST" em laranja
- Hover highlight no item inteiro

---

## Seção 4: Quick Stats + Navigation

### Layout
```
┌─────────────────────────────────────────────────────────────────────────────┐
│   🛣️ 12 pistas     🚗 8 carros     📏 4,231 km     🏁 2,847 voltas         │
└─────────────────────────────────────────────────────────────────────────────┘

┌───────────────────┐  ┌───────────────────┐  ┌───────────────────┐
│  → Sessões        │  │  → Garagem        │  │  → Configurações  │
└───────────────────┘  └───────────────────┘  └───────────────────┘
```

### Componente: QuickStatsBar.tsx

**Props:**
```typescript
interface QuickStatsBarProps {
  tracks: number;
  cars: number;
  distanceKm: number;
  laps: number;
}
```

**Estilo:**
- Flex row, justify-between
- Background: `#161618`
- Separadores verticais: 1px `#2a2a2c`
- Números: 24px semi-bold
- Labels: 12px muted

### Componente: QuickNavCards.tsx

**Props:** Nenhuma (links estáticos)

**Cards:**
```typescript
const navItems = [
  { href: '/sessions', icon: ClipboardList, title: 'Sessões', subtitle: 'Ver histórico completo' },
  { href: '/garage', icon: Car, title: 'Garagem', subtitle: 'Seus carros favoritos' },
  { href: '/settings', icon: Settings, title: 'Configurações', subtitle: 'Agent & perfil' },
];
```

**Interação:**
- Hover: border `#e8612a`, translateY -2px
- Transition: 150ms ease-out

---

## Queries Necessárias

### Nova query: Streak
```sql
-- Dias consecutivos com sessões (incluindo hoje)
WITH daily_sessions AS (
  SELECT DISTINCT DATE(started_at) as session_date
  FROM sessions
  WHERE user_id = $1
  ORDER BY session_date DESC
),
streak_calc AS (
  SELECT
    session_date,
    session_date - (ROW_NUMBER() OVER (ORDER BY session_date DESC))::int AS grp
  FROM daily_sessions
)
SELECT COUNT(*) as streak
FROM streak_calc
WHERE grp = (SELECT grp FROM streak_calc WHERE session_date = CURRENT_DATE);
```

### Nova query: Activity Calendar
```sql
SELECT
  DATE(started_at) as date,
  COUNT(*) as count
FROM sessions
WHERE user_id = $1
  AND started_at >= NOW() - INTERVAL '90 days'
GROUP BY DATE(started_at)
ORDER BY date;
```

### Nova query: Consistency Score
```sql
SELECT best_lap_ms
FROM sessions
WHERE user_id = $1
  AND best_lap_ms IS NOT NULL
ORDER BY started_at DESC
LIMIT 20;
```

### Query existente: Weekly Stats
```sql
-- Já existe, apenas garantir que inclui semana anterior para delta
SELECT
  COUNT(*) as sessions,
  SUM(laps) as laps,
  -- PBs batidos requer join com personal_bests
FROM sessions
WHERE user_id = $1
  AND started_at >= DATE_TRUNC('week', NOW());
```

---

## Ajustes Visuais Globais

### Tipografia
| Elemento | Tamanho | Peso | Cor |
|----------|---------|------|-----|
| Hero numbers | 48px | 700 | `#ffffff` |
| Card titles | 14px | 600 | `#6b6b72` |
| Main values | 32px | 700 | `#ffffff` |
| Secondary values | 24px | 600 | `#ffffff` |
| Labels | 14px | 400 | `#6b6b72` |
| Small text | 12px | 400 | `#6b6b72` |

### Espaçamento
| Elemento | Valor |
|----------|-------|
| Page padding | 32px |
| Card padding | 24px |
| Card gap | 24px |
| Section gap | 32px |
| Item spacing (lists) | 16px |

### Transições
```css
.card-hover {
  transition: transform 150ms ease-out,
              border-color 150ms ease-out,
              box-shadow 150ms ease-out;
}
.card-hover:hover {
  transform: translateY(-2px);
  border-color: #e8612a;
  box-shadow: 0 4px 12px rgba(232, 97, 42, 0.15);
}
```

---

## Estrutura de Arquivos

```
apps/web/
├── app/(dashboard)/dashboard/
│   ├── page.tsx                    # MODIFY: New layout + queries
│   └── loading.tsx                 # MODIFY: New skeleton structure
├── components/dashboard/
│   ├── HeroCard.tsx                # CREATE
│   ├── ActivityCalendar.tsx        # CREATE
│   ├── LastSessionCard.tsx         # CREATE (extract from page)
│   ├── PaceEvolutionCard.tsx       # CREATE (extract + refactor)
│   ├── TopRecordsCard.tsx          # CREATE (extract + refactor)
│   ├── QuickStatsBar.tsx           # CREATE
│   ├── QuickNavCards.tsx           # CREATE
│   ├── SessionQualityBadge.tsx     # CREATE
│   └── KpiCard.tsx                 # KEEP (may be unused after)
├── lib/
│   └── calculations/
│       ├── streak.ts               # CREATE: Streak calculation
│       ├── consistency.ts          # CREATE: Consistency score
│       └── session-quality.ts      # CREATE: Badge logic
```

---

## Fora de Escopo

- Telemetria/mapas de pista (v2)
- Comparação com outros usuários (v3)
- Notificações push
- Weekly digest por email
- Internacionalização (i18n)

---

## Critérios de Sucesso

1. Hero card renderiza com dados reais de streak, consistency e weekly digest
2. Activity calendar mostra 90 dias com cores de intensidade corretas
3. Última sessão exibe quality badge apropriado
4. Layout responsivo funciona em desktop (1200px+)
5. Todas as transições de hover funcionam suavemente
6. Tempo de carregamento < 2s (queries paralelas)
