# Garage Redesign - Spec Completa

**Data:** 2026-05-25
**Status:** Aprovado
**Abordagem:** B - Entrega Completa

## Resumo Executivo

Redesign completo da tela "Minha Garagem" para transformá-la de um MVP básico em uma experiência rica e informativa. Inclui:

- Sistema de filtros e busca avançada
- Grid de carros com stats
- Modal de detalhes com specs, pistas e setups
- Importação de dados do Assetto Corsa via agente existente

---

## 1. Estrutura de Dados

### 1.1 Nova Tabela: `car_specs`

Especificações técnicas dos carros, importadas do `ui_car.json` do Assetto Corsa.

```sql
CREATE TABLE car_specs (
  car_id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  brand TEXT,
  class TEXT,
  year INTEGER,
  bhp INTEGER,
  torque INTEGER,
  weight INTEGER,
  top_speed INTEGER,
  drivetrain TEXT,
  acceleration INTEGER, -- décimos de segundo (31 = 3.1s)
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS
ALTER TABLE car_specs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Car specs são públicas para leitura"
  ON car_specs FOR SELECT
  USING (true);

CREATE POLICY "Apenas sistema pode inserir specs"
  ON car_specs FOR INSERT
  WITH CHECK (true); -- Controlado via service role key no agente
```

### 1.2 Nova Tabela: `car_setups`

Setups salvos por usuário/carro/pista.

```sql
CREATE TABLE car_setups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  car_id TEXT NOT NULL,
  track_id TEXT NOT NULL,
  name TEXT NOT NULL,
  data JSONB NOT NULL, -- Dados parseados do .ini
  best_lap_ms INTEGER,
  is_active BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(user_id, car_id, track_id, name)
);

-- Índices
CREATE INDEX idx_car_setups_user_car ON car_setups(user_id, car_id);
CREATE INDEX idx_car_setups_user_car_track ON car_setups(user_id, car_id, track_id);

-- RLS
ALTER TABLE car_setups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuários veem apenas seus setups"
  ON car_setups FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Usuários inserem apenas seus setups"
  ON car_setups FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Usuários atualizam apenas seus setups"
  ON car_setups FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Usuários deletam apenas seus setups"
  ON car_setups FOR DELETE
  USING (auth.uid() = user_id);
```

### 1.3 Alteração: `user_car_preferences`

Adicionar campo de favorito.

```sql
ALTER TABLE user_car_preferences
ADD COLUMN is_favorite BOOLEAN DEFAULT FALSE;
```

### 1.4 Tipos TypeScript

```typescript
// lib/types.ts - Adicionar

export interface CarSpecs {
  car_id: string;
  name: string;
  brand: string | null;
  class: string | null;
  year: number | null;
  bhp: number | null;
  torque: number | null;
  weight: number | null;
  top_speed: number | null;
  drivetrain: string | null;
  acceleration: number | null; // décimos de segundo
  updated_at: string;
}

export interface CarSetup {
  id: string;
  user_id: string;
  car_id: string;
  track_id: string;
  name: string;
  data: SetupData;
  best_lap_ms: number | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface SetupData {
  [section: string]: {
    VALUE?: number;
    [key: string]: number | string | undefined;
  };
}

// Estender UserCarPreference
export interface UserCarPreference {
  user_id: string;
  car_id: string;
  display_name: string | null;
  is_favorite: boolean;
  updated_at: string;
}
```

---

## 2. Tela de Listagem

### 2.1 Layout

```
┌─────────────────────────────────────────────────────────┐
│  Minha Garagem                          [X carros]      │
├─────────────────────────────────────────────────────────┤
│  🔍 Buscar carro...                      [▼ Filtros]    │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌────────────────┐ │
│  │ Classe ▾│ │ Marca  ▾│ │Favoritos│ │Sessões recentes│ │
│  └─────────┘ └─────────┘ └─────────┘ └────────────────┘ │
│                                        [Limpar filtros] │
├─────────────────────────────────────────────────────────┤
│  Grid responsivo de cards (1/2/3/4 colunas)             │
└─────────────────────────────────────────────────────────┘
```

### 2.2 Filtros

| Filtro | Tipo | Fonte de Dados |
|--------|------|----------------|
| Busca | Input text | Local filter no nome |
| Classe | Select | Distinct de `car_specs.class` |
| Marca | Select | Distinct de `car_specs.brand` |
| Favoritos | Toggle | `user_car_preferences.is_favorite` |
| Sessões Recentes | Toggle | Sessions nos últimos 30 dias |

**Comportamentos:**
- Filtros persistem em URL params (padrão do sistema)
- Botão "Limpar filtros" aparece quando há filtros ativos
- Seção de filtros colapsável em mobile (botão toggle)

### 2.3 Card do Carro

```
┌────────────────────────┐
│  Porsche 911 GT3 R     │  ← Nome (ou display_name)
│  ┌─────┐               │
│  │ GT3 │  47 sessões   │  ← Badge classe + sessões
│  └─────┘               │
│  4.218 km              │  ← Distância total
│                        │
│  [hover: bg highlight] │
└────────────────────────┘
```

**Estilos:**
- `cursor-pointer` sempre
- Hover: `bg-accent/50` ou similar
- Transition suave

### 2.4 Ordenação

- Padrão: mais sessões primeiro (`ORDER BY sessions DESC`)
- Futuro: permitir ordenar por outros campos

### 2.5 Estados

| Estado | Comportamento |
|--------|---------------|
| Loading | Skeleton cards |
| Vazio (sem carros) | EmptyState "Nenhum carro encontrado" |
| Vazio (filtros) | EmptyState "Nenhum carro corresponde aos filtros" |

---

## 3. Modal de Detalhes

### 3.1 Estrutura Visual

```
┌─────────────────────────────────────────────────────────────────┐
│                                                            [X]  │
│  ★ FAVORITO · 47 SESSÕES                                        │
│  Porsche 911 GT3 R                                              │
│  2019 · GT3 · RWD · 6-spd seq.          BEST LAP · SPA         │
│                                          2:17.184               │
│                                          TEMPO      DISTÂNCIA   │
│                                          38h 14m    4.218 km    │
├─────────────────────────────────────────────────────────────────┤
│  [SPECS]  [PISTAS]  [SETUPS]  ← Scroll sections (sem tabs)     │
├─────────────────────────────────────────────────────────────────┤
│  Conteúdo da seção ativa                                        │
└─────────────────────────────────────────────────────────────────┘
```

### 3.2 Header do Modal

| Elemento | Dados | Fonte |
|----------|-------|-------|
| Badge Favorito | Toggle clicável | `user_car_preferences.is_favorite` |
| Sessões | Contagem | `top_cars.sessions` |
| Nome | Editável | `user_car_preferences.display_name` ou `car_specs.name` |
| Subtítulo | Ano · Classe · Drivetrain | `car_specs` |
| Best Lap | Tempo + Pista | `personal_bests` melhor geral |
| Tempo Total | Soma de sessões | Calculado das sessions |
| Distância | Soma | `top_cars.total_distance_km` |

### 3.3 Seção: Specs

Grid 2x3 com especificações técnicas.

| Spec | Formato | Exemplo |
|------|---------|---------|
| Potência | `{bhp} hp` | 565 hp |
| Peso | `{weight} kg` | 1.250 kg |
| 0-100 | `{acceleration/10} s` | 3.1 s |
| Top Speed | `{top_speed} km/h` | 298 km/h |
| Drivetrain | `{drivetrain}` | RWD |
| P/W Ratio | `{bhp*1000/weight} hp/t` | 452 hp/t |
| Torque | `{torque} Nm` | 550 Nm |

**Estado vazio:** "Especificações não disponíveis. Aguardando sincronização do agente."

### 3.4 Seção: Pistas Conhecidas

Grid de cards com pistas onde o carro foi usado.

```
┌─────────────┐
│  Spa        │  ← Nome da pista
│  2:17.184   │  ← Melhor tempo (personal_best)
│  12 sessões │  ← Contagem de sessões nessa pista
└─────────────┘
```

**Fonte de dados:**
```sql
SELECT
  t.track_id,
  t.name,
  pb.time_ms as best_lap_ms,
  COUNT(s.id) as sessions
FROM sessions s
JOIN tracks t ON t.track_id = s.track_id
LEFT JOIN personal_bests pb ON pb.car_id = s.car_id AND pb.track_id = s.track_id
WHERE s.car_id = $car_id AND s.user_id = $user_id
GROUP BY t.track_id, t.name, pb.time_ms
ORDER BY sessions DESC
```

### 3.5 Seção: Setups

**Lista de setups:**
```
┌─────────────────────────────────────────────────────────┐
│  [SP] Spa · Dry Hot              2:17.184    [ATIVO]   │
│       Último uso: 2 dias atrás                          │
├─────────────────────────────────────────────────────────┤
│  [SP] Spa · Wet                  2:31.892              │
│       Último uso: 2 dias atrás                          │
├─────────────────────────────────────────────────────────┤
│  [MO] Monza · Qualifying         1:47.402              │
│       Último uso: 5 dias atrás                          │
└─────────────────────────────────────────────────────────┘
```

**Detalhes do setup (ao clicar):**
```
┌─────────────────────────────────────────────────────────┐
│  SETUP · SPA DRY HOT                    Editado: 18 May │
├─────────────────────────────────────────────────────────┤
│  Front wing    4/11     Rear wing     7/11              │
│  Brake bias    54%      Differential  8%                │
│  Tire F        26 psi   Tire R        24 psi            │
│  Front ARB     5/11     Rear ARB      4/11              │
│  Fuel          30 L     Ride height   3/11              │
└─────────────────────────────────────────────────────────┘
```

**Estado vazio:** "Nenhum setup importado. Configure o agente para sincronizar seus setups."

---

## 4. Integração com Agente

### 4.1 Endpoints da API

#### POST `/api/cars/specs`

Upsert de specs de carros (batch).

**Request:**
```json
{
  "specs": [
    {
      "car_id": "ks_porsche_911_gt3_r",
      "name": "Porsche 911 GT3 R",
      "brand": "Porsche",
      "class": "GT3",
      "year": 2019,
      "bhp": 565,
      "torque": 550,
      "weight": 1250,
      "top_speed": 298,
      "drivetrain": "RWD",
      "acceleration": 31
    }
  ]
}
```

**Response:** `200 OK` com contagem de upserts.

#### POST `/api/cars/setups`

Upsert de setups (batch).

**Request:**
```json
{
  "setups": [
    {
      "car_id": "ks_porsche_911_gt3_r",
      "track_id": "spa",
      "name": "Dry Hot",
      "data": {
        "FRONT_WING": { "VALUE": 4 },
        "REAR_WING": { "VALUE": 7 },
        "BRAKE_POWER": { "VALUE": 1.0 },
        "BRAKE_BIAS": { "VALUE": 0.54 },
        "FUEL": { "VALUE": 30 },
        "PRESSURE_LF": { "VALUE": 26 },
        "PRESSURE_RF": { "VALUE": 26 },
        "PRESSURE_LR": { "VALUE": 24 },
        "PRESSURE_RR": { "VALUE": 24 },
        "ARB_FRONT": { "VALUE": 5 },
        "ARB_REAR": { "VALUE": 4 }
      }
    }
  ]
}
```

**Response:** `200 OK` com contagem de upserts.

#### PATCH `/api/cars/setups/:id/active`

Marcar setup como ativo (desativa outros da mesma combo carro+pista).

**Request:**
```json
{
  "is_active": true
}
```

### 4.2 Localização dos Arquivos no PC

| Dado | Caminho | Formato |
|------|---------|---------|
| Specs | `<AC>/content/cars/<car_id>/ui/ui_car.json` | JSON |
| Setups | `Documents/Assetto Corsa/setups/<car_id>/<track_id>/<name>.ini` | INI |

### 4.3 Mapeamento ui_car.json → car_specs

```json
// ui_car.json
{
  "name": "Porsche 911 GT3 R",
  "brand": "Porsche",
  "class": "GT3",
  "year": 2019,
  "specs": {
    "bhp": "565 bhp",      // parse: parseInt
    "torque": "550 Nm",    // parse: parseInt
    "weight": "1250 kg",   // parse: parseInt
    "topspeed": "298 km/h",// parse: parseInt
    "acceleration": "3.1s",// parse: parseFloat * 10
    "pwratio": "452 hp/t"  // ignorar, calcular no frontend
  },
  "drivetrain": "RWD"
}
```

### 4.4 Mapeamento .ini → car_setups.data

```ini
; setup.ini
[CAR]
MODEL=ks_porsche_911_gt3_r

[FUEL]
VALUE=30

[WING_1]
VALUE=4

[WING_2]
VALUE=7

[BRAKE]
BIAS=0.54
```

Mapeia para:
```json
{
  "FUEL": { "VALUE": 30 },
  "WING_1": { "VALUE": 4 },
  "WING_2": { "VALUE": 7 },
  "BRAKE": { "BIAS": 0.54 }
}
```

---

## 5. Arquivos a Criar/Modificar

### 5.1 Novos Arquivos

| Arquivo | Descrição |
|---------|-----------|
| `supabase/migrations/xxx_car_specs_setups.sql` | Migration das tabelas |
| `lib/types.ts` | Adicionar tipos CarSpecs, CarSetup |
| `app/(dashboard)/garage/page.tsx` | Refatorar - Server Component |
| `app/(dashboard)/garage/GarageFilters.tsx` | Novo - Filtros |
| `app/(dashboard)/garage/GarageGrid.tsx` | Novo - Grid de cards |
| `app/(dashboard)/garage/CarCard.tsx` | Novo - Card individual |
| `app/(dashboard)/garage/CarDetailModal.tsx` | Novo - Modal de detalhes |
| `app/(dashboard)/garage/CarSpecs.tsx` | Novo - Seção specs |
| `app/(dashboard)/garage/CarTracks.tsx` | Novo - Seção pistas |
| `app/(dashboard)/garage/CarSetups.tsx` | Novo - Seção setups |
| `app/(dashboard)/garage/SetupDetails.tsx` | Novo - Detalhes do setup |
| `app/api/cars/specs/route.ts` | Novo - API specs |
| `app/api/cars/setups/route.ts` | Novo - API setups |
| `app/api/cars/setups/[id]/active/route.ts` | Novo - API toggle ativo |

### 5.2 Arquivos a Modificar

| Arquivo | Modificação |
|---------|-------------|
| `lib/types.ts` | Adicionar novos tipos |
| `app/(dashboard)/garage/actions.ts` | Adicionar actions para favorito |

### 5.3 Arquivos a Remover

| Arquivo | Motivo |
|---------|--------|
| `app/(dashboard)/garage/GarageCarList.tsx` | Substituído por GarageGrid |
| `app/(dashboard)/garage/CarBannerImage.tsx` | Banner removido do design |

---

## 6. Considerações Técnicas

### 6.1 Performance

- Filtros com URL params para SSR
- Grid com virtualização se > 50 carros
- Modal carrega dados on-demand (não prefetch)

### 6.2 Responsividade

| Breakpoint | Grid Cols | Filtros |
|------------|-----------|---------|
| < 640px | 1 | Colapsados |
| 640-768px | 2 | Colapsados |
| 768-1024px | 3 | Visíveis |
| > 1024px | 4 | Visíveis |

### 6.3 Acessibilidade

- Cards com role="button" e tabindex
- Modal com focus trap
- Escape fecha modal
- Aria labels nos filtros

---

## 7. Fora do Escopo

- Upload manual de imagens de carros
- Edição de specs pelo usuário
- Compartilhamento de setups entre usuários
- Comparação lado-a-lado de setups
- Histórico de versões de setups

---

## 8. Critérios de Aceitação

1. [ ] Usuário pode filtrar carros por classe, marca, favoritos, sessões recentes
2. [ ] Usuário pode buscar carros por nome
3. [ ] Grid exibe carros ordenados por uso
4. [ ] Click no card abre modal de detalhes
5. [ ] Modal exibe specs quando disponíveis
6. [ ] Modal exibe pistas conhecidas com tempos
7. [ ] Modal exibe setups quando disponíveis
8. [ ] Usuário pode marcar carro como favorito no modal
9. [ ] API aceita upsert de specs do agente
10. [ ] API aceita upsert de setups do agente
11. [ ] Estados vazios são tratados elegantemente

---

## 9. Plano de Execução com Multi-Agentes

A implementação será dividida em tarefas paralelas independentes:

### Fase 1: Fundação (Paralelo)
- **Agente 1:** Migration SQL + tipos TypeScript
- **Agente 2:** API routes (specs, setups)

### Fase 2: UI Listagem (Paralelo)
- **Agente 3:** GarageFilters + lógica de filtros
- **Agente 4:** GarageGrid + CarCard

### Fase 3: UI Modal (Paralelo)
- **Agente 5:** CarDetailModal + CarSpecs
- **Agente 6:** CarTracks + CarSetups + SetupDetails

### Fase 4: Integração
- **Agente 7:** Page.tsx final + cleanup de arquivos antigos

### Fase 5: Agente Local
- **Separado:** Adaptar agente Python/Node para enviar specs e setups
