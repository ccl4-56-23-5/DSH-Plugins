# 1.0.0验证记录

日期：2026-10-12。宿主提供的session-controller为0.2.0-rc.2，Windows桌面协议为dsh-app://app/。

已完成：

- 10项Node回归，覆盖并发去重、重启后回执、超时不重复执行、设置revision、跨站与令牌检查、客户端定向执行、参数拒绝、真实轮次与宿主注入上下文区分、流式缓冲上限和宿主拒绝传递。
- 配套Codex MCP SDK stdio连接，41个工具可发现；通过打包后的server.mjs执行真实DSH操作。
- 新建、改名、打开会话，置顶/取消置顶、归档；桌面选中状态已回读。
- 同一发送operationId重复调用，实际用户消息只有1条。MiMo返回“喵 CONTROL-BRIDGE-OK”，宿主turn/end为completed；保留用户原最高指令，验证会话禁用模型工具。桌面实际显示消息。
- DOM快照、点击、contenteditable填写及清空；插件设置页Logo已加载，原图512×512，实际显示96×96。
- 动态Remote参数契约、原生session/projections调用、workspace/follow快照。
- 原生终端create→retain/follow→write→输出读取→close；终端实际执行echo并输出CONTROL-TERMINAL-OK，随后关闭测试终端并归档测试会话。
- 256pxRGBA图标小于256KiB，512px设置页Logo与母版透明；记录逐文件SHA-256，TGZ包内源码与交付清单核对。

验证边界：动态接口可发现和调用不等于逐项实测所有扩展；审批问答、文件上传、第三方插件的每个控件与全部设置组合未逐一验收。DOM不覆盖原生OS对话框和画布内部；按键为合成事件。主程序退出时桥不可用。Codex安装后现有对话需重新连接MCP或新开对话。

没有为验证而关闭现有用户安全策略，未将开发任务委派给DSH。旧codex-dsh-desktop源码和安装目录未覆盖。
