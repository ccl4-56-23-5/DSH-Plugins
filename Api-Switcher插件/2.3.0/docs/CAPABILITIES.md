# 模型能力与容量

模型发现沿用DSH适配器：它可能使用宿主内置目录或访问供应商/models接口，并非每次都访问网络。Switcher接收contextWindow、maxTokens和inputModalities/input；已有模型同步会更新自动字段，缺失字段不会抹掉已有证据。名称、启用范围和每个手工字段独立保留。

## 容量来源

1. 接口或宿主目录明确提供的容量。
2. 精确匹配地址和模型ID的内置已核实规格，补齐缺失字段。
3. 仍未知则不写入容量，让DSH使用自己的目录或默认值；界面标注待核对。

MiMo官方Flash、Pro、Pro-UltraSpeed：contextWindow=1000000，maxTokens=131072。上下文采用1M的保守十进制值；最大输出来自API明确数值。核对日期2026-10-11。

- [官方模型规格](https://mimo.mi.com/docs/zh-CN/quick-start/summary/model)
- [Chat Completions参数](https://mimo.mi.com/docs/en-US/api/chat/openai-api)
- [模型列表API](https://mimo.mi.com/docs/en-US/api/model/list-models)

API易及自定义中转地址不继承同名原厂模型容量。其既有图片目录保持原有证据，容量与图片输入分别配置。

## 设置方式

每个Token字段分别选择自动获取、手动设置或使用DSH默认值。手动设置受保护，升级不会覆盖；使用DSH默认值会移除本插件覆盖并保持该选择。需要重新自动获取时选择自动并同步。模型详情中另列DSH当前生效值，读取resolveModelInfo的context.contextWindow和defaultMaxTokens，不把模型列表当作完整规格。

maxTokens在DSH适配器中也会成为默认请求输出预算，包含供应商计算的推理Token；可以单独手工调低。最大输出必须小于上下文窗口。未知线路的容量、真实限流、推理参数和账户权限需要通过供应商资料或实测确认，

## 迁移与保护

只对本插件管理、精确匹配的官方模型补齐自动缺失容量。已有数值没有来源记录时视为用户设置；用户在DSH中直接修改自动值后，Switcher识别为手动，不覆盖。供应商密钥、兼容性、headers、超时、其他插件与当前会话由原有宿主管理。

配置落盘失败会尝试回滚对应供应商和凭据；检测到外部并发编辑时停止回滚并明确报告部分保存，避免覆盖外部改动。修改API域名需重新填写目标密钥；改变地址的发现请求不会附带原供应商的自定义请求头。

## 宿主与服务边界

聊天压缩、重试与超时由 DSH 和相关插件处理。排查中断时，可分别检查压缩错误、供应商限流、超时与输出预算。连接测试只有收到文字且正常stop结束才通过，截断、错误、取消和无终止事件均不算成功。
