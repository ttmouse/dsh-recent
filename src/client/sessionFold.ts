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

/** Class-name fragment of one workspace group section; the hash prefix is deployment-local. */
const GROUP_SECTION_FRAGMENT = '_groupSection'

/** Class-name fragment of the sidebar's foot area, the anchor for the list's owning column. */
const FOOT_AREA_FRAGMENT = '_footArea'

/** Row-key prefix of one Session row (`data-row-key="session:<id>"`). */
const SESSION_ROW_PREFIX = 'session:'

/** Row-key prefix of the shell's own per-group overflow control. */
const OVERFLOW_ROW_PREFIX = 'overflow:'

/** Row-key prefix of one group's header row, the group's stable address. */
const WORKSPACE_ROW_PREFIX = 'workspace:'

/** Owner attribute on the injected fold row (selecting by class would depend on our own hash). */
export const SESSION_FOLD_ROW_ATTRIBUTE = 'data-dsh-recent-session-fold'

/** Conversations one project shows while folded — the shell's own `COLLAPSED_SESSION_LIMIT`. */
export const SESSION_FOLD_LIMIT = 5

/** Conversations one expand reveals. */
export const SESSION_FOLD_STEP = 10

/**
 * Rows one activation of the shell's own control adds. That is the shell's own
 * quota — the same five this layer's window starts at. A step derives how many
 * activations it needs from this page instead of reading the DOM between them,
 * because React is free to commit the shell's new rows a task later, and a loop
 * that watched for them would keep activating a control that is already ahead.
 */
const SHELL_PAGE = 5

/** Copy for the per-project fold row under both states. */
export interface SessionFoldLabels {
  /** Label while folded; `hidden` is the number of conversations the fold holds back. */
  expand: (hidden: number) => string
  /** Label once every conversation of the project is on screen. */
  collapse: string
}

/** Construction options for {@link SessionListFold}. */
export interface SessionFoldOptions {
  /** Current copy; re-read on every application, so a locale switch needs no re-install. */
  labels: SessionFoldLabels
}

/**
 * Elements whose direct children are the workspace group sections, in render
 * order. The lookup is shared with the workspace fold: both behaviors address
 * the same list.
 * @param container - the workspace list container.
 * @returns the group sections.
 */
function groupSections(container: ParentNode): HTMLElement[] {
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
function workspaceListContainer(root: ParentNode): HTMLElement | undefined {
  const group = root.querySelector(`[class*="${GROUP_SECTION_FRAGMENT}"]`)
  const container = group?.parentElement
  return container instanceof HTMLElement ? container : undefined
}

/** The sidebar column owning the workspace list, for observer scope. */
function sidebarColumn(): HTMLElement | undefined {
  const foot = document.querySelector(`[class*="${FOOT_AREA_FRAGMENT}"]`)
  const column = foot?.parentElement
  return column instanceof HTMLElement ? column : undefined
}

/**
 * Group key the shell renders on one group's header row: the Workspace id, or
 * the empty string for the trailing bucket of sessions no Workspace claims.
 * @param group - one group section.
 * @returns the key, or undefined when the section carries no header row.
 */
export function groupKey(group: HTMLElement): string | undefined {
  const header = group.querySelector(`[data-row-key^="${WORKSPACE_ROW_PREFIX}"]`)
  const key = header?.getAttribute('data-row-key')
  return key === null || key === undefined ? undefined : key.slice(WORKSPACE_ROW_PREFIX.length)
}

/**
 * The Session rows of one group, in render order. Membership goes by the
 * nearest group section rather than by direct parentage: nested workspaces
 * render their own sections inside their parent's, and the row animator's exit
 * overlay carries clones of removed rows outside the group.
 * @param group - one group section.
 * @returns the group's own session rows.
 */
export function sessionRows(group: HTMLElement): HTMLElement[] {
  return [...group.querySelectorAll<HTMLElement>(`[data-row-key^="${SESSION_ROW_PREFIX}"]`)]
    .filter(row => row.closest(`[class*="${GROUP_SECTION_FRAGMENT}"]`) === group)
}

/**
 * The shell's own overflow control for one group, when it renders one. The
 * shell renders it while its own default quota would hold rows back, and its
 * label carries how many rows that quota hides.
 * @param group - one group section.
 * @returns the control, or undefined when the shell already renders every row.
 */
export function overflowControl(group: HTMLElement): HTMLButtonElement | undefined {
  const control = group.querySelector(`[data-row-key^="${OVERFLOW_ROW_PREFIX}"]`)
  return control instanceof HTMLButtonElement ? control : undefined
}

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
export function hiddenCountFromLabel(label: string | null): number {
  const digits = label?.match(/\d[\d,]*/)?.[0]
  if (digits === undefined) return 0
  const count = Number(digits.replaceAll(',', ''))
  return Number.isFinite(count) ? count : 0
}

/**
 * The rows one expand reveals: one step more, never past the end of the list.
 * @param revealed - rows the group currently shows.
 * @param total - conversations the group holds.
 * @param step - rows one step reveals.
 * @returns the window to show next.
 */
export function nextReveal(revealed: number, total: number, step: number = SESSION_FOLD_STEP): number {
  return Math.min(revealed + step, total)
}

/**
 * Whether one row index stays on screen: inside the window, or the conversation
 * the operator is reading — the shell reveals the current session's row in its
 * own tree, so hiding it would send the column's scroll to a row nobody sees.
 * @param index - the row's position in render order.
 * @param revealed - rows the group currently shows.
 * @param currentIndex - position of the current conversation's row, or -1 when none is selected.
 * @returns true when the row is visible.
 */
export function rowIsVisible(index: number, revealed: number, currentIndex: number): boolean {
  return index < revealed || index === currentIndex
}

/** Whether the element currently carries the fold's inline hide. */
function isHidden(element: HTMLElement): boolean {
  return element.style.display === 'none'
}

/** Hide or reveal one element, writing only on a real change. */
function setHidden(element: HTMLElement, hidden: boolean): void {
  if (isHidden(element) === hidden) return
  element.style.display = hidden ? 'none' : ''
}

/** One group's fold: the window it shows, and the row that grows it. */
interface GroupFold {
  /** Conversations on screen; starts at {@link SESSION_FOLD_LIMIT}. */
  revealed: number
  /** The injected row, owned by this layer. */
  readonly button: HTMLButtonElement
}

/**
 * The per-project session fold: state, the injected row per group, and the
 * observer that keeps the window applied while React owns the list.
 */
export class SessionListFold {
  private readonly folds = new Map<string, GroupFold>()
  private observer: MutationObserver | undefined
  private scheduled = false
  private column: HTMLElement | undefined

  /**
   * @param options - the row's copy, re-read on every application.
   */
  constructor(private readonly options: SessionFoldOptions) {}

  /**
   * Apply the fold and keep it applied until disposal.
   * @returns the disposer that stops observing and restores the shell's own control.
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
    this.observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      // The two attributes the window depends on: which conversation is
      // current, and whether a project is open at all. Style and copy writes
      // are this layer's own and must not re-enter apply().
      attributeFilter: ['aria-selected', 'aria-expanded'],
    })
    return () => { this.dispose() }
  }

  /**
   * Re-apply the window: the session catalog moved on, so a group's total, its
   * label, or the current conversation may have changed under the layer.
   */
  refresh(): void {
    this.apply()
  }

  /** Stop observing, drop the injected rows, and give every row and control back to the shell. */
  dispose(): void {
    this.observer?.disconnect()
    this.observer = undefined
    this.column = undefined
    const container = workspaceListContainer(document)
    const groups = container === undefined ? [] : groupSections(container)
    for (const group of groups) {
      for (const row of sessionRows(group)) setHidden(row, false)
      const control = overflowControl(group)
      if (control !== undefined) setHidden(control, false)
    }
    for (const fold of this.folds.values()) fold.button.remove()
    this.folds.clear()
  }

  /** The sidebar column, re-resolved after a replacement or a fresh mount. */
  private sidebar(): HTMLElement | undefined {
    if (this.column?.isConnected !== true) this.column = sidebarColumn()
    return this.column
  }

  /** Whether one mutation record can affect the list this fold owns. */
  private touchesSidebar(record: MutationRecord): boolean {
    // This layer's own writes (a row's copy, a row's position) must not feed it.
    if (record.target instanceof Node && this.ownsNode(record.target)) return false
    const column = this.sidebar()
    if (column === undefined) return false
    if (column.contains(record.target)) return true
    for (const node of [...record.addedNodes, ...record.removedNodes]) {
      if (node instanceof Element && (node === column || node.contains(column))) return true
    }
    return false
  }

  /** Whether a node is one of this layer's own rows (or inside one). */
  private ownsNode(node: Node): boolean {
    for (const fold of this.folds.values()) {
      if (node === fold.button || fold.button.contains(node)) return true
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

  /** Reconcile every group with its window; every write is compared first. */
  private apply(): void {
    const container = workspaceListContainer(document)
    const groups = container === undefined ? [] : groupSections(container)
    const live = new Set<string>()
    for (const group of groups) {
      const key = groupKey(group)
      if (key === undefined) continue
      if (this.groupOpen(group, key)) {
        live.add(key)
        this.applyGroup(group, key)
      }
    }
    // A project folded away, or a group the shell no longer renders, returns to
    // the first page: the window is a look, not a setting — the same way the
    // shell resets its own quota when a project is opened again.
    for (const [key, fold] of [...this.folds]) {
      if (live.has(key)) continue
      fold.button.remove()
      this.folds.delete(key)
    }
  }

  /**
   * Whether one group is open — its rows on screen — which is also the signal
   * that its fold starts over. A group the shell renders without a header row
   * is treated as open: its rows are there to fold.
   * @param group - one group section.
   * @param key - the group's key.
   * @returns true while the group shows its sessions.
   */
  private groupOpen(group: HTMLElement, key: string): boolean {
    const header = group.querySelector(`[data-row-key="${WORKSPACE_ROW_PREFIX}${key}"]`)
    return header?.getAttribute('aria-expanded') !== 'false'
  }

  /** Apply one open group's window, its row, and the shell's control. */
  private applyGroup(group: HTMLElement, key: string): void {
    const rows = sessionRows(group)
    const control = overflowControl(group)
    const hiddenByShell = control === undefined ? 0 : hiddenCountFromLabel(control.textContent)
    const total = rows.length + hiddenByShell
    let fold = this.folds.get(key)
    if (total <= SESSION_FOLD_LIMIT) {
      // Nothing to fold: the project fits the window and the shell holds nothing
      // back, so the column keeps exactly the rows the shell drew.
      if (fold !== undefined) {
        fold.button.remove()
        this.folds.delete(key)
      }
      for (const row of rows) setHidden(row, false)
      if (control !== undefined) setHidden(control, false)
      return
    }
    if (fold === undefined) {
      fold = { revealed: SESSION_FOLD_LIMIT, button: this.createRow(key) }
      this.folds.set(key, fold)
    }
    const current = rows.findIndex(row => row.getAttribute('aria-selected') === 'true')
    const hidden = rows.filter((_row, index) => !rowIsVisible(index, fold.revealed, current))
    for (const [index, row] of rows.entries()) setHidden(row, !rowIsVisible(index, fold.revealed, current))
    // The shell's own control gives way to this layer's row: one control per
    // project, at the same place, carrying the count this window holds back.
    if (control !== undefined) setHidden(control, true)
    const count = hidden.length + hiddenByShell
    const label = count > 0 ? this.options.labels.expand(count) : this.options.labels.collapse
    if (fold.button.textContent !== label) fold.button.textContent = label
    const expanded = String(count === 0)
    if (fold.button.getAttribute('aria-expanded') !== expanded) {
      fold.button.setAttribute('aria-expanded', expanded)
    }
    const anchor = rows[Math.min(fold.revealed, rows.length) - 1] ?? group.firstElementChild
    if (anchor !== null && (fold.button.parentElement !== group || fold.button.previousElementSibling !== anchor)) {
      anchor.after(fold.button)
    }
  }

  /** Build one group's fold row (namespace-exact button, owner attribute instead of a class). */
  private createRow(key: string): HTMLButtonElement {
    const button = document.createElement('button')
    button.type = 'button'
    button.setAttribute(SESSION_FOLD_ROW_ATTRIBUTE, '')
    button.setAttribute('aria-expanded', 'false')
    button.addEventListener('click', () => { this.step(key) })
    return button
  }

  /** Reveal one step, or fold the project back to its first page once everything is on screen. */
  private step(key: string): void {
    const container = workspaceListContainer(document)
    const group = container === undefined
      ? undefined
      : groupSections(container).find(section => groupKey(section) === key)
    const fold = this.folds.get(key)
    if (group === undefined || fold === undefined) return
    const control = overflowControl(group)
    const hiddenByShell = control === undefined ? 0 : hiddenCountFromLabel(control.textContent)
    const total = sessionRows(group).length + hiddenByShell
    if (fold.revealed >= total) {
      fold.revealed = SESSION_FOLD_LIMIT
      this.releaseShell(control)
    } else {
      const want = nextReveal(fold.revealed, total)
      this.growShell(control, want, sessionRows(group).length)
      fold.revealed = Math.min(want, total)
    }
    this.apply()
  }

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
  private growShell(control: HTMLButtonElement | undefined, want: number, rendered: number): void {
    if (control === undefined) return
    if (control.getAttribute('aria-expanded') === 'true') return
    const pages = Math.max(0, Math.ceil((want - rendered) / SHELL_PAGE))
    for (let page = 0; page < pages; page++) control.click()
  }

  /**
   * Give the shell's own control back its default quota, once the window folds
   * a project back to five rows: the rows it renders past the window are then
   * the shell's to drop, and the column sheds them instead of hiding them.
   * Only an expanded control is activated — anywhere else the activation would
   * ask for one more page instead.
   * @param control - the shell's own overflow control.
   */
  private releaseShell(control: HTMLButtonElement | undefined): void {
    if (control === undefined) return
    if (control.getAttribute('aria-expanded') !== 'true') return
    control.click()
  }
}
