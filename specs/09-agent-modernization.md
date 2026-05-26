# Spec: Modern Agent Migration

## Decisions

- Desktop stack: WinUI 3 with Windows App SDK.
- Platform: Windows only.
- Branding: keep `Apex` as the temporary product name.
- Account policy: one connected computer per account.
- Auth model: replace copied user tokens with a browser-based pairing flow.
- Sync direction: agent still pushes data to the cloud over outbound HTTPS.

WinUI 3 is the target because this is a native Windows background agent with tray behavior, auto-start, file watchers, and local OS integration. MAUI is available in the current dev environment, but it is heavier and less direct for a Windows-only tray agent. WPF is a fallback only if Windows App SDK packaging becomes a blocker.

## Target Project Layout

```text
apps/CompanionAgent/
  CompanionAgent.Api/             dev-only local API, keep for now
  CompanionAgent.Core/            sync engine, settings, auth, device model
  CompanionAgent.Desktop/         WinUI 3 app, window shell, onboarding UI
```

`CompanionAgent.Tray` remains as the current production agent until the WinUI app reaches feature parity. Do not delete it during the migration.

## Core Extraction

Move non-UI code out of `CompanionAgent.Tray`:

- `SyncWorker`
- `SupabaseClient` or replacement cloud client
- `SyncCache`
- `AgentSettings`
- `SettingsStore`
- `AutoStartManager`

The new `CompanionAgent.Core` should not reference WinForms or WinUI. It exposes state through events or observable models:

```csharp
public sealed record AgentConnectionState(
    bool IsConnected,
    string? UserId,
    string? DeviceId,
    string? DeviceName,
    DateTimeOffset? ConnectedAt);

public sealed record SyncSnapshot(
    SyncState State,
    string Message,
    DateTimeOffset? LastSyncedAt,
    int PendingSessions,
    int PendingLapSessions,
    int LastSyncSessionCount);
```

## Desktop UX

### Launch

The app opens with a short native loading state:

- Load local settings.
- Check device pairing.
- Locate Content Manager data folders.
- Read local sync cache.
- Contact web API if connected.

The loader should feel like the web app: dark surface, restrained orange accent, compact typography, no marketing hero.

### Primary Views

1. Overview
   - Connection status.
   - Last sync.
   - Pending sessions/laps.
   - Last error with actionable copy.
   - Sync now button.

2. Connection
   - If disconnected: "Connect this computer" button.
   - If connected: account, computer name, device id short code, connected date.
   - Disconnect button.

3. Data Sources
   - Sessions path.
   - `personalbest.ini` path.
   - AC install/content path detection.
   - Folder validation.

4. Activity
   - Recent sync events.
   - Per-resource status: sessions, laps, personal bests, tracks, cars, setups.
   - Clear log button.

### Visual Direction

Use the existing web palette:

```text
background: #0d0d0f
surface:    #161618
surface-2:  #1e1e20
border:     #2a2a2c
primary:    #e8612a
success:    #22c55e
danger:     #ef4444
muted:      #6b6b72
```

Avoid the current fixed WinForms control look. The desktop app should use native WinUI controls, compact cards, segmented sections, icon buttons, and status badges.

## Tray Behavior

WinUI 3 does not provide a built-in tray abstraction. Use Win32 `Shell_NotifyIcon` interop or a focused WinUI-compatible tray package. Do not keep Windows Forms just for the tray in the final app.

Tray states:

- Disconnected: neutral icon, "Apex Agent - not connected"
- Syncing: accent icon, "Apex Agent - syncing"
- Healthy: green icon, "Apex Agent - synced at HH:mm"
- Error: red icon, "Apex Agent - action required"

Tray menu:

```text
Apex Agent
Connected to this PC / Not connected
---
Open
Sync now
Connect / Disconnect
---
Start with Windows [checked]
Quit
```

## Browser Pairing Flow

The agent never asks for email/password and never asks the user to paste a token.

1. Agent generates:
   - local `device_secret`
   - `device_secret_hash`
   - `machine_fingerprint_hash`
   - `device_name`

2. Agent calls:

```http
POST /api/agent/pairing/start
```

Body:

```json
{
  "deviceName": "PEDRO-PC",
  "machineFingerprintHash": "sha256:...",
  "deviceSecretHash": "sha256:...",
  "appVersion": "1.0.0",
  "platform": "windows"
}
```

3. Web API creates a pending pairing request and returns:

```json
{
  "pairingId": "uuid",
  "connectUrl": "https://.../agent/connect?code=ABCD-EFGH",
  "expiresAt": "2026-05-26T21:20:00Z"
}
```

4. Agent opens the browser at `connectUrl`.

5. If the user is already logged in, the web shows a modal:

```text
Connect this computer?

Computer: PEDRO-PC
App: Apex Agent 1.0.0
Permission: sync Assetto Corsa history from this computer

[Cancel] [Connect]
```

6. On approval, the web creates/replaces `agent_devices` for the authenticated user.

7. Agent polls:

```http
GET /api/agent/pairing/{pairingId}
Authorization: Bearer {device_secret}
```

8. When approved, the agent stores:
   - `device_id`
   - `device_secret`, protected with Windows DPAPI
   - connected account display/email returned by the API

## One Computer Per Account

The database enforces one device with `agent_devices.user_id primary key`.

When a user approves a new computer:

- The existing device row for that user is replaced.
- The previous computer becomes disconnected on its next heartbeat or sync attempt.
- The web shows only one connected computer.

This is strict by design. Multi-device support can be introduced later by changing the primary key and product copy.

## Revocation

Either side can disconnect:

- Web: Settings -> Agent -> Disconnect this computer.
- Agent: Connection -> Disconnect.

Revocation sets:

```text
status = 'revoked'
revoked_at = now()
revoked_by = 'web' | 'agent'
```

On any sync/heartbeat, the API rejects revoked devices with `401` or `403`. The agent then clears local credentials and returns to disconnected state.

## Cloud API Direction

The current agent writes directly to Supabase PostgREST using a user JWT. The target model should move sync writes behind Next.js API routes using `SUPABASE_SERVICE_ROLE_KEY`, authenticated by the device secret.

Initial target endpoints:

```text
POST /api/agent/pairing/start
GET  /api/agent/pairing/{id}
POST /api/agent/pairing/{id}/cancel
POST /api/agent/sync/status
POST /api/agent/sync/sessions
POST /api/agent/sync/laps
POST /api/agent/sync/personal-bests
POST /api/agent/sync/tracks
POST /api/agent/sync/car-assets
POST /api/agent/disconnect
```

The web can keep querying Supabase directly for dashboard data. Agent writes go through server APIs so device revocation and one-computer policy are enforceable.

## Migration Phases

### Phase 1 - Stabilize Current Agent

- Keep the UUID/token fix already applied.
- Improve errors so `400` data problems do not become "offline".
- Add local payload validation before sending sync data.

### Phase 2 - Backend Device Model

- Add `agent_devices`.
- Add `agent_pairing_requests`.
- Add web API routes for pairing.
- Replace Settings token UI with connected computer UI.

### Phase 3 - Core Extraction

- Create `CompanionAgent.Core`.
- Move sync/auth/settings/cache code out of WinForms.
- Keep the current tray app as a thin host during transition.

### Phase 4 - WinUI 3 Desktop

- Add `CompanionAgent.Desktop`.
- Implement loader, overview, connection, data sources, activity views.
- Implement tray interop without WinForms.
- Reuse `CompanionAgent.Core`.

### Phase 5 - Cutover

- Publish WinUI agent as the main installer.
- Keep WinForms agent only as rollback for one release.
- Remove copied-token flow from docs and UI.

## Open Implementation Notes

- The current CLI does not have WinUI templates installed. Install Windows App SDK templates or create the project from Visual Studio.
- The repo already has `SUPABASE_SERVICE_ROLE_KEY` support through `apps/web/lib/supabase/admin.ts`.
- Device secrets must never be stored in plaintext. Use Windows DPAPI for local storage.
- The pairing code should expire in 10 minutes.
- The web API should rate-limit pairing start/poll endpoints.
