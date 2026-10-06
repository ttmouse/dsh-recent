# E-001：折叠生命周期 2026-10-06 验证

```json
{
  "id": "E-001",
  "kind": "evidence",
  "status": "active",
  "summary": "vitest 81 passed（含 2 条 section 折叠往返回归）+ 真实 GUI 断言 10/10（合成工作区注入法，web 127.0.0.1:3080）",
  "scope": ["src/client", "tests"],
  "sources": ["tests/workspace-fold.spec.ts"],
  "relations": [{ "type": "verifies", "target": "D-001" }],
  "recorded_at": "2026-10-06",
  "verified_at": "2026-10-06"
}
```

## 验证内容

- 单测：`returns to the folded default…` ×2（含折叠期间 shell 整体重写列表的变体）。
- GUI：展开(26/26 可见) → section 折叠(0 可见) → 再展开(回到 5，合成行被折回，折叠行文案恢复「展开其余 N 个工作区」)。
