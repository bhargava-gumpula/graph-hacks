import { useEffect, useRef } from "react";
import { along, byId, CLAIMED, conflictPath, edgeOf, edges, nodes, onRoute, pathD, PH, PW, ROUTE, type Pt } from "./graph";

type Cam = { x: number; y: number; z: number; ax: number; ay: number };
type Box = { x: number; y: number; w: number; h: number };

const legA = edgeOf(ROUTE[0]!, ROUTE[1]!);
const legB = edgeOf(ROUTE[1]!, ROUTE[2]!);
const exit = edges.find((e) => e.s === CLAIMED)!;
const HOLD = 0.62;
const LOOP = 16;
const sess = byId.get(CLAIMED)!;
const hold = along(legB.pts, HOLD);

const readCam = (el: Element, small: boolean): Cam => {
  const [x, y, z, ax, ay] = ((small && el.getAttribute("data-cam-sm")) || el.getAttribute("data-cam")!).split(/\s+/).map(Number);
  return { x: x!, y: y!, z: z!, ax: ax!, ay: ay! };
};
const clamp = (v: number, a: number, b: number) => Math.min(Math.max(v, a), b);
const smooth = (a: number, b: number, t: number) => {
  const k = clamp((t - a) / (b - a), 0, 1);
  return k * k * (3 - 2 * k);
};
const hit = (a: Box, b: Box) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

/** Where the two agents are at time s of the 16 s story loop. */
function story(s: number) {
  let b: [number, number, number];
  let a: [number, number, number] = [sess.x, sess.y, -2.4];
  let aOn = 1;
  let phase: "edit" | "held" | "free" = "edit";
  if (s < 1) b = along(legA.pts, 0);
  else if (s < 5) b = along(legA.pts, smooth(1, 5, s));
  else if (s < 7) b = along(legB.pts, HOLD * Math.sin(((s - 5) / 2) * (Math.PI / 2)));
  else if (s < 11) ((b = hold), (phase = "held"));
  else {
    phase = "free";
    a = along(exit.pts, smooth(11, 15, s) * 0.9);
    aOn = 1 - smooth(14, 15.6, s);
    b = s < 13 ? hold : along(legB.pts, HOLD + (1 - HOLD) * smooth(13, 15.4, s));
  }
  return { a, b, aOn, phase };
}
// Story steps on the page play one part of the loop each.
const STEP_WINDOWS: [number, number][] = [[0.2, 0.2], [0.2, 5.6], [7, 11], [11, 16]];

const probeD = (path: string[]) => {
  const pts: Pt[] = [];
  for (let i = 0; i < path.length - 1; i++) {
    const f = edges.find((e) => e.s === path[i] && e.t === path[i + 1]);
    const r = edges.find((e) => e.t === path[i] && e.s === path[i + 1]);
    pts.push(...(f ? f.pts : [...r!.pts].reverse()));
  }
  return pts.length ? pathD(pts) : "";
};

const TAG_SPOTS: [number, number, "start" | "end"][] = [[-14, 30, "end"], [14, 30, "start"], [14, -16, "start"], [-14, -16, "end"]];
const CANDS: [number, number, "start" | "end" | "middle"][] = [
  [9, 4, "start"], [-9, 4, "end"], [0, -11, "middle"], [0, 19, "middle"], [8, -9, "start"], [-8, -9, "end"], [8, 16, "start"], [-8, 16, "end"],
];

export function Survey() {
  const stage = useRef<HTMLDivElement>(null);
  const img = useRef<HTMLImageElement>(null);
  const photoWrap = useRef<HTMLDivElement>(null);
  const svg = useRef<SVGSVGElement>(null);
  const tip = useRef<HTMLDivElement>(null);

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
    const labels = [...sv.querySelectorAll<SVGTextElement>(".sv-lab")];
    const chips = [...sv.querySelectorAll<SVGGElement>(".sv-chip")];
    const tipEl = tip.current!;

    const setImg = () => img.current?.currentSrc && lensImg.setAttribute("href", img.current.currentSrc);
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
      const boxes: Box[] = nodes.map((n) => ({ x: n.x * s - 6, y: n.y * s - 6, w: 12, h: 12 }));
      const vw = innerWidth;
      boxes.push({ x: -tx - 1e4 + 6, y: -1e5, w: 1e4, h: 2e5 }, { x: vw - tx - 6, y: -1e5, w: 1e4, h: 2e5 });
      for (const el of document.querySelectorAll("[data-obstacle], .dl-nav nav")) {
        const r = el.getBoundingClientRect();
        if (r.bottom > 0 && r.top < innerHeight) boxes.push({ x: r.x - tx - 8, y: r.y - ty - 8, w: r.width + 16, h: r.height + 16 });
      }
      for (const c of chips) {
        const n = byId.get(c.dataset.id!)!;
        const w = Number(c.dataset.w);
        const opts: [number, number][] = [[12, -11], [-12 - w, -11], [-w / 2, -34], [-w / 2, 12], [12, 4], [-12 - w, 4]];
        const pick = opts.find(([dx, dy]) => !boxes.some((b) => hit(b, { x: n.x * s + dx, y: n.y * s + dy, w, h: 23 }))) ?? opts[0]!;
        boxes.push({ x: n.x * s + pick[0], y: n.y * s + pick[1], w, h: 23 });
        c.setAttribute("transform", `translate(${pick[0]} ${pick[1]})`);
      }
      const order = [...labels].sort((a, b) => Number(b.dataset.p) - Number(a.dataset.p));
      for (const l of order) {
        const n = byId.get(l.dataset.id!)!;
        const w = l.textContent!.length * 6.7 + 4;
        let done = false;
        for (const [dx, dy, anchor] of CANDS) {
          const bx = anchor === "start" ? dx : anchor === "end" ? dx - w : dx - w / 2;
          const box = { x: n.x * s + bx, y: n.y * s + dy - 10, w, h: 13 };
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
      ptr = blocked ? null : { x: e.clientX, y: e.clientY, t: performance.now() };
    };
    const onLeave = () => (ptr = null);
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

      // Camera: hold on each chapter's view, travel to the next one during the last 80% of a screen before it arrives.
      const chs = [...document.querySelectorAll("[data-cam]")];
      const tops = chs.map((c) => c.getBoundingClientRect().top);
      let i = 0;
      while (i < chs.length - 1 && tops[i + 1]! <= line) i++;
      const a = readCam(chs[i]!, small);
      const b = chs[i + 1] ? readCam(chs[i + 1]!, small) : a;
      const k = reduce ? 0 : smooth(0, 1, 1 - clamp((tops[i + 1] ?? 1e9) - line, 0, vh * 0.8) / (vh * 0.8));
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
      else for (const key of ["x", "y", "z", "ax", "ay"] as const) cur[key] += (target[key] - cur[key]) * 0.14;

      const time = (now - t0) / 1000;
      const drift = reduce ? 1 : 1 + 0.018 * (0.5 - 0.5 * Math.cos((time / 26) * Math.PI * 2));
      s = s0 * cur.z * drift;
      tx = clamp(cur.ax * vw - cur.x * s, vw - PW * s, 0);
      ty = clamp(cur.ay * vh - cur.y * s, vh - PH * s, 0);
      const tr = `translate3d(${tx.toFixed(2)}px,${ty.toFixed(2)}px,0) scale(${s.toFixed(5)})`;
      pw.style.transform = tr;
      sv.style.transform = tr;
      if (Math.abs(s - lastS) > 1e-5) sv.style.setProperty("--inv", String(1 / s));
      lastS = s;
      if (lastPlaced < 0 || Math.abs(s / lastPlaced - 1) > 0.06 || ++tick % 15 === 0) place();
      st.dataset.show = chs[i]!.getAttribute("data-show") ?? "";

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
        const rr = ((small ? 120 : 190) / s) * 0.78;
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
          tipEl.style.transform = `translate3d(${Math.min(ptr.x + 22, vw - 300)}px,${ptr.y + 22}px,0)`;
          tipEl.style.opacity = "1";
        } else {
          probe.setAttribute("d", "");
          tipEl.style.opacity = "0";
        }
      } else tipEl.style.opacity = "0";

      // Agents: the story chapter plays its step's part of the loop, everywhere else the whole loop runs.
      const stepEl = [...document.querySelectorAll<HTMLElement>("[data-step]")].find((el) => {
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
      boatA.setAttribute("transform", `translate(${pa[0].toFixed(1)} ${pa[1].toFixed(1)})`);
      boatA.style.setProperty("--h", `${pa[2]}rad`);
      boatA.style.opacity = String(aOn);
      boatB.setAttribute("transform", `translate(${pb[0].toFixed(1)} ${pb[1].toFixed(1)})`);
      boatB.style.setProperty("--h", `${pb[2]}rad`);
      // The tag only shows while its boat is well inside the frame, and steps aside for the lens.
      const bx = pb[0] * s + tx;
      const by = pb[1] * s + ty;
      bTag.style.opacity = bx > 120 && bx < vw - 40 && by > 60 && by < vh - 60 ? String(1 - lensA) : "0";
      // The tag takes the first corner around the boat that clears the route chips.
      const tw = bTag.textContent!.length * 7.4;
      const taken = chips.map((c) => c.getBoundingClientRect());
      const spot =
        TAG_SPOTS.find(([dx, dy, an]) => {
          const x0 = bx + dx - (an === "end" ? tw : 0);
          const y0 = by + dy - 11;
          return !taken.some((r) => x0 < r.right + 4 && r.left - 4 < x0 + tw && y0 < r.bottom + 4 && r.top - 4 < y0 + 14);
        }) ?? TAG_SPOTS[0]!;
      bTag.setAttribute("x", String(spot[0]));
      bTag.setAttribute("y", String(spot[1]));
      bTag.setAttribute("text-anchor", spot[2]);
      st.dataset.phase = phase;
      gate.style.opacity = phase === "held" ? "1" : "0";
      const tag = phase === "held" ? "Agent B, refused" : phase === "free" ? "Agent B, free" : "Agent B";
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
          fetchPriority="high"
        />
      </div>
      <div className="sv-grade" />
      <svg ref={svg} className="sv-world sv-svg" width={PW} height={PH} viewBox={`0 0 ${PW} ${PH}`}>
        <defs>
          <radialGradient id="sv-soft">
            <stop offset="0.72" stopColor="#fff" />
            <stop offset="1" stopColor="#000" />
          </radialGradient>
          <mask id="sv-lens" maskUnits="userSpaceOnUse" x="0" y="0" width={PW} height={PH}>
            <circle id="sv-lens-c" cx="-999" cy="-999" r="1" fill="url(#sv-soft)" />
          </mask>
        </defs>

        <g className="sv-routes">
          {edges.map((e) => (
            <path key={e.s + e.t} d={pathD(e.pts)} className={onRoute(e) ? "sv-r sv-r-on" : "sv-r"} />
          ))}
        </g>
        <g className="sv-dots">
          {nodes.map((n) => (
            <g key={n.id} data-id={n.id} transform={`translate(${n.x} ${n.y})`}>
              <circle className={`sv-ui ${ROUTE.includes(n.id) ? "sv-dot sv-dot-on" : "sv-dot"}`} r={n.hub ? 4.5 : 3.2} />
            </g>
          ))}
        </g>

        <g className="sv-lensed" mask="url(#sv-lens)">
          <image id="sv-lens-img" width={PW} height={PH} preserveAspectRatio="none" />
          <g className="sv-lens-wash">
            <rect width={PW} height={PH} />
          </g>
          {edges.map((e) => (
            <path key={e.s + e.t} d={pathD(e.pts)} className="sv-rl" />
          ))}
          <path className="sv-probe" d="" />
          {nodes.map((n) => (
            <g key={n.id} transform={`translate(${n.x} ${n.y})`}>
              <g className="sv-ui">
                <circle className="sv-dl" r={n.hub ? 5 : 3.8} />
                {!ROUTE.includes(n.id) && (
                  <text className="sv-lab" data-id={n.id} data-p={n.hub ? 1 : 0}>
                    {n.label}
                  </text>
                )}
              </g>
            </g>
          ))}
        </g>

        <g className="sv-gate" transform={`translate(${hold[0]} ${hold[1]}) rotate(${gateAng + 90})`}>
          <g className="sv-ui">
            <circle className="sv-gate-ring" r="16" />
            <line x1="-20" y1="0" x2="20" y2="0" />
          </g>
        </g>
        <g className="sv-boat sv-boat-a">
          <g className="sv-ui">
            <circle className="sv-claim" r="22" />
            <path className="sv-ais" d="M10,0 L-7,-6 L-4,0 L-7,6Z" />
          </g>
        </g>
        <g className="sv-boat sv-boat-b">
          <g className="sv-ui">
            <path className="sv-wake" d="M-6,0 L-46,-7 L-46,7Z" />
            <path className="sv-ais sv-ais-b" d="M10,0 L-7,-6 L-4,0 L-7,6Z" />
          </g>
          <g className="sv-ui">
            <text className="sv-b-tag" x="-14" y="30" textAnchor="end">
              Agent B
            </text>
          </g>
        </g>

        {ROUTE.map((id) => {
          const n = byId.get(id)!;
          const text = id === CLAIMED ? "session.ts, held by Agent A" : n.label;
          const w = text.length * 7.3 + 20;
          return (
            <g key={id} transform={`translate(${n.x} ${n.y})`}>
              <g className="sv-ui">
                <g className="sv-chip" data-id={id} data-w={w}>
                  <rect width={w} height="23" rx="11.5" className={id === CLAIMED ? "sv-chip-claim" : ""} />
                  <text x="10" y="15.5">
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
  );
}
