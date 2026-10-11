# API易配置

## 基础设置

API易的默认来源ID为`apiyi`，使用OpenAI Chat Completions协议和`https://api.apiyi.com/v1`。填写自己的Key，勾选要显示的模型，开启供应商并保存；不必把Key发送到聊天或写入源码。

这是按[官方快速开始](https://docs.apiyi.com/getting-started)于2026-10-09核对的地址规则：

| 插件协议 | 基础地址 | 注意 |
| --- | --- | --- |
| OpenAI Chat Completions | `https://api.apiyi.com/v1` | 适配器拼接`/chat/completions` |
| Anthropic Messages | `https://api.apiyi.com` | 适配器拼接`/v1/messages` |

不要填写完整`/chat/completions`端点，不要为Anthropic地址重复添加`/v1`。去掉末尾斜杠。想同时使用不同协议时，可添加独立来源ID，例如`apiyi-claude`，分别配置模型和Key。本插件还支持OpenAI Responses，但某个模型是否支持该协议应核对供应商对应模型说明。

## 首次安装与升级

首次预配置不会创建可用Key，供应商默认关闭，预选`gpt-5.4-mini`作为用户可自行启用的轻量文本模型。已有`apiyi`来源不会被覆盖，已经初始化的升级也不会重新预配置。

## 模型目录

随包目录来自[API易公开模型注册表](https://docs.apiyi.com/model-registry.json)，保留2026-10-09核对的233个支持Chat Completions的文本模型。原始目录来源和时间保存在`lib/assets/apiyi-catalog.json`；该快照不是实时自动更新目录。

保存Key后可通过“同步模型”查询账户可用目录；也可手动添加供应商文档确认的模型ID。公开目录、账户权限、模型是否临时可用、接口支持和参数限制是不同事项，不能只因在列表中出现就认为请求一定成功。

## 网站图标

网站为`https://api.apiyi.com`，已知官方图标地址是`https://static.apiyi.com/apiyi-logo.png`。插件从网站图标链接获取并缓存，不附带API Key。无法加载时可刷新，检查网络后重试，或者继续使用名称图标。

## 建议操作顺序

1. 核对地址与协议，填写Key，保存。
2. 同步目录或手动添加准确模型ID。
3. 勾选少量常用模型，启用API易并保存。
4. 从会话模型菜单搜索`apiyi`并选择目标模型。
5. 需要验证真实响应时再确认“测试连接”；该步骤可能计费。

401/403通常需核对Key、权限或账户限制；404需核对基础地址、协议与模型ID。以供应商返回的具体错误为准，更多诊断见[故障排查](TROUBLESHOOTING.md)。
