# Efferent

**开源开放的桌面 Agent 工作台** —— 认知化为行动。

- **开源** · MIT，代码即产品
- **模型开放** · DeepSeek 起步，引擎可换（基于 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) 引擎）
- **数据全本地** · 凭据/会话/配置不出本机

对标的形态：Codex 桌面版 / Claude 桌面版的**开源替代**。桌面 + CLI 双形态规划中。

## 开发

```bash
npm install                 # 国内网络建议：ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/ npm install
npm run test:unit           # 单元测试（假依赖，秒级）
npm run stage               # 下载 Node 24 + 安装 DSH 引擎到 resources/（首次必跑）
npm run dev                 # 启动开发态应用
npm run test:integration    # 真引擎冒烟（需先 stage）
npm run dist                # 出 NSIS 安装包
```

- 规格：`docs/specs/`

> 状态：v0.1 底盘已就绪（引擎管理/打包/更新/CI 继承自前身 DSH-Desktop 项目）。
