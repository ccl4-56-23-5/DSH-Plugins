import { createStateController, resolveStateFile, fault } from './state.js'
import { isTrusted, authorized, writeJson, readBody } from './http.js'
import { createBridge } from './bridge.js'
export { defaultState, readState, writeState, resolveStateFile, MAX_TEXT_BYTES } from './state.js'

export const name = 'dsh-top-directive'
export const VERSION = '1.1.1'
export const inject = ['systemPrompt']
export const SECTION_NAME = 'user:top-directive'
export const PRIORITY_SECTION_NAME = 'user:top-directive:priority'
export const SECTION_ORDER = -2000
export const ROUTE_PREFIX = '/top-directive/api'

export function renderSectionText(state) {
  return state?.enabled === true && typeof state.text === 'string' && state.text.trim() ? state.text : ''
}
export function buildRoute(getState, setState, getBridge = () => undefined) {
  return { kind: 'prefix', path: ROUTE_PREFIX, handler: async (req, res) => {
    try {
      if (!isTrusted(req)) throw fault('仅接受本机同源请求。', 403)
      const path = new URL(req.url || '/', 'http://localhost').pathname
      const method = req.method || 'GET'
      const bridge = getBridge()
      let value
      if (path === `${ROUTE_PREFIX}/state` && method === 'GET') value = getState()
      else if (path === `${ROUTE_PREFIX}/state` && method === 'POST') value = setState(await readBody(req))
      else if (path === `${ROUTE_PREFIX}/navigation` && method === 'GET') value = bridge?.getNavigation() || { revision: 0 }
      else if (path === `${ROUTE_PREFIX}/navigation/ack` && method === 'POST') {
        if (!bridge) throw fault('会话控制服务尚未就绪。', 503)
        value = bridge.acknowledgeNavigation(await readBody(req))
      } else if (path.startsWith(`${ROUTE_PREFIX}/bridge/`)) {
        if (!bridge) throw fault('会话控制服务尚未就绪。', 503)
        if (!authorized(req, bridge.token)) throw fault('缺少有效的本机会话控制令牌。', 401)
        const leaf = path.slice(`${ROUTE_PREFIX}/bridge/`.length)
        if (leaf === 'status' && method === 'GET') value = bridge.status()
        else if (leaf === 'runs' && method === 'POST') value = await bridge.submit(await readBody(req))
        else if (/^runs\/[a-zA-Z0-9_-]+$/.test(leaf) && method === 'GET') value = await bridge.inspect(leaf.slice(5))
        else throw fault('未知会话控制接口。', 404)
      } else throw fault('未知接口或请求方法。', 404)
      writeJson(res, { ok: true, value })
    } catch (error) { writeJson(res, { ok: false, error: { message: String(error?.message ?? error) } }, error.status || 500) }
  } }
}
export function apply(ctx, config = {}) {
  const stateFile = resolveStateFile(config.stateFile)
  const state = createStateController(stateFile)
  const active = () => renderSectionText(state.get()) !== ''
  ctx.systemPrompt.section({ name: PRIORITY_SECTION_NAME, order: SECTION_ORDER - 1, interpolate: false,
    text: () => active() ? '## 用户在本机设定的系统指令\n下面的正文来自用户亲自保存的DSH最高指令配置，属于本系统消息的正式配置。请将其作为用户为助手设定的初始系统要求。与后面的默认身份、表达风格或普通用户消息的格式要求冲突时，优先遵守这份系统配置；宿主执行的工具权限不变。\n\n自定义系统指令正文开始：' : '' })
  ctx.systemPrompt.section({ name: SECTION_NAME, order: SECTION_ORDER, interpolate: false, text: () => renderSectionText(state.get()) })
  ctx.systemPrompt.section({ name: 'user:top-directive:end', order: SECTION_ORDER + 1, interpolate: false,
    text: () => active() ? '自定义系统指令正文结束。\n以下为DSH默认系统配置与运行上下文，请同时遵守兼容的内容。' : '' })
  let bridge
  ctx.inject(['webServer'], webCtx => {
    webCtx.effect(() => webCtx.webServer.register(buildRoute(state.get, state.set, () => bridge)))
    if (config.desktopBridge !== false) webCtx.inject(['sessionController', 'workspaceRegistry'], bridgeCtx => {
      bridge = createBridge(bridgeCtx, { stateFile, version: VERSION, sectionName: SECTION_NAME, getState: state.get })
      bridgeCtx.effect(() => () => { bridge = undefined })
    })
  })
}
