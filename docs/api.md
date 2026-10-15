# HTTP contract (B7)

Base URL: `http://localhost:8787`. All JSON. FalkorDB is the store; these routes only read it (except the server holds no extra state).

## `GET /api/graph`

Snapshot of the code graph plus active claims.

```json
{
  "nodes": [
    { "id": "ui/LoginForm.tsx", "label": "LoginForm.tsx", "kind": "file", "hub": false, "claimedBy": [] },
    { "id": "agent:A", "label": "A", "kind": "agent", "status": "active" }
  ],
  "edges": [
    { "source": "ui/LoginForm.tsx", "target": "api/login.ts", "kind": "IMPORTS" },
    { "source": "agent:A", "target": "lib/crypto.ts", "kind": "CLAIMS" }
  ]
}
```

Agent node ids are `agent:<id>` so they never collide with file paths.

## `GET /api/claims`

Active claims (`until > now`): `[{ "agent", "path", "until", "taskId", "intent" }]`.

## `GET /api/events?last=<seq>`

SSE. Server polls FalkorDB `feedSince(last)` every 500 ms and writes `event: event` / `data: <FeedItem JSON>` for each new row. `FeedItem` is `{ seq, kind, at, payload, agentId, onLabel, onKey }`. A `conflict` payload is `{ requested: string[], conflicts: [{ file, type, claimed, path, hops, agent, taskId, intent }] }`. The UI lights `conflicts[0].path` in red.

## `GET /api/health`

`{ "ok": true, "graph": "sb_demo" }`.
