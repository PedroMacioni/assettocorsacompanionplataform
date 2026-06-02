# Session Detail Redesign — Design Spec

**Data:** 2026-06-01
**Status:** Aprovado
**Autor:** Claude + Pedro

---

## Objetivo

Redesenhar a tela de detalhes de sessão para:

1. Transformar o painel client-side em uma **página própria com rota dedicada** (`/sessions/[sourceId]`)
2. Corrigir o comportamento do botão voltar (browser back e mouse back)
3. Substituir a grade de 7 cards genéricos por uma **seção de análise estruturada e hierárquica**
4. Melhorar o header com título no padrão visual do resto da plataforma
5. Adicionar tabs no mobile para separar Overview e tabela de voltas

**Referências visuais:** Track Titan (linguagem motorsport) + Linear (qualidade SaaS)

---

## Problemas do Design Atual

| Problema | Causa Raiz |
|----------|-----------|
| Mouse back retorna à tab anterior | URL nunca muda — o painel é estado client-side puro |
| Botão voltar tiny e difícil de clicar | `text-xs`, ícone `w-3.5 h-3.5`, área de toque mínima |
| 7 cards com mesmo peso visual | Sem hierarquia, mistura performance com metadados de sessão |
| Sessão não é bookmarkável nem compartilhável por URL | Sem rota própria |
| Total Laps + Valid = informação duplicada | Ambos mostrados como cards separados |
| Last Lap card | Dado irrelevante na maioria das sessões |

---

## Decisões de Design

### 1. Roteamento — Página Dedicada

**Nova rota:** `/sessions/[sourceId]`

- Clique em "Ver detalhes" no grid de sessions → `router.push('/sessions/${sourceId}')`
- O botão voltar faz `router.back()` → retorna para `/sessions` com filtros preservados no histórico do browser
- Acesso direto pela URL funciona (RSC busca dados no servidor)
- Fallback do back button: se `window.history.length <= 1` (acesso direto), navega para `/sessions`

**Impacto em `SessionsContent.tsx`:**
- Remover: estado `panel`, `loadingId`, callback `openSession`, callback `closePanel`
- Remover: `SessionDetailPanel` import e renderização condicional
- Manter: `ShareSessionModal` (botão de compartilhar na lista continua funcionando)
- Alterar: `onSelect` passa a chamar `router.push`

### 2. Back Button — Grande e Claro

**Antes:** `text-xs text-muted-foreground`, ícone `w-3.5 h-3.5`, área de toque ~24px

**Depois:**
```
← Sessions
```

Especificações:
- Elemento: `<button>` ou `<Link>`
- Padding: `py-2 px-1` (área de toque mínima de 44px vertical)
- Ícone: `ArrowLeft` com `size-5`
- Texto: `text-sm font-medium text-muted-foreground`
- Hover: `text-foreground transition-colors`
- Posição: acima do header da sessão, alinhado à esquerda

### 3. Header da Sessão

Layout desktop:

```
← Sessions                                           [Share ↗]

HOTLAP                                    (badge de tipo)
Spa-Francorchamps                         (h1, texto grande)
Ferrari F40  ·  28 May 2026              (subtítulo)

1:42.831          |   +0.842s vs PB
Best Lap          |   PB: 1:41.989
```

- **Badge de tipo** (`HOTLAP`, `RACE`, etc.): mesmas cores do `SESSION_BADGE` atual, acima do título
- **Título (h1):** nome da pista, `text-3xl sm:text-4xl font-bold`
- **Subtítulo:** `Carro · Data` em `text-sm text-muted-foreground`
- **Hero metrics:** Best Lap + Delta vs PB separados por `border-r border-border` — manter estilo atual, funciona bem
- **Share button:** canto superior direito, estilo `button outline` com ícone `Share2`

Layout mobile:
```
← Sessions                               [Share ↗]
HOTLAP
Spa-Francorchamps
Ferrari F40  ·  28 May 2026
1:42.831
+0.842s vs PB · PB 1:41.989
```
- Hero metrics empilhados verticalmente no mobile

### 4. Seção de Análise — Substituição dos 7 Cards

**Filosofia:** uma seção que conta uma história contínua, não uma grade de fatos isolados.

```
┌──────────────────────────────────────────────────────────┐
│                                                          │
│  Consistency                                             │
│  87 / 100    ████████████████░░░░    Excellent           │
│              σ = 0.421s                                  │
│                                                          │
│  ────────────────────────────────────────────────────    │
│                                                          │
│  Avg Lap       1:43.421        +0.590s vs best           │
│                                                          │
│  15 / 18 valid  ·  3 cuts  ·  SM  ·  124.3 km          │
│                                                          │
│  ────────────────────────────────────────────────────    │
│                                                          │
│  Theoretical Best   1:41.989   (−0.842s potential)       │
│  S1  22.341  ·  S2  38.421  ·  S3  41.227               │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

**Removidos vs atual:**
| Campo removido | Motivo |
|---------------|--------|
| Total Laps (card separado) | Incorporado em "15 / 18 valid" |
| Last Lap | Dado irrelevante na maioria das sessões |
| Distance | Movido para a linha de metadados inline |
| Tyre (card separado) | Movido para a linha de metadados inline |

**Mantidos e refinados:**
- Consistency: igual ao atual (score + barra + label), mas sem card isolado — integrado à seção
- Avg Lap: com delta inline vs best lap (contexto imediato)
- Theoretical Best + setores: mantido, dentro da mesma seção
- Cuts: inline com valid laps, só tem destaque (`text-red-400`) quando > 0

**Hierarquia visual dentro da seção:**
1. Consistency (maior destaque — é a métrica mais acionável)
2. Avg Lap com delta (segunda em importância)
3. Metadados de sessão (valid/total · cuts · tyre · distance) em texto menor
4. Theoretical Best (aspiracional — terceiro nível)

**Quando seção não aparece:**
- Se não houver voltas (`laps.length === 0`): mostrar apenas metadados básicos da sessão (sem consistency, sem avg, sem theoretical)
- Consistency só aparece com `laps.length >= 2`
- Theoretical Best só aparece se `bestS1 && bestS2 && bestS3`

### 5. Tabela de Voltas — Mantida com Refinamentos

A tabela atual é boa. Ajustes menores:

- **Linha da melhor volta:** adicionar indicador visual mais claro (ex: `📍` ou borda esquerda colorida em vez de apenas `bg-primary/[0.07]`)
- **Filter bar:** manter "Valid only" e contador de voltas
- **Legenda de cores:** manter (purple/green/yellow/red/grey)
- **Colunas:** manter todas (Lap, S1, S2, S3, Total, Gap, Tyre, Cuts)

### 6. Mobile — Tabs

No mobile, a tabela de voltas tem 8 colunas com scroll horizontal, o que é problemático quando há conteúdo acima e abaixo. A solução é separar em tabs.

```
┌────────────────────────────┐
│ ← Sessions          Share  │
│ HOTLAP                     │
│ Spa-Francorchamps          │
│ Ferrari F40 · 28 May 2026  │
│                            │
│ 1:42.831                   │
│ +0.842s vs PB              │
├────────────────────────────┤
│  Overview  │  Laps         │  ← Tab bar
├────────────────────────────┤
│                            │
│  [Seção de Análise]        │
│   ou                       │
│  [Tabela de Voltas]        │
│                            │
└────────────────────────────┘
```

- **Tab bar:** duas tabs (`Overview`, `Laps`), estado local (`useState`)
- **Default:** `Overview`
- **Header e hero metrics:** sempre visíveis, acima das tabs
- **Tab Overview:** seção de análise (consistency, avg, metadata, theoretical)
- **Tab Laps:** tabela com scroll horizontal, filter bar no topo
- **Desktop:** layout side-by-side como hoje, sem tabs (seção à esquerda, tabela à direita)

---

## Arquitetura de Componentes

### Novos Arquivos

```
app/(dashboard)/sessions/
├── [sourceId]/
│   ├── page.tsx                  # RSC — busca session, laps, pb no Supabase
│   └── SessionDetailContent.tsx  # Client component — header, tabs, seção, tabela
```

### Arquivos Modificados

```
app/(dashboard)/sessions/
├── SessionsContent.tsx    # Remove panel state, onSelect → router.push
├── SessionsClient.tsx     # Remove loadingId prop (navegação não precisa)
```

### Arquivos Descontinuados (após implementação)

```
components/
└── SessionDetailPanel.tsx  # Substituído por SessionDetailContent — remover após migração
```

### RSC `[sourceId]/page.tsx`

Responsabilidades:
- Receber `params.sourceId` 
- Buscar do Supabase: `session`, `laps`, `personal_best` do combo car+track, `trackSessions` (histórico de sessões nessa pista)
- Passar dados para `SessionDetailContent` como props
- Tratar `session not found` → redirecionar para `/sessions`

Dados buscados (mesma estrutura de `SessionPanelData`):
```typescript
type SessionDetailData = {
  session: Session;
  laps: Lap[];
  pb: PersonalBest | null;
  trackSessions: Session[];
};
```

### Client Component `SessionDetailContent.tsx`

Responsabilidades:
- Renderizar header (back button, title, hero metrics, share button)
- Renderizar seção de análise
- Gerenciar tab ativa no mobile (`useState`)
- Renderizar tabela de voltas
- Gerenciar filter "Valid only" (`useState`)
- Abrir `ShareSessionModal` ao clicar em Share

Props:
```typescript
interface Props {
  data: SessionDetailData;
}
```

---

## i18n

### Chaves Novas (en.json + pt-BR.json)

```json
// SessionDetail namespace — novas adições
{
  "SessionDetail": {
    "tabs": {
      "overview": "Overview",
      "laps": "Laps"
    },
    "stats": {
      "validOf": "{valid} / {total} valid",
      "cutsInline": "{count} cuts",
      "avgVsBest": "{delta} vs best"
    }
  }
}
```

### Chaves Removidas

- `stats.totalLaps` — incorporado em `validOf`
- `stats.lastLap` — removido da UI
- `stats.distance` — inline agora, sem label separado
- `stats.tyre` — inline agora, sem label separado

### Chaves Mantidas (sem alteração)

- `backToSessions`, `bestLap`, `vsPb`, `pb`
- `consistency.*`, `theoretical.*`
- `stats.valid`, `stats.avgLap`, `stats.cuts`
- `table.*`

---

## Fluxo de Dados

```
/sessions/[sourceId]/page.tsx (RSC)
    │
    ├── supabase: session by source_id + user_id
    ├── supabase: laps by session_id
    ├── supabase: personal_best (car_id + track_id)
    │
    └── SessionDetailContent (Client)
            │
            ├── SessionDetailHeader
            │     ├── BackButton → router.back() ou /sessions
            │     ├── Badge + Título + Subtítulo
            │     ├── HeroMetrics (BestLap + DeltaPB)
            │     └── ShareButton → abre ShareSessionModal
            │
            ├── [Mobile] TabBar (Overview | Laps)
            │
            ├── SessionAnalysisSection
            │     ├── ConsistencyBlock
            │     ├── AvgLapBlock
            │     ├── MetadataLine (valid · cuts · tyre · distance)
            │     └── TheoreticalBestBlock
            │
            ├── LapTable
            │     ├── FilterBar (Valid only + legenda)
            │     └── Table (Lap, S1, S2, S3, Total, Gap, Tyre, Cuts)
            │
            └── ShareSessionModal
```

---

## Critérios de Aceite

### Roteamento
- [ ] Clicar em "Ver detalhes" navega para `/sessions/[sourceId]`
- [ ] URL muda corretamente no browser
- [ ] Mouse back (botão lateral do mouse) retorna para `/sessions`
- [ ] Acesso direto pela URL funciona (dados carregados no servidor)
- [ ] `sourceId` inválido redireciona para `/sessions`

### Back Button
- [ ] Área de toque >= 44px de altura
- [ ] Ícone `size-5` (não `w-3.5 h-3.5`)
- [ ] `router.back()` com fallback para `/sessions`
- [ ] Visível e clicável em todas as resoluções

### Header
- [ ] Badge de tipo de sessão presente
- [ ] Título é o nome da pista (h1, grande)
- [ ] Subtítulo: carro · data
- [ ] Hero metrics: Best Lap + Delta vs PB
- [ ] Share button no canto superior direito

### Seção de Análise
- [ ] Consistency com score, barra e label
- [ ] Avg Lap com delta inline vs best
- [ ] Linha de metadados: "X / Y valid · Z cuts · TYRE · distance"
- [ ] Cuts com `text-red-400` apenas quando > 0
- [ ] Theoretical Best com setores (somente quando disponível)
- [ ] Seção não aparece se não houver voltas

### Tabela de Voltas
- [ ] Todas as colunas presentes: Lap, S1, S2, S3, Total, Gap, Tyre, Cuts
- [ ] Cor por classificação de setor (purple/green/yellow/red/grey)
- [ ] Filter "Valid only" funciona
- [ ] Melhor volta com highlight claro

### Mobile
- [ ] Tabs "Overview" e "Laps" visíveis abaixo do header
- [ ] Tab Overview: seção de análise
- [ ] Tab Laps: tabela com scroll horizontal
- [ ] Default: Overview
- [ ] Header sempre visível (acima das tabs)

### Share
- [ ] Botão Share no header abre `ShareSessionModal`
- [ ] ShareSessionModal funciona igual ao fluxo existente na lista

### i18n
- [ ] Todas as novas chaves adicionadas em `en.json` e `pt-BR.json`
- [ ] Chaves removidas deletadas dos arquivos de tradução

---

## Fora do Escopo

- Preservação dos filtros da lista ao voltar (back button vai para `/sessions` sem query params se histórico vazio)
- Comparação entre sessões
- Gráfico de evolução de tempos de volta (linha chart)
- Compartilhamento direto por sessão via URL público (Open Graph)
- Edição de metadados da sessão
- Exportação de dados de volta
