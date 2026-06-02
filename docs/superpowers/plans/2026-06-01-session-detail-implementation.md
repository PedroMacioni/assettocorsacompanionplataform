# Session Detail Redesign — Implementation Plan

**Data:** 2026-06-01
**Spec:** `docs/superpowers/specs/2026-06-01-session-detail-redesign.md`
**Status:** Pendente

---

## Visão Geral

Migrar o painel client-side de detalhes de sessão para uma página dedicada em `/sessions/[sourceId]`, redesenhando o header, substituindo os 7 cards por uma seção de análise estruturada, e adicionando tabs no mobile.

**Ordem das tasks:** as tasks são sequenciais — cada uma depende da anterior estar concluída.

---

## Tasks

### Task 1 — i18n: Adicionar e remover chaves

**Arquivos:**
- `apps/web/messages/en.json`
- `apps/web/messages/pt-BR.json`

**O que fazer:**

Adicionar no namespace `SessionDetail`:

```json
"tabs": {
  "overview": "Overview",
  "laps": "Laps"
},
"stats": {
  "validOf": "{valid} / {total} valid",
  "cutsInline": "{count} cuts",
  "avgVsBest": "{delta} vs best",
  "noCuts": "No cuts"
}
```

Português:
```json
"tabs": {
  "overview": "Resumo",
  "laps": "Voltas"
},
"stats": {
  "validOf": "{valid} / {total} válidas",
  "cutsInline": "{count} cortes",
  "avgVsBest": "{delta} vs melhor",
  "noCuts": "Sem cortes"
}
```

Remover do namespace `SessionDetail.stats`:
- `totalLaps`
- `lastLap`

> `distance` e `tyre` ficam como fallback de texto plain — não precisam de chave i18n pois são valores diretos (km, sigla do composto).

---

### Task 2 — Criar `SessionDetailContent.tsx`

**Arquivo novo:** `apps/web/app/(dashboard)/sessions/[sourceId]/SessionDetailContent.tsx`

Este é o maior arquivo da implementação. Deve ser um client component (`"use client"`) que recebe os dados já fetchados pelo RSC e renderiza toda a UI.

#### 2a. Copiar helpers de `SessionDetailPanel.tsx`

Os seguintes helpers devem ser movidos para o novo arquivo (não duplicar — o painel antigo vai ser deletado na Task 5):
- `SESSION_BADGE`, `badgeClass`
- `formatDelta`, `formatSector`
- `stdDev`, `percentile`
- `SectorColor`, `SECTOR_TEXT`, `SECTOR_DOT`, `classifySector`
- `ConsistencyKey`, `getConsistencyInfo`

#### 2b. Back Button

```tsx
function BackButton() {
  const router = useRouter();
  const t = useTranslations("SessionDetail");

  function handleBack() {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
    } else {
      router.push("/sessions");
    }
  }

  return (
    <button
      onClick={handleBack}
      className="flex items-center gap-2 py-2 px-1 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors -ml-1"
    >
      <ArrowLeft className="size-5" />
      {t("backToSessions")}
    </button>
  );
}
```

#### 2c. Header

```
[BackButton]                              [Share button]
[Badge de tipo]
[h1: Nome da Pista]
[Subtítulo: Carro · Data]

[Best Lap] | [Delta vs PB]
```

Share button:
```tsx
<button
  onClick={() => setShareOpen(true)}
  className="flex items-center gap-2 px-3 py-1.5 rounded-md border border-border text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-control-hover transition-colors"
>
  <Share2 className="size-4" />
  {t("share.title")}
</button>
```

Hero metrics: manter o layout atual (Best Lap + Delta separados por `border-r border-border`). No mobile, empilhar verticalmente com `flex-col`.

#### 2d. Seção de Análise

Componente interno `SessionAnalysisSection` — um único card `bg-card border border-border rounded-xl p-5 space-y-4`:

**Bloco 1: Consistency**
```tsx
// Só renderiza se consistData !== null
<div>
  <div className="flex items-baseline justify-between mb-2">
    <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
      Consistency
    </span>
    <span className="text-sm font-medium text-muted-foreground">
      {t(`consistency.${consistData.labelKey}`)}
    </span>
  </div>
  <div className="flex items-baseline gap-2 mb-2">
    <span className="text-3xl font-bold tabular-nums">{consistData.score}</span>
    <span className="text-xs text-muted-foreground">{t("consistency.outOf")}</span>
  </div>
  <div className="h-1.5 bg-muted rounded-full overflow-hidden">
    <div className={`h-full rounded-full ${consistData.barColor}`} style={{ width: `${consistData.score}%` }} />
  </div>
  <p className="text-[10px] text-muted-foreground mt-1.5">
    {t("consistency.sigma", { value: (consistency! / 1000).toFixed(3) })}
  </p>
</div>
```

**Divider:** `<div className="h-px bg-border" />`

**Bloco 2: Avg Lap + Metadados**
```tsx
<div className="space-y-2.5">
  {avgLapMs && (
    <div className="flex items-baseline justify-between">
      <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
        {t("stats.avgLap")}
      </span>
      <div className="text-right">
        <span className="font-mono font-semibold text-sm text-foreground tabular-nums">
          {formatLapTime(avgLapMs)}
        </span>
        <span className="text-xs text-muted-foreground ml-2">
          {t("stats.avgVsBest", { delta: formatDelta(avgLapMs - bestLapMs) })}
        </span>
      </div>
    </div>
  )}

  {/* Metadata line */}
  <p className="text-xs text-muted-foreground flex flex-wrap gap-x-2 gap-y-1">
    <span>{t("stats.validOf", { valid: validLaps.length, total: laps.length })}</span>
    {cutLaps > 0 && (
      <>
        <span className="text-muted-foreground/30">·</span>
        <span className="text-red-400">{t("stats.cutsInline", { count: cutLaps })}</span>
      </>
    )}
    {mainTyre && (
      <>
        <span className="text-muted-foreground/30">·</span>
        <span className="uppercase">{mainTyre}</span>
      </>
    )}
    {s.distance_km > 0 && (
      <>
        <span className="text-muted-foreground/30">·</span>
        <span>{formatDistance(s.distance_km)}</span>
      </>
    )}
  </p>
</div>
```

**Bloco 3: Theoretical Best** (só se `theoretical !== null`)
```tsx
<>
  <div className="h-px bg-border" />
  <div>
    <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-2">
      {t("theoretical.title")}
    </p>
    <div className="flex items-baseline justify-between">
      <span className="font-mono font-bold text-xl tabular-nums">{formatLapTime(theoretical)}</span>
      <span className="text-xs text-green-400 font-medium">
        {t("theoretical.potentialGain", { value: formatDelta(theoretical - bestLapMs) })}
      </span>
    </div>
    <div className="flex gap-4 mt-2.5">
      {[["S1", bestS1], ["S2", bestS2], ["S3", bestS3]].map(([label, v]) => (
        <div key={label}>
          <span className="text-[10px] font-bold text-purple-400">{label}</span>
          <span className="font-mono text-xs text-foreground tabular-nums ml-1.5">{formatSector(v)}</span>
        </div>
      ))}
    </div>
  </div>
</>
```

#### 2e. Lap Table

Mover exatamente da `SessionDetailPanel.tsx` (filter bar + table). Sem alterações de lógica — apenas copiar para dentro do novo componente.

Melhoria visual na melhor volta: adicionar `border-l-2 border-primary` na `<tr>` da melhor volta, além do `bg-primary/[0.07]` existente.

#### 2f. Mobile Tabs

```tsx
const [activeTab, setActiveTab] = useState<"overview" | "laps">("overview");

// Tab bar — só no mobile
<div className="flex md:hidden border-b border-border">
  {(["overview", "laps"] as const).map((tab) => (
    <button
      key={tab}
      onClick={() => setActiveTab(tab)}
      className={cn(
        "flex-1 py-2.5 text-sm font-medium transition-colors",
        activeTab === tab
          ? "text-foreground border-b-2 border-primary -mb-px"
          : "text-muted-foreground hover:text-foreground"
      )}
    >
      {t(`tabs.${tab}`)}
    </button>
  ))}
</div>

// Desktop: side-by-side
// Mobile: conteúdo condicional por tab
<div className="flex flex-col md:flex-row gap-5">
  <div className={cn("w-full md:w-72 lg:w-80 shrink-0", activeTab !== "overview" && "hidden md:block")}>
    <SessionAnalysisSection ... />
  </div>
  <div className={cn("flex-1 min-w-0", activeTab !== "laps" && "hidden md:flex md:flex-col")}>
    <LapTable ... />
  </div>
</div>
```

#### 2g. ShareSessionModal

```tsx
const [shareOpen, setShareOpen] = useState(false);

// No JSX:
<ShareSessionModal
  session={shareSession}  // construir SessionWithMeta a partir da session
  open={shareOpen}
  theme={shareTheme}
  onThemeChange={setShareTheme}
  onClose={() => setShareOpen(false)}
/>
```

O `ShareSessionModal` espera um `SessionWithMeta`. Construir inline:
```typescript
const sessionWithMeta: SessionWithMeta = {
  ...data.session,
  deltaPbMs: pbDelta,
  badge: pbDelta !== null && pbDelta <= 0 ? "new_pb" : null,
};
```

---

### Task 3 — Criar RSC `[sourceId]/page.tsx`

**Arquivo novo:** `apps/web/app/(dashboard)/sessions/[sourceId]/page.tsx`

```typescript
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SessionDetailContent } from "./SessionDetailContent";
import type { Session, PersonalBest, Lap } from "@/lib/types";

export default async function SessionDetailPage({
  params,
}: {
  params: Promise<{ sourceId: string }>;
}) {
  const { sourceId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [sessionRes, lapsRes] = await Promise.all([
    supabase
      .from("sessions")
      .select("*")
      .eq("user_id", user.id)
      .eq("source_id", sourceId)
      .maybeSingle(),
    supabase
      .from("laps")
      .select("*")
      .eq("user_id", user.id)
      .eq("session_source_id", sourceId)
      .order("lap_number", { ascending: true }),
  ]);

  if (!sessionRes.data) redirect("/sessions");
  const session = sessionRes.data as Session;

  const [pbRes, trackSessionsRes] = await Promise.all([
    supabase
      .from("personal_bests")
      .select("*")
      .eq("user_id", user.id)
      .eq("car_id", session.car_id)
      .eq("track_id", session.track_id)
      .maybeSingle(),
    supabase
      .from("sessions")
      .select("*")
      .eq("user_id", user.id)
      .eq("track_id", session.track_id)
      .neq("source_id", sourceId)
      .order("started_at", { ascending: false })
      .limit(5),
  ]);

  return (
    <SessionDetailContent
      data={{
        session,
        laps: (lapsRes.data ?? []) as Lap[],
        pb: pbRes.data as PersonalBest | null,
        trackSessions: (trackSessionsRes.data ?? []) as Session[],
      }}
    />
  );
}
```

---

### Task 4 — Modificar `SessionsContent.tsx` e `SessionsClient.tsx`

#### `SessionsContent.tsx`

**Remover:**
- `import { SessionDetailPanel, type SessionPanelData } from "@/components/SessionDetailPanel"`
- Estado `panel` e `loadingId`
- Callback `openSession` (fetch + setPanel)
- Callback `closePanel`
- Renderização condicional `if (panel) return <SessionDetailPanel ... />`

**Alterar** o callback `onSelect`:
```typescript
// Antes:
const openSession = useCallback(async (sourceId: string) => {
  if (loadingId) return;
  setLoadingId(sourceId);
  try {
    const res = await fetch(`/api/sessions/${sourceId}`);
    if (res.ok) setPanel(await res.json());
  } finally {
    setLoadingId(null);
  }
}, [loadingId]);

// Depois:
const openSession = useCallback((sourceId: string) => {
  router.push(`/sessions/${sourceId}`);
}, [router]);
```

**Alterar** prop passada ao `SessionsClient`:
```typescript
// Remover loadingId={loadingId}
<SessionsClient
  sessions={sortedSessions}
  sortDirection={sortDirection}
  onSelect={openSession}
  onShare={openShare}
  onSortChange={setSortDirection}
/>
```

#### `SessionsClient.tsx`

**Remover** prop `loadingId` da interface `Props` e todos os usos (`aria-busy`, `disabled={loadingId === s.source_id}`, etc).

O botão de "Ver detalhes" passa a ser apenas um clique simples — sem estado de loading, pois a navegação é gerenciada pelo router.

---

### Task 5 — Remover `SessionDetailPanel.tsx`

**Arquivo a deletar:** `apps/web/components/SessionDetailPanel.tsx`

Verificar antes de deletar que nenhum arquivo importa `SessionDetailPanel` ou `SessionPanelData`:
```
grep -r "SessionDetailPanel\|SessionPanelData" apps/web/
```

Se o grep não retornar resultados além do próprio arquivo → deletar.

Também verificar se `SessionPanelData` é exportado/usado em algum outro lugar.

---

### Task 6 — Verificação

Checklist antes de considerar concluído:

**Funcional:**
- [ ] Acessar `/sessions`, clicar em "Ver detalhes" → navega para `/sessions/[sourceId]`
- [ ] URL muda no browser
- [ ] Botão voltar (`← Sessions`) funciona e retorna para a lista
- [ ] Mouse back (botão lateral) retorna para a lista
- [ ] Acessar URL diretamente → dados carregam
- [ ] `source_id` inválido → redireciona para `/sessions`
- [ ] Share button na lista ainda funciona
- [ ] Share button na página de detalhe abre o modal

**Visual desktop:**
- [ ] Back button grande e clicável
- [ ] Header com badge, título (pista), subtítulo (carro · data), hero metrics
- [ ] Seção de análise: consistency, avg lap, metadata line, theoretical best
- [ ] Tabela de voltas com todas as colunas e cores por setor
- [ ] Melhor volta com `border-l-2 border-primary`

**Visual mobile:**
- [ ] Tabs "Resumo" / "Voltas" visíveis
- [ ] Tab Resumo: seção de análise
- [ ] Tab Voltas: tabela com scroll horizontal
- [ ] Header sempre visível

**i18n:**
- [ ] Sem erros de chave não encontrada no console
- [ ] Tabs aparecem em PT-BR quando idioma está em PT

**Build:**
- [ ] `npm run build` sem erros em `apps/web`
- [ ] `npm run lint` sem erros

---

## Dependências entre Tasks

```
Task 1 (i18n)
    ↓
Task 2 (SessionDetailContent)
    ↓
Task 3 (RSC page)
    ↓
Task 4 (Modificar SessionsContent + SessionsClient)
    ↓
Task 5 (Deletar SessionDetailPanel)
    ↓
Task 6 (Verificação)
```

---

## Arquivos Afetados

| Arquivo | Ação |
|---------|------|
| `apps/web/messages/en.json` | Modificar |
| `apps/web/messages/pt-BR.json` | Modificar |
| `apps/web/app/(dashboard)/sessions/[sourceId]/page.tsx` | Criar |
| `apps/web/app/(dashboard)/sessions/[sourceId]/SessionDetailContent.tsx` | Criar |
| `apps/web/app/(dashboard)/sessions/SessionsContent.tsx` | Modificar |
| `apps/web/app/(dashboard)/sessions/SessionsClient.tsx` | Modificar |
| `apps/web/components/SessionDetailPanel.tsx` | Deletar |

**Não afetados:**
- `SessionsFilters.tsx` — sem alterações
- `share-session-modal.tsx` — reutilizado sem alterações
- `session-share-card.tsx` — reutilizado sem alterações
- `session-badge.tsx` — reutilizado sem alterações
- `app/api/sessions/[id]/route.ts` — mantida (pode ser removida futuramente, mas não nessa task)
