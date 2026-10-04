/**
 * Built-artifact smoke test: the browser half must ship as a DSH module-table
 * handoff whose only requires are platform words. Skipped on a clean tree
 * (lib/ absent) so `pnpm test` needs no build.
 */
import { existsSync, readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const require = createRequire(import.meta.url)
const bundlePath = fileURLToPath(new URL('../lib/client.js', import.meta.url))
const built = existsSync(bundlePath)

/** Export names the installed primitives package publishes to the browser. */
function primitivesExports() {
  // Read the installed package instead of importing it: its own bare imports
  // (shiki, katex, simple-icons) resolve through the shell's module table, which
  // exists only in the browser.
  const source = readFileSync(require.resolve('@deepseek-ai/dsh-client-ui-primitives'), 'utf8')
  const names = new Set()
  for (const block of source.matchAll(/export \{([^}]*)\}/g)) {
    for (const entry of block[1].split(',')) {
      const name = entry.trim().split(/\s+as\s+/).pop()
      if (name !== undefined && name !== '') names.add(name)
    }
  }
  return names
}

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
      'react-dom',
      'react/jsx-runtime',
    ])
  })

  /**
   * A primitive the runtime does not export compiles to `undefined`, and React
   * answers the first render of that element with error #130 — which the
   * sidebar slot reports as a crashed entry, taking the whole section down. The
   * hover card is the only surface whose imports render after a pointer dwell,
   * so a renamed import there ships green and breaks the section on first
   * hover; the bundle must name only what the installed primitives export.
   */
  it('references only primitives the runtime exports', () => {
    const binding = source.match(/let (\w+) = require\("@deepseek-ai\/dsh-client-ui-primitives"\)/)?.[1]
    expect(binding).toBeDefined()
    const referenced = new Set(
      [...source.matchAll(new RegExp(`${binding}(?:\\.([A-Za-z0-9_$]+)|\\[\\s*"([^"]+)"\\s*\\])`, 'g'))]
        .map(match => match[1] ?? match[2]),
    )
    const exported = primitivesExports()
    // Guards the parser itself: an empty or tiny export list would pass vacuously.
    expect(exported.size).toBeGreaterThan(100)
    expect(referenced.size).toBeGreaterThan(0)
    expect([...referenced].filter(name => !exported.has(name))).toEqual([])
  })

  it('exports the cordis plugin face and inlines its stylesheet', () => {
    expect(source).toContain('exports.apply = apply')
    expect(source).toContain('exports.inject = inject')
    expect(source).toContain('data-plugin-css')
  })
})
