# Companion Agent v3 — Plano de Implementação

**Data:** 2026-06-01  
**Spec:** `docs/superpowers/specs/2026-06-01-companion-agent-v3.md`  
**Status:** MVP completo — falta teste manual e Phase 8

---

## Fase 0 — Setup do Repo

- [ ] 0.1 Criar repo `ac-companion-agent` no GitHub (público)
- [ ] 0.2 Criar estrutura de pastas e `.sln` inicial
- [ ] 0.3 Criar `CompanionAgent.Core.csproj` (net10.0-windows)
- [ ] 0.4 Criar `CompanionAgent.App.csproj` (WPF, net10.0-windows)
- [ ] 0.5 Configurar `.gitignore` e `README.md` inicial
- [ ] 0.6 Criar workflow CI básico (`.github/workflows/build.yml`)

---

## Fase 1 — Core: Migração e LogService

- [ ] 1.1 Migrar `SupabaseClient.cs` do monorepo (sem alterações)
- [ ] 1.2 Migrar `SyncCache.cs` (sem alterações)
- [ ] 1.3 Migrar `RetryQueue.cs` (sem alterações)
- [ ] 1.4 Migrar `AutoStartManager.cs` (sem alterações)
- [ ] 1.5 Reescrever `SettingsStore.cs` — adicionar `language`, `mode`, `acPath`, `cmPath`
- [ ] 1.6 Migrar `SyncWorker.cs` — adicionar debounce 800ms no FileSystemWatcher
- [ ] 1.7 Criar `LogService.cs` — ring buffer 1.000 entradas + arquivo diário + `IObservable<LogEntry>`
- [ ] 1.8 Injetar LogService em SyncWorker e SupabaseClient (substituir logs soltos por chamadas estruturadas)
- [ ] 1.9 Criar `I18n.cs` — carrega JSON de recursos com base em `settings.language`
- [ ] 1.10 Criar `resources/strings/pt-BR.json` e `en.json` com todas as chaves

---

## Fase 2 — App WPF: Estrutura Base

- [ ] 2.1 Criar `App.xaml` e `App.xaml.cs` — inicialização, DI simples (sem framework)
- [ ] 2.2 Criar `ResourceDictionary` de tema dark (`Themes/Dark.xaml`) — cores, estilos de Button, TabItem, TextBox, Label
- [ ] 2.3 Criar `MainWindow.xaml` — janela com `TabControl` (4 abas), ícone na barra de título
- [ ] 2.4 Criar `TrayIconManager.cs` — ícone na bandeja, duplo clique abre MainWindow, menu de contexto (Abrir, Sync, Sair)
- [ ] 2.5 Criar `ViewModels/` usando `INotifyPropertyChanged` simples (sem MVVM framework)
  - `OverviewViewModel`
  - `LogViewModel`
  - `SettingsViewModel`
  - `AboutViewModel`

---

## Fase 3 — App WPF: Abas

- [ ] 3.1 **Aba Visão Geral** (`Views/OverviewTab.xaml`)
  - Status de conexão (verde/vermelho)
  - Modo atual (Fonte / Visualizador)
  - Último sync + contagem de sessões/laps
  - Próximo sync automático (countdown)
  - Botões: Sincronizar agora, Ressincronizar laps

- [ ] 3.2 **Aba Log** (`Views/LogTab.xaml`)
  - `ListBox` vinculada ao `IObservable<LogEntry>` do LogService
  - Filtro por nível (ComboBox)
  - Botão "Limpar" (limpa display, não o arquivo)
  - Botão "Abrir arquivo" (abre log diário no Notepad)
  - Auto-scroll para última entrada

- [ ] 3.3 **Aba Configurações** (`Views/SettingsTab.xaml`)
  - Campos de pasta AC e CM com botão "Detectar"
  - ComboBox modo (Fonte / Visualizador)
  - ComboBox idioma (pt-BR / English) + aviso "requer reinício"
  - Checkbox auto-iniciar com Windows
  - Slider/NumericUpDown intervalo poll (10s–120s)
  - Botão "Salvar"

- [ ] 3.4 **Aba Sobre** (`Views/AboutTab.xaml`)
  - Versão atual
  - Status de update (verificando / atual / disponível)
  - Banner de update disponível com botão "Instalar e reiniciar"
  - Link para repo / CHANGELOG

---

## Fase 4 — Integração e Ciclo de Vida

- [ ] 4.1 Conectar SyncWorker ao App — iniciar na abertura, parar no fechamento
- [ ] 4.2 Modo Fonte vs Visualizador — condicionar FileSystemWatcher e poll ao modo
- [ ] 4.3 Web Sync poll — loop periódico em SyncWorker que verifica `sync_requested_at`
- [ ] 4.4 Integrar Velopack — verificar updates na inicialização e a cada 4h, expor estado para AboutViewModel
- [ ] 4.5 Fechar para bandeja ao clicar X (não encerra o processo, apenas oculta a janela)
- [ ] 4.6 Encerrar processo apenas pelo menu da bandeja → "Sair"

---

## Fase 5 — Instalador Inno Setup

- [ ] 5.1 Criar `installer/setup.iss` com wizard básico
- [ ] 5.2 Tela de seleção de idioma (pt-BR / English)
- [ ] 5.3 Tela de detecção/seleção de pasta do AC
- [ ] 5.4 Tela de detecção/seleção de pasta do Content Manager
- [ ] 5.5 Tela de login (email + senha) com validação via Supabase Auth
- [ ] 5.6 Tela de seleção de modo (Fonte / Visualizador)
- [ ] 5.7 Tela de auto-start (checkbox)
- [ ] 5.8 Script Pascal no .iss para gravar `settings.json` antes de iniciar o app
- [ ] 5.9 Testar instalador em máquina limpa

---

## Fase 6 — Web: Botão Sync funcionando

*(no monorepo `assettocorsacompanionplataform`)*

- [ ] 6.1 Verificar se tabela `agent_status` tem coluna `sync_requested_at`
- [ ] 6.2 Criar Server Action `requestSync(userId)` — upsert `agent_status` com `sync_requested_at = now()`
- [ ] 6.3 Conectar botão "Sincronizar" na dashboard à Server Action
- [ ] 6.4 Mostrar feedback na UI: "Sync solicitado — o agent vai sincronizar em até 30s"

---

## Fase 7 — CI/CD e Release

- [ ] 7.1 Workflow `build.yml` — build + dotnet test em cada push/PR
- [ ] 7.2 Workflow `release.yml` — trigger na tag `v*`
  - Build Release/x64
  - Velopack pack
  - Inno Setup compile
  - Upload para GitHub Releases

---

## Fase 8 — Limpeza no Monorepo

- [ ] 8.1 Remover `apps/CompanionAgent/` do monorepo (após v3 estar funcionando)
- [ ] 8.2 Atualizar `CLAUDE.md` e `docs/architecture.md` com referência ao novo repo
- [ ] 8.3 Atualizar aba de agent na web para apontar para o novo instalador

---

## Ordem de prioridade para MVP testável

```
Fase 0 → Fase 1 → Fase 2 → Fase 3 → Fase 4 → Teste manual
→ Fase 5 (instalador) → Fase 6 (web sync) → Fase 7 (CI/CD) → Fase 8 (limpeza)
```

O MVP é: app WPF que abre, conecta, sincroniza sessões automaticamente, tem log visível.
O instalador vem depois para poder distribuir para amigos testarem.
