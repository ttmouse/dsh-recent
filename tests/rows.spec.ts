import { describe, expect, it } from 'vitest'
import type {
  SessionId, SessionListState, SessionSummary, WorkspaceId, WorkspaceView,
} from '@deepseek-ai/dsh-client-runtime/client'
import { deriveRecentRows, RECENT_ROW_LIMIT, relativeTime } from '../src/client/rows.ts'

const sid = (value: string): SessionId => value as SessionId
const wid = (value: string): WorkspaceId => value as WorkspaceId

function summary(id: string, over: Partial<SessionSummary> = {}): SessionSummary {
  return { id: sid(id), displayTitle: id, running: false, blank: false, updatedAt: 0, ...over }
}

function listState(sessions: readonly SessionSummary[], current?: SessionId): SessionListState {
  return {
    ids: sessions.map(session => session.id),
    byId: Object.fromEntries(sessions.map(session => [session.id, session])),
    current,
    phase: 'ready',
    subagentsByParent: {},
    jobsBySession: {},
    currentAddress: undefined,
  }
}

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

const labels = { ungroupedLabel: 'Ungrouped' }

describe('deriveRecentRows', () => {
  it('flattens every workspace into one newest-first list with workspace labels', () => {
    const list = listState([
      summary('a', { displayTitle: 'alpha', updatedAt: 100, cwd: '/work/one' }),
      summary('b', { displayTitle: 'bravo', updatedAt: 300, cwd: '/work/two' }),
      summary('c', { displayTitle: 'charlie', updatedAt: 200, cwd: '/work/one' }),
    ])
    const rows = deriveRecentRows({
      ...labels,
      list,
      workspaces: [
        workspace('w1', 'One', '/work/one', ['a', 'c']),
        workspace('w2', 'Two', '/work/two', ['b']),
      ],
      archivedSessionIds: [],
    })
    expect(rows.map(row => row.id)).toEqual(['b', 'c', 'a'])
    expect(rows.map(row => row.workspace)).toEqual(['Two', 'One', 'One'])
  })

  it('labels a session outside the registry by its directory basename, then the ungrouped label', () => {
    const list = listState([
      summary('a', { updatedAt: 10, cwd: '/Users/me/Projects/dsh-recent/' }),
      summary('b', { updatedAt: 20 }),
    ])
    const rows = deriveRecentRows({ ...labels, list, workspaces: [], archivedSessionIds: [] })
    expect(rows.map(row => [row.id, row.workspace])).toEqual([
      ['b', 'Ungrouped'],
      ['a', 'dsh-recent'],
    ])
  })

  it('hides subagent children, archived sessions, and every blank provisional session', () => {
    const list = listState([
      summary('kept', { updatedAt: 40 }),
      summary('child', { updatedAt: 50, origin: 'subagent', parentId: sid('kept') }),
      summary('archived', { updatedAt: 60 }),
      summary('blank-current', { updatedAt: 80, blank: true }),
    ], sid('blank-current'))
    const rows = deriveRecentRows({
      ...labels,
      list,
      workspaces: [],
      archivedSessionIds: [sid('archived')],
    })
    expect(rows.map(row => row.id)).toEqual(['kept'])
    expect(rows[0]?.current).toBe(false)
  })

  it('flags the current session without letting a blank one in', () => {
    const list = listState([
      summary('older', { updatedAt: 10 }),
      summary('selected', { updatedAt: 20 }),
    ], sid('selected'))
    const rows = deriveRecentRows({ ...labels, list, workspaces: [], archivedSessionIds: [] })
    expect(rows.map(row => [row.id, row.current])).toEqual([
      ['selected', true],
      ['older', false],
    ])
  })

  it('caps the list at the newest rows', () => {
    const sessions = Array.from({ length: RECENT_ROW_LIMIT + 4 }, (_, index) =>
      summary(`s${index}`, { updatedAt: index }))
    const rows = deriveRecentRows({
      ...labels,
      list: listState(sessions),
      workspaces: [],
      archivedSessionIds: [],
    })
    expect(rows).toHaveLength(RECENT_ROW_LIMIT)
    expect(rows[0]?.id).toBe(`s${RECENT_ROW_LIMIT + 3}`)
  })

  it('reports live state from the row flags', () => {
    const list = listState([
      summary('running', { updatedAt: 20, running: true }),
      summary('waiting', { updatedAt: 10, pendingInteraction: 'approval' }),
      summary('idle', { updatedAt: 5 }),
    ])
    const rows = deriveRecentRows({ ...labels, list, workspaces: [], archivedSessionIds: [] })
    expect(rows.map(row => [row.id, row.running, row.waiting])).toEqual([
      ['running', true, false],
      ['waiting', false, true],
      ['idle', false, false],
    ])
  })
})

describe('relativeTime', () => {
  const MIN = 60_000
  const HOUR = 60 * MIN
  const DAY = 24 * HOUR

  it('buckets ages the way the workspace tree does', () => {
    expect(relativeTime(1_000, 1_000 + MIN - 1)).toEqual({ unit: 'now', n: 0 })
    expect(relativeTime(1_000, 1_000 + 5 * MIN)).toEqual({ unit: 'minutes', n: 5 })
    expect(relativeTime(1_000, 1_000 + 3 * HOUR)).toEqual({ unit: 'hours', n: 3 })
    expect(relativeTime(1_000, 1_000 + 2 * DAY)).toEqual({ unit: 'days', n: 2 })
    expect(relativeTime(1_000, 1_000 + 40 * DAY)).toEqual({ unit: 'months', n: 1 })
    expect(relativeTime(1_000, 1_000 + 400 * DAY)).toEqual({ unit: 'years', n: 1 })
  })

  it('never reports a negative age', () => {
    expect(relativeTime(5_000, 1_000)).toEqual({ unit: 'now', n: 0 })
  })
})
