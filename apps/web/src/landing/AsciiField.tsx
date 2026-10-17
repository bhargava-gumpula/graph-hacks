import { useEffect, useRef } from "react";
import { motion, useScroll, useTransform } from "motion/react";

/**
 * Full-page ASCII background, drawn in code on one fixed canvas.
 * A slow flow field of characters, brighter near the pointer. Anything can
 * fire `pulse(x, y)` (viewport coordinates) to send a shockwave of orange
 * glyphs out from that point, so a conflict on the page visibly hits the field.
 *
 * Calm by design: the resting field only reaches ' .·:-'; the heavy glyphs
 * '+*%#@' come from pointer or pulse energy. Fast by design: alpha is quantised
 * into a few buckets and each (row, bucket) is one fillText of a space-padded
 * string, so a frame is a few hundred draw calls instead of one per cell.
 *
 * Quiet off-stage: it holds still while the page scrolls, and once the hero is behind
 * you only the pointer and pulses redraw it (and the whole field fades to 40%), so it
 * never competes with the scroll-linked sections or runs through their text.
 */
const RAMP = " .·:-=+*%#@";
const CODES = Array.from(RAMP, (ch) => ch.charCodeAt(0));
const TOP = RAMP.length - 1;
const FONT_PX = 13;
const LINE = 16;
const FPS = 20;
const IDLE_FPS = 10;
const IDLE_AFTER_MS = 2000;
const MAX_DPR = 1.5;
/** The resting field is scaled into the light end of the ramp and never passes REST_TOP ('-'). */
const BASE = 0.5;
const REST_TOP = 4;
const POINTER_R = 140;
const POINTER_BOOST = 0.25;
const PULSE_LIFE = 1.6;
/** The shockwave decelerates out to this radius (cubic ease-out), like a blast, not a ripple. */
const PULSE_R = 680;
/** Hold the field still for this long after the last scroll movement. */
const SCROLL_HOLD_MS = 150;
const PULSE_BAND = 46;
/**
 * Neutral alpha buckets (fg colour), indexed by glyph level plus pointer proximity, so
 * each resting glyph ' .·:-' gets its own step; then hot buckets (signal colour).
 */
const FG_ALPHA = [0.12, 0.18, 0.24, 0.3, 0.37, 0.45];
const HOT_ALPHA = [0.4, 0.62, 0.85];
const BUCKETS = FG_ALPHA.length + HOT_ALPHA.length;

type Pulse = { x: number; y: number; t0: number };

export function pulse(x: number, y: number) {
  window.dispatchEvent(new CustomEvent("sb:pulse", { detail: { x, y } }));
}

export function AsciiField() {
  const ref = useRef<HTMLCanvasElement>(null);
  // Full strength in the hero, 40% once it is scrolled past (both themes).
  const { scrollY } = useScroll();
  const fade = useTransform(scrollY, [0, typeof window === "undefined" ? 900 : window.innerHeight], [1, 0.4]);

  useEffect(() => {
    const canvas = ref.current!;
    const ctx = canvas.getContext("2d")!;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const css = getComputedStyle(document.documentElement);
    const fg = css.getPropertyValue("--fg").trim() || "#ededf0";
    const signal = css.getPropertyValue("--color-signal").trim() || "#ff6a3d";
    let cols = 0;
    let rows = 0;
    let cw = 8;
    let raf = 0;
    let last = 0;
    let lastMove = -Infinity;
    let lastScroll = -Infinity;
    let lastY = window.scrollY;
    let visible = true;
    const pointer = { x: -9999, y: -9999, in: false };
    const pulses: Pulse[] = [];
    // Per-frame scratch, sized on resize. The radial term of the field is static per cell,
    // so its sin/cos are cached and only rotated by time each frame.
    let radSin = new Float32Array(0);
    let radCos = new Float32Array(0);
    let colTerm = new Float32Array(0);
    let rowTerm = new Float32Array(0);
    let diagTerm = new Float32Array(0);
    let line: Uint16Array[] = [];
    let used = new Uint8Array(0);
    let text: (string | null)[] = [];

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
      canvas.width = Math.round(window.innerWidth * dpr);
      canvas.height = Math.round(window.innerHeight * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.font = `${FONT_PX}px "Geist Mono Variable", ui-monospace, monospace`;
      ctx.textBaseline = "top";
      cw = ctx.measureText("M").width;
      cols = Math.ceil(window.innerWidth / cw);
      rows = Math.ceil(window.innerHeight / LINE);
      radSin = new Float32Array(cols * rows);
      radCos = new Float32Array(cols * rows);
      for (let r = 0; r < rows; r++)
        for (let c = 0; c < cols; c++) {
          const d = Math.hypot(c - 40, r - 20) * 0.09;
          radSin[r * cols + c] = Math.sin(d);
          radCos[r * cols + c] = Math.cos(d);
        }
      colTerm = new Float32Array(cols);
      rowTerm = new Float32Array(rows);
      diagTerm = new Float32Array(cols + rows);
      line = Array.from({ length: BUCKETS }, () => new Uint16Array(cols));
      used = new Uint8Array(BUCKETS);
      text = new Array(BUCKETS * rows).fill(null);
      // Setting canvas.width clears it; with reduced motion there is no loop to repaint it.
      if (reduce) draw(0);
    };

    const draw = (now: number) => {
      const t = now / 1000;
      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
      while (pulses.length && t - pulses[0].t0 > PULSE_LIFE) pulses.shift();

      // field(c, r, t) = sin(c*.11+.6t)*.35 + sin(r*.17-.45t)*.25 + sin((c+r)*.07+.3t)*.25 + sin(dist*.09-.8t)*.15
      for (let c = 0; c < cols; c++) colTerm[c] = Math.sin(c * 0.11 + t * 0.6) * 0.35;
      for (let r = 0; r < rows; r++) rowTerm[r] = Math.sin(r * 0.17 - t * 0.45) * 0.25;
      for (let i = 0; i < cols + rows; i++) diagTerm[i] = Math.sin(i * 0.07 + t * 0.3) * 0.25;
      const st = Math.sin(t * 0.8) * 0.15;
      const ct = Math.cos(t * 0.8) * 0.15;
      const R = POINTER_R;
      const hasPointer = pointer.in;

      for (let r = 0; r < rows; r++) {
        const y = r * LINE;
        const nearRow = hasPointer && Math.abs(y - pointer.y) < R;
        used.fill(0);
        for (let c = 0; c < cols; c++) {
          const i = r * cols + c;
          const f = colTerm[c] + rowTerm[r] + diagTerm[c + r] + radSin[i] * ct - radCos[i] * st;
          let e = 0; // pointer and pulse energy on top of the resting glyph
          let near = 0;
          if (nearRow) {
            const x = c * cw;
            const dx = x - pointer.x;
            if (dx < R && dx > -R) {
              const pd = Math.hypot(dx, y - pointer.y);
              if (pd < R) {
                near = 1 - pd / R;
                e += near * POINTER_BOOST;
              }
            }
          }
          let hot = 0;
          for (let k = 0; k < pulses.length; k++) {
            const p = pulses[k];
            const a = Math.max(0, (t - p.t0) / PULSE_LIFE);
            const band = Math.abs(Math.hypot(c * cw - p.x, y - p.y) - PULSE_R * (1 - (1 - a) ** 3));
            if (band < PULSE_BAND) {
              const k = (1 - band / PULSE_BAND) * (1 - a) ** 2;
              if (k > hot) hot = k;
              e += k * 0.9;
            }
          }
          const rest = Math.min(REST_TOP, Math.round(((f + 1) / 2) * TOP * 0.92 * BASE));
          const idx = Math.min(TOP, rest + Math.floor(e * TOP * 0.92));
          if (idx <= 0) continue;
          let b: number;
          if (hot > 0.15) {
            const a = Math.min(0.85, 0.2 + hot * 0.75);
            b = FG_ALPHA.length + (a < 0.5 ? 0 : a < 0.74 ? 1 : 2);
          } else {
            b = Math.min(FG_ALPHA.length - 1, Math.floor(idx + near * 3) - 1);
          }
          if (!used[b]) {
            used[b] = 1;
            line[b].fill(32);
          }
          line[b][c] = CODES[idx];
        }
        for (let b = 0; b < BUCKETS; b++)
          text[b * rows + r] = used[b] ? String.fromCharCode.apply(null, line[b] as unknown as number[]) : null;
      }

      ctx.fillStyle = fg;
      for (let b = 0; b < BUCKETS; b++) {
        if (b === FG_ALPHA.length) ctx.fillStyle = signal;
        ctx.globalAlpha = b < FG_ALPHA.length ? FG_ALPHA[b] : HOT_ALPHA[b - FG_ALPHA.length];
        for (let r = 0; r < rows; r++) {
          const s = text[b * rows + r];
          if (s) ctx.fillText(s, 0, r * LINE);
        }
      }
      ctx.globalAlpha = 1;
    };

    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      if (!visible) return;
      // Polled here rather than with a scroll listener: the loop already runs every frame.
      const sy = window.scrollY;
      if (sy !== lastY) {
        lastY = sy;
        lastScroll = now;
      }
      // A live shockwave draws on every frame so its front stays smooth.
      if (pulses.length > 0) {
        last = now;
        draw(now);
        return;
      }
      const pointerBusy = now - lastMove < IDLE_AFTER_MS;
      // Hold still while the page scrolls; past the hero, only the pointer redraws the field.
      if (now - lastScroll < SCROLL_HOLD_MS || (!pointerBusy && sy > window.innerHeight)) return;
      const interval = 1000 / (pointerBusy ? FPS : IDLE_FPS);
      // A little slack, and a fixed cadence: a late frame doesn't push every later frame back.
      if (now - last < interval - 3) return;
      last = now - last > interval * 2 ? now : last + interval;
      draw(now);
    };

    const onMove = (e: PointerEvent) => {
      pointer.x = e.clientX;
      pointer.y = e.clientY;
      pointer.in = true;
      lastMove = performance.now();
    };
    const onLeave = (e: PointerEvent) => {
      if (!e.relatedTarget) pointer.in = false;
    };
    const onPulse = (e: Event) => {
      const { x, y } = (e as CustomEvent<{ x: number; y: number }>).detail;
      pulses.push({ x, y, t0: performance.now() / 1000 });
      if (reduce) draw(performance.now());
    };
    const onVis = () => (visible = document.visibilityState === "visible");

    resize();
    document.fonts?.ready.then(() => {
      resize();
      if (!reduce) draw(performance.now());
    });
    window.addEventListener("resize", resize);
    window.addEventListener("pointermove", onMove, { passive: true });
    document.addEventListener("pointerout", onLeave, { passive: true });
    window.addEventListener("sb:pulse", onPulse);
    document.addEventListener("visibilitychange", onVis);
    if (reduce) draw(0);
    else raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerout", onLeave);
      window.removeEventListener("sb:pulse", onPulse);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  return (
    <motion.div aria-hidden="true" style={{ opacity: fade }} className="pointer-events-none fixed inset-0 z-0">
      <canvas
        ref={ref}
        className="block h-full w-full opacity-60 lg:opacity-100 lg:[mask-image:linear-gradient(90deg,rgba(0,0,0,.3)_0%,rgba(0,0,0,.3)_42%,#000_72%)]"
      />
    </motion.div>
  );
}
