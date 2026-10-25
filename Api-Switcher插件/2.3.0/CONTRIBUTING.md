# 贡献指南

1. 描述具体问题、复现步骤与期望行为，界面问题可附脱敏截图。
2. 基于当前版本修改，保持包名 `dsh-api-switcher` 和已有配置格式兼容。
3. 运行 `node scripts/run-tests.mjs` 和 `node scripts/check-project.mjs`。请求、凭据、并发、网络或插槽变化应附相应行为验证。
4. 运行 `node scripts/build-release.mjs` 检查打包；Windows 发行使用 `Build-Release.ps1`。
5. 界面改动在 DSH 中检查，供应商请求测试记录协议、模型与结果；收费测试需事先获得授权。
6. 提交前去除密钥、profile、聊天记录、运行日志和部署备份，第三方代码与素材注明来源和许可。

代码版本使用语义化版本：兼容修复为 patch，兼容新增功能为 minor，不兼容变更为 major。PR 说明写清问题、修改后行为和验证结果。
