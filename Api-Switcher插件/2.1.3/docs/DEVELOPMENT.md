# 开发与发布

## 本地开发

Node≥20，ES模块，无额外npm库。以当前版本源码目录为工作目录：

```sh
node scripts/run-tests.mjs
node scripts/check-project.mjs
node scripts/build-release.mjs
```

测试使用假的DSH服务及离线插槽快照，不调用供应商。`check-project.mjs`检查版本一致性、图标规格、文档本地链接与明显密钥格式。构建器按`package.json.files`白名单生成确定性TGZ，并生成文件哈希与发行清单；不自动安装或调用模型。

## Windows发行

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\Build-Release.ps1
```

脚本优先使用PATH中的Node，缺少时使用`-DshRoot`指定DSH自带Node。也可传`-NodeExe`和`-OutputDir`。构建结果在源码`dist/`或指定项目目录，包含TGZ、一键安装文件、完整文档、512px logo、Windows ZIP和SHA256清单；ZIP不包含它自己，外部清单包含ZIP哈希。

```powershell
node .\Verify-Package.mjs .\dist\dsh-api-switcher-2.1.3.tgz '<解包后的package目录>'
```

同一校验脚本也可检查实际安装目录。不要把源码目录直接当作任意第三方打包工具的安装结果，因为打包工具可能规范化`package.json`。

## 源码结构

源码包含`lib/`、`locale/`、`test/`、`scripts/`、`docs/`、`assets/`、manifest和Windows安装/构建入口。`assets/logo-master.png`保留透明母版；运行时只使用`lib/assets/icon.png`与`logo.png`。`.work/`仅存本机验收，永不发布。

## GitHub目录约定

按照用户要求，以以下层级保存完整最新版本。版本目录本身是完整可构建Node项目，避免只有源码片段或缺失安装器：

```text
DSH-Plugins/
  Api-Switcher插件/
    README.md              # 插件索引及最新版本入口
    2.1.3/
      README.md
      package.json
      lib/
      locale/
      docs/
      test/
      scripts/
      assets/
      dist/                # 发布用TGZ、Windows ZIP、清单
      Install-DSH.ps1
      Build-Release.ps1
      Verify-Package.mjs
      安装.cmd
      CHANGELOG.md
      CONTRIBUTING.md
      SECURITY.md
      THIRD_PARTY_NOTICES.md
      LICENSE
```

源项目忽略生成的`dist/`，GitHub发行快照有意纳入经校验的四个发行文件；下一版本替换本项目版本目录，仅保留最新版源码与安装包；保留其他插件，历史变更通过Git提交追溯。仓库级`.github/workflows/ci.yml`对发布版本运行离线测试、项目检查和TGZ构建。可另外创建`api-switcher-v2.1.3`标签与GitHub Release，但标签不是安装包。

## 发布流程

1. 更新manifest、后端版本、安装器与校验器版本；补充更新记录。
2. 完成测试、项目检查、构建、TGZ解包及逐文件校验。
3. 检查Windows ZIP全部文件及SHA256清单；在目标DSH完成安装与界面验证。
4. 将验收结论更新到`docs/VALIDATION.md`，避免暴露本机路径、默认模型选择、Key或配置副本；重新构建最终包。
5. 按发布白名单导出到GitHub目录，扫描实际Key和常见凭据格式，保留源文件哈希清单。
6. 使用明确的发行提交信息，上传发行文件，核对远程目录和文件字节。

不要上传本机`install-result.json`、完整状态接口输出、部署备份或日志。公共验证记录只包含版本、数量、布尔结果、环境概要与发行文件哈希。

## 文档界面预览与截图

运行node scripts/preview-docs.mjs，按控制台地址打开本机页面；用?view=settings查看真实设置组件，?view=picker查看真实模型菜单。首次运行下载官方npm发行的React18.3.1与ReactDOM18.3.1到被忽略的.work/docs-preview/vendor/，只用于文档预览，不进入安装包。记录下载来源和哈希。

服务器只监听127.0.0.1，配置使用隔离示例，连接测试明确拒绝请求，不读取DSH用户profile或凭据。截图保留浏览器原始字节，在图和说明中标注演示范围；不要把示意输入容器当作原生DSH窗口。

在package.json旁维护screenshots.json，声明1至8张版本目录内的相对路径；不得以/开头或包含..。更新图片后重新生成docs/screenshots/PROVENANCE.json中的组件与图片哈希，运行项目检查并重新构建。

## awesome-dsh-plugin收录

依据[官方贡献指南](https://github.com/awesome-dsh-plugin/awesome-dsh-plugin/blob/main/contributing.md)，仓库添加dsh-plugin主题。条目指向本插件版本子目录，以owner/repo#api-switcher为name、model为category，描述仅列实际功能；tarball固定到对应Release标签，不混用latest/download与带版本号文件名。提交仅增加自己的data/plugins/条目，不手改对方生成的README。创建不足1天的仓库需等待年龄检查通过；收录还需维护者审阅，提交PR不代表已收录。
