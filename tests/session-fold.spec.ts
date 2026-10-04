// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import {
  SESSION_FOLD_LIMIT, SESSION_FOLD_ROW_ATTRIBUTE, SESSION_FOLD_STEP, SessionListFold,
  hiddenCountFromLabel, nextReveal, overflowControl, rowIsVisible, sessionRows,
} from '../src/client/sessionFold.ts'

/**
 * The shell's own quota, copied from `ui-workspace`'s `COLLAPSED_SESSION_LIMIT`:
 * the fixture below models the shell the way the layer has to live with it —
 * five idle rows, every running row outside that quota, one page per
 * activation, and everything at once once five or fewer rows are left.
 */
const SHELL_LIMIT = 5

const LABELS = {
  expand: (hidden: number) => `展开其余 ${hidden} 个会话`,
  collapse: '收起',
}

/** One project as the fixture's shell sees it: whether each session runs. */
type Sessions = readonly boolean[]

/**
 * One project's shell-side state: its own quota for the group, the rows it
 * currently renders, and its overflow control. Every write goes through
 * {@link FakeProject.render}, which touches only nodes the shell owns — the
 * layer's injected row is left alone, as React would leave it.
 */
class FakeProject {
  readonly group = document.createElement('div')
  private readonly header = document.createElement('div')
  private readonly control = document.createElement('button')
  private readonly rowElements: HTMLElement[]
  /** The nodes this fixture's shell owns; anything else in the group is the layer's. */
  private readonly owned: Set<HTMLElement>
  /** Quota the shell's state carries; {@link committed} is the one its rows show. */
  private limit = SHELL_LIMIT
  private committed = SHELL_LIMIT
  private scheduled = false
  private open = true

  /**
   * @param key - the group's Workspace key.
   * @param sessions - one flag per session: running rows sit outside the quota.
   * @param defer - commit the shell's rows a task later, the way React may.
   */
  constructor(readonly key: string, private readonly sessions: Sessions, private readonly defer = false) {
    this.group.className = 'bhn1Oq_groupSection'
    this.header.className = 'YDXeBa_projectRow'
    this.header.setAttribute('role', 'treeitem')
    this.header.setAttribute('data-row-key', `workspace:${key}`)
    this.header.textContent = key
    this.control.type = 'button'
    this.control.className = 'bhn1Oq_sessionOverflowButton'
    this.control.setAttribute('data-row-key', `overflow:${key}`)
    this.control.addEventListener('click', () => { this.activate() })
    this.rowElements = sessions.map((_running, index) => {
      const row = document.createElement('div')
      row.className = 'YDXeBa_sessionRow'
      row.setAttribute('role', 'treeitem')
      row.setAttribute('data-row-key', `session:s${key}-${index}`)
      row.textContent = `session ${index}`
      return row
    })
    this.owned = new Set([this.header, this.control, ...this.rowElements])
    this.render()
  }

  /** The rows the shell's quota lets through right now. */
  get rendered(): HTMLElement[] {
    if (!this.open) return []
    let idle = 0
    return this.sessions.flatMap((running, index) => {
      if (running) return [this.rowElements[index] as HTMLElement]
      if (idle >= this.committed) return []
      idle += 1
      return [this.rowElements[index] as HTMLElement]
    })
  }

  /** Rows the shell's quota holds back, at the quota it is at. */
  get hidden(): number {
    return this.sessions.length - this.rendered.length
  }

  /** Whether the shell renders its own overflow control at all. */
  private get controls(): boolean {
    return this.open && this.idleCount > SHELL_LIMIT
  }

  private get idleCount(): number {
    return this.sessions.filter(running => !running).length
  }

  /** Fold the project away, the way the shell's own header toggle does. */
  setOpen(open: boolean): void {
    this.open = open
    if (open) this.limit = SHELL_LIMIT
    this.render()
  }

  /** Mark one rendered row as the current conversation, the shell's `aria-selected`. */
  select(index: number): void {
    for (const [at, row] of this.rowElements.entries()) {
      row.setAttribute('aria-selected', String(at === index))
    }
  }

  /**
   * The shell's own reveal: a session its quota hides drops the quota for the
   * group, which is how the tree shows a session reached from search.
   */
  reveal(index: number): void {
    const row = this.rowElements[index]
    if (row === undefined || this.rendered.includes(row)) return
    this.limit = Infinity
    this.render()
  }

  /** The shell's own overflow behavior: one page, or everything once five are left. */
  private activate(): void {
    // The handler reads the render it was created from, so a click that has not
    // committed yet still reports the rows the operator can see — as React does.
    const hidden = this.hidden
    this.limit = hidden === 0 ? SHELL_LIMIT : hidden <= SHELL_LIMIT ? Infinity : this.limit + SHELL_LIMIT
    if (this.defer) this.schedule()
    else this.render()
  }

  /** Commit the shell's state to the DOM, one task later when this fixture defers. */
  private schedule(): void {
    if (this.scheduled) return
    this.scheduled = true
    queueMicrotask(() => {
      this.scheduled = false
      this.render()
    })
  }

  /** Re-render the shell's own nodes: membership, order, and the control's copy. */
  private render(): void {
    this.committed = this.limit
    this.header.setAttribute('aria-expanded', String(this.open))
    const desired = [this.header, ...this.rendered, ...(this.controls ? [this.control] : [])]
    for (const node of this.owned) {
      if (!desired.includes(node)) node.remove()
    }
    // The shell never moves a node it does not own: its own nodes are laid out
    // in order ahead of whatever the layer injected.
    const foreign = [...this.group.children].find(child => !this.owned.has(child as HTMLElement)) ?? null
    for (let index = desired.length - 1; index >= 0; index--) {
      const node = desired[index] as HTMLElement
      const next = (desired[index + 1] ?? foreign) as Element | null
      if (node.parentElement !== this.group || node.nextElementSibling !== next) {
        this.group.insertBefore(node, next)
      }
    }
    const expanded = this.hidden === 0
    this.control.setAttribute('aria-expanded', String(expanded))
    this.control.textContent = expanded ? LABELS.collapse : LABELS.expand(this.hidden)
  }
}

/**
 * Mount the shell's sidebar around the fixture's projects and hand back the
 * list container plus the projects by key.
 */
function mountShell(
  projects: readonly (readonly [string, Sessions])[],
  options: { defer?: boolean } = {},
): {
  container: HTMLElement
  projects: Map<string, FakeProject>
} {
  document.body.innerHTML = `
    <div class="hHd-Xa_root">
      <div class="hHd-Xa_regionArea"><div class="bhn1Oq_treeBody"><div class="bhn1Oq_listHost"></div></div></div>
      <div class="hHd-Xa_footArea"></div>
    </div>`
  const container = document.querySelector('.bhn1Oq_listHost')
  if (!(container instanceof HTMLElement)) throw new Error('test fixture: list container missing')
  const built = new Map<string, FakeProject>()
  for (const [key, sessions] of projects) {
    const project = new FakeProject(key, sessions, options.defer ?? false)
    built.set(key, project)
    container.append(project.group)
  }
  return { container, projects: built }
}

/** Sessions of one project: `idle` ordinary rows, then `running` rows that never count. */
function sessions(idle: number, running = 0): Sessions {
  return [...Array<boolean>(idle).fill(false), ...Array<boolean>(running).fill(true)]
}

/** The layer's own row inside one project's section. */
function foldRow(group: HTMLElement): HTMLButtonElement | null {
  return group.querySelector(`[${SESSION_FOLD_ROW_ATTRIBUTE}]`)
}

/** The projects's rows the operator can see. */
function visibleRows(group: HTMLElement): HTMLElement[] {
  return sessionRows(group).filter(row => row.style.display !== 'none')
}

/** Start the layer and return its disposer. */
function start(): () => void {
  return new SessionListFold({ labels: LABELS }).start()
}

/**
 * Let the layer settle after the shell rewrote the list: the observer callback
 * and the coalescing microtask behind it both have to run.
 */
async function settle(): Promise<void> {
  await new Promise<void>(resolve => { setTimeout(resolve, 0) })
}

afterEach(() => { document.body.innerHTML = '' })

describe('session fold helpers', () => {
  it('reads the shell own hidden count off its label in both locales', () => {
    expect(hiddenCountFromLabel('展开其余 3 个会话')).toBe(3)
    expect(hiddenCountFromLabel('Show 12 more sessions')).toBe(12)
    expect(hiddenCountFromLabel('Show 1,024 more sessions')).toBe(1024)
    expect(hiddenCountFromLabel('收起')).toBe(0)
    expect(hiddenCountFromLabel('')).toBe(0)
    expect(hiddenCountFromLabel(null)).toBe(0)
  })

  it('reveals one step, never past the end of the project', () => {
    expect(nextReveal(SESSION_FOLD_LIMIT, 40)).toBe(SESSION_FOLD_LIMIT + SESSION_FOLD_STEP)
    expect(nextReveal(35, 40)).toBe(40)
    expect(nextReveal(5, 40, 2)).toBe(7)
  })

  it('keeps the window and the current conversation, and nothing else', () => {
    expect(rowIsVisible(4, 5, -1)).toBe(true)
    expect(rowIsVisible(5, 5, -1)).toBe(false)
    expect(rowIsVisible(9, 5, 9)).toBe(true)
    expect(rowIsVisible(9, 5, 2)).toBe(false)
  })

  it('counts only the rows of the group it is asked about', () => {
    mountShell([['a', sessions(2)]])
    const outer = document.querySelector('.bhn1Oq_groupSection')
    if (!(outer instanceof HTMLElement)) throw new Error('test fixture: group missing')
    const inner = document.createElement('div')
    inner.className = 'bhn1Oq_groupSection'
    const innerRow = document.createElement('div')
    innerRow.setAttribute('data-row-key', 'session:inner')
    inner.append(innerRow)
    outer.append(inner)
    expect(sessionRows(outer).map(row => row.textContent)).toEqual(['session 0', 'session 1'])
    expect(sessionRows(inner)).toHaveLength(1)
  })

  it('finds the shell own control only while the shell renders one', () => {
    const { projects } = mountShell([['a', sessions(9)], ['b', sessions(3)]])
    expect(overflowControl(projects.get('a')!.group)?.textContent).toBe('展开其余 4 个会话')
    expect(overflowControl(projects.get('b')!.group)).toBeUndefined()
  })
})

describe('session fold layer', () => {
  it('shows five conversations per project, running rows included', () => {
    const { projects } = mountShell([['a', sessions(5, 3)]])
    const dispose = start()
    const group = projects.get('a')!.group
    // The shell renders eight rows here: five idle ones and every running one.
    expect(sessionRows(group)).toHaveLength(8)
    expect(visibleRows(group)).toHaveLength(SESSION_FOLD_LIMIT)
    expect(foldRow(group)?.textContent).toBe('展开其余 3 个会话')
    // The shell offers no control at all here — its quota exempts the running
    // rows — so the fold is this layer's own row, and nothing else.
    expect(overflowControl(group)).toBeUndefined()
    dispose()
  })

  it('reveals ten more per click, asking the shell for the rows it has not rendered', () => {
    const { projects } = mountShell([['a', sessions(40)]])
    const dispose = start()
    const group = projects.get('a')!.group
    const row = foldRow(group)
    if (row === null) throw new Error('test fixture: fold row missing')
    // The shell's own control gives way to the layer's row at the same place.
    expect(overflowControl(group)?.style.display).toBe('none')
    row.click()
    expect(visibleRows(group)).toHaveLength(SESSION_FOLD_LIMIT + SESSION_FOLD_STEP)
    expect(foldRow(group)?.textContent).toBe('展开其余 25 个会话')
    row.click()
    expect(visibleRows(group)).toHaveLength(SESSION_FOLD_LIMIT + 2 * SESSION_FOLD_STEP)
    row.click()
    expect(visibleRows(group)).toHaveLength(SESSION_FOLD_LIMIT + 3 * SESSION_FOLD_STEP)
    row.click()
    // The last step leaves five rows, which the shell hands over all at once.
    expect(visibleRows(group)).toHaveLength(40)
    expect(foldRow(group)?.textContent).toBe(LABELS.collapse)
    row.click()
    expect(visibleRows(group)).toHaveLength(SESSION_FOLD_LIMIT)
    expect(foldRow(group)?.textContent).toBe('展开其余 35 个会话')
    dispose()
  })

  it('counts the rows the shell holds back in its own label', () => {
    const { projects } = mountShell([['a', sessions(7, 2)]])
    const dispose = start()
    const group = projects.get('a')!.group
    // Seven rows on screen (five idle and both running ones), nine held in all.
    expect(foldRow(group)?.textContent).toBe('展开其余 4 个会话')
    foldRow(group)?.click()
    expect(visibleRows(group)).toHaveLength(9)
    expect(foldRow(group)?.textContent).toBe(LABELS.collapse)
    dispose()
  })

  it('folds a project back to its first five when it is closed and opened again', async () => {
    const { projects } = mountShell([['a', sessions(40)]])
    const dispose = start()
    const project = projects.get('a')!
    const group = project.group
    foldRow(group)?.click()
    expect(visibleRows(group)).toHaveLength(SESSION_FOLD_LIMIT + SESSION_FOLD_STEP)
    project.setOpen(false)
    await settle()
    expect(foldRow(group)).toBeNull()
    project.setOpen(true)
    await settle()
    expect(visibleRows(group)).toHaveLength(SESSION_FOLD_LIMIT)
    expect(foldRow(group)?.textContent).toBe('展开其余 35 个会话')
    dispose()
  })

  it('never hides the conversation the operator is reading', async () => {
    const { projects } = mountShell([['a', sessions(40)]])
    const dispose = start()
    const group = projects.get('a')!.group
    const project = projects.get('a')!
    project.reveal(12)
    project.select(12)
    await settle()
    expect(visibleRows(group).map(row => row.textContent)).toEqual([
      'session 0', 'session 1', 'session 2', 'session 3', 'session 4', 'session 12',
    ])
    expect(foldRow(group)?.textContent).toBe('展开其余 34 个会话')
    dispose()
  })

  it('leaves a project that fits the window exactly as the shell drew it', () => {
    const { projects } = mountShell([['a', sessions(4, 1)]])
    const dispose = start()
    const group = projects.get('a')!.group
    expect(visibleRows(group)).toHaveLength(5)
    expect(foldRow(group)).toBeNull()
    dispose()
  })

  it('keeps its window when the shell commits its rows a task later', async () => {
    const { projects } = mountShell([['a', sessions(40)]], { defer: true })
    const dispose = start()
    const group = projects.get('a')!.group
    const row = foldRow(group)
    if (row === null) throw new Error('test fixture: fold row missing')
    row.click()
    await settle()
    expect(visibleRows(group)).toHaveLength(SESSION_FOLD_LIMIT + SESSION_FOLD_STEP)
    // Two steps taken back to back, before the shell has rendered either: the
    // window still lands where two steps put it.
    row.click()
    row.click()
    await settle()
    expect(visibleRows(group)).toHaveLength(SESSION_FOLD_LIMIT + 3 * SESSION_FOLD_STEP)
    expect(foldRow(group)?.textContent).toBe('展开其余 5 个会话')
    dispose()
  })

  it('gives the rows and the shell own control back on disposal', () => {
    const { projects } = mountShell([['a', sessions(40)]])
    const dispose = start()
    const group = projects.get('a')!.group
    foldRow(group)?.click()
    dispose()
    expect(foldRow(group)).toBeNull()
    expect(visibleRows(group)).toHaveLength(15)
    expect(overflowControl(group)?.style.display).toBe('')
  })
})
