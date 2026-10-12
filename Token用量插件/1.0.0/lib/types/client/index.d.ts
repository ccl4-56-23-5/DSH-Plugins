/**
 * The "Usage statistics" panel's browser half.
 *
 * The panel renders in TWO places, both fed by the same component:
 *  - the Plugins page, inside this bundle's own detail page (the keyed
 *    `plugins.bundle.config` slot, keyed by this bundle's npm package name);
 *  - a global main panel of its own, reached from the "Usage statistics" row
 *    the sidebar draws under New Session beside the shipped global panels.
 *
 * The sidebar row is the quick way in, and it deliberately does NOT ride
 * `sidebar.footer.action`: that seat is a single flex row shared with every
 * other plugin's footer action, so an entry there competes for width with its
 * neighbours instead of getting a row of its own. A `sidebar.panellist` row is
 * a seat no other plugin shares, and the row is always present (like the
 * shipped panel rows), so there is no preference to control it.
 *
 * Type note: the host slot contracts this file needs are mirrored in
 * src/context-types.ts rather than imported from the owning packages, which is
 * this plugin's standing convention for host contracts.
 */
import type { Context, UsagePluginConfigOwnerProps } from '../context-types.ts';
import type { PropsLocale, PropsRuntime, TranslateNS } from '@deepseek-ai/dsh-client-ui-slots';
import { LOCALE_NS, type UsageStatsKey } from './locales.ts';
/** This bundle's npm package name — the key the Plugins page matches on. */
export declare const BUNDLE_NAME = "dsh-usage-statistics-panel";
/** The id shared by the sidebar row and the main panel it selects. */
export declare const PANEL_ID = "usage-stats";
/** The typed translator seat the framework injects for this namespace. */
export type UsageStatsTranslator = TranslateNS<typeof LOCALE_NS>;
export type UsageStatsSectionProps = UsagePluginConfigOwnerProps & PropsLocale<typeof LOCALE_NS>;
/** The main-panel share: the locale seat plus the back control's action. */
export type UsageStatsPanelPageProps = PropsLocale<typeof LOCALE_NS> & {
    /** Return to whatever the reader was looking at before this panel. */
    goBack: () => void;
};
declare module '@deepseek-ai/dsh-client-ui-slots' {
    interface LocaleNamespaceMap {
        'usageStats': UsageStatsKey;
    }
}
export declare const inject: string[];
/** The panel as the Plugins page renders it: the page owns the title, the
 *  icon, and the crumb, so this is the bare panel. */
export declare function UsageStatsSection(props: UsageStatsSectionProps): JSX.Element;
/** The panel as a standalone main panel, wrapped in the same 960px content
 *  column the Plugins page gives it so both entries look identical.
 *
 *  Only this entry carries the back control. The Plugins page entry sits in
 *  the page's own chrome, which already draws a crumb back to the bundle list,
 *  so a second control there would be noise rather than help. */
export declare function UsageStatsPanelPage(props: UsageStatsPanelPageProps): JSX.Element;
/** The sidebar row's glyph; the sidebar owns the button, the label, and the
 *  selected state around it. */
export declare function StatsPanelIcon({ size }: PropsRuntime<'sidebar.panellist'>): JSX.Element;
export declare function apply(ctx: Context): void;
