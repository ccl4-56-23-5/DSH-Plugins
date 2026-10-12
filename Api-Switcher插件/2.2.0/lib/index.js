import { homedir } from 'node:os'
import { join } from 'node:path'
import { createController } from './core.js'
import { buildRoute } from './http.js'
export const name = 'dsh-api-switcher'
export const inject = ['llm', 'settings', 'agentDefaultModel']
export function apply(ctx, config = {}) {
  const file = config.stateFile || join(process.env.DSH_HOME || join(homedir(), '.dsh'), 'api-switcher', 'state.json')
  const controller = createController(ctx, file)
  let ready
  const initialize = () => ready ||= controller.initialize().catch(error => { ready = null; throw error })
  initialize().catch(() => {})
  ctx.inject(['webServer'], webCtx => webCtx.effect(() => {
    const route = buildRoute(controller), handle = route.handler
    route.handler = async (req, res) => {
      try { await initialize() }
      catch {
        res.statusCode = 503
        res.setHeader('content-type','application/json; charset=utf-8')
        res.setHeader('cache-control','no-store')
        res.end(JSON.stringify({ok:false,error:{code:'INITIALIZATION_FAILED',message:'模型配置初始化未完成，请刷新重试并核对本地状态文件。'}}))
        return
      }
      return handle(req, res)
    }
    return webCtx.webServer.register(route)
  }))
}
