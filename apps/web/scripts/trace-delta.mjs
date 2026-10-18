// Traces the real import graph onto the river channels of public/photos/delta.jpg.
// Usage: sips -z 270 480 public/photos/delta-2400.jpg -s format bmp --out /tmp/d.bmp && node scripts/trace-delta.mjs /tmp/d.bmp
// Writes src/delta/traced.json in photo pixels (2400 x 1350).
import { readFileSync, writeFileSync } from "node:fs";
const here = new URL("..", import.meta.url).pathname;
const graph = JSON.parse(readFileSync(here + "src/data/graph.json", "utf8"));
const buf = readFileSync(process.argv[2]);
const W = buf.readInt32LE(18), H = Math.abs(buf.readInt32LE(22)), off = buf.readUInt32LE(10), K = 2400 / W;
const row = Math.ceil((W * 3) / 4) * 4;
const roadY = (x) => { const p = [[0, .42], [.25, .17], [.5, .15], [.75, .07], [1, .02]]; for (let i = 1; i < p.length; i++) if (x <= p[i][0]) { const [a, b] = [p[i - 1], p[i]]; return a[1] + (b[1] - a[1]) * (x - a[0]) / (b[0] - a[0]); } return 0; };
const water = new Uint8Array(W * H), lum = new Float32Array(W * H);
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
  const o = off + y * row + x * 3, b = buf[o], g = buf[o + 1], r = buf[o + 2];
  const L = (r + g + b) / 3, S = Math.max(r, g, b) - Math.min(r, g, b), gr = g - Math.max(r, b);
  lum[y * W + x] = L;
  // Silt and water read grey or blue-grey, in sun or in shadow; land reads green.
  if (y / H > roadY(x / W) + 0.06 && ((L > 150 && S < 40) || (L > 60 && gr < 8 && S < 30))) water[y * W + x] = 1;
}
// Distance from land (chamfer), so routes keep to the middle of a channel.
const depth = new Float32Array(W * H).map((_, i) => (water[i] ? 1e9 : 0));
for (let pass = 0; pass < 2; pass++) for (let k = 0; k < W * H; k++) {
  const i = pass ? W * H - 1 - k : k, x = i % W, y = (i / W) | 0, s = pass ? 1 : -1;
  for (const [dx, dy, c] of [[s, 0, 1], [0, s, 1], [s, s, 1.4], [-s, s, 1.4]]) {
    const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
    depth[i] = Math.min(depth[i], depth[ny * W + nx] + c);
  }
}
// Graph levels: longest path to a sink. Sinks sit downstream (lower left), deep importers upstream (upper right).
const ids = graph.nodes.map((n) => n.id), out = new Map(ids.map((i) => [i, []])), inn = new Map(ids.map((i) => [i, []]));
for (const e of graph.edges) (out.get(e.source).push(e.target), inn.get(e.target).push(e.source));
const lv = new Map(); const L = (id) => lv.has(id) ? lv.get(id) : (lv.set(id, out.get(id).length ? 1 + Math.max(...out.get(id).map(L)) : 0), lv.get(id));
ids.forEach(L); const maxL = Math.max(...lv.values());
// The graph keeps to the right two thirds of the delta, clear of the hero copy.
const A = [W * 0.95, H * 0.3], B = [W * 0.37, H * 0.9];
const d = [B[0] - A[0], B[1] - A[1]], len = Math.hypot(...d), u = [d[0] / len, d[1] / len], nrm = [-u[1], u[0]];
const rows = Array.from({ length: maxL + 1 }, () => []); ids.forEach((id) => rows[lv.get(id)].push(id));
// Barycenter order inside each row so linked files sit near each other.
const pos = new Map(); rows.forEach((r) => r.forEach((id, i) => pos.set(id, (i + .5) / r.length)));
for (let s = 0; s < 8; s++) for (const r of s % 2 ? rows : [...rows].reverse()) {
  const bc = (id) => { const nb = [...out.get(id), ...inn.get(id)]; return nb.length ? nb.reduce((a, b) => a + pos.get(b), 0) / nb.length : pos.get(id); };
  r.sort((a, b) => bc(a) - bc(b)); r.forEach((id, i) => pos.set(id, (i + .5) / r.length));
}
const placed = new Map(), MIN = 15;
// The story's route is pinned to the main braid (photo px), so the refusal reads along one channel.
const PIN = { "ui/LoginForm.tsx": [1730, 700], "api/login.ts": [1450, 830], "auth/session.ts": [1140, 990] };
const order = [...Object.keys(PIN), ...[...ids].filter((i) => !PIN[i]).sort((a, b) => lv.get(b) - lv.get(a))];
for (const id of order) {
  const l = lv.get(id), r = rows[l], i = r.indexOf(id);
  // Spread each row along the river too, so a big row does not stack on one cross-section.
  const s = 0.04 + 0.9 * ((maxL - l) + (i % 3) * 0.33) / (maxL + 0.7);
  const t = ((i + .5) / r.length - .5) * 60;
  const tx = PIN[id] ? PIN[id][0] / K : A[0] + u[0] * s * len + nrm[0] * t, ty = PIN[id] ? PIN[id][1] / K : A[1] + u[1] * s * len + nrm[1] * t;
  let best = null, bd = 1e9;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (!water[y * W + x]) continue;
    let ok = true; for (const p of placed.values()) if (Math.hypot(p[0] - x, p[1] - y) < MIN) { ok = false; break; }
    if (!ok) continue; const dd = Math.hypot(x - tx, y - ty); if (dd < bd) (bd = dd, best = [x, y]);
  }
  placed.set(id, best);
}
// Route each import along the water: Dijkstra, cheap on water, expensive across land.
function route(a, b) {
  const dist = new Float64Array(W * H).fill(Infinity), prev = new Int32Array(W * H).fill(-1), heap = [];
  const push = (c, k) => { heap.push([k, c]); let i = heap.length - 1; while (i) { const p = (i - 1) >> 1; if (heap[p][0] <= heap[i][0]) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p; } };
  const pop = () => { const t = heap[0], l = heap.pop(); if (heap.length) { heap[0] = l; let i = 0; for (;;) { const a2 = 2 * i + 1, b2 = a2 + 1; let m = i; if (a2 < heap.length && heap[a2][0] < heap[m][0]) m = a2; if (b2 < heap.length && heap[b2][0] < heap[m][0]) m = b2; if (m === i) break; [heap[m], heap[i]] = [heap[i], heap[m]]; i = m; } } return t; };
  const s = a[1] * W + a[0], g = b[1] * W + b[0]; dist[s] = 0; push(s, 0);
  while (heap.length) { const [k, c] = pop(); if (c === g) break; if (k > dist[c]) continue; const cx = c % W, cy = (c / W) | 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { if (!dx && !dy) continue; const nx = cx + dx, ny = cy + dy; if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
      const n = ny * W + nx, w = Math.hypot(dx, dy) * (water[n] ? 1 + 2 / (1 + depth[n]) + 7 * ((255 - lum[n]) / 255) ** 2 : 90), nk = k + w; if (nk < dist[n]) (dist[n] = nk, prev[n] = c, push(n, nk)); } }
  const pts = []; for (let c = g; c !== -1; c = prev[c]) pts.push([c % W, (c / W) | 0]); pts.reverse();
  let p = pts.filter((_, i) => i % 5 === 0 || i === pts.length - 1);
  for (let it = 0; it < 3; it++) { const q = [p[0]]; for (let i = 0; i < p.length - 1; i++) { const [x0, y0] = p[i], [x1, y1] = p[i + 1]; q.push([x0 * .75 + x1 * .25, y0 * .75 + y1 * .25], [x0 * .25 + x1 * .75, y0 * .25 + y1 * .75]); } q.push(p[p.length - 1]); p = q; }
  return p.map(([x, y]) => [Math.round(x * K), Math.round(y * K)]);
}
const nodes = graph.nodes.map((n) => ({ id: n.id, label: n.label, hub: !!n.hub, level: lv.get(n.id), x: Math.round(placed.get(n.id)[0] * K + K / 2), y: Math.round(placed.get(n.id)[1] * K + K / 2) }));
const edges = graph.edges.map((e) => ({ s: e.source, t: e.target, pts: route(placed.get(e.source), placed.get(e.target)) }));
writeFileSync(here + "src/delta/traced.json", JSON.stringify({ w: 2400, h: 1350, nodes, edges }));
console.log("levels", maxL, "rows", rows.map((r) => r.length).join(","), "water", water.reduce((a, b) => a + b, 0));
for (const id of ["ui/LoginForm.tsx", "api/login.ts", "auth/session.ts"]) console.log(id, nodes.find((n) => n.id === id));
