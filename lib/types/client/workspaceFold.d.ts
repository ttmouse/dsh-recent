/**
 * Fold control for the shell's workspace section.
 *
 * Two behaviors share this one layer, because both manipulate the same list:
 *
 * - **Section collapse** (the header chevron): the whole workspace list folds
 *   away, so the column's space goes to 最近 instead of to project rows.
 * - **List fold** (the trailing row): the list keeps {@link WorkspaceFoldOptions.limit}
 *   groups — the ones holding the newest history — and holds the rest behind
 *   one row.
 *
 * The ranking is what keeps the column honest about being "recently used": a
 * group that now holds only old history loses its place to a group that was
 * touched today, and the shell's trailing bucket for the sessions no Workspace
 * claims competes like any Workspace instead of staying pinned. A group with no
 * history at all ranks below every group that has some, so it leaves the column
 * as soon as the fold has to choose — and while the list is still within
 * {@link WorkspaceFoldOptions.limit}, nothing is chosen and nothing is hidden.
 * The fold never reorders the list to say any of this: the survivors keep the
 * order the shell gave them (manual, newest-created first), because React owns
 * those nodes and their drag targets.
 *
 * The shell's workspace browser renders one group section per registered
 * workspace and offers neither affordance, and no slot, store, or config field
 * exposes one. This module applies both from the outside — the same DOM
 * technique the sibling-panel plugins use for their sidebar rows — by hiding
 * the group sections and keeping one toggle row after the last visible group.
 * The shell's own section header gains the chevron through a marker attribute;
 * its text, its buttons, and the project rows' drag targets stay the shell's.
 *
 * The layer is idempotent and self-healing: React rewrites the list on every
 * workspace or session frame, so a MutationObserver re-applies both behaviors,
 * and every write compares the desired state against the DOM first, which keeps
 * the observer from feeding itself.
 */
import type { SessionListState } from '@deepseek-ai/dsh-api-session-controller/client';
import type { WorkspaceView } from '@deepseek-ai/dsh-api-workspace-controller/client';
import type { SessionId } from '@deepseek-ai/dsh-session/types';
/** Owner attribute on the injected toggle row (selecting by class would depend on our own hash). */
export declare const FOLD_ROW_ATTRIBUTE = "data-dsh-recent-fold";
/** Owner attribute on the section header, carrying its collapse state. */
export declare const SECTION_COLLAPSED_ATTRIBUTE = "data-dsh-recent-section";
/** Owner attribute on the injected chevron inside the section header. */
export declare const SECTION_CHEVRON_ATTRIBUTE = "data-dsh-recent-section-chevron";
/** Copy for the fold row under both states. */
export interface FoldLabels {
    /** Label while folded; `hidden` is the number of items the fold holds back. */
    expand: (hidden: number) => string;
    /** Label while unfolded. */
    collapse: string;
}
/** Construction options for {@link WorkspaceListFold}. */
export interface WorkspaceFoldOptions {
    /** Groups kept visible while the list is folded (ignored while collapsed). */
    limit: number;
    /** Current copy; re-read on every application, so a locale switch needs no re-install. */
    labels: FoldLabels;
    /**
     * Newest history time of one group, by the key {@link groupKey} reads off its
     * header row; a group whose key is absent from this lookup ranks last. Read on
     * every application, so the owner can swap the map as the catalog moves.
     */
    recency: (key: string) => number | undefined;
    /** Called when the operator clicks the toggle row. */
    onToggle: () => void;
    /** Called when the operator clicks the section header chevron. */
    onToggleSection: () => void;
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
/** Group key of the shell's trailing bucket: every Session no Workspace claims. */
export declare const UNGROUPED_KEY = "";
/**
 * Group key the shell renders on one group's header row: the Workspace id, or
 * {@link UNGROUPED_KEY} for the trailing bucket. The group's own header row is
 * its first addressable row, ahead of the session rows it holds.
 * @param group - one group section.
 * @returns the key, or undefined when the section carries no header row.
 */
export declare function groupKey(group: HTMLElement): string | undefined;
/**
 * Newest session time of every group, keyed the way {@link groupKey} reads
 * groups. Membership is the shell's own: each Workspace owns the sessions the
 * registry accounts to it, and every other session belongs to
 * {@link UNGROUPED_KEY}. Sessions without history do not count, so a group
 * holding none — and a group whose newest row is a blank provisional or an
 * archived session — ranks last, exactly as the 最近 list's own derivation
 * leaves them out.
 * @param input - session catalog, workspace registry, and the registry-global archive set.
 * @returns newest history time per group key; absent keys hold no history.
 */
export declare function groupRecency(input: {
    list: SessionListState;
    workspaces: readonly WorkspaceView[];
    archivedSessionIds: readonly SessionId[];
}): Map<string, number>;
/**
 * Split the group sections into the ones the fold keeps and the ones it holds
 * back: folded, the list keeps the `limit` groups with the newest history, and
 * the groups it has to leave out are the ones used longest ago — a group with
 * no history at all comes last, so it only fills a slot no group with history
 * claimed. Order is untouched: the kept groups are chosen, not moved, so the
 * column shows the shell's own order minus the losers. A list that already fits
 * the limit has nothing to choose between and keeps every group.
 * @param groups - group sections in render order.
 * @param limit - groups kept while folded.
 * @param expanded - whether the operator unfolded the list.
 * @param recency - newest history time of one group; undefined (or a non-finite
 * value) ranks last, and groups that tie keep their render order.
 * @returns visible and hidden groups (hidden is empty while expanded).
 */
export declare function splitByRecency<T>(groups: readonly T[], limit: number, expanded: boolean, recency: (group: T) => number | undefined): {
    visible: T[];
    hidden: T[];
};
/**
 * The workspace section's collapse plus the list's fold: state, the injected
 * chevron and fold row, and the observer that keeps both applied while React
 * owns the list.
 */
export declare class WorkspaceListFold {
    private readonly options;
    private collapsed;
    private expanded;
    private observer;
    private scheduled;
    private column;
    private header;
    private readonly chevron;
    private readonly button;
    /** Stable header-click handler, so {@link dispose} can always remove it. */
    private readonly onHeaderClick;
    /**
     * @param options - fold limit, copy, the group ranking, and the two toggle callbacks.
     */
    constructor(options: WorkspaceFoldOptions);
    /**
     * Apply both behaviors and keep them applied until disposal.
     * @returns the disposer that stops observing and restores the list and header.
     */
    start(): () => void;
    /**
     * Collapse or expand the whole workspace section.
     * @param collapsed - true hides the list, leaving the header as the row that brings it back.
     */
    setCollapsed(collapsed: boolean): void;
    /**
     * Fold or unfold the list.
     * @param expanded - true shows every group, false keeps the fold limit.
     */
    setExpanded(expanded: boolean): void;
    /**
     * Re-rank the groups: the session catalog moved on, so which groups the fold
     * keeps while folded may have changed. The owner calls this after installing
     * a new {@link WorkspaceFoldOptions.recency} lookup.
     */
    refresh(): void;
    /** Stop observing, drop the injected controls, and reveal every group again. */
    dispose(): void;
    /** The sidebar column, re-resolved after a replacement or a fresh mount. */
    private sidebar;
    /** Whether one mutation record can affect the list this fold owns. */
    private touchesSidebar;
    /** Coalesce observer bursts into one application per microtask. */
    private schedule;
    /** Reconcile the DOM with the current states; every write is compared first. */
    private apply;
    /**
     * Newest history time the owner reports for one group, or undefined when the
     * section carries no addressable key or the owner knows no history for it —
     * both rank the group last, which is what a folder that holds nothing recent
     * deserves.
     * @param group - one group section.
     * @returns the group's newest history time.
     */
    private groupRecency;
    /**
     * Adopt the shell's section header: mark it as the collapse toggle, place the
     * chevron, and route clicks on it to the owner. The header's own buttons (view
     * options, search) and the project rows' drag targets keep their own handlers:
     * this listener only sees a click that reached the header itself.
     */
    private applySectionHeader;
}
//# sourceMappingURL=workspaceFold.d.ts.map