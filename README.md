# Sim Racing Companion Platform

Modern companion platform for Assetto Corsa drivers, starting with telemetry validation through a local collector.

## Product Foundation

The project now has a clean local-agent foundation:

```text
apps/
  CompanionAgent/
    CompanionAgent.Api/

packages/
  Companion.Domain/
  Companion.Infrastructure/
  Companion.SharedContracts/

docs/
  architecture.md
  api-contracts.md
```

Run the local API:

```powershell
dotnet run --project apps\CompanionAgent\CompanionAgent.Api
```

Debug builds generate:

```text
apps\CompanionAgent\CompanionAgent.Api\bin\Debug\net10.0\CompanionAgent.exe
```

Then test:

```text
http://127.0.0.1:47832/api/health
http://127.0.0.1:47832/api/history
http://127.0.0.1:47832/api/profile/summary
```

## MVP 1: Telemetry Validation

Current workspace milestone:

```text
Assetto Corsa
  -> Local Collector
  -> Realtime telemetry console output
```

The first collector lives in `CollectorCore` and reads Assetto Corsa shared memory for:

- car model
- track
- speed
- RPM
- gear
- fuel
- tyre temperatures
- completed laps
- position
- best lap
- last lap

## Run

Start Assetto Corsa, enter a track, then run:

```powershell
dotnet run --project CollectorCore
```

The collector waits for Assetto Corsa shared memory and then refreshes the console every 100 ms.

## History Preview

To print a simple local history report from Content Manager and Assetto Corsa files:

```powershell
dotnet run --project CollectorCore -- history
```

This reads:

- `%LOCALAPPDATA%\AcTools Content Manager\Progress\Sessions`
- `%USERPROFILE%\Documents\Assetto Corsa\personalbest.ini`

## Dependency Note

The originally suggested `AssettoCorsa.SharedMemory` package was not available on NuGet. This project uses `Thomsen.AccTools.SharedMemory` `1.1.0`, which exposes AC/ACC shared memory events and targets .NET Standard 2.0.
