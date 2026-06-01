# Sessions Page Refactor - Design Spec

**Data:** 2026-06-01
**Status:** Aprovado
**Autor:** Claude + Pedro

## Objetivo

Refatorar a tela de sessões para:
1. Exibir informações mais relevantes para pilotos (foco em identificação e performance)
2. Criar componentes reutilizáveis para futuras refatorações
3. Melhorar a UX com filtros colapsáveis e ações contextuais
4. Adicionar funcionalidade de compartilhamento

## Contexto e Pesquisa

### Objetivos do Usuário
Com base na análise, os pilotos usam a tela de sessões para:
- **Encontrar uma sessão específica** — "quero achar aquela sessão de ontem no Spa com a Ferrari"
- **Revisitar boas performances** — "quero encontrar minhas melhores voltas para estudar"

### Métricas Importantes (Pesquisa)
Baseado em pesquisa sobre telemetria e ferramentas de sim racing ([Track Titan](https://www.tracktitan.io/), [RaceLab](https://racelab.app/), [Coach Dave Delta](https://coachdaveacademy.com/delta/)):

- **Delta vs Personal Best** — métrica mais citada para avaliar performance
- **Consistência** — "Consistency is the real secret behind every fast driver"
- **Informações de identificação** — Carro, Pista, Data

Métricas **não relevantes** para o grid:
- Distância total
- Número de voltas
- Duração da sessão

## Decisões de Design

### 1. Header

**Minimalista:** Apenas o título "Sessions", sem eyebrow, contador ou card lateral.

```
Sessions
```

### 2. Grid - Colunas

| Coluna | Descrição | Alinhamento |
|--------|-----------|-------------|
| Date | Data formatada | Esquerda |
| Car | Nome do carro | Esquerda |
| Track | Nome da pista | Esquerda |
| Best Lap | Tempo da melhor volta (ordenável) | Direita |
| Delta | Diferença vs PB pessoal | Direita |
| Badge | New PB ou Consistent | Centro |
| Actions | Menu de 3 pontos | Centro |

**Removidas:** Laps, Distance, Type

### 3. Ordenação

- **Apenas coluna "Best Lap"** é ordenável
- Clique no header alterna: melhor → pior → padrão (data desc)
- Indicador visual (↑↓) no header quando ativo

### 4. Badges de Qualidade

| Badge | Condição | Visual |
|-------|----------|--------|
| New PB | Sessão onde bateu recorde pessoal no combo carro+pista | 🏆 ou ícone similar |
| Consistent | Score de consistência >= 85 | 📊 ou ícone similar |

Máximo 1 badge por sessão. Prioridade: New PB > Consistent.

### 5. Filtros Colapsáveis

#### Estado Minimizado (padrão)
```
┌─────────────────────────────────────────────────────────┐
│ [≡] Filtros (N)                               [expand ▼]│
└─────────────────────────────────────────────────────────┘
```
- Mostra contador de filtros ativos `(N)`
- Se nenhum filtro ativo: apenas "Filtros"

#### Estado Expandido
```
┌─────────────────────────────────────────────────────────┐
│ [≡] Filtros (N)                             [collapse ▲]│
├─────────────────────────────────────────────────────────┤
│  Período          Carro           Pista        Apenas PB│
│  [dropdown]       [dropdown]      [dropdown]   [toggle] │
│                                                         │
│                                        [Limpar filtros] │
└─────────────────────────────────────────────────────────┘
```

#### Filtros Disponíveis

| Filtro | Tipo | Opções |
|--------|------|--------|
| Período | Dropdown | Esta semana, Últimos 30 dias, Últimos 90 dias, Este ano |
| Carro | Dropdown | Lista de carros do usuário |
| Pista | Dropdown | Lista de pistas do usuário |
| Apenas PB | Toggle | On/Off |

**Removidos:** Type, Date específica

#### Persistência
- **Estado expandido/minimizado:** Persistido em `localStorage` (key: `sessions-filters-collapsed`)
- **Valores dos filtros:** NÃO persistidos (reset no F5)

### 6. Menu de Ações (3 pontos)

Ao clicar no ⋮ de uma linha:

```
┌─────────────────┐
│ Ver detalhes    │
│ Compartilhar    │
└─────────────────┘
```

### 7. Interação de Clique

- **Clique na linha:** Abre painel de detalhes (comportamento mantido)
- **Clique no menu ⋮:** Abre dropdown de ações

### 8. Mobile - Cards Simplificados

```
┌─────────────────────────────────────┐
│ Ferrari F40                    🏆  │
│ Spa-Francorchamps                  │
│ 1:42.831                       ⋮   │
└─────────────────────────────────────┘
```

**Informações exibidas:**
- Carro (destaque, fonte maior)
- Pista
- Melhor Volta
- Badge (se houver)
- Menu ⋮

**Não exibidas no card (visíveis no detalhe):**
- Data
- Delta vs PB

### 9. Modal de Compartilhamento

#### Layout
```
┌─────────────────────────────────────────────┐
│           Compartilhar Sessão           [X] │
├─────────────────────────────────────────────┤
│  ┌───────────────────────────────────────┐  │
│  │         [Card Visual Preview]         │  │
│  │                                       │  │
│  │   🏆 NEW PERSONAL BEST                │  │
│  │                                       │  │
│  │   Ferrari F40                         │  │
│  │   Spa-Francorchamps                   │  │
│  │                                       │  │
│  │   1:42.831           -0.842s          │  │
│  │                                       │  │
│  │   28 May 2026     apexcompanion.com   │  │
│  └───────────────────────────────────────┘  │
│                                             │
│  [🔗 Copiar link]      [📷 Salvar imagem]  │
└─────────────────────────────────────────────┘
```

#### Funcionalidades
- **Preview:** Card visual estilizado mostrando como ficará a imagem
- **Copiar link:** Gera URL pública da sessão e copia para clipboard
- **Salvar imagem:** Gera PNG do card e faz download

#### Conteúdo do Card Visual
- Badge (se New PB)
- Nome do carro
- Nome da pista
- Melhor volta
- Delta vs PB
- Data
- Branding (apexcompanion.com ou similar)

## Arquitetura de Componentes

### Componentes Genéricos (Reutilizáveis)

```
components/
├── ui/
│   ├── collapsible-filter-bar.tsx    # Barra de filtros colapsável
│   ├── data-grid.tsx                 # Grid com ordenação e ações
│   ├── data-grid-mobile.tsx          # Cards mobile para o grid
│   ├── action-menu.tsx               # Menu de 3 pontos
│   └── share-modal.tsx               # Modal de compartilhamento
```

#### CollapsibleFilterBar
Props:
- `title: string` — Título da barra (ex: "Filtros")
- `activeCount: number` — Contador de filtros ativos
- `storageKey: string` — Key para localStorage
- `defaultCollapsed?: boolean` — Estado inicial (default: true)
- `onClear?: () => void` — Callback para limpar filtros
- `children: ReactNode` — Conteúdo dos filtros

#### DataGrid
Props:
- `columns: Column[]` — Definição das colunas
- `data: T[]` — Dados a exibir
- `sortableColumns?: string[]` — Colunas ordenáveis
- `onSort?: (column: string, direction: 'asc' | 'desc' | null) => void`
- `onRowClick?: (item: T) => void`
- `actions?: Action[]` — Ações do menu ⋮
- `emptyMessage?: string`

#### ShareModal
Props:
- `open: boolean`
- `onClose: () => void`
- `title: string`
- `shareUrl: string`
- `cardContent: ReactNode` — Preview do card
- `onCopyLink: () => void`
- `onSaveImage: () => void`

### Componentes Específicos de Sessão

```
app/(dashboard)/sessions/
├── page.tsx                    # Server component (dados)
├── sessions-content.tsx        # Client component principal
├── sessions-filters.tsx        # Filtros específicos de sessão
├── session-row.tsx             # Linha do grid desktop
├── session-card-mobile.tsx     # Card mobile
├── session-share-card.tsx      # Card visual para compartilhamento
└── share-session-modal.tsx     # Modal de compartilhamento de sessão
```

## Internacionalização (i18n)

### Novas Chaves - English (en.json)

```json
{
  "Sessions": {
    "title": "Sessions",
    "filters": {
      "title": "Filters",
      "activeCount": "Filters ({count})",
      "clear": "Clear filters",
      "period": "Period",
      "car": "Car",
      "track": "Track",
      "onlyPb": "Only PB",
      "allCars": "All cars",
      "allTracks": "All tracks",
      "thisWeek": "This week",
      "last30Days": "Last 30 days",
      "last90Days": "Last 90 days",
      "thisYear": "This year"
    },
    "grid": {
      "date": "Date",
      "car": "Car",
      "track": "Track",
      "bestLap": "Best Lap",
      "delta": "Delta",
      "actions": "Actions",
      "noResults": "No sessions found",
      "sortAsc": "Sort ascending",
      "sortDesc": "Sort descending"
    },
    "badges": {
      "newPb": "New PB",
      "consistent": "Consistent"
    },
    "actions": {
      "viewDetails": "View details",
      "share": "Share"
    },
    "share": {
      "title": "Share Session",
      "copyLink": "Copy link",
      "saveImage": "Save image",
      "linkCopied": "Link copied!",
      "imageSaved": "Image saved!"
    }
  }
}
```

### Novas Chaves - Português (pt-BR.json)

```json
{
  "Sessions": {
    "title": "Sessões",
    "filters": {
      "title": "Filtros",
      "activeCount": "Filtros ({count})",
      "clear": "Limpar filtros",
      "period": "Período",
      "car": "Carro",
      "track": "Pista",
      "onlyPb": "Apenas PB",
      "allCars": "Todos os carros",
      "allTracks": "Todas as pistas",
      "thisWeek": "Esta semana",
      "last30Days": "Últimos 30 dias",
      "last90Days": "Últimos 90 dias",
      "thisYear": "Este ano"
    },
    "grid": {
      "date": "Data",
      "car": "Carro",
      "track": "Pista",
      "bestLap": "Melhor Volta",
      "delta": "Delta",
      "actions": "Ações",
      "noResults": "Nenhuma sessão encontrada",
      "sortAsc": "Ordenar crescente",
      "sortDesc": "Ordenar decrescente"
    },
    "badges": {
      "newPb": "Novo PB",
      "consistent": "Consistente"
    },
    "actions": {
      "viewDetails": "Ver detalhes",
      "share": "Compartilhar"
    },
    "share": {
      "title": "Compartilhar Sessão",
      "copyLink": "Copiar link",
      "saveImage": "Salvar imagem",
      "linkCopied": "Link copiado!",
      "imageSaved": "Imagem salva!"
    }
  }
}
```

## Requisitos Técnicos

### Geração de Imagem para Compartilhamento
- Usar `html-to-image` ou `html2canvas` para gerar PNG do card
- Dimensões recomendadas: 1200x630px (proporção Open Graph)
- Incluir branding sutil

### URL Pública de Sessão
- Rota: `/session/[sourceId]` (página pública)
- Dados mínimos visíveis publicamente (sem expor dados sensíveis)
- Meta tags Open Graph para preview em redes sociais

### Persistência localStorage
```typescript
const STORAGE_KEY = 'sessions-filters-collapsed';

// Salvar estado
localStorage.setItem(STORAGE_KEY, JSON.stringify(collapsed));

// Recuperar estado
const saved = localStorage.getItem(STORAGE_KEY);
const defaultCollapsed = saved ? JSON.parse(saved) : true;
```

### Cálculo do Badge "New PB"
- Comparar `session.best_lap_ms` com o PB atual do combo (car_id + track_id)
- Se `session.best_lap_ms == pb.time_ms` E a sessão é a origem do PB atual → Badge "New PB"
- Alternativa: adicionar flag `is_pb` na tabela sessions ou verificar `session.source_id == pb.source_id`

### Cálculo do Badge "Consistent"
- Requer dados de voltas individuais da sessão
- **Opção A (recomendada):** Pré-calcular score de consistência ao sincronizar e salvar em `sessions.consistency_score`
- **Opção B:** Fazer join com tabela `laps` no server (mais lento, evitar se possível)
- Score >= 85 = Badge "Consistent"
- Fórmula: `Math.max(0, Math.round(100 - stdDev(lapTimes) / 20))`

### Cálculo de Delta vs PB
- Buscar PB do combo (car_id + track_id) na tabela `personal_bests`
- Delta = `session.best_lap_ms - pb.time_ms`
- Negativo (verde) = sessão foi melhor que PB atual (só possível se for a sessão do PB)
- Positivo (laranja/vermelho) = sessão foi pior que PB atual
- Zero = é o PB atual
- Se não houver PB para o combo: mostrar "—"

## Fluxo de Dados

```
page.tsx (Server)
    │
    ├── Fetch sessions com filtros
    ├── Fetch personal_bests para calcular deltas
    ├── Calcular badges (New PB, Consistent)
    │
    └── SessionsContent (Client)
            │
            ├── CollapsibleFilterBar
            │       └── SessionsFilters
            │
            ├── DataGrid (desktop)
            │       └── SessionRow (com menu de ações)
            │
            ├── DataGridMobile
            │       └── SessionCardMobile
            │
            └── ShareSessionModal
                    └── SessionShareCard
```

## Critérios de Aceite

### Funcionalidade
- [ ] Grid exibe colunas: Date, Car, Track, Best Lap, Delta, Badge, Actions
- [ ] Ordenação funciona apenas na coluna Best Lap
- [ ] Filtros colapsáveis com estado persistido
- [ ] Filtros: Período, Carro, Pista, Apenas PB
- [ ] Menu de ações com "Ver detalhes" e "Compartilhar"
- [ ] Clique na linha abre detalhes
- [ ] Modal de compartilhamento com preview do card
- [ ] Copiar link funciona
- [ ] Salvar imagem funciona
- [ ] Badges aparecem corretamente (New PB, Consistent)

### Mobile
- [ ] Cards simplificados (Carro, Pista, Best Lap, Badge)
- [ ] Menu de ações acessível
- [ ] Filtros funcionam igual desktop

### i18n
- [ ] Todas as strings traduzidas em en.json
- [ ] Todas as strings traduzidas em pt-BR.json

### Performance
- [ ] Não há regressão de performance vs implementação atual
- [ ] Geração de imagem não bloqueia UI

## Fora do Escopo

- Customização do card de compartilhamento (tema claro/escuro)
- Compartilhamento direto em redes sociais (Twitter, Discord, etc.)
- Filtro por data específica
- Filtro por tipo de sessão (Hotlap, Race, etc.)
- Múltiplas ordenações simultâneas
- Comparação de sessões

## Referências

- [Track Titan - Telemetria para Sim Racing](https://www.tracktitan.io/post/how-to-analyse-telemetry-for-sim-racing)
- [RaceLab - Overlays para Sim Racers](https://racelab.app/)
- [Coach Dave Delta - Análise de Telemetria](https://coachdaveacademy.com/delta/)
- [Fanatec - Como Melhorar Lap Times](https://www.fanatec.com/eu/en/explorer/games/gaming-tips/how-game-telemetry-improves-your-sim-racing-skills/)
