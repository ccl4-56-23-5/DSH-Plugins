# 界面截图说明

这4张图用于介绍api-switcher2.1.3的操作，不包含个人供应商配置、密钥或真实聊天。

## 拍摄方式与范围

使用源码中的`lib/client.js`和`lib/assets/theme.css`，由`scripts/preview-docs.mjs`在本机浏览器渲染。设置页使用实际ProviderSettings组件，模型菜单使用实际ModelSeat组件。供截图使用的React18.3.1/ReactDOM18.3.1来自官方npm发行文件，缓存在被忽略的`.work/`，不进入插件TGZ或源码发行ZIP。

供应商、认证标记、当前模型、推理选项和启用范围为隔离的示例数据。API易模型目录读取随包公开目录，未请求供应商。API/DS字母图标为示例占位图；真实安装会按网站配置获取图标。预览服务器只监听127.0.0.1，测试连接入口拒绝模型请求，不读取DSH用户profile或凭据。

会话输入区及蓝色箭头周围的容器为文档示意，模型选择菜单为原组件。截图明确标注“演示截图·无真实API请求”，不作为DSH原生窗口、真实账号授权或付费模型响应的验收证据。

## 截图顺序

| 文件 | 内容 |
| --- | --- |
| [01-provider-settings.jpg](01-provider-settings.jpg) | 供应商信息、API协议和地址、密钥框、启用开关 |
| [02-model-management.jpg](02-model-management.jpg) | 在完整目录搜索gpt-5.4并查看部分模型启用状态 |
| [03-provider-groups.jpg](03-provider-groups.jpg) | API易展开，DeepSeek和DeepSeek Account收起，菜单位于发送按钮旁 |
| [04-model-search.jpg](04-model-search.jpg) | 用apiyi gpt从7个启用模型中筛选2个模型 |

截图保存浏览器返回的原始JPEG字节，未拼接、重绘或修改组件。截图路径由[根目录清单](../../screenshots.json)声明。[PROVENANCE.json](PROVENANCE.json)记录源组件和每张截图的SHA-256，便于核对出处。
