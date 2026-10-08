/**
 * The 最近 section's row geometry, asserted against the *shipped* stylesheet.
 *
 * Two requirements meet on one row, and they have to be satisfied by different
 * layers:
 *
 * - the pointer's row shows a 4px gutter on each side, so it reads as a card
 *   floating over the list rather than as a full-bleed band; and
 * - nothing about the row moves. Its box, its width, the title's inline start
 *   and the trailing cell measure identically at rest, on hover, and with the
 *   row's menu open.
 *
 * Insetting the row's *box* would satisfy the first and break the second — the
 * box is the layout of the text inside it, so the title steps sideways and,
 * being layout, dropping the transition only removes the slide, not the jump.
 * The gutter therefore lives on the fill's own layer (`.row::before`), which
 * insets the paint without touching layout.
 *
 * Read from `src/client/RecentSessions.module.css` rather than from a rendered
 * DOM: the geometry is the deliverable, the class names are hashed by the
 * bundler, and jsdom computes no layout — a rendering test could only restate
 * the JSX, not measure the box. The rendered geometry (including the layer's
 * inset) is measured separately by scripts/probe-row-hover.mjs.
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

/** The fill's own layer — the only thing about a row a hover is allowed to change. */
const LAYER = '.row::before'

describe('recent row hover geometry', () => {
  it('draws the fill on a layer inset 4px at each inline end', () => {
    const layer = ruleBody(LAYER)
    expect(layer, `${LAYER} must exist: it is where the gutter comes from`).toBeDefined()
    // The gutter itself: full height, 4px short of each inline end.
    expect(layer).toMatch(/inset:\s*0\s+4px/)
    expect(layer).toMatch(/background:\s*transparent/)
    // Under the row's content, and not a click target of its own.
    expect(layer).toMatch(/z-index:\s*-1/)
    expect(layer).toMatch(/pointer-events:\s*none/)
  })

  it('isolates that layer inside the row, so it cannot fall behind an ancestor', () => {
    // Without `isolation` a negative-z child can escape the row's stacking
    // context and paint behind an ancestor's background, i.e. disappear.
    expect(ruleBody('.row')).toMatch(/isolation:\s*isolate/)
    expect(ruleBody('.row')).toMatch(/position:\s*relative/)
  })

  it('turns the layer on for the pointer\'s row, the current row and an open menu', () => {
    const fill = ruleBody('.row:hover::before,\n.rowActive::before,\n.rowCurrent::before')
    expect(fill, 'the three highlighted states must paint on the layer').toBeDefined()
    expect(fill).toMatch(/background:\s*var\(--dsw-alias-interactive-bg-hover\)/)
  })

  it('keeps the fill off the row box itself, so it can never be full-bleed', () => {
    // A fill on `.row` (or on a bare `.row:hover`) would reach both column
    // edges and lose the gutter; the row's own background stays transparent.
    expect(ruleBody('.row')).toMatch(/background:\s*transparent/)
    expect(css).not.toMatch(/\.row:hover\s*\{/)
    expect(css).not.toMatch(/\n\.rowActive\s*\{/)
  })

  it('changes no box property on the row for any hover state', () => {
    // The row is the layout box of its text: a margin/width/padding swap on any
    // hover state steps the title sideways. Only the layer's fill may change.
    const boxSwap = /\.row(?::hover|Active|Current)+[^{]*\{[^}]*(margin|width|padding|transition|transform)/
    expect(css).not.toMatch(boxSwap)
    // The 4px inset that used to live on the row's own box is gone for good.
    expect(css).not.toMatch(/\.rowActive\s*\{[^}]*margin/)
  })

  it('shows the fill in one step, with no transition on the row', () => {
    const row = ruleBody('.row')
    expect(row).not.toMatch(/transition/)
    expect(row).not.toMatch(/\ball\b[a-z-]*\s*:/)
    expect(ruleBody(LAYER)).not.toMatch(/transition/)
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
