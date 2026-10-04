# dsh-recent

[English](README.en.md) | 简体中文

DSH Web GUI 插件：在左侧边栏「工作区」列表下面加一个 **最近** 区块，把各个项目里最新的会话打散成一条时间线。上面按文件夹找项目，下面直接点最近干的活。

![最近区块](docs/sidebar.png)

## 它解决什么

Codex 的侧边栏有两个视角：项目（文件夹）和最近（时间线）。DSH 的侧边栏只有项目视角——想回到刚才那个会话，得先想起它在哪个工作区里、再展开那个文件夹。

这个插件补上第二个视角：所有工作区的最新会话按更新时间排成一条平铺列表，每行显示标题、所属工作区、距今时间，点击即打开；运行中的会话显示状态点，当前会话高亮，工作区列表和最近列表都能折叠。

## 特性

- **平铺时间线**：跨工作区取最新会话，待选 20 条，不受项目折叠状态影响。
- **一致性**：可见性规则与工作区树完全一致——归档会话不显示、子代理会话归其父会话目录、空白占位会话不显示（它没有历史）。
- **状态可见**：等待你响应（审批/提问/计划确认）标黄点，运行中标动态点，当前会话整行高亮。
- **双折叠**：最近区块和工作区列表各自折叠到 5 条，各有一行同款折叠钮（「展开其余 N 个会话 / 工作区」）；展开是临时状态，收起侧栏再展开回到折叠默认。
- **原生外观**：使用 `--dsw-*` 语义 token 与外壳自带的 `StateDot`、三角图标，跟随明暗主题与品牌主题；两个折叠钮的尺寸、缩进、颜色与外壳自己的「展开其余 N 个会话」完全一致。
- **不改外壳源码**：最近区块注册到侧边栏既有的 `sidebar.footer.action` 列表槽位；工作区列表的折叠在已发布的外壳里没有对应槽位或服务，因此由本插件在 DOM 层补上（见设计说明），不修改、也不需要重新构建 DSH 前端。

## 安装

在跑 GUI 的 profile 目录里（通常是 `~/.dsh/profiles/web`），从 GitHub 装：

```sh
dsh plugin --profile web add github:ttmouse/dsh-recent
```

改本插件源码时用本地克隆（`link:` 会跟随你的改动）：

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
- **工作区折叠怎么做的**：外壳把每个工作区渲染成一个 `_groupSection`，但既不提供「少显示几个」的能力，也没有对应槽位、store 或配置项，所以插件从外面补：把超出 5 个的 `_groupSection` 置为 `display: none`，在第 5 个后面插一行折叠钮。React 每次重渲染都会重写这份列表，因此用一个挂在 `document.body` 上的 MutationObserver 自愈，并用「先比对再写」保证自己的写入不会触发自己；观察回调先按记录过滤（只处理落在侧栏列内的变更），对话流式输出不会走到 `apply()`。列表容器的定位靠「第一个已渲染的 `_groupSection` 的父节点」，所以单列表/搜索渲染（没有 group 包装）天然不受影响。
- **折叠是临时状态**：没有任何 store，展开状态住在组件里；侧栏收起再展开（`wide` 由 false 变 true）时两个列表都回到只显示 5 条，和 Codex 一致。
- **自然高度**：最近区块不做内部滚动、不占底部固定高度，展开多少行就多高，始终紧贴在工作区列表下方；列内空间不够时，由工作区树自己的滚动区域吸收挤压（`regionArea` 本身是 `min-height: 0; overflow: hidden` 的伸缩区）。

## 已知限制

- **只在宽栏显示**：56px 导轨状态不渲染本区块（需要在导轨上占一格的入口，应改用 `sidebar.panellist` 走面板形态）。
- **工作区折叠依赖外壳的 DOM 结构**：靠 `_groupSection` / `_footArea` 两个 CSS Module 后缀和「第一个 group 的父节点」定位；外壳若改名或改结构，折叠会静默失效（退化成外壳原本的完整列表），不会报错也不会破坏列表。折叠按工作区组计数，不按会话数。
- **折叠只裁不排序**：工作区的顺序沿用列表自身顺序（新建在前 + 手动排序），插件不按「最近活跃」重排；要重排需要动外壳的列表顺序，属于上游改动。
- **上限 20 条**：折叠时只显示最近 5 条，更久的历史请用工作区树或搜索；这个区块给的是「最近」。
- **不做搜索、不做右键菜单**：重命名/归档/分叉仍归工作区树。
- **标题为空时会显示会话 id**：标题由宿主从日志投影；尚无标题的旧会话，行标题就是 `displayTitle` 的回退值（通常是项目目录名或会话 id）。

## 许可证

[MIT](LICENSE)
