/**
 * dsh-usage-statistics-panel host half: the /usage/api fenced JSON routes
 * (range aggregate + backfill status), the durable usage store, and the
 * collector that folds live session events plus the one-time historical
 * session backfill. Every request passes the same browser-trust fence as the
 * /api gateway (Host-header loopback or the web runtime's trustedHosts).
 *
 * The panel's data flow mirrors the reasonix usage stats feature: usage is
 * recorded observationally (never alters the event stream; a bad disk state
 * must never interrupt a turn), aggregated per day × model, and served to
 * the browser half over the fenced route.
 */
import type { Context } from './context-types.ts';
export declare const name = "dsh-usage-statistics-panel";
/** Services required before mounting: the webserver routes, the session
 *  persistence + live store (backfill + live events), and the storage domain
 *  hub (durable rows). */
export declare const inject: string[];
export interface UsageStatsConfig {
    /** The source label recorded with every live sample ("" = unlabelled). */
    source?: string;
    /** Backfill concurrency (default 4). */
    backfillConcurrency?: number;
}
/** Reset the process-level store cache (test seam only). */
export declare function _resetSharedStoreForTests(): void;
export declare function apply(ctx: Context, config?: UsageStatsConfig): void;
export type { UsageCollector, UsageFold } from './collector.ts';
export type { UsageStore } from './store.ts';
export type { UsageStatsRange, UsageStatsRequest, DailyTokenUsage, ModelTokenUsage, ProviderTokenUsage, BackfillStatus } from './wire.ts';
