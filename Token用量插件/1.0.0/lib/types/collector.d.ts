/**
 * Usage collector: turns the session event stream into atomic usage samples.
 * Two sources feed the same fold:
 *
 * - live: `session/event` subscription — every committed session event
 *   reaches this plugin after the fact. `assistant/message` carries the
 *   step's final `usage` (TokenUsage); `assistant/chunk` carries an early
 *   `usage` sample from the streaming adapter; `request/context` carries the
 *   provider/model route. A completed call's usage is attributed to the model
 *   the request used — in priority order: the message's own `source`
 *   (authoritative per call), then the session's last-known route, which
 *   comes from observed `request/context` events OR is lazily seeded from
 *   the live Session's `requestContext()` fold. That seed matters because
 *   `request/context` only lands in the log on route CHANGES: a session that
 *   predates this collector would otherwise attribute nothing. Both the fold
 *   bucket and the route are keyed by the session id carried by every
 *   callback, so concurrent sessions never share dedupe state or attribution.
 * - backfill: on first boot (when the domain is empty) the collector
 *   enumerates every persisted session (`sessionPersistence.list()`) and
 *   replays its event log (`inspect(id)`) through a FRESH per-session
 *   fold, so historical usage is accounted from the day the plugin is
 *   installed. Sessions the live listener already touched replay only their
 *   pre-observation PREFIX (see markLiveSession) — recovering history the
 *   live path never saw without double counting what it did. A forked
 *   child's stored log begins with the events it copied from its parent;
 *   the host always reports that cut (`inheritedEventCount`, DSH
 *   >= 0.1.2-rc.1, 0 for a non-forked session), and the replay skips it —
 *   the parent's own backfill already counted those events.
 *
 * Idempotence: within ONE session, the same (turn, step) may report usage
 * more than once (a streaming sample then the final assistant/message;
 * compaction replays). The fold emits each (turn, step) key exactly once and
 * keeps the newest values in its own state — see the replaceSample note for
 * why the store observably keeps the FIRST emission. Cross-session
 * (turn, step) collisions are NOT deduped: two sessions both own a turn 1 /
 * step 1, and each must count. The store's per-day rows accumulate, so
 * re-folding the same log must not add twice: live events are only folded
 * once per event, and every session the live listener touches is written
 * into the durable backfill cursor with its first observed seq, so a later
 * boot's backfill never re-processes what the live path already recorded.
 */
import type { Context } from './context-types.ts';
import type { UsageSessionEvent, UsageSessionPersistence, UsageSessionStore } from './context-types.ts';
import type { UsageStore } from './store.ts';
import type { UsageSample } from './query.ts';
export interface CollectorOptions {
    /** The source label recorded with every sample (matches the reasonix Source). */
    source?: string;
    /** Backfill concurrency (default 4, matching session-query-sqlite). */
    backfillConcurrency?: number;
}
export interface CollectorStatus {
    running: boolean;
    total: number;
    done: number;
    scannedSessions: number;
    lastSessionId?: string;
    error?: string;
    /** Store operations this generation refused (degraded domain, write
     *  failure, ...): live samples AND durable cursor writes. Recording is
     *  observational and must never take the host down, so failures are
     *  counted here instead of escaping as rejections. */
    recordFailures: number;
}
/**
 * One in-memory fold state for ONE session: tracks the newest usage sample
 * per (turn, step) so a replayed log or a streaming-then-final pair never
 * double counts. The store is the durable side; this fold dedupes within a
 * single event pass (a session replay).
 */
export declare class UsageFold {
    private seen;
    private keyOf;
    /** Fold one event. Returns the sample to persist, or null when the event
     *  carries no (new) usage or turn marker. */
    fold(ev: UsageSessionEvent): UsageSample | null;
    private replaceSample;
}
/**
 * The collector: subscribes to live events and runs the one-time backfill.
 * Samples are folded into the durable store; per-session folds keep
 * replayed/duplicate reports from double counting without ever swallowing a
 * concurrent session's samples.
 */
export declare class UsageCollector {
    private ctx;
    private store;
    private options;
    readonly status: CollectorStatus;
    /** One fold bucket per live session id: (turn, step) dedupe keys are
     *  session-scoped, so concurrent sessions never collide. */
    private folds;
    /** Per-session last-seen request route ("provider/model" or bare model).
     *  `request/context` only logs on route CHANGES, so each session carries
     *  its own last-known route for attributing subsequent usage samples. */
    private routes;
    private started;
    /** Live session ids already written (or queued) into the backfill cursor
     *  this boot — one entry per session, not per event. */
    private liveMarked;
    /** Coalescing buffer for cursor writes: a burst of first events flushes as
     *  one markLiveSequences call instead of one global rewrite per session.
     *  Value = the first observed seq (-1 sentinel when unknown). */
    private liveMarkBuffer;
    private liveMarkFlushScheduled;
    constructor(ctx: Context, store: UsageStore, options?: CollectorOptions);
    /** Extract a stable session id from a callback's session argument. */
    private static sessionIdOf;
    /** Canonical "provider/model" (or bare model) ref from a route shape. */
    private static refOf;
    /** The session's own route fold, read through the live Session object.
     *  `request/context` only lands in the log on route CHANGES, so a session
     *  that predates this collector (host restart, plugin reload) would never
     *  re-announce its route — the authoritative per-session fold is the only
     *  way to attribute such sessions instead of dropping their usage into
     *  "(unknown)". */
    private routeFor;
    private foldFor;
    /** Write a live session into the durable backfill cursor (coalesced per
     *  tick) together with the seq of its FIRST observed event. This is the
     *  restart-safety invariant, upgraded: `SessionStore.list()` only reports
     *  LIVE sessions, and the first-observed seq partitions the persisted log
     *  into [0, firstSeq) — which no live pass ever folded, so the next boot's
     *  backfill replays exactly that prefix to recover pre-attach history —
     *  and [firstSeq, ∞), which the live path owns. The sentinel -1 records
     *  "observed with an unknown boundary" and replays nothing (never risk a
     *  duplicate). */
    private markLiveSession;
    /** Attach the live listeners (call once from apply). */
    start(): void;
    /** Whether a backfill is in progress or was completed. */
    get running(): boolean;
    /** Run the one-time backfill: enumerate persisted sessions and replay each
     *  through its own fold. Idempotent — the cursor partitions every session's
     *  log exactly once across boots and live passes:
     *  - a session NOT in backfilledSessions replays up to its cursor boundary:
     *    FULLY when none is recorded (no live pass ever folded this log), only
     *    the PREFIX [0, boundary) when one is — including a STILL-LIVE session,
     *    whose post-boundary events the live path owns (a /reset watermark uses
     *    the same shape: everything below the wipe-time log length must be
     *    rebuilt from the log because the wipe destroyed it);
     *  - whatever the boundary, a fork-inherited prefix reported by the host
     *    (SessionInspection.inheritedEventCount, DSH >= 0.1.2-rc.1) is skipped:
     *    the child copied those events from its parent, whose own backfill
     *    already counted them;
     *  - a session already in backfilledSessions is NEVER replayed again: it
     *    lands there only after a clean replay of its full replayable range,
     *    so re-selecting it would double that range on every later boot;
     *  - a live session without a usable boundary is skipped (its events are
     *    owned by this boot's live pass — or it resumed mid-scan and our
     *    boundary snapshot is stale; stale absence must never widen a replay).
     *  Resolves early (mid-scan) when `signal` aborts — the fiber teardown
     *  path uses this so disposal does not leave a fire-and-forget scan
     *  writing behind it. */
    backfill(persistence: UsageSessionPersistence, sessions: UsageSessionStore, signal?: AbortSignal): Promise<void>;
}
