# 截图来源

四张图片使用 api-switcher 2.1.3 的前端组件和示例配置，由 `scripts/preview-docs.mjs` 在本机浏览器生成。设置页为 ProviderSettings，模型菜单为 ModelSeat；外围输入区为预览容器。

供应商、认证状态、模型选择和字母图标均为示例。预览使用 React/ReactDOM 18.3.1 的官方 npm 发行文件，缓存在本机 `.work/`。

| 文件 | 内容 |
| --- | --- |
| [01-provider-settings.jpg](01-provider-settings.jpg) | 供应商协议、地址、密钥框与启用开关 |
| [02-model-management.jpg](02-model-management.jpg) | 模型搜索与启用范围 |
| [03-provider-groups.jpg](03-provider-groups.jpg) | 按供应商分组的会话模型菜单 |
| [04-model-search.jpg](04-model-search.jpg) | 供应商和模型多关键词搜索 |

显示顺序由 [screenshots.json](../../screenshots.json) 指定，组件和图片哈希见 [PROVENANCE.json](PROVENANCE.json)。
