# 2.3.0验证记录

2026-10-12。65项离线回归通过。涵盖既有配置/凭据回滚、冲突保护、图片与容量、搜索、HTTP，以及思考迁移、手动映射原值保留、默认行为、外部编辑、原生协议来源、跨协议保护。

已安装DSH真实PiAiAdapter的145种模型/协议/档位组合通过本机HTTP抓取验证：断言请求URL、thinking.type、reasoning_effort、reasoning.effort、output_config.effort。测试使用假密钥，故意返回400以结束请求；这是请求构造验证，不是供应商响应验证。脚本qa/host-reasoning-contract.cjs，参数为DSH安装根目录，经DSH可执行程序的ELECTRON_RUN_AS_NODE模式运行。结果qa/wire-result.json。

真实账户隔离会话使用同一计数问题，均无工具调用。MiMo三个模型和API易DeepSeek、Claude Sonnet4.6在off下没有reasoning块，开启后出现reasoning块，且均正常结束。API易GPT-5.4 Chat的off/high输出用量82/392，GPT-5.5为60/205；GPT-5.4 Responses low/high为166/433并返回reasoning块。用量是DSH接收到的总输出Token，不等于独立的思考Token统计。该对照支持参数生效判断，不声称每档用量必然递增或每个转发模型已实测。

Claude首次试验发现/v1/v1/messages错误，已修正为根地址，并以off/high真实回复复验。未知第三方组合不继承官方模型规则。没有当前账户的官方OpenAI/Anthropic线路及未测试的其他Claude型号，仅完成文档和宿主请求映射校验。

安装器曾登记候选2.3.0并完成42项安装文件比对，但DSH提示需重启，当前仍运行旧版；最终包的重启加载和桌面验收尚未完成。测试临时来源已移除，原供应商配置与默认选择恢复，凭据哈希一致。请使用最终Release安装包完成安装。旧版容量/压缩记录属于历史验证，不替代本版验证，也不代表长会话压缩验收。
