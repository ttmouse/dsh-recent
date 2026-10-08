import { describe, expect, it } from 'vitest'
import type { SessionListState, SessionSummary } from '@deepseek-ai/dsh-api-session-controller/client'
import type { WorkspaceId, WorkspaceView } from '@deepseek-ai/dsh-api-workspace-controller/client'
import type { SessionStatus, SessionStatusSnapshot } from '@deepseek-ai/dsh-client-ui-session/client'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import { deriveRecentRows, growWindow, RECENT_PAGE_SIZE } from '../src/client/rows.ts'

const sid = (value: string): SessionId => value as SessionId
const wid = (value: string): WorkspaceId => value as WorkspaceId

/** A session row holding no local references until a test says otherwise. */
function summary(id: string, over: Partial<SessionSummary> = {}): SessionSummary {
  return {
    id: sid(id),
    displayTitle: id,
    running: false,
    retainedBy: {},
    blank: false,
    updatedAt: 0,
    ...over,
  }
}

/** Unified UI status for the sessions a test claims are live or waiting. */
function statusOf(entries: Readonly<Record<string, Partial<SessionStatus>>>): SessionStatusSnapshot {
  return new Map(Object.entries(entries).map(([id, over]) => [sid(id), {
    running: undefined, pendingInteraction: undefined, completionUnread: false, ...over,
  }]))
}

/** A catalog whose main view holds `current`, the way session selection is expressed. */
function listState(sessions: readonly SessionSummary[], current?: SessionId): SessionListState {
  const rows = current === undefined ? sessions : sessions.map(session => (
    session.id === current
      ? { ...session, retainedBy: { ...session.retainedBy, mainView: 1 } }
      : session
  ))
  return {
    ids: rows.map(session => session.id),
    byId: Object.fromEntries(rows.map(session => [session.id, session])),
    phase: 'ready',
    projectionsBySession: {},
  }
}

/** One registered workspace holding the sessions a test assigns to it. */
function workspace(id: string, title: string, path: string, sessionIds: readonly string[]): WorkspaceView {
  return {
    workspaceId: wid(id),
    path,
    title,
    sessionIds: sessionIds.map(sid),
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  }
}

/** The input every case starts from: no workspace, no archived or pinned session, no live status. */
const base = {
  status: statusOf({}),
  workspaces: [] as readonly WorkspaceView[],
  archivedSessionIds: [] as readonly SessionId[],
  pinnedSessionIds: [] as readonly SessionId[],
  ungroupedLabel: 'Ungrouped',
}

describe('deriveRecentRows', () => {
  it('flattens the whole catalog into one newest-first list', () => {
    const list = listState([
      summary('a', { displayTitle: 'alpha', updatedAt: 100, cwd: '/work/one' }),
      summary('b', { displayTitle: 'bravo', updatedAt: 300, cwd: '/work/two' }),
      summary('c', { displayTitle: 'charlie', updatedAt: 200, cwd: '/work/one' }),
    ])
    const rows = deriveRecentRows({ ...base, list })
    expect(rows.map(row => row.id)).toEqual(['b', 'c', 'a'])
    expect(rows.map(row => row.title)).toEqual(['bravo', 'charlie', 'alpha'])
  })

  it('names the owning workspace, then the directory basename, then the ungrouped label', () => {
    // The hover card is the only place a flat cross-project list says which
    // project a session belongs to, so the label has to be right for a session
    // the registry claims, one it does not, and one with no directory at all.
    const list = listState([
      summary('a', { updatedAt: 30, cwd: '/work/one' }),
      summary('b', { updatedAt: 20, cwd: '/Users/me/Projects/dsh-recent/' }),
      summary('c', { updatedAt: 10 }),
    ])
    const rows = deriveRecentRows({
      ...base,
      list,
      workspaces: [workspace('w1', 'One', '/work/one', ['a'])],
    })
    expect(rows.map(row => [row.id, row.workspace])).toEqual([
      ['a', 'One'],
      ['b', 'dsh-recent'],
      ['c', 'Ungrouped'],
    ])
  })

  it('hides subagent children, archived sessions, and every blank provisional session', () => {
    const list = listState([
      summary('kept', { updatedAt: 40 }),
      summary('child', { updatedAt: 50, origin: 'subagent', parentId: sid('kept') }),
      summary('archived', { updatedAt: 60 }),
      summary('blank-current', { updatedAt: 80, blank: true }),
    ], sid('blank-current'))
    const rows = deriveRecentRows({ ...base, list, archivedSessionIds: [sid('archived')] })
    expect(rows.map(row => row.id)).toEqual(['kept'])
    expect(rows[0]?.current).toBe(false)
  })

  it('flags the current session without letting a blank one in', () => {
    const list = listState([
      summary('older', { updatedAt: 10 }),
      summary('selected', { updatedAt: 20 }),
    ], sid('selected'))
    const rows = deriveRecentRows({ ...base, list })
    expect(rows.map(row => [row.id, row.current])).toEqual([
      ['selected', true],
      ['older', false],
    ])
  })

  it('marks the pinned sessions, the way the workspace rows mark theirs', () => {
    const list = listState([
      summary('pinned', { updatedAt: 20 }),
      summary('plain', { updatedAt: 10 }),
    ])
    const rows = deriveRecentRows({ ...base, list, pinnedSessionIds: [sid('pinned')] })
    expect(rows.map(row => [row.id, row.pinned])).toEqual([
      ['pinned', true],
      ['plain', false],
    ])
  })

  it('derives every session that holds history, not just the first page', () => {
    // The section renders a window over this list and grows it on scroll, so
    // the derivation must hand over the whole history: a cap here would put the
    // older sessions out of reach no matter how far the operator scrolls.
    const sessions = Array.from({ length: RECENT_PAGE_SIZE * 3 + 4 }, (_, index) =>
      summary(`s${index}`, { updatedAt: index }))
    const rows = deriveRecentRows({ ...base, list: listState(sessions) })
    expect(rows).toHaveLength(sessions.length)
    expect(rows[0]?.id).toBe(`s${RECENT_PAGE_SIZE * 3 + 3}`)
    expect(rows.at(-1)?.id).toBe('s0')
  })

  it('reports live state from the status snapshot, falling back to the row flag', () => {
    const list = listState([
      summary('running', { updatedAt: 20 }),
      summary('waiting', { updatedAt: 15 }),
      summary('approval', { updatedAt: 12 }),
      summary('hidden-kind', { updatedAt: 11 }),
      summary('row-flag', { updatedAt: 10, running: true }),
      summary('idle', { updatedAt: 5 }),
    ])
    const rows = deriveRecentRows({
      ...base,
      list,
      // A status kind no sidebar row offers stays off the section, exactly as it
      // stays off the workspace tree.
      status: statusOf({
        running: { running: true },
        waiting: { pendingInteraction: { key: 'q1', kind: 'question', sessionId: sid('waiting') } },
        approval: { pendingInteraction: { key: 'a1', kind: 'approval', sessionId: sid('approval') } },
        'hidden-kind': { pendingInteraction: { key: 'x1', kind: 'subagent', sessionId: sid('hidden-kind') } },
        idle: { running: false },
      }),
    })
    expect(rows.map(row => [row.id, row.running, row.pending])).toEqual([
      ['running', true, undefined],
      ['row-flag', true, undefined],
      ['waiting', false, 'question'],
      ['approval', false, 'approval'],
      ['hidden-kind', false, undefined],
      ['idle', false, undefined],
    ])
  })

  it('leads with still-running sessions even when their last entry is older', () => {
    const list = listState([
      // An idle session touched a minute ago, and one running for a long
      // stretch whose log has not gained a durable entry since it started.
      summary('idle-recent', { updatedAt: 60 }),
      summary('long-runner', { updatedAt: 1, running: true }),
      summary('idle-old', { updatedAt: 40 }),
    ])
    const rows = deriveRecentRows({ ...base, list })
    expect(rows.map(row => row.id)).toEqual(['long-runner', 'idle-recent', 'idle-old'])
  })

  it('carries a plan review as its own pending kind', () => {
    const list = listState([summary('plan', { updatedAt: 10 })])
    const rows = deriveRecentRows({
      ...base,
      list,
      status: statusOf({
        plan: { pendingInteraction: { key: 'p1', kind: 'plan-review', sessionId: sid('plan') } },
      }),
    })
    expect(rows[0]?.pending).toBe('plan-review')
  })
})

describe('growWindow', () => {
  it('appends one page while older sessions remain', () => {
    expect(growWindow(RECENT_PAGE_SIZE, RECENT_PAGE_SIZE * 3)).toBe(RECENT_PAGE_SIZE * 2)
  })

  it('never renders past the end of the history', () => {
    expect(growWindow(RECENT_PAGE_SIZE * 2, RECENT_PAGE_SIZE * 2 + 3)).toBe(RECENT_PAGE_SIZE * 2 + 3)
    expect(growWindow(RECENT_PAGE_SIZE, RECENT_PAGE_SIZE)).toBe(RECENT_PAGE_SIZE)
  })
})
