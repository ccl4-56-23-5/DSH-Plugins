# 小米MiMo配置

选择“小米MiMo”模板，填写密钥并启用模型。基础地址为`https://api.xiaomimimo.com/v1`，协议为OpenAI Chat Completions。

2.1.5为mimo-v2.6-flash、mimo-v2.6-pro和mimo-v2.6-pro-ultraspeed声明文字与图片输入，并迁移旧版模板的错误text声明。图片可由DSH附件服务转换为Base64发送。[官方图片说明](https://mimo.mi.com/docs/en-US/quick-start/usage-guide/multimodal-understanding/image-understanding)。

模型编辑器默认使用自动能力，也可以手动勾选图片。同步更新自动能力，保留手动设置、名称和启用范围。密钥留空时使用公开目录，不执行收费请求；文字连接测试不能替代图片验收。[迁移与核对范围](CAPABILITIES.md)。
