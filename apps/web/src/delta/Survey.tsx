import { useEffect, useRef } from "react";
import {
  along,
  byId,
  CLAIMED,
  conflictPath,
  edgeOf,
  edges,
  nodes,
  onRoute,
  pathD,
  PH,
  PW,
  ROUTE,
  type Pt,
} from "./graph";

type Cam = { x: number; y: number; z: number; ax: number; ay: number };
type Box = { x: number; y: number; w: number; h: number };

const legA = edgeOf(ROUTE[0]!, ROUTE[1]!);
const legB = edgeOf(ROUTE[1]!, ROUTE[2]!);
const exit = edges.find((e) => e.s === CLAIMED)!;
const HOLD = 0.62;
const LOOP = 16;
const sess = byId.get(CLAIMED)!;
const hold = along(legB.pts, HOLD);
// Files with an import path to session.ts within 3 hops: their edges light orange in the lens.
const near = new Set(nodes.filter((n) => conflictPath(n.id)).map((n) => n.id));
/** A polyline moved sideways by d photo pixels, so edges that share a braid fan apart in the lens. */
const shift = (pts: Pt[], d: number): Pt[] =>
  pts.map((p, i) => {
    const a = pts[Math.max(i - 1, 0)]!;
    const b = pts[Math.min(i + 1, pts.length - 1)]!;
    const l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    return [p[0] - ((b[1] - a[1]) / l) * d, p[1] + ((b[0] - a[0]) / l) * d];
  });
const lensEdges = edges.map((e, i) => {
  const pts = shift(e.pts, ((i % 3) - 1) * 6);
  return {
    e,
    pts,
    hot: near.has(e.s) && near.has(e.t),
    head: along(pts, 0.84),
  };
});
const HULL =
  "M24,0 C17,-9 -10,-10 -20,-8 L-20,8 C-10,10 17,9 24,0Z M2,-4 L-12,-4 L-12,4 L2,4Z";
const legMid = along(legA.pts, 0.5);
const deg = (r: number) => (r * 180) / Math.PI;
// One import, as a scale bar: the median edge length in photo pixels.
const HOP = [
  ...edges.map((e) =>
    Math.hypot(
      e.pts.at(-1)![0] - e.pts[0]![0],
      e.pts.at(-1)![1] - e.pts[0]![1],
    ),
  ),
].sort((a, b) => a - b)[edges.length >> 1]!;

const readCam = (el: Element, small: boolean): Cam => {
  const [x, y, z, ax, ay] = (
    (small && el.getAttribute("data-cam-sm")) ||
    el.getAttribute("data-cam")!
  )
    .split(/\s+/)
    .map(Number);
  return { x: x!, y: y!, z: z!, ax: ax!, ay: ay! };
};
const clamp = (v: number, a: number, b: number) => Math.min(Math.max(v, a), b);
const smooth = (a: number, b: number, t: number) => {
  const k = clamp((t - a) / (b - a), 0, 1);
  return k * k * (3 - 2 * k);
};
const hit = (a: Box, b: Box) =>
  a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

/** Where the two agents are at time s of the 16 s story loop. */
function story(s: number) {
  let b: [number, number, number];
  let a: [number, number, number] = [sess.x, sess.y, -2.4];
  let aOn = 1;
  let phase: "edit" | "held" | "free" = "edit";
  if (s < 1) b = along(legA.pts, 0);
  else if (s < 5) b = along(legA.pts, smooth(1, 5, s));
  else if (s < 7)
    b = along(legB.pts, HOLD * Math.sin(((s - 5) / 2) * (Math.PI / 2)));
  else if (s < 11) ((b = hold), (phase = "held"));
  else {
    phase = "free";
    a = along(exit.pts, smooth(11, 15, s) * 0.9);
    aOn = 1 - smooth(14, 15.6, s);
    b =
      s < 13 ? hold : along(legB.pts, HOLD + (1 - HOLD) * smooth(13, 15.4, s));
  }
  return { a, b, aOn, phase };
}
// Story steps on the page play one part of the loop each.
const STEP_WINDOWS: [number, number][] = [
  [0.2, 0.2],
  [0.2, 5.6],
  [7, 11],
  [11, 16],
];

const probeD = (path: string[]) => {
  const pts: Pt[] = [];
  for (let i = 0; i < path.length - 1; i++) {
    const f = edges.find((e) => e.s === path[i] && e.t === path[i + 1]);
    const r = edges.find((e) => e.t === path[i] && e.s === path[i + 1]);
    pts.push(...(f ? f.pts : [...r!.pts].reverse()));
  }
  return pts.length ? pathD(pts) : "";
};

const TAG_SPOTS: [number, number, "start" | "end"][] = [
  [-22, 40, "end"],
  [22, 40, "start"],
  [22, -26, "start"],
  [-22, -26, "end"],
];
const CANDS: [number, number, "start" | "end" | "middle"][] = [
  [10, 5, "start"],
  [-10, 5, "end"],
  [0, -12, "middle"],
  [0, 22, "middle"],
  [9, -10, "start"],
  [-9, -10, "end"],
  [9, 18, "start"],
  [-9, 18, "end"],
];

export function Survey() {
  const stage = useRef<HTMLDivElement>(null);
  const img = useRef<HTMLImageElement>(null);
  const photoWrap = useRef<HTMLDivElement>(null);
  const svg = useRef<SVGSVGElement>(null);
  const tip = useRef<HTMLDivElement>(null);
  const plate = useRef<HTMLSpanElement>(null);
  const scale = useRef<HTMLSpanElement>(null);
  const scaleL = useRef<HTMLSpanElement>(null);
  const leads = useRef<SVGSVGElement>(null);

  useEffect(() => {
    const st = stage.current!;
    const sv = svg.current!;
    const pw = photoWrap.current!;
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const q = <T extends Element>(s: string) => sv.querySelector(s) as T;
    const lensC = q<SVGCircleElement>("#sv-lens-c");
    const lensImg = q<SVGImageElement>("#sv-lens-img");
    const probe = q<SVGPathElement>(".sv-probe");
    const boatA = q<SVGGElement>(".sv-boat-a");
    const boatB = q<SVGGElement>(".sv-boat-b");
    const gate = q<SVGGElement>(".sv-gate");
    const bTag = q<SVGTextElement>(".sv-b-tag");
    const gateChip = q<SVGGElement>(".sv-gate-chip");
    const labels = [...sv.querySelectorAll<SVGTextElement>(".sv-lab")];
    const chips = [...sv.querySelectorAll<SVGGElement>(".sv-chip")];
    const tipEl = tip.current!;

    const setImg = () =>
      img.current?.currentSrc &&
      lensImg.setAttribute("href", img.current.currentSrc);
    if (img.current?.complete) setImg();
    img.current?.addEventListener("load", setImg);

    let cur: Cam | null = null;
    let lastS = 0;
    let tx = 0;
    let ty = 0;
    let s = 1;
    let ptr: { x: number; y: number; t: number } | null = null;
    let lensA = 0;
    let raf = 0;
    let lastPlaced = -1;
    let tick = 0;
    const t0 = performance.now();

    // Label collision pass in screen pixels: route chips first, then hubs, then the rest. A label that fits nowhere is hidden.
    // Copy panels on screen count as obstacles too, so a label never tucks under one.
    const place = () => {
      const boxes: Box[] = nodes.map((n) => ({
        x: n.x * s - 6,
        y: n.y * s - 6,
        w: 12,
        h: 12,
      }));
      const vw = innerWidth;
      boxes.push(
        { x: -tx - 1e4 + 24, y: -1e5, w: 1e4, h: 2e5 },
        { x: vw - tx - 24, y: -1e5, w: 1e4, h: 2e5 },
      );
      for (const el of document.querySelectorAll(
        "[data-obstacle], .dl-nav nav, .sv-plate",
      )) {
        const r = el.getBoundingClientRect();
        if (r.bottom > 0 && r.top < innerHeight)
          boxes.push({
            x: r.x - tx - 8,
            y: r.y - ty - 8,
            w: r.width + 16,
            h: r.height + 16,
          });
      }
      for (const c of chips) {
        const n = byId.get(c.dataset.id!)!;
        const w = Number(c.dataset.w);
        const opts: [number, number][] = [
          [16, -13],
          [-16 - w, -13],
          [-w / 2, -40],
          [-w / 2, 16],
          [-12, -42],
          [-12, 18],
          [12 - w, -42],
          [12 - w, 18],
          [16, 6],
          [-16 - w, 6],
        ];
        const free = (from: number) =>
          opts.find(
            ([dx, dy]) =>
              !boxes
                .slice(from)
                .some((b) =>
                  hit(b, { x: n.x * s + dx, y: n.y * s + dy, w, h: 26 }),
                ),
          );
        // Clear of every dot if it can be; otherwise only clear of copy, the frame edge and the other chips.
        const pick = free(0) ?? free(nodes.length);
        // A chip with nowhere clear to sit (under copy, off the frame) hides rather than clips.
        c.style.display = pick ? "" : "none";
        if (!pick) continue;
        boxes.push({ x: n.x * s + pick[0], y: n.y * s + pick[1], w, h: 26 });
        c.setAttribute("transform", `translate(${pick[0]} ${pick[1]})`);
      }
      const order = [...labels].sort(
        (a, b) => Number(b.dataset.p) - Number(a.dataset.p),
      );
      for (const l of order) {
        const n = byId.get(l.dataset.id!)!;
        const w = l.textContent!.length * 7.6 + 6;
        let done = false;
        for (const [dx, dy, anchor] of CANDS) {
          const bx =
            anchor === "start" ? dx : anchor === "end" ? dx - w : dx - w / 2;
          const box = {
            x: n.x * s + bx - 2,
            y: n.y * s + dy - 12,
            w: w + 4,
            h: 16,
          };
          if (boxes.some((b) => hit(b, box))) continue;
          boxes.push(box);
          l.setAttribute("x", String(dx));
          l.setAttribute("y", String(dy));
          l.setAttribute("text-anchor", anchor);
          l.style.display = "";
          done = true;
          break;
        }
        if (!done) l.style.display = "none";
      }
      lastPlaced = s;
    };

    const onMove = (e: PointerEvent) => {
      const el = document.elementFromPoint(e.clientX, e.clientY);
      const blocked = !!el?.closest("[data-obstacle], a, button, header");
      if (blocked && e.pointerType === "touch") return;
      ptr = blocked
        ? null
        : { x: e.clientX, y: e.clientY, t: performance.now() };
    };
    const onLeave = (e: PointerEvent) =>
      e.pointerType !== "touch" && (ptr = null);
    addEventListener("pointermove", onMove, { passive: true });
    addEventListener("pointerdown", onMove, { passive: true });
    document.addEventListener("pointerleave", onLeave);

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const vw = innerWidth;
      const vh = innerHeight;
      const small = vw < 760;
      const s0 = Math.max(vw / PW, vh / PH);
      const line = vh * 0.55;

      // Camera: hold on each chapter's view, travel to the next one once the reader scrolls, so every chapter's view holds at rest.
      const chs = [...document.querySelectorAll("[data-cam]")];
      const tops = chs.map((c) => c.getBoundingClientRect().top);
      let i = 0;
      while (i < chs.length - 1 && tops[i + 1]! <= line) i++;
      const a = readCam(chs[i]!, small);
      const b = chs[i + 1] ? readCam(chs[i + 1]!, small) : a;
      const k = reduce
        ? 0
        : smooth(
            0,
            1,
            1 - clamp((tops[i + 1] ?? 1e9) - line, 0, vh * 0.42) / (vh * 0.42),
          );
      const target: Cam = reduce
        ? readCam(chs[0]!, small)
        : {
            x: a.x + (b.x - a.x) * k,
            y: a.y + (b.y - a.y) * k,
            z: Math.exp(Math.log(a.z) + (Math.log(b.z) - Math.log(a.z)) * k),
            ax: a.ax + (b.ax - a.ax) * k,
            ay: a.ay + (b.ay - a.ay) * k,
          };
      if (!cur || reduce) cur = { ...target };
      else
        for (const key of ["x", "y", "z", "ax", "ay"] as const)
          cur[key] += (target[key] - cur[key]) * 0.14;

      const time = (now - t0) / 1000;
      const drift = reduce
        ? 1
        : 1 + 0.018 * (0.5 - 0.5 * Math.cos((time / 26) * Math.PI * 2));
      s = s0 * cur.z * drift;
      tx = clamp(cur.ax * vw - cur.x * s, vw - PW * s, 0);
      ty =
        PH * s < vh
          ? vh - PH * s
          : clamp(cur.ay * vh - cur.y * s, vh - PH * s, 0);
      const tr = `translate3d(${tx.toFixed(2)}px,${ty.toFixed(2)}px,0) scale(${s.toFixed(5)})`;
      pw.style.transform = tr;
      sv.style.transform = tr;
      if (Math.abs(s - lastS) > 1e-5)
        sv.style.setProperty("--inv", String(1 / s));
      lastS = s;
      if (
        lastPlaced < 0 ||
        Math.abs(s / lastPlaced - 1) > 0.06 ||
        ++tick % 15 === 0
      )
        place();
      st.dataset.show = chs[i]!.getAttribute("data-show") ?? "";
      const pl = chs[i]!.getAttribute("data-plate") ?? "";
      if (plate.current!.textContent !== pl) plate.current!.textContent = pl;
      // A round fraction of one import that fits the corner, as on a printed chart.
      const frac =
        [1, 0.5, 0.25, 0.125].find((f) => HOP * s * f <= 180) ?? 0.125;
      scale.current!.style.width = `${(HOP * s * frac).toFixed(0)}px`;
      const sl = `${frac === 1 ? "1" : `1/${1 / frac}`} import`;
      if (scaleL.current!.textContent !== sl) scaleL.current!.textContent = sl;

      // Lens: follows the pointer over the open photograph, fades when the pointer is over copy or leaves.
      const live = !!ptr;
      lensA += ((live ? 1 : 0) - lensA) * (reduce ? 1 : 0.16);
      sv.style.setProperty("--lens", lensA.toFixed(3));
      if (ptr) {
        const px = (ptr.x - tx) / s;
        const py = (ptr.y - ty) / s;
        lensC.setAttribute("cx", px.toFixed(1));
        lensC.setAttribute("cy", py.toFixed(1));
        lensC.setAttribute("r", String((small ? 120 : 190) / s));
        // Only labels well inside the lens show, so none is cut in half by its edge.
        const rr = ((small ? 120 : 190) / s) * 0.62;
        for (const l of labels) {
          const n = byId.get(l.dataset.id!)!;
          l.style.opacity = Math.hypot(n.x - px, n.y - py) < rr ? "1" : "0";
        }
        let near: (typeof nodes)[number] | null = null;
        let nd = 34;
        for (const n of nodes) {
          const d = Math.hypot((n.x - px) * s, (n.y - py) * s);
          if (d < nd) ((nd = d), (near = n));
        }
        if (near && live) {
          const p = conflictPath(near.id);
          probe.setAttribute("d", p && p.length > 1 ? probeD(p) : "");
          tipEl.dataset.state = p ? "refused" : "free";
          tipEl.innerHTML =
            near.id === CLAIMED
              ? `<b>${near.id}</b><span>Claimed by Agent A</span>`
              : p
                ? `<b>${near.id}</b><span>Refused while A holds session.ts</span><code>${p.join(" → ")}</code>`
                : `<b>${near.id}</b><span>Free. No import path to session.ts within 3 hops.</span>`;
          const tw = tipEl.offsetWidth || 290;
          const th = tipEl.offsetHeight || 90;
          const lx = clamp(
            ptr.x > vw / 2 ? ptr.x - 36 - tw : ptr.x + 36,
            24,
            vw - tw - 24,
          );
          const ly = clamp(
            ptr.y > vh / 2 ? ptr.y - 36 - th : ptr.y + 36,
            24,
            vh - th - 24,
          );
          tipEl.style.transform = `translate3d(${lx}px,${ly}px,0)`;
          tipEl.style.opacity = "1";
        } else {
          probe.setAttribute("d", "");
          tipEl.style.opacity = "0";
        }
      } else tipEl.style.opacity = "0";

      // Agents: the story chapter plays its step's part of the loop, everywhere else the whole loop runs.
      const stepEl = [
        ...document.querySelectorAll<HTMLElement>("[data-step]"),
      ].find((el) => {
        const r = el.getBoundingClientRect();
        return r.top <= line && r.bottom > line;
      });
      let ls: number;
      if (reduce) ls = 9;
      else if (stepEl) {
        const [w0, w1] = STEP_WINDOWS[Number(stepEl.dataset.step)]!;
        ls = w1 > w0 ? w0 + (time % (w1 - w0)) : w0;
      } else ls = time % LOOP;
      const { a: pa, b: pb, aOn, phase } = story(ls);

      // How chapter: leader lines from the map key to the live objects they name.
      const leadOn = st.dataset.show === "all" && k < 0.05;
      leads.current!.style.opacity = leadOn ? "1" : "0";
      if (leadOn) {
        const tgt: Record<string, [number, number]> = {
          edge: [legMid[0], legMid[1]],
          claim: [pa[0], pa[1]],
          gate: [hold[0], hold[1]],
          boat: [pb[0], pb[1]],
        };
        const lines = leads.current!.querySelectorAll("polyline");
        const ends = leads.current!.querySelectorAll("circle");
        document
          .querySelectorAll<HTMLElement>("[data-lead]")
          .forEach((li, j) => {
            const r = li.getBoundingClientRect();
            const [gx, gy] = tgt[li.dataset.lead!]!;
            const x1 = gx * s + tx;
            const y1 = gy * s + ty;
            const x0 = r.right + 16;
            const y0 = r.top + 12;
            const pts = `${x0},${y0} ${x0 + 28},${y0} ${x1},${y1}`;
            for (const l of [lines[j * 2], lines[j * 2 + 1]])
              l?.setAttribute("points", pts);
            ends[j]?.setAttribute("cx", x1.toFixed(1));
            ends[j]?.setAttribute("cy", y1.toFixed(1));
          });
      }
      boatA.setAttribute(
        "transform",
        `translate(${pa[0].toFixed(1)} ${pa[1].toFixed(1)})`,
      );
      boatA.style.setProperty("--h", `${pa[2]}rad`);
      boatA.style.opacity = String(aOn);
      boatB.setAttribute(
        "transform",
        `translate(${pb[0].toFixed(1)} ${pb[1].toFixed(1)})`,
      );
      boatB.style.setProperty("--h", `${pb[2]}rad`);
      // The tag only shows while its boat is well inside the frame, and steps aside for the lens.
      const bx = pb[0] * s + tx;
      const by = pb[1] * s + ty;
      const underCopy = [...document.querySelectorAll("[data-obstacle]")].some(
        (el) => {
          const r = el.getBoundingClientRect();
          return (
            bx > r.left - 140 &&
            bx < r.right + 60 &&
            by > r.top - 60 &&
            by < r.bottom + 60
          );
        },
      );
      bTag.style.opacity =
        !underCopy && bx > 120 && bx < vw - 40 && by > 60 && by < vh - 60
          ? String(1 - lensA)
          : "0";
      // The tag takes the first corner around the boat that clears the route chips.
      const tw = bTag.textContent!.length * 8;
      const taken = [...chips, gateChip].map((c) => c.getBoundingClientRect());
      const spot =
        TAG_SPOTS.find(([dx, dy, an]) => {
          const x0 = bx + dx - (an === "end" ? tw : 0);
          const y0 = by + dy - 11;
          return !taken.some(
            (r) =>
              x0 < r.right + 4 &&
              r.left - 4 < x0 + tw &&
              y0 < r.bottom + 4 &&
              r.top - 4 < y0 + 14,
          );
        }) ?? TAG_SPOTS[0]!;
      bTag.setAttribute("x", String(spot[0]));
      bTag.setAttribute("y", String(spot[1]));
      bTag.setAttribute("text-anchor", spot[2]);
      st.dataset.phase = phase;
      gate.style.opacity = phase === "held" ? "1" : "0";
      const tag =
        phase === "held"
          ? "Agent B, refused"
          : phase === "free"
            ? "Agent B, free"
            : "Agent B";
      if (bTag.textContent !== tag) bTag.textContent = tag;
    };
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      removeEventListener("pointermove", onMove);
      removeEventListener("pointerdown", onMove);
      document.removeEventListener("pointerleave", onLeave);
      img.current?.removeEventListener("load", setImg);
    };
  }, []);

  const gateAng = (hold[2] * 180) / Math.PI;
  return (
    <>
      <div ref={stage} className="sv-stage" aria-hidden="true">
        <div ref={photoWrap} className="sv-world">
          <img
            ref={img}
            className="sv-photo"
            src="/photos/delta-2400.jpg"
            srcSet="/photos/delta-1200.jpg 1200w, /photos/delta-2400.jpg 2400w"
            sizes="(max-width: 700px) 400px, 2400px"
            width={PW}
            height={PH}
            alt=""
            {...{ fetchpriority: "high" }}
          />
        </div>
        <div className="sv-grade" />
        <svg
          ref={svg}
          className="sv-world sv-svg"
          width={PW}
          height={PH}
          viewBox={`0 0 ${PW} ${PH}`}
        >
          <defs>
            <radialGradient id="sv-soft">
              <stop offset="0.72" stopColor="#fff" />
              <stop offset="1" stopColor="#000" />
            </radialGradient>
            <mask
              id="sv-lens"
              maskUnits="userSpaceOnUse"
              x="0"
              y="0"
              width={PW}
              height={PH}
            >
              <circle
                id="sv-lens-c"
                cx="-999"
                cy="-999"
                r="1"
                fill="url(#sv-soft)"
              />
            </mask>
          </defs>

          <g className="sv-routes-under">
            {edges.map((e) => (
              <path key={e.s + e.t} d={pathD(e.pts)} className="sv-ru" />
            ))}
          </g>
          <g className="sv-routes">
            {edges.map((e) => (
              <path
                key={e.s + e.t}
                d={pathD(e.pts)}
                className={onRoute(e) ? "sv-r sv-r-on" : "sv-r"}
              />
            ))}
          </g>
          {[legA, legB].map((e) => {
            const [x, y, h] = along(e.pts, 0.5);
            return (
              <g key={e.s} transform={`translate(${x} ${y}) rotate(${deg(h)})`}>
                <path className="sv-ui sv-dir" d="M9,0 L-6,-7 L-2,0 L-6,7Z" />
              </g>
            );
          })}
          <g className="sv-dots">
            {nodes.map((n) => (
              <g
                key={n.id}
                data-id={n.id}
                transform={`translate(${n.x} ${n.y})`}
              >
                <circle
                  className={`sv-ui ${ROUTE.includes(n.id) ? "sv-dot sv-dot-on" : "sv-dot"}`}
                  r={n.hub ? 4.5 : 3.2}
                />
              </g>
            ))}
          </g>

          <g className="sv-lensed" mask="url(#sv-lens)">
            <image
              id="sv-lens-img"
              width={PW}
              height={PH}
              preserveAspectRatio="none"
            />
            <g className="sv-lens-wash">
              <rect width={PW} height={PH} />
            </g>
            {lensEdges.map(({ e, pts, hot }) => (
              <path
                key={e.s + e.t}
                d={pathD(pts)}
                className={hot ? "sv-rl sv-rl-hot" : "sv-rl"}
              />
            ))}
            {lensEdges.map(({ e, hot, head: [x, y, h] }) => (
              <g
                key={e.s + e.t}
                transform={`translate(${x} ${y}) rotate(${deg(h)})`}
              >
                <path
                  className={hot ? "sv-ui sv-arr sv-arr-hot" : "sv-ui sv-arr"}
                  d="M6,0 L-5,-4.5 L-5,4.5Z"
                />
              </g>
            ))}
            <path className="sv-probe" d="" />
            {nodes.map((n) => (
              <g key={n.id} transform={`translate(${n.x} ${n.y})`}>
                <g className="sv-ui">
                  <circle className="sv-dl" r={n.hub ? 5 : 3.8} />
                  {!ROUTE.includes(n.id) && (
                    <text
                      className="sv-lab"
                      data-id={n.id}
                      data-p={n.hub ? 1 : 0}
                    >
                      {n.label}
                    </text>
                  )}
                </g>
              </g>
            ))}
          </g>

          <g className="sv-gate" transform={`translate(${hold[0]} ${hold[1]})`}>
            <g className="sv-ui">
              <g transform={`rotate(${gateAng + 90})`}>
                <circle className="sv-gate-ring" r="30" />
                <line className="sv-gate-u" x1="-36" y1="0" x2="36" y2="0" />
                <line x1="-36" y1="0" x2="36" y2="0" />
                <line x1="-36" y1="-9" x2="-36" y2="9" />
                <line x1="36" y1="-9" x2="36" y2="9" />
              </g>
              <g className="sv-gate-chip" transform="translate(-74 -68)">
                <rect width="148" height="26" rx="13" />
                <text x="74" y="17.5" textAnchor="middle">
                  × Agent B refused
                </text>
              </g>
            </g>
          </g>
          <g className="sv-boat sv-boat-a">
            <g className="sv-ui">
              <circle className="sv-claim" r="38" />
              <path className="sv-ais" d={HULL} />
            </g>
          </g>
          <g className="sv-boat sv-boat-b">
            <g className="sv-ui">
              <path className="sv-wake" d="M-18,0 L-96,-16 L-90,0 L-96,16Z" />
              <path className="sv-ais sv-ais-b" d={HULL} />
            </g>
            <g className="sv-ui">
              <text className="sv-b-tag" x="-14" y="30" textAnchor="end">
                Agent B
              </text>
            </g>
          </g>

          {ROUTE.map((id, i) => {
            const n = byId.get(id)!;
            const text =
              id === CLAIMED ? "session.ts, held by Agent A" : n.label;
            const w = text.length * 7.9 + 44;
            return (
              <g key={id} transform={`translate(${n.x} ${n.y})`}>
                <g className="sv-ui">
                  <g className="sv-chip" data-id={id} data-w={w}>
                    <rect
                      width={w}
                      height="26"
                      rx="13"
                      className={id === CLAIMED ? "sv-chip-claim" : ""}
                    />
                    <circle className="sv-chip-n" cx="14" cy="13" r="9" />
                    <text
                      className="sv-chip-nt"
                      x="14"
                      y="17.2"
                      textAnchor="middle"
                    >
                      {i + 1}
                    </text>
                    <text x="30" y="17.5">
                      {text}
                    </text>
                  </g>
                </g>
              </g>
            );
          })}
        </svg>
        <div ref={tip} className="sv-tip" role="status" />
      </div>
      <div className="sv-frame" aria-hidden="true">
        <svg ref={leads} className="sv-leads">
          {[0, 1, 2, 3].map((j) => (
            <g key={j}>
              <polyline className="sv-lead-u" />
              <polyline className="sv-lead" />
              <circle r="5" cx="-99" cy="-99" />
            </g>
          ))}
        </svg>
        <span ref={plate} className="sv-plate" />
        <span className="sv-scale">
          <span ref={scale} className="sv-scale-bar" />
          <span ref={scaleL} />
        </span>
      </div>
    </>
  );
}
