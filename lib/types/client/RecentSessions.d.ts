import type { ReactNode } from 'react';
import type { PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots';
import type { RecentActions } from './sessionActions.ts';
import { NS } from './locales.ts';
/** Composed component props: owner share + standard kit + injected actions + locale seat. */
export type RecentSessionsProps = PropsRuntime<'sidebar.footer.action'> & RecentActions & PropsLocale<typeof NS>;
/**
 * Render the 最近 section and keep the workspace section folded the same way.
 * @param props - composed slot props (owner wide flag, standard kit hooks, injected actions, locale seat).
 * @returns the section element, or null while the rail is collapsed or no session holds history.
 */
export declare function RecentSessions({ wide, t, useSessions, useSessionStatus, useWorkspaces, open, archive, stopAndArchive, pin, unpin, fork, }: RecentSessionsProps): ReactNode;
//# sourceMappingURL=RecentSessions.d.ts.map