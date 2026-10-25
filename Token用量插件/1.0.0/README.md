# 使用统计·大肥鱼定制版

<img src="lib/assets/logo.png" width="112" alt="使用统计 logo">

DSH 的 Token 用量看板。基于 [HaoyueQin/dsh-usage-statistics-panel](https://github.com/HaoyueQin/dsh-usage-statistics-panel) **0.3.2** 定制，当前版本 **1.0.0**。

## 看板

- 汇总卡片显示 Token 用量与缓存命中率。
- 52 周方块热力图展示活跃情况。
- 每日趋势使用按模型堆叠的柱状图，缓存命中率可在汇总和悬停明细中查看。
- 模型、供应商环形图支持排名、悬停联动和 Other 展开。
- 支持 7、14、30、90 天及自定义日期，提供刷新与重建入口。
- 左上角“使用统计”打开看板，“已结束轮次”显示完成的对话轮次。

![看板预览，使用示例数据](docs/images/custom-preview.jpg)

## 安装

从 [Release](https://github.com/ccl4-56-23-5/DSH-Plugins/releases/tag/token-usage-v1.0.0) 下载 Windows ZIP，解压，退出 DSH 后双击 `安装.cmd`。默认宿主目录为 `D:\DeepSeekHarness`，其他位置可运行：

```powershell
.\Install-DSH.ps1 -DshRoot 'D:\你的DSH目录'
```

也可通过 DSH 插件管理添加 Release TGZ。包名沿用 `dsh-usage-statistics-panel`，安装后替换原面板，继续使用已有统计数据、浏览器设置和侧栏入口。Windows 安装器在用户 DSH 目录的 `token-usage/deployment-backups/` 备份 profile 清单和锁文件。

运行依赖已编入产物，Node、pnpm、React 和 DSH 服务由宿主提供。适配目标与上游一致，为 DSH 0.1.7-rc.2。

## 统计口径

总 Token 为未缓存输入、输出、缓存读取、缓存写入四项之和；缓存命中率为 `缓存读 / (未缓存输入 + 缓存读 + 缓存写)`。请求数按调用开始标记统计，包含失败且没有用量的调用；已结束轮次按完成的轮次统计。

采集覆盖子代理，跳过分支继承前缀，通过持久化游标衔接实时采集与历史回扫。数据位于 `$DSH_HOME/storages/usage_history.json`。重建会重新扫描当前保留的会话日志；供应商缺失的用量无法精确补回，付款金额以供应商账单为准。

## 开发

运行 `node scripts/build-local.mjs` 进行类型检查、编译、图标导出和测试；运行 `node scripts/build-release.mjs` 生成 TGZ、Windows ZIP 与校验清单。

上游基线为 `657953bfe5567dd33299d1ca417058285071d433`，保留 MIT 版权声明。采集、存储和聚合算法沿用上游；本版调整界面、图标和轮次标签。

[统计设计](docs/design.md) · [验证记录](VALIDATION.md) · [来源与许可](THIRD_PARTY_NOTICES.md) · [English](README_EN.md)
