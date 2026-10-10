# 品牌资产

最高指令使用蓝青渐变的皇冠指令文档作为主符号，右下角为与Api-Switcher一致的“大肥鱼”角色。蓝发、蓝眼、白色褶边头饰、右侧蓝蝴蝶结、笑脸和两只小手沿用参考身份；保留明显可见的比例与透明背景，不添加衬底色块。

`assets/logo-master.png`为透明母版；`lib/assets/logo.png`为512×512设置面板logo；`lib/assets/icon.png`为256×256RGBA插件图标，低于256KiB，并通过package.json.icon声明。运行图片由同源`top-directive/api/brand`返回。

使用Codex内置imagegen，以Api-Switcher当前logo为角色与风格参考生成；导出只做Lanczos高质量尺寸缩放。完整生成提示、参考SHA-256和三份资产哈希见`assets/branding.json`。提示摘要：皇冠文档主符号，右下角同款“大肥鱼”，保持蓝发蓝眼、头饰、蝴蝶结、笑脸和双手，透明背景，无文字、外框或衬底。

角色来源沿用Api-Switcher用户提供的拟人形象；[第三方声明](../THIRD_PARTY_NOTICES.md)说明权利范围。
