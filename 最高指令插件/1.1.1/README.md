# DSH最高指令1.1.1

合并`dsh-initial-prompt`与`dsh-top-directive`，保留已安装的`dsh-top-directive`包名和原配置。桌面只需安装这一份提示词插件。

## 使用

DSH左侧“插件”→已安装→`dsh-top-directive`。专用正文框支持多行文字，开关即时保存；正文按“保存”或Ctrl+Enter保存。切换开关保留未保存的正文。配置保存失败会显示错误，不会宣称成功。正文上限32KiB，按UTF-8字节检查，超限拒绝保存，不截断中文或表情。

正文原样注册为`user:top-directive`系统提示词段，`order:-2000`，位于第一方身份段之前，`interpolate:false`。正文两侧使用独立段标明这是用户授权的正式系统配置，保留原版对指令来源和优先关系的说明；正文自身不改写空格、标签、换行或`{{变量}}`。空白正文或停用时，正文和边界段都不注入。保存后在下一次请求装配时生效，正在处理的请求不变。

这是DSH系统提示词中的前置配置段。段落顺序不创建模型API的新权限等级，工具权限仍由DSH宿主执行。

## 安装与恢复

安装`dsh-top-directive-1.1.1.tgz`后重新打开DSH桌面。附带`Install-DSH.ps1`可在DSH退出后更新desktop profile，并备份清单、锁文件和旧配置。安装器将旧`dsh-initial-prompt`依赖与bundle移除，保留一份`dsh-top-directive`。已有的`~/.dsh/top-directive/config.json`继续使用，不覆盖用户正文。

原配置格式：`{"enabled":true,"text":"你的提示词"}`。保存写入临时文件、同步、原子替换，再更新内存；保留上一次成功状态于`config.json.bak`。配置损坏时读取备份并明确显示恢复提示。页面使用版本摘要检查并发保存冲突。

## Codex会话桥

本版提供协议2的本机会话桥，与Codex控制插件0.2.0配套。桥接描述在`~/.dsh/top-directive/codex-bridge.json`，令牌每次宿主启动重新生成，不出现在返回结果或报告中。所有接口限定回环Host和同源Origin；会话接口另需令牌。桥仅操作自身记录的run，不开放任意文件或shell接口。

- `chat`：只发送用户明确要求转发的消息。
- `test`：指定现有插件和版本，由Codex负责实现，DSH仅回答测试问题；本会话的工具列表由宿主清空。
- `task`：用户明确委派DSH时，列明工作区、负责人、允许文件和验收证据。

稳定runId及DSH requestId共同防止重试重复发送。状态分别返回accepted、sent、completed、实际回复、系统提示词摘要、工具调用数及桌面选中确认。桌面客户端通过`uiWorkspace.openSession`显示对应会话；未确认时不会宣称已显示。

## 开发验证

依赖宿主原生systemPrompt、webServer、sessionController及workspaceRegistry服务。无需Schemastery版本相关的volatile接口。基础提示词可在没有桌面桥的宿主使用；`desktopBridge:false`停用桥。

测试命令：`node --test test/host.test.mjs`。实际桌面模型验证记录随交付包提供；单元测试不代替模型实际回复验证。

MIT许可证。

