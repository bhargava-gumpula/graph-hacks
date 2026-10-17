# One shared graph in FalkorDB Cloud

By default Switchboard keeps its graph in a FalkorDB container on your laptop. Point every machine at one
FalkorDB Cloud instance instead and they share a single live graph: Claude Code on one laptop and Cursor on
another see each other's claims, edits, decisions and conflicts within a second.

The graph is live on every save, not on push. Each machine's server re-parses a file the moment an agent
edits it (the editor hook calls `POST /api/edits`), and with `SB_WATCH=1` it also re-parses files a person
saves. Only that file's imports change in the graph, in a few milliseconds.

## 1. Create the instance (owner, once)

1. Sign in at https://app.falkordb.cloud and create a free instance. Pick the region closest to you.
2. Open the instance and copy its connection details: host, port, username and password.
3. Build the URL. Use `rediss://` (with two s, for TLS) if the console says TLS is on or gives you a
   `rediss://` URL; otherwise `redis://`.

   ```
   rediss://USERNAME:PASSWORD@HOST:PORT
   ```

   If the password has characters like `@`, `/` or `:`, either percent-encode them in the URL or leave the
   credentials out of the URL and set `FALKORDB_USERNAME` and `FALKORDB_PASSWORD` instead. Values in the URL
   win over the two variables.

## 2. Put the URL in `.env` (every machine)

In the Switchboard checkout, add these to `.env` (it is git-ignored; never commit it):

```
FALKORDB_URL=rediss://USERNAME:PASSWORD@HOST:PORT
SB_GRAPH=sb_team
```

Every machine uses the same `FALKORDB_URL` and the same `SB_GRAPH`. That pair is what makes it one graph.
Pick any name that starts with `sb_`.

Do not use `npm run quickstart` with a cloud URL: it expects a local FalkorDB and prints the URL it checks.
The other commands read only the real environment, so load `.env` into the shell first:

```
set -a; . ./.env; set +a
```

Claude Code and Cursor pass their environment to the MCP server and to the hook's CLI fallback, so start
them from that same shell (`claude`, or `cursor .`). Cursor opened from the Dock does not read your shell.

## 3. Load the repo once

From any one machine, with the variables loaded:

```
npm run switchboard -- parse /path/to/your/repo
```

## 4. Run the server on each machine

Each machine runs its own small server next to its editors. The hooks talk to it; it talks to the cloud graph.

```
set -a; . ./.env; set +a
SB_REPO=/path/to/your/repo SB_WATCH=1 npm run server
```

- `SB_REPO` is the repo on this machine's disk. The server re-parses edited files from there.
- `SB_WATCH=1` also catches saves made by people, not just agents. Leave it off if you only want agent edits.
- With `SB_REPO` set, the server never replays the demo story, which would reset the graph.
- Without a server, `npm run switchboard -- watch /path/to/your/repo` does the same for saves and prints
  one line per change.

Check where the graph lives:

```
curl -s localhost:8787/api/health
```

`"db": {"where": "cloud", ...}` means the cloud instance. The password never appears in health, logs or errors.

For a repo wired with `switchboard init`, use the graph and port that `init` printed, in place of `sb_team`
and 8787. Keep the repo folder name the same on every machine, since `init` names the graph after it.

## 5. Coordinate across laptops

Laptop 1 runs Claude Code, laptop 2 runs Cursor, both in the same repo on the same branch.

1. Claude claims `auth/session.ts` (its edit hook does this before the first edit).
2. Cursor tries to edit `ui/LoginForm.tsx`, which imports `auth/session.ts` within three hops.
3. Cursor's hook asks its own server, which checks the shared graph, finds Claude's claim and the import
   path, and refuses the edit with that path. Claude is not interrupted.
4. When Claude finishes (session end releases its claims) or the claim expires, Cursor's next try goes through.

Both dashboards (`http://localhost:8787/app` on each laptop) read the same graph, so both show the claim,
the refusal and every import change as they happen.

## Notes

- Each machine re-parses its own working tree. If the two laptops are on different branches, each save
  rewrites that file's imports to match the saving machine. Work on one branch, or give each branch its own
  `SB_GRAPH`.
- Every query now crosses the network. Expect tens of milliseconds per check instead of one; the hook's
  budget is one second, so edits are not slowed down in practice.
- A file created after the file that imports it is linked on the importer's next save, or by running
  `parse` again.
- To go back to the local graph, remove `FALKORDB_URL` (or set it to `redis://localhost:6379`).
