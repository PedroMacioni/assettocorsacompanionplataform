# Companion Agent v3 — Spec

**Data:** 2026-06-01  
**Status:** Em revisão  
**Decisão:** Reescrita completa em WPF, repo separado, distribuição via Inno Setup + Velopack

---

## Contexto

O agente atual existe em duas formas que nunca chegaram a funcionar bem juntas:
- `CompanionAgent.Tray` — WinForms funcional mas limitado
- `CompanionAgent.Desktop` — WinUI3 bonito mas instável, nunca abria de forma confiável

O objetivo é criar uma versão 3 do agent: **um único app WPF**, simples e consistente, com todas as funcionalidades necessárias funcionando de verdade, distribuído como um instalador `.exe` que qualquer pessoa consegue rodar.

---

## Objetivos

1. **Instalador único** — `.exe` que qualquer pessoa roda e funciona
2. **Detecção automática** das pastas do Assetto Corsa
3. **Sync confiável** — sessões enviadas automaticamente após o fim de cada corrida
4. **Sync via web** — botão na dashboard funciona de verdade
5. **Multi-computador** — modo Fonte vs Visualizador
6. **Auto-update** — notificação dentro do app, instalação com um clique
7. **Log completo** — visível na UI e salvo em arquivo
8. **i18n** — pt-BR e en, selecionado na instalação

---

## Arquitetura

### Repo separado

- **Novo repo:** `ac-companion-agent` (GitHub, público)
- Monorepo da plataforma (`assettocorsacompanionplataform`) referencia o repo do agent na documentação
- Releases publicadas via GitHub Releases no novo repo
- O conteúdo atual de `apps/CompanionAgent/` é arquivado/deletado do monorepo

### Estrutura do novo repo

```
ac-companion-agent/
├── src/
│   ├── CompanionAgent.App/          # WPF — UI principal
│   ├── CompanionAgent.Core/         # Sync engine, modelos, settings
│   └── CompanionAgent.Installer/    # Inno Setup scripts (.iss)
├── resources/
│   ├── strings/
│   │   ├── pt-BR.json
│   │   └── en.json
│   └── icons/
├── .github/
│   └── workflows/
│       ├── build.yml                # CI: build + test em cada PR
│       └── release.yml              # CD: build + Velopack + GitHub Release
├── CHANGELOG.md
├── README.md
└── CompanionAgent.sln
```

### Projetos C#

| Projeto | Framework | Tipo |
|---------|-----------|------|
| `CompanionAgent.App` | net10.0-windows | WPF (OutputType=WinExe) |
| `CompanionAgent.Core` | net10.0-windows | Class Library |

> **Sem API local.** O `/api/*` local não será incluído na v3 — nenhum consumer conhecido.

---

## Componentes

### 1. Instalador (Inno Setup)

O instalador é um `.exe` compilado pelo Inno Setup. O usuário baixa e roda — nenhuma dependência pré-instalada.

**Telas do wizard:**

1. **Bem-vindo** — nome do app, versão, logo
2. **Idioma** — pt-BR / English (define `language` no settings.json)
3. **Pasta do Assetto Corsa** — detectada automaticamente, usuário pode corrigir
4. **Pasta do Content Manager** — detectada automaticamente, usuário pode corrigir
5. **Conta** — tela de login (email + senha), valida antes de continuar
6. **Modo** — `Fonte de dados` (este PC tem o AC) / `Somente visualização`
7. **Auto-iniciar com Windows** — checkbox, ativa entrada no registro
8. **Instalar** — copia arquivos, aplica configurações, inicia o app

**Detecção automática de pastas:**

```
AC padrão:    %PROGRAMFILES%\Steam\steamapps\common\assettocorsa
              %PROGRAMFILES(X86)%\Steam\steamapps\common\assettocorsa
CM Sessions:  %APPDATA%\AcTools Content Manager\Progress\Sessions\
Personal best: %DOCUMENTS%\Assetto Corsa\personalbest.ini
```

Se não encontrar, campo fica em branco e usuário preenche manualmente.

### 2. App WPF

**Princípios de UI:**
- Janela simples, sem decorações customizadas
- Janela padrão do Windows com título e botões de minimizar/fechar nativos
- Dark theme via `ResourceDictionary` — cores fixas, sem animações
- Ícone na bandeja do sistema (tray) — duplo clique abre a janela

**Layout da janela (TabControl simples):**

```
┌─────────────────────────────────────────────┐
│  Sim Racing Companion  [_][X]               │
├─────────────────────────────────────────────┤
│  [Visão Geral] [Log] [Configurações] [Sobre]│
├─────────────────────────────────────────────┤
│                                             │
│  (conteúdo da aba selecionada)              │
│                                             │
└─────────────────────────────────────────────┘
```

**Aba: Visão Geral**

```
● Conectado como pedro@exemplo.com           [Desconectar]
Modo: Fonte de dados
Último sync: há 2 minutos (24 sessões, 1.847 laps)
Próximo sync automático: em 28s

[Sincronizar agora]   [Ressincronizar laps]
```

**Aba: Log**

```
[Filtro: Todos ▼]  [Limpar]  [Abrir arquivo]

10:32:01 INFO  [Sync] Sessão detectada: Spa-Francorchamps 2026-06-01
10:32:02 INFO  [Laps] Enviando 24 laps em 1 batch...
10:32:03 OK    [Laps] 24 laps sincronizadas
10:32:04 WARN  [Tracks] Track outline não encontrada, pulando
10:32:05 ERROR [Cars] Timeout ao enviar preview — será tentado novamente
```

Filtro por nível: Todos / Info / Warnings / Erros

**Aba: Configurações**

- Pasta do Assetto Corsa (editável, com botão "Detectar")
- Pasta do Content Manager (editável)
- Modo (Fonte / Visualizador)
- Idioma (pt-BR / English) — requer reinício
- Auto-iniciar com Windows
- Intervalo de poll web sync (padrão: 30s)

**Aba: Sobre / Atualizações**

```
Sim Racing Companion v3.0.0
Verificando atualizações...

╔══════════════════════════════════════╗
║ Atualização disponível: v3.1.0       ║
║ [Ver novidades]  [Instalar e reiniciar] ║
╚══════════════════════════════════════╝
```

### 3. Core Sync Engine

Migrado e limpo do `CompanionAgent.Core` atual. Mudanças:

| Componente | Status | Mudança |
|------------|--------|---------|
| `SupabaseClient` | Migrar | Sem alterações funcionais |
| `SyncWorker` | Migrar + fix | Debounce 800ms no FileSystemWatcher |
| `SyncCache` | Migrar | Sem alterações |
| `SettingsStore` | Reescrever | Adicionar `language`, `mode`, `paths` explícitos |
| `RetryQueue` | Migrar | Sem alterações |
| `AutoStartManager` | Migrar | Sem alterações |
| `LogService` | **Novo** | Log estruturado para UI + arquivo |

### 4. Log Service

```csharp
public enum LogLevel { Info, Warning, Error, Success }
public enum LogCategory { Auth, Sync, Sessions, Laps, Tracks, Cars, Update, WebSync }

public record LogEntry(DateTime Timestamp, LogLevel Level, LogCategory Category, string Message);
```

- **Buffer em memória:** ring buffer de 1.000 entradas para a UI
- **Arquivo:** `%APPDATA%\SimRacingCompanion\Logs\agent-YYYY-MM-DD.log`
- **Rotação:** mantém os últimos 7 dias, apaga os mais antigos
- **Formato no arquivo:** `2026-06-01T10:32:01 INFO  [Sync] Sessão detectada: Spa`
- **Evento:** `IObservable<LogEntry>` — a UI se inscreve e atualiza em tempo real

### 5. Auto-update (Velopack)

- Verificação na inicialização + a cada 4 horas
- Ao encontrar update: banner visível na aba "Sobre"
- Botão "Instalar e reiniciar": aplica update e reinicia
- Releases publicadas em: `github.com/[usuario]/ac-companion-agent/releases`

### 6. Web Sync (sync sob demanda da dashboard)

**Fluxo:**

```
Dashboard web                     Agent
     │                               │
     │ clica "Sincronizar"           │
     │                               │
     ├──► UPDATE agent_status        │
     │    SET sync_requested_at=now()│
     │                               │
     │              agent faz poll a cada 30s
     │                               │
     │              ├── GET agent_status
     │              │   WHERE user_id = ?
     │              │
     │              │   sync_requested_at > last_seen_at?
     │              │
     │              ├── SIM: dispara sync imediato
     │              │
     │              └── POST agent_status
     │                  SET last_sync_at = now()
     │                      synced_sessions = count
```

**Na web (apps/web):** botão "Sincronizar" chama Server Action que faz `upsert` na tabela `agent_status`.

### 7. Modo Multi-computador

Setting `mode` em `settings.json`:

```json
{ "mode": "source" }   // ou "viewer"
```

| Comportamento | Fonte | Visualizador |
|---------------|-------|--------------|
| FileSystemWatcher | Ativo | Inativo |
| Sync automático pós-sessão | Sim | Não |
| Poll web sync | Sim | Não |
| Mostra dados da conta | Sim | Sim |
| Botão "Sync agora" | Habilitado | Desabilitado |

O modo Visualizador é apenas para acompanhar o status de sync de outra máquina — útil para ver se o PC de corrida está sincronizando.

### 8. i18n

Arquivos JSON em `resources/strings/`:

```json
// pt-BR.json
{
  "app.title": "Sim Racing Companion",
  "tab.overview": "Visão Geral",
  "tab.log": "Log",
  "tab.settings": "Configurações",
  "tab.about": "Sobre",
  "status.connected": "Conectado como {0}",
  "status.disconnected": "Desconectado",
  "sync.last": "Último sync: {0}",
  "sync.now": "Sincronizar agora",
  "sync.resync": "Ressincronizar laps",
  ...
}
```

Carregado na inicialização com base em `settings.json > language`. Acessível via singleton `I18n.T("chave")`.

---

## Controle de Versão e Releases

### Versionamento

Seguir SemVer: `MAJOR.MINOR.PATCH`
- `MAJOR`: mudança incompatível (ex: novo schema de settings)
- `MINOR`: nova feature
- `PATCH`: bugfix

Versão inicial: `3.0.0`

### Processo de release

1. Atualizar `CHANGELOG.md` com as mudanças
2. Criar tag `v3.0.0` no git
3. GitHub Actions build:
   - Compila o projeto em Release/x64
   - Roda Velopack para empacotar
   - Compila instalador Inno Setup
   - Publica no GitHub Releases:
     - `SimRacingCompanion-Setup-3.0.0.exe` (instalador para novos usuários)
     - arquivos Velopack (para auto-update dos existentes)

---

## O que fazer com o repo atual

O conteúdo de `apps/CompanionAgent/` no monorepo será removido.  
O novo repo `ac-companion-agent` é independente.  
O monorepo mantém apenas `apps/web/` e `packages/` e `supabase/`.

---

## Fora do escopo (v3)

- App mobile
- Telemetria em tempo real (durante corrida)
- Múltiplos jogos além do AC
- Modo offline sem internet
