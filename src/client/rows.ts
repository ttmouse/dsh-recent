/**
 * Derivation for the sidebar 最近 section: one flat, newest-first jump list
 * over the sessions of every workspace. Visibility mirrors the workspace
 * browser's own rules (`ui-workspace`'s tree derivation) so the two surfaces
 * never disagree about which sessions hold history: archived sessions are
 * hidden, subagent-origin rows belong to their parent's catalog, and blank
 * provisional sessions — which hold no history at all — never appear.
 */
import type { SessionId, SessionListState, WorkspaceView } from '@deepseek-ai/dsh-client-runtime/client'

/** Rows the derivation hands the section before its fold; the fold shows {@link FOLD_LIMIT} of them. */
export const RECENT_ROW_LIMIT = 20

/**
 * Items each folded list shows. The shell caps one Workspace's sessions at five
 * the same way (`COLLAPSED_SESSION_LIMIT`), and each list here reserves space
 * for the other, so one number serves the workspace list and the 最近 list
 * alike.
 */
export const FOLD_LIMIT = 5

/** Relative-time bucket of a row's trailing label. */
export type RecentTimeUnit = 'now' | 'minutes' | 'hours' | 'days' | 'months' | 'years'

/** Structured relative time: the bucket plus its magnitude (0 for 'now'). */
export interface RecentTime {
  unit: RecentTimeUnit
  n: number
}

/**
 * Compact relative time for a row, as a structured bucket the component
 * localizes ("now"/"5min"/"3h" in en, "刚刚"/"5分钟" in zh). Bucket edges match
 * the workspace browser's, so a session reads the same age on both surfaces.
 * @param updatedAt - epoch ms of the session's last activity.
 * @param now - current epoch ms (injected for pure rendering).
 * @returns the row's trailing time bucket and magnitude.
 */
export function relativeTime(updatedAt: number, now: number): RecentTime {
  const MIN = 60_000
  const HOUR = 3_600_000
  const DAY = 86_400_000
  const diff = Math.max(0, now - updatedAt)
  if (diff < MIN) return { unit: 'now', n: 0 }
  if (diff < HOUR) return { unit: 'minutes', n: Math.floor(diff / MIN) }
  if (diff < DAY) return { unit: 'hours', n: Math.floor(diff / HOUR) }
  if (diff < 30 * DAY) return { unit: 'days', n: Math.floor(diff / DAY) }
  if (diff < 365 * DAY) return { unit: 'months', n: Math.floor(diff / (30 * DAY)) }
  return { unit: 'years', n: Math.floor(diff / (365 * DAY)) }
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
  /** Waiting on this user (approval, question, or plan review). */
  waiting: boolean
  /** Session is the current selection. */
  current: boolean
}

/** Everything the derivation reads; the component supplies it from props. */
export interface RecentRowsInput {
  /** Session metadata authority (list rows plus the current selection). */
  list: SessionListState
  /** Workspace registry order, membership, and display titles. */
  workspaces: readonly WorkspaceView[]
  /** Registry-global archive set; members are hidden on every surface. */
  archivedSessionIds: readonly SessionId[]
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
 * Derive the 最近 rows: every session that holds history, across all
 * workspaces, newest first, capped at {@link RECENT_ROW_LIMIT}.
 * @param input - list, workspace registry, archive set, and the localized ungrouped label.
 * @returns rows in render order.
 */
export function deriveRecentRows(input: RecentRowsInput): RecentRow[] {
  const { list, workspaces, archivedSessionIds } = input
  const archived = new Set<SessionId>(archivedSessionIds)
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
    rows.push({
      id: session.id,
      title: session.displayTitle,
      workspace: workspaceOf.get(session.id) ?? pathLabel(session.cwd) ?? input.ungroupedLabel,
      updatedAt: session.updatedAt,
      running: session.running,
      waiting: session.pendingInteraction !== undefined,
      current: session.id === list.current,
    })
  }
  rows.sort((a, b) => (b.updatedAt !== a.updatedAt ? b.updatedAt - a.updatedAt : a.id < b.id ? -1 : 1))
  return rows.slice(0, RECENT_ROW_LIMIT)
}
