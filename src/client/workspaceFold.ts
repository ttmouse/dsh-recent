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

/** Class-name fragment of one workspace group section; the hash prefix is deployment-local. */
const GROUP_SECTION_FRAGMENT = '_groupSection'

/** Class-name fragment of the sidebar's foot area, the anchor for the list's owning column. */
const FOOT_AREA_FRAGMENT = '_footArea'

/** Owner attribute on the injected toggle row (selecting by class would depend on our own hash). */
export const FOLD_ROW_ATTRIBUTE = 'data-dsh-recent-fold'

/** Copy for the fold row under both states. */
export interface FoldLabels {
  /** Label while folded; `hidden` is the number of items the fold holds back. */
  expand: (hidden: number) => string
  /** Label while unfolded. */
  collapse: string
}

/** Construction options for {@link WorkspaceListFold}. */
export interface WorkspaceFoldOptions {
  /** Group sections kept visible while folded. */
  limit: number
  /** Current copy; re-read on every application, so a locale switch needs no re-install. */
  labels: FoldLabels
  /** Called when the operator clicks the toggle row. */
  onToggle: () => void
}

/** Elements whose direct children are the workspace group sections, in render order. */
export function groupSections(container: ParentNode): HTMLElement[] {
  return [...container.children].filter(
    (child): child is HTMLElement => child instanceof HTMLElement && child.className.includes(GROUP_SECTION_FRAGMENT),
  )
}

/**
 * Resolve the workspace list container: the parent of the first rendered group
 * section. Resolving through a rendered group (rather than by class) keeps the
 * lookup correct for both the grouped tree and the flat list, which renders
 * sessions without group wrappers and therefore simply reports no container.
 * @param root - document subtree to search (the sidebar column, or document).
 * @returns the container element, or undefined before the browser mounts.
 */
export function workspaceListContainer(root: ParentNode): HTMLElement | undefined {
  const group = root.querySelector(`[class*="${GROUP_SECTION_FRAGMENT}"]`)
  const container = group?.parentElement
  return container instanceof HTMLElement ? container : undefined
}

/**
 * Split the group sections into the ones the fold keeps and the ones it holds
 * back.
 * @param groups - group sections in render order.
 * @param limit - visible count while folded.
 * @param expanded - whether the operator unfolded the list.
 * @returns visible and hidden groups (hidden is empty while expanded).
 */
export function splitFold<T>(groups: readonly T[], limit: number, expanded: boolean): { visible: T[]; hidden: T[] } {
  if (expanded || groups.length <= limit) return { visible: [...groups], hidden: [] }
  return { visible: groups.slice(0, limit), hidden: groups.slice(limit) }
}

/** Whether the element currently carries the fold's inline hide. */
function isHidden(element: HTMLElement): boolean {
  return element.style.display === 'none'
}

/** Hide or reveal one group section, writing only on a real change. */
function setHidden(element: HTMLElement, hidden: boolean): void {
  if (isHidden(element) === hidden) return
  element.style.display = hidden ? 'none' : ''
}

/** The sidebar column owning the workspace list, for observer scope. */
function sidebarColumn(): HTMLElement | undefined {
  const foot = document.querySelector(`[class*="${FOOT_AREA_FRAGMENT}"]`)
  const column = foot?.parentElement
  return column instanceof HTMLElement ? column : undefined
}

/**
 * The workspace list's fold: state plus the observer that keeps it applied
 * while React owns the list.
 */
export class WorkspaceListFold {
  private expanded = false
  private observer: MutationObserver | undefined
  private scheduled = false
  private column: HTMLElement | undefined
  private readonly button: HTMLButtonElement

  /**
   * @param options - fold limit, copy, and the toggle callback.
   */
  constructor(private readonly options: WorkspaceFoldOptions) {
    this.button = document.createElement('button')
    this.button.type = 'button'
    this.button.setAttribute(FOLD_ROW_ATTRIBUTE, '')
    this.button.addEventListener('click', () => { this.options.onToggle() })
  }

  /**
   * Apply the fold and keep it applied until disposal.
   * @returns the disposer that stops observing and restores every group.
   */
  start(): () => void {
    this.apply()
    // The document is the observer target because React may replace the column
    // itself (plugin reload, shell remount); the per-record filter below keeps
    // the callback to sidebar mutations only, so conversation streaming — which
    // mutates constantly — never reaches apply().
    this.observer = new MutationObserver((records) => {
      if (records.some(record => this.touchesSidebar(record))) this.schedule()
    })
    this.observer.observe(document.body, { childList: true, subtree: true })
    return () => { this.dispose() }
  }

  /**
   * Fold or unfold the list.
   * @param expanded - true shows every workspace, false keeps the fold limit.
   */
  setExpanded(expanded: boolean): void {
    if (this.expanded === expanded) return
    this.expanded = expanded
    this.apply()
  }

  /** Stop observing, drop the toggle row, and reveal every group again. */
  dispose(): void {
    this.observer?.disconnect()
    this.observer = undefined
    this.column = undefined
    const container = workspaceListContainer(document)
    if (container !== undefined) {
      for (const group of groupSections(container)) setHidden(group, false)
    }
    this.button.remove()
  }

  /** The sidebar column, re-resolved after a replacement or a fresh mount. */
  private sidebar(): HTMLElement | undefined {
    if (this.column?.isConnected !== true) this.column = sidebarColumn()
    return this.column
  }

  /** Whether one mutation record can affect the list this fold owns. */
  private touchesSidebar(record: MutationRecord): boolean {
    const column = this.sidebar()
    if (column === undefined) return false
    if (column.contains(record.target)) return true
    for (const node of [...record.addedNodes, ...record.removedNodes]) {
      if (node instanceof Element && (node === column || node.contains(column))) return true
    }
    return false
  }

  /** Coalesce observer bursts into one application per microtask. */
  private schedule(): void {
    if (this.scheduled) return
    this.scheduled = true
    queueMicrotask(() => {
      this.scheduled = false
      this.apply()
    })
  }

  /** Reconcile the DOM with the current fold state; every write is compared first. */
  private apply(): void {
    const container = workspaceListContainer(document)
    const groups = container === undefined ? [] : groupSections(container)
    const { visible } = splitFold(groups, this.options.limit, this.expanded)
    for (const [index, group] of groups.entries()) {
      setHidden(group, index >= visible.length)
    }
    const anchor = visible[visible.length - 1]
    if (container === undefined || anchor === undefined || groups.length <= this.options.limit) {
      this.button.remove()
      return
    }
    const label = this.expanded
      ? this.options.labels.collapse
      : this.options.labels.expand(groups.length - this.options.limit)
    if (this.button.textContent !== label) this.button.textContent = label
    const expandedState = String(this.expanded)
    if (this.button.getAttribute('aria-expanded') !== expandedState) {
      this.button.setAttribute('aria-expanded', expandedState)
    }
    if (this.button.parentElement !== container || this.button.previousElementSibling !== anchor) {
      anchor.after(this.button)
    }
  }
}
