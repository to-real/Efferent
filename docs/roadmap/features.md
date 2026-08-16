# Efferent 功能待办清单（竞品证据 × DSH 原生特性，2026-08-16）

> 依据：docs/research/matrix-alignment.md（四家竞品矩阵）+ DSH 源码核实的原生特性。
> 每项标注：**DSH 依托**（内核给什么）｜**竞品对照**（谁有、证据）。
> 勾选状态 = 产品待办追踪（开发按 SPEC/计划另行排期）。

## DSH 原生特性速查（本清单的依托底座）

- **四模式**（preset 花名册，`apps/cli/config/agent-presets/`）：标准（完整编码 Agent）/ PTC·Code Mode（模型写 TS 程序组合多步操作）/ 极简（bash+editor 双工具）/ 创造（preset 创作器，`$DSH_HOME/.agent-presets` 用户可写）
- **一切皆插件**：宿主端+浏览器端双半插件、40+ UI 插槽、动态 cordis（会话内定义）、插件即组合
- 协议面：session/workspace/goal/skill/subagent/llm/credentials 全 RPC + 事件流（docs/notes/engine-api.md）

---

## P0 · v2.0 工作台核心（产品脸，对应 M1-M4）

- [ ] **会话主视图：流式对话** —— DSH 依托：session/event 流（流式块）｜对照：四家标配
- [ ] **工具调用卡片**（折叠：输入/输出/耗时）—— DSH 依托：事件流中工具生命周期帧｜对照：ZCode/Codex/Claude Code 核心体验
- [ ] **diff 渲染（编辑类工具客户端推导）** —— DSH 依托：编辑工具事件的参数（str_replace 的 old/new）｜对照：Codex/Claude 招牌能力（行内评论后置 v2.1）
- [ ] **行内审批卡**（approval/requested 帧 → 允许/拒绝）—— DSH 依托：审批帧+respond 通道｜对照：四家标配
- [ ] **行内提问卡**（question/requested 帧）—— DSH 依托：question 帧｜对照：ZCode/Codex
- [ ] **Composer**：输入区/斜杠命令/排队指示 —— DSH 依托：session.prompt+queue 帧+commands｜对照：四家标配
- [ ] **模式与模型选择器** —— DSH 依托：**四模式 preset 花名册**（agentPreset.list/select）+ llm.models｜对照：四家标配；**我们的特色：四模式一键切换是竞品没有的组合自由**
- [ ] **任务侧栏**（现任务中心升级为事件驱动）—— DSH 依托：session.list+host 帧｜对照：Codex 审查队列形态
- [ ] 诊断模式（自带 UI 隐藏入口）—— 壳层能力

## P1 · v2.1 工作台纵深（壳层自建为主，差异化机会）

- [ ] **内置终端**（xterm.js + 已捆绑的 node-pty，绑定工作区）—— 壳层自建，零引擎依赖｜对照：Claude/Codex/ZCode 标配，**缺口即差距**
- [ ] **预览浏览器窗格**（Electron BrowserView，本地端口预览）—— 壳层自建｜对照：**4/4 全有**（ChatGPT Work/Claude Code/Codex/ZCode）
- [ ] **计划/目标面板**（goal.* RPC 现成：create/edit/pause/resume/complete）—— 对照：ZCode 计划模式+Todo 板、Codex Goal mode
- [ ] diff 行内评论/编辑 —— 依赖 P0 diff 渲染落地后演进｜对照：Codex/Claude
- [ ] 历史搜索 —— DSH 依托：session.search RPC｜对照：ChatGPT Ctrl+K

## P2 · v2.2+ 生态与自动化（插件分发机制解锁后）

- [ ] **自动化面板**（schedule 管理）—— DSH 依托：宿主端插件注册 HTTP 路由（schedule 工具已内核化）｜对照：**四家全有**（Tasks//schedule/Automations/cron），最大缺口
- [ ] **语音输入**（M1/M2 已验证的浏览器端插件持久化）—— 对照：3.5/4 家有
- [ ] **MCP 接入**（引擎有 mcp 包，先探察暴露面）—— 对照：Claude .mcpb 是其护城河，**开源对标点**
- [ ] 插件市场/管理（一切皆插件的产品出口）—— 对照：ChatGPT Apps 目录、社区生态

## P3 · 差异化长线（DSH 独有哲学的产品化）

- [ ] **Agent 组合器**（创造模式产品化：UI 里组装 preset/插件/技能为自己的 Agent）—— DSH 依托：创造模式+一切皆插件｜对照：Codex Record&Replay、Claude Skills 创作——**我们认为这是最大差异化金矿**
- [ ] **Code Mode 工作面**（PTC 模式的程序执行呈现：模型写的 TS 程序卡片化）—— DSH 独有，竞品无对应物
- [ ] 子代理并行视图 —— DSH 依托：subagent RPC｜对照：Codex 多 agent 指挥中心
- [ ] CLI 形态（SPEC-0003，复用契约层）—— 对照：Codex CLI/桌面分工（CLI=脚本化，桌面=指挥中心）

## 已完成

- [x] 壳与引擎管理、品牌件、任务中心 v1（v0.1.0 已发布）
