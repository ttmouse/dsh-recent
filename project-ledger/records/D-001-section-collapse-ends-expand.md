# D-001：折叠工作区 section 即结束「全部展开」选择

```json
{
  "id": "D-001",
  "kind": "decision",
  "status": "active",
  "summary": "section 折叠撤销「显示全部项目」：再展开 section 时列表回到最近 5 个的折叠默认，而非保持全展开",
  "scope": ["src/client"],
  "sources": ["src/client/RecentSessions.tsx", "src/client/workspaceFold.ts", "tests/workspace-fold.spec.ts"],
  "relations": [{ "type": "verified-by", "target": "E-001" }, { "type": "constrained-by", "target": "C-001" }],
  "key": "workspace-fold-expand-lifetime",
  "recorded_at": "2026-10-06",
  "verified_at": "2026-10-06"
}
```

## 为什么

用户拍板（2026-10-06）：「整个工作区折叠之后再展开，默认只展示最近的 5 个项目」。此前的行为契约（d091437 引入的「展开是设置，活过一切视口变化」）在 section 折叠这个场景被推翻——视口开关与列表选择同命运。

## 实现

- `RecentSessions.tsx`：`workspaceCollapsed` 置真时 `setWorkspaceExpanded(false)`，经既有 effect 持久化到 `dsh-recent:view.workspacesExpanded`。
- `workspaceFold.ts` `setExpanded(false)` 清 `expandedGroups`（组内会话展开随列表折叠回落）。
- 撤销「全部展开」的路径从此只有两条：折叠行「收起」、折叠 section。

## 未选方案

保持 d091437 契约（section 折叠不重置）——被用户否决。
