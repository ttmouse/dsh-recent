/** `recent` namespace dictionaries (the sidebar 最近 section copy and the workspace fold row). */
/** Dictionary namespace owned by this plugin. */
export declare const NS = "recent";
/** The recent-section dictionary key set (the source of truth for both locales). */
export type RecentKey = 'section.recent' | 'view.options' | 'view.showWorkspace' | 'fold.expandWorkspaces' | 'fold.expandSessions' | 'fold.collapse' | 'row.open' | 'row.pinned' | 'actions.session.aria' | 'actions.archive' | 'actions.unarchive' | 'actions.pin' | 'actions.unpin' | 'menu.pinSession' | 'menu.unpinSession' | 'menu.fork' | 'menu.archiveSession' | 'workspace.ungrouped' | 'status.running' | 'status.waitingApproval' | 'status.planReview' | 'status.waitingAnswer' | 'status.compact.approval' | 'status.compact.planReview' | 'status.compact.answer' | 'archive.confirm.title' | 'archive.confirm.desc' | 'archive.confirm.action' | 'archive.confirm.pending' | 'time.now' | 'time.minutes' | 'time.hours' | 'time.days' | 'time.months' | 'time.years' | 'time.ago';
declare module '@deepseek-ai/dsh-client-ui-slots' {
    interface LocaleNamespaceMap {
        /** The sidebar 最近 section copy. */
        'recent': RecentKey;
    }
}
/**
 * Simplified Chinese dictionary (the key-set source of truth). Every value is
 * the shell's own word for the same element — the rows and the hover card read
 * as the workspace tree's rows do, not as a translation of them.
 */
export declare const zh: Record<RecentKey, string>;
/** English dictionary, checked complete against the zh key set. */
export declare const en: Record<RecentKey, string>;
//# sourceMappingURL=locales.d.ts.map