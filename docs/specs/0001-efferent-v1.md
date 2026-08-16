# SPEC-0001: Efferent v1 —— 开源开放的桌面 Agent 工作台

> 状态：ready-for-agent
> 决策来源：2026-08-16 grilling 两轮（产品转向轮 + 命名轮），全部收口

## Problem Statement

Codex 桌面版与 Claude 桌面版绑定各自封闭的模型生态与订阅体系。想要开源、模型开放、数据全本地的桌面 Agent 工作台的用户没有选择。

## Solution

**Efferent**（传出神经——认知化为行动的通路）：开源（MIT）的桌面 Agent 工作台，以 DeepSeek Harness（DSH）为**隐形引擎**（用户无需知晓 DSH 的存在），DeepSeek 模型起步、引擎可换，所有数据（凭据/会话/配置）留在本机。形态对标 Codex 桌面版 / Claude 桌面版。市场顺序：中国先行，站稳后出海。

**双形态路线（2026-08-16 对齐修订）**：桌面应用与 CLI 是**平起平坐的两个主形态**（重度）。桌面 v1 先行（三旗舰），CLI 作为紧随其后的独立规格（SPEC-0002）一级交付——对标 Claude Code「CLI 即主战场」的现实。核心概念（会话/任务/自动化/配置）设计为形态无关。

**质量基线（2026-08-16 对齐）**：项目成熟度的判据是「可以摆上简历」——工程纪律（规格→计划→TDD→PR）、CI/CD、文档与决策日志即产品的一部分。纯开源作品（无商业化），付费项（代码签名等）永久降级为 README 引导。节奏：近期重点项目之一，持续更新——周级引擎 bump 例行化。

## 与前身（DSH-Desktop）的关系

DSH-Desktop（已归档）验证了全部工程底盘：Electron + sidecar 引擎（Node 24 + `@deepseek-ai/dsh` 精确 pin）、AppService 组合根、两段式树杀、孤儿清理、NSIS 打包 + afterPack 校验、electron-updater 自动更新、CI 发布链（含双 Release 竞态自动合并）。Efferent 仓库继承其全部代码与管线，重新品牌化（appId/产品名/数据目录 `Efferent`）。

**定位变化是本质的**：DSH-Desktop 的身份是「DSH 的桌面版」（用户因想要 DSH 而装）；Efferent 的身份是**独立 agent 产品**（用户因想要 Codex 的开源替代而装），DSH 只是实现细节。

## v1 范围（旗舰能力）

1. **品牌件**（界面路线 a 的身份层）：应用名/图标/启动页/关于页产品自有；界面主体暂用引擎 UI（目标用户为开发者，可接受其原生概念）；DSH 字样对终端用户不可见
2. **任务中心**：多会话并行总览面板（Codex app 的核心粘性来源；引擎已有 sessions 数据）
3. **自动化/定时任务管理**：产品化封装引擎原生 schedule 能力
4. 语音输入（🔊/🎤 已验证的浏览器端插件）：第二梯队，v1 可后置

**明确不做（v1）**：替换引擎主界面（v2 起逐块替换插槽）、自研前端（v3，待 ACP 成熟或引擎官方 IPC 桥落地）、mac/Linux、代码签名购买。

## Implementation Decisions

- 界面路线三段：**a) v1 壳层 chrome 先行**（品牌件+自有功能面板叠加）→ **b) v2 插槽深度定制**（逐块替换 conversation 等大插槽）→ **c) v3 自研前端**（ACP 成熟/IPC 桥落地后）。依据：ChatGPT/Claude 桌面端均为 web UI 原生壳 + OS 集成，桌面竞争力在常驻与集成而非重绘对话 UI；ACP 现状（无流式/纯文本/仅新建会话）排除近期自研
- 自有功能（任务中心/自动化）优先以**引擎浏览器端插件**形态实现——与引擎升级解耦（everything is plugin 红利），独立窗口/插槽面板承载
- 引擎管理全部继承：锁版本 + 周级 bump + 冒烟门禁（真引擎：启动→健康→boot 图→停止零残留）
- 数据目录：`%APPDATA%\Efferent\`（引擎 `DSH_HOME` 重定向于其下）
- 发布链继承：tag `v*` 触发 staging→NSIS→发布→打包冒烟；双 Release 竞态由 consolidate 脚本自动归并

## Naming Decisions（决策日志）

- 候选域：认知科学词汇（与 Codex/Claude 同域）。**Engram（记忆痕迹）**曾入选，因同域撞名被否——GitHub 存在 6k star 活跃项目 `Gentleman-Programming/engram`（AI agent 记忆系统，同受众）
- **Efferent（传出神经）**终选：认知化为行动的通路 = agent 的定义；GitHub 全域无 AI 域同名冲突（实测检索）
- 名称含义对外叙事：*"Efferent — where cognition becomes action."*

## Testing Decisions

继承 DSH-Desktop 全部测试策略与资产（三接缝：AppService 假依赖集成 / EngineProcess 状态机+真引擎冒烟 / Playwright 打包冒烟），vitest。新增面板/插件功能沿用接缝 1 模式：逻辑与渲染分离，逻辑全测。

## Out of Scope

见 v1 范围「明确不做」；CLI 形态另行规格（SPEC-0002+）。
