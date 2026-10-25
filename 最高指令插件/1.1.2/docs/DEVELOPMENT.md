# 开发与发布

源码目录为 `最高指令插件/1.1.2/`，要求 Node.js 20 或以上，无额外 npm 运行依赖。

## 测试与构建

```sh
node --test test/host.test.mjs
node scripts/build-release.mjs
```

TGZ 内容由 `package.json.files` 定义，包含运行文件、图标、Cordis patch、README、许可和文档。Release 提供 TGZ、`Install-DSH.ps1`、`SHA256SUMS.txt` 与 `release-manifest.json`；安装器和 TGZ 放在同一目录使用。

会话桥测试可通过 [Codex 端插件](https://github.com/ccl4-56-23-5/Codex-Plugins) 执行，读取模型回复、提示词摘要和桌面选中状态。测试结果记录在 [VALIDATION.md](VALIDATION.md)。

## 市场条目

发布新版本时，同步更新 awesome-dsh-plugin 中自己的 YAML 条目，核对源码子目录、图标和 Release TGZ 地址。旧链接仍被市场使用时，应先完成条目更新再调整旧版本入口。
