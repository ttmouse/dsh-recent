/**
 * The sidebar 最近 section: every workspace's newest sessions flattened into
 * one jump list, registered into the sidebar's `sidebar.footer.action` seat and
 * then portalled into the workspace list's own scroll area — so it reads as the
 * last content of the 工作区 column ("find the project folder above, open the
 * latest work below") rather than as a block of the sidebar foot, and the
 * column scrolls as one surface from the project tree into older sessions.
 *
 * The same component owns the fold control for the shell's workspace section
 * ({@link WorkspaceListFold}): its header chevron collapses the whole list, and
 * the trailing row keeps the five folders with the newest history, folding every
 * other one — the ungrouped bucket included — behind itself. This section does not
 * fold: it renders a window over every session that holds history and appends
 * one more page of older sessions whenever the end of that window scrolls into
 * view, so the list keeps growing instead of holding the rest behind a row.
 *
 * The seat hands the component the column's `wide` flag only; session and
 * workspace facts arrive through the framework standard kit
 * (`useSessions`/`useSessionStatus`/`useWorkspaces`), and the actions a row
 * performs arrive through the registration's injected face
 * ({@link RecentActions}). A 56px rail has no room for a list, so the section
 * renders only while the column is wide — and re-showing the column returns
 * this list to its first page, while the workspace list's unfolded choice is
 * kept (it is a setting, held in the browser's local store).
 *
 * A row is the shell's own session row, element for element: the 16px leading
 * cell holding the live-state dot, the title, the trailing age (or the compact
 * label of the interaction that waits), the resting pin marker, and — on hover,
 * where the age and the marker give way to it — the row's actions. The hover
 * card is the shell's session card: full title, age, and the live-state line.
 * The two lists read as one column because they are the same rows: same
 * metrics, same colors, same elements, in every state.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { ReactNode, RefObject } from 'react'
import {
  Button, HoverCard, IconArchiveOutlineRegular, IconBranchOutlineRegular, IconChevronRightOutlineRegular,
  IconEllipsisOutlineRegular, IconFolderCloseRegular, IconPinFillRegular, IconPinOutlineRegular,
  IconSlidersTwoOutlineRegular, Menu, Modal, StateDot, Tooltip, relativeTime,
} from '@deepseek-ai/dsh-client-ui-primitives'
import type { PropsLocale, PropsRuntime, TranslateNS } from '@deepseek-ai/dsh-client-ui-slots'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import type { RecentPending, RecentRow } from './rows.ts'
import { deriveRecentRows, FOLD_LIMIT, growWindow, RECENT_PAGE_SIZE } from './rows.ts'
import type { RecentActions } from './sessionActions.ts'
import { groupRecency, loadWorkspaceExpanded, saveWorkspaceExpanded, WorkspaceListFold, workspaceListContainer } from './workspaceFold.ts'
import { NS } from './locales.ts'
import { loadShowWorkspace, saveShowWorkspace } from './viewOptions.ts'
import css from './RecentSessions.module.css'

/** Refresh cadence of the trailing relative-time labels. */
const CLOCK_TICK_MS = 30_000

/**
 * How far past the visible column the end of the rendered window still counts
 * as reached. The next page arrives before the operator actually hits the
 * bottom, so scrolling into history never runs into a hole.
 */
const LOAD_AHEAD_PX = 320

/**
 * List area the section is portalled into: the shell's own scroller for the
 * workspace tree, which is also where the section belongs — the column scrolls
 * as one surface and this block is its last content. Mirrors the fold layer's
 * own resolution so both agree about where the list ends.
 *
 * The shell swaps that area whenever the browser switches between the
 * workspace tree, the flat list, and search results, which leaves a section
 * portalled into the replaced element detached and invisible. So the observer
 * runs for as long as the section is mounted and re-resolves the area whenever
 * the current one leaves the document — a re-render then moves the portal into
 * the new area. A flat or search rendering resolves no area at all (no group
 * sections), and the section keeps its last one and stays hidden until the
 * workspace tree comes back.
 *
 * The same observer keeps the section the area's last child: the shell appends
 * new group sections (a workspace added while the column is open, the trailing
 * bucket for sessions no workspace claims) with a plain append, which lands them
 * *after* this block. A portal's position among React's children is not React's
 * to own, so putting it back is this side's job.
 * @param section - the section element, so the observer can re-place it.
 * @returns the area to portal into, or undefined before the browser mounts.
 */
function useWorkspaceListArea(section: RefObject<HTMLElement | null>): HTMLElement | undefined {
  const [area, setArea] = useState<HTMLElement | undefined>(() => workspaceListContainer(document))
  const current = useRef(area)
  current.current = area
  useEffect(() => {
    const sync = () => {
      const held = current.current
      if (held?.isConnected !== true) {
        const next = workspaceListContainer(document)
        if (next !== undefined) setArea(next)
        return
      }
      const mounted = section.current
      if (mounted !== null && mounted.parentElement === held && held.lastElementChild !== mounted) {
        held.append(mounted)
      }
    }
    sync()
    const observer = new MutationObserver(sync)
    observer.observe(document.body, { childList: true, subtree: true })
    return () => { observer.disconnect() }
  }, [section])
  return area
}

/**
 * Hover dwell before the row's card shows: none. The primitive's 500ms default
 * (and the 150ms beat this section first traded down to) still reads as lag on
 * a jump list this dense — the pointer is already on the row the card body
 * describes, so there is nothing to wait for. The card is the shell's session
 * card drawn the shell's way; only this beat is shorter, and the workspace
 * tree's own 800ms dwell is the shell's choice for its rows rather than a
 * property of the card.
 *
 * Sweeps across the list stay quiet without a dwell, because a card the pointer
 * has left is hidden the moment another row takes the hover (see
 * {@link RecentRowCard}'s stale marker): crossing the list shows one card that
 * follows the pointer, never a stack of panels left behind on the way.
 */
const CARD_DWELL_MS = 0

/** The component's locale seat, shared with the row-rendering helpers. */
type RecentTranslate = TranslateNS<typeof NS>

/** Composed component props: owner share + standard kit + injected actions + locale seat. */
export type RecentSessionsProps =
  PropsRuntime<'sidebar.footer.action'> & RecentActions & PropsLocale<typeof NS>

/** Current epoch ms, re-read on a slow tick so ages stay honest without a busy timer. */
function useNow(): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const timer = window.setInterval(() => { setNow(Date.now()) }, CLOCK_TICK_MS)
    return () => { window.clearInterval(timer) }
  }, [])
  return now
}

/** Localized compact age ("刚刚"/"5分钟" in zh, "now"/"5min" in en) — the row's trailing label. */
function timeLabel(t: RecentTranslate, updatedAt: number, now: number): string {
  const { unit, n } = relativeTime(updatedAt, now)
  return unit === 'now' ? t('time.now') : t(`time.${unit}`, { n })
}

/**
 * The card's age line: distances wrap in the ago template and the now bucket
 * stays bare (no "now ago"), which is the shell's own hover-card wording.
 */
function hoverTimeLabel(t: RecentTranslate, updatedAt: number, now: number): string {
  const { unit, n } = relativeTime(updatedAt, now)
  return unit === 'now' ? t('time.now') : t('time.ago', { t: t(`time.${unit}`, { n }) })
}

/**
 * The two labels one waiting interaction carries: the state line the row and
 * its card show, and the compact label that replaces the age while it waits —
 * the shell's own pair of words for each of the three kinds its rows mark.
 */
const PENDING: Record<RecentPending, {
  label: 'status.waitingApproval' | 'status.planReview' | 'status.waitingAnswer'
  compact: 'status.compact.approval' | 'status.compact.planReview' | 'status.compact.answer'
}> = {
  'approval': { label: 'status.waitingApproval', compact: 'status.compact.approval' },
  'plan-review': { label: 'status.planReview', compact: 'status.compact.planReview' },
  'question': { label: 'status.waitingAnswer', compact: 'status.compact.answer' },
}

/**
 * Live state of one row. The unified status snapshot is the same source the
 * workspace tree's rows read, so the two surfaces show the same dot.
 * @param row - the derived row.
 * @returns the dot state, or undefined when the session is idle.
 */
function rowState(row: RecentRow): 'ongoing' | 'warning' | undefined {
  if (row.pending !== undefined) return 'warning'
  return row.running ? 'ongoing' : undefined
}

/**
 * The live-state line one row and its card carry: the interaction that waits on
 * this user, or the running state. The shell's rows say the same thing in the
 * same order.
 * @param row - the derived row.
 * @param t - locale seat.
 * @returns the label, or undefined when the session is idle.
 */
function statusLabel(row: RecentRow, t: RecentTranslate): string | undefined {
  if (row.pending !== undefined) return t(PENDING[row.pending].label)
  return row.running ? t('status.running') : undefined
}

/**
 * The row's hover-card body: the shell's own session-card pattern (full title,
 * age, one live-state line when the session runs or waits) plus the one fact a
 * flat cross-project list has to carry — the workspace the session belongs to,
 * on the line the shell's card reserves for extra sections (its
 * `sidebar.session.row.hover` seat), so the live state stays the trailing line.
 *
 * `stale` marks the body of a card the pointer has already left for another
 * row. The primitive keeps that card mounted for its own pointer grace, so the
 * stylesheet hides the whole card on this marker: a sweep down the list swaps
 * one visible panel per row instead of stacking every panel it crossed.
 * @param props.row - the derived row this card describes.
 * @param props.t - locale seat.
 * @param props.now - current epoch ms for the age label.
 * @param props.stale - whether another row currently owns the hover.
 * @returns the card body.
 */
function RecentRowCard({ row, t, now, stale }: {
  row: RecentRow
  t: RecentTranslate
  now: number
  stale: boolean
}): ReactNode {
  const state = rowState(row)
  const label = statusLabel(row, t)
  return (
    <div className={css.card} data-recent-stale={stale ? '' : undefined}>
      <div className={css.cardTitle}>{row.title}</div>
      <div className={css.cardTime}>{hoverTimeLabel(t, row.updatedAt, now)}</div>
      <div className={css.cardWorkspace}>
        <IconFolderCloseRegular className={css.cardFolder} size={14} />
        <span className={css.cardWorkspaceName}>{row.workspace}</span>
      </div>
      {state !== undefined && label !== undefined && (
        <div className={css.cardStatus}>
          <StateDot state={state} />
          <span>{label}</span>
        </div>
      )}
    </div>
  )
}

/**
 * The section's view-options menu: the workspace section header's own sliders
 * button and menu, borrowed element for element — the 28px icon button, the
 * dense portalled card aligned to its end, a heading row naming the menu, and
 * one checkable row per option with the check marking what is on. Selecting
 * the checked row clears it: these are independent switches, not a radio
 * group, so every row toggles its own fact.
 * @param props.showWorkspace - whether rows carry the project-name line.
 * @param props.onToggleWorkspace - flip the project-name line.
 * @param props.t - locale seat.
 * @returns the menu.
 */
function ViewOptionsMenu({ showWorkspace, onToggleWorkspace, t }: {
  showWorkspace: boolean
  onToggleWorkspace: () => void
  t: RecentTranslate
}): ReactNode {
  const [open, setOpen] = useState(false)
  return (
    <Menu
      open={open}
      onClose={() => { setOpen(false) }}
      items={[
        { type: 'label', id: 'view.label', text: t('view.options') },
        {
          id: 'show-workspace',
          label: t('view.showWorkspace'),
          icon: <IconFolderCloseRegular size={14} />,
        },
      ]}
      selectedIds={showWorkspace ? ['show-workspace'] : []}
      onSelect={(id) => {
        setOpen(false)
        if (id === 'show-workspace') onToggleWorkspace()
      }}
      align="end"
      dense
      portal
      listClassName={css.viewMenu}
      anchor={
        <Tooltip label={t('view.options')} side="bottom" align="end" delayMs={500}>
          <button
            type="button"
            className={css.headerButton}
            aria-label={t('view.options')}
            onClick={() => { setOpen(current => !current) }}
          >
            <IconSlidersTwoOutlineRegular />
          </button>
        </Tooltip>
      }
    />
  )
}

/**
 * One session row: the shell's own session row — leading state cell, title, the
 * age (or the waiting interaction's compact label), the resting pin marker —
 * with the age's place taken by the row's actions while the row is hovered or
 * its menu is open, exactly as the shell's rows do. The workspace/age card
 * rides on hover, and the card clicks through to copying the title, the same
 * affordance the workspace tree's session card gives.
 *
 * The row reports its own hover up to the section ({@link onHover}), which is
 * what lets a card the pointer has left be hidden while the primitive still
 * holds it: the section knows which row owns the hover, the card body only
 * needs to know whether it is that row. Only taking the hover is reported —
 * leaving is not news, because a card the pointer abandoned has to stay hidden
 * until it unmounts, not become the one visible card again.
 *
 * The card is suppressed while the row's menu is open, so it never covers the
 * list the menu opened over — the shell's rows disable theirs the same way.
 * @param props.row - the derived row.
 * @param props.now - current epoch ms for the age label.
 * @param props.t - locale seat.
 * @param props.actions - the session actions this row performs.
 * @param props.onArchive - archive this row, raising the confirmation when the Host refuses.
 * @param props.stale - whether another row currently owns the hover.
 * @param props.onHover - announce that this row took the hover.
 * @param props.showWorkspace - whether the row carries the project-name line.
 * @returns the row element.
 */
function RecentRowItem({ row, now, t, actions, onArchive, stale, onHover, showWorkspace }: {
  row: RecentRow
  now: number
  t: RecentTranslate
  actions: RecentActions
  onArchive: (row: RecentRow) => void
  stale: boolean
  onHover: () => void
  showWorkspace: boolean
}): ReactNode {
  const state = rowState(row)
  const label = statusLabel(row, t)
  const [menuOpen, setMenuOpen] = useState(false)
  const rowClass = [css.row, row.current ? css.rowCurrent : '', menuOpen ? css.rowMenuOpen : '']
    .filter(part => part !== '').join(' ')
  const pinLabel = row.pinned ? t('actions.unpin') : t('actions.pin')
  return (
    <li onPointerEnter={onHover}>
      <HoverCard
        anchor={
          <div
            className={rowClass}
            role="treeitem"
            tabIndex={0}
            data-workspace={showWorkspace ? '' : undefined}
            aria-label={t('row.open', { name: row.title })}
            aria-selected={row.current}
            onClick={() => { actions.open(row.id) }}
            onKeyDown={(event) => {
              if (event.key !== 'Enter' && event.key !== ' ') return
              event.preventDefault()
              actions.open(row.id)
            }}
          >
            <span className={css.slot}>
              {state !== undefined && <StateDot state={state} />}
              {label !== undefined && <span className={css.visuallyHidden}>{label}</span>}
            </span>
            <span className={css.title}>{row.title}</span>
            <span className={css.time} aria-hidden={row.pending === undefined ? undefined : true}>
              {row.pending === undefined ? timeLabel(t, row.updatedAt, now) : t(PENDING[row.pending].compact)}
            </span>
            {row.pinned && (
              <span className={css.pinIndicator} role="img" aria-label={t('row.pinned')} title={t('row.pinned')}>
                <IconPinFillRegular size={14} />
              </span>
            )}
            <span className={css.rowActions} onClick={(event) => { event.stopPropagation() }}>
              <Menu
                open={menuOpen}
                onClose={() => { setMenuOpen(false) }}
                portal
                closeOnPointerLeave
                anchor={
                  <button
                    type="button"
                    className={css.iconButton}
                    aria-label={t('actions.session.aria', { name: row.title })}
                    onClick={() => { setMenuOpen(open => !open) }}
                  >
                    <IconEllipsisOutlineRegular />
                  </button>
                }
                items={[
                  {
                    id: 'pin',
                    label: t(row.pinned ? 'menu.unpinSession' : 'menu.pinSession'),
                    icon: row.pinned ? <IconPinFillRegular /> : <IconPinOutlineRegular />,
                  },
                  { id: 'fork', label: t('menu.fork'), icon: <IconBranchOutlineRegular /> },
                  { id: 'archive', label: t('menu.archiveSession'), icon: <IconArchiveOutlineRegular size={14} /> },
                ]}
                onSelect={(id) => {
                  setMenuOpen(false)
                  if (id === 'pin') (row.pinned ? actions.unpin : actions.pin)(row.id)
                  else if (id === 'fork') actions.fork(row.id)
                  else onArchive(row)
                }}
              />
              <Tooltip label={t('actions.archive')} side="bottom" align="end" delayMs={500}>
                <button
                  type="button"
                  className={css.iconButton}
                  aria-label={t('actions.archive')}
                  onClick={() => { onArchive(row) }}
                >
                  <IconArchiveOutlineRegular size={14} />
                </button>
              </Tooltip>
              <Tooltip label={pinLabel} side="bottom" align="end" delayMs={500}>
                <button
                  type="button"
                  className={css.iconButton}
                  aria-label={pinLabel}
                  onClick={() => { (row.pinned ? actions.unpin : actions.pin)(row.id) }}
                >
                  {row.pinned ? <IconPinFillRegular size={14} /> : <IconPinOutlineRegular size={14} />}
                </button>
              </Tooltip>
            </span>
            {showWorkspace && <span className={css.workspace}>{row.workspace}</span>}
          </div>
        }
        content={<RecentRowCard row={row} t={t} now={now} stale={stale} />}
        copyText={row.title}
        copyLabel={t('copy')}
        copiedLabel={t('copied')}
        openDelayMs={CARD_DWELL_MS}
        disabled={menuOpen}
      />
    </li>
  )
}

/**
 * The Host refused to archive a Session that still has work: the shell's own
 * stop-and-archive confirmation, on the shell's own wording and its single
 * action. The shell's dialog also lists what the refusal named; this one keeps
 * the question without enumerating the work.
 * @param props.request - the Session the Host refused, with its row title.
 * @param props.stopAndArchive - stop that Session's work and archive it.
 * @param props.onSettle - close the dialog, once the request is done.
 * @param props.t - locale seat.
 * @returns the dialog.
 */
function ArchiveConfirm({ request, stopAndArchive, onSettle, t }: {
  request: { id: SessionId; title: string }
  stopAndArchive: RecentActions['stopAndArchive']
  onSettle: () => void
  t: RecentTranslate
}): ReactNode {
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | undefined>(undefined)
  const close = () => { if (!pending) onSettle() }
  const confirm = () => {
    setPending(true)
    setError(undefined)
    stopAndArchive(request.id).then(() => {
      setPending(false)
      onSettle()
    }).catch((reason: unknown) => {
      setPending(false)
      setError(reason instanceof Error ? reason.message : String(reason))
    })
  }
  return (
    <Modal
      open
      onClose={close}
      closeLabel={t('close')}
      title={t('archive.confirm.title')}
      description={t('archive.confirm.desc', { title: request.title })}
      footer={<>
        <Button variant="outline" disabled={pending} onClick={close}>{t('cancel')}</Button>
        <Button variant="outline" className={css.deleteAction} disabled={pending} onClick={confirm}>
          {pending ? t('archive.confirm.pending') : t('archive.confirm.action')}
        </Button>
      </>}
    >
      {error !== undefined && <div className={css.archiveError}>{error}</div>}
    </Modal>
  )
}

/**
 * Render the 最近 section and keep the workspace section folded the same way.
 * @param props - composed slot props (owner wide flag, standard kit hooks, injected actions, locale seat).
 * @returns the section element, or null while the rail is collapsed or no session holds history.
 */
export function RecentSessions(
  {
    wide, t, useSessions, useSessionStatus, useWorkspaces,
    open, archive, stopAndArchive, pin, unpin, fork,
  }: RecentSessionsProps,
): ReactNode {
  const list = useSessions(snapshot => snapshot)
  const status = useSessionStatus(snapshot => snapshot)
  const workspaces = useWorkspaces(snapshot => snapshot)
  const now = useNow()
  const [recentFolded, setRecentFolded] = useState(false)
  const [rendered, setRendered] = useState(RECENT_PAGE_SIZE)
  // The project-name line is a setting rather than a look, so unlike the folds
  // below it survives the column closing and the page reloading.
  const [showWorkspace, setShowWorkspace] = useState(() => loadShowWorkspace())
  // Which groups show is a setting, not a look: the operator asked to see every
  // project, so the choice is restored from the local store and survives both
  // the column closing and the page reloading. The section's own collapse is a
  // state of the moment and comes back open.
  const [workspaceExpanded, setWorkspaceExpanded] = useState(() => loadWorkspaceExpanded())
  useEffect(() => { saveWorkspaceExpanded(workspaceExpanded) }, [workspaceExpanded])
  const [workspaceCollapsed, setWorkspaceCollapsed] = useState(false)
  // The row that owns the hover, and with it the one card allowed to paint.
  // Only ever moved forward, never cleared on the way out of the list: a card
  // the pointer abandoned mid-move has to stay hidden while the primitive
  // finishes its own pointer grace, rather than surface again the moment the
  // pointer leaves the column.
  const [hoveredID, setHoveredID] = useState<SessionId | undefined>(undefined)
  // The Session the Host refused to archive, waiting on the stop-and-archive
  // confirmation. One at a time: the dialog owns the screen while it is up.
  const [archiveRequest, setArchiveRequest] = useState<{ id: SessionId; title: string } | undefined>(undefined)
  const section = useRef<HTMLDivElement>(null)
  const sentinel = useRef<HTMLLIElement>(null)
  const area = useWorkspaceListArea(section)
  const actions = useMemo<RecentActions>(() => ({ open, archive, stopAndArchive, pin, unpin, fork }),
    [open, archive, stopAndArchive, pin, unpin, fork])
  const rows = useMemo(() => deriveRecentRows({
    list,
    status,
    workspaces: workspaces.items,
    archivedSessionIds: workspaces.archivedSessionIds,
    pinnedSessionIds: workspaces.pinnedSessionIds,
    ungroupedLabel: t('workspace.ungrouped'),
  }), [list, status, workspaces, t])

  // Archiving a Session that still runs is the Host's call to refuse, and the
  // refusal is what raises the shell's stop-and-archive question. A refusal for
  // any other reason leaves the row as it was.
  const archiveRow = useCallback((row: RecentRow) => {
    void actions.archive(row.id).then((outcome) => {
      if (outcome !== 'active') return
      setArchiveRequest({ id: row.id, title: row.title })
    })
  }, [actions])

  // The workspace list's fold keeps the groups used most recently, so it needs
  // the newest history time of every group. The fold layer keeps its observer
  // and its DOM across frames while the catalog moves under it, so it reads the
  // ranking through this getter instead of holding one map for its lifetime.
  const recency = useMemo(() => groupRecency({
    list,
    workspaces: workspaces.items,
    archivedSessionIds: workspaces.archivedSessionIds,
  }), [list, workspaces])
  const recencyRef = useRef(recency)
  recencyRef.current = recency

  // The per-group session fold ranks rows by the session catalog's own history
  // time, whatever the row's live state — strict newest-first, no exemptions.
  const sessionRecencyRef = useRef(new Map<SessionId, number>())
  sessionRecencyRef.current = useMemo(() => {
    const newest = new Map<SessionId, number>()
    for (const id of list.ids) {
      const session = list.byId[id]
      if (session === undefined) continue
      if (session.origin === 'subagent') continue
      newest.set(id, session.updatedAt)
    }
    return newest
  }, [list])

  // A fresh fold per locale binding: the layer re-reads its copy on every
  // application, so no stale labels survive a language switch.
  const foldOptions = useMemo(() => ({
    limit: FOLD_LIMIT,
    labels: {
      expand: (hidden: number) => t('fold.expandWorkspaces', { n: hidden }),
      collapse: t('fold.collapse'),
      sessionExpand: (hidden: number) => t('fold.expandSessions', { n: hidden }),
    },
    recency: (key: string) => recencyRef.current.get(key),
    sessionRecency: (id: string) => sessionRecencyRef.current.get(id as SessionId),
    onToggle: () => { setWorkspaceExpanded(current => !current) },
    onToggleSection: () => { setWorkspaceCollapsed(current => !current) },
  }), [t])
  const fold = useMemo(() => new WorkspaceListFold(foldOptions), [foldOptions])
  useEffect(() => fold.start(), [fold])
  useEffect(() => { fold.setExpanded(workspaceExpanded) }, [fold, workspaceExpanded])
  useEffect(() => { fold.setCollapsed(workspaceCollapsed) }, [fold, workspaceCollapsed])
  // New history moves groups in and out of the fold, so every catalog change
  // re-ranks the list; without this the folded column would keep yesterday's
  // five until some unrelated mutation happened to re-apply the fold.
  useEffect(() => { fold.refresh() }, [fold, recency])

  // Showing the column again keeps the workspace list exactly as the operator
  // left it: collapsing the sidebar is a change of viewport, not a revocation
  // of the "show every project" choice, and the section's own collapse state
  // stays too. The recent list starts over from its first page — its window is
  // a scroll position, and the rail has none to keep.
  useEffect(() => {
    if (!wide) return
    setRecentFolded(false)
    setRendered(RECENT_PAGE_SIZE)
  }, [wide])

  // Reaching the end of the rendered window loads the next page of older
  // sessions. The marker sits at that end and the column's own scroller is the
  // observer root, so it counts as reached a little before the operator hits the
  // bottom; an append pushes it out of that band and the observer settles until
  // the next scroll, so the window grows a page at a time instead of at once.
  useEffect(() => {
    const marker = sentinel.current
    if (marker === null || area === undefined) return
    const observer = new IntersectionObserver((entries) => {
      if (!entries.some(entry => entry.isIntersecting)) return
      setRendered(current => growWindow(current, rows.length))
    }, { root: area, rootMargin: `0px 0px ${LOAD_AHEAD_PX}px 0px` })
    observer.observe(marker)
    return () => { observer.disconnect() }
  }, [area, rendered, rows.length])

  if (!wide || rows.length === 0) return null
  const visibleRows = rows.slice(0, rendered)

  const body = (
    <div ref={section} className={css.section} data-slot="sidebar.recent.section">
      <div className={css.header}>
        <button
          type="button"
          className={css.headerToggle}
          aria-expanded={!recentFolded}
          aria-label={t('section.recent')}
          onClick={() => { setRecentFolded(current => !current) }}
        >
          {t('section.recent')}
          <IconChevronRightOutlineRegular className={recentFolded ? css.chevron : `${css.chevron} ${css.chevronOpen}`} />
        </button>
        <ViewOptionsMenu
          showWorkspace={showWorkspace}
          onToggleWorkspace={() => {
            setShowWorkspace(current => {
              saveShowWorkspace(!current)
              return !current
            })
          }}
          t={t}
        />
      </div>
      {!recentFolded && <ul className={css.list}>
        {visibleRows.map(row => (
          <RecentRowItem
            key={row.id}
            row={row}
            now={now}
            t={t}
            actions={actions}
            onArchive={archiveRow}
            stale={hoveredID !== undefined && hoveredID !== row.id}
            onHover={() => {
              setHoveredID(current => current === row.id ? current : row.id)
            }}
            showWorkspace={showWorkspace}
          />
        ))}
        {visibleRows.length < rows.length && (
          <li ref={sentinel} className={css.sentinel} aria-hidden="true" />
        )}
      </ul>}
      {archiveRequest !== undefined && (
        <ArchiveConfirm
          request={archiveRequest}
          stopAndArchive={stopAndArchive}
          onSettle={() => { setArchiveRequest(undefined) }}
          t={t}
        />
      )}
    </div>
  )
  // The workspace list's scroll area is where this belongs: as the last content
  // of the 工作区 column, it follows the list instead of sitting at the column's
  // foot, and the column's own scrolling carries the operator from the project
  // tree into older sessions.
  if (area === undefined) return null
  return createPortal(body, area)
}
