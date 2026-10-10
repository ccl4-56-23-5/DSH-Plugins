# 安装、升级与回滚

## 环境

已在Windows桌面DSH、其0.2.0-rc.2服务包和Node24.21.0上完成验证。源码要求Node≥20。其他DSH版本、Windows路径和profile需要按本说明核对；macOS/Linux安装未验证，Windows安装器不支持它们。

Windows安装包包括TGZ、安装器、逐文件校验脚本、文档、logo与SHA256清单；不包含DSH程序、用户凭据或聊天数据。DSH须已经安装，且目标profile已经初始化。

## 一键安装

1. 下载对应版本的Windows ZIP和`SHA256SUMS.txt`，核对ZIP的SHA-256。
2. 解压全部文件到本地目录，保留TGZ、安装器和清单在同一文件夹。
3. 结束DSH中正在运行的请求或任务，运行`安装.cmd`。
4. 安装器退出并重启DSH后，在插件管理确认显示`api-switcher`、版本`2.1.3`；打开模型菜单和设置确认新logo。

```powershell
Get-FileHash -LiteralPath .\dsh-api-switcher-2.1.3-Windows.zip -Algorithm SHA256
```

校验值只校验文件完整性；应从可信仓库下载程序和清单。

## 自定义位置

在解压目录运行以下命令，将路径替换为实际安装位置：

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\Install-DSH.ps1 `
  -DshRoot 'E:\Apps\DeepSeekHarness' `
  -DshHome "$env:USERPROFILE\.dsh" `
  -Profile desktop -CloseDsh -RestartDsh
```

只接受字母、数字、下划线和短横线组成的profile名称。`-Package`可指定TGZ路径，但安装器仍要求同目录清单中存在对应版本的TGZ校验行。未提供`-CloseDsh`且DSH运行中时会停止安装；`-RestartDsh`控制安装后重启。

安装器使用DSH目录中的Node和pnpm，执行离线安装并禁用npm生命周期脚本。只关闭路径与目标DSH程序一致的进程。它保留其他已声明插件，并在结束时恢复原pnpm工作区策略的原始字节。

## 手动导入

可在DSH插件管理中导入`dsh-api-switcher-2.1.3.tgz`。这是插件运行包，不是完整源码。使用DSH管理器安装时，备份、重启和依赖策略由管理器行为决定；本项目Windows安装器的验证记录不自动适用于该操作。

## 升级与备份

同样运行新版本安装包即可升级。内部包名保持不变；API易首次预配置只执行一次，不重置既有Key、默认模型、模型勾选和供应商开关。

安装器在`%USERPROFILE%\.dsh\api-switcher\deployment-backups\<时间戳>`备份profile的`package.json`、lockfile、Cordis配置与工作区策略，以及当时的插件元数据。它记录凭据文件和最高优先级提示词配置的哈希，安装后检查一致性，但不复制这些敏感文件进发行包。

若离线pnpm缓存缺少原profile已有的依赖，安装可能失败。安装器会尝试恢复原profile并给出备份位置；先检查错误，不要移除原锁文件或清空缓存来绕过问题。

## 回滚

2.1.3与2.1.0使用相同数据格式。通常结束DSH任务后，运行旧版完整Windows安装包即可回滚，继续保留当前供应商设置和凭据。

只有profile或插件元数据损坏时才使用备份恢复：退出DSH，先备份当前配置，再按需恢复备份中的profile文件及`api-switcher-state.json`为原`api-switcher\state.json`，随后运行对应旧版安装包。恢复会回到备份时的配置；不要把凭据文件或最高优先级提示词用旧副本覆盖。跨数据格式版本的回滚需要另行核对迁移兼容性。

## 卸载

在DSH插件管理中移除`api-switcher`并按提示重启。卸载插件保留供应商配置和Key，因为它们可能被DSH其他功能或旧会话使用。若需彻底移除，先切换默认来源，再通过DSH设置与凭据管理分别删除不再使用的数据；不要直接删除整个profile。
