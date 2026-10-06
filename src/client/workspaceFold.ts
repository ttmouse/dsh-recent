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

import type { SessionListState } from '@deepseek-ai/dsh-api-session-controller/client'
import type { WorkspaceView } from '@deepseek-ai/dsh-api-workspace-controller/client'
import type { SessionId } from '@deepseek-ai/dsh-session/types'

/** Class-name fragment of one workspace group section; the hash prefix is deployment-local. */
const GROUP_SECTION_FRAGMENT = '_groupSection'

/** Class-name fragment of the workspace browser's section header. */
const SECTION_HEADER_FRAGMENT = '_sectionHeader'

/** Class-name fragment of the header's label; the marker follows it. */
const SECTION_LABEL_FRAGMENT = '_sectionLabel'

/** Class-name fragment of the sidebar's foot area, the anchor for the list's owning column. */
const FOOT_AREA_FRAGMENT = '_footArea'

/** Owner attribute on the injected toggle row (selecting by class would depend on our own hash). */
export const FOLD_ROW_ATTRIBUTE = 'data-dsh-recent-fold'

/** Owner attribute on the section header, carrying its collapse state. */
export const SECTION_COLLAPSED_ATTRIBUTE = 'data-dsh-recent-section'

/** Owner attribute on the injected chevron inside the section header. */
export const SECTION_CHEVRON_ATTRIBUTE = 'data-dsh-recent-section-chevron'

/**
 * Disclosure chevron geometry, copied from the shell's own thin chevron
 * (`IconChevronRightOutlineRegular`: 16-unit box, 1px stroke) so the sidebar
 * shows one arrow, not two glyph families. It points right while the list is
 * folded and takes a quarter turn to point down while the list is open — the
 * arrow carries the fold direction, the way the Codex sidebar's does.
 */
const CHEVRON_PATH = 'M6 12L9.29289 8.70711C9.68342 8.31658 9.68342 7.68342 9.29289 7.29289L6 4'

/** The icon grid {@link CHEVRON_PATH} is drawn in (the shell's 16-unit box). */
const CHEVRON_VIEW_BOX = '0 0 16 16'

/** Stroke width of the shell's regular-tier outline icons. */
const CHEVRON_STROKE_WIDTH = '1'

/** Copy for the fold row under both states. */
export interface FoldLabels {
  /** Label while folded; `hidden` is the number of items the fold holds back. */
  expand: (hidden: number) => string
  /** Label while unfolded. */
  collapse: string
}

/** Construction options for {@link WorkspaceListFold}. */
export interface WorkspaceFoldOptions {
  /** Groups kept visible while the list is folded (ignored while collapsed). */
  limit: number
  /** Current copy; re-read on every application, so a locale switch needs no re-install. */
  labels: FoldLabels
  /**
   * Newest history time of one group, by the key {@link groupKey} reads off its
   * header row; a group whose key is absent from this lookup ranks last. Read on
   * every application, so the owner can swap the map as the catalog moves.
   */
  recency: (key: string) => number | undefined
  /** Called when the operator clicks the toggle row. */
  onToggle: () => void
  /** Called when the operator clicks the section header chevron. */
  onToggleSection: () => void
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
 * Row-key prefix the shell writes on a group's own header row
 * (`data-row-key="workspace:<group key>"`), the one stable address a group
 * section carries: its classes are hashed and its markup is React's.
 */
const WORKSPACE_ROW_KEY = 'workspace:'

/** Group key of the shell's trailing bucket: every Session no Workspace claims. */
export const UNGROUPED_KEY = ''

/**
 * Group key the shell renders on one group's header row: the Workspace id, or
 * {@link UNGROUPED_KEY} for the trailing bucket. The group's own header row is
 * its first addressable row, ahead of the session rows it holds.
 * @param group - one group section.
 * @returns the key, or undefined when the section carries no header row.
 */
export function groupKey(group: HTMLElement): string | undefined {
  const header = group.querySelector(`[data-row-key^="${WORKSPACE_ROW_KEY}"]`)
  const key = header?.getAttribute('data-row-key')
  return key === null || key === undefined ? undefined : key.slice(WORKSPACE_ROW_KEY.length)
}

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
export function groupRecency(input: {
  list: SessionListState
  workspaces: readonly WorkspaceView[]
  archivedSessionIds: readonly SessionId[]
}): Map<string, number> {
  const archived = new Set<SessionId>(input.archivedSessionIds)
  const owner = new Map<SessionId, string>()
  for (const workspace of input.workspaces) {
    for (const id of workspace.sessionIds) {
      if (!owner.has(id)) owner.set(id, workspace.workspaceId)
    }
  }
  const newest = new Map<string, number>()
  for (const id of input.list.ids) {
    const session = input.list.byId[id]
    if (session === undefined) continue
    if (session.origin === 'subagent' || session.blank || archived.has(session.id)) continue
    const key = owner.get(session.id) ?? UNGROUPED_KEY
    const held = newest.get(key)
    if (held === undefined || session.updatedAt > held) newest.set(key, session.updatedAt)
  }
  return newest
}

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
export function splitByRecency<T>(
  groups: readonly T[],
  limit: number,
  expanded: boolean,
  recency: (group: T) => number | undefined,
): { visible: T[]; hidden: T[] } {
  if (expanded || groups.length <= limit) return { visible: [...groups], hidden: [] }
  const ranked = groups
    .map((group, index) => {
      const at = recency(group)
      return { group, index, at: at !== undefined && Number.isFinite(at) ? at : 0 }
    })
    .sort((a, b) => (b.at !== a.at ? b.at - a.at : a.index - b.index))
  const kept = new Set(ranked.slice(0, limit).map(entry => entry.group))
  return { visible: groups.filter(group => kept.has(group)), hidden: groups.filter(group => !kept.has(group)) }
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

/** Build the injected chevron (namespace-exact SVG, sized like the shell's 14px icons). */
function createChevron(): SVGSVGElement {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  svg.setAttribute('width', '14')
  svg.setAttribute('height', '14')
  svg.setAttribute('viewBox', CHEVRON_VIEW_BOX)
  svg.setAttribute('fill', 'none')
  svg.setAttribute('aria-hidden', 'true')
  svg.setAttribute(SECTION_CHEVRON_ATTRIBUTE, '')
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path')
  path.setAttribute('d', CHEVRON_PATH)
  path.setAttribute('stroke', 'currentColor')
  path.setAttribute('stroke-width', CHEVRON_STROKE_WIDTH)
  svg.append(path)
  return svg
}

/**
 * The workspace section's collapse plus the list's fold: state, the injected
 * chevron and fold row, and the observer that keeps both applied while React
 * owns the list.
 */
export class WorkspaceListFold {
  private collapsed = false
  private expanded = false
  private observer: MutationObserver | undefined
  private scheduled = false
  private column: HTMLElement | undefined
  private header: HTMLElement | undefined
  private readonly chevron: SVGSVGElement
  private readonly button: HTMLButtonElement
  /** Stable header-click handler, so {@link dispose} can always remove it. */
  private readonly onHeaderClick = (): void => { this.options.onToggleSection() }

  /**
   * @param options - fold limit, copy, the group ranking, and the two toggle callbacks.
   */
  constructor(private readonly options: WorkspaceFoldOptions) {
    this.chevron = createChevron()
    this.button = document.createElement('button')
    this.button.type = 'button'
    this.button.setAttribute(FOLD_ROW_ATTRIBUTE, '')
    this.button.addEventListener('click', () => { this.options.onToggle() })
  }

  /**
   * Apply both behaviors and keep them applied until disposal.
   * @returns the disposer that stops observing and restores the list and header.
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
   * Collapse or expand the whole workspace section.
   * @param collapsed - true hides the list, leaving the header as the row that brings it back.
   */
  setCollapsed(collapsed: boolean): void {
    if (this.collapsed === collapsed) return
    this.collapsed = collapsed
    this.apply()
  }

  /**
   * Fold or unfold the list.
   * @param expanded - true shows every group, false keeps the fold limit.
   */
  setExpanded(expanded: boolean): void {
    if (this.expanded === expanded) return
    this.expanded = expanded
    this.apply()
  }

  /**
   * Re-rank the groups: the session catalog moved on, so which groups the fold
   * keeps while folded may have changed. The owner calls this after installing
   * a new {@link WorkspaceFoldOptions.recency} lookup.
   */
  refresh(): void {
    this.apply()
  }

  /** Stop observing, drop the injected controls, and reveal every group again. */
  dispose(): void {
    this.observer?.disconnect()
    this.observer = undefined
    this.column = undefined
    const container = workspaceListContainer(document)
    if (container !== undefined) {
      for (const group of groupSections(container)) setHidden(group, false)
    }
    this.button.remove()
    this.chevron.remove()
    // The section itself belongs to React: the component's own unmount removes
    // the portal's nodes, so tearing them out here would leave React updating a
    // detached tree.
    if (this.header?.isConnected === true) {
      this.header.removeEventListener('click', this.onHeaderClick)
      this.header.removeAttribute(SECTION_COLLAPSED_ATTRIBUTE)
      this.header.removeAttribute('aria-expanded')
      this.header.style.cursor = ''
      this.header.style.userSelect = ''
    }
    this.header = undefined
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

  /** Reconcile the DOM with the current states; every write is compared first. */
  private apply(): void {
    const container = workspaceListContainer(document)
    const groups = container === undefined ? [] : groupSections(container)
    this.applySectionHeader()
    if (container === undefined) {
      this.button.remove()
      return
    }
    const { visible, hidden } = splitByRecency(
      groups, this.options.limit, this.expanded, group => this.groupRecency(group),
    )
    const kept = new Set(visible)
    for (const group of groups) setHidden(group, this.collapsed || !kept.has(group))
    // Collapsed, the header alone brings the list back; the fold row would
    // repeat the same offer one line below it.
    if (this.collapsed) {
      this.button.remove()
      return
    }
    // The row trails the last group the fold keeps, in render order, so it reads
    // as the boundary of everything it holds back no matter which groups won the
    // ranking; the groups it hides stay in the list, simply out of sight.
    const anchor = visible.at(-1)
    if (anchor === undefined || groups.length <= this.options.limit) {
      this.button.remove()
      return
    }
    const label = this.expanded ? this.options.labels.collapse : this.options.labels.expand(hidden.length)
    if (this.button.textContent !== label) this.button.textContent = label
    const expandedState = String(this.expanded)
    if (this.button.getAttribute('aria-expanded') !== expandedState) {
      this.button.setAttribute('aria-expanded', expandedState)
    }
    if (this.button.parentElement !== container || this.button.previousElementSibling !== anchor) {
      anchor.after(this.button)
    }
  }

  /**
   * Newest history time the owner reports for one group, or undefined when the
   * section carries no addressable key or the owner knows no history for it —
   * both rank the group last, which is what a folder that holds nothing recent
   * deserves.
   * @param group - one group section.
   * @returns the group's newest history time.
   */
  private groupRecency(group: HTMLElement): number | undefined {
    const key = groupKey(group)
    return key === undefined ? undefined : this.options.recency(key)
  }

  /**
   * Adopt the shell's section header: mark it as the collapse toggle, place the
   * chevron, and route clicks on it to the owner. The header's own buttons (view
   * options, search) and the project rows' drag targets keep their own handlers:
   * this listener only sees a click that reached the header itself.
   */
  private applySectionHeader(): void {
    const header = document.querySelector<HTMLElement>(`[class*="${SECTION_HEADER_FRAGMENT}"]`)
    if (header === null) {
      this.header = undefined
      return
    }
    if (this.header !== header) {
      this.header = header
      header.setAttribute('role', 'button')
      header.style.cursor = 'pointer'
      header.style.userSelect = 'none'
      header.addEventListener('click', this.onHeaderClick)
    }
    const collapsedState = String(this.collapsed)
    if (header.getAttribute(SECTION_COLLAPSED_ATTRIBUTE) !== collapsedState) {
      header.setAttribute(SECTION_COLLAPSED_ATTRIBUTE, collapsedState)
      header.setAttribute('aria-expanded', String(!this.collapsed))
    }
    // The arrow carries the fold direction: right while the list is folded, a
    // quarter turn down while it is open.
    const rotation = this.collapsed ? '' : 'rotate(90deg)'
    if (this.chevron.style.transform !== rotation) this.chevron.style.transform = rotation
    // Codex places the disclosure triangle right after the label ("<name> ▸"),
    // so the marker goes after the label element — not at the end of the header,
    // which the shell lays out right-aligned against its own trailing controls.
    const label = header.querySelector(`[class*="${SECTION_LABEL_FRAGMENT}"]`)
    const anchor = label instanceof HTMLElement ? label : header.firstElementChild
    if (anchor !== null && this.chevron.previousElementSibling !== anchor) anchor.after(this.chevron)
  }
}
