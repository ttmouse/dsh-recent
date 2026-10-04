/**
 * Browser half: one registration into the sidebar's `sidebar.footer.action`
 * seat — the list seat at the sidebar foot that the shell renders between the
 * workspace tree and the Settings row, in both column widths. The seat already
 * exists in every released `@deepseek-ai/dsh-client-ui-sidebar`, so the plugin
 * needs no upstream slot change: it contributes the 最近 section and receives
 * the column's wide flag from the shell, session and workspace facts from the
 * framework standard kit.
 */
import type { Context } from '@deepseek-ai/cordis';
/**
 * Required services: the slot registry, the locale service, and the two owners
 * of the standard kit this section reads. `uiSession` and `uiWorkspace` are the
 * plugins that publish the `useSessions` / `useSessionStatus` / `useWorkspaces`
 * root hooks, so waiting on them keeps the first render from seeing them absent.
 */
export declare const inject: string[];
/**
 * Client plugin body: contribute the 最近 section to the sidebar foot. The
 * registration rides the slot service's inject wrapper, so unloading the
 * plugin removes the section with its fiber.
 * @param ctx - client root context.
 */
export declare function apply(ctx: Context): void;
//# sourceMappingURL=index.d.ts.map