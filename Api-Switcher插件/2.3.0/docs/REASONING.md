# 思考控制

仅匹配已列出的HTTPS地址、协议和精确模型ID。兼容OpenAI接口不等于支持全部OpenAI参数；同名转发模型不自动继承上游能力。供应商目录未声明且不在适配表中的模型显示未确认，不添加猜测档位。

|组合|界面|实际请求|
|---|---|---|
|MiMo官方三个V2.6模型，Chat|关闭/开启思考|thinking.type=disabled/enabled，不发送reasoning_effort|
|MiMo官方Responses|关闭/开启思考|reasoning.effort=none/high；high仅为开启标识|
|DeepSeek官方deepseek-flash/deepseek-v4-pro，Chat|off/low/high/max|thinking.type和reasoning_effort|
|API易deepseek-v4-flash-ga-260731，Chat|关闭/开启思考|thinking.type，不伪造独立深度|
|API易GPT-5.4/5.5，Chat/Responses|off/low/medium/high/xhigh|reasoning_effort或reasoning.effort；off映射none|
|API易/Anthropic原生Claude Sonnet4.6、Opus4.6/4.7/4.8|对应模型支持的档位|thinking.type=adaptive及output_config.effort；off关闭thinking|
|OpenAI官方已列出的GPT-5系列|对应模型支持的档位|按协议发送effort；具体集合见lib/reasoning.js|

MiMo没有真正的low/medium/high深度分档。Claude Opus4.6不提供xhigh，Sonnet4.6不提供max。API易Claude的原Chat来源继续保留，可在供应商连接设置点“添加原生思考来源”；新来源共用原凭据引用，不复制密钥内容，不覆盖已有同名来源。Anthropic协议地址使用根域名，SDK自动添加/v1/messages。

自动模式只管理插件写入的字段。已有手动参数继续原样保留；若用户在外部修改自动字段，后续升级转为手动保护。选择供应商默认会撤销仍未被修改的自动字段。未显式选择时，主会话请求采用已确认的供应商默认；明确选择off不会被覆盖。DSH自身的标题生成等独立调用不经过主会话请求钩子。

验证分三层：文档说明可用档位；真实宿主的隔离HTTP端点核对每个档位的请求体及URL；真实账户对照检查正常回复及思考块/用量变化。用量不会必然随档位单调增加；第三方服务是否永远遵守档位不能由一次请求保证。当前账户未配置的官方线路只有文档和请求映射验证，不标作真实账户实测。

来源：[MiMo Chat](https://mimo.mi.com/docs/en-US/api/chat/openai-api)、[MiMo Responses](https://mimo.mi.com/docs/en-US/api/chat/responses)、[DeepSeek](https://api-docs.deepseek.com/zh-cn/guides/thinking_mode/)、[API易GPT](https://docs.apiyi.com/api-capabilities/openai/native)、[API易Claude](https://docs.apiyi.com/api-capabilities/claude-effort-thinking)、[API易DeepSeek](https://docs.apiyi.com/api-capabilities/deepseek-v4-flash/chat-completions)、[OpenAI](https://developers.openai.com/api/docs/guides/reasoning)。核对日期2026-10-12。
