import { useCallback, useEffect, useRef, useState } from "react";
import { api, apiUrl, type Batch, type Claim, type Conflict, type Decision, type FeedItem, type Snapshot } from "./api";

export type LiveStatus = "loading" | "live" | "reconnecting" | "replay" | "offline";

/** A conflict the canvas should animate, stamped so the same one never replays. */
export interface Hit {
  id: number;
  conflict: Conflict;
  /** Show the path without the impact ripple (e.g. state restored on load). */
  quiet?: boolean;
}

/**
 * Everything the dashboard shows, kept fresh: the snapshot and lists are refetched
 * when an event that changes them arrives over SSE (`/api/events`).
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- withBatches is wired by the live-data package
export function useLive(opts: { withBatches?: boolean } = {}) {
  const [graph, setGraph] = useState<Snapshot | null>(null);
  const [claims, setClaims] = useState<Claim[]>([]);
  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [events, setEvents] = useState<FeedItem[]>([]);
  const [status, setStatus] = useState<LiveStatus>("loading");
  const [graphName, setGraphName] = useState("");
  const [hit, setHit] = useState<Hit | null>(null);
  const [rate, setRate] = useState<{ time: number; value: number }[]>([]);
  const counter = useRef(0);

  const refresh = useCallback(async () => {
    const [g, c, d, b] = await Promise.all([api.graph(), api.claims(), api.decisions(), api.batches()]);
    setGraph(g);
    setClaims(c);
    setDecisions(d);
    setBatches(b);
  }, []);

  useEffect(() => {
    let es: EventSource | null = null;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const loadedAt = Date.now();
    // Coalesce bursts of events into one refetch.
    const scheduleRefresh = () => {
      if (timer) return;
      timer = setTimeout(() => {
        timer = undefined;
        void refresh().catch(() => undefined);
      }, 250);
    };

    let lastSeq = 0;
    let poll: ReturnType<typeof setInterval> | undefined;
    const onItem = (item: FeedItem) => {
      lastSeq = Math.max(lastSeq, item.seq);
      // The stream replays history first; only new events animate or trigger refetches.
      const fresh = item.at >= loadedAt - 2000;
      if (fresh) counter.current += 1;
      setEvents((prev) => (prev.some((p) => p.seq === item.seq) ? prev : [item, ...prev].slice(0, 200)));
      if (!fresh) return;
      if (item.kind === "conflict" || item.kind === "collision") {
        const c = (item.payload as { conflicts?: Conflict[] } | null)?.conflicts?.[0];
        if (c) setHit({ id: item.seq, conflict: c });
      }
      if (["claim", "release", "conflict", "decision", "edit", "register", "collision", "lesson", "handoff"].includes(item.kind)) {
        scheduleRefresh();
      }
    };

    // Some proxies (Cloudflare quick tunnels) hold SSE back; if the replay never arrives, poll instead.
    const startPolling = () => {
      es?.close();
      setStatus("live");
      poll = setInterval(() => {
        api
          .feed(lastSeq)
          .then((items) => items.forEach(onItem))
          .catch(() => setStatus("reconnecting"));
      }, 2000);
    };

    const open = (last: number) => {
      es = new EventSource(apiUrl(`/api/events?last=${last}`));
      let heard = false;
      const watchdog = setTimeout(() => !heard && !cancelled && startPolling(), 4000);
      es.onopen = () => setStatus("live");
      es.onerror = () => setStatus("reconnecting");
      es.addEventListener("event", (ev) => {
        heard = true;
        clearTimeout(watchdog);
        onItem(JSON.parse((ev as MessageEvent).data) as FeedItem);
      });
    };

    (async () => {
      try {
        const h = await api.health();
        if (cancelled) return;
        setGraphName(h.graph);
        await refresh();
        if (!cancelled) open(0);
      } catch {
        if (!cancelled) setStatus("offline");
      }
    })();

    // Events per 5 seconds, for the live activity chart.
    const tick = setInterval(() => {
      setRate((r) => [...r, { time: Date.now(), value: counter.current }].slice(-40));
      counter.current = 0;
    }, 5000);

    return () => {
      cancelled = true;
      es?.close();
      clearInterval(tick);
      if (poll) clearInterval(poll);
      if (timer) clearTimeout(timer);
    };
  }, [refresh]);

  // Contract placeholders; the live-data package fills these in.
  const retry = useCallback(() => undefined, []);
  const replayAt: string | null = null;
  const seqAtLoad = 0;

  return { graph, claims, decisions, batches, events, status, graphName, hit, rate, refresh, retry, replayAt, seqAtLoad };
}
