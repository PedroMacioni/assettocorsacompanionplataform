# Spec: CompanionAgent (EXE)

## Visão geral

O CompanionAgent é um processo Windows que roda em segundo plano como system tray. O usuário o instala uma vez, configura o token, e ele passa a sincronizar automaticamente toda vez que o Assetto Corsa é usado.

---

## Entry point: CompanionAgent.Tray

Novo projeto na solution: `apps/CompanionAgent/CompanionAgent.Tray/`

**Stack:** .NET 10, Windows Forms (para NotifyIcon) ou WPF. Não usar Avalonia — NotifyIcon nativo do Windows é suficiente e mais simples.

**Estrutura do projeto:**
```
CompanionAgent.Tray/
  Program.cs              ← entry point, cria ApplicationContext
  TrayApplicationContext.cs ← gerencia NotifyIcon, lifecycle
  SyncWorker.cs           ← BackgroundService de sync
  AgentSettings.cs        ← configurações (token, intervalo, etc.)
  SettingsStore.cs        ← lê/escreve settings.json em AppData
  AutoStartManager.cs     ← gerencia chave de registro para autostart
```

---

## System Tray

### Ícone

- Estado **não configurado** (sem token): ícone cinza, tooltip "Sim Racing Companion — Configure seu token"
- Estado **sincronizando**: ícone animado ou cor diferente, tooltip "Sincronizando..."
- Estado **sincronizado**: ícone verde, tooltip "Sincronizado às HH:mm"
- Estado **erro**: ícone vermelho, tooltip "Erro de sincronização — clique para detalhes"

### Menu de contexto (clique direito)

```
Sim Racing Companion v1.0.0
─────────────────────────────
✓ Sincronizado às 14:32
─────────────────────────────
  Sincronizar agora
  Abrir dashboard (abre browser)
─────────────────────────────
  Configurações...
  Iniciar com o Windows ✓
─────────────────────────────
  Sair
```

### Janela de configurações

Janela WinForms simples (não é web):
- Campo: **Token de API** (password field, com botão "Verificar")
- Campo: **Intervalo de sync** (default: 5 minutos)
- Status: última sincronização, sessões enviadas
- Botão: **Salvar**

---

## SyncWorker

Background service que roda permanentemente:

```csharp
public class SyncWorker : BackgroundService
{
    // 1. Na inicialização: sync completo (catch-up de sessões não sincronizadas)
    // 2. FileSystemWatcher em Sessions/ → sync imediato ao detectar novo arquivo
    // 3. Timer periódico (default 5min) como fallback
}
```

### Lógica de sync

```
função SyncAsync():
  1. Carregar source_ids já sincronizados do cache local (synced_ids.json em AppData)
  2. Listar todos os arquivos em CM Sessions/
  3. Filtrar apenas os não presentes no cache
  4. Para cada arquivo novo:
     a. Parsear via LocalHistoryService
     b. Montar SyncSessionRequest
  5. POST /rpc/sync_sessions (upsert em batch, máx 100 por request)
  6. Se sucesso: adicionar source_ids ao cache local
  7. Repetir para personal-bests (sem dedup incremental — sempre enviar lista completa)
  8. Atualizar ícone do tray com resultado
```

### Tratamento de erros

- **Sem internet**: enfileirar, tentar no próximo ciclo. Não mostrar erro para o usuário até N falhas consecutivas.
- **Token inválido (401)**: mudar ícone para vermelho, notificação Windows "Token expirado — acesse as configurações".
- **Arquivo corrompido do CM**: ignorar silenciosamente (já feito em `LocalHistoryService`).
- **Rate limit Supabase**: backoff exponencial (1s, 2s, 4s, máx 60s).

---

## Configurações (AgentSettings)

Arquivo: `%AppData%\SimRacingCompanion\settings.json`

```json
{
  "supabaseUrl": "https://xxx.supabase.co",
  "supabaseAnonKey": "...",
  "userToken": "eyJ...",
  "syncIntervalMinutes": 5,
  "autoStart": true,
  "lastSyncAt": "2025-05-19T14:32:00Z",
  "lastSyncSessionCount": 3
}
```

`userToken` é o JWT do Supabase após login do usuário. Obtido via:
1. Usuário faz login no web → vai em Configurações → copia o token de agente
2. Cola na janela de configurações do agent → clica Verificar → Salvar

Alternativa futura: device flow OAuth (o agent abre o browser para login).

---

## Cache de sessões sincronizadas

Arquivo: `%AppData%\SimRacingCompanion\synced_ids.json`

```json
{
  "sessions": ["20250101_123456", "20250102_091234", "..."],
  "personalBestsSyncedAt": "2025-05-19T14:32:00Z"
}
```

Simples array de strings. Não precisa ser DB. Personal bests são sempre enviados como lista completa (upsert), então só armazena o timestamp do último sync.

---

## Auto-start

```csharp
public class AutoStartManager
{
    private const string RegistryKey = @"SOFTWARE\Microsoft\Windows\CurrentVersion\Run";
    private const string AppName = "SimRacingCompanion";

    public void Enable()  // HKCU\...\Run → caminho do exe
    public void Disable() // remove entrada
    public bool IsEnabled()
}
```

Usa `HKCU` (não `HKLM`) → não requer elevação de privilégios.

---

## Instalador

**Ferramenta:** WiX Toolset v4 ou NSIS.

**O que o instalador faz:**
1. Copia o EXE para `%LocalAppData%\SimRacingCompanion\`
2. Cria atalho no menu Iniciar
3. Pergunta se deve adicionar ao autostart (padrão: sim)
4. Inicia o agente ao final da instalação
5. Desinstalação limpa todos os arquivos (exceto `settings.json` — perguntar)

**Single-file EXE:** publicar com `PublishSingleFile=true`, `SelfContained=true` para não precisar de .NET instalado na máquina do usuário.

---

## Projeto existente: CompanionAgent.Api

Manter em funcionamento para desenvolvimento local. O `CompanionAgent.Tray` pode opcionalmente subir a API local em background (na porta 47832) para que um frontend de desenvolvimento consuma sem precisar acessar o cloud.

Em produção, a API local pode ser removida ou mantida como feature de "modo dev".

---

## Checklist de implementação

- [ ] Criar projeto `CompanionAgent.Tray` na solution
- [ ] Implementar `TrayApplicationContext` com NotifyIcon
- [ ] Implementar `SettingsStore` (lê/escreve JSON em AppData)
- [ ] Implementar `AutoStartManager` (registry)
- [ ] Implementar `FileSystemWatcher` para a pasta Sessions/
- [ ] Implementar `SyncWorker` com timer + watcher
- [ ] Integrar `LocalHistoryService` existente
- [ ] Adicionar client Supabase (via `supabase-csharp` ou HTTP direto)
- [ ] Implementar janela de configurações
- [ ] Configurar publish como single-file self-contained
- [ ] Criar instalador
