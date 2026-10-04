/** `recent` namespace dictionaries (the sidebar 最近 section copy and its fold row). */

/** Dictionary namespace owned by this plugin. */
export const NS = 'recent'

/** The recent-section dictionary key set (the source of truth for both locales). */
export type RecentKey =
  | 'section.recent'
  | 'fold.expandWorkspaces'
  | 'fold.expandSessions'
  | 'fold.collapse'
  | 'row.open'
  | 'workspace.ungrouped'
  | 'status.running'
  | 'status.waiting'
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

/** Simplified Chinese dictionary (the key-set source of truth). */
export const zh: Record<RecentKey, string> = {
  'section.recent': '最近',
  'fold.expandWorkspaces': '展开其余 {n} 个工作区',
  'fold.expandSessions': '展开其余 {n} 个会话',
  'fold.collapse': '收起',
  'row.open': '打开会话“{name}”',
  'workspace.ungrouped': '未分组',
  'status.running': '进行中',
  'status.waiting': '等待响应',
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
  'fold.expandWorkspaces': 'Show {n} more workspaces',
  'fold.expandSessions': 'Show {n} more sessions',
  'fold.collapse': 'Show less',
  'row.open': 'Open session “{name}”',
  'workspace.ungrouped': 'Ungrouped',
  'status.running': 'Running',
  'status.waiting': 'Waiting for you',
  'time.now': 'now',
  'time.minutes': '{n}min',
  'time.hours': '{n}h',
  'time.days': '{n}d',
  'time.months': '{n}mo',
  'time.years': '{n}y',
  'time.ago': '{t} ago',
}
