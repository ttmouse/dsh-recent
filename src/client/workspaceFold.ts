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

/**
 * The local-store key holding the list's unfolded choice. Expanding the list is
 * a setting rather than a look: the operator asked to see every project, and a
 * collapsed rail or a page reload must not quietly revoke that.
 */
const EXPANDED_STORE_KEY = 'dsh-recent:view.workspacesExpanded'

/**
 * Read the stored unfolded choice.
 * @param store - the storage to read (the browser's local store, or a test double).
 * @returns whether the list should render unfolded; anything but the exact on
 * value degrades to the folded default.
 */
export function loadWorkspaceExpanded(store: Pick<Storage, 'getItem'> = window.localStorage): boolean {
  try {
    return store.getItem(EXPANDED_STORE_KEY) === '1'
  } catch {
    return false
  }
}

/**
 * Store the unfolded choice. A failed write (private mode, quota) is not an
 * error the section can act on — the choice still holds for this visit.
 * @param expanded - whether the list should render unfolded.
 * @param store - the storage to write (the browser's local store, or a test double).
 */
export function saveWorkspaceExpanded(expanded: boolean, store: Pick<Storage, 'setItem'> = window.localStorage): void {
  try {
    store.setItem(EXPANDED_STORE_KEY, expanded ? '1' : '0')
  } catch {
    // Held for this visit only; nothing to report into the sidebar.
  }
}

/** Owner attribute on the injected toggle row (selecting by class would depend on our own hash). */
export const FOLD_ROW_ATTRIBUTE = 'data-dsh-recent-fold'

/** Owner attribute on the section header, carrying its collapse state. */
export const SECTION_COLLAPSED_ATTRIBUTE = 'data-dsh-recent-section'

/** Owner attribute on the injected chevron inside the section header. */
export const SECTION_CHEVRON_ATTRIBUTE = 'data-dsh-recent-section-chevron'

/** Owner attribute on the injected per-group session overflow row. */
export const SESSION_OVERFLOW_ATTRIBUTE = 'data-dsh-recent-session-overflow'

/**
 * Idle Session rows the shell itself shows per Workspace before its own
 * overflow control (`COLLAPSED_SESSION_LIMIT` in the shell's browser). The
 * shell exempts running, blank, and subagent-carrying sessions from that
 * quota; this plugin's per-group fold does not — {@link SESSION_FOLD_LIMIT}
 * is the strict newest-rows count it enforces regardless of state.
 */
export const SHELL_SESSION_LIMIT = 5

/**
 * Session rows one group shows while folded: the newest rows by history time,
 * whatever their live state. The operator asked for "the five most recent
 * conversations, period", so a running session older than the fifth newest
 * leaves the column with the idle ones.
 */
export const SESSION_FOLD_LIMIT = 5

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
  /**
   * Label of one group's session overflow row while that group holds back rows;
   * `hidden` is the number of session rows out of sight.
   */
  sessionExpand: (hidden: number) => string
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
  /**
   * Newest history time of one Session, by the id {@link sessionRows} reads off
   * its row; a row whose id is absent (a row the catalog no longer knows) ranks
   * last. Read on every application, so the owner can swap the lookup as the
   * catalog moves.
   */
  sessionRecency: (id: string) => number | undefined
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

/** Row-key prefix the shell writes on one session row (`data-row-key="session:<id>"`). */
const SESSION_ROW_KEY = 'session:'

/** Row-key prefix of the shell's own per-group overflow row (`overflow:<group key>`). */
const OVERFLOW_ROW_KEY = 'overflow:'

/**
 * The session rows one group section holds, in render order. Direct-children
 * only: the group's header row and its own overflow row sit beside them, and a
 * nested group's rows belong to that group.
 * @param group - one group section.
 * @returns the session rows, in the order the shell rendered them.
 */
export function sessionRows(group: HTMLElement): HTMLElement[] {
  return [...group.children].filter(
    (child): child is HTMLElement =>
      child instanceof HTMLElement && (child.getAttribute('data-row-key') ?? '').startsWith(SESSION_ROW_KEY),
  )
}

/** Session id of one session row, by the key {@link sessionRows} matched. */
export function sessionRowId(row: HTMLElement): string {
  return (row.getAttribute('data-row-key') ?? '').slice(SESSION_ROW_KEY.length)
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
  /** Group keys the operator unfolded past {@link SESSION_FOLD_LIMIT} sessions. */
  private readonly expandedGroups = new Set<string>()
  /** One overflow row per folded group, keyed by {@link groupKey}. */
  private readonly sessionButtons = new Map<string, HTMLButtonElement>()
  private observer: MutationObserver | undefined
  private scheduled = false
  private column: HTMLElement | undefined
  private header: HTMLElement | undefined
  private readonly chevron: SVGSVGElement
  private readonly button: HTMLButtonElement
  /** Stable header-click handler, so {@link dispose} can always remove it. */
  private readonly onHeaderClick = (): void => { this.options.onToggleSection() }
  /**
   * The shell's own overflow row (`overflow:<group key>`) expands that group
   * past the shell's idle-session quota; this layer must not pull those rows
   * back out of sight behind the operator. One document-level listener covers
   * every group, present and future.
   */
  private readonly onDocumentClick = (event: MouseEvent): void => {
    const target = event.target instanceof Element ? event.target.closest(`[data-row-key^="${OVERFLOW_ROW_KEY}"]`) : null
    if (!(target instanceof HTMLElement)) return
    const key = (target.getAttribute('data-row-key') ?? '').slice(OVERFLOW_ROW_KEY.length)
    if (key === '') return
    this.expandedGroups.add(key)
    this.apply()
  }

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
    document.addEventListener('click', this.onDocumentClick)
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
    // Re-showing the column restores the folded default (the owner drops the
    // wide state, which lands here): the per-group session unfolds are the same
    // look, not a setting, so they fall back with it.
    if (!expanded) this.expandedGroups.clear()
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
    document.removeEventListener('click', this.onDocumentClick)
    const container = workspaceListContainer(document)
    if (container !== undefined) {
      for (const group of groupSections(container)) {
        setHidden(group, false)
        for (const row of sessionRows(group)) setHidden(row, false)
      }
    }
    for (const button of this.sessionButtons.values()) button.remove()
    this.sessionButtons.clear()
    this.expandedGroups.clear()
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
    const seenGroups = new Set<string>()
    for (const group of groups) {
      setHidden(group, this.collapsed || !kept.has(group))
      const key = this.applySessionFold(group)
      if (key !== undefined) seenGroups.add(key)
    }
    // Groups the shell stopped rendering leave their overflow rows behind in
    // this map; nothing else will remove them.
    for (const [key, button] of this.sessionButtons) {
      if (!seenGroups.has(key)) {
        button.remove()
        this.sessionButtons.delete(key)
        this.expandedGroups.delete(key)
      }
    }
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
   * Enforce the strict per-group session fold: whichever rows the shell chose
   * to render, the group shows only the {@link SESSION_FOLD_LIMIT} newest by
   * history time — running and blank rows included, unlike the shell's own
   * quota — and the rest wait behind one overflow row. The write pattern is the
   * list fold's: rows are hidden with a compared-first inline style and the
   * overflow row is placed only when its position is wrong, so the observer
   * never feeds itself.
   * @param group - one group section.
   * @returns the group's key, or undefined when it carries no addressable header
   * (its rows are then left exactly as the shell rendered them).
   */
  private applySessionFold(group: HTMLElement): string | undefined {
    const key = groupKey(group)
    const rows = sessionRows(group)
    if (key === undefined || rows.length <= SESSION_FOLD_LIMIT || this.expandedGroups.has(key)) {
      for (const row of rows) setHidden(row, false)
      this.dropSessionButton(key)
      return key
    }
    const ranked = rows
      .map((row, index) => {
        const at = this.options.sessionRecency(sessionRowId(row))
        return { row, index, at: at !== undefined && Number.isFinite(at) ? at : 0 }
      })
      .sort((a, b) => (b.at !== a.at ? b.at - a.at : a.index - b.index))
    const kept = new Set(ranked.slice(0, SESSION_FOLD_LIMIT).map(entry => entry.row))
    for (const row of rows) setHidden(row, !kept.has(row))
    // The row trails the last session the fold keeps, in render order, so it
    // reads as the boundary of everything the group holds back.
    const anchor = ranked.filter(entry => kept.has(entry.row)).at(-1)?.row
    if (anchor !== undefined) this.syncSessionButton(key, anchor, rows.length - SESSION_FOLD_LIMIT)
    return key
  }

  /** Place one group's overflow row, writing only when its position moved. */
  private syncSessionButton(key: string, anchor: HTMLElement, hiddenCount: number): void {
    let button = this.sessionButtons.get(key)
    if (button === undefined) {
      button = document.createElement('button')
      button.type = 'button'
      button.setAttribute(SESSION_OVERFLOW_ATTRIBUTE, '')
      button.setAttribute('aria-expanded', 'false')
      button.addEventListener('click', () => {
        this.expandedGroups.add(key)
        this.apply()
      })
      this.sessionButtons.set(key, button)
    }
    const label = this.options.labels.sessionExpand(hiddenCount)
    if (button.textContent !== label) button.textContent = label
    if (button.parentElement !== anchor.parentElement || button.previousElementSibling !== anchor) {
      anchor.after(button)
    }
  }

  /** Remove one group's overflow row, if it has one. */
  private dropSessionButton(key: string | undefined): void {
    if (key === undefined) return
    const button = this.sessionButtons.get(key)
    if (button === undefined) return
    button.remove()
    this.sessionButtons.delete(key)
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
    // Rail mode (the sidebar collapsed) renders no label and also unmounts the
    // workspace list, so the anchor must never fall back to the header's first
    // child here: once the label is gone, that child is this chevron itself, and
    // `chevron.after(chevron)` would remove and re-insert the node against
    // itself — a childList mutation per application, re-observed, forever — which
    // froze the renderer's event loop at 100% CPU. Rail mode therefore only parks
    // the arrow (a style write, which the childList observer never sees) and
    // waits for the label, and the wide placement is guarded on the exact
    // previous sibling so a settled header is never touched again.
    const label = header.querySelector(`[class*="${SECTION_LABEL_FRAGMENT}"]`)
    if (!(label instanceof HTMLElement)) {
      if (this.chevron.style.display !== 'none') this.chevron.style.display = 'none'
      return
    }
    if (this.chevron.style.display !== '') this.chevron.style.display = ''
    if (this.chevron.previousElementSibling !== label) label.after(this.chevron)
  }
}
