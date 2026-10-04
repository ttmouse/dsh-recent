/** `recent` namespace dictionaries (the sidebar 最近 section copy and its fold row). */
/** Dictionary namespace owned by this plugin. */
export declare const NS = "recent";
/** The recent-section dictionary key set (the source of truth for both locales). */
export type RecentKey = 'section.recent' | 'fold.expandWorkspaces' | 'fold.expandSessions' | 'fold.collapse' | 'row.open' | 'workspace.ungrouped' | 'status.running' | 'status.waiting' | 'time.now' | 'time.minutes' | 'time.hours' | 'time.days' | 'time.months' | 'time.years' | 'time.ago';
declare module '@deepseek-ai/dsh-client-ui-slots' {
    interface LocaleNamespaceMap {
        /** The sidebar 最近 section copy. */
        'recent': RecentKey;
    }
}
/** Simplified Chinese dictionary (the key-set source of truth). */
export declare const zh: Record<RecentKey, string>;
/** English dictionary, checked complete against the zh key set. */
export declare const en: Record<RecentKey, string>;
//# sourceMappingURL=locales.d.ts.map