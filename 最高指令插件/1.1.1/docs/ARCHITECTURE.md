# 模块与数据流程

| 组件 | 职责 |
|---|---|
| DSH`lib/state.js` | UTF-8上限、类型检查、版本冲突、原子保存和备份恢复 |
| DSH`lib/index.js` | 注册原文及独立优先说明段，接入宿主服务与HTTP路由 |
| DSH`lib/client.js` | 插件页React面板、正文草稿、开关和保存反馈 |
| DSH`lib/contract.js` | chat/test/task范围约束与确切插件版本检查 |
| DSH`lib/bridge.js` | 原生会话提交、runId去重、实际回复读取、提示词装配证据和桌面选中 |
| DSH`lib/http.js` | 回环Host、同源Origin、请求格式及令牌检查 |
| Codex`scripts/bridge-client.mjs` | 读取本机桥描述，与已打开的桌面宿主连接，临时正文恢复 |
| Codex`scripts/contract.mjs` | Codex侧交接输入约束，拒绝将开发请求作为测试问题发送 |
| Codex`scripts/mcp-server.mjs` | 六项MCP工具、输入schema及结构化结果 |
| Codex`skills/start-dsh-chat/SKILL.md` | 实施负责人、允许动作、runId重试及真实结果验收规则 |

正文段`user:top-directive`的order为-2000，`interpolate:false`。来源与优先说明使用独立的前后段，分别为-2001和-1999；正文自身不增加标签、不裁剪空白。停用或空白正文时三段均不注入。

运行数据位于用户DSH目录：`top-directive/config.json`、备份、临时恢复记录、桥描述与本插件管理的run索引。桥描述中的随机令牌随宿主启动重新生成。HTTP与会话接口仅开放本插件所需能力；会话接口必须通过令牌验证并选择宿主已注册的工作区。桥不提供任意文件读取或shell接口。

测试会话在宿主装配阶段将工具列表置空，并记录实际正文SHA-256、字节数、首个段、回复与turn结束状态。客户端使用`uiWorkspace.openSession`确认桌面选中。Codex只把符合这些证据且正文恢复成功的结果标记为通过。

Codex侧源码另见[Codex-Plugins](https://github.com/ccl4-56-23-5/Codex-Plugins)。
