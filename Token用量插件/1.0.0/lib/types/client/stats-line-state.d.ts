/**
 * Client preferences for the conversation bottom-bar (stats line) enhancements,
 * persisted in localStorage as one JSON blob.
 *
 * Three toggles share one blob so a single read covers all of them:
 * - `cachePrecision`: render the cache-hit rate with two decimals (e.g.
 *   "85.25%") instead of the default integer percentage;
 * - `tokenDetail`: add the input (cache miss) row to the usage dialog's
 *   input / cache-read / cache-write / output breakdown;
 * - `streamThroughput`: while a step streams, replace the pill's speed figure
 *   with the live estimate and fall back to the official session figure the
 *   moment it settles.
 *
 * The panel row and the stats line live in two different slot trees but inside
 * the SAME client bundle instance, so a tiny module store keeps them in sync
 * without touching the host or any settings store. Reads are defensive
 * (private mode / quota make storage throw); partial or corrupt blobs fall
 * back to defaults value by value.
 */
export interface StatsLinePrefs {
    cachePrecision: boolean;
    tokenDetail: boolean;
    streamThroughput: boolean;
}
export declare const statsLineState: {
    readonly cachePrecision: boolean;
    readonly tokenDetail: boolean;
    readonly streamThroughput: boolean;
    setCachePrecision(next: boolean): void;
    setTokenDetail(next: boolean): void;
    setStreamThroughput(next: boolean): void;
    subscribe(listener: () => void): () => void;
};
/** Test-only: re-read persisted storage so a fresh test starts clean. */
export declare function resetStatsLineStateForTests(): void;
