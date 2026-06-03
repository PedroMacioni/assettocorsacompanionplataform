# Telemetry Track Map — Spec

**Data:** 2026-06-02  
**Status:** Em revisão  
**Feature:** Mapa 2D interativo da pista com heatmap de velocidade e setores  

---

## 1. Visão Geral

### O que é

Um mapa 2D interativo gerado a partir de telemetria real do carro durante a sessão. Ao abrir os detalhes de uma sessão, o usuário verá o traçado da pista colorido por velocidade (heatmap), com marcadores nos limites de setor e os tempos S1/S2/S3 posicionados na pista.

### Por que é diferencial

Plataformas como Track Titan, RaceLab e MoTeC fazem exatamente isso. É o tipo de visualização que transforma dados brutos em insight visual imediato: onde o carro está lento (frenagem), onde está na faixa de potência, e se o motorista perdeu tempo no S2 porque saiu largo em uma curva específica.

### O que o usuário vê

```
┌──────────────────────────────────────────────────────────────┐
│  MAPA DA PISTA                              [Velocidade ▼]   │
│                                                              │
│         ╭────────────────────────────╮                       │
│         │  speed heatmap track path  │   S1  0:28.451        │
│         │  (blue→green→yellow→red)   │   S2  1:06.800        │
│    S1●  │                            │   S3  0:42.833        │
│         │        ●S2         ●S3     │                       │
│         ╰────────────────────────────╯                       │
│                                                              │
│  Hover: 234 km/h · Throttle 97% · Lap 2:17.4 @ 1:05.2      │
│                                                              │
│  ━━━━━━━━ Velocidade   Throttle   Brake                     │
└──────────────────────────────────────────────────────────────┘
```

---

## 2. Arquitetura de Dados

### 2.1 Pipeline completo

```
AC (rodando)
  ↓  shared memory (20Hz)
CompanionAgent (C# - TelemetryCollector)
  ↓  buffer por volta
  ↓  detecção de lap completion
  ↓  seleção da melhor volta
  ↓  upload após sessão terminar
Supabase (lap_telemetry table)
  ↓  query na abertura da tela de sessão
Web App (TrackMap component)
  ↓  normalização de coordenadas
  ↓  canvas rendering com heatmap
  ↓  interatividade via hover
```

### 2.2 Shared Memory do Assetto Corsa (original)

O AC expõe três arquivos de memória mapeada em Windows:

| Arquivo | Freq. | Campos relevantes |
|---------|-------|-------------------|
| `Local\acpmf_physics` | 333Hz | `speedKmh`, `gas` (throttle), `brake`, `gear` |
| `Local\acpmf_graphics` | 60Hz | `carCoordinates[60][3]` (X,Y,Z), `normalizedCarPosition` (0-1), `completedLaps`, `iCurrentTime`, `currentSectorIndex`, `lastSectorTime`, `status` |
| `Local\acpmf_static` | 1x | `carModel`, `track`, `sectorCount` |

Campos-chave para o mapa:

```csharp
// De Graphics (60Hz)
float[] carCoordinates[0] = { X, Y, Z };   // posição do carro no mundo
float normalizedCarPosition;                 // 0.0 (linha de largada) → 1.0 (fim da volta)
int completedLaps;                           // incrementa ao cruzar a linha
int iCurrentTime;                            // tempo da volta atual em ms
int currentSectorIndex;                      // 0, 1, 2
int lastSectorTime;                          // tempo do último setor completado

// De Physics (333Hz) 
float speedKmh;
float gas;    // throttle 0-1
float brake;  // 0-1
```

> **Importante:** O `CollectorCore` usa `Thomsen.AccTools.SharedMemory` que é para **ACC** (Assetto Corsa Competizione). O AC original usa arquivos de memória diferentes (`acpmf_*` vs `acpmf_*` da ACC). Precisamos implementar o leitor para AC original via `MemoryMappedFile` do .NET, que é direto.

### 2.3 O que capturar

Amostragem a **20Hz** (a cada 50ms) durante a sessão. Para cada frame:

```csharp
record TelemetryFrame(
    float X,           // carCoordinates[0][0] — mundo
    float Z,           // carCoordinates[0][2] — mundo (Y é altitude, ignora)
    float Speed,       // speedKmh
    float Throttle,    // gas 0-1
    float Brake,       // brake 0-1
    float NormPos,     // normalizedCarPosition 0.0-1.0
    int   LapTimeMs    // iCurrentTime
);
```

**O que fazemos com os dados:**
- Ao detectar `completedLaps++`, a volta atual está completa
- Armazenar telemetria de TODAS as voltas válidas (sem corte)
- Após a sessão, enviar apenas a **melhor volta** para o Supabase (mantém volume manejável)
- Registrar `normalizedCarPosition` no momento em que cada setor completa (para posicionar marcadores no mapa)

**Volume estimado:**
- 2-minute lap × 20Hz = 2.400 frames
- 6 floats + 1 int = 7 × 4 bytes = 28 bytes/frame
- Total: ~67KB/volta (raw) → ~15-25KB (JSON com 1 decimal, delta encoding)
- Para usuário com 200 sessões: ~4MB total — muito tranquilo no Supabase

---

## 3. Schema do Banco de Dados

### Tabela `lap_telemetry`

```sql
CREATE TABLE lap_telemetry (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            uuid NOT NULL REFERENCES auth.users(id),
  session_source_id  text NOT NULL,
  lap_number         integer NOT NULL,
  
  -- Dados compactados da volta
  -- Formato: {"p":[[x,z,v,g,b],...], "s":[pos_s1,pos_s2], "mv":280, "dur":137453}
  -- p = array de pontos [x, z, speed, throttle, brake]
  -- s = normalizedCarPosition nos limites de setor
  -- mv = max_speed da volta
  -- dur = duração da volta em ms
  data               jsonb NOT NULL,
  
  sample_hz          smallint NOT NULL DEFAULT 20,
  synced_at          timestamptz NOT NULL DEFAULT now(),
  
  UNIQUE (user_id, session_source_id, lap_number)
);

-- Índice para busca por sessão
CREATE INDEX idx_lap_telemetry_session 
  ON lap_telemetry (user_id, session_source_id);

-- RLS
ALTER TABLE lap_telemetry ENABLE ROW LEVEL SECURITY;

CREATE POLICY "lap_telemetry_owner" ON lap_telemetry
  FOR ALL USING (auth.uid() = user_id);
```

### Formato do campo `data` (JSONB)

```json
{
  "p": [
    [1234.5, -890.2, 0, 0, 0],
    [1235.1, -889.8, 42, 0.3, 0],
    [1240.0, -885.0, 287, 1.0, 0],
    ...
  ],
  "s": [0.332, 0.678],
  "mv": 287,
  "dur": 137453
}
```

- `p`: array de `[x, z, speed_kmh, throttle_pct, brake_pct]` — valores inteiros para x/z (metros, 1 decimal), speed inteiro, throttle/brake × 100 como inteiro
- `s`: normalizedCarPosition no final do S1 e S2 (o S3 termina em 1.0)
- `mv`: velocidade máxima da volta (para normalizar o heatmap)
- `dur`: duração em ms (confirma que é a melhor volta)

---

## 4. Componente Web — TrackMap

### 4.1 Stack de renderização

**Canvas 2D** (não SVG, não WebGL):
- SVG: bom para poucos elementos, mas 2.400 `<circle>` é lento para hover
- WebGL: overkill, dependência pesada
- Canvas 2D: ideal — rápido, sem dependências, controle total do rendering

### 4.2 Normalização de coordenadas

```typescript
// Coordenadas do mundo AC variam por pista (-2000 a +2000 metros)
// Normalizamos para o espaço do canvas preservando proporção

function normalizeToCanvas(
  points: [number, number][],  // [x, z]
  width: number,
  height: number,
  padding = 0.06
): [number, number][] {
  const xs = points.map(p => p[0]);
  const zs = points.map(p => p[1]);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minZ = Math.min(...zs), maxZ = Math.max(...zs);
  const rangeX = maxX - minX || 1;
  const rangeZ = maxZ - minZ || 1;
  const range = Math.max(rangeX, rangeZ);          // quadrado que abriga tudo
  const offX = (range - rangeX) / 2;               // centralizar
  const offZ = (range - rangeZ) / 2;
  const inner = 1 - 2 * padding;
  
  return points.map(([x, z]) => [
    ((x - minX + offX) / range * inner + padding) * width,
    ((z - minZ + offZ) / range * inner + padding) * height,
  ]);
}
```

### 4.3 Heatmap de velocidade

Convenção adotada (padrão motorsport):
- **Azul/roxo** = muito lento (frenagem pesada, curva lenta)
- **Ciano/verde** = velocidade média
- **Amarelo** = velocidade alta
- **Vermelho/laranja** = tudo aberto (reta)

```typescript
function speedToHsl(speed: number, maxSpeed: number): string {
  const r = Math.min(speed / (maxSpeed * 0.9), 1); // ratio 0-1
  // Mapear: 0.0 = 240° (azul) → 1.0 = 0° (vermelho)
  const hue = 240 - r * 240;
  const sat = 85 + r * 15;
  const lig = 45 + r * 10;
  return `hsl(${hue.toFixed(0)},${sat}%,${lig}%)`;
}
```

### 4.4 Renderização por segmentos

Para colorir cada trecho da pista com a velocidade correspondente:

```typescript
// Para cada par consecutivo de pontos, traçar um segmento colorido
for (let i = 1; i < normalized.length; i++) {
  const [x1, y1] = normalized[i - 1];
  const [x2, y2] = normalized[i];
  const speed = data.p[i][2];  // campo speed
  
  ctx.beginPath();
  ctx.strokeStyle = speedToHsl(speed, data.mv);
  ctx.lineWidth = lineWidth;
  ctx.lineCap = "round";
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
}
```

### 4.5 Marcadores de setor

```typescript
// data.s = [normPos_S1_end, normPos_S2_end]
// Encontrar o ponto no array cujo normalizedPos é mais próximo
const s1Index = findClosestPoint(points, data.s[0]);
const s2Index = findClosestPoint(points, data.s[1]);

// Renderizar círculo colorido + label
drawSectorMarker(ctx, normalized[s1Index], "S2", s2Time);
drawSectorMarker(ctx, normalized[s2Index], "S3", s3Time);
```

### 4.6 Interatividade (hover)

```typescript
// Mouse move no canvas: encontrar ponto mais próximo
canvas.addEventListener("mousemove", (e) => {
  const rect = canvas.getBoundingClientRect();
  const mx = (e.clientX - rect.left) * (canvas.width / rect.width);
  const my = (e.clientY - rect.top) * (canvas.height / rect.height);
  
  const closest = findClosestCanvasPoint(normalized, mx, my, threshold = 15);
  if (closest !== null) {
    const frame = data.p[closest];
    setHoverInfo({
      speed: frame[2],
      throttle: frame[3],
      brake: frame[4],
      lapTime: /* calcular a partir do index e sample_hz */
    });
  }
});
```

### 4.7 Modos de visualização (toggle)

Além de velocidade, o usuário pode ver:
- **Throttle**: verde escuro (fundo) → verde brilhante (100% throttle)
- **Brake**: cinza → vermelho escuro (100% brake)

Implementado como um dropdown/tabs no card do mapa.

---

## 5. Experiência do Usuário

### 5.1 Layout na tela de sessão

O mapa entra no **sidebar direito** de análise, acima da consistência, substituindo o placeholder atual de `MapPin`. Dimensão: 288px × ~220px (ratio da pista).

```
┌─────────────────────────────────────┐
│ [mapa 2D heatmap]          [V|T|B] │  ← toggle velocidade/throttle/brake
│ Hover: 287 km/h · 100% throttle    │
├─────────────────────────────────────┤
│ CONSISTÊNCIA          85 Excelente  │
│ ...                                 │
├─────────────────────────────────────┤
│ VOLTA TEÓRICA  2:16.891             │
│ ...                                 │
└─────────────────────────────────────┘
```

### 5.2 Estados

| Estado | O que mostrar |
|--------|--------------|
| Sessão tem telemetria | Mapa colorido com heatmap |
| Sessão sem telemetria (antiga) | Card com outline estática da pista (outline_url) + CTA "Telemetria disponível para sessões futuras" |
| Pista sem outline_url | Placeholder com ícone |
| Carregando | Skeleton do shape do mapa |

### 5.3 Loading progressivo

1. Renderizar outline da pista imediatamente (pontos sem cor)
2. Aplicar heatmap quando dados carregarem
3. Adicionar marcadores de setor
4. Habilitar interatividade

---

## 6. Implementação no Agente (C#)

### 6.1 AC original shared memory

O AC original expõe shared memory via arquivos `MemoryMappedFile`:

```csharp
// Nomes dos arquivos de shared memory do AC original
const string PhysicsFile  = "Local\\acpmf_physics";
const string GraphicsFile = "Local\\acpmf_graphics";
const string StaticFile   = "Local\\acpmf_static";
```

Structs documentadas oficialmente pelo Kunos. Tamanhos:
- Physics: 1200 bytes (328 floats + ints)
- Graphics: 1720 bytes
- Static: 820 bytes

Implementaremos `AcSharedMemoryReader.cs` usando `MemoryMappedFile.OpenExisting()` + `MemoryMappedViewAccessor.Read<T>()`.

### 6.2 TelemetryCollector

```csharp
public class TelemetryCollector : IDisposable
{
    // Timer de 50ms (20Hz) lendo Physics + Graphics
    // Estado: { currentLapBuffer, bestLapData, lastCompletedLaps }
    
    // Ao detectar completedLaps++:
    //   1. Calcular lap time do buffer
    //   2. Se válida (sem corte, tempo razoável): comparar com bestLapData
    //   3. Se é nova melhor: salvar buffer como bestLapData
    //   4. Limpar buffer para nova volta
    
    // Ao detectar status = OFF (sessão terminou):
    //   1. Emitir evento TelemetrySessionCompleted
    //   2. SyncWorker captura e faz upload
    
    public event EventHandler<LapTelemetryData>? BestLapUpdated;
    public event EventHandler<SessionTelemetryResult>? SessionCompleted;
}
```

### 6.3 Integração no SyncWorker

```csharp
// SyncWorker já tem o loop de sync. Adicionar:
// 1. Iniciar TelemetryCollector quando app sobe
// 2. Ao receber SessionCompleted com bestLap != null:
//    - Fazer upload para lap_telemetry via SupabaseClient
//    - Associar ao session_source_id correto (via timestamp)
```

---

## 7. Não está no escopo (v1)

- Comparação de duas voltas sobrepostas no mapa (v2)
- Mapa em tempo real enquanto a sessão está rolando (v2)
- Dados de temperatura de pneu sobrepostos no mapa (v2)
- Exportar imagem do mapa (v2)
- Telemetria de múltiplos carros / amigos (v3)

---

## 8. Decisões técnicas

| Decisão | Escolha | Justificativa |
|---------|---------|---------------|
| Renderização | Canvas 2D | Performance para 2.400 pontos com hover; sem deps |
| Formato de dados | JSONB compacto | Simples, consulta rápida, sem infra extra |
| Frequência de amostragem | 20Hz | Suficiente para visualização; 60Hz é excessivo |
| O que armazenar | Melhor volta por sessão | Volume razoável, dado mais útil |
| Shared memory AC original | Implementar próprio via MemoryMappedFile | Biblioteca existente (CollectorCore) é para ACC |
| Orientação do mapa | Auto-detect via PCA / eixo mais longo | Tracks ficam naturalmente orientadas |

---

## 9. Riscos

| Risco | Probabilidade | Mitigação |
|-------|--------------|-----------|
| Usuário não tem sessões novas (dados históricos não têm telemetria) | Certo | Mostrar estado gracioso com outline_url estática |
| Coordenadas AC de alguns mods ficam estranhas | Médio | Filtrar outliers antes de normalizar (percentil 1-99) |
| Usuário fecha AC antes da sessão terminar | Médio | Salvar telemetria ao detectar status = OFF ou no app closing |
| Volume de dados em usuários heavy (1000+ sessões) | Baixo | Só armazenamos melhor volta; quota Supabase é 500MB free |
| Package Thomsen é apenas ACC | Confirmado | Implementar AcSharedMemoryReader próprio (bem documentado) |
