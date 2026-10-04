/**
 * Derivation for the sidebar 最近 section: one flat, newest-first jump list
 * over the sessions of every workspace. Visibility mirrors the workspace
 * browser's own rules (`ui-workspace`'s tree derivation) so the two surfaces
 * never disagree about which sessions hold history: archived sessions are
 * hidden, subagent-origin rows belong to their parent's catalog, and blank
 * provisional sessions — which hold no history at all — never appear.
 *
 * The facts a row carries are the ones the shell's own session row renders —
 * title, age (or the pending-interaction label that replaces it), live state,
 * and pin membership — so a 最近 row and a workspace row describe the same
 * session with the same elements, down to the hover card.
 */
import type { SessionListState } from '@deepseek-ai/dsh-api-session-controller/client';
import type { WorkspaceView } from '@deepseek-ai/dsh-api-workspace-controller/client';
import type { SessionStatusSnapshot } from '@deepseek-ai/dsh-client-ui-session/client';
import type { SessionId } from '@deepseek-ai/dsh-session/types';
/**
 * Rows the section renders per page. The derivation hands over every session
 * that holds history, and the section renders a window over that list: one page
 * at first, one more page each time the operator scrolls the column to the end
 * of what is rendered.
 */
export declare const RECENT_PAGE_SIZE = 20;
/**
 * Items the workspace list keeps while folded. The shell caps one Workspace's
 * sessions at five the same way (`COLLAPSED_SESSION_LIMIT`), so the column's two
 * folds trade the same number of rows.
 */
export declare const FOLD_LIMIT = 5;
/**
 * Pending interactions a sidebar session row marks. Session-scoped domains
 * publish their own interaction objects, and the shell's rows carry a dot and a
 * compact trailing label for exactly these three kinds; every other kind stays
 * behind the surface that owns it.
 */
export type RecentPending = 'approval' | 'plan-review' | 'question';
/**
 * The rendered window after the operator reaches its end: one more page of
 * older sessions, never past the end of the history.
 * @param rendered - rows the section currently renders.
 * @param total - rows the derivation handed over.
 * @param page - rows one page holds.
 * @returns the window to render next.
 */
export declare function growWindow(rendered: number, total: number, page?: number): number;
/**
 * The pending-interaction kind the shell's rows mark, or undefined for a kind
 * no row offers.
 * @param kind - the pending interaction's domain kind.
 * @returns the markable kind.
 */
export declare function marksWaiting(kind: string | undefined): RecentPending | undefined;
/** One rendered 最近 row. */
export interface RecentRow {
    id: SessionId;
    /** Latest durable title, or the project directory name when the log has none yet. */
    title: string;
    /** Owning workspace title, or the ungrouped label when no workspace claims the session. */
    workspace: string;
    updatedAt: number;
    running: boolean;
    /** Pending interaction awaiting this user, as the row's amber dot and trailing label. */
    pending: RecentPending | undefined;
    /** Session is the current selection. */
    current: boolean;
    /** Session is pinned, so the row carries the resting pin marker. */
    pinned: boolean;
}
/** Everything the derivation reads; the component supplies it from props. */
export interface RecentRowsInput {
    /** Session catalog: rows, addresses, and each row's local retain counts. */
    list: SessionListState;
    /** Workspace registry order, membership, and display titles. */
    workspaces: readonly WorkspaceView[];
    /** Registry-global archive set; members are hidden on every surface. */
    archivedSessionIds: readonly SessionId[];
    /** Registry-global pin set; members lead their group and mark their row. */
    pinnedSessionIds: readonly SessionId[];
    /** Unified UI status by Session: live running state and the pending interaction. */
    status: SessionStatusSnapshot;
    /** Localized label for sessions outside every workspace. */
    ungroupedLabel: string;
}
/**
 * Derive the 最近 rows: every session that holds history, across all
 * workspaces, newest first. The list is complete — the section decides how much
 * of it to render at once, so scrolling can reach older sessions without the
 * derivation having thrown them away.
 * @param input - list, workspace registry, archive and pin sets, session status, and the localized ungrouped label.
 * @returns rows in render order.
 */
export declare function deriveRecentRows(input: RecentRowsInput): RecentRow[];
//# sourceMappingURL=rows.d.ts.map