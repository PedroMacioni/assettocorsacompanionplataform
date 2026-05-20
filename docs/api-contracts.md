# Local Agent API Contracts

Base URL:

```text
http://127.0.0.1:47832
```

## Health

```http
GET /api/health
```

Returns agent status and local API metadata.

## Agent Status

```http
GET /api/agent/status
```

Returns enabled local features.

## Full History

```http
GET /api/history
```

Returns:

- profile summary
- latest session
- fastest lap from Content Manager sessions
- fastest personal best
- top cars by distance
- top tracks by session count
- all importable sessions
- all personal bests
- source paths used by the importer

## Profile Summary

```http
GET /api/profile/summary
```

Returns the compact profile overview used by dashboard stat cards.

## Sessions

```http
GET /api/sessions
```

Returns all Content Manager sessions normalized for web display.

## Personal Bests

```http
GET /api/personal-bests
```

Returns all `personalbest.ini` lap records.

## Planned Realtime Endpoints

```http
GET /api/telemetry/current
```

```text
WS /ws/telemetry
```

These will be added after the web dashboard can consume the history API.
