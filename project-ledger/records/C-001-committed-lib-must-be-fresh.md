# C-001：入库的 lib/ 必须与 src 新鲜构建逐字节一致

```json
{
  "id": "C-001",
  "kind": "constraint",
  "status": "active",
  "summary": "CI 门禁 pnpm build + git diff --exit-code -- lib；pnpm test 抓不到 lib 漂移，提交前必须重建",
  "scope": ["lib", ".github/workflows"],
  "sources": [".github/workflows/ci.yml"],
  "relations": [{ "type": "constrains", "target": "D-001" }],
  "key": "committed-lib-freshness",
  "recorded_at": "2026-10-06"
}
```

## 为什么

2026-10-06 的 d091437 提交了「新 src + 旧 lib」（6 文件漂移），本地 vitest 66 passed 全绿，只有 CI 的 lib 门禁能抓；90b1c48 纯重建修复。教训：每次改 src 后、提交前必须 `pnpm build` 把 lib/ 一起入库；另外 90b1c48 的 feat 标题下没有任何 .ts 实现，按 subject 做 bisect/changelog 会指错提交。
