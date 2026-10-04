import type { ReactNode } from 'react';
import type { PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots';
import type { SessionId } from '@deepseek-ai/dsh-client-runtime/client';
import { NS } from './locales.ts';
/** Registrant-injected share: the one action the section performs. */
export interface RecentSessionsInjected {
    /** Open a session as the current one. */
    open: (sessionId: SessionId) => void;
}
/** Composed component props: owner share + standard kit + injected face + locale seat. */
export type RecentSessionsProps = PropsRuntime<'sidebar.footer.action'> & RecentSessionsInjected & PropsLocale<typeof NS>;
/**
 * Render the 最近 section and keep the workspace list folded to the same limit.
 * @param props - composed slot props (owner wide flag, standard kit hooks, injected open, locale seat).
 * @returns the section element, or null while the rail is collapsed or no session holds history.
 */
export declare function RecentSessions({ wide, open, t, useSessions, useWorkspaces }: RecentSessionsProps): ReactNode;
//# sourceMappingURL=RecentSessions.d.ts.map