# Plano: Telemetry Track Map

**Data:** 2026-06-02  
**Spec:** `docs/superpowers/specs/2026-06-02-telemetry-track-map.md`  
**Branch:** `feat/telemetry-track-map`  

---

## Visão Geral

4 fases independentes. Cada fase termina com um commit funcional.

```
Fase 1: DB + Types          → schema pronto, tipos TypeScript
Fase 2: Agent Collection    → agente capturando e enviando dados
Fase 3: Web Rendering       → mapa renderizado com heatmap
Fase 4: Polish              → hover, toggle de modo, estados vazios
```

---

## Fase 1 — Fundação (DB + Tipos)

**Objetivo:** Schema criado no Supabase, tipos atualizados no frontend, build ainda passa.

### Task 1.1 — Migration SQL

**Arquivo:** `supabase/migrations/0007_lap_telemetry.sql`

```sql
-- Tabela principal de telemetria por volta
CREATE TABLE lap_telemetry (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_source_id  text NOT NULL,
  lap_number         integer NOT NULL,
  data               jsonb NOT NULL,
  sample_hz          smallint NOT NULL DEFAULT 20,
  synced_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, session_source_id, lap_number)
);

CREATE INDEX idx_lap_telemetry_session
  ON lap_telemetry (user_id, session_source_id);

ALTER TABLE lap_telemetry ENABLE ROW LEVEL SECURITY;

CREATE POLICY "lap_telemetry_owner" ON lap_telemetry
  FOR ALL USING (auth.uid() = user_id);
```

### Task 1.2 — Tipos TypeScript

**Arquivo:** `apps/web/lib/types.ts` — adicionar:

```typescript
export type TelemetryPoint = [
  number,  // 0: x (world coordinate)
  number,  // 1: z (world coordinate)
  number,  // 2: speed km/h
  number,  // 3: throttle 0-100
  number,  // 4: brake 0-100
];

export type LapTelemetryData = {
  p: TelemetryPoint[];   // points array
  s: number[];           // normalizedCarPosition dos limites de setor [s1_end, s2_end]
  mv: number;            // max speed
  dur: number;           // duration ms
};

export type LapTelemetry = {
  id: string;
  session_source_id: string;
  lap_number: number;
  data: LapTelemetryData;
  sample_hz: number;
  synced_at: string;
};
```

### Task 1.3 — Query function

**Arquivo:** `apps/web/lib/queries.ts` — adicionar:

```typescript
export async function getLapTelemetry(
  userId: string,
  sessionSourceId: string,
): Promise<LapTelemetry | null> {
  "use cache";
  cacheLife("hours");
  cacheTag(`user:${userId}`, `user:${userId}:telemetry`);
  
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("lap_telemetry")
    .select("*")
    .eq("user_id", userId)
    .eq("session_source_id", sessionSourceId)
    .order("lap_number", { ascending: true })
    .limit(1)   // melhor volta (menor lap_number do conjunto enviado)
    .maybeSingle();
    
  return data as LapTelemetry | null;
}
```

> Na verdade vamos buscar a volta com menor `dur` (duração = melhor tempo):

```typescript
  // Ordenar por data->>'dur' para garantir que pegamos a melhor volta
  .order("data->>'dur'", { ascending: true })
```

**Commit 1:** `feat: add lap_telemetry schema and TypeScript types`

---

## Fase 2 — Agent: Captura de Telemetria

**Objetivo:** Agent lendo shared memory do AC e enviando dados para o Supabase.

### Task 2.1 — Structs AC original shared memory

**Arquivo:** `packages/Companion.Infrastructure/Telemetry/AcMemoryStructs.cs`

Implementar os structs exatos do AC original (documentação Kunos):

```csharp
using System.Runtime.InteropServices;

namespace Companion.Infrastructure.Telemetry;

[StructLayout(LayoutKind.Sequential, Pack = 4)]
public struct AcPhysics
{
    public int    PacketId;
    public float  Gas;           // throttle 0-1
    public float  Brake;         // 0-1
    public float  Fuel;
    public int    Gear;
    public int    Rpms;
    public float  SteerAngle;
    public float  SpeedKmh;
    [MarshalAs(UnmanagedType.ByValArray, SizeConst = 3)]
    public float[] Velocity;     // X,Y,Z velocity
    [MarshalAs(UnmanagedType.ByValArray, SizeConst = 3)]
    public float[] AccG;
    [MarshalAs(UnmanagedType.ByValArray, SizeConst = 4)]
    public float[] WheelSlip;
    // ... campos adicionais (necessários para tamanho correto do struct)
    // Ver: https://www.assettocorsa.net/forum/index.php?threads/shared-memory-among-ac-app.3290/
}

[StructLayout(LayoutKind.Sequential, Pack = 4)]
public struct AcGraphics
{
    public int    PacketId;
    public int    Status;          // 0=OFF 1=REPLAY 2=LIVE 3=PAUSE
    public int    Session;
    [MarshalAs(UnmanagedType.ByValArray, SizeConst = 15)]
    public char[] CurrentTime;
    [MarshalAs(UnmanagedType.ByValArray, SizeConst = 15)]
    public char[] LastTime;
    [MarshalAs(UnmanagedType.ByValArray, SizeConst = 15)]
    public char[] BestTime;
    [MarshalAs(UnmanagedType.ByValArray, SizeConst = 15)]
    public char[] Split;
    public int    CompletedLaps;
    public int    Position;
    public int    ICurrentTime;    // volta atual em ms ← chave
    public int    ILastTime;
    public int    IBestTime;
    public float  SessionTimeLeft;
    public float  DistanceTraveled;
    public int    IsInPit;
    public int    CurrentSectorIndex;  // 0,1,2
    public int    LastSectorTime;      // ms do setor recém completado
    public int    NumberOfLaps;
    [MarshalAs(UnmanagedType.ByValArray, SizeConst = 33)]
    public char[] TyreCompound;
    public float  ReplayTimeMultiplier;
    public float  NormalizedCarPosition;  // 0.0-1.0 ← posição na pista
    public int    ActiveCars;
    [MarshalAs(UnmanagedType.ByValArray, SizeConst = 180)]  // 60 cars × 3 floats
    public float[] CarCoordinates;  // carCoordinates[car][xyz] ← posição do carro
    // ... campos adicionais
}

[StructLayout(LayoutKind.Sequential, Pack = 4)]
public struct AcStatic
{
    [MarshalAs(UnmanagedType.ByValArray, SizeConst = 33)]
    public char[] SmVersion;
    [MarshalAs(UnmanagedType.ByValArray, SizeConst = 33)]
    public char[] AcVersion;
    public int    NumberOfSessions;
    public int    NumberOfCars;
    [MarshalAs(UnmanagedType.ByValArray, SizeConst = 33)]
    public char[] CarModel;
    [MarshalAs(UnmanagedType.ByValArray, SizeConst = 33)]
    public char[] Track;        // track_id ← importante para associar ao session
    [MarshalAs(UnmanagedType.ByValArray, SizeConst = 33)]
    public char[] PlayerName;
    // ...
    public int    SectorCount;  // quantos setores
}
```

**Helpers:**
```csharp
public static class AcStructHelper
{
    // Ler carCoordinates[0] = jogador (índice 0)
    public static (float X, float Y, float Z) GetPlayerPosition(AcGraphics g)
        => (g.CarCoordinates[0], g.CarCoordinates[1], g.CarCoordinates[2]);
    
    // Converter char[] para string
    public static string CharsToString(char[] chars)
        => new string(chars).TrimEnd('\0');
}
```

### Task 2.2 — AcSharedMemoryReader

**Arquivo:** `packages/Companion.Infrastructure/Telemetry/AcSharedMemoryReader.cs`

```csharp
using System.IO.MemoryMappedFiles;
using System.Runtime.InteropServices;

namespace Companion.Infrastructure.Telemetry;

public sealed class AcSharedMemoryReader : IDisposable
{
    private const string PhysicsFile  = "Local\\acpmf_physics";
    private const string GraphicsFile = "Local\\acpmf_graphics";
    private const string StaticFile   = "Local\\acpmf_static";

    private MemoryMappedFile? _physicsMap, _graphicsMap, _staticMap;
    private MemoryMappedViewAccessor? _physicsView, _graphicsView, _staticView;

    public bool TryConnect()
    {
        try
        {
            _physicsMap   = MemoryMappedFile.OpenExisting(PhysicsFile);
            _graphicsMap  = MemoryMappedFile.OpenExisting(GraphicsFile);
            _staticMap    = MemoryMappedFile.OpenExisting(StaticFile);
            _physicsView  = _physicsMap.CreateViewAccessor();
            _graphicsView = _graphicsMap.CreateViewAccessor();
            _staticView   = _staticMap.CreateViewAccessor();
            return true;
        }
        catch (FileNotFoundException) { return false; }
    }

    public AcPhysics?  ReadPhysics()  => TryRead<AcPhysics>(_physicsView);
    public AcGraphics? ReadGraphics() => TryRead<AcGraphics>(_graphicsView);
    public AcStatic?   ReadStatic()   => TryRead<AcStatic>(_staticView);

    private static T? TryRead<T>(MemoryMappedViewAccessor? view) where T : struct
    {
        if (view is null) return null;
        view.Read<T>(0, out var result);
        return result;
    }

    public void Dispose() { /* dispose todos os handles */ }
}
```

### Task 2.3 — TelemetryFrame e LapBuffer

**Arquivo:** `packages/Companion.Domain/Telemetry/TelemetryFrame.cs`

```csharp
namespace Companion.Domain.Telemetry;

public record TelemetryFrame(
    float X,
    float Z,
    float SpeedKmh,
    float Throttle,       // 0-1
    float Brake,          // 0-1
    float NormPos,        // normalizedCarPosition 0-1
    int   LapTimeMs
);

public class LapBuffer
{
    private readonly List<TelemetryFrame> _frames = new();
    private float? _sectorBoundary1;  // normPos quando S1 completa
    private float? _sectorBoundary2;  // normPos quando S2 completa

    public int FrameCount => _frames.Count;

    public void AddFrame(TelemetryFrame frame) => _frames.Add(frame);

    public void RecordSectorBoundary(int sectorIndex, float normPos)
    {
        if (sectorIndex == 0) _sectorBoundary1 = normPos;
        else if (sectorIndex == 1) _sectorBoundary2 = normPos;
    }

    public CompletedLapTelemetry? Finish(int lapTimeMs, bool hasCut)
    {
        if (hasCut || _frames.Count < 100) return null;  // muito poucos frames
        
        var maxSpeed = _frames.Max(f => f.SpeedKmh);
        var sectors = new List<float>();
        if (_sectorBoundary1.HasValue) sectors.Add(_sectorBoundary1.Value);
        if (_sectorBoundary2.HasValue) sectors.Add(_sectorBoundary2.Value);
        
        return new CompletedLapTelemetry(_frames.ToList(), sectors, maxSpeed, lapTimeMs);
    }

    public void Clear()
    {
        _frames.Clear();
        _sectorBoundary1 = null;
        _sectorBoundary2 = null;
    }
}

public record CompletedLapTelemetry(
    IReadOnlyList<TelemetryFrame> Frames,
    IReadOnlyList<float> SectorBoundaries,
    float MaxSpeed,
    int DurationMs
);
```

### Task 2.4 — TelemetryCollector

**Arquivo:** `packages/Companion.Infrastructure/Telemetry/TelemetryCollector.cs`

```csharp
public sealed class TelemetryCollector : IDisposable
{
    private readonly AcSharedMemoryReader _reader = new();
    private readonly LapBuffer _buffer = new();
    private Timer? _timer;
    
    private int _lastCompletedLaps = -1;
    private int _lastSectorIndex = -1;
    private CompletedLapTelemetry? _bestLap;
    private int _bestLapTime = int.MaxValue;
    private bool _sessionActive;
    
    public bool IsConnected { get; private set; }
    
    public event EventHandler<CompletedLapTelemetry>? BestLapCompleted;
    public event EventHandler<SessionTelemetryResult>? SessionEnded;

    public void Start()
    {
        // Tentar conectar na shared memory
        // Se não conseguir, tentar novamente a cada 5s
        _timer = new Timer(OnTick, null, TimeSpan.Zero, TimeSpan.FromMilliseconds(50));
    }

    private void OnTick(object? _)
    {
        if (!IsConnected)
        {
            IsConnected = _reader.TryConnect();
            return;
        }

        var physics  = _reader.ReadPhysics();
        var graphics = _reader.ReadGraphics();
        if (physics is null || graphics is null) return;

        var g = graphics.Value;
        var p = physics.Value;

        // Sessão ao vivo?
        if (g.Status != 2 /* LIVE */)
        {
            if (_sessionActive) EndSession();
            return;
        }

        _sessionActive = true;
        var (x, _, z) = AcStructHelper.GetPlayerPosition(g);

        // Capturar frame
        _buffer.AddFrame(new TelemetryFrame(
            X: x, Z: z,
            SpeedKmh: p.SpeedKmh,
            Throttle: p.Gas,
            Brake: p.Brake,
            NormPos: g.NormalizedCarPosition,
            LapTimeMs: g.ICurrentTime
        ));

        // Detectar troca de setor
        if (g.CurrentSectorIndex != _lastSectorIndex && _lastSectorIndex >= 0)
        {
            _buffer.RecordSectorBoundary(_lastSectorIndex, g.NormalizedCarPosition);
        }
        _lastSectorIndex = g.CurrentSectorIndex;

        // Detectar volta completa
        if (g.CompletedLaps > _lastCompletedLaps && _lastCompletedLaps >= 0)
        {
            var lapTime = g.ILastTime;
            var hasCut = /* verificar via SyncCache ou outro mecanismo */ false;
            var completed = _buffer.Finish(lapTime, hasCut);
            _buffer.Clear();

            if (completed is not null && lapTime < _bestLapTime)
            {
                _bestLapTime = lapTime;
                _bestLap = completed;
                BestLapCompleted?.Invoke(this, completed);
            }
        }
        _lastCompletedLaps = g.CompletedLaps;
    }

    private void EndSession()
    {
        _sessionActive = false;
        if (_bestLap is not null)
        {
            SessionEnded?.Invoke(this, new SessionTelemetryResult(_bestLap, _bestLapTime));
            _bestLap = null;
            _bestLapTime = int.MaxValue;
        }
        _lastCompletedLaps = -1;
        _lastSectorIndex = -1;
        _buffer.Clear();
    }
}

public record SessionTelemetryResult(
    CompletedLapTelemetry BestLap,
    int BestLapTimeMs
);
```

### Task 2.5 — DTO para upload

**Arquivo:** `packages/Companion.SharedContracts/Telemetry/LapTelemetryDto.cs`

```csharp
using System.Text.Json.Serialization;

namespace Companion.SharedContracts.Telemetry;

public class LapTelemetryDto
{
    [JsonPropertyName("user_id")]
    public required string UserId { get; init; }
    
    [JsonPropertyName("session_source_id")]
    public required string SessionSourceId { get; init; }
    
    [JsonPropertyName("lap_number")]
    public int LapNumber { get; init; }
    
    [JsonPropertyName("data")]
    public required TelemetryDataDto Data { get; init; }
    
    [JsonPropertyName("sample_hz")]
    public int SampleHz { get; init; } = 20;
}

public class TelemetryDataDto
{
    // [[x, z, speed, throttle_pct, brake_pct], ...]
    // Compactar: x/z com 1 decimal, speed inteiro, throttle/brake × 100 inteiro
    [JsonPropertyName("p")]
    public required int[][] Points { get; init; }
    
    [JsonPropertyName("s")]
    public required float[] SectorBoundaries { get; init; }
    
    [JsonPropertyName("mv")]
    public int MaxSpeed { get; init; }
    
    [JsonPropertyName("dur")]
    public int DurationMs { get; init; }
}

// Mapper: CompletedLapTelemetry → TelemetryDataDto
public static class TelemetryMapper
{
    public static TelemetryDataDto ToDto(CompletedLapTelemetry lap)
    {
        var points = lap.Frames
            .Where((_, i) => i % 1 == 0)  // usar todos, ou a cada N para reduzir
            .Select(f => new[]
            {
                (int)(f.X * 10),           // 1 decimal de precisão
                (int)(f.Z * 10),
                (int)f.SpeedKmh,
                (int)(f.Throttle * 100),
                (int)(f.Brake * 100),
            })
            .ToArray();
        
        return new TelemetryDataDto
        {
            Points = points,
            SectorBoundaries = lap.SectorBoundaries.ToArray(),
            MaxSpeed = (int)lap.MaxSpeed,
            DurationMs = lap.DurationMs,
        };
    }
}
```

### Task 2.6 — SupabaseClient: upload de telemetria

**Arquivo:** `CompanionAgent.Core/SupabaseClient.cs` — adicionar método:

```csharp
public async Task<bool> UpsertLapTelemetryAsync(
    LapTelemetryDto dto, 
    CancellationToken ct = default)
{
    return await UpsertAsync("lap_telemetry", dto, ct);
}
```

### Task 2.7 — SyncWorker: integrar TelemetryCollector

**Arquivo:** `CompanionAgent.Core/SyncWorker.cs`

```csharp
// No constructor: injetar TelemetryCollector
// No Start(): _telemetryCollector.Start()
// Handler SessionEnded:
//   → Buscar session_source_id pela timestamp mais recente no SyncCache
//   → Criar LapTelemetryDto com dados da melhor volta
//   → Chamar _supabaseClient.UpsertLapTelemetryAsync()
```

**Commit 2:** `feat: agent captures AC telemetry and uploads best lap`

---

## Fase 3 — Web: Renderização do Mapa

**Objetivo:** Componente TrackMap funcional com heatmap de velocidade e marcadores de setor.

### Task 3.1 — Buscar telemetria na page.tsx

**Arquivo:** `apps/web/app/(dashboard)/sessions/[sourceId]/page.tsx`

Adicionar ao segundo `Promise.all`:
```typescript
getLapTelemetry(user.id, sourceId),
```

Adicionar ao `SessionDetailData`:
```typescript
telemetry: LapTelemetry | null;
```

### Task 3.2 — Utilitários do mapa

**Arquivo:** `apps/web/app/(dashboard)/sessions/[sourceId]/track-map-utils.ts`

```typescript
import type { LapTelemetryData, TelemetryPoint } from "@/lib/types";

export type CanvasPoint = { cx: number; cy: number; speed: number; throttle: number; brake: number; normPos: number };

// Normalizar coordenadas mundo → canvas
export function normalizePoints(
  points: TelemetryPoint[],
  width: number,
  height: number,
  padding = 0.06
): CanvasPoint[] {
  const xs = points.map(p => p[0] / 10);  // descompactar (foi ×10 no agent)
  const zs = points.map(p => p[1] / 10);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minZ = Math.min(...zs), maxZ = Math.max(...zs);
  const rangeX = maxX - minX || 1;
  const rangeZ = maxZ - minZ || 1;
  const range = Math.max(rangeX, rangeZ);
  const offX = (range - rangeX) / 2;
  const offZ = (range - rangeZ) / 2;
  const inner = 1 - 2 * padding;

  return points.map(p => ({
    cx: ((p[0] / 10 - minX + offX) / range * inner + padding) * width,
    cy: ((p[1] / 10 - minZ + offZ) / range * inner + padding) * height,
    speed: p[2],
    throttle: p[3],
    brake: p[4],
    normPos: 0,  // não temos normPos no ponto — calculado via índice/total
  }));
}

// Velocidade → cor HSL (azul=lento, vermelho=rápido)
export function speedToColor(speed: number, maxSpeed: number): string {
  const r = Math.min(speed / (maxSpeed * 0.92), 1);
  const hue = Math.round(240 - r * 240);
  return `hsl(${hue},90%,${48 + r * 8}%)`;
}

// Throttle → cor (cinza → verde)
export function throttleToColor(throttle: number): string {
  const g = Math.round(80 + throttle * 175);
  return `rgb(0,${g},0)`;
}

// Brake → cor (cinza → vermelho)
export function brakeToColor(brake: number): string {
  const r = Math.round(80 + brake * 175);
  return `rgb(${r},0,0)`;
}

// Encontrar índice do ponto mais próximo a um normPos
export function findByNormPos(totalPoints: number, normPos: number): number {
  return Math.min(Math.round(normPos * totalPoints), totalPoints - 1);
}

// Encontrar ponto mais próximo a coordenadas canvas
export function findClosestCanvasPoint(
  pts: CanvasPoint[],
  mx: number,
  my: number,
  threshold = 20
): number | null {
  let best = -1, bestDist = threshold * threshold;
  for (let i = 0; i < pts.length; i++) {
    const dx = pts[i].cx - mx, dy = pts[i].cy - my;
    const d = dx * dx + dy * dy;
    if (d < bestDist) { bestDist = d; best = i; }
  }
  return best === -1 ? null : best;
}
```

### Task 3.3 — TrackMap component

**Arquivo:** `apps/web/app/(dashboard)/sessions/[sourceId]/TrackMap.tsx`

```tsx
"use client";

import { useRef, useEffect, useState, useCallback } from "react";
import type { LapTelemetry, Lap } from "@/lib/types";
import { formatLapTime } from "@/lib/format";
import {
  normalizePoints, speedToColor, throttleToColor, brakeToColor,
  findByNormPos, findClosestCanvasPoint, type CanvasPoint,
} from "./track-map-utils";

type ColorMode = "speed" | "throttle" | "brake";

interface Props {
  telemetry: LapTelemetry;
  bestS1: number | null;
  bestS2: number | null;
  bestS3: number | null;
}

export function TrackMap({ telemetry, bestS1, bestS2, bestS3 }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [mode, setMode] = useState<ColorMode>("speed");
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const normalizedRef = useRef<CanvasPoint[]>([]);
  const { data } = telemetry;

  // Renderizar no canvas
  const render = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const W = canvas.width;
    const H = canvas.height;
    ctx.clearRect(0, 0, W, H);

    const pts = normalizePoints(data.p, W, H);
    normalizedRef.current = pts;

    // Linha de fundo (sombra/outline) — mais larga, mais escura
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineWidth = 6;
    ctx.strokeStyle = "rgba(0,0,0,0.5)";
    ctx.beginPath();
    pts.forEach((p, i) => {
      if (i === 0) ctx.moveTo(p.cx, p.cy);
      else ctx.lineTo(p.cx, p.cy);
    });
    ctx.stroke();

    // Segmentos coloridos
    ctx.lineWidth = 4;
    for (let i = 1; i < pts.length; i++) {
      const p = pts[i];
      let color: string;
      if (mode === "speed")    color = speedToColor(p.speed, data.mv);
      else if (mode === "throttle") color = throttleToColor(p.throttle / 100);
      else                     color = brakeToColor(p.brake / 100);
      ctx.strokeStyle = color;
      ctx.beginPath();
      ctx.moveTo(pts[i - 1].cx, pts[i - 1].cy);
      ctx.lineTo(p.cx, p.cy);
      ctx.stroke();
    }

    // Marcadores de setor
    drawSectorMarker(ctx, pts, data.s[0], "S2", bestS2);
    if (data.s[1]) drawSectorMarker(ctx, pts, data.s[1], "S3", bestS3);

    // Linha de largada (ponto 0)
    drawStartMarker(ctx, pts[0]);

    // Hover highlight
    if (hoverIdx !== null && pts[hoverIdx]) {
      const p = pts[hoverIdx];
      ctx.beginPath();
      ctx.arc(p.cx, p.cy, 5, 0, Math.PI * 2);
      ctx.fillStyle = "white";
      ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,0.8)";
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  }, [data, mode, hoverIdx, bestS2, bestS3]);

  useEffect(() => { render(); }, [render]);

  // Responsivo: redimensionar canvas quando container muda
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const obs = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      canvas.width = width * window.devicePixelRatio;
      canvas.height = height * window.devicePixelRatio;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      const ctx = canvas.getContext("2d");
      ctx?.scale(window.devicePixelRatio, window.devicePixelRatio);
      render();
    });
    obs.observe(canvas.parentElement!);
    return () => obs.disconnect();
  }, [render]);

  function handleMouseMove(e: React.MouseEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    if (!canvas || !normalizedRef.current.length) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width / window.devicePixelRatio;
    const scaleY = canvas.height / rect.height / window.devicePixelRatio;
    const mx = (e.clientX - rect.left) * scaleX;
    const my = (e.clientY - rect.top) * scaleY;
    setHoverIdx(findClosestCanvasPoint(normalizedRef.current, mx, my));
  }

  const hoverFrame = hoverIdx !== null ? data.p[hoverIdx] : null;

  return (
    <div className="space-y-2">
      {/* Botões de modo */}
      <div className="flex items-center gap-1.5">
        {(["speed", "throttle", "brake"] as ColorMode[]).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={`px-2.5 py-1 rounded text-[10px] font-semibold uppercase tracking-wide transition-colors ${
              mode === m
                ? m === "speed" ? "bg-blue-500/20 text-blue-400 border border-blue-500/30"
                  : m === "throttle" ? "bg-green-500/20 text-green-400 border border-green-500/30"
                  : "bg-red-500/20 text-red-400 border border-red-500/30"
                : "bg-control text-muted-foreground hover:text-foreground"
            }`}
          >
            {m === "speed" ? "Vel" : m === "throttle" ? "Gas" : "Fre"}
          </button>
        ))}
      </div>

      {/* Canvas */}
      <div className="relative rounded-lg overflow-hidden bg-[#0a0a0a]" style={{ aspectRatio: "1/1" }}>
        <canvas
          ref={canvasRef}
          className="w-full h-full cursor-crosshair"
          onMouseMove={handleMouseMove}
          onMouseLeave={() => setHoverIdx(null)}
        />
      </div>

      {/* Info hover ou legenda */}
      <div className="h-5 flex items-center">
        {hoverFrame ? (
          <p className="text-[10px] font-mono text-muted-foreground tabular-nums">
            <span className="text-foreground font-semibold">{hoverFrame[2]} km/h</span>
            {" · "}
            <span className="text-green-400">{hoverFrame[3]}% gas</span>
            {" · "}
            <span className="text-red-400">{hoverFrame[4]}% fre</span>
          </p>
        ) : (
          <p className="text-[10px] text-muted-foreground">Passe o mouse sobre o mapa</p>
        )}
      </div>
    </div>
  );
}

// ── Helpers de desenho ──────────────────────────────────────────

function drawSectorMarker(
  ctx: CanvasRenderingContext2D,
  pts: CanvasPoint[],
  normPos: number,
  label: string,
  timeMs: number | null,
) {
  if (!normPos || !pts.length) return;
  const idx = findByNormPos(pts.length, normPos);
  const p = pts[idx];
  if (!p) return;

  ctx.beginPath();
  ctx.arc(p.cx, p.cy, 4, 0, Math.PI * 2);
  ctx.fillStyle = "#a855f7";
  ctx.fill();
  ctx.strokeStyle = "#1a1a1a";
  ctx.lineWidth = 1.5;
  ctx.stroke();
}

function drawStartMarker(ctx: CanvasRenderingContext2D, p: CanvasPoint) {
  ctx.beginPath();
  ctx.arc(p.cx, p.cy, 5, 0, Math.PI * 2);
  ctx.fillStyle = "#ffffff";
  ctx.fill();
  ctx.strokeStyle = "#333";
  ctx.lineWidth = 1.5;
  ctx.stroke();
}
```

### Task 3.4 — Integrar no SessionDetailContent

**Arquivo:** `apps/web/app/(dashboard)/sessions/[sourceId]/SessionDetailContent.tsx`

1. Adicionar `telemetry: LapTelemetry | null` ao `SessionDetailData`
2. No sidebar, substituir o bloco de `track?.outline_url` por:

```tsx
{data.telemetry ? (
  <div className="p-4 border-b border-border">
    <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-3">
      Mapa da Pista
    </p>
    <TrackMap
      telemetry={data.telemetry}
      bestS1={bestS1}
      bestS2={bestS2}
      bestS3={bestS3}
    />
  </div>
) : track?.outline_url ? (
  <img src={track.outline_url} alt={track.name}
    className="w-full h-44 object-contain bg-muted/40 p-5" />
) : track ? (
  <div className="w-full h-28 bg-muted/40 flex flex-col items-center justify-center gap-2">
    <MapPin className="size-7 text-muted-foreground/20" />
    <p className="text-[10px] text-muted-foreground/50">Telemetria disponível em sessões futuras</p>
  </div>
) : null}
```

**Commit 3:** `feat: TrackMap component with speed heatmap and sector markers`

---

## Fase 4 — Polish

**Objetivo:** Experiência completa com legenda de cores, estado de loading, e mapa bonito.

### Task 4.1 — Gradiente de legenda de cores

No modo "Velocidade", mostrar uma régua de cores:
```
Lento ━━━━━━━━━━━━━━━━━━━━━━━━━ Rápido
```

Implementado como `<div>` com `background: linear-gradient(to right, hsl(240...), hsl(0...))`.

### Task 4.2 — Skeleton loading

Enquanto os dados de telemetria carregam, mostrar um placeholder animado no shape do mapa (quadrado arredondado com pulso).

### Task 4.3 — Animação inicial do mapa

Na primeira vez que o mapa renderiza, desenhar o traçado progressivamente com `requestAnimationFrame`:
```typescript
// Animar: renderizar pts[0..i] crescendo até pts.length
let i = 0;
function animate() {
  if (i < pts.length) { renderUpTo(i); i += 20; requestAnimationFrame(animate); }
  else renderFull();
}
animate();
```

### Task 4.4 — Tooltip flutuante no hover

Em vez de uma linha de texto fixo, mostrar um tooltip que segue o mouse com dados do ponto:
```
┌──────────────────────┐
│  287 km/h            │
│  Throttle: 100%      │
│  Brake: 0%           │
│  1:05.230 na volta   │
└──────────────────────┘
```

**Commit 4:** `feat: track map polish — animation, legend, floating tooltip`

---

## Checkpoints de Verificação

Antes de dar a feature como completa:

- [ ] `npm run build` passa sem erros
- [ ] `dotnet build` passa sem erros
- [ ] Telemetria é enviada após uma sessão de teste (verificar no Supabase)
- [ ] Mapa renderiza corretamente com dados mockados
- [ ] Heatmap muda ao alternar modo (velocidade/gas/freio)
- [ ] Hover mostra dados corretos
- [ ] Funciona no mobile (touch move)
- [ ] Estado vazio gracioso quando sem telemetria

---

## Ordem de execução recomendada

```
1. Fase 1 (30min): DB + tipos — pode fazer direto
2. Fase 3 (2-3h): Componente web — pode testar com dados mockados sem precisar do agente
3. Fase 2 (3-4h): Agente — trabalho C# mais pesado, testar com AC rodando
4. Fase 4 (1-2h): Polish — depois que tudo funciona
```

> **Dica:** Comece pela Fase 3 com dados mockados. Isso permite ver o mapa funcionando rapidamente e ajustar a estética antes de investir na parte do agente.

---

## Arquivos criados/modificados

| Arquivo | Ação |
|---------|------|
| `supabase/migrations/0007_lap_telemetry.sql` | Criar |
| `apps/web/lib/types.ts` | Modificar (+ tipos) |
| `apps/web/lib/queries.ts` | Modificar (+ getLapTelemetry) |
| `apps/web/app/(dashboard)/sessions/[sourceId]/page.tsx` | Modificar (+ fetch) |
| `apps/web/app/(dashboard)/sessions/[sourceId]/SessionDetailContent.tsx` | Modificar (+ TrackMap) |
| `apps/web/app/(dashboard)/sessions/[sourceId]/TrackMap.tsx` | Criar |
| `apps/web/app/(dashboard)/sessions/[sourceId]/track-map-utils.ts` | Criar |
| `packages/Companion.Domain/Telemetry/TelemetryFrame.cs` | Criar |
| `packages/Companion.Infrastructure/Telemetry/AcMemoryStructs.cs` | Criar |
| `packages/Companion.Infrastructure/Telemetry/AcSharedMemoryReader.cs` | Criar |
| `packages/Companion.Infrastructure/Telemetry/TelemetryCollector.cs` | Criar |
| `packages/Companion.SharedContracts/Telemetry/LapTelemetryDto.cs` | Criar |
| `CompanionAgent.Core/SyncWorker.cs` | Modificar (+ TelemetryCollector) |
| `CompanionAgent.Core/SupabaseClient.cs` | Modificar (+ upsert telemetria) |
