# Claude 桌面端 & OpenAI Codex 功能调研（网络调研，2026-08）

> 来源：调研 agent（官方文档/官方博客优先，媒体次之），完整来源 URL 见原报告。置信度标注：高=官方确认。

## Claude 桌面应用

**结构**：三标签——Chat（对话）/ **Cowork**（长期 agent 工作+Dispatch）/ **Code**（内置完整 Claude Code）

| 功能面 | 细节 | 置信度 |
|---|---|---|
| Projects | 独立工作区（文件/上下文/指令/记忆） | 高 |
| Artifacts | 可分享的交互式工件，可发布 | 高 |
| 会话管理 | 侧栏过滤分组、**侧聊不打断主会话**、跨会话查看/归档 | 高 |
| **MCP 本地集成（招牌）** | .mcpb 一键安装（免终端免 JSON、内置 Node、密钥入 OS 钥匙串）；MCP Apps 可在对话内呈现交互式 UI 面板 | 高 |
| Code 标签增值 | **可视化 diff 审查+行内评论、内置浏览器面板（预览+自动验证）、内置终端、文件编辑器**、PR 监控+CI 自动修复 | 高 |
| 会话环境 | Local/Cloud/SSH/WSL 四选一；git worktree 隔离多会话并行 | 高 |
| Cowork | 云端执行+本地文件直读写+Chrome 控制+专业输出（Excel/PPT）+`/schedule` 计划任务+并行子代理 | 高 |
| Computer Use | 分级权限（view/click/full） | 高 |
| 其他桌面特性 | Quick Entry 全局热键、语音听写、文件/截图拖粘、Dispatch（手机派发） | 高 |

**桌面独占**：本地 MCP 与 .mcpb 插件、Cowork 本地文件/浏览器/computer use、Live Artifacts、Code 标签全家桶、全局热键。

## OpenAI Codex（全形态）

| 功能面 | 细节 | 置信度 |
|---|---|---|
| 多 agent 并行 | 线程按项目组织、git worktree 隔离、**自动继承 CLI/IDE 的会话历史与配置** | 高 |
| **Automations（护城河）** | 定时后台任务、**心跳自动化**（挂在对话线程上按天/周自排程）、结果进**审查队列**、diff 行内评论 | 高 |
| 审批流 | 系统级沙箱+分级权限+项目级自动放行规则 | 高 |
| **Voice** | GPT-Live 实时语音对话（可打断）+纯听写；**免手控制 agent**（开线程/查进度/追加指令） | 高 |
| Computer Use | GUI 操作；macOS 可后台+锁屏模式；Windows 仅前台 | 高 |
| 内置浏览器 | 本地原型预览+行内反馈（对标快速前端迭代） | 高 |
| 其他 | 技能界面、记忆、主动建议、文件侧栏预览（PDF/表格）、图像生成、Remote（手机）、云任务统筹 | 高/中高 |

**CLI vs 桌面分工**：CLI=终端内脚本化/管道；桌面=多 agent 监督指挥中心（可视化会话/diff/审查队列）。

## 对本产品的启示（待矩阵合成时并入）

1. 两家共同 thesis：**桌面 = agent 指挥中心**（command center），不是「聊天窗口」
2. 工作台三件套成为标配：**可视化 diff 审查、内置浏览器/预览、审查/审批队列**
3. Codex 护城河=**Automations+审查队列**；Claude 护城河=**本地 MCP 生态（.mcpb）**
4. 全形态会话连续性（CLI/IDE/桌面共享历史）是 Codex 的隐性优势——与我们「UI 先、CLI 复用契约层」的路线呼应
