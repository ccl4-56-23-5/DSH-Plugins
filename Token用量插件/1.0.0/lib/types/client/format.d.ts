/**
 * Number/date formatting helpers for the usage panel — a TS translation of
 * reasonix's usageStatsFormat.ts plus the pure chart helpers from the panel
 * component.
 *
 * Pure date/model-ref helpers (`providerOf`, `daysBetween`) are re-exported
 * from the shared zero-dependency module so the host and client halves share
 * one implementation.
 */
export { providerOf, modelNameOf, daysInRange as daysBetween } from '../shared.ts';
/** Exact token counts with thousands separators — no 万/亿/k/M units, the
 *  user reads the precise number (long values shrink to fit via FitText).
 *  Compact units stay on the axis labels and card sub-values only. */
export declare function formatTokens(n: number): string;
/** English-style compact (B/M/k) for axis labels and card sub-values. */
export declare function formatCompact(n: number): string;
export declare function formatPercent(p: number): string;
/** Prompt-cache hit ratio as 0..100 from cached/missed input tokens, or null
 *  when there is no usage to judge (0/0). */
export declare function cacheRate(hit: number, miss: number): number | null;
/** Format a hit ratio for display; no data renders as "—". */
export declare function cacheRateText(hit: number, miss: number): string;
/** Today's local date (plus/minus offsetDays) in "YYYY-MM-DD". */
export declare function localDay(offsetDays: number): string;
/** 0 = Monday … 6 = Sunday (GitHub-style heatmap rows). */
export declare function indexOfDay(day: string): number;
export declare function shortDay(day: string): string;
/** model refs are "provider/model"; a bare model name has no slash.
 *  (Re-exported from ../shared.ts at the top of this file.) */
/** Build a Catmull-Rom spline through the points (converted to cubic
 *  Beziers) so the hit-rate line reads as a smooth curve across data-less
 *  days instead of breaking into segments. */
export declare function smoothPath(pts: Array<{
    x: number;
    y: number;
}>): string;
/** Nice axis ticks: 1/2/5 × 10^k steps covering [step, max]. Non-positive
 *  maxima produce no ticks (guards the log10 against 0/NaN and the loop
 *  against a zero step). */
export declare function niceTicks(max: number, count: number): number[];
