/**
 * Range aggregation engine — a TS translation of the reasonix stats query
 * (internal/stats/query.go). It folds raw usage records (per call + per turn)
 * into the RangeStats the panel renders: per-day totals broken down by model
 * and provider, range totals, derived active days / cache hit-rate / top
 * model, and the per-model / per-provider ranked splits.
 *
 * The cache hit-rate is derived only from the input side (cacheHit +
 * cacheMiss), while the headline token total is PROVIDER-INCLUSIVE —
 * uncached input + output + cache reads + cache writes. That is the number
 * a provider dashboard reports for the same calls (and reasonix's
 * TotalTokens): DSH's TokenUsage splits DeepSeek's prompt_tokens into
 * disjoint input/cacheRead buckets, so the naive input+output sum would
 * hide the (typically dominant) cached share. The two rate denominators
 * never mix with the total.
 */
import type { UsageStatsRange } from './wire.ts';
import { dayKey, daysInRange, providerOf } from './shared.ts';
export { dayKey, daysInRange, providerOf };
/**
 * One atomic usage sample from a completed model call (or one completed
 * turn). A call sample carries the four token buckets and the model ref; a
 * turn marker carries only the day (the panel's "sessions" metric is one
 * completed turn). A request marker (from `request/context`) counts one
 * provider call with no tokens.
 */
export interface UsageSample {
    day: string;
    model?: string;
    inputTokens: number;
    outputTokens: number;
    cacheReadTokens: number;
    cacheWriteTokens: number;
    turn?: boolean;
    request?: boolean;
}
export interface RangeFilter {
    from: string;
    to: string;
}
/** Aggregate the samples intersecting [from, to]. Missing days yield zero
 *  entries so the trend chart shows the full timeline. */
export declare function aggregateSamples(samples: Iterable<UsageSample>, filter: RangeFilter): UsageStatsRange;
