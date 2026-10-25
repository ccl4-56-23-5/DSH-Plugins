# DSH Control Bridge

通过 DSH 宿主 API 与 DOM 控件树操作桌面客户端，配合 Codex 端的 `codex-dsh-control` 使用。当前版本 **1.0.0**。

## 功能

- 管理会话、发送消息、读取回复和消息队列。
- 选择模型，管理工作区、插件和设置。
- 用 `host_catalog` 发现宿主 Remote 接口，`host_describe` 查看参数，`host_invoke` 调用接口。
- 通过 DOM 快照中的 nodeId 点击、填写、选择和滚动插件页面。
- 读取流式接口的限时快照，查询终端、任务等宿主扩展。

扩展接口由当前 DSH 版本提供。DOM 操作覆盖网页控件；原生文件对话框、画布内部控件和要求可信手势的操作需要其他通道。键盘事件使用浏览器合成事件。

## 安装与连接

1. 从 [Release](https://github.com/ccl4-56-23-5/DSH-Plugins/releases/tag/dsh-control-v1.0.0) 下载 TGZ，在 DSH 插件管理中添加；Windows 安装包也提供 `Install-DSH.ps1`。
2. 在 Codex 安装 [配套插件](https://github.com/ccl4-56-23-5/Codex-Plugins)，重新连接 MCP。
3. 保持 DSH 运行，调用 `dsh_status` 选择在线 clientId。

## 操作与回执

修改操作通过 operationId 去重，回执写入本机 `~/.dsh/control-bridge/operations.json`。超时后先查询原编号回执和目标状态，再决定下一步。发送消息后读取实际回复和 turn/end；需要显示会话时读取桌面选中状态。

设置更新携带 revision，防止覆盖其他客户端的修改。模型选择同时更新宿主默认模型。DOM 操作会检查节点是否仍有效。

## 本地文件

连接信息位于 `~/.dsh/control-bridge/connection.json`，包含本机鉴权令牌；操作回执可能包含回复和页面内容。这些文件保存在本机，分享诊断时应去除令牌与私人内容。

图标、母版与文件哈希见 `assets/branding.json`。测试结果见 [验证记录](VALIDATION.md)。
