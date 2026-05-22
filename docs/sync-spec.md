# Spec: CompanionAgent Sync — Revisão Completa

## Diagnóstico: bugs atuais confirmados pelo código

### Bug 1 — CRÍTICO: Setores nunca sincronizados (causa direta do problema relatado)

Em `SyncWorker.cs:93-99`:
```csharp
var allLaps = unsynced
    .SelectMany(s => _history.GetSessionLaps(s.Id).Laps)
    .ToList();

if (allLaps.Count > 0)
    await _supabase.UpsertLapsAsync(allLaps);

_cache.AddSessions(unsynced.Select(s => s.Id)); // ← marca SEMPRE, mesmo sem voltas
```

A sessão vai para `SyncedSessionIds` independentemente de ter sincronizado voltas. Cenário que acontece frequentemente: o `FileSystemWatcher` dispara `Created` no momento exato em que o CM está **escrevendo** o arquivo JSON — o arquivo ainda não está fechado. `ParseJsonLaps` tenta ler → JSON truncado ou inválido → `catch { }` silencioso → retorna `[]` → sessão marcada como "sincronizada" sem uma única volta. **Nunca mais retentada.**

### Bug 2 — CRÍTICO: `batchSize = 1` em `UpsertTracksAsync`

Em `SupabaseClient.cs:207`:
```csharp
const int batchSize = 1;
```

Com 50 pistas = 50 requests HTTP sequenciais de 30s cada. Isso é o "trava" que aparece na UI. O estado já voltou para `Idle` (linha 124 do `SyncWorker`) mas a `SyncTracksAsync` ainda está rodando em background fazendo 50+ requests.

### Bug 3 — ALTO: FileSystemWatcher sem debounce

O Windows dispara o evento `Changed` do watcher 5–10x para uma única escrita de arquivo. O `Created` pode disparar 2–3x. O semaphore serializa, mas:
- 9 de cada 10 invocações fazem lock attempt e logam "já em andamento" — ruído
- O último pode pegar o arquivo num estado inconsistente (CM ainda escrevendo)
- Sem delay após `Created`, há race condition garantida entre o processo do CM e o agente

### Bug 4 — ALTO: Nenhum retry de voltas

Uma vez em `SyncedSessionIds`, as voltas da sessão **nunca** são tentadas novamente. Se a rede caiu durante `UpsertLapsAsync`, a sessão pode ter ido pro cache sem as voltas no Supabase. Sem mecanismo de detecção ou reparo.

### Bug 5 — MÉDIO: Sem timeout global para operações secundárias

`SyncTracksAsync` e `SyncCarBadgesAsync` têm `try { ... } catch { }` no caller, mas internamente fazem loops de N requests sem timeout total. Uma rede lenta pode manter essas operações rodando por 10–30 minutos.

### Bug 6 — MÉDIO: Token refresh sem mutex

`EnsureValidTokenAsync()` não tem proteção contra chamadas simultâneas. Se dois loops chamarem ao mesmo tempo, ambos tentam refresh — o Supabase rotaciona o `refresh_token` e o segundo request falha com 401.

---

## Arquitetura proposta

### 1. Separar o que foi sincronizado: sessão vs. voltas

**Hoje**: uma lista `SyncedSessionIds` controla tudo.

**Proposto**: duas listas independentes:
- `SyncedSessionIds` — sessão (metadados) enviada com sucesso
- `SyncedLapSessionIds` — voltas+setores desta sessão enviados com sucesso E com pelo menos 1 volta

Uma sessão só entra em `SyncedLapSessionIds` se `GetSessionLaps` retornou `> 0` voltas E o upsert no Supabase teve sucesso. A cada ciclo de sync, todas as sessões em `SyncedSessionIds` mas **não** em `SyncedLapSessionIds` são retentadas para voltas.

### 2. Debounce + delay no FileSystemWatcher

```
FileSystem event → cancelar timer anterior → armar timer 800ms → disparar SyncAsync
```

O delay de 800ms garante que o CM terminou de escrever. Múltiplos eventos do mesmo arquivo coalescem em um único sync.

### 3. UpsertTracksAsync com batchSize 50

Reduz de 100 requests para 2 requests para 100 pistas.

### 4. Timeout global para operações secundárias

`SyncTracksAsync` e `SyncCarBadgesAsync` recebem um `CancellationToken` com timeout de 90s cada. Se exceder, logam aviso e avançam sem bloquear.

### 5. Mutex no token refresh

`SemaphoreSlim(1,1)` dedicado ao refresh. `EnsureValidTokenAsync` adquire antes de verificar/executar o refresh.

### 6. Diagnóstico explícito no log

Logar **por sessão**: quantas voltas foram encontradas e enviadas. Se 0 voltas foram encontradas num arquivo existente, logar aviso e marcar para retry.

---

## Plano de implementação

### Fase 1 — Fix crítico (setores)

**`SyncCache.cs`**:
- Adicionar `HashSet<string> SyncedLapSessionIds`
- Método `MarkLapsSynced(IEnumerable<string> ids)`
- Serialização/deserialização do novo campo

**`SyncWorker.cs`**:
- Mudar a lógica de sync de voltas: separar o ciclo em dois passes
  - **Passe A**: sessões novas (não em `SyncedSessionIds`) → upsert sessão → upsert voltas → se voltas > 0, adicionar a ambas as listas; se voltas = 0, só a `SyncedSessionIds`
  - **Passe B**: sessões em `SyncedSessionIds` mas não em `SyncedLapSessionIds` → tentar novamente o upsert de voltas
- Adicionar delay de 800ms antes da primeira tentativa de ler voltas de sessão recém-criada (via watcher)

### Fase 2 — Fix de performance (batchSize)

**`SupabaseClient.cs`**:
- `UpsertTracksAsync`: aumentar `batchSize` de 1 para 50

### Fase 3 — Debounce + timeout

**`SyncWorker.cs`**:
- Substituir event handlers diretos do watcher por método `ScheduleDebounced(int delayMs)` com `Timer` que cancela/re-arma
- `SyncTracksAsync` e `SyncCarBadgesAsync` recebem `CancellationToken` com 90s timeout

### Fase 4 — Mutex no refresh + diagnóstico

**`SupabaseClient.cs`**:
- `SemaphoreSlim _refreshLock = new(1,1)` em torno do refresh
- Logar warnings quando token próximo de expirar

**`SyncWorker.cs`**:
- Log por sessão: `"Sessão {id}: {n} voltas, S1/S2/S3 setores"` ou `"⚠ Sessão {id}: 0 voltas encontradas — retry no próximo ciclo"`

### Fase 5 — UI: botão de re-sync de voltas

No `MainForm.cs`, adicionar botão "Re-sincronizar voltas" que chama `SyncWorker.ForceResyncLapsAsync()` — limpa `SyncedLapSessionIds` e dispara um ciclo completo de retry.

---

## Ordem de prioridade

| # | O quê | Impacto | Esforço |
|---|-------|---------|---------|
| 1 | Separar `SyncedSessionIds` / `SyncedLapSessionIds` + retry de voltas | Resolve setores | Médio |
| 2 | Debounce + delay pós-`Created` | Resolve race condition com CM | Baixo |
| 3 | `batchSize` de tracks: 1 → 50 | Resolve "trava" | Trivial |
| 4 | Timeout global em operações secundárias | Robustez | Baixo |
| 5 | Mutex no refresh + logs detalhados | Diagnóstico + confiabilidade | Baixo |
| 6 | Botão "re-sync voltas" na UI | UX de recovery | Médio |
