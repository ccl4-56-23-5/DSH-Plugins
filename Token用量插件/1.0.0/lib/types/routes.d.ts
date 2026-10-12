/**
 * The /usage/api route table: a small JSON RPC over the fenced web route.
 * Methods:
 *   - range  { range, from?, to?, source? } -> UsageStatsRange
 *   - status {} -> BackfillStatus
 *   - reset  {} -> drop every row + cursor, then rescan all persisted
 *              sessions (the store-rebuild escape hatch)
 * The prefix route /usage/api is registered on the webserver; each request
 * passes the browser-trust fence (Host-header loopback or trustedHosts).
 */
import type { Context } from './context-types.ts';
import type { UsageWebRoute } from './context-types.ts';
import { UsageStore } from './store.ts';
import { UsageCollector } from './collector.ts';
import type { BackfillStatus, UsageStatsRange, UsageStatsRequest } from './wire.ts';
export interface RoutesDeps {
    store: UsageStore;
    collector: UsageCollector;
    /** Resolve the trusted-host list live (webRuntime.trustedHosts). */
    trustedHosts: () => string[];
    /** Whether a /reset rebuild pipeline is currently in flight (its scan
     *  makes the collector report running too — callers use this to tell that
     *  benign state apart from a boot scan and COALESCE onto the pipeline
     *  instead of refusing). */
    isRebuilding: () => boolean;
    /** Wipe the store at wipe-time live watermarks and re-run the full
     *  backfill (wired by the host half; concurrent calls coalesce into one
     *  rebuild). */
    resetAndRescan: () => Promise<void>;
}
/** Resolve a request's [from, to] into inclusive local day keys. */
export declare function resolveRange(req: UsageStatsRequest, now?: Date): {
    from: string;
    to: string;
};
/** Build the aggregate for a range from the store rows. The per-row request
 *  and turn counts are yielded lazily as markers, so no intermediate array
 *  is materialized regardless of range size. */
export declare function aggregateRange(store: UsageStore, from: string, to: string): Promise<UsageStatsRange>;
/** Build the single fenced prefix route serving the /usage/api JSON RPC.
 *  The host mounts it via `ctx.webServer.register` (which takes ONE WebRoute,
 *  not an array — matching the real dsh-host-webserver contract). */
export declare function buildUsageRoute(ctx: Context, deps: RoutesDeps): UsageWebRoute;
export type { BackfillStatus, UsageStatsRange, UsageStatsRequest };
