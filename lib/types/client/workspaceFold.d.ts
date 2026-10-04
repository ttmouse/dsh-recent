/**
 * Fold control for the shell's workspace list.
 *
 * The shell's workspace browser renders one group section per registered
 * workspace and offers no "show fewer" affordance for the list itself, and no
 * slot, store, or config field exposes one. This module applies it from the
 * outside — the same DOM technique the sibling-panel plugins use for their
 * sidebar rows — by hiding the group sections past the fold limit and keeping
 * one toggle row after the last visible group.
 *
 * The layer is idempotent and self-healing: React rewrites the list on every
 * workspace or session frame, so a MutationObserver re-applies the fold, and
 * every write compares the desired state against the DOM first, which keeps the
 * observer from feeding itself.
 */
/** Owner attribute on the injected toggle row (selecting by class would depend on our own hash). */
export declare const FOLD_ROW_ATTRIBUTE = "data-dsh-recent-fold";
/** Copy for the fold row under both states. */
export interface FoldLabels {
    /** Label while folded; `hidden` is the number of items the fold holds back. */
    expand: (hidden: number) => string;
    /** Label while unfolded. */
    collapse: string;
}
/** Construction options for {@link WorkspaceListFold}. */
export interface WorkspaceFoldOptions {
    /** Group sections kept visible while folded. */
    limit: number;
    /** Current copy; re-read on every application, so a locale switch needs no re-install. */
    labels: FoldLabels;
    /** Called when the operator clicks the toggle row. */
    onToggle: () => void;
}
/** Elements whose direct children are the workspace group sections, in render order. */
export declare function groupSections(container: ParentNode): HTMLElement[];
/**
 * Resolve the workspace list container: the parent of the first rendered group
 * section. Resolving through a rendered group (rather than by class) keeps the
 * lookup correct for both the grouped tree and the flat list, which renders
 * sessions without group wrappers and therefore simply reports no container.
 * @param root - document subtree to search (the sidebar column, or document).
 * @returns the container element, or undefined before the browser mounts.
 */
export declare function workspaceListContainer(root: ParentNode): HTMLElement | undefined;
/**
 * Split the group sections into the ones the fold keeps and the ones it holds
 * back.
 * @param groups - group sections in render order.
 * @param limit - visible count while folded.
 * @param expanded - whether the operator unfolded the list.
 * @returns visible and hidden groups (hidden is empty while expanded).
 */
export declare function splitFold<T>(groups: readonly T[], limit: number, expanded: boolean): {
    visible: T[];
    hidden: T[];
};
/**
 * The workspace list's fold: state plus the observer that keeps it applied
 * while React owns the list.
 */
export declare class WorkspaceListFold {
    private readonly options;
    private expanded;
    private observer;
    private scheduled;
    private column;
    private readonly button;
    /**
     * @param options - fold limit, copy, and the toggle callback.
     */
    constructor(options: WorkspaceFoldOptions);
    /**
     * Apply the fold and keep it applied until disposal.
     * @returns the disposer that stops observing and restores every group.
     */
    start(): () => void;
    /**
     * Fold or unfold the list.
     * @param expanded - true shows every workspace, false keeps the fold limit.
     */
    setExpanded(expanded: boolean): void;
    /** Stop observing, drop the toggle row, and reveal every group again. */
    dispose(): void;
    /** The sidebar column, re-resolved after a replacement or a fresh mount. */
    private sidebar;
    /** Whether one mutation record can affect the list this fold owns. */
    private touchesSidebar;
    /** Coalesce observer bursts into one application per microtask. */
    private schedule;
    /** Reconcile the DOM with the current fold state; every write is compared first. */
    private apply;
}
//# sourceMappingURL=workspaceFold.d.ts.map