/**
 * The sidebar 最近 section: every workspace's newest sessions flattened into
 * one jump list, registered into the sidebar's `sidebar.footer.action` seat so
 * it renders between the workspace tree and the Settings foot — find the
 * project folder above, open the latest work below.
 *
 * The seat hands the component the column's `wide` flag only; session and
 * workspace facts arrive through the framework standard kit
 * (`useSessions`/`useWorkspaces`), and opening a session arrives through the
 * registration's injected face. A 56px rail has no room for a list, so the
 * section renders only while the column is wide.
 */
import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { IconTriangleRightFill14, StateDot } from '@deepseek-ai/dsh-client-ui-primitives'
import type { PropsLocale, PropsRuntime, TranslateNS } from '@deepseek-ai/dsh-client-ui-slots'
import type { SessionId } from '@deepseek-ai/dsh-client-runtime/client'
import type { RecentRow } from './rows.ts'
import { deriveRecentRows, relativeTime } from './rows.ts'
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

/**
 * Render the 最近 section.
 * @param props - composed slot props (owner wide flag, standard kit hooks, injected open, locale seat).
 * @returns the section element, or null while the rail is collapsed or no session exists.
 */
export function RecentSessions(
  { wide, open, t, useSessions, useWorkspaces }: RecentSessionsProps,
): ReactNode {
  const list = useSessions(snapshot => snapshot)
  const workspaces = useWorkspaces(snapshot => snapshot)
  const now = useNow()
  const [expanded, setExpanded] = useState(true)
  const rows = useMemo(() => deriveRecentRows({
    list,
    workspaces: workspaces.items,
    archivedSessionIds: workspaces.archivedSessionIds,
    ungroupedLabel: t('workspace.ungrouped'),
  }), [list, workspaces, t])

  if (!wide || rows.length === 0) return null

  return (
    <div className={css.section}>
      <button
        type="button"
        className={css.header}
        aria-expanded={expanded}
        aria-label={expanded ? t('section.collapse') : t('section.expand')}
        onClick={() => { setExpanded(current => !current) }}
      >
        <IconTriangleRightFill14 className={expanded ? `${css.chevron} ${css.chevronOpen}` : css.chevron} />
        <span className={css.headerLabel}>{t('section.recent')}</span>
        <span className={css.headerCount}>{t('section.count', { n: rows.length })}</span>
      </button>
      {expanded && (
        <ul className={css.list}>
          {rows.map((row) => {
            const state = rowState(row)
            return (
              <li key={row.id}>
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
          })}
        </ul>
      )}
    </div>
  )
}
