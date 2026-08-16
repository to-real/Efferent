# 引擎数据通道事实清单（Task 5 探察产物，2026-08-16）

> 来源：探索 agent 对 `E:\dev\deepseek-harness`（rc.5 源码）的调查，全部结论附源码位置。

## 协议

- 单一 HTTP 服务器，上行 RPC 走 `POST /api/<method>`：信封 `{type:'client-request', rpcId, method, payload}`，`method` 必须与路径段一致；响应 `{type:'server-response', rpcId, result:{ok, value|error}}`，业务错误也是 HTTP 200
- **无鉴权**（无 token/Authorization）。信任围栏仅三点：Host 必须 loopback（127/8、localhost、[::1]）；`sec-fetch-site: cross-site` 拒绝；**不带 Origin 头则放行**——壳进程（Node fetch）天然满足，可直接调用
- POST 需 `Content-Type: application/json`
- 下行事件：`/api/events.mux`（全会话）与 `/api/events.host`（宿主级），**只下行**。**重要更正（2026-08-16 实测）**：线上 HTTP GET 被路由层 426 拒绝逼向 **WebSocket**（SSE 仅供引擎进程内 fetch 形态）——网关必须走 WS（Node 22+ 原生 WebSocket 可用，已实测）；帧信封 `{type:'server-request', rpcId, method, payload}`

## 会话查询（任务中心的数据源）

- `POST /api/session.list`，payload `{}`（cursor 为保留位）→ `{items: SessionSummary[]}`，按 `updatedAt` 降序
- `SessionSummary`：`sessionId` / `updatedAt`（较晚者语义） / `running` / `blank` / `projections.values.title`（**标题在投影里**，缺失=null）
- `POST /api/workspace.list` → `{items: WorkspaceView[], archivedSessionIds}`；`WorkspaceView = {workspaceId, path, title, sessionIds[]}` —— 会话→工作区归属靠 `sessionIds` 反查 join

## 会话直达（聚焦）

- **不存在 URL 寻址**：当前会话是前端 localStorage 状态（`dsh.sessions.current`），服务器任意路径回同一 SPA。外部只能聚焦主窗口，不能直达某会话（v1 任务中心点击=聚焦主窗）

## schedule（自动化）——触发探察门回退

- 仅 3 个**模型工具**：`schedule_create` / `schedule_list` / `schedule_delete`（无 pause）
- **无 HTTP 路由、无斜杠命令、无暂停**——外部面板无法直接管理
- 间接路径只有「向会话发 prompt 让模型调工具」，不适合管理面板
- **结论**：自动化面板不可行于 v1 的 HTTP 通道方案；正解是随应用分发一个宿主端插件（注册 HTTP 路由），归入 SPEC-0002 与插件分发机制一起解决

## 方法表速查（与本产品相关的）

`session.list / session.search / session.history / session.prompt / session.cancel / workspace.list / host.describe / settings.* / credentials.* / llm.providers / llm.models`
