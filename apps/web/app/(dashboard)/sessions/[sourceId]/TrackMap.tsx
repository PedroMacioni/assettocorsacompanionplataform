"use client";

import { useRef, useEffect, useState, useCallback } from "react";
import type { LapTelemetry } from "@/lib/types";
import {
  normalizePoints, speedToColor, throttleToColor, brakeToColor,
  findByNormPos, findClosestCanvasPoint, type CanvasPoint,
  computeLapStats, detectBrakingZones,
} from "./track-map-utils";

type ColorMode = "speed" | "throttle" | "brake";

interface Props {
  telemetry: LapTelemetry;
  bestS1: number | null;
  bestS2: number | null;
  bestS3: number | null;
  // Controlled hover (optional)
  hoverIdx?: number | null;
  onHover?: (idx: number | null) => void;
  // Controlled mode (optional)
  mode?: ColorMode;
  onModeChange?: (mode: ColorMode) => void;
}

export function TrackMap({
  telemetry,
  bestS2,
  bestS3,
  hoverIdx: controlledHoverIdx,
  onHover,
  mode: controlledMode,
  onModeChange,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [internalMode, setInternalMode] = useState<ColorMode>("speed");
  const [internalHoverIdx, setInternalHoverIdx] = useState<number | null>(null);
  const [mousePos, setMousePos] = useState<{ x: number; y: number } | null>(null);
  const normalizedRef = useRef<CanvasPoint[]>([]);
  const animatedRef = useRef(false);
  const { data } = telemetry;

  // Use controlled values if provided, otherwise use internal state
  const currentMode = controlledMode ?? internalMode;
  const currentHoverIdx = controlledHoverIdx ?? internalHoverIdx;

  function handleModeChange(m: ColorMode) {
    if (onModeChange) onModeChange(m);
    else setInternalMode(m);
  }

  function handleHoverChange(idx: number | null) {
    if (onHover) onHover(idx);
    else setInternalHoverIdx(idx);
  }

  const render = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    // Trabalhar em CSS pixels (o ctx.setTransform já cuida do DPR)
    const W = canvas.width / dpr;
    const H = canvas.height / dpr;

    const pts = normalizePoints(data.p, W, H);
    normalizedRef.current = pts;

    // Pre-compute stats and braking zones
    const stats = computeLapStats(data.p, data.mv);
    const brakingZones = detectBrakingZones(data.p, 20);

    const doRender = (upTo: number) => {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);

      const slice = pts.slice(0, upTo);
      if (slice.length < 2) return;

      // Segmentos coloridos (sem sombra para estilo minimalista)
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.lineWidth = 3;
      for (let i = 1; i < slice.length; i++) {
        const p = slice[i];
        let color: string;
        if (currentMode === "speed")         color = speedToColor(p.speed, data.mv);
        else if (currentMode === "throttle") color = throttleToColor(p.throttle / 100);
        else                                 color = brakeToColor(p.brake / 100);
        ctx.strokeStyle = color;
        ctx.beginPath();
        ctx.moveTo(slice[i - 1].cx, slice[i - 1].cy);
        ctx.lineTo(p.cx, p.cy);
        ctx.stroke();
      }

      if (upTo >= pts.length) {
        // Marcadores de velocidade: Vmax (azul) e Vmin (amarelo)
        if (pts[stats.maxSpeedIdx]) {
          drawSpeedMarker(ctx, pts[stats.maxSpeedIdx], "max");
        }
        if (pts[stats.minSpeedIdx]) {
          drawSpeedMarker(ctx, pts[stats.minSpeedIdx], "min");
        }

        // Marcadores de início de frenagem (triângulos vermelhos)
        brakingZones.forEach(idx => {
          if (pts[idx]) drawBrakingMarker(ctx, pts[idx]);
        });

        // Marcadores de setor
        if (data.s[0]) drawSectorMarker(ctx, pts, data.s[0]);
        if (data.s[1]) drawSectorMarker(ctx, pts, data.s[1]);
        drawStartMarker(ctx, pts[0]);

        // Hover highlight
        if (currentHoverIdx !== null && pts[currentHoverIdx]) {
          const p = pts[currentHoverIdx];
          ctx.beginPath();
          ctx.arc(p.cx, p.cy, 5, 0, Math.PI * 2);
          ctx.fillStyle = "white";
          ctx.fill();
          ctx.strokeStyle = "rgba(255,255,255,0.8)";
          ctx.lineWidth = 2;
          ctx.stroke();
        }
      }
    };

    if (!animatedRef.current) {
      animatedRef.current = true;
      let i = 0;
      const step = Math.max(1, Math.floor(pts.length / 60));
      const animate = () => {
        i = Math.min(i + step, pts.length);
        doRender(i);
        if (i < pts.length) requestAnimationFrame(animate);
      };
      requestAnimationFrame(animate);
    } else {
      doRender(pts.length);
    }
  }, [data, currentMode, currentHoverIdx, bestS2, bestS3]);

  useEffect(() => {
    animatedRef.current = false;
  }, [data, currentMode]);

  useEffect(() => { render(); }, [render]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const obs = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      const dpr = window.devicePixelRatio || 1;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      render();
    });
    obs.observe(canvas.parentElement!);
    return () => obs.disconnect();
  }, [render]);

  function handleMouseMove(e: React.MouseEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    if (!canvas || !normalizedRef.current.length) return;
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    setMousePos({ x: mx, y: my });
    handleHoverChange(findClosestCanvasPoint(normalizedRef.current, mx, my));
  }

  const hoverFrame = currentHoverIdx !== null ? data.p[currentHoverIdx] : null;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 mb-3">
        {(["speed", "throttle", "brake"] as ColorMode[]).map((m) => (
          <button
            key={m}
            onClick={() => handleModeChange(m)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
              currentMode === m
                ? m === "speed"
                  ? "bg-blue-500/20 text-blue-400 ring-1 ring-blue-500/30"
                  : m === "throttle"
                  ? "bg-green-500/20 text-green-400 ring-1 ring-green-500/30"
                  : "bg-red-500/20 text-red-400 ring-1 ring-red-500/30"
                : "bg-muted/50 text-muted-foreground hover:text-foreground hover:bg-muted"
            }`}
          >
            {m === "speed" ? "Velocidade" : m === "throttle" ? "Acelerador" : "Freio"}
          </button>
        ))}
      </div>

      {/* Legenda de cores — só no modo speed */}
      {currentMode === "speed" && (
        <div className="flex items-center gap-2">
          <span className="text-[9px] text-muted-foreground">Lento</span>
          <div
            className="flex-1 h-1.5 rounded-full"
            style={{ background: "linear-gradient(to right, hsl(240,90%,50%), hsl(120,90%,50%), hsl(0,90%,52%))" }}
          />
          <span className="text-[9px] text-muted-foreground">Rápido</span>
        </div>
      )}

      <div
        className="relative rounded-lg overflow-hidden bg-[#0d0d0f]"
        style={{ aspectRatio: "4/3" }}
      >
        <canvas
          ref={canvasRef}
          className="w-full h-full cursor-crosshair"
          onMouseMove={handleMouseMove}
          onMouseLeave={() => { handleHoverChange(null); setMousePos(null); }}
        />
        {hoverFrame && mousePos && (
          <div
            className="pointer-events-none absolute z-10 px-2.5 py-2 rounded-lg bg-black/90 border border-white/10 shadow-xl text-[10px] font-mono"
            style={{
              left: mousePos.x + 14,
              top: mousePos.y - 8,
              transform: mousePos.x > 200 ? "translateX(-110%)" : undefined,
            }}
          >
            <p className="text-white font-semibold tabular-nums">{hoverFrame[3]} km/h</p>
            <p className="text-green-400 tabular-nums mt-0.5">{hoverFrame[4]}% gas</p>
            <p className="text-red-400 tabular-nums">{hoverFrame[5]}% fre</p>
            {(hoverFrame as unknown as number[]).length > 6 && (
              <p className="text-blue-400 tabular-nums">{(hoverFrame as unknown as number[])[6]}% emb</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function drawSectorMarker(
  ctx: CanvasRenderingContext2D,
  pts: CanvasPoint[],
  normPos: number,
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
  if (!p) return;
  ctx.beginPath();
  ctx.arc(p.cx, p.cy, 5, 0, Math.PI * 2);
  ctx.fillStyle = "#ffffff";
  ctx.fill();
  ctx.strokeStyle = "#333";
  ctx.lineWidth = 1.5;
  ctx.stroke();
}

function drawSpeedMarker(ctx: CanvasRenderingContext2D, p: CanvasPoint, type: "max" | "min") {
  ctx.beginPath();
  ctx.arc(p.cx, p.cy, 6, 0, Math.PI * 2);
  ctx.fillStyle = type === "max" ? "#3b82f6" : "#f59e0b"; // blue for max, amber for min
  ctx.fill();
  ctx.strokeStyle = "#1a1a1a";
  ctx.lineWidth = 2;
  ctx.stroke();
}

function drawBrakingMarker(ctx: CanvasRenderingContext2D, p: CanvasPoint) {
  const size = 4;
  ctx.beginPath();
  ctx.moveTo(p.cx, p.cy - size);
  ctx.lineTo(p.cx + size * 0.866, p.cy + size * 0.5);
  ctx.lineTo(p.cx - size * 0.866, p.cy + size * 0.5);
  ctx.closePath();
  ctx.fillStyle = "#ef4444"; // red
  ctx.fill();
}
