import { describe, expect, it } from 'vitest'
import { en, NS, zh } from '../src/client/locales.ts'

describe('recent locales', () => {
  it('owns one namespace', () => {
    expect(NS).toBe('recent')
  })

  it('keeps both dictionaries on the same key set', () => {
    expect(Object.keys(en).sort()).toEqual(Object.keys(zh).sort())
  })

  it('carries every template parameter its call sites pass', () => {
    expect(zh['fold.expandWorkspaces']).toContain('{n}')
    expect(zh['row.open']).toContain('{name}')
    expect(zh['actions.session.aria']).toContain('{name}')
    expect(zh['archive.confirm.desc']).toContain('{title}')
    expect(zh['time.minutes']).toContain('{n}')
    expect(zh['time.ago']).toContain('{t}')
  })

  it('speaks the shell\'s words for the row states it copies', () => {
    // The rows and the card read as the workspace tree's do, so these are the
    // shell's own strings, not a second translation of the same states.
    expect(zh['status.running']).toBe('进行中')
    expect(zh['status.compact.approval']).toBe('待审批')
    expect(zh['status.compact.planReview']).toBe('计划待审')
    expect(zh['status.compact.answer']).toBe('待回答')
    expect(zh['menu.pinSession']).toBe('置顶会话')
    expect(zh['menu.archiveSession']).toBe('归档会话')
    expect(zh['row.pinned']).toBe('已置顶')
  })
})
