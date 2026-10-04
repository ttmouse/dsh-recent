/**
 * Browser half: one registration into the sidebar's `sidebar.footer.action`
 * seat — the list seat at the sidebar foot that the shell renders between the
 * workspace tree and the Settings row, in both column widths. The seat already
 * exists in every released `@deepseek-ai/dsh-client-ui-sidebar`, so the plugin
 * needs no upstream slot change: it contributes the 最近 section and receives
 * the column's wide flag from the shell, session and workspace facts from the
 * framework standard kit.
 */
import type { Context } from '@deepseek-ai/cordis'
// Type-only: pulls the locale plugin's Context merge (ctx.locale).
import type {} from '@deepseek-ai/dsh-client-locale/client'
// Type-only: pulls the renderer's Context merge (ctx.slots) and the
// 'sidebar.footer.action' SlotMap row's owner share into this program.
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import type {} from '@deepseek-ai/dsh-client-ui-sidebar/client'
// Type-only: pulls the Session root standard-hook merge (useSessions/useSessionStatus).
import type {} from '@deepseek-ai/dsh-client-ui-session/client'
// Type-only: pulls the Workspace UI navigation service merge (ctx.uiWorkspace) and
// the Workspace root standard-hook merge (useWorkspaces).
import type {} from '@deepseek-ai/dsh-client-ui-workspace/client'
import { RecentSessions } from './RecentSessions.tsx'
import { recentActions } from './sessionActions.ts'
import { en, NS, zh } from './locales.ts'

/**
 * Required services: the slot registry, the locale service, and the two owners
 * of the standard kit this section reads. `uiSession` and `uiWorkspace` are the
 * plugins that publish the `useSessions` / `useSessionStatus` / `useWorkspaces`
 * root hooks, so waiting on them keeps the first render from seeing them absent.
 */
export const inject = ['slots', 'locale', 'uiSession', 'uiWorkspace']

/**
 * Client plugin body: contribute the 最近 section to the sidebar foot. The
 * registration rides the slot service's inject wrapper, so unloading the
 * plugin removes the section with its fiber.
 * @param ctx - client root context.
 */
export function apply(ctx: Context): void {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'dsh-recent: dictionaries')
  ctx.slots.inject('sidebar.footer.action', () => ctx.slots.register({
    name: 'sidebar.footer.action',
    id: 'recent',
    order: 30,
    locale: NS,
    inject: () => recentActions(ctx.uiWorkspace),
  }, RecentSessions))
}
