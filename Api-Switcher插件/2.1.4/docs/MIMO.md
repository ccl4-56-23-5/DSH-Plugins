# 小米MiMo配置

2.1.4修复模型编辑器未选择推理等级时保存失败的问题，并提供小米MiMo模板。先配置模型、后填写密钥可以正常保存。

| 字段 | 值 |
| --- | --- |
| 供应商ID | `mimo` |
| 名称 | 小米MiMo |
| API地址 | `https://api.xiaomimimo.com/v1` |
| 协议 | OpenAI Chat Completions |
| 网站 | `https://platform.xiaomimimo.com` |
| 默认勾选 | `mimo-v2.6-flash` |

在“添加供应商”选择“小米MiMo”模板，核对信息，开启供应商并保存。模板包含3个2.6系列对话模型，只预选Flash；未填写密钥时同步会载入随包公开目录。填写自己的MiMo密钥并保存后，可同步账户目录。模型管理中可调整勾选范围和模型能力。

本版修复前，模型编辑器的空推理等级数组会被转换为`reasoningEfforts: {}`，DSH拒绝这项配置。现在空数组表示恢复宿主默认能力，配置中省略该字段；已配置的其他兼容参数保留。

MiMo的API域名首页返回404，图标使用开放平台的公开favicon。自动获取图标不会发送API密钥；图片logo外层保持透明，文字占位图才使用底色。

密钥留空时不会发起对话或连接测试，也无法实际调用MiMo。填写密钥后的响应、计费和工具调用效果需要另行验证。

模型ID和基础地址于2026-10-10核对[小米官方模型目录](https://mimo.mi.com/docs/en-US/api/model/list-models)。接口和认证方式见[小米官方OpenAI兼容接口](https://mimo.mi.com/docs/en-US/api/chat/openai-api)。
