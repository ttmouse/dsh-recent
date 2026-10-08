/**
 * The 最近 section's row geometry, asserted against the *shipped* stylesheet.
 *
 * The rows are the shell's own session rows, and the shell's rows paint their
 * hover as a full-bleed bar that reaches both edges of the sidebar column. This
 * section's rows must not: the pointer's row floats as a card with a gutter on
 * each side, which is what the operator sees as "the hovered row has space
 * around it". The rows at rest keep the full width, so the column's text stays
 * on one inline start whether or not something is hovered.
 *
 * Read from `src/client/RecentSessions.module.css` rather than from a rendered
 * DOM: the geometry is the deliverable, the class names are hashed by the
 * bundler, and jsdom computes no layout — a rendering test could only restate
 * the JSX, not measure the box.
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const css = readFileSync(
  fileURLToPath(new URL('../src/client/RecentSessions.module.css', import.meta.url)),
  'utf8',
)

/**
 * The declarations of one rule, by exact selector text.
 * @param selector - the selector line, as written in the stylesheet.
 * @returns the rule body, or undefined when no such rule exists.
 */
function ruleBody(selector) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return css.match(new RegExp(`(?:^|\\n)${escaped}\\s*\\{([^}]*)\\}`))?.[1]
}

/** The hovered row's own class, which the component writes while the pointer is on it. */
const ACTIVE = '.rowActive'

describe('recent row hover geometry', () => {
  it('floats the pointer\'s row with a gutter on both sides', () => {
    const body = ruleBody(ACTIVE)
    expect(body, `${ACTIVE} must exist: the hovered row is the card the gutter belongs to`).toBeDefined()
    expect(body).toMatch(/margin-left:\s*4px/)
    expect(body).toMatch(/margin-right:\s*4px/)
  })

  it('keeps the resting row full width and flush, so the column\'s text stays on one line', () => {
    const body = ruleBody('.row')
    expect(body).toBeDefined()
    expect(body).toMatch(/width:\s*100%/)
    // A base margin on .row would inset every row and move the text with it.
    expect(body).not.toMatch(/margin-(left|right):/)
  })

  it('paints the hover fill on the inset class, not on a full-bleed `:hover` box', () => {
    const hoverFill = ruleBody('.row:hover,\n.rowActive,\n.rowCurrent')
    expect(hoverFill, 'the shared hover/current fill rule must exist').toBeDefined()
    expect(hoverFill).toMatch(/background:\s*var\(--dsw-alias-interactive-bg-hover\)/)
    // The gutter and the fill have to be the same box: a separate
    // `.row:hover { margin... }` would let a row paint full-bleed for the frame
    // between the pointer arriving and React writing the class.
    expect(css).not.toMatch(/\.row:hover\s*\{[^}]*margin-(left|right)/)
  })

  it('eases the gutter so a sweep down the list does not snap', () => {
    expect(ruleBody('.row')).toMatch(/transition:\s*margin\s/)
  })

  it('holds the row\'s actions only in the active state', () => {
    const actions = ruleBody('.rowActions')
    expect(actions).toBeDefined()
    // The actions are mounted by React while the row is active, so the
    // stylesheet must not keep a `display: none` resting state — that hidden
    // copy is exactly what a keyboard could reach.
    expect(actions).not.toMatch(/display:\s*none/)
    expect(actions).toMatch(/display:\s*inline-flex/)
    expect(css).not.toContain('rowMenuOpen')
  })
})
