# 开发与发布

当前源码位于DSH-Plugins的`最高指令插件/1.1.1/`。需要Node.js20或以上，无额外npm运行依赖。

TGZ由package.json.files定义：lib、cordis.patch.yml、README和LICENSE。发布安装TGZ、Install-DSH.ps1、SHA256SUMS.txt与release-manifest.json；安装器和TGZ应位于同一目录。

源码单元测试入口为`node --test test/host.test.mjs`，仅在需要验证实现且获授权时运行。真实模型验证应从配套[Codex-DSH插件](https://github.com/ccl4-56-23-5/Codex-Plugins)执行，读取实际回复、正文装配证据和桌面选中状态。

发布新版本时替换本项目版本目录与旧Release，重新核对哈希并更新入口，保留其他DSH插件。Git提交历史用于追溯。本机来源与依赖包按sources/<工程>/<版本>归档，outputs仅保存平铺文本记录。
