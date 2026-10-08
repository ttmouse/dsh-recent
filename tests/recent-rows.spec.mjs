/**
 * The 最近 section's row geometry, asserted against the *shipped* stylesheet.
 *
 * A row is the shell's own session row, and the shell's row paints its hover as
 * a full-bleed bar that reaches both edges of the sidebar column. This section's
 * rows must not move at all: the only things the pointer may change are the fill
 * and the trailing cell's contents, so the box the pointer is on, the box's
 * width, and the title's inline start are identical at rest, on hover, and with
 * a row's menu open.
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

const tsx = readFileSync(
  fileURLToPath(new URL('../src/client/RecentSessions.tsx', import.meta.url)),
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

/** The trailing cell: the age, the pin marker, and the row's actions all live in it. */
const TRAILING = '.rowTrailing'

describe('recent row hover geometry', () => {
  it('lets the pointer\'s row keep the box every other row has', () => {
    const body = ruleBody(ACTIVE)
    expect(body, `${ACTIVE} must exist: the highlight and the row's actions hang on it`).toBeDefined()
    // The 4px inset that used to live here is the movement that had to go: a row
    // that narrows under the pointer slides the fill's edge and steps its own
    // title sideways. Nothing about the row's box may change with the hover.
    expect(body).not.toMatch(/margin/)
    expect(body).not.toMatch(/\bwidth\s*:/)
    expect(body).not.toMatch(/padding/)
    expect(body).not.toMatch(/transition/)
    expect(body).not.toMatch(/\btransform\b/)
  })

  it('keeps the resting row full width and flush, so the column\'s text stays on one line', () => {
    const body = ruleBody('.row')
    expect(body).toBeDefined()
    expect(body).toMatch(/width:\s*100%/)
    // A base margin on .row would inset every row and move the text with it.
    expect(body).not.toMatch(/margin-(left|right):/)
  })

  it('paints the hover fill on the inset class, not on a full-bleed `:hover` box', () => {
    const hoverFill = ruleBody('.rowActive')
    expect(hoverFill, 'the active fill rule must exist').toBeDefined()
    expect(hoverFill).toMatch(/background:\s*var\(--dsw-alias-interactive-bg-hover\)/)
    const shared = ruleBody('.row:hover,\n.rowCurrent')
    expect(shared, 'the current session keeps the same fill').toBeDefined()
    expect(shared).toMatch(/background:\s*var\(--dsw-alias-interactive-bg-hover\)/)
    // The gutter and the fill have to be the same box: a separate
    // `.row:hover { margin... }` would let a row shift for the frame between
    // the pointer arriving and React writing the class.
    expect(css).not.toMatch(/\.row:hover\s*\{[^}]*margin-(left|right)/)
  })

  it('shows the fill in one step, with no transition on the row', () => {
    // The pointer may change what the row shows, never where it is: the row
    // must not carry a transition, and in particular none on `margin`, `width`
    // or `all`.
    const row = ruleBody('.row')
    expect(row).not.toMatch(/transition/)
    expect(row).not.toMatch(/\ball\b[a-z-]*\s*:/)
  })

  it('holds the trailing cell at one fixed width, so the title cannot be pulled sideways on hover', () => {
    const body = ruleBody(TRAILING)
    expect(body, `${TRAILING} must exist: it is the box the age, the pin marker and the actions share`).toBeDefined()
    // A cell that only exists on hover (or exists at a different width on hover)
    // resizes the flex line, and the title — the item that gives — moves under
    // the pointer. One width, declared once.
    expect(body).toMatch(/width:\s*74px/)
    expect(body).toMatch(/flex:\s*none/)
    // The three occupants alternate inside this box, so only one of them may
    // declare a margin, and it has to be the resting one.
    expect(ruleBody('.pinIndicator')).toMatch(/margin-left:\s*6px/)
    expect(ruleBody('.time')).not.toMatch(/margin/)
    expect(ruleBody('.rowActions')).not.toMatch(/margin/)
  })

  it('keeps the age and the actions mutually exclusive, and inside that fixed cell', () => {
    // The swap lives in the markup: exactly one of the three occupants is
    // rendered at a time, and all three are inside the trailing cell.
    const cell = tsx.slice(tsx.indexOf(`css.${TRAILING.slice(1)}`))
    const body = cell.slice(0, cell.indexOf('</span>\n            {showWorkspace'))
    expect(body, 'the trailing cell must hold the age').toMatch(/\{!active && \(\s*<span className=\{css\.time\}/)
    expect(body, 'the trailing cell must hold the row\'s actions').toMatch(/\{active && \(\s*<span className=\{css\.rowActions\}/)
    expect(body, 'the actions must render only while the row is active').not.toMatch(/display:\s*none/)
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
