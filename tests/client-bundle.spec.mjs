/**
 * Built-artifact smoke test: the browser half must ship as a DSH module-table
 * handoff whose only requires are platform words. Skipped on a clean tree
 * (lib/ absent) so `pnpm test` needs no build.
 */
import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const bundlePath = fileURLToPath(new URL('../lib/client.js', import.meta.url))
const built = existsSync(bundlePath)

describe.skipIf(!built)('built client bundle', () => {
  const source = built ? readFileSync(bundlePath, 'utf8') : ''

  it('registers under the loader id the host serves', () => {
    expect(source).toContain('window.__ModuleLoader__.load({')
    expect(source).toContain('id: "dsh-recent"')
  })

  it('requires only module-table words', () => {
    const requires = [...source.matchAll(/require\("([^"]+)"\)/g)].map(match => match[1]).sort()
    expect(requires).toEqual([
      '@deepseek-ai/dsh-client-ui-primitives',
      'react',
      'react/jsx-runtime',
    ])
  })

  it('exports the cordis plugin face and inlines its stylesheet', () => {
    expect(source).toContain('exports.apply = apply')
    expect(source).toContain('exports.inject = inject')
    expect(source).toContain('data-plugin-css')
  })
})
