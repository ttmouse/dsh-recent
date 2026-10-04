# dsh-recent

DSH Web GUI 插件：在左侧边栏「工作区」列表下面加一个 **最近** 区块，把各个项目里最新的会话打散成一条时间线。上面按文件夹找项目，下面直接点最近干的活。

![最近区块](docs/sidebar.png)

## 它解决什么

Codex 的侧边栏有两个视角：项目（文件夹）和最近（时间线）。DSH 的侧边栏只有项目视角——想回到刚才那个会话，得先想起它在哪个工作区里、再展开那个文件夹。

这个插件补上第二个视角：所有工作区的最新会话按更新时间排成一条平铺列表，每行显示标题、所属工作区、距今时间，点击即打开；运行中的会话显示状态点，当前会话高亮，整块可以折叠。

## 特性

- **平铺时间线**：跨工作区取最新会话，默认显示 8 条（超过部分在区块内滚动），不受项目折叠状态影响。
- **一致性**：可见性规则与工作区树完全一致——归档会话不显示、子代理会话归其父会话目录、空白占位会话不显示（它没有历史）。
- **状态可见**：等待你响应（审批/提问/计划确认）标黄点，运行中标动态点，当前会话整行高亮。
- **折叠**：点标题行收起/展开；默认展开。
- **原生外观**：使用 `--dsw-*` 语义 token 与外壳自带的 `StateDot`、三角图标，跟随明暗主题与品牌主题。
- **零外壳改动**：注册到侧边栏既有的 `sidebar.footer.action` 列表槽位，不需要改 DSH 前端、不需要重新构建 web 包。

## 安装

在跑 GUI 的 profile 目录里（通常是 `~/.dsh/profiles/web`）：

```sh
dsh plugin --profile web add link:/path/to/dsh-recent
```

该命令会把依赖写进 profile 的 `package.json`，并自动把 `dsh-recent` 追加到 `dsh.profile.bundles`（也可以手工做这两步）：

```json
{
  "dependencies": { "dsh-recent": "link:/path/to/dsh-recent" },
  "dsh": { "profile": { "bundles": ["…", "dsh-recent"] } }
}
```

然后重启 `dsh web` 并刷新页面——bundle 列表在启动时读取，热重载只覆盖已加载插件的源码变更：

```sh
# 停掉当前的 dsh web，再重新启动
dsh web
```

## 开发

```sh
pnpm install
pnpm run typecheck   # tsc --noEmit（src + tests）
pnpm test            # 单元测试；构建过后还会校验 lib/client.js 的加载器契约
pnpm run build       # lib/index.js + lib/invariant.js + lib/client.js + lib/types
```

改完源码必须重新 `pnpm run build`：宿主服务的是 `lib/client.js`，不是源码。

## 设计说明

- **槽位选择**：`sidebar.footer.action` 是 `@deepseek-ai/dsh-client-ui-sidebar` 长期声明的 list 槽位，渲染位置正是工作区树与「设置」之间——需求要的位置。它同时被收窄到 56px 图标栏（`wide: false`）时，本区块渲染为 `null`：一条列表在导轨里没有意义。
- **数据来源**：会话与工作区数据走框架标准套件（注册组件自带的 `useSessions`/`useWorkspaces` 选择器钩子），打开会话走注册时注入的 `open` 回调，不在组件里订阅任何外部源。
- **打开会话**：优先走较新外壳的 `uiWorkspace.openSession`（它同时清掉中间列选中的面板），服务不存在时退回 `ctx.sessions.open`。
- **时间分档**：与工作区树同一套档位（刚刚 / N分钟 / N小时 / N天 / N个月 / N年），每 30 秒刷新一次，所以同一会话在两个界面上读到的年龄一致。
- **无 store**：展开状态是组件私有状态，没有跨入口共享或需要跨重载保留的数据，因此不声明 store。

## 已知限制

- **只在宽栏显示**：56px 导轨状态不渲染本区块（需要在导轨上占一格的入口，应改用 `sidebar.panellist` 走面板形态）。
- **上限 8 条**：更久的历史请用工作区树或搜索；这个区块给的是「最近」。
- **不做搜索、不做右键菜单**：重命名/归档/分叉仍归工作区树。
- **标题为空时会显示会话 id**：标题由宿主从日志投影；尚无标题的旧会话，行标题就是 `displayTitle` 的回退值（通常是项目目录名或会话 id）。
