# DSH 插件

为 DSH 桌面提供模型管理、全局提示词、用量统计、外部控制和世界书功能。

| 插件 | 版本 | 功能 | 安装包 |
| --- | --- | --- | --- |
| [api-switcher](Api-Switcher插件/2.3.0/README.md) | 2.3.0 | 管理 API 供应商，在会话中搜索和切换模型，配置思考参数 | [下载](https://github.com/ccl4-56-23-5/DSH-Plugins/releases/tag/api-switcher-v2.3.0) |
| [最高指令](最高指令插件/1.1.2/README.md) | 1.1.2 | 编辑全局系统提示词，保存原文，随时启停 | [下载](https://github.com/ccl4-56-23-5/DSH-Plugins/releases/tag/top-directive-v1.1.2) |
| [使用统计·大肥鱼定制版](Token用量插件/1.0.0/README.md) | 1.0.0 | 查看 Token 用量、活跃热力图、模型与供应商占比 | [下载](https://github.com/ccl4-56-23-5/DSH-Plugins/releases/tag/token-usage-v1.0.0) |
| [DSH Control Bridge](DSH控制桥插件/1.0.0/README.md) | 1.0.0 | 通过宿主接口和 DOM 控件树管理 DSH | [下载](https://github.com/ccl4-56-23-5/DSH-Plugins/releases/tag/dsh-control-v1.0.0) |
| [鲸鱼娘插件仓库](仓库插件管理器/1.1.2/README.md) | 1.1.2 | 在 DSH 内安装、更新和管理本仓库插件 | [下载](https://github.com/ccl4-56-23-5/DSH-Plugins/releases/tag/repo-manager-v1.1.2) |
| [故事中控台 StoryDeck](故事中控台/0.2.0/README.md) | 0.2.0 | 导入世界书，按对话选择条目，记录剧情状态和事件 | [下载](https://github.com/ccl4-56-23-5/DSH-Plugins/releases/tag/storydeck-v0.2.0) |

## 安装

在插件对应的 Release 下载预构建 TGZ，通过 DSH 插件管理添加。Windows 用户也可下载 ZIP，解压后按包内说明安装；最高指令提供单独的 PowerShell 安装器。安装器需要关闭 DSH 时，先完成正在运行的任务。

各插件的 README 包含使用方法、配置位置和开发入口。Release 附带 SHA-256 清单。

## 源码与配套工具

每个插件按“项目/版本”存放，版本目录包含独立项目源码。默认分支提供当前版本，历史变更可通过 Git 提交查看。

DSH Control Bridge 的 Codex 端配套插件位于 [Codex-Plugins](https://github.com/ccl4-56-23-5/Codex-Plugins)。

代码采用 [MIT 许可](LICENSE)。使用统计基于 [HaoyueQin/dsh-usage-statistics-panel](https://github.com/HaoyueQin/dsh-usage-statistics-panel) 定制，依赖与素材来源见各项目的第三方声明。
