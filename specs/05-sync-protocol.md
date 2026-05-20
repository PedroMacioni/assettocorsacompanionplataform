# Spec: Protocolo de Sincronização

## Visão geral

O agente sincroniza dados do Content Manager para o Supabase via HTTPS. A sincronização é sempre **agent → cloud (push)**. O cloud nunca contata o agente diretamente.

---

## Ciclos de sincronização

O agente executa sincronização em três situações:

| Trigger | Ação |
|---|---|
| Startup do agente | Sync completo (catch-up de tudo que não foi sincronizado) |
| `FileSystemWatcher` detecta novo arquivo em `Sessions/` | Sync imediato do arquivo novo |
| Timer periódico (default: 5 min) | Sync incremental (apenas não sincronizados) |

---

## Sincronização de sessões

### Deduplicação

O `source_id` é o nome do arquivo JSON do CM sem extensão (ex: `20250519_143200`). A tabela `sessions` tem constraint `UNIQUE(user_id, source_id)`.

O agente mantém um cache local (`synced_ids.json`) com todos os `source_ids` já enviados com sucesso. Antes de enviar, filtra a lista de arquivos locais contra este cache.

O Supabase recebe com `Prefer: resolution=merge-duplicates` — idempotente se enviado duas vezes.

### Formato do request (upsert em batch)

```http
POST /rest/v1/sessions
Authorization: Bearer {user_jwt}
apikey: {supabase_anon_key}
Content-Type: application/json
Prefer: resolution=merge-duplicates

[
  {
    "user_id": "uuid-do-usuario",
    "source_id": "20250519_143200",
    "started_at": "2025-05-19T14:32:00Z",
    "driver_name": "Pedro",
    "car_id": "ferrari_458",
    "track_id": "monza",
    "session_types": "Race",
    "laps": 12,
    "distance_km": 57.84,
    "best_lap_ms": 105300,
    "last_lap_ms": 106100
  },
  ...
]
```

**Tamanho do batch:** máximo 100 sessões por request. Se houver mais, quebrar em múltiplos requests sequenciais.

### Response de sucesso

```http
HTTP 201 Created
```

Após sucesso: adicionar todos os `source_id` enviados ao `synced_ids.json`.

---

## Sincronização de personal bests

Personal bests **não têm deduplicação incremental** — o arquivo `personalbest.ini` é reescrito pelo AC a cada sessão. O agente sempre envia a lista completa atual.

```http
POST /rest/v1/personal_bests
Authorization: Bearer {user_jwt}
apikey: {supabase_anon_key}
Content-Type: application/json
Prefer: resolution=merge-duplicates

[
  {
    "user_id": "uuid-do-usuario",
    "car_id": "ferrari_458",
    "track_id": "monza",
    "time_ms": 105300,
    "source_date": 1716124320
  },
  ...
]
```

A constraint `UNIQUE(user_id, car_id, track_id)` garante que um upsert atualiza o tempo se for melhor. **Atenção:** o `merge-duplicates` atualiza com o valor do request — o agente deve enviar sempre o melhor tempo atual (o `personalbest.ini` já armazena apenas o melhor).

### Frequência de sync de personal bests

Sincronizar personal bests apenas quando o arquivo `personalbest.ini` for modificado (via `FileSystemWatcher`) ou no sync de startup. Não sincronizar a cada ciclo de 5 minutos se o arquivo não mudou.

---

## Renovação de token

O JWT do Supabase expira em 1 hora. O agente deve renovar antes de expirar.

```
// Ao inicializar:
var client = new SupabaseClient(url, anonKey);
await client.Auth.SetSession(accessToken, refreshToken);

// O SDK renova automaticamente o access_token usando o refresh_token
// quando o token está próximo de expirar
```

Se o `refresh_token` também expirar ou for revogado (ex: usuário fez logout no web): mudar ícone do tray para vermelho e notificar usuário para reconfigurar o token nas configurações.

---

## Tratamento de erros e resiliência

### Tabela de erros

| HTTP Status | Significado | Ação do agente |
|---|---|---|
| 201 | Sucesso | Salvar source_ids no cache |
| 400 | Dados inválidos | Log de erro, pular sessão problemática, continuar com as outras |
| 401 | Token inválido/expirado | Tentar renovar via refresh_token; se falhar, notificar usuário |
| 429 | Rate limit | Backoff exponencial: 1s → 2s → 4s → 8s → 60s (máx) |
| 5xx | Erro do servidor | Retry com backoff; após 3 falhas, agendar para próximo ciclo |
| Timeout / sem rede | Sem conexão | Enfileirar, tentar no próximo ciclo periódico |

### Fila offline

Se o agente detecta ausência de rede (qualquer request falha com timeout ou connection refused):
1. Não tentar novamente imediatamente
2. Aguardar próximo ciclo periódico (5 min)
3. Não mostrar erro no tray até N=3 falhas consecutivas
4. Após N=3: tooltip "Sem conexão — sincronização pausada"

### Integridade do cache

Se `synced_ids.json` for corrompido ou deletado:
- O agente faz um sync completo na próxima inicialização
- O Supabase recebe com `merge-duplicates`, então é seguro re-enviar dados já sincronizados
- O cache é reconstruído a partir dos source_ids retornados com sucesso

---

## Diagrama de sequência (sync normal)

```
Agent                          FileSystem             Supabase
  │                               │                      │
  │   FileSystemWatcher event     │                      │
  │◄──────────────────────────────│                      │
  │                               │                      │
  │   ReadAllFiles(Sessions/)     │                      │
  │──────────────────────────────►│                      │
  │   [list of .json files]       │                      │
  │◄──────────────────────────────│                      │
  │                               │                      │
  │   Filter vs synced_ids.json   │                      │
  │   [new files only]            │                      │
  │                               │                      │
  │   ParseSessions(new files)    │                      │
  │──────────────────────────────►│                      │
  │   [SessionDto[]]              │                      │
  │◄──────────────────────────────│                      │
  │                               │                      │
  │   POST /rest/v1/sessions      │                      │
  │──────────────────────────────────────────────────────►
  │                               │                      │
  │   HTTP 201 Created            │                      │
  │◄──────────────────────────────────────────────────────
  │                               │                      │
  │   UpdateCache(synced_ids)     │                      │
  │──────────────────────────────►│                      │
  │                               │                      │
  │   UpdateTrayIcon("Sync OK")   │                      │
```

---

## Configuração de rede

O agente só faz requests de saída (outbound HTTPS na porta 443). Não abre portas, não requer configuração de firewall no roteador do usuário. Funciona atrás de NAT doméstico.

---

## Limites

| Parâmetro | Valor padrão | Configurável? |
|---|---|---|
| Intervalo de sync periódico | 5 minutos | Sim (1–60 min) |
| Batch size de sessões | 100 | Não |
| Timeout de request HTTP | 30 segundos | Não |
| Máx retries consecutivos | 3 | Não |
| Backoff máximo | 60 segundos | Não |
