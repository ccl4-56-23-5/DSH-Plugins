/**
 * ChartTip renders a chart hover tooltip as a fixed-position portal on
 * document.body. The charts draw in SVG with no DOM wrapper per cell/bar/
 * segment, so the previous absolute-inside-wrap approach could not escape the
 * wrap's clipping (the heatmap's overflow:hidden swallowed the tip entirely)
 * and relied on wrap-relative coordinates that drift under ancestor
 * transforms. This component instead anchors to the hovered SVG element's own
 * viewport rect, clamps inside the usage panel's bounds (falling back to
 * the viewport), and flips above the anchor when there is no room below —
 * re-measuring on scroll (capture phase), resize, and its own size changes
 * while open, mirroring the official ui-primitives useAnchoredPosition/HoverCard
 * pattern.
 */
import { type ReactNode, type RefObject } from 'react';
export interface ChartTipProps {
    /** The hovered SVG element (cell/bar/segment) the tip is placed from. */
    anchor: Element | null;
    /** The usage panel; the tip stays inside its bounds when it fits. */
    panelRef: RefObject<HTMLDivElement | null>;
    children: ReactNode;
    /** Vertical distance from the anchor edge. */
    gap?: number;
    /** Distance kept from the panel edges. */
    margin?: number;
}
/** The tip renders only while an anchor is set; null hides it entirely. */
export declare function ChartTip({ anchor, panelRef, children, gap, margin }: ChartTipProps): import("react").ReactPortal;
