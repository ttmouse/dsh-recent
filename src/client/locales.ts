/** `recent` namespace dictionaries (the sidebar 最近 section copy and the workspace fold row). */

/** Dictionary namespace owned by this plugin. */
export const NS = 'recent'

/** The recent-section dictionary key set (the source of truth for both locales). */
export type RecentKey =
  | 'section.recent'
  | 'view.options'
  | 'view.showWorkspace'
  | 'fold.expandWorkspaces'
  | 'fold.collapse'
  | 'row.open'
  | 'row.pinned'
  | 'actions.session.aria'
  | 'actions.archive'
  | 'actions.unarchive'
  | 'actions.pin'
  | 'actions.unpin'
  | 'menu.pinSession'
  | 'menu.unpinSession'
  | 'menu.fork'
  | 'menu.archiveSession'
  | 'workspace.ungrouped'
  | 'status.running'
  | 'status.waitingApproval'
  | 'status.planReview'
  | 'status.waitingAnswer'
  | 'status.compact.approval'
  | 'status.compact.planReview'
  | 'status.compact.answer'
  | 'archive.confirm.title'
  | 'archive.confirm.desc'
  | 'archive.confirm.action'
  | 'archive.confirm.pending'
  | 'time.now'
  | 'time.minutes'
  | 'time.hours'
  | 'time.days'
  | 'time.months'
  | 'time.years'
  | 'time.ago'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** The sidebar 最近 section copy. */
    'recent': RecentKey
  }
}

/**
 * Simplified Chinese dictionary (the key-set source of truth). Every value is
 * the shell's own word for the same element — the rows and the hover card read
 * as the workspace tree's rows do, not as a translation of them.
 */
export const zh: Record<RecentKey, string> = {
  'section.recent': '最近',
  'view.options': '视图选项',
  'view.showWorkspace': '显示项目名称',
  'fold.expandWorkspaces': '展开其余 {n} 个工作区',
  'fold.collapse': '收起',
  'row.open': '打开会话“{name}”',
  'row.pinned': '已置顶',
  'actions.session.aria': '会话“{name}”的操作',
  'actions.archive': '归档会话',
  'actions.unarchive': '取消归档',
  'actions.pin': '置顶会话',
  'actions.unpin': '取消置顶',
  'menu.pinSession': '置顶会话',
  'menu.unpinSession': '取消置顶',
  'menu.fork': '分叉会话',
  'menu.archiveSession': '归档会话',
  'workspace.ungrouped': '未分组',
  'status.running': '进行中',
  'status.waitingApproval': '等待审批',
  'status.planReview': '计划待审',
  'status.waitingAnswer': '等待回答',
  'status.compact.approval': '待审批',
  'status.compact.planReview': '计划待审',
  'status.compact.answer': '待回答',
  'archive.confirm.title': '停止并归档此会话？',
  'archive.confirm.desc': '“{title}”仍有正在进行的工作。归档会先停止这些工作；之后可在侧栏筛选“全部对话（显示已归档）”中恢复会话，被停止的工作不会自动继续。',
  'archive.confirm.action': '停止并归档',
  'archive.confirm.pending': '正在停止并归档…',
  'time.now': '刚刚',
  'time.minutes': '{n}分钟',
  'time.hours': '{n}小时',
  'time.days': '{n}天',
  'time.months': '{n}个月',
  'time.years': '{n}年',
  'time.ago': '{t}前',
}

/** English dictionary, checked complete against the zh key set. */
export const en: Record<RecentKey, string> = {
  'section.recent': 'Recent',
  'view.options': 'View options',
  'view.showWorkspace': 'Show project names',
  'fold.expandWorkspaces': 'Show {n} more workspaces',
  'fold.collapse': 'Show less',
  'row.open': 'Open session “{name}”',
  'row.pinned': 'Pinned',
  'actions.session.aria': 'Session actions for {name}',
  'actions.archive': 'Archive',
  'actions.unarchive': 'Unarchive',
  'actions.pin': 'Pin',
  'actions.unpin': 'Unpin',
  'menu.pinSession': 'Pin session',
  'menu.unpinSession': 'Unpin session',
  'menu.fork': 'Fork session',
  'menu.archiveSession': 'Archive session',
  'workspace.ungrouped': 'Ungrouped',
  'status.running': 'Running',
  'status.waitingApproval': 'Waiting for approval',
  'status.planReview': 'Plan awaiting review',
  'status.waitingAnswer': 'Waiting for answer',
  'status.compact.approval': 'Approval',
  'status.compact.planReview': 'Plan review',
  'status.compact.answer': 'Answer',
  'archive.confirm.title': 'Stop and archive this session?',
  'archive.confirm.desc': '“{title}” still has work in progress. Archiving stops it first; you can restore the session later from the “All conversations (show archived)” filter in the sidebar, and the stopped work will not resume on its own.',
  'archive.confirm.action': 'Stop and archive',
  'archive.confirm.pending': 'Stopping and archiving…',
  'time.now': 'now',
  'time.minutes': '{n}min',
  'time.hours': '{n}h',
  'time.days': '{n}d',
  'time.months': '{n}mo',
  'time.years': '{n}y',
  'time.ago': '{t} ago',
}
