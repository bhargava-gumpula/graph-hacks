import { useCallback, useEffect, useRef, useState } from "react";
import { api, apiUrl, loadReplay, replay, type Batch, type Claim, type Conflict, type Decision, type FeedItem, type Snapshot } from "./api";

export type LiveStatus = "loading" | "live" | "reconnecting" | "replay" | "offline";

/** A conflict the canvas should animate, stamped so the same one never replays. */
export interface Hit {
  id: number;
  conflict: Conflict;
  /** Show the path without the impact ripple (e.g. state restored on load). */
  quiet?: boolean;
}

/** Event kinds that change the snapshot or the lists, so they trigger a (coalesced) refetch. */
const CHANGES = new Set(["claim", "release", "conflict", "decision", "edit", "register", "collision", "lesson", "handoff"]);
const HISTORY = 40; // events of history to show on connect
const BEAT_MS = 600; // one fresh event per beat, so a burst reads as a story
const RECONNECT_MS = 3000;
const HEALTH_POLL_MS = 10_000; // while in replay or offline
const SSE_SILENT_MS = 4000;
const FEED_POLL_MS = 2000;

const conflictOf = (item: FeedItem) =>
  item.kind === "conflict" || item.kind === "collision"
    ? (item.payload as { conflicts?: Conflict[] } | null)?.conflicts?.[0]
    : undefined;

/**
 * Everything the dashboard shows, kept fresh over SSE (`/api/events`), or over `/api/feed` polling when a
 * proxy buffers SSE. When the API is down it serves the recorded run in public/replay.json (status 'replay')
 * and checks health every 10 s to come back.
 */
export function useLive(opts: { withBatches?: boolean } = {}) {
  // A ref, so toggling batches doesn't give `refresh` a new identity and restart the stream.
  const withBatches = useRef(false);
  withBatches.current = !!opts.withBatches;
  const [graph, setGraph] = useState<Snapshot | null>(null);
  const [claims, setClaims] = useState<Claim[]>([]);
  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [events, setEvents] = useState<FeedItem[]>([]);
  const [status, setStatus] = useState<LiveStatus>("loading");
  const [graphName, setGraphName] = useState("");
  const [hit, setHit] = useState<Hit | null>(null);
  const [replayAt, setReplayAt] = useState<string | null>(null);
  const [seqAtLoad, setSeqAtLoad] = useState(0);
  const retryRef = useRef<() => void>(() => undefined);
  const flushRef = useRef<(upTo: number) => Promise<void>>(async () => undefined);

  // Each call keeps its last good value when it fails: one 429 must not blank the canvas.
  const refresh = useCallback(async () => {
    await Promise.allSettled([
      api.graph().then(setGraph),
      api.claims().then(setClaims),
      api.decisions().then(setDecisions),
      withBatches.current ? api.batches().then(setBatches) : undefined,
    ]);
  }, []);

  useEffect(() => {
    let cancelled = false;
    let es: EventSource | null = null;
    let polling = false; // sticky: once SSE proved silent, reconnects poll too
    let session = false; // a live session is running (false on first load and in replay)
    let inReplay = false;
    let lastSeq = 0;
    let loadSeq = 0; // events up to here are history: listed, never animated
    let freshHit = false;
    let fastUntil = 0; // fresh events up to here skip the beat (see flush)
    let quiet: Hit | null = null;
    const queue: FeedItem[] = [];
    let refetch: ReturnType<typeof setTimeout> | undefined;
    let watchdog: ReturnType<typeof setTimeout> | undefined;
    let wait: ReturnType<typeof setTimeout> | undefined;
    let quietTimer: ReturnType<typeof setTimeout> | undefined;
    let poll: ReturnType<typeof setInterval> | undefined;
    let beat: ReturnType<typeof setInterval> | undefined;

    const scheduleRefresh = () => {
      if (refetch) return;
      refetch = setTimeout(() => {
        refetch = undefined;
        void refresh();
      }, 250);
    };

    const list = (item: FeedItem) => setEvents((prev) => [item, ...prev].slice(0, 200));

    const apply = (item: FeedItem) => {
      list(item);
      const c = conflictOf(item);
      if (c) {
        freshHit = true;
        setHit({ id: item.seq, conflict: c });
      }
    };

    // Fresh events play one per beat (immediately under reduced motion).
    const pace = (item: FeedItem) => {
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return apply(item);
      queue.push(item);
      if (beat) return;
      const next = () => {
        const i = queue.shift();
        if (i) return apply(i);
        clearInterval(beat);
        beat = undefined;
      };
      next();
      beat = setInterval(next, BEAT_MS);
    };

    const onItem = (item: FeedItem) => {
      // Items arrive in seq order; this also drops overlapping polls.
      if (cancelled || item.seq <= lastSeq) return;
      lastSeq = item.seq;
      // Freshness is by seq, not by clock: the server's and the viewer's clocks differ.
      if (item.seq > loadSeq) {
        // Refetch on arrival, so a burst costs one refetch however slowly its beats play.
        if (CHANGES.has(item.kind)) scheduleRefresh();
        return item.seq <= fastUntil ? apply(item) : pace(item);
      }
      list(item);
      // After the history burst, show the newest conflict's path (quietly) unless a fresh one played.
      const c = conflictOf(item);
      if (c) quiet = { id: item.seq, conflict: c, quiet: true };
      clearTimeout(quietTimer);
      quietTimer = setTimeout(() => !freshHit && quiet && setHit(quiet), 250);
    };

    const begin = (seq: number) => {
      loadSeq = seq;
      setSeqAtLoad(seq);
      freshHit = false;
      quiet = null;
      queue.length = 0;
      setEvents([]);
    };

    const stop = () => {
      es?.close();
      es = null;
      clearTimeout(watchdog);
      clearInterval(poll);
      poll = undefined;
    };

    // The stream or a poll failed. EventSource never retries an HTTP error such as Cloudflare's 530,
    // so reconnect ourselves: wait, check health, reopen from lastSeq.
    const lost = () => {
      if (cancelled) return;
      stop();
      setStatus("reconnecting");
      clearTimeout(wait);
      wait = setTimeout(connect, RECONNECT_MS);
    };

    const startPolling = () => {
      const id = setInterval(() => {
        api
          .feed(lastSeq)
          .then((items) => {
            if (cancelled || poll !== id) return;
            setStatus("live");
            items.forEach(onItem);
          })
          .catch(() => poll === id && lost()); // ignore a late failure from a stopped poll
      }, FEED_POLL_MS);
      poll = id;
    };

    const open = () => {
      stop();
      if (polling) return startPolling();
      const src = new EventSource(apiUrl(`/api/events?last=${lastSeq}`));
      es = src;
      // Some proxies (Cloudflare quick tunnels) hold SSE back. After 4 s of silence, ask /api/feed:
      // if it has events the stream never delivered, switch to polling for good; else it was just quiet.
      const arm = () => {
        clearTimeout(watchdog);
        watchdog = setTimeout(() => {
          api
            .feed(lastSeq)
            .then((items) => {
              if (es !== src) return;
              if (items.length === 0) return arm();
              polling = true;
              open();
            })
            .catch(() => es === src && lost());
        }, SSE_SILENT_MS);
      };
      arm();
      src.onopen = () => setStatus("live");
      src.onerror = lost;
      src.addEventListener("event", (ev) => {
        arm();
        onItem(JSON.parse((ev as MessageEvent).data) as FeedItem);
      });
    };

    const enterReplay = async () => {
      stop();
      session = false;
      if (!inReplay) {
        try {
          const r = await loadReplay();
          if (cancelled) return;
          inReplay = true;
          replay.data = r;
          begin(Math.max(0, ...r.events.map((e) => e.seq)));
          lastSeq = 0;
          setReplayAt(r.capturedAt);
          setGraphName(""); // the recording is not the live graph
          setStatus("replay");
          await refresh();
          r.events.forEach(onItem);
        } catch {
          if (!cancelled) setStatus("offline");
        }
      }
      if (!cancelled) wait = setTimeout(connect, HEALTH_POLL_MS);
    };

    /** Health decides the mode: the live stream when the API answers, the recorded run when it does not. */
    async function connect() {
      clearTimeout(wait);
      const h = await api.health().catch(() => null);
      if (cancelled) return;
      if (!h) return enterReplay();
      if (!session) {
        // First load, or back from the replay: start over at the server's seq.
        session = true;
        inReplay = false;
        replay.data = null;
        setReplayAt(null);
        setGraphName(h.graph);
        const seq = h.seq ?? 0;
        begin(seq);
        lastSeq = Math.max(0, seq - HISTORY);
      }
      void refresh();
      open();
    }

    replay.emit = (item) => onItem({ ...item, seq: lastSeq + 1 });
    retryRef.current = () => void connect();
    flushRef.current = async (upTo) => {
      fastUntil = upTo;
      while (queue.length && queue[0].seq <= upTo) apply(queue.shift()!);
      // Fetch what the stream has not delivered yet, so the caller sees every event up to upTo on return.
      if (lastSeq < upTo && !inReplay) await api.feed(lastSeq).then((items) => items.forEach(onItem), () => undefined);
    };
    void connect();

    return () => {
      cancelled = true;
      stop();
      clearTimeout(refetch);
      clearTimeout(wait);
      clearTimeout(quietTimer);
      clearInterval(beat);
      replay.emit = () => undefined;
      replay.data = null;
      retryRef.current = () => undefined;
      flushRef.current = async () => undefined;
    };
  }, [refresh]);

  /** Check health now instead of waiting for the next poll. */
  const retry = useCallback(() => retryRef.current(), []);
  /**
   * Show fresh events up to seq `upTo` at once instead of one per beat: those already queued, and those
   * that arrive later. Resolves once they are all applied.
   */
  const flush = useCallback((upTo: number) => flushRef.current(upTo), []);

  return { graph, claims, decisions, batches, events, status, graphName, hit, refresh, retry, flush, replayAt, seqAtLoad };
}
