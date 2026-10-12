/**
 * The usage-history durable store. Records accumulate into one storage
 * domain (`usage_history`, single table `days`) keyed
 * `YYYY-MM-DD|provider|model` with the four token buckets plus per-day
 * counters (requests, turns) and the uncached-input cache-miss side. Writes
 * go through `KvTable.update()` (atomic read-modify-write queued per key), so
 * concurrent turns never interleave. The backend persists the domain to
 * `$DSH_HOME/storages/usage_history.json` (storage-json).
 *
 * The layout mirrors the reasonix daily-JSONL design (one row per day ×
 * model) with the aggregation moved into the storage layer: a query reads
 * the table entries intersecting the range instead of decoding per-day files.
 */
import type { UsageStorageDomain } from './context-types.ts';
import type { UsageSample } from './query.ts';
import { z } from 'zod';
/** One row: a model's usage on one local calendar day. */
export interface UsageDayRow {
    day: string;
    provider: string;
    model: string;
    inputTokens: number;
    outputTokens: number;
    cacheReadTokens: number;
    cacheWriteTokens: number;
    requests: number;
    turns: number;
    lastSeen: number;
}
export declare const usageDayRowSchema: z.ZodObject<{
    day: z.ZodString;
    provider: z.ZodString;
    model: z.ZodString;
    inputTokens: z.ZodNumber;
    outputTokens: z.ZodNumber;
    cacheReadTokens: z.ZodNumber;
    cacheWriteTokens: z.ZodNumber;
    requests: z.ZodNumber;
    turns: z.ZodNumber;
    lastSeen: z.ZodNumber;
}, z.core.$strip>;
/** The domain's global singleton: the backfill cursor. Session ids already
 *  replayed into the store live here, so a reboot's backfill only folds
 *  sessions it has never seen (a full replay would double every counter —
 *  the fold's replace semantics only dedupe within one pass).
 *
 *  `liveFirstSeq` records, per session, the EXCLUSIVE END of the range a
 *  backfill may replay: [0, value) is backfill-owned, [value, ∞) is
 *  live-path-owned. It is written at two moments — when the live listener
 *  first observes a session (that first event's seq, or -1 when the boundary
 *  was unknown), and by /reset (the session's wipe-time log length, because
 *  the wipe destroyed everything below it and the rebuild must reconstruct
 *  exactly that span from the log). The next boot's backfill replays exactly
 *  the prefix before the boundary. */
export declare const usageHistoryDomain: {
    name: string;
    version: number;
    global: {
        schema: z.ZodObject<{
            backfilledSessions: z.ZodArray<z.ZodString>;
            liveFirstSeq: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodNumber>>;
        }, z.core.$strip>;
        initial: {
            backfilledSessions: string[];
            liveFirstSeq: {};
        };
    };
    tables: {
        days: import("@deepseek-ai/dsh-storage-domain").DomainTableSpec<string, UsageDayRow>;
    };
};
/** key: `day|provider|model`. */
export declare function dayRowKey(day: string, provider: string, model: string): string;
export declare class UsageStore {
    private table;
    private domainHandle;
    private ready;
    /** Set when the domain could not be opened (already-open race, corrupted
     *  file, ...). The store then runs DEGRADED: every operation fails
     *  per-call with a clear error and nothing persists, but no rejecting
     *  promise is ever left unobserved — an escaping rejection here used to
     *  be able to take the whole host down. */
    private openError?;
    /** Serializes read-modify-write cycles on the backfill cursor. The domain
     *  only guarantees single-write ordering on its chain — a global.set is a
     *  whole-value overwrite, so two concurrent markSeenSessions calls would
     *  interleave get→set and lose one caller's ids (lost update). Chaining
     *  through this promise makes every get→set pair atomic within the
     *  process, which is the only concurrency that exists here. */
    private markChain;
    constructor(ctx: UsageStorageDomain);
    private initialize;
    /** The open failure when running degraded, else undefined (diagnostics). */
    get degradation(): unknown;
    /** Session ids already replayed into the store (the backfill cursor).
     *  A medium without a global (pre-cursor rows) yields an empty set, which
     *  would replay everything once — acceptable only for a fresh install, so
     *  callers pairing this with markSeenSessions still converge after one
     *  pass. */
    seenSessions(): Promise<Set<string>>;
    /** Per-session seq of the first LIVE-observed event (see the domain's
     *  `liveFirstSeq` doc). -1 = observed with an unknown boundary. */
    liveSequences(): Promise<Map<string, number>>;
    private cursor;
    /** The cursor value for a read-modify-write cycle. Degraded stores fail
     *  here too: the cursor-writing methods must honor the same per-call
     *  failure contract as record() — silently succeeding while persisting
     *  nothing would make callers believe a replay boundary was durable. */
    private requireCursor;
    /** Persist session ids as replayed (merges into the cursor). Calls are
     *  serialized through {@link markChain} so concurrent workers never lose
     *  each other's ids in a get→set interleaving. */
    markSeenSessions(ids: Iterable<string>): Promise<void>;
    /** Record the first LIVE-observed seq per session (merges; the EARLIEST
     *  boundary wins — it is the safe partition point for prefix replays).
     *  Serialized through {@link markChain} like every other global rewrite. */
    markLiveSequences(entries: Iterable<readonly [string, number]>): Promise<void>;
    /** Drop every row and the whole cursor, re-bounding each named session at
     *  its WIPE-TIME WATERMARK (the store-rebuild escape hatch for corrupted
     *  history or attribution-logic upgrades).
     *
     *  The watermark matters because the wipe destroys the live path's already-
     *  recorded samples too: a still-open session's post-attach usage exists in
     *  no log-replay-free zone — it MUST be reconstructed from the persisted
     *  log like everything else. Bounding that session at its old attach
     *  boundary would make the follow-up backfill replay only the pre-attach
     *  prefix and strand the live-recorded span forever; bounding it at the
     *  log length captured at wipe time makes the backfill rebuild exactly the
     *  destroyed range [0, watermark) once, while events from the watermark on
     *  stay exclusive to the still-running live path. Sessions without a
     *  usable watermark carry the -1 sentinel (replay nothing — never risk a
     *  duplicate). */
    reset(boundaries?: ReadonlyMap<string, number>): Promise<void>;
    /** Opens the domain (lazily awaited by every operation). */
    readyPromise(): Promise<void>;
    private requireTable;
    /** Fold one atomic usage sample (a completed call or a turn marker) into
     *  the day's row. Turn markers carry no model attribution (reasonix
     *  records them per source, not per model).
     *
     *  KvTable.update() requires an existing key ("no record to update"
     *  otherwise), so a miss is retried once after seeding the row with put().
     *  The put/update pair is not atomic against a concurrent writer for the
     *  same key, but the collector's fold dedupes by (turn, step) and the live
     *  listener + backfill never write the same key twice concurrently; the
     *  retry covers the first-writer race. */
    record(sample: UsageSample): Promise<void>;
    /** All rows whose day intersects [from, to] (inclusive). */
    rangeRows(from: string, to: string): Promise<UsageDayRow[]>;
    /** Total row count (diagnostics / tests). */
    count(): Promise<number>;
}
