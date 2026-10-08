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
import type { SessionListState } from '@deepseek-ai/dsh-api-session-controller/client'
import type { WorkspaceView } from '@deepseek-ai/dsh-api-workspace-controller/client'
import type { SessionStatusSnapshot } from '@deepseek-ai/dsh-client-ui-session/client'
import type { SessionId } from '@deepseek-ai/dsh-session/types'

/**
 * Rows the section renders per page. The derivation hands over every session
 * that holds history, and the section renders a window over that list: one page
 * at first, one more page each time the operator scrolls the column to the end
 * of what is rendered.
 */
export const RECENT_PAGE_SIZE = 20

/**
 * Items the workspace list keeps while folded. The shell caps one Workspace's
 * sessions at five the same way (`COLLAPSED_SESSION_LIMIT`), so the column's two
 * folds trade the same number of rows.
 */
export const FOLD_LIMIT = 5

/**
 * Pending interactions a sidebar session row marks. Session-scoped domains
 * publish their own interaction objects, and the shell's rows carry a dot and a
 * compact trailing label for exactly these three kinds; every other kind stays
 * behind the surface that owns it.
 */
export type RecentPending = 'approval' | 'plan-review' | 'question'

/**
 * The rendered window after the operator reaches its end: one more page of
 * older sessions, never past the end of the history.
 * @param rendered - rows the section currently renders.
 * @param total - rows the derivation handed over.
 * @param page - rows one page holds.
 * @returns the window to render next.
 */
export function growWindow(rendered: number, total: number, page: number = RECENT_PAGE_SIZE): number {
  return Math.min(rendered + page, total)
}

/**
 * The pending-interaction kind the shell's rows mark, or undefined for a kind
 * no row offers.
 * @param kind - the pending interaction's domain kind.
 * @returns the markable kind.
 */
export function marksWaiting(kind: string | undefined): RecentPending | undefined {
  return kind === 'approval' || kind === 'plan-review' || kind === 'question' ? kind : undefined
}

/** One rendered 最近 row. */
export interface RecentRow {
  id: SessionId
  /** Latest durable title, or the project directory name when the log has none yet. */
  title: string
  /** Owning workspace title, or the ungrouped label when no workspace claims the session. */
  workspace: string
  updatedAt: number
  running: boolean
  /** Pending interaction awaiting this user, as the row's amber dot and trailing label. */
  pending: RecentPending | undefined
  /** Session is the current selection. */
  current: boolean
  /** Session is pinned, so the row carries the resting pin marker. */
  pinned: boolean
}

/** Everything the derivation reads; the component supplies it from props. */
export interface RecentRowsInput {
  /** Session catalog: rows, addresses, and each row's local retain counts. */
  list: SessionListState
  /** Workspace registry order, membership, and display titles. */
  workspaces: readonly WorkspaceView[]
  /** Registry-global archive set; members are hidden on every surface. */
  archivedSessionIds: readonly SessionId[]
  /** Registry-global pin set; members lead their group and mark their row. */
  pinnedSessionIds: readonly SessionId[]
  /** Unified UI status by Session: live running state and the pending interaction. */
  status: SessionStatusSnapshot
  /** Localized label for sessions outside every workspace. */
  ungroupedLabel: string
}

/** Workspace display title of a session outside the registry: the path's last segment. */
function pathLabel(cwd: string | undefined): string | undefined {
  if (cwd === undefined || cwd === '') return undefined
  const base = cwd.replace(/[/\\]+$/, '').split(/[/\\]/).pop()
  return base !== undefined && base !== '' ? base : cwd
}

/**
 * The session the main panel shows: the one holding the main view's local
 * reference count. Selection lives in that reference, not in the catalog, so
 * the list state carries no `current` field to read.
 * @param list - the session catalog.
 * @returns the main-view session id, or undefined while no session is selected.
 */
function currentSessionId(list: SessionListState): SessionId | undefined {
  return Object.values(list.byId).find(session => (session.retainedBy.mainView ?? 0) > 0)?.id
}

/**
 * Derive the 最近 rows: every session that holds history, across all
 * workspaces. Still-running sessions lead, then idle ones newest first. The list is complete — the section decides how much
 * of it to render at once, so scrolling can reach older sessions without the
 * derivation having thrown them away.
 * @param input - list, workspace registry, archive and pin sets, session status, and the localized ungrouped label.
 * @returns rows in render order.
 */
export function deriveRecentRows(input: RecentRowsInput): RecentRow[] {
  const { list, workspaces, archivedSessionIds, pinnedSessionIds, status } = input
  const archived = new Set<SessionId>(archivedSessionIds)
  const pinned = new Set<SessionId>(pinnedSessionIds)
  const current = currentSessionId(list)
  const workspaceOf = new Map<SessionId, string>()
  for (const workspace of workspaces) {
    for (const id of workspace.sessionIds) {
      if (!workspaceOf.has(id)) workspaceOf.set(id, workspace.title)
    }
  }
  const rows: RecentRow[] = []
  for (const id of list.ids) {
    const session = list.byId[id]
    if (session === undefined) continue
    if (session.origin === 'subagent') continue
    if (session.blank) continue
    if (archived.has(session.id)) continue
    const live = status.get(session.id)
    rows.push({
      id: session.id,
      title: session.displayTitle,
      workspace: workspaceOf.get(session.id) ?? pathLabel(session.cwd) ?? input.ungroupedLabel,
      updatedAt: session.updatedAt,
      running: live?.running ?? session.running,
      pending: marksWaiting(live?.pendingInteraction?.kind),
      current: session.id === current,
      pinned: pinned.has(session.id),
    })
  }
  // Still-working conversations lead the section regardless of when their log
  // was last written: a session that has been running for a long stretch
  // without a new durable entry would otherwise sink below idle ones that were
  // merely touched more recently, while its spinner says it is the live one.
  rows.sort((a, b) => {
    if (a.running !== b.running) return a.running ? -1 : 1
    return b.updatedAt !== a.updatedAt ? b.updatedAt - a.updatedAt : a.id < b.id ? -1 : 1
  })
  return rows
}
