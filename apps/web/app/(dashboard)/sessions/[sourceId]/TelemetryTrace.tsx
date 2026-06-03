"use client";

import { useRef, useEffect, useCallback } from "react";
import type { TelemetryPoint } from "@/lib/types";
import { cumulativeDistance, clutchOf } from "./track-map-utils";

interface Props {
  points: TelemetryPoint[];
  maxSpeed: number;
  sectorBoundaries: number[];
  hoverIdx: number | null;
  onHover: (idx: number | null) => void;
}

export function TelemetryTrace({ points, maxSpeed, sectorBoundaries, hoverIdx, onHover }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const distancesRef = useRef<number[]>([]);

  const render = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || points.length === 0) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const W = canvas.width / dpr;
    const H = canvas.height / dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);

    const distances = cumulativeDistance(points);
    distancesRef.current = distances;

    const pad = { left: 40, right: 12, top: 12, bottom: 24 };
    const chartW = W - pad.left - pad.right;
    const chartH = H - pad.top - pad.bottom;

    // ── Background sector bands ──
    ctx.fillStyle = "rgba(168, 85, 247, 0.05)"; // purple-400/5
    let prevX = pad.left;
    sectorBoundaries.forEach((normPos, i) => {
      const x = pad.left + normPos * chartW;
      if (i % 2 === 0) {
        ctx.fillRect(prevX, pad.top, x - prevX, chartH);
      }
      prevX = x;
    });
    // Fill last sector if odd number of boundaries
    if (sectorBoundaries.length % 2 === 1) {
      ctx.fillRect(prevX, pad.top, pad.left + chartW - prevX, chartH);
    }

    // ── Axis labels ──
    ctx.fillStyle = "#666";
    ctx.font = "9px sans-serif";
    ctx.textAlign = "right";
    ctx.fillText("100%", pad.left - 4, pad.top + 6);
    ctx.fillText("0%", pad.left - 4, pad.top + chartH);
    ctx.textAlign = "center";
    ctx.fillText("Início", pad.left, H - 4);
    ctx.fillText("Fim", W - pad.right, H - 4);

    // ── Speed area (background, subtle) ──
    ctx.beginPath();
    ctx.moveTo(pad.left, pad.top + chartH);
    for (let i = 0; i < points.length; i++) {
      const x = pad.left + distances[i] * chartW;
      const speedNorm = points[i][3] / maxSpeed;
      const y = pad.top + chartH - speedNorm * chartH * 0.8; // 80% height max for speed
      if (i === 0) ctx.moveTo(x, pad.top + chartH);
      ctx.lineTo(x, y);
    }
    ctx.lineTo(pad.left + chartW, pad.top + chartH);
    ctx.closePath();
    ctx.fillStyle = "rgba(100, 100, 100, 0.1)";
    ctx.fill();

    // ── Input lines ──
    const drawInputLine = (
      getValue: (p: TelemetryPoint, i: number) => number,
      color: string,
      lineWidth = 1.5
    ) => {
      ctx.beginPath();
      ctx.strokeStyle = color;
      ctx.lineWidth = lineWidth;
      for (let i = 0; i < points.length; i++) {
        const x = pad.left + distances[i] * chartW;
        const val = getValue(points[i], i);
        const y = pad.top + chartH - (val / 100) * chartH;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    };

    // Throttle (green)
    drawInputLine((p) => p[4], "#22c55e", 1.5);
    // Brake (red)
    drawInputLine((p) => p[5], "#ef4444", 1.5);
    // Clutch (blue) - only if data has 7 elements
    if ((points[0] as unknown as number[]).length > 6) {
      drawInputLine((p) => clutchOf(p), "#3b82f6", 1);
    }

    // ── Hover cursor line ──
    if (hoverIdx !== null && distances[hoverIdx] !== undefined) {
      const hx = pad.left + distances[hoverIdx] * chartW;
      ctx.beginPath();
      ctx.moveTo(hx, pad.top);
      ctx.lineTo(hx, pad.top + chartH);
      ctx.strokeStyle = "rgba(255, 255, 255, 0.6)";
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }, [points, maxSpeed, sectorBoundaries, hoverIdx]);

  useEffect(() => {
    render();
  }, [render]);

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
    if (!canvas || distancesRef.current.length === 0) return;
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const W = canvas.width / dpr;
    const pad = { left: 40, right: 12 };
    const chartW = W - pad.left - pad.right;

    const mx = e.clientX - rect.left;
    // Convert mouse X to normalized distance
    const normDist = Math.max(0, Math.min(1, (mx - pad.left) / chartW));

    // Find closest point index by distance
    let closestIdx = 0;
    let closestDelta = Infinity;
    for (let i = 0; i < distancesRef.current.length; i++) {
      const delta = Math.abs(distancesRef.current[i] - normDist);
      if (delta < closestDelta) {
        closestDelta = delta;
        closestIdx = i;
      }
    }
    onHover(closestIdx);
  }

  return (
    <div className="space-y-2">
      {/* Legend */}
      <div className="flex items-center gap-4 text-[10px]">
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-0.5 bg-green-500 rounded-full" />
          <span className="text-muted-foreground">Acelerador</span>
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-0.5 bg-red-500 rounded-full" />
          <span className="text-muted-foreground">Freio</span>
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-0.5 bg-blue-500 rounded-full" />
          <span className="text-muted-foreground">Embreagem</span>
        </span>
      </div>
      <div className="relative h-28 rounded-lg overflow-hidden bg-[#0a0a0a] border border-border/30">
        <canvas
          ref={canvasRef}
          className="w-full h-full cursor-crosshair"
          onMouseMove={handleMouseMove}
          onMouseLeave={() => onHover(null)}
        />
      </div>
    </div>
  );
}
