/**
 * Fold control for one project's session rows — the second fold the column
 * carries, one per Workspace group.
 *
 * The shell caps a Workspace's session list at five *idle* rows and keeps
 * running and provisional rows outside that quota, so a project holding work in
 * flight shows more than five conversations, and its overflow control reveals
 * five more per click. This layer applies the window asked for instead: five
 * conversations per project whatever state they are in, and ten more per click,
 * one step at a time.
 *
 * Like the workspace list's own fold, it is applied from the outside, because
 * no slot, store, or config field exposes either number. It owns the group's
 * overflow row — the shell's own control is hidden and this layer's row takes
 * its place, at its position and with its metrics — and it owns which rows are
 * on screen: the rows past the current window are hidden, and the shell is
 * asked for more rows only when a step needs rows it has not rendered yet (its
 * quota is a renderer's, not the reader's). The shell keeps its rows: they stay
 * the shell's own elements, with their drag targets, menus, and hover cards.
 *
 * The window is per group and lives while the group is open: folding a project
 * away and opening it again returns it to the first five, exactly as the shell
 * resets its own quota there. The conversation the operator is reading is never
 * hidden, so revealing an old session in the tree still lands on a visible row.
 *
 * The layer is idempotent and self-healing: React rewrites the list on every
 * workspace or session frame, so a MutationObserver re-applies the window, and
 * every write compares the desired state against the DOM first, which keeps the
 * observer from feeding itself.
 */
/** Owner attribute on the injected fold row (selecting by class would depend on our own hash). */
export declare const SESSION_FOLD_ROW_ATTRIBUTE = "data-dsh-recent-session-fold";
/** Conversations one project shows while folded — the shell's own `COLLAPSED_SESSION_LIMIT`. */
export declare const SESSION_FOLD_LIMIT = 5;
/** Conversations one expand reveals. */
export declare const SESSION_FOLD_STEP = 10;
/** Copy for the per-project fold row under both states. */
export interface SessionFoldLabels {
    /** Label while folded; `hidden` is the number of conversations the fold holds back. */
    expand: (hidden: number) => string;
    /** Label once every conversation of the project is on screen. */
    collapse: string;
}
/** Construction options for {@link SessionListFold}. */
export interface SessionFoldOptions {
    /** Current copy; re-read on every application, so a locale switch needs no re-install. */
    labels: SessionFoldLabels;
}
/**
 * Group key the shell renders on one group's header row: the Workspace id, or
 * the empty string for the trailing bucket of sessions no Workspace claims.
 * @param group - one group section.
 * @returns the key, or undefined when the section carries no header row.
 */
export declare function groupKey(group: HTMLElement): string | undefined;
/**
 * The Session rows of one group, in render order. Membership goes by the
 * nearest group section rather than by direct parentage: nested workspaces
 * render their own sections inside their parent's, and the row animator's exit
 * overlay carries clones of removed rows outside the group.
 * @param group - one group section.
 * @returns the group's own session rows.
 */
export declare function sessionRows(group: HTMLElement): HTMLElement[];
/**
 * The shell's own overflow control for one group, when it renders one. The
 * shell renders it while its own default quota would hold rows back, and its
 * label carries how many rows that quota hides.
 * @param group - one group section.
 * @returns the control, or undefined when the shell already renders every row.
 */
export declare function overflowControl(group: HTMLElement): HTMLButtonElement | undefined;
/**
 * Rows the shell's own control holds back, read off its label ("展开其余 3 个
 * 会话" / "Show 3 more sessions"). The number is the shell's own count of rows
 * its quota hides, so it stays exact at any quota the shell is currently at;
 * the collapsed label ("收起" / "Collapse") carries none and means nothing is
 * held back. A label this layer cannot read reports zero, which understates
 * rather than invents.
 * @param label - the control's own text.
 * @returns the hidden row count.
 */
export declare function hiddenCountFromLabel(label: string | null): number;
/**
 * The rows one expand reveals: one step more, never past the end of the list.
 * @param revealed - rows the group currently shows.
 * @param total - conversations the group holds.
 * @param step - rows one step reveals.
 * @returns the window to show next.
 */
export declare function nextReveal(revealed: number, total: number, step?: number): number;
/**
 * Whether one row index stays on screen: inside the window, or the conversation
 * the operator is reading — the shell reveals the current session's row in its
 * own tree, so hiding it would send the column's scroll to a row nobody sees.
 * @param index - the row's position in render order.
 * @param revealed - rows the group currently shows.
 * @param currentIndex - position of the current conversation's row, or -1 when none is selected.
 * @returns true when the row is visible.
 */
export declare function rowIsVisible(index: number, revealed: number, currentIndex: number): boolean;
/**
 * The per-project session fold: state, the injected row per group, and the
 * observer that keeps the window applied while React owns the list.
 */
export declare class SessionListFold {
    private readonly options;
    private readonly folds;
    private observer;
    private scheduled;
    private column;
    /**
     * @param options - the row's copy, re-read on every application.
     */
    constructor(options: SessionFoldOptions);
    /**
     * Apply the fold and keep it applied until disposal.
     * @returns the disposer that stops observing and restores the shell's own control.
     */
    start(): () => void;
    /**
     * Re-apply the window: the session catalog moved on, so a group's total, its
     * label, or the current conversation may have changed under the layer.
     */
    refresh(): void;
    /** Stop observing, drop the injected rows, and give every row and control back to the shell. */
    dispose(): void;
    /** The sidebar column, re-resolved after a replacement or a fresh mount. */
    private sidebar;
    /** Whether one mutation record can affect the list this fold owns. */
    private touchesSidebar;
    /** Whether a node is one of this layer's own rows (or inside one). */
    private ownsNode;
    /** Coalesce observer bursts into one application per microtask. */
    private schedule;
    /** Reconcile every group with its window; every write is compared first. */
    private apply;
    /**
     * Whether one group is open — its rows on screen — which is also the signal
     * that its fold starts over. A group the shell renders without a header row
     * is treated as open: its rows are there to fold.
     * @param group - one group section.
     * @param key - the group's key.
     * @returns true while the group shows its sessions.
     */
    private groupOpen;
    /** Apply one open group's window, its row, and the shell's control. */
    private applyGroup;
    /** Build one group's fold row (namespace-exact button, owner attribute instead of a class). */
    private createRow;
    /** Reveal one step, or fold the project back to its first page once everything is on screen. */
    private step;
    /**
     * Ask the shell for enough rows to fill the next window. The shell's quota is
     * a renderer's: it decides which rows exist in the DOM, this layer decides
     * which of them are on screen. One activation reveals one page, so a step
     * activates the control once per page it needs — and never at all once the
     * shell is expanded, because activating it there folds the project back.
     * @param control - the shell's own overflow control.
     * @param want - rows the window needs.
     * @param rendered - rows the shell has rendered so far.
     */
    private growShell;
    /**
     * Give the shell's own control back its default quota, once the window folds
     * a project back to five rows: the rows it renders past the window are then
     * the shell's to drop, and the column sheds them instead of hiding them.
     * Only an expanded control is activated — anywhere else the activation would
     * ask for one more page instead.
     * @param control - the shell's own overflow control.
     */
    private releaseShell;
}
//# sourceMappingURL=sessionFold.d.ts.map