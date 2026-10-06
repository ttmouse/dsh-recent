// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { SessionListState, SessionSummary } from '@deepseek-ai/dsh-api-session-controller/client'
import type { WorkspaceId, WorkspaceView } from '@deepseek-ai/dsh-api-workspace-controller/client'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import {
  FOLD_ROW_ATTRIBUTE, WorkspaceListFold, groupKey, groupRecency, groupSections, loadWorkspaceExpanded,
  saveWorkspaceExpanded, splitByRecency, UNGROUPED_KEY, workspaceListContainer,
} from '../src/client/workspaceFold.ts'

/**
 * The shell's sidebar shape, flattened to the parts the fold resolves: the
 * column (its foot area names it), the region holding the browser, the list
 * and the wrapper it scrolls inside, and one group section per workspace.
 * Class-name fragments match the installed `ui-workspace` CSS Module suffixes.
 */
function mountSidebar(groupCount: number, options: { plainRows?: boolean; ungrouped?: boolean } = {}): HTMLElement {
  const list = document.createElement('div')
  list.className = 'bhn1Oq_list'
  if (options.plainRows === true) {
    // Flat list / search mode: session rows render without group wrappers.
    for (let index = 0; index < groupCount; index++) {
      const row = document.createElement('div')
      row.className = 'YDXeBa_sessionRow'
      row.textContent = `plain ${index}`
      list.append(row)
    }
  } else {
    for (let index = 0; index < groupCount; index++) list.append(workspaceGroup(index))
    // The shell appends one trailing group for the sessions no Workspace claims.
    if (options.ungrouped === true) list.append(ungroupedGroup())
  }
  document.body.innerHTML = `
    <div class="hHd-Xa_root">
      <div class="hHd-Xa_regionArea"><div><div class="bhn1Oq_root">
        <div class="bhn1Oq_sectionHeader"><span class="bhn1Oq_sectionLabel bhn1Oq_wide">工作区</span>
          <button class="bhn1Oq_viewOptions" type="button">view</button></div>
        <div class="bhn1Oq_listArea"><div class="bhn1Oq_treeBody"><div class="bhn1Oq_list"></div></div></div>
      </div></div></div>
      <div class="hHd-Xa_footArea"><div class="hHd-Xa_footerActions"></div></div>
    </div>`
  const container = document.querySelector('.bhn1Oq_list')
  if (container === null) throw new Error('test fixture: list container missing')
  container.replaceChildren(...list.children)
  return container as HTMLElement
}

/** One registered Workspace: a reorderable header row plus its session rows. */
function workspaceGroup(index: number): HTMLElement {
  const group = document.createElement('div')
  group.className = 'bhn1Oq_groupSection'
  const project = document.createElement('div')
  project.className = 'YDXeBa_projectRow'
  project.setAttribute('role', 'treeitem')
  project.setAttribute('draggable', 'true')
  // The shell addresses each group by its own header row.
  project.setAttribute('data-row-key', `workspace:w${index}`)
  project.textContent = `project ${index}`
  const session = document.createElement('div')
  session.className = 'YDXeBa_sessionRow'
  session.textContent = `session ${index}`
  group.append(project, session)
  return group
}

/** The shell's trailing bucket for the sessions no Workspace claims. */
function ungroupedGroup(): HTMLElement {
  const group = document.createElement('div')
  group.className = 'bhn1Oq_groupSection'
  const project = document.createElement('div')
  project.className = 'YDXeBa_projectRow'
  project.setAttribute('role', 'treeitem')
  project.setAttribute('draggable', 'false')
  // The bucket's key is the empty string, as in the shell's own group model.
  project.setAttribute('data-row-key', `workspace:${UNGROUPED_KEY}`)
  project.textContent = 'ungrouped'
  const session = document.createElement('div')
  session.className = 'YDXeBa_sessionRow'
  session.textContent = 'ungrouped session'
  group.append(project, session)
  return group
}

function foldRow(): HTMLElement | null {
  return document.querySelector(`[${FOLD_ROW_ATTRIBUTE}]`)
}

/**
 * Mount the recent section the way the component does: an element appended to
 * the workspace list's own scroll area, which is the portal target — the
 * section is the column's last content and scrolls with it.
 */
function mountSection(): HTMLElement {
  const area = workspaceListContainer(document)
  if (area === undefined) throw new Error('test fixture: list area missing')
  const section = document.createElement('div')
  section.setAttribute('data-slot', 'sidebar.recent.section')
  area.append(section)
  return section
}

function visibleTexts(container: HTMLElement): string[] {
  return [...container.children]
    .filter((child): child is HTMLElement => child instanceof HTMLElement
      && !child.hasAttribute(FOLD_ROW_ATTRIBUTE)
      && child.style.display !== 'none')
    .map((child) => {
      const project = child.querySelector('[class*="_projectRow"]')
      return (project ?? child).textContent ?? ''
    })
}

/** A fold whose ranking reads one table of group-key → newest history time. */
function makeFold(overrides: Partial<ConstructorParameters<typeof WorkspaceListFold>[0]> = {}) {
  const onToggle = vi.fn()
  const onToggleSection = vi.fn()
  const fold = new WorkspaceListFold({
    limit: 5,
    labels: { expand: hidden => `show ${hidden} more`, collapse: 'show less' },
    recency: () => undefined,
    onToggle,
    onToggleSection,
    ...overrides,
  })
  return { fold, onToggle, onToggleSection }
}

/** Ranking input for {@link makeFold}: newest history time per group key. */
function recencyFrom(times: Readonly<Record<string, number>>): (key: string) => number | undefined {
  return key => times[key]
}

/** The shell's section header, adopted by the fold as the collapse toggle. */
function sectionHeader(): HTMLElement {
  const header = document.querySelector('[class*="_sectionHeader"]')
  if (!(header instanceof HTMLElement)) throw new Error('test fixture: section header missing')
  return header
}

/** Chevron injected into the section header (an SVG, so no `HTMLElement` narrowing). */
function chevron(): SVGElement | null {
  return document.querySelector('[data-dsh-recent-section-chevron]')
}

const sid = (value: string): SessionId => value as SessionId
const wid = (value: string): WorkspaceId => value as WorkspaceId

/** A catalog row holding `updatedAt`, with the archive/blank/origin knobs under test. */
function summary(id: string, updatedAt: number, over: Partial<SessionSummary> = {}): SessionSummary {
  return { id: sid(id), displayTitle: id, running: false, retainedBy: {}, blank: false, updatedAt, ...over }
}

function listState(sessions: readonly SessionSummary[]): SessionListState {
  return {
    ids: sessions.map(session => session.id),
    byId: Object.fromEntries(sessions.map(session => [session.id, session])),
    phase: 'ready',
    projectionsBySession: {},
  }
}

function workspace(id: string, sessionIds: readonly string[]): WorkspaceView {
  return {
    workspaceId: wid(id),
    path: `/work/${id}`,
    title: id,
    sessionIds: sessionIds.map(sid),
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  }
}

afterEach(() => { document.body.innerHTML = '' })

describe('workspace list resolution', () => {
  it('resolves the container through a rendered group section', () => {
    const container = mountSidebar(3)
    expect(workspaceListContainer(document)).toBe(container)
    expect(groupSections(container)).toHaveLength(3)
  })

  it('reports no container in flat or search rendering', () => {
    mountSidebar(3, { plainRows: true })
    expect(workspaceListContainer(document)).toBeUndefined()
  })
})

describe('groupKey', () => {
  it('reads the key the shell writes on the group header row', () => {
    const container = mountSidebar(2, { ungrouped: true })
    const [first, second, bucket] = groupSections(container)
    expect(groupKey(first as HTMLElement)).toBe('w0')
    expect(groupKey(second as HTMLElement)).toBe('w1')
    // The bucket's key is the empty string, so it stays addressable.
    expect(groupKey(bucket as HTMLElement)).toBe(UNGROUPED_KEY)
  })

  it('reports no key for a section without a header row', () => {
    expect(groupKey(document.createElement('div'))).toBeUndefined()
  })
})

describe('groupRecency', () => {
  it('reports the newest history time of every Workspace and of the bucket', () => {
    const recency = groupRecency({
      list: listState([
        summary('a', 100),
        summary('b', 300),
        summary('c', 200),
        summary('loose', 50),
      ]),
      workspaces: [workspace('w1', ['a', 'c']), workspace('w2', ['b'])],
      archivedSessionIds: [],
    })
    expect(recency.get('w1')).toBe(200)
    expect(recency.get('w2')).toBe(300)
    // A Session no Workspace accounts for belongs to the trailing bucket.
    expect(recency.get(UNGROUPED_KEY)).toBe(50)
  })

  it('leaves out sessions that hold no history, exactly as the 最近 list does', () => {
    const recency = groupRecency({
      list: listState([
        summary('kept', 100),
        summary('archived', 900),
        summary('blank', 800, { blank: true }),
        summary('child', 700, { origin: 'subagent', parentId: sid('kept') }),
      ]),
      workspaces: [workspace('w1', ['kept', 'archived', 'blank', 'child'])],
      archivedSessionIds: [sid('archived')],
    })
    expect(recency.get('w1')).toBe(100)
    expect(recency.has(UNGROUPED_KEY)).toBe(false)
  })

  it('reports nothing for a group whose history is unknown', () => {
    const recency = groupRecency({ list: listState([]), workspaces: [workspace('empty', [])], archivedSessionIds: [] })
    expect(recency.size).toBe(0)
  })
})

describe('splitByRecency', () => {
  it('keeps the newest groups and holds the rest back, in render order', () => {
    const times: Record<string, number> = { a: 1, b: 3, c: 2, d: 4 }
    const split = splitByRecency(['a', 'b', 'c', 'd'], 2, false, group => times[group])
    // d and b win; the survivors keep the list's own order.
    expect(split).toEqual({ visible: ['b', 'd'], hidden: ['a', 'c'] })
  })

  it('holds nothing back while expanded or within the limit', () => {
    expect(splitByRecency(['a', 'b', 'c'], 2, true, () => 1)).toEqual({ visible: ['a', 'b', 'c'], hidden: [] })
    expect(splitByRecency(['a'], 5, false, () => 1)).toEqual({ visible: ['a'], hidden: [] })
  })

  it('ranks a group with no known history last and keeps ties in render order', () => {
    const times: Record<string, number | undefined> = { a: 5, b: undefined, c: 5, d: Number.NaN }
    const split = splitByRecency(['a', 'b', 'c', 'd'], 2, false, group => times[group])
    expect(split.visible).toEqual(['a', 'c'])
    expect(split.hidden).toEqual(['b', 'd'])
  })
})

describe('WorkspaceListFold', () => {
  it('keeps the five groups with the newest history and folds the rest', () => {
    const container = mountSidebar(8)
    // The freshest group leads the render order, so a fold that merely cut the
    // list at five would keep it and lose the point of ranking: the survivors
    // come from anywhere in the list.
    const { fold } = makeFold({
      recency: recencyFrom({ w0: 900, w4: 400, w5: 500, w6: 600, w7: 700, w1: 100, w2: 200, w3: 300 }),
    })
    const dispose = fold.start()

    expect(visibleTexts(container)).toEqual([
      'project 0', 'project 4', 'project 5', 'project 6', 'project 7',
    ])
    // The three stale groups in the middle are the ones held back.
    expect((container.children[1] as HTMLElement).style.display).toBe('none')
    expect((container.children[2] as HTMLElement).style.display).toBe('none')
    expect((container.children[3] as HTMLElement).style.display).toBe('none')
    const row = foldRow()
    expect(row?.textContent).toBe('show 3 more')
    expect(row?.getAttribute('aria-expanded')).toBe('false')
    // The row trails the last group the fold keeps, in render order.
    expect(row?.previousElementSibling).toBe(container.children[7])
    dispose()
  })

  it('ranks a group that holds no history below every group that has some', () => {
    const container = mountSidebar(8)
    const { fold } = makeFold({ recency: recencyFrom({ w0: 100, w1: 90, w6: 80, w7: 70 }) })
    const dispose = fold.start()
    expect(visibleTexts(container)).toEqual([
      'project 0', 'project 1', 'project 2', 'project 6', 'project 7',
    ])
    // Four groups hold history and keep their places; the fifth slot goes to the
    // first silent group in render order, and the remaining silent groups fold.
    expect(foldRow()?.textContent).toBe('show 3 more')
    dispose()
  })

  it('re-ranks the list when the catalog moves', () => {
    const container = mountSidebar(6)
    const times: Record<string, number> = { w0: 100, w1: 90, w2: 80, w3: 70, w4: 60, w5: 50 }
    const { fold } = makeFold({ recency: key => times[key] })
    const dispose = fold.start()
    expect(visibleTexts(container)).toEqual(['project 0', 'project 1', 'project 2', 'project 3', 'project 4'])

    times.w5 = 1_000
    fold.refresh()
    expect(visibleTexts(container)).toEqual(['project 0', 'project 1', 'project 2', 'project 3', 'project 5'])
    expect(foldRow()?.textContent).toBe('show 1 more')
    dispose()
  })

  it('unfolds to every group and collapses back to the limit', () => {
    const container = mountSidebar(8)
    const { fold } = makeFold({ recency: recencyFrom({ w0: 100, w1: 90, w2: 80, w3: 70, w4: 60 }) })
    const dispose = fold.start()

    fold.setExpanded(true)
    expect(visibleTexts(container)).toHaveLength(8)
    expect(foldRow()?.textContent).toBe('show less')
    expect(foldRow()?.previousElementSibling).toBe(container.children[7])

    fold.setExpanded(false)
    expect(visibleTexts(container)).toHaveLength(5)
    expect(foldRow()?.textContent).toBe('show 3 more')
    dispose()
  })

  it('routes the fold row click to the owner', () => {
    mountSidebar(8)
    const { fold, onToggle } = makeFold()
    const dispose = fold.start()
    foldRow()?.click()
    expect(onToggle).toHaveBeenCalledTimes(1)
    dispose()
  })

  it('re-applies itself after React rewrites the list', async () => {
    const container = mountSidebar(8)
    const { fold } = makeFold({ recency: recencyFrom({ w0: 100, w1: 90, w2: 80, w3: 70, w4: 60 }) })
    const dispose = fold.start()

    // A frame arrives: the shell re-renders groups 0..1 only, then the full list.
    container.replaceChildren(...[...container.children].slice(0, 2))
    await new Promise(resolve => { setTimeout(resolve, 0) })
    expect(visibleTexts(container)).toEqual(['project 0', 'project 1'])
    expect(foldRow()).toBeNull()

    const withMore = mountSidebar(8)
    await new Promise(resolve => { setTimeout(resolve, 0) })
    expect(visibleTexts(withMore)).toHaveLength(5)
    expect(foldRow()?.textContent).toBe('show 3 more')
    dispose()
  })

  it('leaves flat and search rendering alone', () => {
    const container = mountSidebar(9, { plainRows: true })
    const { fold } = makeFold()
    const dispose = fold.start()
    expect(visibleTexts(container)).toHaveLength(9)
    expect(foldRow()).toBeNull()
    dispose()
  })

  it('shows no fold row when every group fits', () => {
    const container = mountSidebar(3)
    const { fold } = makeFold({ recency: recencyFrom({ w2: 900 }) })
    const dispose = fold.start()
    expect(visibleTexts(container)).toHaveLength(3)
    expect(foldRow()).toBeNull()
    dispose()
  })

  it('restores every group on disposal', () => {
    const container = mountSidebar(8)
    const { fold } = makeFold({ recency: recencyFrom({ w7: 900 }) })
    const dispose = fold.start()
    expect(container.children[7] instanceof HTMLElement && (container.children[7] as HTMLElement).style.display).not.toBe('none')
    dispose()
    expect(visibleTexts(container)).toHaveLength(8)
    expect(foldRow()).toBeNull()
  })
})

describe('workspace section collapse', () => {
  it('marks the shell header as the collapse toggle and places the chevron', () => {
    mountSidebar(8)
    const { fold } = makeFold()
    const dispose = fold.start()

    expect(chevron()).not.toBeNull()
    expect(chevron()?.parentElement).toBe(sectionHeader())
    // The marker sits directly after the label, so it hugs the name instead of
    // riding the header's right-aligned trailing controls.
    expect(chevron()?.previousElementSibling?.classList.contains('bhn1Oq_sectionLabel')).toBe(true)
    expect(sectionHeader().getAttribute('data-dsh-recent-section')).toBe('false')
    expect(sectionHeader().getAttribute('aria-expanded')).toBe('true')
    dispose()
    expect(chevron()).toBeNull()
  })

  it('turns the arrow with the fold, so it points right folded and down open', () => {
    mountSidebar(8)
    const { fold } = makeFold()
    const dispose = fold.start()

    // The arrow is the shell's thin chevron, not a filled triangle, and its
    // direction is the fold direction.
    expect(chevron()?.getAttribute('viewBox')).toBe('0 0 16 16')
    expect(chevron()?.querySelector('path')?.getAttribute('stroke')).toBe('currentColor')
    expect(chevron()?.querySelector('path')?.getAttribute('fill')).toBeNull()
    expect(chevron()?.style.transform).toBe('rotate(90deg)')

    fold.setCollapsed(true)
    expect(chevron()?.style.transform).toBe('')

    fold.setCollapsed(false)
    expect(chevron()?.style.transform).toBe('rotate(90deg)')
    dispose()
  })

  it('routes clicks on the header to the owner, leaving its buttons alone', () => {
    mountSidebar(8)
    const { fold, onToggleSection } = makeFold()
    const dispose = fold.start()

    sectionHeader().click()
    expect(onToggleSection).toHaveBeenCalledTimes(1)
    // A header button keeps its own behavior: its click bubbles to the header,
    // so the shell's control stops propagation exactly as it does in the shell
    // (the header listener only reacts to clicks on the header's own surface).
    const headerButton = sectionHeader().querySelector('button')
    headerButton?.addEventListener('click', event => { event.stopPropagation() })
    headerButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    expect(onToggleSection).toHaveBeenCalledTimes(1)
    dispose()
  })

  it('hides the whole list, chevron and fold row included, while collapsed', () => {
    const container = mountSidebar(8)
    const { fold } = makeFold()
    const dispose = fold.start()

    fold.setCollapsed(true)
    expect(visibleTexts(container)).toEqual([])
    expect(sectionHeader().getAttribute('data-dsh-recent-section')).toBe('true')
    expect(sectionHeader().getAttribute('aria-expanded')).toBe('false')
    expect(chevron()?.getAttribute('class') ?? '').not.toContain('chevronOpen')
    expect(foldRow()).toBeNull()

    fold.setCollapsed(false)
    expect(visibleTexts(container)).toHaveLength(5)
    expect(foldRow()?.textContent).toBe('show 3 more')
    dispose()
  })

  it('re-applies the collapse after React rewrites the header and list', async () => {
    const container = mountSidebar(8)
    const { fold } = makeFold()
    const dispose = fold.start()
    fold.setCollapsed(true)

    sectionHeader().remove()
    const replaced = document.createElement('div')
    replaced.className = 'bhn1Oq_sectionHeader'
    const label = document.createElement('span')
    label.className = 'bhn1Oq_sectionLabel'
    label.textContent = '工作区'
    replaced.append(label)
    document.querySelector('.hHd-Xa_regionArea > div > div')?.prepend(replaced)
    await new Promise(resolve => { setTimeout(resolve, 0) })

    expect(visibleTexts(container)).toEqual([])
    expect(chevron()?.parentElement).toBe(replaced)
    expect(chevron()?.previousElementSibling).toBe(replaced.firstElementChild)
    expect(chevron()?.nextElementSibling).toBe(sectionHeader().querySelector('button'))
    expect(replaced.getAttribute('data-dsh-recent-section')).toBe('true')
    dispose()
  })

  it('restores the header on disposal', () => {
    mountSidebar(8)
    const { fold } = makeFold()
    const dispose = fold.start()
    fold.setCollapsed(true)
    dispose()
    expect(sectionHeader().hasAttribute('data-dsh-recent-section')).toBe(false)
    expect(sectionHeader().hasAttribute('aria-expanded')).toBe(false)
    expect(sectionHeader().style.cursor).toBe('')
  })
})

describe('the ungrouped bucket', () => {
  it('competes for the five like any Workspace, and can win a place', () => {
    const container = mountSidebar(8, { ungrouped: true })
    // The bucket's own session is the freshest thing in the column, so the
    // bucket takes a slot and the stalest Workspace loses its own.
    const { fold } = makeFold({
      recency: recencyFrom({
        w0: 900, w1: 800, w2: 700, w3: 600, w4: 500, w5: 100, w6: 90, w7: 80, [UNGROUPED_KEY]: 1_000,
      }),
    })
    const dispose = fold.start()

    expect(visibleTexts(container)).toEqual([
      'project 0', 'project 1', 'project 2', 'project 3', 'ungrouped',
    ])
    expect(foldRow()?.textContent).toBe('show 4 more')
    // The bucket is the last group the fold keeps, so the row trails it.
    expect(foldRow()?.previousElementSibling).toBe(container.children[8])
    dispose()
  })

  it('folds away when it holds nothing recent', () => {
    const container = mountSidebar(8, { ungrouped: true })
    const { fold } = makeFold({
      recency: recencyFrom({ w0: 900, w1: 800, w2: 700, w3: 600, w4: 500, w5: 100, w6: 90, w7: 80 }),
    })
    const dispose = fold.start()

    expect(visibleTexts(container)).toEqual([
      'project 0', 'project 1', 'project 2', 'project 3', 'project 4',
    ])
    // The bucket and the three stale Workspaces are the hidden remainder, and
    // the row sits right after the last kept group.
    expect((container.children[8] as HTMLElement).style.display).toBe('none')
    expect(foldRow()?.textContent).toBe('show 4 more')
    expect(foldRow()?.previousElementSibling).toBe(container.children[4])
    dispose()
  })

  it('stays in place while every group fits', () => {
    const container = mountSidebar(2, { ungrouped: true })
    const { fold } = makeFold({ recency: recencyFrom({ w0: 900, w1: 800, [UNGROUPED_KEY]: 100 }) })
    const dispose = fold.start()
    expect(visibleTexts(container)).toEqual(['project 0', 'project 1', 'ungrouped'])
    expect(foldRow()).toBeNull()
    dispose()
  })

  it('unfolds every group, leaving the bucket last', () => {
    const container = mountSidebar(8, { ungrouped: true })
    const { fold } = makeFold({ recency: recencyFrom({ w0: 900, w1: 800, w2: 700, w3: 600, w4: 500 }) })
    const dispose = fold.start()
    fold.setExpanded(true)
    expect(visibleTexts(container)).toHaveLength(9)
    expect(foldRow()?.previousElementSibling).toBe(container.children[8])
    dispose()
  })

  it('folds away with the whole list while collapsed', () => {
    const container = mountSidebar(8, { ungrouped: true })
    const { fold } = makeFold()
    const dispose = fold.start()
    fold.setCollapsed(true)
    expect(visibleTexts(container)).toEqual([])
    dispose()
    expect(visibleTexts(container)).toHaveLength(9)
  })
})

describe('recent section inside the list area', () => {
  it('leaves the section visible and lands the fold row above it', () => {
    const container = mountSidebar(8)
    const section = mountSection()
    const { fold } = makeFold()
    const dispose = fold.start()

    // The section is not a workspace group, so the fold neither hides it nor
    // counts it: the row trails the last kept group, the groups it holds back
    // stay hidden above the section, and the section keeps its place as the
    // column's last content.
    expect(section.style.display).toBe('')
    const row = foldRow()
    expect(row).not.toBeNull()
    expect((row as HTMLElement).compareDocumentPosition(section) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(container.lastElementChild).toBe(section)
    dispose()
  })

  it('keeps the section while the workspace list is collapsed', () => {
    mountSidebar(8)
    const section = mountSection()
    const { fold } = makeFold()
    const dispose = fold.start()

    fold.setCollapsed(true)
    expect(section.style.display).toBe('')
    expect(section.isConnected).toBe(true)
    dispose()
  })

  it('leaves the shell layout alone', () => {
    const container = mountSidebar(3)
    mountSection()
    const { fold } = makeFold()
    const dispose = fold.start()
    // The section rides inside the list's own scroller, so the list keeps the
    // grow the shell gave it: there is no slack to trade any more.
    expect(container.style.flex).toBe('')
    dispose()
  })
})

describe('rail mode (the sidebar collapsed)', () => {
  it('writes nothing while the label is gone, so the chevron can never feed itself', async () => {
    mountSidebar(8)
    const { fold } = makeFold()
    const dispose = fold.start()
    expect(chevron()?.parentElement).toBe(sectionHeader())

    // The rail unmounts the label and the whole list. The chevron is now the
    // header's first child — the exact shape that once made the anchor fall
    // back to the chevron itself, whose self-reinsertion the fold's own
    // observer re-observed forever, freezing the renderer at 100% CPU.
    sectionHeader().querySelector('[class*="_sectionLabel"]')?.remove()
    workspaceListContainer(document)?.replaceChildren()

    let mutations = 0
    const observer = new MutationObserver(records => { mutations += records.length })
    observer.observe(sectionHeader(), { childList: true, subtree: true })
    try {
      for (let index = 0; index < 50; index++) fold.refresh()
      await new Promise(resolve => { setTimeout(resolve, 0) })
      expect(mutations).toBe(0)
      // The arrow is parked (a style write the childList observer never sees).
      expect(chevron()?.style.display).toBe('none')
    } finally {
      observer.disconnect()
    }
    dispose()
  })

  it('unparks the chevron after the label returns and keeps it after the label', async () => {
    mountSidebar(8)
    const { fold } = makeFold()
    const dispose = fold.start()
    const label = sectionHeader().querySelector('[class*="_sectionLabel"]')
    if (!(label instanceof HTMLElement)) throw new Error('test fixture: label missing')

    label.remove()
    fold.refresh()
    expect(chevron()?.style.display).toBe('none')

    // Back to wide: the shell remounts the label and the fold re-adopts it.
    sectionHeader().prepend(label)
    fold.refresh()
    expect(chevron()?.style.display).toBe('')
    expect(chevron()?.previousElementSibling).toBe(label)
    dispose()
  })
})

describe('the unfolded choice in the local store', () => {
  it('round-trips through the store and defaults to folded', () => {
    window.localStorage.clear()
    expect(loadWorkspaceExpanded()).toBe(false)
    saveWorkspaceExpanded(true)
    expect(loadWorkspaceExpanded()).toBe(true)
    saveWorkspaceExpanded(false)
    expect(loadWorkspaceExpanded()).toBe(false)
  })

  it('degrades to folded on a refusing store', () => {
    const refusing = { getItem: () => { throw new Error('denied') } }
    expect(loadWorkspaceExpanded(refusing)).toBe(false)
    expect(() => saveWorkspaceExpanded(true, { setItem: () => { throw new Error('denied') } })).not.toThrow()
  })
})
