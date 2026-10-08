# dsh-recent

English | [简体中文](README.md)

A DSH Web GUI plugin that adds a **Recent** section to the left sidebar, below
the workspace list: the newest sessions of every workspace flattened into one
time line. Browse projects by folder on top, jump back into the latest work
below.

![The Recent section](docs/sidebar.png)

## Why

Codex's sidebar has two views: projects (folders) and recent (a time line). DSH
ships only the project view — to get back to the session you were just in, you
have to remember which workspace it belongs to, then expand that folder.

This plugin adds the second view: every workspace's sessions sorted by
activity, one click to open. A row is the workspace tree's session row, element
for element — state dot, title, age (or the compact label of the interaction
that waits), pin marker — and hovering it swaps the age and the marker for the
row's actions (`…` menu / archive / pin) without moving the row: the pointer
changes what the row shows (its fill, and the contents of a fixed-width trailing
cell), never where the row or its title is. The swap lands in one step, because
the row carries no transition at all, with the same session card floating
beside it (full title, age, live state) plus one line the flat cross-project
list cannot do without: folder icon + project name. The list does not fold:
scrolling to the end of what is rendered loads older sessions, so one wheel over
the column carries from the project tree into history.

## Features

- **Flat time line** — every session that holds history, across all
  workspaces and without a row cap, independent of how the workspace list is
  folded.
- **Loads older sessions as you scroll** — one page (20 rows) is rendered
  first, and reaching the end of it appends the next page until the history runs
  out. No fold row and no inner scrollbar: the section lives inside the
  workspace list's own scroll area, so the column scrolls as one surface.
- **The workspace tree's row, reused** — a 16px state cell, the title, the age
  in the shell's caption size, and the pin marker on a pinned session; size,
  spacing, radius, and the hover/current highlight all come from the shell's own
  session row (32px / `0 8px` / `--dsw-radius-md` /
  `--dsw-alias-interactive-bg-hover`).
- **Hovering swaps in the actions** — while the pointer is on a row (or its menu
  is open) the age and the pin marker give way to that row's actions: the `…`
  menu (pin / fork / archive), archive, and pin, with the shell's own icons and
  spacing (16px buttons, 10px apart).
- **Hovering moves nothing** — the pointer changes what a row *shows* (its fill,
  and what sits in a fixed-width trailing cell), never *where* anything is: the
  row's position and width, the title's inline start, and the trailing cell's
  position and width are the same values at rest, on hover, and with the row's
  menu open. The cell is 74px wide in every state and only ever holds one of its
  three occupants, and the row carries no `transition` at all, so both arriving
  and leaving land in one step — nothing slides or hops under the cursor.
- **The highlight stops short of the edges** — the fill is painted on a layer
  inset 4px at each end of the row, so the row under the pointer reads as a card
  with air around it rather than as a full-bleed band. Only that layer is inset,
  never the row: a row is the layout box of its own text, so insetting the box
  would step the title sideways and no dropped transition could undo it. Painting
  the gutter into the layer is what lets the spacing and the stillness both hold.
- **Hover card** — the shell's session card, element for element: full title,
  age, and the live-state line (running / waiting for approval / plan review /
  answer); clicking the card copies the title. One line is added: folder icon +
  project name, on the line the shell's card reserves for extra content (its
  `sidebar.session.row.hover` seat) so the live state stays the trailing line —
  a flat cross-project list has no other way to say which project a session
  belongs to.
- **Archive still asks** — the Host refuses to archive a session that still has
  work; that refusal raises the shell's own `Stop and archive this session?`
  wording, and confirming stops the work first.
- **Consistent visibility** — the same rules as the workspace tree: archived
  sessions are hidden, subagent sessions belong to their parent's catalog, and
  blank provisional sessions never appear (they hold no history).
- **Live state** — a yellow dot while a session waits for you (approval,
  question, plan review), a pulse while it runs, and the row of the current
  session highlighted.
- **Workspace folding** — the workspace list shows five folders by default behind
  a `Show N more workspaces` row in the shell's own style; the recent list does
  not fold. The five are the ones with the newest history: every group is ranked
  by its own latest session, the ungrouped bucket competes like any workspace
  instead of holding a permanent place, and a folder whose chats are not recent —
  or which has none at all — only appears when a slot is left over. Expanding is a
  temporary state, so collapsing the sidebar and reopening it returns to the
  folded default, as in Codex.
- **Five conversations per project** — a project's session rows fold to their five
  newest by the session's own last activity, **whatever their live state**:
  running, waiting, and blank rows take no extra slot here (the shell's own quota
  exempts them; this layer does not, so a running session older than the fifth
  newest folds like any other). What is left over waits behind a single row — the
  shell's own `Show N more sessions` when it renders one, otherwise an identical
  row this plugin injects — and one click unfolds the whole group.
- **Native look** — `--dsw-*` semantic tokens plus the shell's own `StateDot`
  and chevron icons, so light/dark and every brand theme follow the shell; the
  fold row matches the shell's own session overflow control exactly.
- **The hover card is the shell's own primitive** — the section uses
  `HoverCard` from `@deepseek-ai/dsh-client-ui-primitives` (the workspace tree's
  session card: same component, same 244px dark card face), and the card copy
  keeps that primitive's fixed light-on-dark values so it never inverts.
- **No shell source changes** — the recent section registers into the sidebar's
  long-standing `sidebar.footer.action` list slot and performs its actions
  through the shell's public `uiWorkspace` service; the workspace list offers no
  slot or service for folding, so that half is applied at the DOM level (see
  Design notes). DSH's front end is neither patched nor rebuilt.

## Install

From the profile that runs your GUI (usually `~/.dsh/profiles/web`), install
from GitHub:

```sh
dsh plugin --profile web add github:ttmouse/dsh-recent
```

Or point at a local clone while working on the plugin (`link:` follows your
edits):

```sh
dsh plugin --profile web add link:/path/to/dsh-recent
```

Either way the command writes the dependency into the profile's `package.json`
and appends `dsh-recent` to `dsh.profile.bundles`. Doing both steps by hand
works too:

```json
{
  "dependencies": { "dsh-recent": "link:/path/to/dsh-recent" },
  "dsh": { "profile": { "bundles": ["…", "dsh-recent"] } }
}
```

Then restart `dsh web` and reload the page — the bundle list is read at startup,
and hot reload only covers source changes of plugins that are already loaded:

```sh
# stop the running dsh web, then
dsh web
```

## Development

```sh
pnpm install
pnpm run typecheck   # tsc --noEmit over src + tests
pnpm test            # unit tests; also checks lib/client.js's loader contract once built
pnpm run build       # lib/index.js + lib/invariant.js + lib/client.js + lib/types
```

`lib/` is committed, and the host serves `lib/client.js` rather than the source,
so re-run `pnpm run build` after every source change. CI rebuilds and fails if
the committed `lib/` drifts from a fresh build.

## Design notes

- **Seat** — `sidebar.footer.action` is a list slot declared by
  `@deepseek-ai/dsh-client-ui-sidebar`, rendered exactly between the workspace
  tree and Settings. Narrowed to the 56px rail (`wide: false`) the section
  renders `null`: a list has no meaning in the icon rail.
- **Data** — sessions and workspaces come through the framework standard kit
  (the registration's own `useSessions` / `useSessionStatus` / `useWorkspaces`
  selector hooks), and session actions come through the `RecentActions` face
  injected at registration (`src/client/sessionActions.ts`, bound to
  `uiWorkspace`); the component subscribes to no external source.
- **Opening** — goes through `uiWorkspace.openSession`, which also clears the
  center panel's selection; `uiWorkspace` is a required cordis service, and the
  sidebar shell itself depends on it.
- **Relative time** — the shell's own `relativeTime` from
  `@deepseek-ai/dsh-client-ui-primitives` (now / Nmin / Nh / Nd / Nmo / Ny),
  refreshed every 30 seconds, so one session reads the same age on both
  surfaces by construction.
- **Row and card copied from the shell** — every row element follows
  `ui-workspace`'s session row: the 16×20 state cell, the 14/20 title, the 10/16
  tertiary age, the pin marker, and the three 16px icon buttons the row swaps in
  on hover, with `--dsw-alias-interactive-bg-hover` for both the hovered row and
  the current one. The trailing cell is the one thing measured rather than
  copied: the shell's row lets it resize with what it holds (which is why a
  hovered shell row pulls its own title sideways), so this section pins it at
  74px and mounts exactly one occupant at a time — age, or pin marker, or the
  actions. The card keeps the shell session card's elements and values
  (title / age / status line) and adds exactly one line, the project name, in the
  place that card reserves for extra content (the shell's
  `sidebar.session.row.hover` seat): after the age, before the status line, so
  the live state stays the card's trailing line. The name is the workspace title,
  falling back to the directory basename and then to `Ungrouped` for a session no
  workspace claims. The card copies the title on click, the same affordance the
  shell's card gives.
- **Row actions go through public services** — archive, pin and fork all run
  through the injected `uiWorkspace` (`archiveSession` / `pinSession` /
  `forkSession`). The shell's own row-action slots
  (`sidebar.workspaces.session.row.action`,
  `sidebar.workspaces.session.menu.item`) are declared by `ui-workspace` and a
  child slot has exactly one declaring entry, so a plugin cannot declare or
  render them: what is reproduced here is the look and the behavior, not the
  slot. When the Host refuses to archive a session that still has work
  (`WorkspaceArchiveError` + `workspace/session-active`) the stop-and-archive
  confirmation is raised; every other failure is logged, because the plugin owns
  no notice surface.
- **Two deliberate differences** — the card keeps its 0ms dwell (an earlier
  request: no delay at all, with the stale marker hiding an abandoned card
  immediately) where the shell's own rows wait 800ms; and the title keeps its
  ellipsis on hover instead of hard-clipping and marquee-scrolling, because the
  card already shows the full title at once.
- **Folding the workspace list** — the shell renders one `_groupSection` per
  workspace and exposes no "show fewer" affordance, slot, store or config field,
  so the plugin applies it from the outside: the groups that lose the ranking get
  `display: none` and a fold row is inserted after the last group the fold
  keeps. React rewrites the list on
  every frame, so a `MutationObserver` on `document.body` re-applies the fold,
  comparing before writing so its own writes never feed it; the callback filters
  records to sidebar mutations first, so conversation streaming never reaches
  `apply()`. The container is resolved as the parent of the first rendered
  `_groupSection`, which leaves the flat/search rendering (no group wrappers)
  untouched. The fold cuts by "used most recently", not by list order: every
  group's freshness is its own newest session (membership copied from the shell —
  registered workspaces claim their own sessions and the rest belong to the
  ungrouped bucket), and the five freshest survive. A group's identity comes from
  the DOM: the shell writes `data-row-key="workspace:<workspace id>"` on each
  group's header row (the bucket's key is the empty string), which is the only
  stable address a group has — its classes are hashed and its markup is React's.
  A group with no history ranks behind every group that has some, so it appears
  only while a slot is left over, and a list that already fits the five is left
  alone entirely. The ungrouped bucket therefore has no special treatment any
  more: it is hidden by default and shows up only when its own sessions are new
  enough to win a place. The fold row trails the last kept group in render order,
  while the groups it hides stay where they are, simply out of sight — so
  unfolding restores the original order.
- **Folding is temporary state** — no store: the expanded flag lives in the
  component, so collapsing the sidebar and reopening it (`wide` false → true)
  returns the workspace list to the five-row default and the recent list to its
  first page.
- **How the per-project session fold works** — the shell does not render session
  rows as the group's own children: each one sits inside its own hover-card slot
  (a `position:relative; display:block` span that carries a 2px lead-in of its
  own). The fold therefore finds rows by their `data-row-key="session:<id>"` and
  hides and restores the **slot**, because hiding the row alone would leave the
  slot's spacing behind; its own overflow row is inserted after the last kept
  row's slot, on the same level and with the same metrics as the shell's own
  overflow control (`margin-top` zeroed like it). Each group keeps exactly one
  expander: when the shell already renders `Show N more sessions`, no second row
  is injected, and clicking the shell's row unfolds both layers at once (the
  plugin listens for that `data-row-key` on the document). Ranking reads the
  session catalog's own timestamps, so a row the catalog does not know yet ranks
  last.
- **The section lives inside the list's scroll area** — it is portalled into the
  shell's own scrolling container (the workspace tree's `overflow-y: auto` list)
  as that column's last content. So there is exactly one scrollbar: scrolling
  past the workspace tree reaches 最近, and scrolling further reaches older
  sessions. The section reserves no fixed bottom block and never scrolls
  internally — it is exactly as tall as its rows.
- **How the paging works** — a 1px sentinel sits at the end of the rendered
  window and an `IntersectionObserver` (rooted at that same scroller, firing
  320px before the bottom) watches it; when it comes into view the render window
  grows by one page. Appending pushes the sentinel out of the trigger band, so
  the observer settles until the next scroll: the list grows a page at a time
  rather than all at once. Folding the section away (its header chevron) removes
  the sentinel, so a folded list never loads in the background.
- **No more shell layout override** — the section used to ride outside that
  scroller, where the shell's `flex: 1` on the list stretched a short workspace
  list to the column's foot and stranded the section out of sight; the fold layer
  therefore traded that grow for `flex: 0 1 auto`. Inside the scroller the
  problem cannot occur (the section is part of the list's content, not a sibling
  below it), so that write is gone and the plugin no longer touches the shell's
  layout.

## Known limitations

- **Wide column only** — the 56px rail renders no recent section (an entry that
  deserves a rail cell should be a `sidebar.panellist` panel instead).
- **Workspace folding depends on the shell's DOM** — it keys off the
  `_groupSection` / `_footArea` CSS-module suffixes, the first group's parent, and
  the `data-row-key="workspace:<id>"` address on each group's header row.
  If the shell renames or restructures them the fold silently stops applying
  (degrading to the shell's full list) instead of failing loudly; a group whose
  identity cannot be read ranks last, which is the same as cutting by list order.
  The fold counts groups (the ungrouped bucket included), not sessions. The
  section's own scroll area rides the same
  lookup: if the shell stops giving its list its own `overflow-y`, the section
  follows that resolution to whatever element the lookup names.
- **Fold, not reorder** — freshness only decides who survives; workspace order
  stays the list's own (newest first,
  plus manual ordering); the plugin does not re-sort by recent activity, which
  would require changing the shell's list order upstream.
- **The session fold depends on the shell's DOM too** — rows are found by
  `data-row-key="session:<id>"` and attributed by `_groupSection` (a nested group
  keeps its own rows); if the shell drops those row keys or restructures the
  slots, the session fold silently falls back to the shell's own quota (five idle
  sessions plus its running/blank exemptions) instead of failing loudly. Note
  also that the shell's own row counts only what the shell left unrendered, so
  unfolding it shows the rows this fold holds back a little earlier than it
  promises.
- **One page at a time** — 20 rows render first and each scroll appends 20
  more; with a lot of history, reaching the oldest session means scrolling to the
  end, and there is no page number or jump target.
- **No search, no rename** — search stays in the workspace tree, and so does
  rename: the shell's rename dialog is driven by a `ui-workspace` internal store
  a plugin cannot reach, so the recent row's `…` menu carries one entry less than
  the shell's session menu. For a session from long ago, search is still faster
  than scrolling.
- **A title-less session shows its id** — titles are projected by the host from
  the log; for old sessions without one the row falls back to `displayTitle`
  (usually the project directory name or the session id).

## License

[MIT](LICENSE)
