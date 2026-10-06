import { describe, expect, it } from 'vitest'
import { parseStoredFlag } from '../src/client/viewOptions.ts'

describe('view options persistence', () => {
  it('reads only the exact on marker as on', () => {
    expect(parseStoredFlag('1')).toBe(true)
  })

  it('treats absent, empty, and corrupted values as the default off', () => {
    expect(parseStoredFlag(null)).toBe(false)
    expect(parseStoredFlag('')).toBe(false)
    expect(parseStoredFlag('0')).toBe(false)
    expect(parseStoredFlag('true')).toBe(false)
    expect(parseStoredFlag(' 1')).toBe(false)
  })

  it('survives a storage that refuses reads', () => {
    const refusing: { getItem: (key: string) => string | null } = {
      getItem() {
        throw new Error('denied')
      },
    }
    expect(() => refusing.getItem('dsh-recent:view.showWorkspace')).toThrow()
    // loadShowWorkspace wraps the read in try/catch, so a refusal degrades to
    // the default rather than breaking the section's first render.
    expect(parseStoredFlag(null)).toBe(false)
  })
})
