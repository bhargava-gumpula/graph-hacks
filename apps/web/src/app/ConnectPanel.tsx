import { useEffect, useRef, useState, type RefObject } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowSquareOut, Check, Copy, X } from "@phosphor-icons/react";

/**
 * Every install command and the Cursor MCP config, in one place. Change them here when the
 * marketplace, the npm package or the repo moves; the panel and the Cursor link follow.
 */
export const CONNECT = {
  claude: {
    label: "Claude Code",
    steps: [
      { label: "Add the marketplace", cmd: "/plugin marketplace add bhargava-gumpula/graph-hacks" },
      { label: "Install the plugin", cmd: "/plugin install switchboard@graph-hacks" },
    ],
    note: "Type both in Claude Code. The plugin brings the hooks and the MCP server.",
  },
  cursor: {
    label: "Cursor",
    mcp: { name: "switchboard", config: { command: "npx", args: ["-y", "switchboard-agents", "mcp"] } },
    steps: [{ label: "Then wire the hooks in your repo", cmd: "npx switchboard-agents init --cursor" }],
    note: "The button adds the MCP server. The command adds the hooks that claim and refuse edits.",
  },
  source: {
    label: "From source",
    steps: [
      { label: "Clone the repo", cmd: "git clone https://github.com/bhargava-gumpula/graph-hacks && cd graph-hacks" },
      { label: "Run the demo locally", cmd: "npm run quickstart" },
      { label: "Wire another repo", cmd: "npm run switchboard -- init ~/code/my-app" },
    ],
    note: "Needs Node 22, Docker and jq. Each repo gets its own graph and port.",
  },
} as const;

type Section = keyof typeof CONNECT;
const SECTIONS = Object.keys(CONNECT) as Section[];

/** Cursor's MCP install link: the server config (without its name), JSON then base64. */
export function cursorDeeplink(mcp: { name: string; config: unknown } = CONNECT.cursor.mcp): string {
  return `cursor://anysphere.cursor-deeplink/mcp/install?name=${encodeURIComponent(mcp.name)}&config=${encodeURIComponent(btoa(JSON.stringify(mcp.config)))}`;
}

const EASE_OUT = [0.23, 1, 0.32, 1] as const;
const FOCUSABLE = "button:not([disabled]), a[href], [tabindex]:not([tabindex='-1'])";

/**
 * A native modal <dialog>: the page behind is inert, Escape closes it, Tab wraps inside,
 * and focus goes back to the header button.
 */
export function ConnectPanel({ trigger, onClose }: { trigger: RefObject<HTMLButtonElement>; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [tab, setTab] = useState<Section>("claude");
  const [said, setSaid] = useState("");

  useEffect(() => {
    const d = dialog.current;
    if (d && !d.open) d.showModal();
    d?.querySelector<HTMLElement>("[role=tab][aria-selected=true]")?.focus();
    const btn = trigger.current;
    return () => btn?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const section = CONNECT[tab];
  return (
    <dialog
      ref={dialog}
      aria-labelledby="connect-title"
      // Escape: keep the dialog open so the exit animation can play, then unmount it.
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      // A close the page could not cancel (Chrome skips cancel on a repeated Escape).
      onClose={onClose}
      onKeyDown={(e) => {
        if (e.key !== "Tab") return;
        const f = [...e.currentTarget.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => el.offsetParent !== null);
        const at = f.indexOf(document.activeElement as HTMLElement);
        if (e.shiftKey && at <= 0) (e.preventDefault(), f[f.length - 1]?.focus());
        else if (!e.shiftKey && at === f.length - 1) (e.preventDefault(), f[0]?.focus());
      }}
      className="fixed inset-0 m-0 grid h-full max-h-none w-full max-w-none place-items-end overflow-hidden bg-transparent p-0 text-[var(--fg)] backdrop:bg-transparent sm:place-items-center"
    >
      <motion.div
        aria-hidden
        onClick={onClose}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1, transition: { duration: 0.2, ease: EASE_OUT } }}
        exit={{ opacity: 0, transition: { duration: 0.15, ease: EASE_OUT } }}
        className="absolute inset-0 bg-black/55"
      />
      <motion.div
        initial={{ opacity: 0, y: 16, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1, transition: { duration: 0.24, ease: EASE_OUT } }}
        exit={{ opacity: 0, y: 10, scale: 0.98, transition: { duration: 0.15, ease: EASE_OUT } }}
        className="relative max-h-[88dvh] w-full overflow-y-auto overscroll-contain rounded-t-[14px] border border-[var(--border)] bg-[var(--surface)] p-5 shadow-2xl shadow-black/50 sm:max-w-[540px] sm:rounded-[var(--radius-panel)]"
      >
        <div className="flex items-start justify-between gap-4">
          <h2 id="connect-title" className="text-base font-medium tracking-tight">
            Connect your agent
          </h2>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="-mr-1.5 -mt-1 grid size-8 touch-manipulation place-items-center rounded-full text-[var(--muted)] transition-[color,transform] duration-150 hover:text-[var(--fg)] active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-[var(--color-signal)]"
          >
            <X size={16} />
          </button>
        </div>
        <p className="mt-1.5 max-w-[60ch] text-[13px] leading-relaxed text-[var(--muted)]">
          The hooks brief your agent when a session starts, claim each file before it is edited, refuse an edit that reaches another agent's file
          with the import path, and release its claims at the end.
        </p>

        <div
          role="tablist"
          aria-label="Your editor"
          className="mt-4 flex gap-1 rounded-full border border-[var(--border)] bg-[var(--bg)] p-1"
          onKeyDown={(e) => {
            const i = SECTIONS.indexOf(tab);
            const n = SECTIONS.length;
            const next = e.key === "ArrowRight" ? (i + 1) % n : e.key === "ArrowLeft" ? (i - 1 + n) % n : e.key === "Home" ? 0 : e.key === "End" ? n - 1 : -1;
            if (next < 0) return;
            e.preventDefault();
            setTab(SECTIONS[next]);
            document.getElementById(`connect-tab-${SECTIONS[next]}`)?.focus();
          }}
        >
          {SECTIONS.map((id) => (
            <button
              key={id}
              id={`connect-tab-${id}`}
              type="button"
              role="tab"
              aria-selected={tab === id}
              aria-controls="connect-panel"
              tabIndex={tab === id ? 0 : -1}
              onClick={() => setTab(id)}
              className="relative flex-1 touch-manipulation rounded-full px-2 py-1.5 text-xs transition-colors focus-visible:outline-2 focus-visible:outline-[var(--color-signal)] pointer-coarse:py-2.5"
            >
              {tab === id && <motion.span layoutId="connect-tab" className="absolute inset-0 rounded-full bg-[var(--fg)]/10" transition={{ type: "spring", stiffness: 400, damping: 32 }} />}
              <span className={`relative ${tab === id ? "text-[var(--fg)]" : "text-[var(--muted)] hover:text-[var(--fg)]"}`}>{CONNECT[id].label}</span>
            </button>
          ))}
        </div>

        <div id="connect-panel" role="tabpanel" aria-labelledby={`connect-tab-${tab}`} className="mt-4 grid gap-3">
          {tab === "cursor" && (
            <div className="grid gap-1.5">
              <a
                href={cursorDeeplink()}
                className="inline-flex h-9 touch-manipulation items-center justify-center gap-1.5 justify-self-start rounded-full bg-[var(--color-signal)] px-4 text-sm font-medium text-[#1a0d08] transition-[filter,transform] duration-150 hover:brightness-110 active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--fg)]"
              >
                Add to Cursor <ArrowSquareOut size={14} />
              </a>
            </div>
          )}
          {section.steps.map((s) => (
            <Command key={s.cmd} label={s.label} cmd={s.cmd} onCopied={setSaid} />
          ))}
          <p className="text-xs leading-relaxed text-[var(--muted)]">{section.note}</p>
        </div>
        <p aria-live="polite" className="sr-only">
          {said}
        </p>
      </motion.div>
    </dialog>
  );
}

function Command({ label, cmd, onCopied }: { label: string; cmd: string; onCopied: (msg: string) => void }) {
  const [done, setDone] = useState(false);
  const code = useRef<HTMLElement>(null);
  const timer = useRef<number>();
  useEffect(() => () => clearTimeout(timer.current), []);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(cmd);
    } catch {
      // No clipboard (an http page that is not localhost): select the text so Cmd+C works.
      const range = document.createRange();
      if (code.current) range.selectNodeContents(code.current);
      window.getSelection()?.removeAllRanges();
      window.getSelection()?.addRange(range);
      onCopied("Selected. Press Command C to copy.");
      return;
    }
    setDone(true);
    onCopied(`Copied: ${cmd}`);
    clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setDone(false), 1600);
  };
  return (
    <div className="grid gap-1.5">
      <span className="text-xs text-[var(--muted)]">{label}</span>
      <div className="flex items-center gap-2 rounded-md border border-[var(--border)] bg-[var(--bg)] py-1 pl-3 pr-1">
        <code ref={code} className="min-w-0 flex-1 py-1 font-mono text-[12.5px] leading-relaxed [overflow-wrap:anywhere]">
          {cmd}
        </code>
        <button
          type="button"
          onClick={copy}
          aria-label={`Copy: ${cmd}`}
          className="relative grid size-8 shrink-0 touch-manipulation place-items-center rounded-md text-[var(--muted)] transition-[color,transform] duration-150 hover:text-[var(--fg)] active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-[var(--color-signal)] pointer-coarse:size-10"
        >
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.span
              key={done ? "done" : "copy"}
              initial={{ opacity: 0, scale: 0.8, filter: "blur(2px)" }}
              animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
              exit={{ opacity: 0, scale: 0.8, filter: "blur(2px)" }}
              transition={{ duration: 0.15, ease: EASE_OUT }}
              className={done ? "text-[var(--signal-text)]" : undefined}
            >
              {done ? <Check size={15} weight="bold" /> : <Copy size={15} />}
            </motion.span>
          </AnimatePresence>
        </button>
      </div>
    </div>
  );
}
