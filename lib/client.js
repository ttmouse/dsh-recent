window.__ModuleLoader__.load({
	id: "dsh-recent",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let react = require("react");
		let _deepseek_ai_dsh_client_ui_primitives = require("@deepseek-ai/dsh-client-ui-primitives");
		let react_jsx_runtime = require("react/jsx-runtime");
		/**
		* Compact relative time for a row, as a structured bucket the component
		* localizes ("now"/"5min"/"3h" in en, "刚刚"/"5分钟" in zh). Bucket edges match
		* the workspace browser's, so a session reads the same age on both surfaces.
		* @param updatedAt - epoch ms of the session's last activity.
		* @param now - current epoch ms (injected for pure rendering).
		* @returns the row's trailing time bucket and magnitude.
		*/
		function relativeTime(updatedAt, now) {
			const MIN = 6e4;
			const HOUR = 36e5;
			const DAY = 864e5;
			const diff = Math.max(0, now - updatedAt);
			if (diff < MIN) return {
				unit: "now",
				n: 0
			};
			if (diff < HOUR) return {
				unit: "minutes",
				n: Math.floor(diff / MIN)
			};
			if (diff < DAY) return {
				unit: "hours",
				n: Math.floor(diff / HOUR)
			};
			if (diff < 30 * DAY) return {
				unit: "days",
				n: Math.floor(diff / DAY)
			};
			if (diff < 365 * DAY) return {
				unit: "months",
				n: Math.floor(diff / (30 * DAY))
			};
			return {
				unit: "years",
				n: Math.floor(diff / (365 * DAY))
			};
		}
		/** Workspace display title of a session outside the registry: the path's last segment. */
		function pathLabel(cwd) {
			if (cwd === void 0 || cwd === "") return void 0;
			const base = cwd.replace(/[/\\]+$/, "").split(/[/\\]/).pop();
			return base !== void 0 && base !== "" ? base : cwd;
		}
		/**
		* Derive the 最近 rows: every session that holds history, across all
		* workspaces, newest first, capped at {@link RECENT_ROW_LIMIT}.
		* @param input - list, workspace registry, archive set, and the localized ungrouped label.
		* @returns rows in render order.
		*/
		function deriveRecentRows(input) {
			const { list, workspaces, archivedSessionIds } = input;
			const archived = new Set(archivedSessionIds);
			const workspaceOf = /* @__PURE__ */ new Map();
			for (const workspace of workspaces) for (const id of workspace.sessionIds) if (!workspaceOf.has(id)) workspaceOf.set(id, workspace.title);
			const rows = [];
			for (const id of list.ids) {
				const session = list.byId[id];
				if (session === void 0) continue;
				if (session.origin === "subagent") continue;
				if (session.blank) continue;
				if (archived.has(session.id)) continue;
				rows.push({
					id: session.id,
					title: session.displayTitle,
					workspace: workspaceOf.get(session.id) ?? pathLabel(session.cwd) ?? input.ungroupedLabel,
					updatedAt: session.updatedAt,
					running: session.running,
					waiting: session.pendingInteraction !== void 0,
					current: session.id === list.current
				});
			}
			rows.sort((a, b) => b.updatedAt !== a.updatedAt ? b.updatedAt - a.updatedAt : a.id < b.id ? -1 : 1);
			return rows.slice(0, 20);
		}
		//#endregion
		//#region src/client/workspaceFold.ts
		/**
		* Fold control for the shell's workspace list.
		*
		* The shell's workspace browser renders one group section per registered
		* workspace and offers no "show fewer" affordance for the list itself, and no
		* slot, store, or config field exposes one. This module applies it from the
		* outside — the same DOM technique the sibling-panel plugins use for their
		* sidebar rows — by hiding the group sections past the fold limit and keeping
		* one toggle row after the last visible group.
		*
		* The layer is idempotent and self-healing: React rewrites the list on every
		* workspace or session frame, so a MutationObserver re-applies the fold, and
		* every write compares the desired state against the DOM first, which keeps the
		* observer from feeding itself.
		*/
		/** Class-name fragment of one workspace group section; the hash prefix is deployment-local. */
		const GROUP_SECTION_FRAGMENT = "_groupSection";
		/** Class-name fragment of the sidebar's foot area, the anchor for the list's owning column. */
		const FOOT_AREA_FRAGMENT = "_footArea";
		/** Owner attribute on the injected toggle row (selecting by class would depend on our own hash). */
		const FOLD_ROW_ATTRIBUTE = "data-dsh-recent-fold";
		/** Elements whose direct children are the workspace group sections, in render order. */
		function groupSections(container) {
			return [...container.children].filter((child) => child instanceof HTMLElement && child.className.includes(GROUP_SECTION_FRAGMENT));
		}
		/**
		* Resolve the workspace list container: the parent of the first rendered group
		* section. Resolving through a rendered group (rather than by class) keeps the
		* lookup correct for both the grouped tree and the flat list, which renders
		* sessions without group wrappers and therefore simply reports no container.
		* @param root - document subtree to search (the sidebar column, or document).
		* @returns the container element, or undefined before the browser mounts.
		*/
		function workspaceListContainer(root) {
			const container = root.querySelector(`[class*="${GROUP_SECTION_FRAGMENT}"]`)?.parentElement;
			return container instanceof HTMLElement ? container : void 0;
		}
		/**
		* Split the group sections into the ones the fold keeps and the ones it holds
		* back.
		* @param groups - group sections in render order.
		* @param limit - visible count while folded.
		* @param expanded - whether the operator unfolded the list.
		* @returns visible and hidden groups (hidden is empty while expanded).
		*/
		function splitFold(groups, limit, expanded) {
			if (expanded || groups.length <= limit) return {
				visible: [...groups],
				hidden: []
			};
			return {
				visible: groups.slice(0, limit),
				hidden: groups.slice(limit)
			};
		}
		/** Whether the element currently carries the fold's inline hide. */
		function isHidden(element) {
			return element.style.display === "none";
		}
		/** Hide or reveal one group section, writing only on a real change. */
		function setHidden(element, hidden) {
			if (isHidden(element) === hidden) return;
			element.style.display = hidden ? "none" : "";
		}
		/** The sidebar column owning the workspace list, for observer scope. */
		function sidebarColumn() {
			const column = document.querySelector(`[class*="${FOOT_AREA_FRAGMENT}"]`)?.parentElement;
			return column instanceof HTMLElement ? column : void 0;
		}
		/**
		* The workspace list's fold: state plus the observer that keeps it applied
		* while React owns the list.
		*/
		var WorkspaceListFold = class {
			options;
			expanded = false;
			observer;
			scheduled = false;
			column;
			button;
			/**
			* @param options - fold limit, copy, and the toggle callback.
			*/
			constructor(options) {
				this.options = options;
				this.button = document.createElement("button");
				this.button.type = "button";
				this.button.setAttribute(FOLD_ROW_ATTRIBUTE, "");
				this.button.addEventListener("click", () => {
					this.options.onToggle();
				});
			}
			/**
			* Apply the fold and keep it applied until disposal.
			* @returns the disposer that stops observing and restores every group.
			*/
			start() {
				this.apply();
				this.observer = new MutationObserver((records) => {
					if (records.some((record) => this.touchesSidebar(record))) this.schedule();
				});
				this.observer.observe(document.body, {
					childList: true,
					subtree: true
				});
				return () => {
					this.dispose();
				};
			}
			/**
			* Fold or unfold the list.
			* @param expanded - true shows every workspace, false keeps the fold limit.
			*/
			setExpanded(expanded) {
				if (this.expanded === expanded) return;
				this.expanded = expanded;
				this.apply();
			}
			/** Stop observing, drop the toggle row, and reveal every group again. */
			dispose() {
				this.observer?.disconnect();
				this.observer = void 0;
				this.column = void 0;
				const container = workspaceListContainer(document);
				if (container !== void 0) for (const group of groupSections(container)) setHidden(group, false);
				this.button.remove();
			}
			/** The sidebar column, re-resolved after a replacement or a fresh mount. */
			sidebar() {
				if (this.column?.isConnected !== true) this.column = sidebarColumn();
				return this.column;
			}
			/** Whether one mutation record can affect the list this fold owns. */
			touchesSidebar(record) {
				const column = this.sidebar();
				if (column === void 0) return false;
				if (column.contains(record.target)) return true;
				for (const node of [...record.addedNodes, ...record.removedNodes]) if (node instanceof Element && (node === column || node.contains(column))) return true;
				return false;
			}
			/** Coalesce observer bursts into one application per microtask. */
			schedule() {
				if (this.scheduled) return;
				this.scheduled = true;
				queueMicrotask(() => {
					this.scheduled = false;
					this.apply();
				});
			}
			/** Reconcile the DOM with the current fold state; every write is compared first. */
			apply() {
				const container = workspaceListContainer(document);
				const groups = container === void 0 ? [] : groupSections(container);
				const { visible } = splitFold(groups, this.options.limit, this.expanded);
				for (const [index, group] of groups.entries()) setHidden(group, index >= visible.length);
				const anchor = visible[visible.length - 1];
				if (container === void 0 || anchor === void 0 || groups.length <= this.options.limit) {
					this.button.remove();
					return;
				}
				const label = this.expanded ? this.options.labels.collapse : this.options.labels.expand(groups.length - this.options.limit);
				if (this.button.textContent !== label) this.button.textContent = label;
				const expandedState = String(this.expanded);
				if (this.button.getAttribute("aria-expanded") !== expandedState) this.button.setAttribute("aria-expanded", expandedState);
				if (this.button.parentElement !== container || this.button.previousElementSibling !== anchor) anchor.after(this.button);
			}
		};
		//#endregion
		//#region src/client/locales.ts
		/** `recent` namespace dictionaries (the sidebar 最近 section copy and its fold row). */
		/** Dictionary namespace owned by this plugin. */
		const NS = "recent";
		/** Simplified Chinese dictionary (the key-set source of truth). */
		const zh = {
			"section.recent": "最近",
			"fold.expandWorkspaces": "展开其余 {n} 个工作区",
			"fold.expandSessions": "展开其余 {n} 个会话",
			"fold.collapse": "收起",
			"row.open": "打开会话“{name}”",
			"workspace.ungrouped": "未分组",
			"status.running": "进行中",
			"status.waiting": "等待响应",
			"time.now": "刚刚",
			"time.minutes": "{n}分钟",
			"time.hours": "{n}小时",
			"time.days": "{n}天",
			"time.months": "{n}个月",
			"time.years": "{n}年",
			"time.ago": "{t}前"
		};
		/** English dictionary, checked complete against the zh key set. */
		const en = {
			"section.recent": "Recent",
			"fold.expandWorkspaces": "Show {n} more workspaces",
			"fold.expandSessions": "Show {n} more sessions",
			"fold.collapse": "Show less",
			"row.open": "Open session “{name}”",
			"workspace.ungrouped": "Ungrouped",
			"status.running": "Running",
			"status.waiting": "Waiting for you",
			"time.now": "now",
			"time.minutes": "{n}min",
			"time.hours": "{n}h",
			"time.days": "{n}d",
			"time.months": "{n}mo",
			"time.years": "{n}y",
			"time.ago": "{t} ago"
		};
		//#endregion
		//#region \0dsh-css:src/client/RecentSessions.module.css.mjs
		const css = ".aalpzW_section{border-top:1px solid var(--dsw-alias-border-l2);flex-direction:column;flex:none;min-width:0;padding:4px 0 2px;display:flex}.aalpzW_header{height:36px;color:var(--dsw-alias-label-tertiary);flex:none;align-items:center;gap:4px;margin-bottom:4px;padding-left:4px;font-size:14px;font-weight:400;line-height:20px;display:flex}.aalpzW_list{margin:0;padding:0;list-style:none}.aalpzW_row{width:100%;height:34px;color:var(--dsw-alias-label-primary);text-align:left;cursor:pointer;background:0 0;border:none;border-radius:8px;align-items:center;gap:6px;padding:0 8px;font-size:14px;line-height:20px;display:flex}.aalpzW_row:hover{background:var(--dsw-alias-interactive-bg-hover)}.aalpzW_rowCurrent{background:var(--dsw-alias-interactive-bg-active)}.aalpzW_rowDot{flex:none}.aalpzW_rowTitle{white-space:nowrap;text-overflow:ellipsis;flex:1;min-width:0;overflow:hidden}.aalpzW_rowMeta{max-width:52%;color:var(--dsw-alias-label-tertiary);flex:none;align-items:center;gap:4px;font-size:12px;display:flex}.aalpzW_rowWorkspace{white-space:nowrap;text-overflow:ellipsis;min-width:0;overflow:hidden}.aalpzW_rowDivider,.aalpzW_rowTime{flex:none}.aalpzW_foldRow,[data-dsh-recent-fold]{cursor:pointer;text-align:left;width:100%;height:28px;color:var(--dsw-alias-label-tertiary);background:0 0;border:none;border-radius:8px;flex:none;padding:0 12px 0 28px;font-size:12px}.aalpzW_foldRow:hover,[data-dsh-recent-fold]:hover{color:var(--dsw-alias-label-secondary);background:0 0}.aalpzW_visuallyHidden{clip-path:inset(50%);white-space:nowrap;width:1px;height:1px;margin:-1px;padding:0;position:absolute;overflow:hidden}";
		const tagId = "dsh-recent/RecentSessions.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "dsh-recent";
			tag.dataset.pluginCss = tagId;
			tag.textContent = css;
			document.head.appendChild(tag);
		}
		var RecentSessions_module_css_default = {
			"foldRow": "aalpzW_foldRow",
			"header": "aalpzW_header",
			"list": "aalpzW_list",
			"row": "aalpzW_row",
			"rowCurrent": "aalpzW_rowCurrent",
			"rowDivider": "aalpzW_rowDivider",
			"rowDot": "aalpzW_rowDot",
			"rowMeta": "aalpzW_rowMeta",
			"rowTime": "aalpzW_rowTime",
			"rowTitle": "aalpzW_rowTitle",
			"rowWorkspace": "aalpzW_rowWorkspace",
			"section": "aalpzW_section",
			"visuallyHidden": "aalpzW_visuallyHidden"
		};
		//#endregion
		//#region src/client/RecentSessions.tsx
		/**
		* The sidebar 最近 section: every workspace's newest sessions flattened into
		* one jump list, registered into the sidebar's `sidebar.footer.action` seat so
		* it renders between the workspace tree and the Settings foot — find the
		* project folder above, open the latest work below.
		*
		* The same component owns the fold control for the shell's workspace list
		* ({@link WorkspaceListFold}), so both lists show five items and hold the rest
		* behind one identically styled row: the column stays compact by default, and
		* an expanded list simply flows below the workspace list — no fixed bottom
		* block, the tree's own scroll area absorbs the squeeze.
		*
		* The seat hands the component the column's `wide` flag only; session and
		* workspace facts arrive through the framework standard kit
		* (`useSessions`/`useWorkspaces`), and opening a session arrives through the
		* registration's injected face. A 56px rail has no room for a list, so the
		* section renders only while the column is wide — and re-showing the column
		* returns both lists to their folded default.
		*/
		/** Refresh cadence of the trailing relative-time labels. */
		const CLOCK_TICK_MS = 3e4;
		/** Current epoch ms, re-read on a slow tick so ages stay honest without a busy timer. */
		function useNow() {
			const [now, setNow] = (0, react.useState)(() => Date.now());
			(0, react.useEffect)(() => {
				const timer = window.setInterval(() => {
					setNow(Date.now());
				}, CLOCK_TICK_MS);
				return () => {
					window.clearInterval(timer);
				};
			}, []);
			return now;
		}
		/** Localized compact age ("刚刚"/"5分钟前" in zh, "now"/"5min ago" in en). */
		function timeLabel(t, updatedAt, now) {
			const { unit, n } = relativeTime(updatedAt, now);
			return unit === "now" ? t("time.now") : t("time.ago", { t: t(`time.${unit}`, { n }) });
		}
		/** Live-state dot of a row, or undefined when the session is idle. */
		function rowState(row) {
			if (row.waiting) return "warning";
			return row.running ? "ongoing" : void 0;
		}
		/**
		* Trailing row meta: the owning workspace — omitted when it merely repeats the
		* title, which is the common case for a session titled after its project — and
		* the age, which stays whole while the workspace name absorbs the truncation.
		*/
		function RowMeta({ row, t, now }) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
				className: RecentSessions_module_css_default.rowMeta,
				children: [row.workspace === row.title ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
					className: RecentSessions_module_css_default.rowWorkspace,
					children: row.workspace
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
					className: RecentSessions_module_css_default.rowDivider,
					"aria-hidden": "true",
					children: "·"
				})] }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
					className: RecentSessions_module_css_default.rowTime,
					children: timeLabel(t, row.updatedAt, now)
				})]
			});
		}
		/** One session row: live-state dot, title, and the workspace/age tail. */
		function RecentRowItem({ row, now, t, open }) {
			const state = rowState(row);
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("li", { children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
				type: "button",
				className: row.current ? `${RecentSessions_module_css_default.row} ${RecentSessions_module_css_default.rowCurrent}` : RecentSessions_module_css_default.row,
				"aria-label": t("row.open", { name: row.title }),
				"aria-current": row.current ? "true" : void 0,
				onClick: () => {
					open(row.id);
				},
				children: [
					state !== void 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.StateDot, {
						className: RecentSessions_module_css_default.rowDot,
						state,
						size: 8
					}),
					state !== void 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: RecentSessions_module_css_default.visuallyHidden,
						children: row.waiting ? t("status.waiting") : t("status.running")
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: RecentSessions_module_css_default.rowTitle,
						children: row.title
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(RowMeta, {
						row,
						t,
						now
					})
				]
			}) });
		}
		/**
		* Render the 最近 section and keep the workspace list folded to the same limit.
		* @param props - composed slot props (owner wide flag, standard kit hooks, injected open, locale seat).
		* @returns the section element, or null while the rail is collapsed or no session holds history.
		*/
		function RecentSessions({ wide, open, t, useSessions, useWorkspaces }) {
			const list = useSessions((snapshot) => snapshot);
			const workspaces = useWorkspaces((snapshot) => snapshot);
			const now = useNow();
			const [recentExpanded, setRecentExpanded] = (0, react.useState)(false);
			const [workspaceExpanded, setWorkspaceExpanded] = (0, react.useState)(false);
			const rows = (0, react.useMemo)(() => deriveRecentRows({
				list,
				workspaces: workspaces.items,
				archivedSessionIds: workspaces.archivedSessionIds,
				ungroupedLabel: t("workspace.ungrouped")
			}), [
				list,
				workspaces,
				t
			]);
			const foldOptions = (0, react.useMemo)(() => ({
				limit: 5,
				labels: {
					expand: (hidden) => t("fold.expandWorkspaces", { n: hidden }),
					collapse: t("fold.collapse")
				},
				onToggle: () => {
					setWorkspaceExpanded((current) => !current);
				}
			}), [t]);
			const fold = (0, react.useMemo)(() => new WorkspaceListFold(foldOptions), [foldOptions]);
			(0, react.useEffect)(() => fold.start(), [fold]);
			(0, react.useEffect)(() => {
				fold.setExpanded(workspaceExpanded);
			}, [fold, workspaceExpanded]);
			(0, react.useEffect)(() => {
				if (!wide) return;
				setRecentExpanded(false);
				setWorkspaceExpanded(false);
			}, [wide]);
			if (!wide || rows.length === 0) return null;
			const visibleRows = recentExpanded ? rows : rows.slice(0, 5);
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: RecentSessions_module_css_default.section,
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: RecentSessions_module_css_default.header,
						children: t("section.recent")
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("ul", {
						className: RecentSessions_module_css_default.list,
						children: visibleRows.map((row) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)(RecentRowItem, {
							row,
							now,
							t,
							open
						}, row.id))
					}),
					rows.length > 5 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
						type: "button",
						className: RecentSessions_module_css_default.foldRow,
						"aria-expanded": recentExpanded,
						onClick: () => {
							setRecentExpanded((current) => !current);
						},
						children: recentExpanded ? t("fold.collapse") : t("fold.expandSessions", { n: rows.length - 5 })
					})
				]
			});
		}
		//#endregion
		//#region src/client/index.ts
		/** Required services: the slot registry, the locale service, and the session store. */
		const inject = [
			"slots",
			"locale",
			"sessions"
		];
		/**
		* Open a session as the current one.
		* @param ctx - client root context.
		* @param sessionId - the session to open.
		*/
		function openSession(ctx, sessionId) {
			const navigation = ctx.get("uiWorkspace");
			if (navigation?.openSession !== void 0) {
				navigation.openSession(sessionId);
				return;
			}
			ctx.sessions.open(sessionId);
		}
		/**
		* Client plugin body: contribute the 最近 section to the sidebar foot. The
		* registration rides the slot service's inject wrapper, so unloading the
		* plugin removes the section with its fiber.
		* @param ctx - client root context.
		*/
		function apply(ctx) {
			ctx.effect(() => ctx.locale.register(NS, {
				zh,
				en
			}), "dsh-recent: dictionaries");
			ctx.slots.inject("sidebar.footer.action", () => ctx.slots.register({
				name: "sidebar.footer.action",
				id: "recent",
				order: 30,
				locale: NS,
				inject: () => ({ open: (sessionId) => {
					openSession(ctx, sessionId);
				} })
			}, RecentSessions));
		}
		//#endregion
		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});
