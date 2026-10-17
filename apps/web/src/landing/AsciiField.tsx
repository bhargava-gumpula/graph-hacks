import { useEffect, useRef } from "react";

/**
 * Full-page ASCII background, drawn in code on one fixed canvas.
 * A slow flow field of characters, brighter near the pointer. Anything can
 * fire `pulse(x, y)` (viewport coordinates) to send a shockwave of orange
 * glyphs out from that point, so a conflict on the page visibly hits the field.
 */
const RAMP = " .·:-=+*%#@";
const FONT_PX = 13;
const LINE = 16;
const FPS = 30;

type Pulse = { x: number; y: number; t0: number };

export function pulse(x: number, y: number) {
  window.dispatchEvent(new CustomEvent("sb:pulse", { detail: { x, y } }));
}

/** Cheap smooth noise from layered sines: no allocations, stable across frames. */
function field(x: number, y: number, t: number) {
  return (
    Math.sin(x * 0.11 + t * 0.6) * 0.35 +
    Math.sin(y * 0.17 - t * 0.45) * 0.25 +
    Math.sin((x + y) * 0.07 + t * 0.3) * 0.25 +
    Math.sin(Math.hypot(x - 40, y - 20) * 0.09 - t * 0.8) * 0.15
  );
}

export function AsciiField() {
  const ref = useRef<HTMLCanvasElement>(null);

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
    let dpr = 1;
    let raf = 0;
    let last = 0;
    let visible = true;
    const pointer = { x: -9999, y: -9999 };
    const pulses: Pulse[] = [];

    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.font = `${FONT_PX}px "Geist Mono Variable", ui-monospace, monospace`;
      ctx.textBaseline = "top";
      cw = ctx.measureText("M").width;
      cols = Math.ceil(window.innerWidth / cw);
      rows = Math.ceil(window.innerHeight / LINE);
    };

    const draw = (now: number) => {
      const t = now / 1000;
      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
      // Drop finished pulses.
      while (pulses.length && t - pulses[0].t0 > 1.6) pulses.shift();
      for (let r = 0; r < rows; r++) {
        const y = r * LINE;
        for (let c = 0; c < cols; c++) {
          const x = c * cw;
          let v = (field(c, r, t) + 1) / 2; // 0..1
          let hot = 0;
          const pd = Math.hypot(x - pointer.x, y - pointer.y);
          if (pd < 180) v += (1 - pd / 180) * 0.45;
          for (const p of pulses) {
            const age = t - p.t0;
            const radius = age * 520;
            const d = Math.hypot(x - p.x, y - p.y);
            const band = Math.abs(d - radius);
            if (band < 46) {
              const k = (1 - band / 46) * (1 - age / 1.6);
              hot = Math.max(hot, k);
              v += k * 0.9;
            }
          }
          const idx = Math.min(RAMP.length - 1, Math.max(0, Math.floor(v * (RAMP.length - 1) * 0.92)));
          if (idx === 0) continue;
          const ch = RAMP[idx];
          if (hot > 0.15) {
            ctx.fillStyle = signal;
            ctx.globalAlpha = Math.min(0.85, 0.2 + hot * 0.75);
          } else {
            ctx.fillStyle = fg;
            ctx.globalAlpha = 0.05 + (idx / RAMP.length) * 0.16 + (pd < 180 ? (1 - pd / 180) * 0.18 : 0);
          }
          ctx.fillText(ch, x, y);
        }
      }
      ctx.globalAlpha = 1;
    };

    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      if (!visible || now - last < 1000 / FPS) return;
      last = now;
      draw(now);
    };

    const onMove = (e: PointerEvent) => {
      pointer.x = e.clientX;
      pointer.y = e.clientY;
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
      draw(performance.now());
    });
    window.addEventListener("resize", resize);
    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("sb:pulse", onPulse);
    document.addEventListener("visibilitychange", onVis);
    if (reduce) draw(0);
    else raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("sb:pulse", onPulse);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  return <canvas ref={ref} aria-hidden="true" className="pointer-events-none fixed inset-0 z-0 h-full w-full" />;
}
