# Run it somewhere a judge can open

Two pieces, so the site survives a dead host.

- **The host Mac** (always on) runs FalkorDB in Docker, the Switchboard server on `127.0.0.1:8788` (graph `sb_public`, `SB_PUBLIC=1`), and a Cloudflare Tunnel that exposes the server as the API hostname.
- **Cloudflare Pages** serves the built web app. When the API or the tunnel is down, `/app` shows a recorded FalkorDB run (`apps/web/public/replay.json`), labelled as a recording, and switches back to live by itself.

Nothing here runs by itself. The owner runs every step. Steps marked **Owner** open a browser or ask for a Cloudflare login.

## Variables

The site and the API share one host, https://switchboard-agents.xyz (one tunnel, one server process). `$SITE` and `$API` are kept separate below in case they are ever split.

```bash
export SITE=https://switchboard-agents.xyz
export API=https://switchboard-agents.xyz
export API_HOST=${API#https://}
```

## The sequence

Run it from the repo root on the host Mac (`/Users/bhargavagumpula/Projects/graph-hacks`, on the branch you want judges to see).

**1. FalkorDB, bound to localhost.**

```bash
docker compose up -d
docker ps --format '{{.Names}}  {{.Ports}}'    # expect 127.0.0.1:6379 and 127.0.0.1:3000, nothing on 0.0.0.0
```

`docker-compose.yml` publishes both ports on `127.0.0.1` only. If the container already exists with the old ports, this recreates it. The data lives in the named volume `falkordb-data`, so graphs survive.

**2. Install the packages.**

```bash
npm ci
```

**3. Owner: the tunnel.** This opens a browser to log in to Cloudflare. Pick the zone that holds the domain.

```bash
cloudflared tunnel login
cloudflared tunnel create switchboard             # prints the tunnel id (a UUID)
cloudflared tunnel route dns switchboard "$API_HOST"
mkdir -p ~/.cloudflared
cp deploy/cloudflared.yml ~/.cloudflared/config.yml
UUID=<paste the id>; sed -i '' "s/<UUID>/$UUID/g" ~/.cloudflared/config.yml
```

If you changed the domain, also edit the `hostname:` line in `~/.cloudflared/config.yml`.

**4. Install the two launchd jobs.**

```bash
bash deploy/install.sh
```

It checks that the paths in the plists exist, copies them to `~/Library/LaunchAgents`, loads them with `launchctl bootstrap gui/$(id -u)`, and starts them with `kickstart -k`. Logs are in `~/Library/Logs/switchboard/`. `deploy/xyz.switchboard.server.plist` holds an absolute path to `node` (from `command -v node`) and to the repo. If either is different on this Mac, edit the plist before you run the script.

**5. Check health, locally and publicly.**

```bash
curl -fsS http://127.0.0.1:8788/api/health
curl -fsS "$API/api/health"
curl -fsS -X POST "$API/api/demo" | jq -r .sentence
```

Expect `"ok":true,"graph":"sb_public"` and the refusal sentence. The server seeds an empty graph itself. If `/api/health` shows `files` as 0, load it by hand: `SB_GRAPH=sb_public npm run parse -- demo-repo`.

**6. Record the fallback.**

```bash
npx tsx scripts/snapshot-replay.ts
```

This writes `apps/web/public/replay.json` from a temporary graph and deletes the graph. Run it again after any change to the demo scenario, then redo step 7.

**7. Owner: the site, on Cloudflare Pages.**

```bash
VITE_API_URL="$API" npm run build -w @switchboard/web
npx wrangler pages project create switchboard --production-branch main   # first time only
npx wrangler pages deploy apps/web/dist --project-name switchboard
```

Wrangler asks you to log in the first time. Then, in the Cloudflare dashboard, open Workers & Pages, then `switchboard`, then Custom domains, and add the hostname from `$SITE`. Check it:

```bash
curl -fsS -o /dev/null -w '%{http_code}\n' "$SITE/app"      # 200
```

Then open `$SITE/app?play=1` in a browser.

## Kill-test rehearsal

Do this once the whole chain is up, before judging. Keep `$SITE/app` open in a browser.

1. **Stop the server.** `launchctl bootout gui/$(id -u)/xyz.switchboard.server`. Within 10 seconds `/app` flips to the replay and says it is a recording.
2. **Start it again.** `launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/xyz.switchboard.server.plist`. The app returns to live without a reload.
3. **Stop the tunnel instead.** `launchctl bootout gui/$(id -u)/xyz.switchboard.tunnel`. Same result as step 1. Bring it back with `launchctl bootstrap` on `xyz.switchboard.tunnel.plist`.
4. **Two browsers at once.** Open `$SITE/app?play=1` in two browsers at the same time. Neither gets an error, and both show the refusal.
5. **A phone on cellular.** Turn Wi-Fi off, open `$SITE/app?play=1`. It plays.
6. **An idle tab.** Leave `$SITE/app` open for 5 minutes, then press Play. The page reacts without a reload.

If any step fails, look at `~/Library/Logs/switchboard/` and `launchctl print gui/$(id -u)/xyz.switchboard.server`.

## Host checklist

- On AC power, always.
- The Mac never sleeps and starts again after a power failure (System Settings, Energy).
- macOS automatic updates are off until judging ends.
- OrbStack is set to start at login. The FalkorDB container has `restart: unless-stopped`, so it comes back with OrbStack.
- The jobs are LaunchAgents, so they run only while the owner is logged in. After any reboot, log in and run step 5. For a planned reboot with FileVault on, run `sudo fdesetup authrestart`. After an unplanned power loss with FileVault on, the Mac waits at the unlock screen until someone types the password.
- In Cloudflare, Bot Fight Mode and Under Attack Mode are off. Either one can put a challenge in front of the page's API calls and the event stream, which the app cannot answer.
- The repo's GitHub Actions workflow `uptime` pings `$API/api/health` and `$SITE/app` every 15 minutes. Watch its badge in the README.

## Taking it down

```bash
launchctl bootout gui/$(id -u)/xyz.switchboard.server
launchctl bootout gui/$(id -u)/xyz.switchboard.tunnel
rm ~/Library/LaunchAgents/xyz.switchboard.server.plist ~/Library/LaunchAgents/xyz.switchboard.tunnel.plist
```
