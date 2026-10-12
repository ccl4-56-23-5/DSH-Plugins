# 鲸鱼娘插件仓库1.0.0

专门管理[ccl4-56-23-5/DSH-Plugins](https://github.com/ccl4-56-23-5/DSH-Plugins)的DSH插件。左上角侧栏“使用统计”下面点击“鲸鱼娘插件仓库”即可打开，也可从原生插件配置页进入。

支持插件搜索、已安装/可更新筛选、检查更新、安装、更新、启用和停用。显示本地与仓库版本、Release说明及最近操作。管理器自身也会进入发布列表，支持后续自更新；基础插件的停用交给DSH原生插件页处理。

## 安装

下载本目录或[Release](https://github.com/ccl4-56-23-5/DSH-Plugins/releases/tag/repo-manager-v1.0.0)中的TGZ。在DSH左侧“插件→添加插件”中选择本地TGZ，或粘贴Release中的TGZ下载链接。Windows ZIP内含相同TGZ与说明，无额外运行时依赖。如宿主提示需重启，保存当前工作后重启DSH。

## 更新机制

仅发现指定仓库的正式Release，兼容现有两种release-manifest.json格式；校验下载文件大小、清单SHA-256、GitHub资产摘要和包内名称/版本，再交给DSH官方pluginManager安装。不改写用户配置，不降级已有较新版本；更新前已停用的插件保持停用。采用单任务锁与幂等操作ID，失败和需重启状态独立显示。宿主重载期间未完成的操作标记为待核对，不自动重试。

首次进入和手动检查时访问GitHub。网络失败会显示原因和重试入口；已缓存的列表保留。不请求GitHub账号令牌，不发送会话内容。此版面向本机DSH桌面，不开放远程安装接口。安装缓存和操作记录位于DSH_HOME/repo-manager，缓存保留以维持本地包来源可用。

## 开发

Node22及以上，无第三方运行时依赖。`node --test test/manager.test.mjs`运行行为测试，`node scripts/build-release.mjs`生成确定性TGZ与哈希清单。客户端使用宿主React和原生sidebar.panellist/main插槽。

设计参考[dsh-market](https://github.com/dsh-market/dsh-market)的浏览、版本检查及官方桌面安装流程，代码独立实现。logo采用同款鲸鱼娘角色正面推购物车构图，透明背景。
