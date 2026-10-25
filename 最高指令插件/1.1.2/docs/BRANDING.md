# 图标与品牌资产

主符号为蓝青渐变的皇冠文档，右下角沿用 api-switcher 的蓝发鲸鱼娘，背景透明。

| 文件 | 用途 |
| --- | --- |
| `assets/logo-master.png` | 透明母版 |
| `lib/assets/logo.png` | 512 × 512，设置面板 |
| `lib/assets/icon.png` | 256 × 256 RGBA，插件图标，小于 256 KiB |

图片由 imagegen 生成，使用 Lanczos 缩放导出。插件图标通过 `package.json.icon` 声明，设置图片由同源 `top-directive/api/brand` 返回。

生成提示、参考文件与资产哈希见 `assets/branding.json`，角色来源见 [第三方声明](../THIRD_PARTY_NOTICES.md)。
