# 第三方与素材声明

## DSH插槽测试快照

`test/fixtures/slot-core.js`来自`@deepseek-ai/dsh-client-ui-slots@0.2.0-rc.2`的公开SlotCore实现，用于离线验证注册、优先级和卸载；不进入插件npm运行包。原版权为Copyright(c)2026 DeepSeek，采用MIT许可，完整文本保存在`test/fixtures/LICENSE`。

官方源码：[deepseek-ai/deepseek-harness](https://github.com/deepseek-ai/deepseek-harness)，对应`packages/client/ui-slots`。DSH运行服务由宿主提供，项目未重新打包宿主或React。

## logo与角色参考

切换符号为本项目A方案蓝青色S形双箭头。角色依据用户提供的网络DeepSeek拟人形象，经图像生成工具重绘并合成到透明logo中；用户给定参考链接为[百度图片原图](https://tiebapic.baidu.com/forum/pic/item/e2d07432c895d1431cbe792035f082025baf0766.jpg)。原画作者与原画许可未由该链接确认，原始参考JPG不收入发行包。

生成资产不包含白底，导出过程只做常规尺寸缩放。生成日期、要求、文件哈希见[品牌资产文档](docs/BRANDING.md)。代码MIT许可不声明转让第三方角色、商标或参考原画权利，也不构成原作者的商业授权。

## API易目录与供应商图标

API易预置目录根据其[公开模型注册表](https://docs.apiyi.com/model-registry.json)筛选文本Chat Completions模型；来源和核对时间保存在`lib/assets/apiyi-catalog.json`。目录不保证用户Key的模型权限或持续可用性。

供应商图标运行时从用户配置的网站获取，不随本仓库预置第三方图标文件。供应商名称、标识与模型名称归各自权利人所有。本项目与上述组织没有隶属关系。
