# SPEC-0002: Efferent 自有工作台 UI（对标 ZCode / Codex）

> 状态：ready-for-agent
> 决策来源：2026-08-16 产品转向 grilling（Q1-Q5 全收口）+「顺着内核做」原则共识
> 前置：SPEC-0001（v0.1.0 已交付：壳/品牌件/任务中心）

## Problem Statement

引擎自带 Web UI 是聊天页面形态（侧栏+对话流），天花板是「好看的聊天应用」。ZCode/Codex 是**工作台形态**：工具调用透明化、计划与任务进度实时可见、行内审批——这是 agent 产品的竞争力所在。依赖自带 UI 无法企及，必须自建前端。

## Solution

**Efferent 自有前端**（React + Vite），作为产品的唯一主界面，通过**主进程网关**消费引擎 `/api` 协议（HTTP RPC + 事件流）——引擎自带 UI 也是该协议的客户端，我们写一个更好的客户端。引擎完全隐形。自带 UI 降级为开发者诊断模式（菜单隐藏入口，默认关闭）。

## 「顺着内核做」五原则（架构宪法）

1. **单一事实源**：一切状态以引擎协议为准（会话/队列/审批/投影）；UI 不建影子状态机；断线重连靠 `session.history` + 投影重建（照抄自带 UI 的纪律）
2. **能力面 = 协议面**：功能受 `/api` 方法表与事件帧约束；内核未暴露的不硬造——要新能力走宿主侧插件或上游贡献，**不打引擎补丁**
3. **契约随版本锁**：锁引擎版本=锁 UI 契约；引擎 bump 时 UI 关键路径 e2e 同门禁
4. **概念映射显式化**：见下表，防 UI 概念漂移
5. **参照实现可借鉴**：`packages/client`（自带 UI 连接层）是活文档，只参照不照搬

## 概念映射表（内核 → UI）

| 内核概念 | UI 呈现 |
|---|---|
| session | 任务（会话视图的载体） |
| `projections.values.title` | 任务名 |
| session/event 流（含流式块） | 对话流（流式渲染） |
| 工具调用事件 | 工具卡片（可折叠：输入/输出/耗时） |
| approval/requested 帧 | 行内审批卡（允许/拒绝） |
| question/requested 帧 | 行内提问卡（Agent 问用户） |
| goal.* RPC | 计划/目标面板 |
| queue（session/queue 帧） | 输入区排队指示 |
| workspace | 工作区切换器 |
| agentPreset / llm.models | 模式与模型选择器 |

## Architecture

```
renderer/app（React+Vite，构建产物打包进应用）
        ↕ contextBridge（typed IPC 契约）
主进程网关（gateway/）：
  ├─ RPC 客户端（复用并扩展 engine-api.ts → 全方法表）
  ├─ 事件流订阅（全量 events.mux + events.host → 按打开的会话过滤 → IPC 转发）
  └─ 生命周期（引擎启停/单实例/托盘后续）
```

- **renderer 永不感知 HTTP/WS 细节**（Q5）；凭据与管道留在主进程
- IPC 契约层（类型 + 客户端 + 事件转发）**独立成包**：CLI（SPEC-0003）直接复用（Q4 的顺序红利）
- renderer 数据层支持 **fixture 传输**（注入预制帧）——UI 可离线开发与无 Key 测试（CI e2e 用）

## 工作台面（2026-08-16 证据驱动修订版，用户已确认）

> 依据：三路竞品调研 + 四家功能矩阵（docs/research/matrix-alignment.md）+ DSH 四模式特性核实；完整分层见 docs/roadmap/features.md。

**v2.0（P0，产品脸的最小完整集）**
1. 会话主视图：流式对话（session/event 流）
2. 工具调用卡片（折叠：输入/输出/耗时）
3. **diff 渲染**（编辑类工具事件客户端推导——Codex/Claude 招牌能力，证据升入核心）
4. 行内审批卡（approval 帧 + /api/respond 回传）
5. 行内提问卡（question 帧）
6. Composer：输入区/斜杠命令/排队指示
7. **四模式选择器**（标准/PTC/极简/创造，agentPreset 花名册）+ 模型选择——竞品无的组合自由
8. 任务侧栏（事件驱动升级）
9. 诊断模式（自带 UI 隐藏入口，默认关）

**v2.1（P1）**：内置终端（xterm+node-pty 壳层自建）· 预览浏览器窗格（BrowserView）· 计划/目标面板（goal RPC）· diff 行内评论 · 历史搜索
**v2.2+（P2/P3）**：自动化面板 · 语音 · MCP · 插件市场 · Agent 组合器（创造模式产品化）· Code Mode 工作面 · 子代理视图 · CLI（SPEC-0003）

## Testing Decisions

- **接缝延续**：网关过滤/合并逻辑（主进程纯函数）单测；IPC 契约层用 fixture 帧单测；renderer 组件 vitest + Testing Library（fixture 传输驱动）；关键路径 Playwright（真引擎，无 Key 场景走 fixture 模式）
- 既有底盘（引擎管理/打包/CI）不动

## Out of Scope

- CLI（SPEC-0003，与 UI 共享契约层）
- 自动化管理面板（依赖插件分发机制，与 SPEC-0003+ 合并处理）
- 语音输入（同上）；diff 视图（待探察）
- mac/Linux、代码签名

## Milestones

M1 IPC 契约层 + 网关（RPC 扩全量 + 事件订阅转发，fixture 机制）→ M2 会话主视图+Composer（含行内审批）→ M3 任务侧栏整合 + 诊断模式菜单 → M4 v2.0 打包发布 → M5 计划面板等 v2.1
