# Sim Racing Companion Architecture

## Goal

Build a local companion agent that runs on the driver's PC and powers a modern web platform for profile, history, analytics, and live telemetry.

## Target Flow

```text
Assetto Corsa
  -> CompanionAgent.exe
      -> shared memory telemetry
      -> Content Manager history import
      -> local API on 127.0.0.1
      -> local SQLite cache later
      -> cloud sync later
  -> Web Platform
```

## Projects

```text
apps/
  CompanionAgent/
    CompanionAgent.Api/          Local ASP.NET Core API, future executable host

packages/
  Companion.Domain/              Core product models
  Companion.Infrastructure/      File readers, Content Manager import, future SQLite
  Companion.SharedContracts/     API DTOs shared by local API and web

CollectorCore/                   Telemetry/history validation prototype
```

`CollectorCore` proved that Assetto Corsa shared memory and Content Manager history are available. New product work should move into `apps/` and `packages/`.

## Local Agent

Initial API base URL:

```text
http://127.0.0.1:47832
```

The agent must bind to `127.0.0.1`, not `0.0.0.0`, during the local MVP.

Current responsibilities:

- expose health/status endpoints
- import Content Manager sessions
- import Assetto Corsa `personalbest.ini`
- return profile and history data as JSON

Near-term responsibilities:

- current telemetry snapshot
- WebSocket live telemetry stream
- session start/end detection
- SQLite local storage
- React/Next dashboard integration

## Web Integration

The web app should consume the local agent directly during MVP:

```ts
fetch("http://127.0.0.1:47832/api/history")
```

Allowed local development origins:

```text
http://localhost:3000
http://127.0.0.1:3000
http://localhost:5173
http://127.0.0.1:5173
```

## Future Cloud Flow

```text
CompanionAgent.exe
  -> uploads completed sessions
  -> backend stores profile/session data
  -> web/mobile consumes backend
  -> realtime relay via WebSocket/SignalR
```
