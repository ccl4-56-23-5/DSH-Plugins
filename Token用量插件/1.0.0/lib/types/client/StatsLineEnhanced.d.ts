import type { PropsLocale, SnapshotSelectorHook } from '@deepseek-ai/dsh-client-ui-slots';
import { LOCALE_NS } from './locales.ts';
import { type ConversationNodeLike, type PartialAssistantLike, type UseProjection } from './stats-line-core.ts';
/**
 * Structural type for the `useChat` seat: the standard snapshot selector over
 * the ui-chat ChatSnapshot, whose `legacy.nodes` compatibility projection
 * carries the ConversationNode[] the official pills read and whose
 * `legacy.partial` carries the in-flight assistant output. Declared locally
 * because the seat is consumed structurally at runtime (injected by the slot
 * declaration) and never value-imported.
 */
type ChatSnapshotSelectorHook = SnapshotSelectorHook<{
    legacy: {
        nodes?: readonly ConversationNodeLike[];
        partial?: PartialAssistantLike | null;
    };
}>;
/**
 * Full props: the standard session kit (selector + projection seat) plus the
 * locale seat this entry declares. `useChat` is injected by the slot
 * declaration on DSH >= 0.1.2-rc.1.
 */
export interface StatsLineEnhancedProps {
    /** The chat-view snapshot selector (path `legacy.nodes`). */
    useChat: ChatSnapshotSelectorHook;
    useProjection: UseProjection;
    t: PropsLocale<typeof LOCALE_NS>['t'];
}
export declare const StatsLineEnhanced: import("react").NamedExoticComponent<StatsLineEnhancedProps>;
export {};
