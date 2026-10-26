# 故事中控台 StoryDeck 0.3.0

世界书保存设定，插件保存每个对话的剧情状态，并决定本轮可以读取哪些条目。

## 安装与使用

从 [Release](https://github.com/ccl4-56-23-5/DSH-Plugins/releases/tag/storydeck-v0.3.0) 下载 Windows ZIP 或 TGZ，也可在鲸鱼娘插件仓库更新。

1. 打开 DSH 对话，点击右上角抓绳的鲸鱼娘。
2. 在“导入与导出”选择一个或多个 JSON 文件，也可粘贴 JSON。支持 RikkaHub 原生格式和 StoryDeck；修真示例可直接载入后导入。
3. 回到“启用世界书”，勾选多本书，展开每本书选择条目，点击“应用到当前对话”。
4. 检索预览查看当前对话能读取的资料；剧情状态查看、手动纠正或撤回事件。DSH 可以自动提交已发生的状态变化。

入口为右上角35px宽的灰蓝鲸鱼娘，双手抓绳；相对审核预览宽高各缩小为1/3，面积为1/9。以绳子顶部为支点轻摆，悬停、键盘聚焦和弹窗打开时暂停；系统开启减少动态效果时保持静止。弹窗支持 Escape 关闭、焦点返回和窄屏滚动，关闭时放弃未应用的勾选。

## 对话范围

书库在本机共用；世界书勾选、条目勾选、剧情状态与事件记录按真实 sessionId 独立保存。新对话默认全部关闭；清空并应用后保持关闭。取消书后再启用保留该对话自己的剧情状态。最多同时20本。

条目开关是当前对话的覆盖设置，不修改原始 enabled。其他对话可以选择不同的书和条目。同名条目通过 bookId 区分。工具按调用所属对话读取数据。

## RikkaHub 格式

依据官方 [Assistant.kt](https://github.com/rikkahub/rikkahub/blob/master/app/src/main/java/me/rerere/rikkahub/data/model/Assistant.kt) 与 [ExportSerializer.kt](https://github.com/rikkahub/rikkahub/blob/master/app/src/main/java/me/rerere/rikkahub/data/export/ExportSerializer.kt) 实现原生格式：

```json
{"version":1,"type":"lorebook","data":{"id":"uuid","name":"世界书","enabled":true,"entries":[{"type":"regex","name":"城镇","content":"城镇设定","enabled":true,"priority":10,"keywords":["城镇"],"constantActive":false,"useRegex":false,"caseSensitive":false}]}}
```

也接受不带 ExportData 包装的原生 Lorebook。原始字段、ID、未知扩展字段及顺序全部保留，导出还原原始格式。首次勾选书时条目遵循原始 enabled，可在当前对话覆盖。

常驻、关键词、大小写、正则与条目优先级参与筛选；同一本书内优先级高的先返回，多书按选择顺序分配共享预算。关键词/正则匹配 storydeck_context 本次 query，提示模型带上当前场景关键词。

position、role、injectDepth 和 scanDepth 随原格式保存与导出；检索使用本轮 query。正则按 Node.js 语法运行，并设独立 Worker 时限，Kotlin/JVM 特有表达式会返回错误。当前支持 RikkaHub 原生格式与 StoryDeck 格式。

## 状态与事件

StoryDeck 格式包含 id/title/fields/initialState/entries，参考[示例](lib/example.js)。字段支持 enum/string/number/boolean/tags。条目 visibility 为 public/known/author；when.all/any 支持 eq/ne/in/contains/gte/lte，不执行脚本。

检索先检查当前对话书与条目开关、作者隐藏、角色认知、状态条件，再做触发/相关度排序和共享预算。author 永不返回，known 需要剧情 knownIds，always 不绕过门槛。默认最多8条、12000字符，工具最多20条；正文整体装入。单书4MiB、3000条，单条正文16000字符。检索使用关键词、正则和状态条件。

storydeck_commit 需要最新 revision、expectedStateRevision、certainty=confirmed、summary、source、patch；多书启用时必须指定已启用的 bookId。模型可自动提交，插件验证结构、字段、版本和幂等性；事件真实性仍由模型报告。可依次撤回最新事件。已用于剧情的世界书不可覆盖，修改请另存新ID。

## 本地数据

继续使用 `$DSH_HOME/storydeck/worldbook-v1.json`，默认 `~/.dsh/storydeck/worldbook-v1.json`。内部升级 schema2，保留旧书和事件；旧版各会话关联迁移为独立剧情，原先共享的剧情也不再共享状态。首次成功写入前保留字节相同的 .schema1-backup。损坏数据不重置；写锁、原子替换和版本校验保护并发更新。

条目筛选作用于本轮工具返回；作者界面可查看完整书库。聊天中的既有内容仍保留在对话上下文中。

## 验证

运行 `node --test test/worldbook.test.mjs test/rikka.test.mjs`。测试环境与结果见 [验证记录](VALIDATION.md)。
