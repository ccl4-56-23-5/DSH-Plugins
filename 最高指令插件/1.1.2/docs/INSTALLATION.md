# Windows安装、升级与恢复

## 运行条件

已安装DSH桌面并初始化desktop profile。2026-10-03真实验收使用DSH0.2.0-rc.2；其他宿主版本需确认接口兼容性。默认安装目录为D:\DeepSeekHarness，用户配置位于%USERPROFILE%\.dsh；安装器支持-DshRoot指定其他目录。插件无需额外npm运行依赖。

从本版Release下载`dsh-top-directive-1.1.2.tgz`与`Install-DSH.ps1`，放在同一目录，先核对`SHA256SUMS.txt`。

可以通过DSH插件管理导入TGZ。使用附带安装器时，先结束正在运行的DSH任务并退出桌面，再在该目录运行：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\Install-DSH.ps1
# 自定义DSH路径：
powershell -NoProfile -ExecutionPolicy Bypass -File .\Install-DSH.ps1 -DshRoot 'E:\DeepSeekHarness'
```

安装器备份profile清单、锁文件和已有提示词，更新本地包依赖，移除旧`dsh-initial-prompt`条目并保留一份`dsh-top-directive`。已有`top-directive/config.json`继续使用。完成后重新打开DSH，在插件页编辑正文和开关。

## 校验、恢复与卸载

将下载文件的Get-FileHash -Algorithm SHA256结果与本版SHA256SUMS.txt比较。安装器打印备份目录；恢复前退出DSH，使用同一profile的清单与锁文件。通过DSH插件管理移除dsh-top-directive时，用户配置按需要保留。

Codex侧配套插件的安装和首次市场配置见[Codex-DSH安装指南](https://github.com/ccl4-56-23-5/Codex-Plugins/blob/main/docs/INSTALLATION.md)。
