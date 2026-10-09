# api-switcher

<p align="center"><img src="lib/assets/logo.png" width="192" alt="api-switcher透明logo"></p>

DSH供应商与模型管理插件。在输入框发送按钮旁的模型菜单中，按供应商选择和搜索模型；在统一设置页管理API地址、协议、密钥、供应商图标和模型启用范围。

**当前版本：2.1.1。**本版更新透明logo，将鲸鱼娘按原宽、高各4倍的目标放大，补齐用户、开发与发布文档。内部包名保持`dsh-api-switcher`，升级继续使用原有配置。

## 功能

- 在DSH原生模型切换位置显示分组菜单，支持供应商与模型分别启用。
- 同时搜索模型名称、模型ID、供应商名称或ID；支持多关键词、全角字符、忽略大小写与常见分隔符。
- 搜索结果显示计数、无匹配提示、一键清空；上下键进入结果，回车选择，Esc关闭。
- 配置OpenAI Chat Completions、OpenAI Responses和Anthropic Messages来源，支持模型目录同步及手动编辑。
- API易地址、协议与公开文本模型目录已预配置；首次使用自行填写Key。
- 保存供应商后自动获取网站图标，密钥由DSH凭据服务保存。
- 设置弹窗覆盖完整窗口；打开右侧预览面板也可正常操作。

## 快速安装

1. 从本版本的`dist/`目录下载`dsh-api-switcher-2.1.1-Windows.zip`。
2. 解压到本地文件夹，结束DSH中正在运行的任务，双击`安装.cmd`。
3. 安装器校验SHA-256，备份配置，离线安装插件并重启DSH。
4. 在发送按钮旁点击模型名称，选择“管理供应商”；也可进入“插件管理→api-switcher→设置”。

默认支持DSH安装目录`D:\DeepSeekHarness`、用户配置目录`%USERPROFILE%\.dsh`和`desktop`profile。其他安装位置、手动导入、升级、卸载与回滚见[安装说明](docs/INSTALLATION.md)。

安装包包含全部插件运行文件。插件无额外npm运行依赖，使用DSH自带的Node、pnpm、模型和凭据服务；源码与Windows安装包是不同的交付物。

## 配置API易

在设置左侧选择“API易”，核对以下字段，填写自己的Key，勾选需要的模型，开启供应商并保存。

| 字段 | 默认值 |
| --- | --- |
| 来源ID | `apiyi` |
| API地址 | `https://api.apiyi.com/v1` |
| 协议 | OpenAI Chat Completions |
| 网站 | `https://api.apiyi.com` |
| Key | 首次安装留空，由用户填写 |

首次预配置供应商停用，预选`gpt-5.4-mini`；升级保留用户已经保存的开关、模型选择与Key。随包目录为2026-10-09核对的233个Chat Completions文本模型，实际账户权限以供应商返回结果为准。详见[API易配置](docs/APIYI.md)与[API易官方快速开始](https://docs.apiyi.com/getting-started)。

## 文档

| 文档 | 内容 |
| --- | --- |
| [使用指南](docs/USER_GUIDE.md) | 供应商、模型、搜索、默认选择、连接测试 |
| [安装说明](docs/INSTALLATION.md) | 安装、升级、自定义路径、卸载、回滚 |
| [API易配置](docs/APIYI.md) | 地址、协议、目录同步与常见问题 |
| [架构与接口](docs/ARCHITECTURE.md) | 模块职责、DSH服务、HTTP契约与数据 |
| [开发与发布](docs/DEVELOPMENT.md) | 测试、构建、校验、GitHub结构 |
| [故障排查](docs/TROUBLESHOOTING.md) | 界面、认证、目录、冲突、安装问题 |
| [验证记录](docs/VALIDATION.md) | 自动测试、安装与桌面验证的范围 |
| [品牌资产](docs/BRANDING.md) | 透明logo、尺寸、生成记录与来源 |
| [安全说明](SECURITY.md) | 凭据、网络边界与问题报告 |
| [贡献指南](CONTRIBUTING.md) | 改动范围、验证与提交要求 |
| [更新记录](CHANGELOG.md) | 版本变更 |
| [第三方声明](THIRD_PARTY_NOTICES.md) | 测试快照与品牌素材来源 |

## 源码与验证

要求Node.js20或以上。无须安装依赖即可运行：

```sh
node scripts/run-tests.mjs
node scripts/check-project.mjs
node scripts/build-release.mjs
```

构建输出在当前源码的`dist/`目录。Windows另外运行`Build-Release.ps1`会生成一键安装ZIP；详见开发文档。

本版验证覆盖本地自动测试、文件校验、安装与桌面显示。保存配置、切换模型和本地搜索不发送对话；“同步模型”访问供应商目录，“测试连接”在确认后发送真实模型请求，可能计费。发布过程未委派DSH模型，也未运行付费对话测试；本地验证不代表所有供应商与模型都已实测。

## 许可

项目代码与原创文档采用[MIT](LICENSE)。第三方测试快照保留原许可；供应商商标与用户提供的角色形象来源见[第三方声明](THIRD_PARTY_NOTICES.md)。本项目不隶属于DeepSeek或API易。
