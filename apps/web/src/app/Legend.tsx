import { useEffect, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";

const EASE_OUT = [0.23, 1, 0.32, 1] as const;

/** Each glyph is drawn the way the canvas draws it, so the key matches what's on screen. */
const ROWS: { glyph: ReactNode; label: string }[] = [
  { glyph: <circle cx="12" cy="8" r="3.25" fill="var(--fg)" fillOpacity={0.6} />, label: "File" },
  { glyph: <path d="M2 12 C 10 12, 14 4, 22 4" fill="none" stroke="var(--fg)" strokeOpacity={0.5} />, label: "Import" },
  {
    glyph: (
      <>
        <circle cx="12" cy="8" r="6" fill="none" stroke="var(--fg)" strokeWidth={1.5} />
        <circle cx="12" cy="8" r="2.5" fill="var(--fg)" />
      </>
    ),
    label: "Claim, with the agent's letter",
  },
  { glyph: <path d="M2 12 C 10 12, 14 4, 22 4" fill="none" stroke="var(--color-signal)" strokeWidth={2.5} strokeLinecap="round" />, label: "Refused route" },
  { glyph: <circle cx="12" cy="8" r="6" fill="var(--fg)" fillOpacity={0.3} />, label: "Parallel group (tint)" },
];

/** A small collapsible key for the canvas. It opens above its button, from the corner it sits in. */
export function Legend() {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    const onDown = (e: PointerEvent) => !wrap.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onDown);
    };
  }, [open]);
  return (
    <div ref={wrap} className="relative">
      <button
        type="button"
        aria-expanded={open}
        aria-controls="graph-key"
        onClick={() => setOpen((o) => !o)}
        className={`touch-manipulation rounded-full px-2.5 py-1.5 text-xs transition-[color,background-color,transform] duration-150 hover:bg-[var(--fg)]/[0.06] hover:text-[var(--fg)] active:scale-95 pointer-coarse:py-2.5 ${
          open ? "bg-[var(--fg)]/[0.08] text-[var(--fg)]" : "text-[var(--muted)]"
        }`}
      >
        Key
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            id="graph-key"
            role="region"
            aria-label="Graph key"
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1, transition: { duration: 0.18, ease: EASE_OUT } }}
            exit={{ opacity: 0, scale: 0.96, transition: { duration: 0.12, ease: EASE_OUT } }}
            className="absolute bottom-full right-0 mb-2.5 w-56 origin-bottom-right rounded-[var(--radius-panel)] border border-[var(--border)] bg-[var(--surface)]/95 p-3 shadow-xl shadow-black/30 backdrop-blur"
          >
            <ul className="grid gap-2">
              {ROWS.map((r) => (
                <li key={r.label} className="flex items-center gap-2.5 text-xs text-[var(--fg)]/85">
                  <svg width="24" height="16" viewBox="0 0 24 16" aria-hidden className="shrink-0">
                    {r.glyph}
                  </svg>
                  {r.label}
                </li>
              ))}
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
