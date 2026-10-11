# 架构与接口

## 模块职责

| 模块 | 职责 |
| --- | --- |
| `lib/index.js` | Cordis插件入口、初始化与本机路由注册 |
| `lib/core.js` | 来源验证、DSH设置/凭据调用、启用范围、切换、发现与测试 |
| `lib/store.js` | 元数据读取、v1→v2投影与临时文件原子替换 |
| `lib/logos.js` | HTTPS网站图标发现、缓存、IP检查与SVG过滤 |
| `lib/http.js` | HTTP同源检查、请求限制、接口分派与响应脱敏 |
| `lib/client.js` | 宿主模块加载、React菜单、设置页、搜索与公共插槽注册 |
| `lib/assets/` | CSS、透明PNG与API易目录快照 |

插件通过DSH公共模型插槽覆盖原生菜单显示，保留原生会话目录和选择状态；卸载会移除插件插槽并恢复原显示。设置弹窗使用ReactDOM portal挂载到`document.body`，避开会话与右侧面板的局部叠层。

## 宿主服务

入口要求`llm`、`settings`、`agentDefaultModel`。路由随`webServer`服务挂载；凭据写入通过`credentials`，会话切换通过`sessionController`。前端使用宿主的React、ReactDOM、`dsh-client-ui-slots`和`dsh-client-ui-model-selection`。插件不携带这些运行依赖。

`settings`是连接/模型配置的唯一管理入口，`credentials`处理Key，`agentDefaultModel`保存默认选择。调用`activate`时先解析可用模型配置，更新指定会话，再更新默认模型；若默认保存失败，界面会提示核对，不将部分成功误报为完整成功。

## 数据与并发

元数据路径优先使用插件配置`stateFile`，否则使用`DSH_HOME`或用户主目录下`.dsh/api-switcher/state.json`。元数据版本为2，包括`managed`、`favorites`、`providers`和一次性`initialized`标记。`providers`按来源ID保存名称、网站、供应商开关和`enabledModels`白名单。

配置写操作串行化，并检查客户端`expectedRevision`。revision综合DSH设置版本、插件元数据、默认模型与凭据戳；Key本身不返回前端。保存新Key但DSH配置写入失败时，尝试恢复原本机Key；回滚失败会明确报错。元数据损坏时阻止写入并提示恢复备份。

## HTTP契约

前缀为`/api-switcher/api`。JSON成功响应为`{"ok":true,"value":...}`，失败为`{"ok":false,"error":{"code":"...","message":"..."}}`。所有POST要求`Content-Type: application/json`，请求上限512KiB。实际接口只供宿主同源客户端，不是远程管理API。

| 方法/路径 | 入参或输出 |
| --- | --- |
| `GET /state` | 版本、revision、默认选择、脱敏来源、协议、预设与目录 |
| `GET /styles` | CSS |
| `GET /brand` | 设置界面透明PNG |
| `GET /logo/<provider>` | 已缓存供应商图标 |
| `POST /sources` | `expectedRevision`、`source`、可选`apiKey`，保存来源 |
| `POST /preferences` | `expectedRevision`、`provider`、启用/名称/网站/模型白名单 |
| `POST /activate` | `expectedRevision`、`provider`、`model`、可选会话ID/推理等级 |
| `POST /discover` | `provider`可选、`api`、`baseURL`、可选新`apiKey` |
| `POST /test` | `provider`、`model`；发送真实模型请求 |
| `POST /logo` | `provider`、`refresh:true`，刷新图标 |
| `POST /favorite` | `expectedRevision`、`provider`、布尔`favorite` |
| `POST /delete` | `expectedRevision`、`provider`，删除自建来源 |

`source`包含`id`、`name`、`api`、`baseURL`、`models`，可附供应商开关与网站。模型包含`id`、可选名称、开关、正整数上下文/最大输出、`input:["text","image"]`子集及推理等级列表。保存前完整验证重复ID、数量、URL、模型字段与来源ID。

常见状态码：400配置或供应商错误，403跨站/非本机/不可删除来源，404路由或来源不存在，409并发冲突或来源被使用，413请求过大，415非JSON，503宿主服务不可写/不可用。内部错误不返回堆栈或原始凭据。

## 模型发现与请求

本地搜索与切换不生成回复。模型发现经DSH适配器访问目录，15秒超时、最多返回500项。连接测试45秒超时、256tokens上限，正常finish且非空文本才成功。图标刷新可以在读取状态后异步执行，其失败不阻止读取供应商。
