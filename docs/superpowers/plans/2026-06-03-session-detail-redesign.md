# Plano: Redesign da Tela de Detalhes da Sessão

**Data:** 2026-06-03
**Spec:** `docs/superpowers/specs/2026-06-03-session-detail-redesign.md`
**Branch sugerida:** `feat/session-detail-redesign`

---

## Visão geral

7 fases incrementais. Cada fase deixa a tela funcional e commitável. Fase 0 mexe no agente (clutch); 1–5 entregam o redesign web; a 6 (comparação) é opcional e isolada.

```
Fase 0: Clutch no agente    → captura embreagem (novo canal, release do agente)
Fase 1: Layout shell        → estrutura lado-a-lado, histórico no rodapé
Fase 2: Utils de derivados  → cálculos (vmin, %a-fundo, distância, freadas)
Fase 3: TrackMap repaginado → maior, minimalista, botões por extenso, marcadores, hover controlled
Fase 4: TelemetryTrace      → trace acelerador/freio/embreagem + sincronização de hover
Fase 5: MapStatsPanel       → painel de métricas à direita (sem % de frenagem)
Fase 6: Comparar (opcional) → botão + volta de referência fantasma + delta
```

> A Fase 0 (agente) e as Fases 1–2 (web) são independentes e podem ir em paralelo. A web trata clutch como opcional (7º elemento ausente = 0), então o redesign não fica bloqueado esperando o release do agente.

---

## Fase 0 — Clutch no agente (repo ac-companion-agent)

**Objetivo:** Capturar a embreagem e incluí-la no ponto de telemetria.

**Arquivos (repo `PedroMacioni/ac-companion-agent`, flat em `src/CompanionAgent.Core/`):**
- `TelemetryFrame.cs` — adicionar `float Clutch` ao record
- `TelemetryCollector.cs` — preencher `Clutch: p.Clutch` no `AddFrame` (`AcPhysics` já tem o campo `Clutch`)
- `TelemetryMapper.cs` — adicionar `(int)(f.Clutch * 100)` como 7º elemento do array do ponto

**Tasks:**
0.1 `Clutch` no `TelemetryFrame` (entre Brake e NormPos).
0.2 `TelemetryCollector`: `Clutch: p.Clutch` no AddFrame. Manter `_lastAirTemp/_lastRoadTemp/_lastWind` atualizados a cada tick (de `p.AirTemp`, `p.RoadTemp`; wind best-effort).
0.3 `TelemetryMapper`: ponto vira `[x×10, y×10, z×10, speed, throttle×100, brake×100, clutch×100]`; e `TelemetryDataDto.Cond = { at, rt, wind }`.
0.4 `SessionTelemetryResult` carrega condições; `SyncWorker` inclui no DTO. `AcGraphics` ganha `WindSpeed`/`WindDirection` no fim (best-effort; validar range na web).

**Verificação:** build do agente passa (GitHub Actions). Tag `v3.1.0` gera instalador. Após rodar uma volta, confirmar no Supabase: pontos com 7 elementos e `data.cond` preenchido.
**Commit/tag:** `feat: capture clutch + session conditions (temps, wind)` → tag `v3.1.0`

> Atenção: a web (tipo `TelemetryPoint`) deve aceitar 6 OU 7 elementos. `clutch = p[6] ?? 0`.

---

## Fase 1b — Faixa de condições no topo (web)

**Objetivo:** Linha informativa no topo da tela com temperatura da pista, horário (ícone sol/lua) e vento.

**Arquivos:** `SessionConditionsBar.tsx` (criar), `SessionDetailContent.tsx` (encaixar no topo), `messages/*.json`.

**Tasks:**
1b.1 `SessionConditionsBar` recebe `cond` (de `telemetry.data.cond`) e `startedAt`. Renderiza chips com ícones `lucide-react`: `Thermometer` (pista), `Clock`+`Sun`/`Sunset`/`Moon` (horário derivado de `startedAt`), `Wind` (se `wind` em range válido 0–200).
1b.2 Encaixar logo abaixo do header da sessão. Some graciosamente se não houver `cond`.
1b.3 i18n das labels.

---

## Fase 1 — Layout shell

**Objetivo:** Reorganizar `SessionDetailContent.tsx` sem lógica nova. Criar o esqueleto `MapAnalysis` e mover o histórico.

**Arquivos:**
- `apps/web/app/(dashboard)/sessions/[sourceId]/MapAnalysis.tsx` (criar — wrapper client)
- `apps/web/app/(dashboard)/sessions/[sourceId]/SessionDetailContent.tsx` (modificar)

**Tasks:**
1.1 Criar `MapAnalysis.tsx` recebendo `telemetry`, `bestS1/2/3`, `consistData`, `theoretical`. Por ora renderiza: à esquerda o `TrackMap` atual (tamanho aumentado), à direita um placeholder de painel, e abaixo um placeholder de trace. Estado `hoverIdx`/`mode` já vive aqui.
1.2 No `SessionDetailContent`, no bloco overview: substituir o par chart/sidebar pela `MapAnalysis` no topo (quando `data.telemetry`). Mover o **pace chart** e o **track history** para o rodapé; histórico em formato compacto (linhas menores, no máx. 3–4 itens, fonte menor).
1.3 Estado vazio: se sem telemetria, manter o comportamento atual (outline/placeholder) no lugar do `MapAnalysis`.

**Verificação:** `npx tsc --noEmit` limpo; `npm run build` passa; layout responsivo (empilha no mobile).
**Commit:** `feat: session detail layout shell — map+panel side by side, history to footer`

---

## Fase 2 — Utils de derivados

**Objetivo:** Funções puras para alimentar mapa, trace e painel.

**Arquivos:** `apps/web/app/(dashboard)/sessions/[sourceId]/track-map-utils.ts` (modificar)

**Tasks:**
2.1 `cumulativeDistance(points): number[]` — distância acumulada (somatório euclidiano em X/Z descompactados) por ponto, normalizada para 0..1 (eixo do trace).
2.2 `computeLapStats(points, mv)` → `{ maxSpeed, minSpeed, avgSpeed, pctFullThrottle, maxSpeedIdx, minSpeedIdx }` (sem % de frenagem).
2.3 `detectBrakingZones(points, threshold=20): number[]` — índices onde o brake cruza de baixo↑ para cima (início de frenagem).
2.4 Helper `clutchOf(point)` → `point[6] ?? 0` (retrocompat 6↔7 elementos).

**Verificação:** Testes unitários Vitest com um array de pontos sintético (já há vitest no projeto). `npx tsc --noEmit` limpo.
**Commit:** `feat: telemetry derived stats — distance, lap stats, braking zones`

---

## Fase 3 — TrackMap repaginado

**Objetivo:** Mapa maior, clean, com marcadores e hover controlado externamente.

**Arquivos:** `TrackMap.tsx` (modificar)

**Tasks:**
3.1 Tornar o hover **controlled**: receber `hoverIdx: number | null` e `onHover(idx)` por props (em vez de estado interno). `mode` também via props. Manter fallback interno se props ausentes (compat).
3.2 Estilo minimalista: remover sombra pesada, traçado nítido (lineWidth ~3–4), fundo `bg-card`/`#0d0d0f`, paleta sóbria, bastante respiro. Aspect ratio mais largo (ex.: 4/3) e maior.
3.3 **Botões de modo por extenso e bonitos**: "Velocidade", "Acelerador", "Freio" em pills minimalistas com a cor do modo (não abreviado). Tipografia caprichada.
3.4 Marcadores: setores (já existe), **início de frenagem** (pequenos triângulos/pontos), **Vmax** (ponto) e **Vmin** (ponto), largada. Labels discretos.
3.5 Hover: ponto destacado + “crosshair” fino; o tooltip flutuante já existe — manter, ajustar índices (speed=3, gas=4, fre=5, clutch=6).

**Verificação:** Render isolado (rota de teste temporária + Playwright, como já validamos antes) — conferir traçado, marcadores e que o hover externo destaca. `npm run build` passa.
**Commit:** `feat: redesigned clean track map with markers and controlled hover`

---

## Fase 4 — TelemetryTrace + sincronização

**Objetivo:** Gráfico de inputs (acelerador/freio/embreagem) + velocidade por distância, cursor compartilhado com o mapa.

**Arquivos:**
- `TelemetryTrace.tsx` (criar)
- `MapAnalysis.tsx` (ligar hover bidirecional)

**Tasks:**
4.1 `TelemetryTrace`: canvas/SVG de linha. Eixo X = distância acumulada (Fase 2). Velocidade como área de fundo sutil; **acelerador (verde)**, **freio (vermelho)** e **embreagem (azul)** como linhas que sobem/descem de 0–100% (eixo secundário). Faixas de setor ao fundo. Legenda minimalista com os 3 inputs.
4.2 Hover no trace → calcula índice do ponto mais próximo no eixo X → `onHover(idx)`. Linha vertical de cursor no trace.
4.3 Em `MapAnalysis`, `hoverIdx` é a fonte única: mapa e trace recebem o mesmo `hoverIdx` e ambos chamam `setHoverIdx`. Passar mouse num atualiza o outro.
4.4 Embreagem usa `clutchOf(point)` (0 em voltas antigas) — a linha de clutch fica achatada em voltas sem o dado, sem quebrar.

**Verificação:** Playwright na rota de teste — mover mouse no trace muda o ponto destacado no mapa (checar via getImageData/posição). `npm run build` passa.
**Commit:** `feat: synchronized telemetry trace (speed/throttle/brake) linked to map`

---

## Fase 5 — MapStatsPanel

**Objetivo:** Painel direito com métricas derivadas.

**Arquivos:**
- `MapStatsPanel.tsx` (criar)
- `MapAnalysis.tsx` (encaixar no lugar do placeholder)

**Tasks:**
5.1 Painel com: Vmax, Vmin, Vméd, % a fundo (acelerador) — **sem % de frenagem**; consistência e melhor teórica (já calculados no `SessionDetailContent` — passar via props); setores S1/S2/S3.
5.2 i18n: adicionar chaves em `messages/en.json` e `pt-BR.json` (seguir padrão da memória de i18n).
5.3 Responsivo: no mobile o painel vira uma faixa de chips acima do trace.

**Verificação:** `npx tsc --noEmit` limpo; revisão visual; `npm run build` passa.
**Commit:** `feat: map stats panel with lap metrics and sectors`

---

## Fase 6 — Comparar com referência (OPCIONAL)

**Objetivo:** Botão que sobrepõe a melhor volta histórica do usuário na mesma pista.

**Arquivos:**
- `page.tsx` (buscar candidata de referência) ou API/route handler
- `MapAnalysis.tsx`, `TrackMap.tsx`, `TelemetryTrace.tsx` (camada de referência)

**Tasks:**
6.1 Buscar a melhor volta histórica: telemetria de outra sessão do user na mesma `track_id`, menor `dur`. Passar como prop opcional `referenceTelemetry`.
6.2 Botão "Comparar" em `MapAnalysis` (toggle `compareOn`). Ligado: desenha linha fantasma (cinza) no mapa e segunda linha no trace; calcula delta de tempo simples (por distância normalizada) e mostra no painel.
6.3 Estado: se não houver referência disponível, o botão fica desabilitado com tooltip.

**Verificação:** `npm run build` passa; comparação some/aparece com o toggle.
**Commit:** `feat: optional reference lap comparison (ghost line + delta)`

---

## Ordem recomendada

Fase 1 → 2 → 3 → 4 → 5 (entrega o redesign completo). Fase 6 depois, se valer a pena.

## Riscos / notas

- **Sincronização de hover** é o ponto técnico mais delicado — manter `hoverIdx` como fonte única em `MapAnalysis` evita dessincronia.
- **Performance**: 1000–1500 pontos por volta; redesenhar canvas no hover é barato, mas evitar recriar arrays a cada frame (memoizar `normalizePoints` e `cumulativeDistance`).
- **cacheComponents/PPR**: validar sempre com build de produção, não só dev (lição da feature anterior — ver memória).
- Manter o **fallback de telemetria** atual (página mostra outline quando não há dados); o redesign só troca o miolo quando há telemetria.

## Arquivos (resumo)

| Arquivo | Ação |
|---------|------|
| **Agente** `TelemetryFrame.cs` / `TelemetryCollector.cs` / `TelemetryMapper.cs` | Modificar (Fase 0: clutch) |
| `lib/types.ts` | Modificar (`TelemetryPoint` aceita 6 ou 7 elementos) |
| `MapAnalysis.tsx` | Criar (orquestrador client) |
| `TelemetryTrace.tsx` | Criar |
| `MapStatsPanel.tsx` | Criar |
| `TrackMap.tsx` | Modificar (minimalista, maior, botões por extenso, marcadores, hover controlled) |
| `track-map-utils.ts` | Modificar (derivados, `clutchOf`) |
| `SessionDetailContent.tsx` | Modificar (layout, histórico no rodapé) |
| `page.tsx` | Modificar (Fase 6: buscar referência) |
| `messages/en.json`, `pt-BR.json` | Modificar (i18n do painel) |

## Pendência do fallback temporário

O `page.tsx` tem hoje um **fallback temporário** (mostra a telemetria mais recente quando a sessão não tem própria) marcado com `// TEMP (teste)`. Remover quando a captura do agente estiver confirmada e estável — não deixar entrar no redesign final.
