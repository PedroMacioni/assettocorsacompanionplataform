# Spec: UI Redesign — "Apex" Design System

Baseado nos mockups em `C:\Users\pedro\Desktop\assetto design\`. Escopo: o que é implementável com os dados existentes no Supabase.

---

## 1. Princípios do design

O design "Apex" tem identidade clara:

- **Dark-first**: fundo `#0d0d0d` / `#111`, cards em `#1a1a1a`, bordas sutis
- **Tipografia**: headings grandes e bold, labels em uppercase com letter-spacing
- **Accent**: laranja/vermelho (`#e85d26` ou similar) para destaque principal
- **Dados em primeiro lugar**: números grandes, textos auxiliares pequenos e em muted
- **Sem arredondamentos excessivos**: `rounded-md` (8px) nos cards, não `rounded-2xl`

---

## 2. Dependências a adicionar

```bash
npm install recharts
```

Recharts é a escolha certa: funciona bem com React 19, SSR-safe com dynamic import, API simples. Nenhuma outra lib é necessária — Lucide já está instalado para ícones.

---

## 3. Layout: Sidebar

### Mudança principal
Substituir `DashboardNav` (top-bar horizontal) por sidebar vertical fixa de `220px`.

### Estrutura do layout (`(dashboard)/layout.tsx`)
```
┌──────────┬────────────────────────────┐
│          │  <header>  breadcrumb/sync  │
│ Sidebar  │                             │
│  220px   │  <main>  {children}         │
│          │                             │
│  [user]  │                             │
└──────────┴────────────────────────────┘
```

### Items da sidebar (mapeados para rotas existentes)
```
Logo "Apex" + versão
─────────────────────
◇ Dashboard          → /dashboard
≡ Sessions           → /sessions
∿ Analytics          → /analytics      (nova página)
⊟ Garage             → /garage         (nova página)
─────────────────────
⚙ Settings           → /settings
[Avatar] Marco       (user info + logout)
```

### Item ativo
Barra laranja de `2px` na esquerda + texto branco. Itens inativos em `text-muted-foreground`.

---

## 4. Design System: tokens de cor

Adicionar ao `globals.css` (dentro do `:root` dark):

```css
/* Apex palette */
--apex-bg:         #0d0d0f;
--apex-surface:    #161618;
--apex-surface-2:  #1e1e20;
--apex-border:     #2a2a2c;
--apex-accent:     #e8612a;
--apex-accent-dim: #e8612a33;
--apex-muted:      #6b6b72;
--apex-green:      #22c55e;
--apex-red:        #ef4444;
```

---

## 5. Página: Dashboard (`/dashboard`)

### O que construir (com dados existentes)

#### Header
```
WEDNESDAY · 19 MAY
Good evening, {display_name || driver_name}.
                              [LAST SYNC — XX:XX AGO]  [Drive ▶]
```
- Saudação por hora do dia (morning/afternoon/evening)
- "Last sync": buscar `max(synced_at)` de `sessions` (já existe na tabela)
- Botão "Drive" é decorativo (placeholder, sem ação)

#### KPI Cards — 4 cards em linha
| Card | Dado | Query |
|------|------|-------|
| **Laps this week** | `sum(laps)` com `started_at >= início da semana` | `sessions` com filtro de data |
| **Drive time** | Não disponível no banco → **mostrar "Sessions this week"** com `count(*)` | mesma query |
| **Best lap improvement** | Diff entre best_lap da sessão mais recente vs. anterior da mesma pista+carro | Duas queries na mesma pista, só exibir se houver comparável |
| **Streak** | Não existe → **substituir por "Total sessions"** de `profile_summary` | já disponível |

> As cards mantêm o layout visual idêntico ao design — label uppercase pequeno, número grande, sub-label em verde/vermelho quando relevante.

#### Last Session Card
```
Spa-Francorchamps · Porsche 911 GT3 R
14 laps · Hotlap · Dry · 22°C · 2h ago      BEST LAP: 2:17.184
                                                        -0.412s vs prev best
```
- **Sem o gráfico de barras por volta** — o agente não captura tempos individuais
- Substituído por: barra de progresso mostrando "best lap vs. personal best" para o mesmo carro+pista
- Delta calculado: `sessions.best_lap_ms` vs. `personal_bests.time_ms` para o mesmo `car_id + track_id`

#### Driver Rating Card (lado direito do Last Session)
```
Driver Rating                        SR 4.21 · A
  ┌─ Consistency ────────────── 91 ─┐
  │  Racecraft ──────────────── 82  │
  │  (outros items em placeholder)  │
  └─────────────────────────────────┘
```
- **Sem o radar chart** — dados de rating não existem
- Substituir por: **Estatísticas de consistência** calculadas:
  - **Consistency**: percentual de sessões onde best_lap_ms < média geral (calculado no client)
  - **Sessions count** por tipo (Race, Hotlap, Practice) — de `session_types`
  - Layout como lista de progress bars, não radar

#### Pace Evolution Chart (largura total)
```
-1.284s avg across Spa, Monza, Nordschleife     [4W] [12W] [6M] [1Y]
[line chart: best lap time por sessão, últimas N sessões]
```
- **Sim, implementável** — `sessions` tem `best_lap_ms` e `started_at`
- Gráfico de linha com Recharts `<LineChart>`: eixo X = data, eixo Y = best lap ms (formatado como tempo)
- Filtro de período: 4W / 12W / 6M via query string
- **Agrupado por pista**: linha diferente por `track_id` (máx 3 pistas mais frequentes)

#### Online Ranking (lado direito do Pace Evolution)
- **Não implementável** — precisaria de dados de todos os usuários
- **Substituir por**: "Personal Records" card — lista das 5 melhores combinações carro+pista do `personal_bests`

---

## 6. Página: Sessions (`/sessions`)

### Melhorias de UI (dados existentes, apenas visual)
- Sidebar no layout (herdada)
- Tabela com hover state mais rico
- Filtros de carro e pista como `<select>` estilizados (já existem na lógica, só melhorar o visual)
- Melhor tipografia nos lap times (fonte mono highlight)
- Badge colorido por `session_types`: Hotlap → laranja, Race → verde, Practice → cinza

### Sem mudanças estruturais — só UI

---

## 7. Página: Session Detail (`/sessions/[id]`)

### O que construir (dados existentes)
```
← All sessions  ·  Active  ·  19 May 14:22  ·  BIG 2:17.184
Spa-Francorchamps · Porsche 911 GT3 R
14 laps · Hotlap · Dry · 22°C track · Wind 6 km/h NW · Type: Hard clone
                                        -0.412s vs prev best (green/red)
```

**Cards de stats** (mesmo grid 2x2 atual, visual melhorado):
- Laps | Distance | Best lap (hero) | Last lap

**O que NÃO construir:**
- ❌ Tabela com tempos S1/S2/S3 por volta — agente não captura
- ❌ Sector Analysis (Gantt chart) — sem dados
- ❌ Speed trace chart — sem telemetria
- ❌ Tire temps gauge — sem dados

**Adicionar:**
- Link de volta mais claro (breadcrumb)
- "Sessions nesta pista" — mini-tabela com as últimas 5 sessões do mesmo `track_id`
- "Seu PB aqui" — se existir `personal_bests` para o mesmo `car_id + track_id`, mostrar o tempo e o delta

---

## 8. Página: Analytics (`/analytics`) — Nova

### Conteúdo real com dados existentes

#### Header
```
PERFORMANCE · 12-WEEK WINDOW
Driver Analytics
                    [Overview] [Lap pace] [Discipline] [Records]
```

#### Tab: Overview
**Driver DNA card** (lado esquerdo):
- **Sem radar chart** — sem dados de qualidade de pilotagem
- Substituir por: **Composite score** calculado a partir de dados reais:
  - Score = `(total_sessions * 0.3 + unique_tracks * 0.2 + total_laps * 0.5)` normalizado 0-100
  - Label descritivo baseado no score ("Consistent Driver", "Explorer", etc.)
  - 3 badges de estilo (ex: "ACTIVE", "CONSISTENT", "MULTI-TRACK")

**Trajectory card** (centro):
- Gráfico de linha mostrando `count(sessions)` por semana nas últimas 12 semanas
- Recharts `<AreaChart>` — área preenchida, minimalista

**Discipline Mix card** (lado direito):
- Recharts `<PieChart>` com as top categorias por `session_types`
- Race / Hotlap / Practice / Unknown — cores diferentes
- Se `session_types` for nulo em muitos registros, agrupar como "Practice/Free"

#### Tab: Lap pace
- Gráfico de linha: best lap por sessão (mesma ideia do Pace Evolution do dashboard, mas aqui mais detalhado)
- Filtro por carro ou pista

#### Tab: Discipline
- Donut chart + tabela: carros mais usados, tracks mais usados
- Redistribuição das views `top_cars` e `top_tracks` em formato visual

#### Tab: Records
- Personal bests em cards visuais, ordenados por tempo
- Highlight do melhor absoluto

---

## 9. Página: Garage (`/garage`) — Nova

### O que construir com dados existentes

**Estrutura:**
```
FAVORITE · 47 SESSIONS
Porsche 911 GT3 R
2019 · GT3 · ...                    [BEST LAP] [DRIVE TIME] [DISTANCE]
                                     2:17.184     38h 14m     4,218 km
[Car illustration placeholder]

[ Car list sidebar ]    [ Stats do carro selecionado ]
```

**Car list** (coluna esquerda):
- Lista de todos os carros do usuário (de `top_cars`)
- Ordenado por total de sessões
- Item selecionado: destaque com accent

**Car stats** (painel direito — com dados de `top_cars`):
- Best lap (de `personal_bests` para esse car_id)
- Total sessions, total laps, total distance
- Últimas 5 sessões com esse carro (mini-tabela de `sessions`)
- "Tracks com este carro" — lista de pistas onde usou o carro

**Spec sheet** (HP, peso, etc.):
- **Não implementável** sem base de carros estática
- Substituir por: **"Known tracks"** — grid de todas as pistas onde esse carro foi usado + melhor tempo em cada

**Setups:**
- **Não implementável** — agente não captura setups
- Omitir completamente

---

## 10. Componentes novos a criar

```
components/
  layout/
    Sidebar.tsx              — sidebar fixa com navegação
    SidebarItem.tsx          — item individual com active state
    PageHeader.tsx           — header padrão (title + subtitle + actions)
  charts/
    PaceLineChart.tsx        — recharts LineChart para pace evolution
    SessionAreaChart.tsx     — recharts AreaChart para trajectory
    DisciplinePieChart.tsx   — recharts PieChart para discipline mix
  dashboard/
    LastSessionCard.tsx      — card da última sessão com delta PB
    KpiCard.tsx              — substitui StatCard com novo visual
    PersonalRecordsCard.tsx  — lista dos top PBs
  garage/
    CarList.tsx              — lista de carros clicável
    CarStatsPanel.tsx        — painel de stats do carro selecionado
```

**Componentes existentes a atualizar:**
- `StatCard.tsx` → visual upgrade (manter interface, mudar estilo)
- `DashboardNav.tsx` → substituir por `Sidebar.tsx`
- `EmptyState.tsx` → novo visual com accent color

---

## 11. Dados: queries novas necessárias

### Dashboard
```typescript
// Laps/sessions this week
supabase.from("sessions")
  .select("laps")
  .eq("user_id", uid)
  .gte("started_at", startOfWeek)

// Last session with PB comparison
supabase.from("sessions").select("*").eq("user_id", uid)
  .order("started_at", { ascending: false }).limit(1)
// + personal_bests for same car+track

// Pace evolution: last N sessions with date
supabase.from("sessions").select("started_at, best_lap_ms, track_id")
  .eq("user_id", uid).order("started_at", { ascending: true })
  .gte("started_at", cutoffDate)
```

### Analytics
```typescript
// Sessions per week (last 12 weeks)
// → calcular no client agrupando por semana

// Session types distribution
supabase.from("sessions").select("session_types")
  .eq("user_id", uid)
// → contar no client por tipo
```

### Garage
```typescript
// Sessions por carro específico
supabase.from("sessions").select("*")
  .eq("user_id", uid).eq("car_id", selectedCar)
  .order("started_at", { ascending: false }).limit(10)

// PBs por carro
supabase.from("personal_bests").select("*")
  .eq("user_id", uid).eq("car_id", selectedCar)
```

---

## 12. Ordem de implementação

| # | O que | Dificuldade | Impacto |
|---|-------|-------------|---------|
| 1 | Sidebar + layout refactor | Baixa | Alto (afeta tudo) |
| 2 | Design tokens (globals.css dark theme Apex) | Baixa | Alto |
| 3 | KpiCard + PageHeader components | Baixa | Alto |
| 4 | Dashboard page rebuild | Média | Alto |
| 5 | Instalar recharts + PaceLineChart | Média | Alto |
| 6 | Session detail visual upgrade | Baixa | Médio |
| 7 | Sessions list visual upgrade | Baixa | Médio |
| 8 | Analytics page | Média | Médio |
| 9 | Garage page | Média | Médio |

---

## 13. O que NÃO fazer (fora de escopo)

- ❌ Radar chart de Driver DNA — sem dados fonte
- ❌ Online ranking — sistema multi-usuário
- ❌ Sector analysis (S1/S2/S3) — agente não captura
- ❌ Speed trace / telemetria — agente não captura
- ❌ Tire temps — agente não captura
- ❌ Car spec sheet (HP, peso) — sem base de dados de carros
- ❌ Setups — agente não captura
- ❌ Friends / Online tabs — sem sistema social
- ❌ Bar chart por volta na última sessão — sem laps individuais

Essas features ficam para quando o agente evoluir para capturar mais dados.

---

## 14. Resultado esperado

O app final terá:
- Visual fiel ao design Apex (dark, tipografia, accent laranja)
- Sidebar fixa com 5 seções (Dashboard, Sessions, Analytics, Garage, Settings)
- Dashboard rico com charts reais de pace evolution
- Session detail com visual polido e contexto de PB
- Analytics com discipline mix real + trajectory trend
- Garage com navegação por carro e stats completos
- **Nenhum dado fake** — tudo o que aparece vem do Supabase
