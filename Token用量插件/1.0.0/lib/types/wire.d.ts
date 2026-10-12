/**
 * Wire contract shared by the host aggregation layer and the browser panel,
 * plus the JSON request/response helpers for the /usage/api route handlers.
 * These types mirror the reasonix stats wire (internal/stats/query.go +
 * desktop/stats_app.go): the aggregate response the panel renders maps 1:1
 * to the panel sections (totals, derived stats, daily trend, per-model
 * split). No Node or DOM types leak into the shared declarations — the HTTP
 * helpers are host-only and import the node faces explicitly.
 */
import type { UsageHttpRequest, UsageHttpResponse } from './context-types.ts';
/** One day's token usage and turn count in a trend series. */
export interface DailyTokenUsage {
    day: string;
    total: number;
    byModel: Record<string, number>;
    byProvider: Record<string, number>;
    requests: number;
    turns: number;
    cacheHit: number;
    cacheMiss: number;
}
/** One model's aggregate within the range. */
export interface ModelTokenUsage {
    model: string;
    provider: string;
    tokens: number;
    percent: number;
}
/** One provider's aggregate within the range (each provider may serve several models). */
export interface ProviderTokenUsage {
    provider: string;
    tokens: number;
    percent: number;
}
/** The full aggregate the panel renders for one time range. */
export interface UsageStatsRange {
    from: string;
    to: string;
    tokens: number;
    requests: number;
    turns: number;
    cacheHit: number;
    cacheMiss: number;
    activeDays: number;
    topModel: string;
    topProvider: string;
    daily: DailyTokenUsage[];
    models: ModelTokenUsage[];
    providers: ProviderTokenUsage[];
}
/** The usage statistics panel aggregate request. */
export interface UsageStatsRequest {
    range: string;
    from?: string;
    to?: string;
}
/** The backfill (historical session scan) progress state. */
export interface BackfillStatus {
    running: boolean;
    total: number;
    done: number;
    scannedSessions: number;
    lastSessionId?: string;
    error?: string;
}
/** One line of an async-iterable request body read as UTF-8 text. */
export declare function readJsonBody(req: UsageHttpRequest, maxBytes?: number): Promise<unknown>;
/** A user-visible error carrying its HTTP status. */
export declare class UsageError extends Error {
    readonly status: number;
    constructor(status: number, message: string);
}
export declare function writeJson(res: UsageHttpResponse, value: unknown, status?: number): void;
export declare function writeError(res: UsageHttpResponse, err: unknown): void;
