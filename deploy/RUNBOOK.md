# Run it somewhere a judge can open

On the demo machine:

```bash
docker compose up -d
npm install
npm run build -w @switchboard/web
npm run server
```

The server listens on `SERVER_PORT` (default 8787) and serves `apps/web/dist`. `/`, `/app`, and `/judge` all return the app.

A tunnel, when the domain exists:

```bash
cloudflared tunnel --url http://localhost:8787
```

Point the hostname at that tunnel. Buy the domain before the tunnel, so DNS has time to settle.

`npm run bench` before the build if the landing page should show numbers. The page fetches `/bench/results.json` from the built files, so run the benchmark, then `npm run build -w @switchboard/web`, then start the server.

This file does not start a public URL by itself. The owner runs the tunnel on the machine that should stay up.
