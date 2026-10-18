import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ArrowLeft, ArrowRight, X } from "@phosphor-icons/react";

export interface TourStep {
  id: string;
  title: string;
  body: ReactNode;
  /** CSS selectors the spotlight keeps bright; missing or hidden ones are skipped. */
  targets: string[];
}

const EASE_OUT = [0.23, 1, 0.32, 1] as const;
const EASE_IN_OUT = [0.77, 0, 0.175, 1] as const;
const STEP_MS = 6000;
/** The refusal step gets longer: the server's sentence is the point of the tour. */
const READ_MS = 9000;
const TICK_MS = 100;
const SEEN = "sb.tour.seen";

export function tourSeen() {
  try {
    return localStorage.getItem(SEEN) === "1";
  } catch {
    return false; // no storage: the tour shows again, which is harmless
  }
}
export function markTourSeen() {
  try {
    localStorage.setItem(SEEN, "1");
  } catch {
    /* storage blocked */
  }
}

type Box = { x: number; y: number; w: number; h: number };
const same = (a: Box[], b: Box[]) => a.length === b.length && a.every((r, i) => r.x === b[i].x && r.y === b[i].y && r.w === b[i].w && r.h === b[i].h);

/** Viewport boxes of the targets, re-measured while the tour is open (panels and banners can move them). */
function useBoxes(selectors: string[]) {
  const [boxes, setBoxes] = useState<Box[]>([]);
  const key = selectors.join("|");
  useLayoutEffect(() => {
    const pad = 6;
    const measure = () => {
      const next = selectors.flatMap((s) => {
        const r = document.querySelector(s)?.getBoundingClientRect();
        if (!r || r.width < 2 || r.height < 2) return [];
        const x = Math.max(2, r.left - pad);
        const y = Math.max(2, r.top - pad);
        return [{ x, y, w: Math.min(window.innerWidth - 2, r.right + pad) - x, h: Math.min(window.innerHeight - 2, r.bottom + pad) - y }];
      });
      setBoxes((b) => (same(b, next) ? b : next));
    };
    measure();
    const t = window.setInterval(measure, 400);
    window.addEventListener("resize", measure);
    return () => {
      clearInterval(t);
      window.removeEventListener("resize", measure);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return boxes;
}

const typing = (t: EventTarget | null) =>
  t instanceof HTMLElement && (t.isContentEditable || /^(INPUT|SELECT|TEXTAREA)$/.test(t.tagName) || !!t.closest("[role=tablist],[role=radiogroup]"));

/**
 * The guided tour: a narrated card plus a spotlight that dims everything but the step's targets.
 * The parent drives the canvas from `index`; this component only times, narrates and navigates.
 */
export function Tour({
  steps,
  index,
  onIndex,
  onClose,
  ready = true,
  extra,
  anchor,
  focusOnOpen = false,
}: {
  steps: TourStep[];
  index: number;
  onIndex: (i: number) => void;
  /** finished: the last step was completed (not skipped). */
  onClose: (finished: boolean) => void;
  /** False holds the timer (for example while the server runs the demo). */
  ready?: boolean;
  extra?: ReactNode;
  /** Selector of the element the desktop card sits inside (bottom left). */
  anchor: string;
  focusOnOpen?: boolean;
}) {
  const reduce = useReducedMotion();
  const step = steps[index];
  const last = index === steps.length - 1;
  const boxes = useBoxes(step.targets);
  const anchorBox = useBoxes([anchor])[0];
  const card = useRef<HTMLDivElement>(null);
  const nextBtn = useRef<HTMLButtonElement>(null);

  const [wide, setWide] = useState(() => window.matchMedia("(min-width: 1024px)").matches);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const on = () => setWide(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);

  // Auto-advance: hovering or keyboard focus in the card holds it; touching the page outside the card
  // holds it for this step. Back, Next or a dot start the clock again.
  const [elapsed, setElapsed] = useState(0);
  const [hover, setHover] = useState(false);
  const [kbFocus, setKbFocus] = useState(false);
  const [held, setHeld] = useState(false);
  // A step that never gets ready (the demo stalled) still moves on after a while.
  const [stalled, setStalled] = useState(false);
  const total = step.id === "refuse" ? READ_MS : STEP_MS;
  const paused = hover || kbFocus || held || (!ready && !stalled);
  useEffect(() => {
    setElapsed(0);
    setHeld(false);
    setStalled(false);
  }, [index]);
  useEffect(() => {
    if (ready) return;
    const t = window.setTimeout(() => setStalled(true), 15000);
    return () => clearTimeout(t);
  }, [ready, index]);
  useEffect(() => {
    if (paused) return;
    const t = window.setInterval(() => setElapsed((e) => e + TICK_MS), TICK_MS);
    return () => clearInterval(t);
  }, [paused, index]);
  useEffect(() => {
    if (elapsed < total) return;
    if (last) onClose(true);
    else onIndex(index + 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [elapsed >= total]);

  const go = (i: number) => {
    if (i < 0) return;
    if (i >= steps.length) return onClose(true);
    onIndex(i);
  };

  // Keyboard: arrows move, Escape skips. Fields, tabs and radios keep their own arrow keys.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "Escape") return onClose(false);
      if (typing(e.target)) return;
      if (e.key === "ArrowRight") (e.preventDefault(), go(index + 1));
      else if (e.key === "ArrowLeft") (e.preventDefault(), go(index - 1));
    };
    const onDown = (e: PointerEvent) => {
      if (!card.current?.contains(e.target as Node)) setHeld(true);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onDown);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index]);

  // Focus goes into the card when the tour was opened on purpose, and back where it was on close.
  useEffect(() => {
    const before = document.activeElement as HTMLElement | null;
    if (focusOnOpen) nextBtn.current?.focus();
    return () => before?.focus?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Phones: a sheet at the bottom, or at the top when the targets sit in the lower half.
  const low = boxes.length > 0 && boxes.every((b) => b.y + b.h / 2 > window.innerHeight / 2);
  // Desktop: inside the canvas, bottom left; a narrow canvas keeps it in the window's bottom left corner.
  const sheet = { left: 8, right: 8, maxWidth: 440, marginInline: "auto" } as const;
  const place: React.CSSProperties =
    wide && anchorBox
      ? anchorBox.w >= 560
        ? { left: anchorBox.x + 16, bottom: window.innerHeight - (anchorBox.y + anchorBox.h) + 16, width: 380 }
        : { left: 16, bottom: 16, width: 360 }
      : low
        ? { ...sheet, top: 8 }
        : { ...sheet, bottom: "calc(8px + env(safe-area-inset-bottom))" };

  return (
    <>
      <svg aria-hidden className="pointer-events-none fixed inset-0 z-40 h-full w-full">
        <defs>
          <mask id="tour-mask">
            <rect width="100%" height="100%" fill="white" />
            {boxes.map((b, i) => (
              <motion.rect
                key={i}
                rx={12}
                fill="black"
                initial={false}
                animate={{ x: b.x, y: b.y, width: b.w, height: b.h }}
                transition={reduce ? { duration: 0 } : { duration: 0.45, ease: EASE_IN_OUT }}
              />
            ))}
          </mask>
        </defs>
        <motion.rect
          width="100%"
          height="100%"
          mask="url(#tour-mask)"
          style={{ fill: "var(--tour-dim)" }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3, ease: EASE_OUT }}
        />
        {boxes.map((b, i) => (
          <motion.rect
            key={i}
            rx={12}
            fill="none"
            style={{ stroke: "var(--color-signal)" }}
            strokeOpacity={0.55}
            strokeWidth={1.5}
            initial={false}
            animate={{ x: b.x, y: b.y, width: b.w, height: b.h }}
            transition={reduce ? { duration: 0 } : { duration: 0.45, ease: EASE_IN_OUT }}
          />
        ))}
      </svg>

      <motion.div
        ref={card}
        role="dialog"
        aria-modal="false"
        aria-labelledby="tour-title"
        aria-describedby="tour-body"
        layout={!reduce}
        initial={{ opacity: 0, y: reduce ? 0 : 12, scale: reduce ? 1 : 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: reduce ? 0 : 8, transition: { duration: 0.15, ease: EASE_OUT } }}
        transition={{ duration: 0.3, ease: EASE_OUT, layout: { duration: 0.35, ease: EASE_IN_OUT } }}
        style={place}
        className="fixed z-50 overflow-hidden rounded-[var(--radius-panel)] border border-[var(--border)] bg-[var(--surface)] shadow-2xl shadow-black/40"
        onPointerEnter={(e) => e.pointerType === "mouse" && setHover(true)}
        onPointerLeave={() => setHover(false)}
        onFocus={(e) => setKbFocus((e.target as HTMLElement).matches(":focus-visible"))}
        onBlur={(e) => !card.current?.contains(e.relatedTarget as Node) && setKbFocus(false)}
        onKeyDown={(e) => {
          if (e.key !== "Tab") return;
          // Keep Tab inside the card while it has focus; Escape is the way out.
          const f = [...(card.current?.querySelectorAll<HTMLElement>("button:not([disabled]),a[href]") ?? [])];
          if (!f.length) return;
          const at = f.indexOf(document.activeElement as HTMLElement);
          if (e.shiftKey && at <= 0) (e.preventDefault(), f[f.length - 1].focus());
          else if (!e.shiftKey && at === f.length - 1) (e.preventDefault(), f[0].focus());
        }}
      >
        <div className="p-4 pb-3.5">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-[var(--muted)]">
              Guided tour <span className="font-mono tabular-nums">{index + 1}/{steps.length}</span>
            </p>
            <button
              type="button"
              onClick={() => onClose(false)}
              className="-mr-1.5 inline-flex touch-manipulation items-center gap-1 rounded-full px-2 py-1 text-xs text-[var(--muted)] transition-[color,transform] duration-150 hover:text-[var(--fg)] active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-[var(--color-signal)] pointer-coarse:py-2"
            >
              Skip <X size={12} aria-hidden />
            </button>
          </div>

          <div aria-live="polite" className="mt-2">
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.div
                key={step.id}
                initial={{ opacity: 0, y: reduce ? 0 : 6, filter: reduce ? "none" : "blur(2px)" }}
                animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                exit={{ opacity: 0, y: reduce ? 0 : -4, filter: reduce ? "none" : "blur(2px)", transition: { duration: 0.12 } }}
                transition={{ duration: 0.24, ease: EASE_OUT }}
              >
                <h2 id="tour-title" className="font-display text-balance text-[15px] font-semibold leading-snug tracking-tight text-[var(--fg)]">
                  {step.title}
                </h2>
                <div id="tour-body" className="mt-1.5 text-[13px] leading-relaxed text-[var(--fg)]/75">
                  {step.body}
                </div>
                {extra && <div className="mt-3">{extra}</div>}
              </motion.div>
            </AnimatePresence>
          </div>

          <div className="mt-4 flex items-center justify-between gap-3">
            <div className="flex items-center" role="group" aria-label="Tour steps">
              {steps.map((s, i) => (
                <button
                  key={s.id}
                  type="button"
                  aria-label={`Step ${i + 1}: ${s.title}`}
                  aria-current={i === index ? "step" : undefined}
                  tabIndex={-1}
                  onClick={() => go(i)}
                  className="group grid h-6 w-4 touch-manipulation place-items-center rounded-full focus-visible:outline-2 focus-visible:outline-[var(--color-signal)] pointer-coarse:h-9 pointer-coarse:w-[18px]"
                >
                  <span
                    className={`block h-1.5 rounded-full transition-[width,background-color] duration-200 ${
                      i === index ? "w-3 bg-[var(--color-signal)]" : i < index ? "w-1.5 bg-[var(--fg)]/60" : "w-1.5 bg-[var(--fg)]/20 group-hover:bg-[var(--fg)]/40"
                    }`}
                  />
                </button>
              ))}
            </div>
            <div className="flex items-center gap-1.5">
              {index > 0 && (
                <button
                  type="button"
                  onClick={() => go(index - 1)}
                  aria-label="Back"
                  className="grid size-8 touch-manipulation place-items-center rounded-full border border-[var(--border)] text-[var(--muted)] transition-[color,border-color,transform] duration-150 hover:border-[var(--muted)] hover:text-[var(--fg)] active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-[var(--color-signal)] pointer-coarse:size-10"
                >
                  <ArrowLeft size={14} aria-hidden />
                </button>
              )}
              <button
                ref={nextBtn}
                type="button"
                onClick={() => go(index + 1)}
                className="inline-flex h-8 touch-manipulation items-center gap-1.5 rounded-full bg-[var(--color-signal)] px-3.5 text-xs font-medium text-[#1a0d08] transition-[filter,transform] duration-150 hover:brightness-110 active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--fg)] pointer-coarse:h-10"
              >
                {last ? "Finish" : "Next"} {!last && <ArrowRight size={13} aria-hidden />}
              </button>
            </div>
          </div>
        </div>
        {/* Time left on this step; it stops while the card is held. */}
        <div aria-hidden className="h-0.5 bg-[var(--fg)]/[0.06]">
          <div
            className="h-full origin-left bg-[var(--color-signal)]/80 transition-transform duration-100 ease-linear"
            style={{ transform: `scaleX(${Math.min(1, elapsed / total)})`, opacity: paused ? 0.4 : 1 }}
          />
        </div>
      </motion.div>
    </>
  );
}
