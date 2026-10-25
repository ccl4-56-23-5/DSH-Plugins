# DSH 最高指令

<p align="center"><img src="lib/assets/logo.png" width="192" alt="最高指令 logo"></p>

为 DSH 设置全局系统提示词，支持原文保存、即时启停和下一次请求生效。当前版本 **1.1.2**，包名 `dsh-top-directive`。

## 使用

打开 DSH“插件 → 已安装 → 最高指令”，在正文框输入提示词，点击“保存”或按 Ctrl+Enter。开关即时保存，并保留未保存的正文草稿。

正文上限 32 KiB，按 UTF-8 字节计算。换行、空格、标签和 `{{变量}}` 按原样保存；保存失败或其他窗口已修改配置时，页面会显示处理提示。

启用后，正文作为 `user:top-directive` 系统提示词段，在 DSH 身份段之前装配；停用或保存空白正文后停止注入。配置在下一次请求生效。提示词段顺序遵循模型 API 的 system 消息机制，工具权限由 DSH 管理。

## 安装与配置

从 [Release](https://github.com/ccl4-56-23-5/DSH-Plugins/releases/tag/top-directive-v1.1.2) 下载 TGZ，在 DSH 插件管理中添加。Windows 用户也可下载 `Install-DSH.ps1`，与 TGZ 放在同一目录，退出 DSH 后运行。详见 [安装指南](docs/INSTALLATION.md)。

配置位于 `~/.dsh/top-directive/config.json`，格式为：

```json
{"enabled":true,"text":"你的提示词"}
```

保存使用临时文件和原子替换，上一份配置保存在 `config.json.bak`。主文件损坏时从备份恢复，并在页面提示。升级沿用原配置；安装器将旧 `dsh-initial-prompt` 合并为一份 `dsh-top-directive`。

## Codex 会话桥

内置协议 2 的本机会话桥，与 [Codex 端插件](https://github.com/ccl4-56-23-5/Codex-Plugins) 0.2.0 配套，提供三种会话模式：

| 模式 | 用途 |
| --- | --- |
| chat | 转发消息并读取回复 |
| test | 针对指定插件和版本创建测试会话，工具列表为空 |
| task | 按指定工作区和文件范围委派任务 |

桥接描述保存在 `~/.dsh/top-directive/codex-bridge.json`，包含每次启动生成的本机令牌。runId 与 DSH requestId 用于重试去重；结果包含实际回复、请求状态、提示词摘要和桌面选中状态。

## 开发

插件使用宿主的 systemPrompt、webServer、sessionController 和 workspaceRegistry 服务，无额外 npm 运行依赖。配置 `desktopBridge:false` 可停用会话桥。

```sh
node --test test/host.test.mjs
```

[使用指南](docs/USER_GUIDE.md) · [架构](docs/ARCHITECTURE.md) · [开发与构建](docs/DEVELOPMENT.md) · [验证记录](docs/VALIDATION.md) · [素材来源](THIRD_PARTY_NOTICES.md)

代码采用 [MIT 许可](LICENSE)。
