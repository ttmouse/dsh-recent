import { describe, expect, it, vi } from 'vitest'
import type { UiWorkspace } from '@deepseek-ai/dsh-client-ui-workspace/client'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import { isActiveRefusal, recentActions } from '../src/client/sessionActions.ts'

const sid = (value: string): SessionId => value as SessionId

/** The Host's refusal to archive a Session that still has work. */
function activeRefusal(): Error {
  const error = new Error('session still active')
  error.name = 'WorkspaceArchiveError'
  Object.assign(error, { rpcError: { code: 'workspace/session-active', details: { activity: [] } } })
  return error
}

/** A workspace service with every call a spy the test can steer. */
function service(over: Partial<Record<keyof UiWorkspace, unknown>> = {}) {
  return {
    openSession: vi.fn(),
    archiveSession: vi.fn(async () => {}),
    pinSession: vi.fn(async () => {}),
    unpinSession: vi.fn(async () => {}),
    forkSession: vi.fn(async () => sid('child')),
    ...over,
  } as unknown as UiWorkspace
}

describe('isActiveRefusal', () => {
  it('recognizes the Host refusal by the shape the plugin can see', () => {
    expect(isActiveRefusal(activeRefusal())).toBe(true)
  })

  it('leaves every other failure alone', () => {
    expect(isActiveRefusal(new Error('boom'))).toBe(false)
    expect(isActiveRefusal('boom')).toBe(false)
    const wrongCode = activeRefusal()
    Object.assign(wrongCode, { rpcError: { code: 'workspace/missing' } })
    expect(isActiveRefusal(wrongCode)).toBe(false)
    const wrongName = new Error('boom')
    Object.assign(wrongName, { rpcError: { code: 'workspace/session-active' } })
    expect(isActiveRefusal(wrongName)).toBe(false)
  })
})

describe('recentActions', () => {
  it('opens the session through the workspace service', () => {
    const ui = service()
    recentActions(ui).open(sid('a'))
    expect(ui.openSession).toHaveBeenCalledWith('a')
  })

  it('reports an archived session as archived', async () => {
    const ui = service()
    await expect(recentActions(ui).archive(sid('a'))).resolves.toBe('archived')
    expect(ui.archiveSession).toHaveBeenCalledWith('a')
  })

  it('reports the active-session refusal instead of throwing', async () => {
    const ui = service({ archiveSession: vi.fn(async () => { throw activeRefusal() }) })
    await expect(recentActions(ui).archive(sid('a'))).resolves.toBe('active')
  })

  it('reports any other archive failure as failed, and logs it', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const ui = service({ archiveSession: vi.fn(async () => { throw new Error('carrier down') }) })
    await expect(recentActions(ui).archive(sid('a'))).resolves.toBe('failed')
    expect(warn).toHaveBeenCalled()
    warn.mockRestore()
  })

  it('stops the session before archiving when the refusal is confirmed', async () => {
    const ui = service()
    await recentActions(ui).stopAndArchive(sid('a'))
    expect(ui.archiveSession).toHaveBeenCalledWith('a', { stopActivity: true })
  })

  it('pins, unpins, and forks without surfacing a failure', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const ui = service({
      pinSession: vi.fn(async () => { throw new Error('no') }),
      unpinSession: vi.fn(async () => { throw new Error('no') }),
      forkSession: vi.fn(async () => { throw new Error('no') }),
    })
    const actions = recentActions(ui)
    actions.pin(sid('a'))
    actions.unpin(sid('a'))
    actions.fork(sid('a'))
    await Promise.resolve()
    await Promise.resolve()
    expect(ui.pinSession).toHaveBeenCalledWith('a')
    expect(ui.unpinSession).toHaveBeenCalledWith('a')
    expect(ui.forkSession).toHaveBeenCalledWith('a')
    expect(warn).toHaveBeenCalledTimes(3)
    warn.mockRestore()
  })
})
