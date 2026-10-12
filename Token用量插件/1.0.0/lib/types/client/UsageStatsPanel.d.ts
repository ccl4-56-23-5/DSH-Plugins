import type { UsageStatsTranslator } from './index.tsx';
type Translator = UsageStatsTranslator;
export declare const HEAT_WEEKS = 52;
export declare function UsageStatsPanel({ t }: {
    t: Translator;
}): JSX.Element;
/** One heatmap frame's geometry. */
export interface HeatGeometry {
    /** Cell edge in px. */
    size: number;
    /** Weeks drawn. */
    cols: number;
    /** Columns actually laid out, including the partial first week. */
    totalWeeks: number;
}
/**
 * Solve the heatmap's geometry for an available width.
 *
 * Two rules, in this order: spend spare width on MORE WEEKS (up to the data
 * window), and only then grow the cells to close the remaining gap. When the
 * window does not fit at the base cell size, trim the earliest weeks and keep
 * the base size.
 *
 * Two off-by-one traps are handled explicitly, because both produce a real
 * overflow at the page's ~900px content width:
 *  - "does it fit" is tested against `totalWeeks` (the laid-out column count,
 *    one more than `cols` when the first week is partial), not `HEAT_WEEKS`;
 *  - the fitting test reserves the trailing gap, so `baseCols` is derived from
 *    `avail - HEAT_GAP` and the rendered width `cols*(size+GAP)+GAP` can never
 *    exceed `avail`.
 *
 * The growth branch runs only when the solved cell size is still at or above
 * the base size; otherwise the window does not truly fit and the trim branch
 * runs. A `max(BASE, size)` fallback would silently render one column too many.
 * @param avail - available width in px.
 * @param startOffset - leading empty cells of the first week (0..6).
 * @returns the cell size, the week count, and the laid-out column count.
 */
export declare function heatGeometry(avail: number, startOffset: number): HeatGeometry;
export {};
