# 1.0.1图标补全验证

2026-10-12。

5个插件卡片均添加64px显示图标，内置原版256pxRGBA图片；Api-Switcher、DSH控制桥、最高指令、使用统计及仓库管理器各自图标的来源与SHA-256见assets/plugin-icons.json。未知插件或加载失败时提供默认图标。

源图与客户端内嵌数据逐一哈希一致；仓库完整检测与12项行为测试通过。真实DSH1.0.1页面回读5张卡片图片全部loaded=true，naturalWidth/naturalHeight均256，显示64×64；主logo512px加载成功。原有入口和功能保留。

安装器报告restart-required，但本轮客户端内容已热加载并验证。遵守用户要求未重启DSH；不据此宣称完成宿主重启验收。
