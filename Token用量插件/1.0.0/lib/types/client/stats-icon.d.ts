/**
 * The "usage statistics" glyph — the lucide BarChart3 icon, used by the
 * sidebar's panel row. Kept as its own module so the path data has a single
 * authority and the SVG stays identical wherever it is rendered.
 */
/** The lucide BarChart3 path data (24x24 stroke icon). */
export declare const STATS_ICON_PATH = "M3 3v18h18 M18 17V9 M13 17V5 M8 17v-3";
/** The statistics icon as a React element, sized by the sidebar's icon share. */
export declare function StatsIcon({ size, className }: {
    size?: number;
    className?: string;
}): import("react").JSX.Element;
