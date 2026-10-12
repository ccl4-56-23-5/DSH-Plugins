/**
 * Typed fetch wrapper over the usage JSON API. Every call posts to
 * `usage/api/<method>` — DOCUMENT-RELATIVE, never root-absolute — with a JSON
 * body; the host resolves the range and returns the aggregate (or the backfill
 * status). Failures surface as {@link UsageApiError} with the wire code.
 *
 * Relative is the dsh 0.1.7 contract: the served index carries `<base
 * href="./">` (packages/host/frontend-static), so browser references resolve
 * under whatever mount served the page. A root-absolute `/usage/api/...` only
 * works when the shell sits at the origin root and 404s behind a
 * prefix-stripping proxy; the host's own route key stays absolute
 * (`/usage/api` in src/routes.ts), because only the browser half is relative.
 */
import type { BackfillStatus, UsageStatsRange, UsageStatsRequest } from '../wire.ts';
/** One wire failure. */
export declare class UsageApiError extends Error {
    readonly code: string;
    constructor(code: string, message: string);
}
/** Aggregate the usage panel renders for one range. */
export declare function fetchRange(req: UsageStatsRequest): Promise<UsageStatsRange>;
/** Rebuild the statistics from the session logs. The host wipes every row plus
 *  the backfill cursor and replays all persisted sessions under the current
 *  attribution rules, so a drifted store converges back onto the logs; it
 *  refuses (409) only while a boot scan is still running. */
export declare function rebuildStats(): Promise<BackfillStatus>;
