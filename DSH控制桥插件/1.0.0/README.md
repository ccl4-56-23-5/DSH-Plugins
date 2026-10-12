# DSH Control Bridge 1.0.0

配合Codex端`codex-dsh-control`，通过宿主API与DOM控件树操作DSH，不依赖截图或坐标识别，也不依赖最高指令插件。

专用工具覆盖会话、消息队列、模型、工作区、插件和设置；`host_catalog`动态发现当前宿主注册的Remote接口，`host_describe`读取参数契约，`host_invoke`通过宿主校验器调用。终端、任务、交互审批等扩展能力取决于宿主当前接口。流式接口可读取有时间和条数限制的快照。自定义插件页面可通过DOM快照的nodeId点击、填写、选择、滚动，键盘事件仅为浏览器合成事件。

安装：在DSH插件管理中选择本地TGZ，或运行Windows包中的`Install-DSH.ps1`。Codex侧另行安装配套插件，然后重新连接MCP。先调用`dsh_status`选择在线clientId。

连接描述保存在`~/.dsh/control-bridge/connection.json`，含本机鉴权令牌，不得上传。操作回执保存在同目录`operations.json`；修改操作以operationId持久化去重。超时或进程中断后读取原编号回执和实际状态，不使用新编号盲目重试。回执可能保留模型回复与页面内容，应按本机私有数据处理。

设置更新使用revision防止并发覆盖，读取采用宿主脱敏视图。模型选择会同时更新宿主默认模型。DOM节点已失效或语义改变时拒绝操作。客户端回执证明网页执行了动作；仍需读回所需状态。会话`accepted`不代表模型完成，应检查实际回复、turn/end及桌面选中状态。

能力边界：DSH未运行时桥不可用；原生操作系统文件对话框、画布内部控件、浏览器要求可信手势的功能不在DOM通道覆盖范围。接口发现不代表每个宿主扩展均已实测。普通用户授权规则仍适用；开发测试不自动委派DSH开发。

Logo：透明背景，右下角为与Api-Switcher一致的大肥鱼角色。母版及SHA-256记录见`assets/branding.json`，插件图标256pxRGBA，设置页logo512px。
