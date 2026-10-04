/**
 * Derivation for the sidebar 最近 section: one flat, newest-first jump list
 * over the sessions of every workspace. Visibility mirrors the workspace
 * browser's own rules (`ui-workspace`'s tree derivation) so the two surfaces
 * never disagree about which sessions hold history: archived sessions are
 * hidden, subagent-origin rows belong to their parent's catalog, and blank
 * provisional sessions — which hold no history at all — never appear.
 */
import type { SessionId, SessionListState, WorkspaceView } from '@deepseek-ai/dsh-client-runtime/client';
/** Rows the derivation hands the section before its fold; the fold shows {@link FOLD_LIMIT} of them. */
export declare const RECENT_ROW_LIMIT = 20;
/**
 * Items each folded list shows. The shell caps one Workspace's sessions at five
 * the same way (`COLLAPSED_SESSION_LIMIT`), and each list here reserves space
 * for the other, so one number serves the workspace list and the 最近 list
 * alike.
 */
export declare const FOLD_LIMIT = 5;
/** Relative-time bucket of a row's trailing label. */
export type RecentTimeUnit = 'now' | 'minutes' | 'hours' | 'days' | 'months' | 'years';
/** Structured relative time: the bucket plus its magnitude (0 for 'now'). */
export interface RecentTime {
    unit: RecentTimeUnit;
    n: number;
}
/**
 * Compact relative time for a row, as a structured bucket the component
 * localizes ("now"/"5min"/"3h" in en, "刚刚"/"5分钟" in zh). Bucket edges match
 * the workspace browser's, so a session reads the same age on both surfaces.
 * @param updatedAt - epoch ms of the session's last activity.
 * @param now - current epoch ms (injected for pure rendering).
 * @returns the row's trailing time bucket and magnitude.
 */
export declare function relativeTime(updatedAt: number, now: number): RecentTime;
/** One rendered 最近 row. */
export interface RecentRow {
    id: SessionId;
    /** Latest durable title, or the project directory name when the log has none yet. */
    title: string;
    /** Owning workspace title, or the ungrouped label when no workspace claims the session. */
    workspace: string;
    updatedAt: number;
    running: boolean;
    /** Waiting on this user (approval, question, or plan review). */
    waiting: boolean;
    /** Session is the current selection. */
    current: boolean;
}
/** Everything the derivation reads; the component supplies it from props. */
export interface RecentRowsInput {
    /** Session metadata authority (list rows plus the current selection). */
    list: SessionListState;
    /** Workspace registry order, membership, and display titles. */
    workspaces: readonly WorkspaceView[];
    /** Registry-global archive set; members are hidden on every surface. */
    archivedSessionIds: readonly SessionId[];
    /** Localized label for sessions outside every workspace. */
    ungroupedLabel: string;
}
/**
 * Derive the 最近 rows: every session that holds history, across all
 * workspaces, newest first, capped at {@link RECENT_ROW_LIMIT}.
 * @param input - list, workspace registry, archive set, and the localized ungrouped label.
 * @returns rows in render order.
 */
export declare function deriveRecentRows(input: RecentRowsInput): RecentRow[];
//# sourceMappingURL=rows.d.ts.map