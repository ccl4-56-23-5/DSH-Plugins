/**
 * One trigger-anchored stat dialog seat for the composer-dock pills.
 * Replicates the official ui-chat stat-dialog.ts (DSH 0.1.5-alpha.1): open
 * state (optionally controlled so sibling dialogs share one exclusive slot),
 * viewport-clamped placement above the trigger, outside-pointer close, and
 * Escape close. All imports are platform externals (react + primitives), so
 * the client-bundle purity gate accepts this module.
 */
import { type CSSProperties, type MutableRefObject } from 'react';
/**
 * Unplaced portal panel: hidden but laid out so the clamp measures real
 * dimensions (the `useAnchoredPosition` measure pass).
 */
export declare const MEASURE_STYLE: CSSProperties;
/** Open state, refs, and clamped placement for one stat dialog. */
export interface StatDialogSeat {
    open: boolean;
    setOpen: (open: boolean) => void;
    rootRef: MutableRefObject<HTMLSpanElement | null>;
    panelRef: MutableRefObject<HTMLDivElement | null>;
    pos: CSSProperties | null;
}
/**
 * One trigger-anchored dialog seat: open state, viewport-clamped placement,
 * outside-close.
 */
export declare function useStatDialog(controlled?: Pick<StatDialogSeat, 'open' | 'setOpen'>): StatDialogSeat;
