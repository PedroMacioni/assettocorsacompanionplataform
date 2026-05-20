# Arquitetura do Sistema

## Diagrama de componentes

```
┌─────────────────────────────────────────────────────────┐
│                    Máquina do usuário (Windows)          │
│                                                          │
│   ┌────────────────────┐    ┌─────────────────────────┐ │
│   │  Content Manager   │    │   CompanionAgent (EXE)  │ │
│   │  (Assetto Corsa)   │    │                         │ │
│   │                    │    │  ┌───────────────────┐  │ │
│   │  Sessions/*.json   │───▶│  │  HistoryReader    │  │ │
│   │  personalbest.ini  │───▶│  │  (Infrastructure) │  │ │
│   └────────────────────┘    │  └────────┬──────────┘  │ │
│                             │           │              │ │
│                             │  ┌────────▼──────────┐  │ │
│                             │  │   SyncService     │  │ │
│                             │  │  (cloud push)     │  │ │
│                             │  └────────┬──────────┘  │ │
│                             │           │              │ │
│                             │  ┌────────▼──────────┐  │ │
│                             │  │  SystemTray UI    │  │ │
│                             │  │  (status, menus)  │  │ │
│                             │  └───────────────────┘  │ │
│                             └──────────┬──────────────┘ │
└────────────────────────────────────────┼────────────────┘
                                         │ HTTPS (JWT)
                                         ▼
┌─────────────────────────────────────────────────────────┐
│                         Supabase Cloud                   │
│                                                          │
│   ┌─────────────┐   ┌──────────────┐  ┌─────────────┐  │
│   │  Auth       │   │  PostgreSQL   │  │  PostgREST  │  │
│   │  (JWT)      │   │  (dados)      │  │  (API REST) │  │
│   └─────────────┘   └──────────────┘  └──────┬──────┘  │
└────────────────────────────────────────────────┼────────┘
                                                 │ HTTPS
                                                 ▼
┌─────────────────────────────────────────────────────────┐
│                     Web Frontend                         │
│              (Next.js — acessível de qualquer OS)        │
│                                                          │
│   Landing │ Login │ Dashboard │ Sessions │ Personal Bests│
└─────────────────────────────────────────────────────────┘
```

---

## Componentes e responsabilidades

### CompanionAgent (EXE — Windows)

Evolução do `CompanionAgent.Api` atual. Passa a ser um processo de system tray com sync ativo para o cloud.

**Responsabilidades:**
- Ler sessões do CM e personal bests do disco (já existe em `LocalHistoryService`)
- Detectar novas sessões via `FileSystemWatcher` na pasta `Sessions/`
- Autenticar com Supabase usando token do usuário
- Sincronizar sessões novas (dedup por `source_id`)
- Exibir status no tray (ícone + tooltip + menu)
- Armazenar token e configurações em `%AppData%\SimRacingCompanion\settings.json`
- Iniciar junto com o Windows (registro `HKCU\Software\Microsoft\Windows\CurrentVersion\Run`)

**Projetos na solution:**
```
apps/
  CompanionAgent/
    CompanionAgent.Api/       ← já existe (local HTTP API — manter para dev)
    CompanionAgent.Tray/      ← NOVO: entry point do system tray
    CompanionAgent.Sync/      ← NOVO: SyncService, SupabaseClient
packages/
  Companion.Domain/           ← já existe
  Companion.Infrastructure/   ← já existe
  Companion.SharedContracts/  ← já existe
```

---

### Supabase Cloud

Backend completo sem servidor de aplicação próprio.

**Responsabilidades:**
- Autenticação de usuários (email/senha, OAuth Google)
- Armazenamento de sessões e personal bests por usuário
- API REST via PostgREST (gerada automaticamente das tabelas)
- Row Level Security (RLS): cada usuário só acessa seus próprios dados
- Aggregações de summary via views ou functions SQL

---

### Web Frontend (Next.js)

SPA/SSR hospedada separadamente (Vercel, Railway, etc.).

**Responsabilidades:**
- Autenticação via Supabase Auth (client JS SDK)
- Dashboard de stats do usuário
- Histórico de sessões com filtros
- Personal bests por carro/pista
- Página de configuração: token do agente, perfil

---

## Fluxo de dados

### Primeira configuração

```
1. Usuário cria conta no web (Supabase Auth)
2. Web exibe página "Conectar Agente" com token de API
3. Usuário instala CompanionAgent e cola o token
4. Agente valida token com Supabase e começa a sincronizar
```

### Sync normal (operação contínua)

```
1. FileSystemWatcher detecta novo arquivo em Sessions/ ao fechar o AC
2. SyncService lê o arquivo e monta SessionDto
3. SyncService consulta lista de source_ids já sincronizados (cache local)
4. Faz POST /sessions (bulk upsert com on_conflict=source_id)
5. Marca sessões como sincronizadas no cache local
6. Ícone do tray atualiza para "Sincronizado às HH:mm"
```

### Sync periódico (fallback)

```
- A cada 5 minutos (configurável), compara arquivos locais com cache
- Envia qualquer sessão ainda não sincronizada
- Garante recuperação após falhas de rede
```

---

## Decisões de design

| Decisão | Escolha | Motivo |
|---|---|---|
| Push vs Pull | Agent faz push | Agent está atrás de NAT; cloud não consegue alcançar agent |
| Dedup | `source_id` (nome do arquivo JSON do CM) | Idempotente; upsert seguro |
| Auth no agent | JWT do Supabase | Mesmo sistema do web; sem infraestrutura adicional |
| Detecção de novas sessões | FileSystemWatcher + polling fallback | Evento imediato + resiliência |
| Cache local de sincronização | JSON em AppData | Simples; evita re-leitura de todos os arquivos a cada ciclo |
| Telemetria ao vivo (v2) | WebSocket/SignalR do agente para cloud | Não implementar em v1 |
