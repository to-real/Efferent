# ChatGPT 桌面端功能调研（网络调研，2026-08）

> 来源：调研 agent，官方帮助文档/发布说明优先。完整来源 URL 见原报告（help.openai.com / openai.com 官方为主）。

## 关键背景：新旧两代并存

- **新版 ChatGPT 桌面应用**（2026-07-09 全球发布，macOS+Windows，2026-08-14 Linux 预览）：整合 **Chat（对话）/ Work（智能体工作）/ Codex（软件开发）** 三视图，所有套餐（含 Free）可用
- **ChatGPT Classic**（旧版更名保留）：部分新 agent 功能仅限新版

## 功能面清单（置信度均为官方确认，除标注外）

**核心对话**：统一 Recents（Chat/Work 合并列表）、Ctrl+K 历史搜索、Projects 项目工作区（2026-07 进入新版桌面）、临时对话

**桌面特有**：
- 伴随窗口+全局热键（Option/Alt+Space，可自定义）
- 截图讨论（Snipping Tool 集成 / Cmd+Shift+1 / Codex Appshots）
- **Voice 进入 Work 与 Codex**（2026-07-23）：语音启动/排序/中断任务、控制电脑、跨会话协调多 agent、后台运行+语音播报进度——官方明示 web/移动端无此能力
- 文件拖放、Work 可访问本地文件与桌面应用

**Agent 能力**：
- **ChatGPT Work**（现行主力）：跨应用连接（Slack/Drive/邮件/CRM）、Sites（可分享交互式网站）、定时任务（一次性/日程/事件触发+持续监控）、**桌面 Computer Use**、内置浏览器、Auto-review
- **Codex 视图**：多 agent 并行+worktree 隔离+**可审查 diff（含行内编辑）**、侧栏 PR 审查、Computer Use（手机远程）、Record & Replay（工作流转技能）、Goal mode、浏览器开发者模式、Windows 原生沙箱/WSL2
- Deep Research（带引用报告，导出 Md/Word/PDF）、Canvas（并排编辑）、Tasks 定时任务（web/mobile/桌面三端官方确认）
- Operator 与旧 Agent Mode 已下线（被 Work+云端浏览器取代）

**生产力**：Work with Apps（macOS Classic 专属：读取/编辑本机 IDE 与应用内容，VS Code/JetBrains/Xcode/Terminal）、记忆+**Computer History**（2026-08-13，macOS 桌面独占：本机活动事件流转记忆）、连接器生态、图像生成

## 桌面端独占能力（官方确认）

1. Codex 完整开发视图（web/移动无入口）
2. Work 本机能力（Computer Use、本地文件/应用）
3. Voice in Work/Codex（语音指挥电脑、协调多 agent）
4. 伴随窗口+系统级热键
5. Work with Apps（仅 macOS）
6. Computer History（仅 macOS）
7. Codex 进阶：Appshots、Record & Replay、Goal mode、浏览器开发者模式、锁屏远程控制

**反向差异（web 更全）**：GPT 创建/编辑、Image Library 完整 UI、定时任务管理页
