# Dashboard Redesign — Spec v1.0

> **Contexto:** A dashboard atual usa componentes inline simples e ignora 6 componentes já construídos em `components/dashboard/`. O redesign prioriza hierarquia de informação, métricas acionáveis e CTAs claros. Não é só visual — cada seção tem funcionalidade e botões de acesso.

---

## Requisitos Transversais (valem para TODAS as fases)

### i18n — `next-intl` v4.12.0

**Estado atual:** biblioteca instalada, `next.config.ts` configurado, `i18n/request.ts` configurado — mas `messages/pt-BR.json` **não existe** e nenhum componente usa `useTranslations`. Todos os textos estão hardcoded.

**Regra:** nenhum texto literal em JSX. Todo string visível ao usuário passa por `t("chave")`.

```tsx
// Server component
import { getTranslations } from "next-intl/server";
const t = await getTranslations("Dashboard");

// Client component
import { useTranslations } from "next-intl";
const t = useTranslations("Dashboard");
```

**Estrutura do arquivo `messages/pt-BR.json`** (criar na Fase 1):
```json
{
  "Common": {
    "loading": "Carregando...",
    "viewAll": "Ver todos",
    "fullView": "Análise completa",
    "openSession": "Abrir sessão",
    "sessions": "sessões",
    "laps": "voltas",
    "days": "dias",
    "day": "dia"
  },
  "Header": {
    "goodMorning": "Bom dia",
    "goodAfternoon": "Boa tarde",
    "goodEvening": "Boa noite",
    "agentOnline": "Agente online",
    "agentOffline": "Agente não visto",
    "lastSync": "Último sync {time}",
    "syncNow": "Sincronizar agora",
    "syncing": "Sincronizando..."
  },
  "HeroCard": {
    "streak": "Streak",
    "streakRecord": "Recorde: {record}",
    "consistency": "Consistência",
    "thisWeek": "Esta Semana",
    "pbsBeaten": "{count} PB batido",
    "pbsBeaten_plural": "{count} PBs batidos",
    "vsLastWeek": "{delta}% vs semana anterior",
    "viewWeekSessions": "Ver sessões desta semana"
  },
  "LastSession": {
    "title": "Última Sessão",
    "lapsCount": "{count} volta",
    "lapsCount_plural": "{count} voltas",
    "noPbYet": "Sem PB anterior",
    "badge": {
      "pb": "Novo PB",
      "improving": "Evoluindo",
      "consistent": "Consistente",
      "warmup": "Aquecimento"
    }
  },
  "ActivityCalendar": {
    "title": "Atividade",
    "tooltip": "{count} sessão em {date}",
    "tooltip_plural": "{count} sessões em {date}"
  },
  "QuickStats": {
    "tracks": "Pistas",
    "cars": "Carros",
    "distance": "km rodados",
    "totalLaps": "Voltas"
  },
  "PaceChart": {
    "title": "Evolução de Pace",
    "subtitle": "Últimas 8 semanas",
    "noData": "Sem dados suficientes",
    "noDataHint": "Sincronize pelo menos 2 sessões em uma pista para ver o gráfico."
  },
  "PersonalRecords": {
    "title": "Recordes Pessoais",
    "achievedAt": "em {date}"
  },
  "QuickNav": {
    "sessions": "Sessões",
    "sessionsSubtitle": "Ver histórico completo",
    "analytics": "Analytics",
    "analyticsSubtitle": "Análise de pace e recordes",
    "garage": "Garagem",
    "garageSubtitle": "Seus carros favoritos",
    "settings": "Configurações",
    "settingsSubtitle": "Agente & perfil"
  }
}
```

**Locales futuros:** quando `en-US` for adicionado, basta criar `messages/en-US.json` com as mesmas chaves e atualizar `i18n/request.ts` para ler o locale da sessão/cookie.

---

### Responsividade — Mobile First

**Breakpoints do Tailwind usados no projeto:**
- `sm`: 640px (telefone grande / landscape)
- `md`: 768px (tablet)
- `lg`: 1024px (laptop)
- `xl`: 1280px (desktop padrão)

**Regra geral:** escrever mobile primeiro, adicionar breakpoints maiores. Nunca esconder informação essencial em mobile — reorganizar layout.

**Decisões por seção:**

| Seção | Mobile (< 768px) | Tablet (768–1023px) | Desktop (1024px+) |
|---|---|---|---|
| Header | Stack vertical: saudação em cima, sync embaixo | Row: saudação à esq, sync à dir | Row igual ao tablet |
| Hero Card | Stack: 1 coluna (streak → consistency → weekly) | 3 colunas iguais | 3 colunas iguais |
| Last Session + Calendar | Stack: Last Session em cima, Calendar embaixo | 2 colunas iguais | 2 colunas iguais |
| Quick Stats Bar | Grid 2×2 | Row horizontal | Row horizontal |
| Pace Chart + Records | Stack: Chart em cima, Records embaixo | Stack igual | Chart 2/3 + Records 1/3 |
| Quick Nav Cards | Grid 2×2 (analytics+sessions / garage+settings) | Grid 2×2 | Grid 4 colunas |

**Activity Calendar em mobile:** reduzir `daysToShow` para 30 em `< sm` — 90 dias não cabe sem scroll horizontal. Usar CSS `overflow-x: auto` com scroll suave se mantiver 90 dias.

**Fonte mono (JetBrains Mono):** verificar se carrega bem em mobile — tempos de volta devem permanecer legíveis em `text-sm` no mínimo.

---

## Problemas a resolver

| Problema | Causa | Impacto |
|---|---|---|
| KPIs "Laps this week" / "Sessions this week" | Volume sem contexto de qualidade | Piloto não sabe se melhorou |
| Nenhum Consistency Score | Componente existe, não está conectado | Métrica mais útil para evolução ausente |
| Nenhum streak / gamificação | HeroCard construído mas não usado | Zero engajamento para amadores |
| Activity Calendar ausente | Componente construído mas não integrado | Sem visão de hábito de treino |
| Zero CTAs funcionais | Só links de texto ("Full view →") | Dashboard parece read-only |
| Greeter em inglês | `getGreeting()` retorna "Good morning" | Inconsistência com resto do app |
| Ícones "i" e "x" ruins | A identificar na investigação | UX quebrada |
| Textos hardcoded | Zero uso de `useTranslations` | i18n inviável sem reescrita total |
| Layout não responsivo | Grids fixos sem breakpoints mobile | Dashboard quebra em tablet/mobile |

---

## Usuários-alvo e prioridades

### Piloto Amador
- Quer saber se está progredindo (PB batido? consistência melhorou?)
- Precisa de engajamento para manter o hábito (streak, weekly digest)
- Quer navegação clara para explorar sessões e garagem
- Não quer dados brutos — quer interpretação ("Consistente", "Em evolução")

### Piloto Profissional / Sério
- Quer Consistency Score com trend (subiu ou caiu vs semana passada)
- Quer Pace Evolution por circuito específico
- Quer acesso rápido a analytics completo
- Precisa ver delta vs PB absoluto, não só vs semana

---

## Layout Proposto

```
┌─────────────────────────────────────────────────────────────┐
│ HEADER: Saudação + Status do Agente + Botão Sincronizar     │
├─────────────────────────────────────────────────────────────┤
│ [1] HERO CARD (largura total)                               │
│     Streak | Consistency Score | Weekly Digest              │
│     CTA: "Ir para Sessões" →                               │
├────────────────────────┬────────────────────────────────────┤
│ [2] LAST SESSION CARD  │ [3] ACTIVITY CALENDAR              │
│     (1/2 largura)      │     (1/2 largura)                  │
│     CTA: "Ver sessão"  │     90 dias de hábito              │
├────────────────────────┴────────────────────────────────────┤
│ [4] QUICK STATS BAR (largura total)                         │
│     Pistas | Carros | Distância | Voltas totais             │
├────────────────────────────┬────────────────────────────────┤
│ [5] PACE EVOLUTION CHART   │ [6] PERSONAL RECORDS           │
│     (2/3 largura)          │     (1/3 largura)              │
│     CTA: "Análise completa"│     CTA: "Ver todos"           │
├────────────────────────────┴────────────────────────────────┤
│ [7] QUICK NAV CARDS (largura total)                         │
│     Sessões | Garagem | Analytics | Configurações           │
└─────────────────────────────────────────────────────────────┘
```

---

## Seções em Detalhe

---

### HEADER

**Arquivo atual:** `page.tsx` linhas 142–189

**O que muda:**
- Saudação em português: "Bom dia", "Boa tarde", "Boa noite" + nome do piloto
- Status do agente: manter lógica atual, ajustar ícone de status (trocar ponto genérico por ícone `Wifi` / `WifiOff` do Lucide)
- Botão "Sincronizar agora" → manter com estados atuais (idle / solicitando / erro)

**Dados necessários:**
- `profile.full_name` ou `user.email`
- `agentStatus: AgentStatus`

**Ação:**
- `SyncButton` → já existe em `components/dashboard/SyncButton.tsx`

---

### [1] HERO CARD

**Componente:** `components/dashboard/HeroCard.tsx` ✅ (já construído, não usado)

**O que exibe:**

| Bloco | Dado | Interpretação |
|---|---|---|
| **Streak** | Dias consecutivos com sessão | Chama ação. Flame animado se > 0 |
| **Consistency Score** | 0–100 (desvio padrão normalizado) | Vermelho <60 / Amarelo 60-79 / Verde 80+ |
| **Weekly Digest** | Voltas + sessões + PBs batidos esta semana | Delta % vs semana anterior |

**CTAs:**
- Link "Ver sessões desta semana →" → `/sessions?filter=this_week`
- Se `pbsBeaten > 0`: badge/link "🏆 Ver PBs →" → `/analytics?tab=records`

**Dados necessários (novo — precisam ser calculados no server):**
```typescript
streak: { current: number; record: number }
consistency: { score: number; trend: "up" | "down" | "stable" }
weeklyDigest: {
  laps: number;
  sessions: number;
  pbsBeaten: number;
  deltaVsLastWeek: number; // %
}
```

**Query necessária:**
- Streak: contar dias consecutivos com pelo menos 1 sessão até hoje
- Consistency Score: desvio padrão das últimas 20 voltas, normalizado (0–100)
- Weekly digest: sessões entre `startOf(week)` e agora + mesma janela semana anterior

---

### [2] LAST SESSION CARD

**Componente:** `components/dashboard/LastSessionCard.tsx` ✅ (já construído, não usado)

**O que exibe:**
- Pista + Carro (nome legível, não slug)
- Tipo de sessão (Treino Livre, Corrida, etc.)
- Best lap em `MM:SS.CSC` (fonte mono)
- Delta vs PB absoluto do piloto naquela combinação pista+carro
- Session Quality Badge: `PB` / `Evoluindo` / `Consistente` / `Aquecimento`
- "X min atrás" ou data formatada em pt-BR

**CTAs:**
- Botão "Abrir sessão" → `/sessions/[id]`
- Link "Ver todas as sessões →" → `/sessions`

**Dados necessários:**
```typescript
session: {
  id: string;
  track_id: string; track_name: string;
  car_id: string; car_name: string;
  session_type: string;
  laps_count: number;
  best_lap_ms: number;
  started_at: string;
}
pbDeltaMs: number | null        // best_lap_ms - personal_best_ms para esse combo
qualityBadge: "pb" | "improving" | "consistent" | "warmup"
```

**Lógica do badge:**
- `pb`: `pbDeltaMs < 0` (bateu o PB)
- `improving`: `pbDeltaMs` entre 0 e 500ms
- `consistent`: desvio padrão das voltas baixo mas sem PB
- `warmup`: poucas voltas (< 5) ou delta alto

---

### [3] ACTIVITY CALENDAR

**Componente:** `components/dashboard/ActivityCalendar.tsx` ✅ (já construído, não usado)

**O que exibe:**
- Grade de 90 dias estilo GitHub contribution graph
- Cor por intensidade: sem sessão → escuro; 1-2 sessões → laranja claro; 3-4 → médio; 5+ → laranja pleno
- Tooltip ao hover: data + "X sessões"

**CTAs:**
- Nenhum CTA — é informativo/motivacional
- Opcional: clicar num dia → `/sessions?date=YYYY-MM-DD`

**Dados necessários:**
```typescript
activityData: Array<{ date: string; count: number }> // últimos 90 dias
```

---

### [4] QUICK STATS BAR

**Componente:** `components/dashboard/QuickStatsBar.tsx` ✅ (já construído, não usado)

**O que exibe (inline, horizontal):**

| Ícone | Dado | Label |
|---|---|---|
| `MapPin` | Total de pistas únicas | Pistas |
| `Car` | Total de carros únicos | Carros |
| `Ruler` | Distância total em km | km rodados |
| `Flag` | Total de voltas | Voltas |

**CTAs:**
- "Pistas" → `/tracks`
- "Carros" → `/garage`
- Sem CTA nos demais (só informativos)

**Dados necessários:** já disponíveis no `ProfileSummary` atual

---

### [5] PACE EVOLUTION CHART

**Componente:** `components/charts/PaceChartClient.tsx` + `PaceLineChart.tsx` ✅

**O que exibe:**
- Line chart: melhores tempos por semana, últimas 4–8 semanas
- Top 3 pistas mais usadas
- Eixo Y invertido (menor = melhor = topo)
- Eixo X: semanas (não datas individuais — agrupa por semana)
- Legenda inline com nome da pista + cor

**Melhorias necessárias:**
- Altura atual (200px) é pequena demais — aumentar para 280px
- Adicionar estado vazio elegante quando há < 2 sessões
- Tooltip deve mostrar nome da pista + tempo + data da sessão

**CTAs:**
- Botão "Análise completa" → `/analytics?tab=pace` (substituir link de texto atual por botão com ícone `ExternalLink`)
- Seletor de pista (dropdown simples) para filtrar o gráfico

---

### [6] PERSONAL RECORDS

**Componente:** `components/dashboard/TopRecordsCard.tsx` ✅ (já construído, não usado)

**O que exibe:**
- Top 5 tempos pessoais por combo pista+carro
- Formato: `[Pista] · [Carro]` + tempo em mono + data do PB
- Primeiro lugar com destaque em `#e8612a`
- Ícone `Star` no top 1

**CTAs:**
- Botão "Ver todos os recordes →" → `/analytics?tab=records`
- Cada record clicável → `/sessions?track=[id]&car=[id]`

**Dados necessários:**
```typescript
records: Array<{
  track_name: string;
  car_name: string;
  best_lap_ms: number;
  achieved_at: string;
  session_id: string;
}>
```

---

### [7] QUICK NAV CARDS

**Componente:** `components/dashboard/QuickNavCards.tsx` ✅ (já construído, não usado)

**O que exibe:**
- 4 cards clicáveis (atualmente são 3 — adicionar Analytics)

| Ícone | Destino | Subtítulo |
|---|---|---|
| `ClipboardList` | `/sessions` | "Ver histórico completo" |
| `TrendingUp` | `/analytics` | "Análise de pace e recordes" |
| `Car` | `/garage` | "Seus carros favoritos" |
| `Settings` | `/settings` | "Agente & perfil" |

**Nota:** Mover `QuickNavCards` para o final da página — funciona como footer de navegação.

---

## Plano de Desenvolvimento (Fases)

### Fase 1 — Fundação (sem novas queries)
**Objetivo:** Integrar componentes já construídos, corrigir UX básica, estabelecer i18n e responsividade

#### 1a — i18n (pré-requisito de tudo)
- [ ] 1.1 Criar `messages/pt-BR.json` com todas as chaves definidas na spec acima
- [ ] 1.2 Configurar `NextIntlClientProvider` no layout raiz (`app/layout.tsx`) para client components
- [ ] 1.3 Migrar `dashboard/page.tsx`: trocar todos os textos hardcoded por `getTranslations`
- [ ] 1.4 Migrar `HeroCard.tsx`, `LastSessionCard.tsx`, `ActivityCalendar.tsx`, `QuickNavCards.tsx`, `QuickStatsBar.tsx`, `TopRecordsCard.tsx` para `useTranslations`
- [ ] 1.5 Migrar `SyncButton.tsx` e `Sidebar.tsx`

#### 1b — Layout e responsividade (em paralelo com i18n)
- [ ] 1.6 Reescrever estrutura do `page.tsx` com novo layout (ver wireframe acima) usando breakpoints mobile-first
- [ ] 1.7 Hero Card: `grid-cols-1 md:grid-cols-3`
- [ ] 1.8 Last Session + Calendar: `grid-cols-1 md:grid-cols-2`
- [ ] 1.9 Quick Stats Bar: `grid grid-cols-2 md:grid-cols-4`
- [ ] 1.10 Pace Chart + Records: `grid-cols-1 xl:grid-cols-3` (chart `xl:col-span-2`)
- [ ] 1.11 Quick Nav Cards: `grid-cols-2 xl:grid-cols-4`
- [ ] 1.12 Activity Calendar: `daysToShow={90}` em ≥ md, `daysToShow={30}` em mobile via prop

#### 1c — Integração de componentes prontos
- [ ] 1.13 Integrar `QuickNavCards` no final da page (adicionar Analytics como 4º card)
- [ ] 1.14 Integrar `QuickStatsBar` (dados já disponíveis no `ProfileSummary`)
- [ ] 1.15 Corrigir greeter (já coberto pelo i18n — usar chaves `Header.goodMorning` etc.)
- [ ] 1.16 Investigar e corrigir ícones "i" e "x" ruins
- [ ] 1.17 Aumentar height do PaceLineChart de 200px → 280px
- [ ] 1.18 Substituir links de texto por botões com ícone (`ExternalLink`)

**Estimativa:** 1,5–2 dias

---

### Fase 2 — Dados (novas queries Supabase)
**Objetivo:** Calcular e exibir métricas reais

- [ ] 2.1 Query de **streak**: dias consecutivos com sessão
- [ ] 2.2 Query de **Consistency Score**: desvio padrão das últimas 20 voltas
- [ ] 2.3 Query de **weekly delta**: voltas/sessões desta semana vs semana anterior
- [ ] 2.4 Query de **pbsBeaten**: PBs batidos esta semana
- [ ] 2.5 Query de **Activity Calendar**: contagem de sessões por dia nos últimos 90 dias
- [ ] 2.6 Lógica de **Session Quality Badge** no servidor
- [ ] 2.7 Conectar `HeroCard` com dados reais (streak + consistency + weeklyDigest)
- [ ] 2.8 Integrar `ActivityCalendar` com dados reais
- [ ] 2.9 Integrar `LastSessionCard` (componente pronto) com dados + badge

**Estimativa:** 2–3 dias

---

### Fase 3 — Interatividade
**Objetivo:** CTAs funcionais e filtros básicos

- [ ] 3.1 Seletor de pista no Pace Chart (dropdown, client-side)
- [ ] 3.2 Activity Calendar clicável → filtra sessões por data
- [ ] 3.3 Records linkam para sessão específica (`/sessions/[id]`)
- [ ] 3.4 Filtro "esta semana" no link do Hero Card

**Estimativa:** 1 dia

---

### Fase 4 — Polimento
**Objetivo:** Estados vazios, loading skeletons, responsividade

- [ ] 4.1 Empty states para quando não há sessões (nova conta)
- [ ] 4.2 Skeleton loaders para Hero Card e Chart durante fetch
- [ ] 4.3 Revisão responsiva mobile (Activity Calendar e HeroCard quebram em telas pequenas)
- [ ] 4.4 Animação de entrada suave (fade in por seção)
- [ ] 4.5 Tooltip do Activity Calendar refinado

**Estimativa:** 1 dia

---

## Métricas de Sucesso

| Métrica | Antes | Meta |
|---|---|---|
| Seções com CTA funcional | 2 (Sync + Full view) | 8+ |
| Componentes reutilizados | 2 | 8 |
| Dados de qualidade exibidos | 0 (só volume) | 3 (streak, consistency, badge) |
| Textos em inglês | 3 (greeter, labels) | 0 |

---

## Notas Técnicas

- Todos os cálculos pesados (streak, consistency, weekly delta) devem ser feitos no **server component** (`page.tsx`) via Supabase — não no cliente
- O `HeroCard` é `"use client"` por causa de animações — mas seus dados vêm via props do server
- O `ActivityCalendar` é `"use client"` por causa do tooltip — idem
- Consistency Score: `score = Math.max(0, 100 - (stdDev / avgLap * 1000))` onde stdDev é o desvio padrão em ms das últimas 20 voltas válidas (excluir outliers > 2σ)
- Streak: query deve rodar em UTC, mas exibir em horário do piloto (usar timezone do perfil se existir)
