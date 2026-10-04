// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  FOLD_ROW_ATTRIBUTE, WorkspaceListFold, groupSections, splitFold, workspaceListContainer,
} from '../src/client/workspaceFold.ts'

/**
 * The shell's sidebar shape, flattened to the parts the fold resolves: the
 * column (its foot area names it), the region holding the browser, the list
 * container, and one group section per workspace. Class-name fragments match
 * the installed `ui-workspace` CSS Module suffixes.
 */
function mountSidebar(groupCount: number, options: { plainRows?: boolean } = {}): HTMLElement {
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
    for (let index = 0; index < groupCount; index++) {
      const group = document.createElement('div')
      group.className = 'bhn1Oq_groupSection'
      const project = document.createElement('div')
      project.className = 'YDXeBa_projectRow'
      project.textContent = `project ${index}`
      const session = document.createElement('div')
      session.className = 'YDXeBa_sessionRow'
      session.textContent = `session ${index}`
      group.append(project, session)
      list.append(group)
    }
  }
  document.body.innerHTML = `
    <div class="hHd-Xa_root">
      <div class="hHd-Xa_regionArea"><div><div class="bhn1Oq_root">
        <div class="bhn1Oq_listArea"><div class="bhn1Oq_treeBody"><div class="bhn1Oq_list"></div></div></div>
      </div></div></div>
      <div class="hHd-Xa_footArea"><div class="hHd-Xa_footerActions"></div></div>
    </div>`
  const container = document.querySelector('.bhn1Oq_list')
  if (container === null) throw new Error('test fixture: list container missing')
  container.replaceChildren(...list.children)
  return container as HTMLElement
}

function foldRow(): HTMLElement | null {
  return document.querySelector(`[${FOLD_ROW_ATTRIBUTE}]`)
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

function makeFold(overrides: Partial<ConstructorParameters<typeof WorkspaceListFold>[0]> = {}) {
  const onToggle = vi.fn()
  const fold = new WorkspaceListFold({
    limit: 5,
    labels: { expand: hidden => `show ${hidden} more`, collapse: 'show less' },
    onToggle,
    ...overrides,
  })
  return { fold, onToggle }
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

describe('splitFold', () => {
  it('keeps the limit and holds the rest while folded', () => {
    expect(splitFold(['a', 'b', 'c'], 2, false)).toEqual({ visible: ['a', 'b'], hidden: ['c'] })
  })

  it('hides nothing while expanded or within the limit', () => {
    expect(splitFold(['a', 'b', 'c'], 2, true)).toEqual({ visible: ['a', 'b', 'c'], hidden: [] })
    expect(splitFold(['a'], 5, false)).toEqual({ visible: ['a'], hidden: [] })
  })
})

describe('WorkspaceListFold', () => {
  it('folds the list past the limit and offers the shared fold row', () => {
    const container = mountSidebar(8)
    const { fold } = makeFold()
    const dispose = fold.start()

    expect(visibleTexts(container)).toEqual([
      'project 0', 'project 1', 'project 2', 'project 3', 'project 4',
    ])
    const row = foldRow()
    expect(row?.textContent).toBe('show 3 more')
    expect(row?.getAttribute('aria-expanded')).toBe('false')
    expect(row?.previousElementSibling).toBe(container.children[4])
    dispose()
  })

  it('unfolds to every group and collapses back to the limit', () => {
    const container = mountSidebar(8)
    const { fold } = makeFold()
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
    const { fold } = makeFold()
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
    const { fold } = makeFold()
    const dispose = fold.start()
    expect(visibleTexts(container)).toHaveLength(3)
    expect(foldRow()).toBeNull()
    dispose()
  })

  it('restores every group on disposal', () => {
    const container = mountSidebar(8)
    const { fold } = makeFold()
    const dispose = fold.start()
    dispose()
    expect(visibleTexts(container)).toHaveLength(8)
    expect(foldRow()).toBeNull()
  })
})
