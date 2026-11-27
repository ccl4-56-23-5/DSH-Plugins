# 图标与品牌资产

图标以蓝青色 S 形双箭头表示切换功能，右下角为蓝发鲸鱼娘角色，背景透明。设置页和插件管理器共用这套图形。

| 文件 | 用途 |
| --- | --- |
| `assets/logo-master.png` | 高分辨率透明母版 |
| `lib/assets/logo.png` | 512 × 512，设置页 |
| `lib/assets/icon.png` | 256 × 256 RGBA，插件管理图标，小于 256 KiB |

资产由 imagegen 基于既有图标和角色参考生成，再按目标尺寸缩放导出。生成日期、参考文件和 SHA-256 见 `assets/branding.json`，素材来源见 [第三方声明](../THIRD_PARTY_NOTICES.md)。
