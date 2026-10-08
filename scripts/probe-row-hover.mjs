/**
 * Geometry probe for the 最近 rows' hover state.
 *
 * Renders a page whose stylesheet is extracted *from the built bundle*
 * (lib/client.js) — not from the source file — so what is measured is what the
 * GUI actually ships. Each row is built the way the component builds it: an
 * `<li>` holding the row, one `title` span, and the fixed trailing cell whose
 * single occupant changes with the state.
 *
 * Reports, for each row: the row's and title's x offset, the row's width, the
 * trailing cell's width, and the column's scrollWidth/clientWidth — and does it
 * three times: at rest, with the row forced into its hover state, and with the
 * row's menu open (same state, so the same numbers are the expectation).
 *
 *   node scripts/probe-row-hover.mjs [outDir]
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'

const require = createRequire('/Users/douba/Projects/dsh-drag/package.json')
const { chromium } = require('playwright')

const root = fileURLToPath(new URL('..', import.meta.url))
const outDir = process.argv[2] ?? '/tmp/dsh-recent-probe'
mkdirSync(outDir, { recursive: true })

/** Pull every rule the built bundle carries, minus the two motion exceptions. */
function shippedCss() {
  const bundle = readFileSync(`${root}/lib/client.js`, 'utf8')
  const match = bundle.match(/const css = "((?:[^"\\]|\\.)*)"/)
  if (match === null) throw new Error('the built bundle carries no inlined stylesheet')
  const css = JSON.parse(`"${match[1]}"`)
  // The chevron's turn is the one transition the plugin still ships; it belongs
  // to the section header, not to a row, and must not blur "the row has none".
  return { css, hasChevronTransition: css.includes('transition:transform .15s') }
}

const { css, hasChevronTransition } = shippedCss()
const cls = name => css.match(new RegExp(`\\.(\\w+_${name})\\{`))?.[1] ?? (() => { throw new Error(`no rule for ${name}`) })()
const NAMES = {
  row: 'row', title: 'title', slot: 'slot',
  trailing: 'rowTrailing', time: 'time', pin: 'pinIndicator', actions: 'rowActions', icon: 'iconButton',
}
const c = Object.fromEntries(Object.entries(NAMES).map(([key, value]) => [key, cls(value)]))
// The column class is only used by this probe to hold the rows, not by the
// rules themselves — name it here so no real class is borrowed for a fake box.
c.column = 'probe-column'

const page = await chromium.launch({ channel: 'chrome' }).then(browser => browser.newPage({ viewport: { width: 900, height: 700 } }))

async function buildRow({ pinned, age, pending }) {
  return page.evaluate(({ c, css, pinned, age, pending }) => {
    const column = document.createElement('div')
    column.className = 'probe-column'
    column.style.cssText = 'width:344px;position:relative;overflow-x:auto;padding:0 0 0 0'
    const list = document.createElement('ul')
    list.style.cssText = 'list-style:none;margin:0;padding:0'
    const near = ['上一条会话', '下一条会话']
    const rows = [near[0], '这一条会话', near[1]].map((label, index) => {
      const li = document.createElement('li')
      const row = document.createElement('div')
      row.className = c.row
      row.id = `row-${index}`
      row.innerHTML = `<span class="${c.slot}"></span><span class="${c.title}">${label}</span>`
      const trailing = document.createElement('span')
      trailing.className = c.trailing
      trailing.innerHTML = `<span class="${c.time}">${age}</span>` + (pinned ? `<span class="${c.pin}">PIN</span>` : '')
      row.append(trailing)
      li.append(row)
      list.append(li)
      return row
    })
    column.append(list)
    document.body.append(column)
    document.head.insertAdjacentHTML('beforeend', `<style>${css}</style>`)
    return true
  }, { c, css, pinned, age, pending })
}

/** Force a row into the state the component's `.rowActive` class stands for. */
async function setActive(index, on) {
  await page.evaluate(({ c, index, on }) => {
    const row = document.querySelector(`#row-${index}`)
    row.classList.toggle(c.row, true)
    row.classList.toggle(c.rowActive, on)
    const trailing = row.querySelector(`.${c.trailing}`)
    const atRest = trailing.dataset.rest
    trailing.innerHTML = on
      ? `<span class="${c.actions}"><button class="${c.icon}">⋯</button><button class="${c.icon}">A</button><button class="${c.icon}">P</button></span>`
      : atRest
  }, { c, index, on })
}

async function measure(label) {
  return page.evaluate(({ c, label }) => {
    const read = index => {
      const row = document.querySelector(`#row-${index}`)
      const title = row.querySelector(`.${c.title}`)
      const trailing = row.querySelector(`.${c.trailing}`)
      return {
        rowX: +row.getBoundingClientRect().x.toFixed(2),
        rowWidth: +row.getBoundingClientRect().width.toFixed(2),
        titleX: +title.getBoundingClientRect().x.toFixed(2),
        trailingX: +trailing.getBoundingClientRect().x.toFixed(2),
        trailingWidth: +trailing.getBoundingClientRect().width.toFixed(2),
      }
    }
    const column = document.querySelector('.probe-column')
    return {
      label,
      hovered: read(1),
      above: read(0),
      below: read(2),
      overflow: { scrollWidth: column.scrollWidth, clientWidth: column.clientWidth },
    }
  }, { c, label })
}

await buildRow({ pinned: true, age: '24分钟' })
const before = await measure('at rest (pinned, 24分钟)')

// The resting markup is kept aside so "menu open" can restore it afterwards.
await page.evaluate(({ c }) => {
  document.querySelectorAll(`.${c.trailing}`).forEach(node => { node.dataset.rest = node.innerHTML })
}, { c })

await setActive(1, true)
const hovered = await measure('pointer on the middle row')
const restMiddle = await page.evaluate(() => document.querySelector('#row-3') !== null)
const hoveredAbove = hovered.above
const hoveredBelow = hovered.below

await page.screenshot({ path: `${outDir}/hover.png`, clip: { x: 0, y: 0, width: 360, height: 120 } })

await setActive(1, false)
const after = await measure('pointer away again')

// A silent-transition audit: no row-ish element may animate layout.
const transitions = await page.evaluate(({ c }) => {
  const out = []
  for (const node of document.querySelectorAll(`.${c.row}, .${c.row} *`)) {
    const style = getComputedStyle(node)
    if (style.transitionDuration !== '0s') out.push({ cls: node.className, duration: style.transitionDuration, prop: style.transitionProperty })
  }
  return out
}, { c })

const report = {
  shippedCssFromBundle: true,
  hasChevronTransition,
  before, hovered, after, transitions,
  verdict: {
    hoveredRowXUnchanged: hovered.hovered.rowX === before.hovered.rowX,
    hoveredRowWidthUnchanged: hovered.hovered.rowWidth === before.hovered.rowWidth,
    titleXUnchanged: hovered.hovered.titleX === before.hovered.titleX,
    neighboursUnchanged: JSON.stringify(hovered.above) === JSON.stringify(before.above)
      && JSON.stringify(hovered.below) === JSON.stringify(before.below),
    noHorizontalOverflow: hovered.overflow.scrollWidth === hovered.overflow.clientWidth,
    trailingWidthConstant: hovered.hovered.trailingWidth === before.hovered.trailingWidth,
    returnsToRest: JSON.stringify(after.hovered) === JSON.stringify(before.hovered),
    noRowTransitions: transitions.length === 0,
  },
}

writeFileSync(`${outDir}/report.json`, JSON.stringify(report, null, 2))
console.log(JSON.stringify(report, null, 2))
await page.context().browser().close()
