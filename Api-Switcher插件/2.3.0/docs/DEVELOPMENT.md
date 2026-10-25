# 开发与发布

## 测试与构建

在版本源码目录运行，要求 Node.js 20 或以上：

```sh
node scripts/run-tests.mjs
node scripts/check-project.mjs
node scripts/build-release.mjs
```

测试使用模拟 DSH 服务和离线插槽快照。项目检查覆盖版本、图标、文档链接和凭据格式，构建器按 `package.json.files` 生成 TGZ、文件哈希与发行清单。

Windows 安装包使用：

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\Build-Release.ps1
```

脚本支持 `-DshRoot`、`-NodeExe` 和 `-OutputDir`，默认输出到 `dist/`。核对解包文件或实际安装目录可运行：

```powershell
node .\Verify-Package.mjs .\dist\dsh-api-switcher-2.3.0.tgz '<解包后的package目录>'
```

## 源码结构

| 目录 | 内容 |
| --- | --- |
| `lib/`、`locale/` | 运行代码、样式、图标与语言文件 |
| `test/`、`scripts/` | 测试、检查、预览与构建工具 |
| `docs/` | 使用、安装、架构和验证文档 |
| `assets/` | 图标母版与来源记录 |
| `dist/` | 当前发行 TGZ、Windows ZIP 与清单 |

仓库中的版本目录是完整项目，插件索引位于上一级 README。Release 中的文档保存发布时快照，仓库文档可继续修订；运行文件与已发布包保持一致。

## 发布

1. 更新版本、安装器、校验器与更新记录。
2. 运行测试、项目检查与构建，解包检查文件及 SHA-256。
3. 在目标 DSH 检查安装、界面与相关行为，记录测试环境和结果。
4. 上传当前版本的源码与发行文件，核对远端下载。
5. 更新仓库入口和市场条目，检查源码路径、图标和 TGZ 链接。

仓库级检查入口为 `node scripts/verify-all.mjs`。文档修订后运行 `node scripts/check-repository.mjs --write-hashes` 更新源码校验清单。

## 截图

运行 `node scripts/preview-docs.mjs`，用 `?view=settings` 查看设置组件，`?view=picker` 查看模型菜单。首次运行将 React/ReactDOM 18.3.1 缓存到 `.work/docs-preview/vendor/`，预览使用本机示例配置。

在 `screenshots.json` 声明 1–8 张版本目录内的图片相对路径，并在 `docs/screenshots/PROVENANCE.json` 记录来源与哈希。

## 插件市场

条目格式见 [awesome-dsh-plugin 贡献指南](https://github.com/awesome-dsh-plugin/awesome-dsh-plugin/blob/main/contributing.md)。本插件使用 `model` 分类，条目指向版本子目录和对应 Release TGZ。

版本目录或发行地址变化时，同步提交市场 YAML 更新。市场仍使用旧入口时，先完成条目更新，再调整旧版本文件。提交使用基于上游 main 的分支，每个 PR 最多 3 个插件条目。
