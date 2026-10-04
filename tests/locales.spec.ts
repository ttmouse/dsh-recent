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
    expect(zh['section.count']).toContain('{n}')
    expect(zh['row.open']).toContain('{name}')
    expect(zh['time.minutes']).toContain('{n}')
    expect(zh['time.ago']).toContain('{t}')
  })
})
