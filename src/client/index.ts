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
// Type-only: pulls the runtime's Context merge (ctx.sessions) and the
// 'sidebar.footer.action' SlotMap row's owner share into this program.
import type {} from '@deepseek-ai/dsh-client-runtime/client'
import type {} from '@deepseek-ai/dsh-client-ui-sidebar/client'
import type { SessionId } from '@deepseek-ai/dsh-client-runtime/client'
import { RecentSessions } from './RecentSessions.tsx'
import { en, NS, zh } from './locales.ts'

/** Required services: the slot registry, the locale service, and the session store. */
export const inject = ['slots', 'locale', 'sessions']

/**
 * The workspace-navigation service newer shells expose. Its `openSession` also
 * clears a selected center panel (taskboard-style plugins mount one), so a
 * sidebar jump lands on the transcript instead of selecting a session behind a
 * panel the user is still looking at.
 */
interface WorkspaceNavigation {
  openSession(sessionId: SessionId): void
}

/**
 * Open a session as the current one.
 * @param ctx - client root context.
 * @param sessionId - the session to open.
 */
function openSession(ctx: Context, sessionId: SessionId): void {
  // The service name is deployment-side and absent on shells predating it, so
  // it is read through the loose `get` face rather than declared as a service.
  const navigation = (ctx.get as (name: string) => unknown)('uiWorkspace') as WorkspaceNavigation | undefined
  if (navigation?.openSession !== undefined) {
    navigation.openSession(sessionId)
    return
  }
  ctx.sessions.open(sessionId)
}

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
    inject: () => ({ open: (sessionId: SessionId) => { openSession(ctx, sessionId) } }),
  }, RecentSessions))
}
