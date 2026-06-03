# Spec: Redesign da Tela de Detalhes da Sessão (Mapa + Telemetria)

**Data:** 2026-06-03
**Status:** Aprovado para planejamento
**Relacionado:** `docs/superpowers/specs/2026-06-02-telemetry-track-map.md` (feature base do mapa, já implementada)

---

## Objetivo

Transformar a tela de detalhes da sessão numa ferramenta de análise de volta de verdade, com o **mapa da pista como protagonista** (estilo Track Titan, mas com identidade clean/técnica), trace de telemetria sincronizado e um painel de métricas. O mapa hoje é um quadrado pequeno e solto na sidebar — vamos elevá-lo a peça central.

## Decisões (do brainstorm 2026-06-03, revisado)

1. **Layout: mapa + painel lado a lado.** Mapa grande à esquerda, painel de stats/análise à direita; trace de telemetria full-width logo abaixo; tabela de voltas e histórico da pista no rodapé.
2. **Trace de inputs sincronizado.** Gráfico clássico de inputs ao longo da volta: **acelerador (verde), freio (vermelho) e embreagem (azul)** como linhas/áreas que sobem e descem de 0–100% ao longo da distância, mais a velocidade. Hover no trace destaca o ponto no mapa e vice-versa (cursor compartilhado bidirecional).
3. **Comparação com referência: opcional, via botão.** Por padrão mostra só a volta da sessão. Um botão "Comparar" sobrepõe a melhor volta histórica do usuário naquela pista (linha fantasma no mapa + segundo trace + delta). É a última fase, isolada.
4. **Estilo visual: minimalista, informativo e aesthetic.** Traçado nítido sem glow, paleta sóbria, muito respiro, tipografia caprichada. Coerente com o design system atual (tokens `bg-card`, `border-border`, `text-muted-foreground`).
5. **Botões de modo do mapa com labels por extenso e bonitos** — "Velocidade", "Acelerador", "Freio" (não abreviado), em pills minimalistas com a cor do modo. Nada de "Vel/Gas/Fre".
6. **Sem "% de frenagem" no painel.** Métricas do painel: Vmax, Vmin, Vméd, % a fundo (acelerador), consistência, melhor teórica e setores. A informação de freio fica no trace, não como porcentagem.
7. **Track history vai pro rodapé e menor.** Não faz sentido no topo da análise.
8. **Embreagem (clutch) é um canal novo.** O agente passa a capturar `Clutch` (já existe no `AcPhysics`). O ponto de telemetria cresce de 6 para 7 elementos: `[x, y, z, speed, throttle, brake, clutch]`. Voltas antigas (6 elementos) tratam clutch como ausente/0.
9. **Faixa de condições no topo (informativa).** Linha discreta com: **temperatura da pista**, **horário da sessão** (com ícone sol/pôr-do-sol/lua pela hora) e **vento**. Ícones do `lucide-react` (sem emoji): `Thermometer`, `Clock`/`Sun`/`Sunset`/`Moon`, `Wind`.
10. **Origem das condições.** Snapshot capturado pelo agente do shared memory ao vivo (mesma origem da telemetria), guardado em `lap_telemetry.data.cond = { rt, at, wind }`. O agente captura `RoadTemp` + `AirTemp` (Physics, posições estáveis desde AC 1.6) e `WindSpeed` (best-effort). Horário vem do `started_at` da sessão (já no banco). **Sem chuva** — o AC base não reporta de forma confiável. A faixa só aparece quando há telemetria com `cond`.

## Dados

**Disponíveis hoje** (por ponto, na tabela `lap_telemetry`): `[x×10, y×10, z×10, speed_kmh, throttle%, brake%]`, além de `s` (limites de setor em normPos), `mv` (vel máx), `dur` (duração ms).

**Novo canal a capturar no agente:** `clutch%` (campo `Clutch` do `AcPhysics`). O ponto passa a `[x, y, z, speed, throttle, brake, clutch]` (7 elementos). Retrocompatível: pontos antigos sem o 7º elemento → clutch tratado como 0.

**Derivados** (calculados no client a partir dos pontos):
- Velocidade mínima, média; % a fundo (throttle ≥ 98)
- Distância acumulada por ponto (soma das distâncias euclidianas) → eixo X do trace
- Pontos de frenagem (transições onde brake cruza um limiar) → marcadores no mapa
- Ponto de Vmax e Vmin → marcadores no mapa

**Não capturados (fora de escopo):** marcha, esterçamento, volta de referência ponto-a-ponto de terceiros. A comparação (fase 6) usa outra volta **nossa** já gravada na mesma pista.

## Arquitetura de componentes

Novo componente orquestrador client `MapAnalysis.tsx` que segura o estado compartilhado (`hoverIdx`, `mode`, `compareOn`) e compõe:
- `TrackMap.tsx` (repaginado) — canvas grande, controlled via props (`hoverIdx`, `onHover`, `mode`)
- `TelemetryTrace.tsx` (novo) — gráfico de linha por distância, controlled (mesmo `hoverIdx`/`onHover`)
- `MapStatsPanel.tsx` (novo) — métricas derivadas + setores + consistência/teórica
- `track-map-utils.ts` — ganha funções de derivados e distância acumulada

`SessionDetailContent.tsx` reestrutura o bloco "overview": substitui o par (pace chart à esquerda / sidebar à direita) pela seção `MapAnalysis` no topo; pace chart e histórico descem para o rodapé (histórico menor e enxuto).

Hover compartilhado: `MapAnalysis` mantém `hoverIdx`; mapa e trace leem e escrevem via callback. O ponto destacado é o mesmo índice do array de pontos nos dois.

## Responsivido

- **Desktop (md+):** mapa `flex-1` à esquerda + painel `w-80` à direita; trace full-width abaixo.
- **Mobile:** empilha mapa → painel (vira linha de chips) → trace. As tabs atuais (overview/laps) permanecem.

## Não-objetivos

- Captura de novos canais no agente (marcha/steering) — pode virar spec futura.
- Coaching com IA.
- Edição de racing line.

## Critérios de aceite

- Mapa ocupa papel central, minimalista e bonito, com marcadores de setor, frenagem, Vmax/Vmin.
- Botões de modo com labels por extenso ("Velocidade", "Acelerador", "Freio"), pills minimalistas.
- Trace de inputs desenha acelerador + freio + embreagem (e velocidade) por distância; hover sincroniza com o mapa nos dois sentidos.
- Painel mostra Vmax, Vmin, Vméd, % a fundo, consistência, melhor teórica e setores (sem % de frenagem).
- Embreagem capturada pelo agente e renderizada no trace; voltas antigas sem clutch não quebram (tratado como 0).
- Histórico da pista aparece no rodapé, compacto.
- Estado vazio gracioso quando não há telemetria (mantém o fallback atual de outline).
- `npm run build` (produção, cacheComponents) passa; layout responsivo no mobile.
