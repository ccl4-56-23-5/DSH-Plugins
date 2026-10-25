# 第三方与素材来源

## DSH 插槽测试快照

`test/fixtures/slot-core.js` 来自 `@deepseek-ai/dsh-client-ui-slots@0.2.0-rc.2`，用于离线测试注册、优先级和卸载。版权为 Copyright (c) 2026 DeepSeek，MIT 许可文本位于 `test/fixtures/LICENSE`。

源码：[deepseek-ai/deepseek-harness](https://github.com/deepseek-ai/deepseek-harness) 的 `packages/client/ui-slots`。DSH 服务、React 和 ReactDOM 在运行时由宿主提供。

## 图标与角色

蓝青色双箭头由本项目设计，角色基于提供的 [参考图片](https://tiebapic.baidu.com/forum/pic/item/e2d07432c895d1431cbe792035f082025baf0766.jpg)，经 imagegen 重绘并导出透明图标。生成信息和哈希见 [图标资产](docs/BRANDING.md)。

参考图片的原作者与许可尚未确认，第三方角色和商标权利归各自权利人，代码的 MIT 许可适用于本项目代码与原创文档。

## 模型目录与供应商标识

API 易目录来源于其 [公开注册表](https://docs.apiyi.com/model-registry.json)，快照日期记录在 `lib/assets/apiyi-catalog.json`。账户可用模型以供应商实际接口返回为准。

供应商图标在运行时从用户配置的网站获取，名称与标识归各自权利人所有。
