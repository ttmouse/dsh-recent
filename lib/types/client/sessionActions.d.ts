/**
 * The workspace operations a 最近 row performs, bound to the shell's own
 * `uiWorkspace` service.
 *
 * The rows offer exactly the actions the workspace tree's session rows offer
 * (archive, pin, fork), and they run through the same service calls the shell's
 * own action entries make — so pinning from the 最近 list leads the session in
 * its saved orders the same way pinning from the tree does, and archiving obeys
 * the same Host rule.
 *
 * Archive is the one call whose failure carries meaning: the Host refuses to
 * archive a Session that still has work, naming what runs in the refusal. The
 * face turns that into {@link ArchiveOutcome} instead of throwing, so the
 * caller can raise the stop-and-archive confirmation the shell raises, while
 * every other failure is a notice the plugin has no surface for and logs.
 */
import type { UiWorkspace } from '@deepseek-ai/dsh-client-ui-workspace/client';
import type { SessionId } from '@deepseek-ai/dsh-session/types';
/**
 * Result of asking the Host to archive one Session: it archived the Session, it
 * refused because the Session still has work (the stop-and-archive case), or the
 * call failed for another reason.
 */
export type ArchiveOutcome = 'archived' | 'active' | 'failed';
/** The actions one 最近 row can perform on its Session. */
export interface RecentActions {
    /** Open the Session as the current one. */
    open: (sessionId: SessionId) => void;
    /** Archive the Session, reporting a still-running refusal instead of throwing. */
    archive: (sessionId: SessionId) => Promise<ArchiveOutcome>;
    /** Stop the Session's running work and archive it (the refusal's confirmation). */
    stopAndArchive: (sessionId: SessionId) => Promise<void>;
    /** Pin the Session and lead it in its saved orders. */
    pin: (sessionId: SessionId) => void;
    /** Unpin the Session, leaving its saved positions as they are. */
    unpin: (sessionId: SessionId) => void;
    /** Fork the Session without changing the current selection. */
    fork: (sessionId: SessionId) => void;
}
/**
 * Whether a failure is the Host's refusal to archive a Session with live work.
 *
 * The refusal is the workspace controller's `WorkspaceArchiveError` carrying
 * `workspace/session-active`, which names what still runs. It is recognized by
 * shape rather than by class: the plugin's browser half may only require the
 * module-table words (react, react-dom, and the primitives), so it cannot
 * import the controller's error class.
 * @param reason - the rejection reason from an archive call.
 * @returns true for the active-Session refusal.
 */
export declare function isActiveRefusal(reason: unknown): boolean;
/**
 * Bind the row actions to the workspace service. Failures of the fire-and-forget
 * calls (pin, unpin, fork) are logged: they leave the row as it was, and this
 * plugin owns no notice surface to report them on.
 * @param uiWorkspace - the shell's workspace navigation service.
 * @returns the action face the section hands to its rows.
 */
export declare function recentActions(uiWorkspace: UiWorkspace): RecentActions;
//# sourceMappingURL=sessionActions.d.ts.map