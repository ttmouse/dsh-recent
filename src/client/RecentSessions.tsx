/**
 * The sidebar 最近 section: every workspace's newest sessions flattened into
 * one jump list, registered into the sidebar's `sidebar.footer.action` seat so
 * it renders between the workspace tree and the Settings foot — find the
 * project folder above, open the latest work below.
 *
 * The same component owns the fold control for the shell's workspace list
 * ({@link WorkspaceListFold}), so both lists show five items and hold the rest
 * behind one identically styled row: the column stays compact by default, and
 * an expanded list simply flows below the workspace list — no fixed bottom
 * block, the tree's own scroll area absorbs the squeeze.
 *
 * The seat hands the component the column's `wide` flag only; session and
 * workspace facts arrive through the framework standard kit
 * (`useSessions`/`useWorkspaces`), and opening a session arrives through the
 * registration's injected face. A 56px rail has no room for a list, so the
 * section renders only while the column is wide — and re-showing the column
 * returns both lists to their folded default.
 */
import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { StateDot } from '@deepseek-ai/dsh-client-ui-primitives'
import type { PropsLocale, PropsRuntime, TranslateNS } from '@deepseek-ai/dsh-client-ui-slots'
import type { SessionId } from '@deepseek-ai/dsh-client-runtime/client'
import type { RecentRow } from './rows.ts'
import { deriveRecentRows, FOLD_LIMIT, relativeTime } from './rows.ts'
import { WorkspaceListFold } from './workspaceFold.ts'
import { NS } from './locales.ts'
import css from './RecentSessions.module.css'

/** Refresh cadence of the trailing relative-time labels. */
const CLOCK_TICK_MS = 30_000

/** The component's locale seat, shared with the row-rendering helpers. */
type RecentTranslate = TranslateNS<typeof NS>

/** Registrant-injected share: the one action the section performs. */
export interface RecentSessionsInjected {
  /** Open a session as the current one. */
  open: (sessionId: SessionId) => void
}

/** Composed component props: owner share + standard kit + injected face + locale seat. */
export type RecentSessionsProps =
  PropsRuntime<'sidebar.footer.action'> & RecentSessionsInjected & PropsLocale<typeof NS>

/** Current epoch ms, re-read on a slow tick so ages stay honest without a busy timer. */
function useNow(): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const timer = window.setInterval(() => { setNow(Date.now()) }, CLOCK_TICK_MS)
    return () => { window.clearInterval(timer) }
  }, [])
  return now
}

/** Localized compact age ("刚刚"/"5分钟前" in zh, "now"/"5min ago" in en). */
function timeLabel(t: RecentTranslate, updatedAt: number, now: number): string {
  const { unit, n } = relativeTime(updatedAt, now)
  return unit === 'now' ? t('time.now') : t('time.ago', { t: t(`time.${unit}`, { n }) })
}

/** Live-state dot of a row, or undefined when the session is idle. */
function rowState(row: RecentRow): 'ongoing' | 'warning' | undefined {
  if (row.waiting) return 'warning'
  return row.running ? 'ongoing' : undefined
}

/**
 * Trailing row meta: the owning workspace — omitted when it merely repeats the
 * title, which is the common case for a session titled after its project — and
 * the age, which stays whole while the workspace name absorbs the truncation.
 */
function RowMeta({ row, t, now }: { row: RecentRow; t: RecentTranslate; now: number }): ReactNode {
  return (
    <span className={css.rowMeta}>
      {row.workspace === row.title ? null : (
        <>
          <span className={css.rowWorkspace}>{row.workspace}</span>
          <span className={css.rowDivider} aria-hidden="true">·</span>
        </>
      )}
      <span className={css.rowTime}>{timeLabel(t, row.updatedAt, now)}</span>
    </span>
  )
}

/** One session row: live-state dot, title, and the workspace/age tail. */
function RecentRowItem({ row, now, t, open }: {
  row: RecentRow
  now: number
  t: RecentTranslate
  open: (sessionId: SessionId) => void
}): ReactNode {
  const state = rowState(row)
  return (
    <li>
      <button
        type="button"
        className={row.current ? `${css.row} ${css.rowCurrent}` : css.row}
        aria-label={t('row.open', { name: row.title })}
        aria-current={row.current ? 'true' : undefined}
        onClick={() => { open(row.id) }}
      >
        {state !== undefined && <StateDot className={css.rowDot} state={state} size={8} />}
        {state !== undefined && (
          <span className={css.visuallyHidden}>
            {row.waiting ? t('status.waiting') : t('status.running')}
          </span>
        )}
        <span className={css.rowTitle}>{row.title}</span>
        <RowMeta row={row} t={t} now={now} />
      </button>
    </li>
  )
}

/**
 * Render the 最近 section and keep the workspace list folded to the same limit.
 * @param props - composed slot props (owner wide flag, standard kit hooks, injected open, locale seat).
 * @returns the section element, or null while the rail is collapsed or no session holds history.
 */
export function RecentSessions(
  { wide, open, t, useSessions, useWorkspaces }: RecentSessionsProps,
): ReactNode {
  const list = useSessions(snapshot => snapshot)
  const workspaces = useWorkspaces(snapshot => snapshot)
  const now = useNow()
  const [recentExpanded, setRecentExpanded] = useState(false)
  const [workspaceExpanded, setWorkspaceExpanded] = useState(false)
  const rows = useMemo(() => deriveRecentRows({
    list,
    workspaces: workspaces.items,
    archivedSessionIds: workspaces.archivedSessionIds,
    ungroupedLabel: t('workspace.ungrouped'),
  }), [list, workspaces, t])

  // A fresh fold per locale binding: the layer re-reads its copy on every
  // application, so no stale labels survive a language switch.
  const foldOptions = useMemo(() => ({
    limit: FOLD_LIMIT,
    labels: {
      expand: (hidden: number) => t('fold.expandWorkspaces', { n: hidden }),
      collapse: t('fold.collapse'),
    },
    onToggle: () => { setWorkspaceExpanded(current => !current) },
  }), [t])
  const fold = useMemo(() => new WorkspaceListFold(foldOptions), [foldOptions])
  useEffect(() => fold.start(), [fold])
  useEffect(() => { fold.setExpanded(workspaceExpanded) }, [fold, workspaceExpanded])

  // Showing the column again restores the folded default, the way the Codex
  // sidebar does: the expanded state is a look, not a setting.
  useEffect(() => {
    if (!wide) return
    setRecentExpanded(false)
    setWorkspaceExpanded(false)
  }, [wide])

  if (!wide || rows.length === 0) return null
  const visibleRows = recentExpanded ? rows : rows.slice(0, FOLD_LIMIT)

  return (
    <div className={css.section}>
      <div className={css.header}>{t('section.recent')}</div>
      <ul className={css.list}>
        {visibleRows.map(row => (
          <RecentRowItem key={row.id} row={row} now={now} t={t} open={open} />
        ))}
      </ul>
      {rows.length > FOLD_LIMIT && (
        <button
          type="button"
          className={css.foldRow}
          aria-expanded={recentExpanded}
          onClick={() => { setRecentExpanded(current => !current) }}
        >
          {recentExpanded ? t('fold.collapse') : t('fold.expandSessions', { n: rows.length - FOLD_LIMIT })}
        </button>
      )}
    </div>
  )
}
