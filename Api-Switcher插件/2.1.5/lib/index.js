import { homedir } from 'node:os'
import { join } from 'node:path'
import { createController } from './core.js'
import { buildRoute } from './http.js'
export const name = 'dsh-api-switcher'
export const inject = ['llm', 'settings', 'agentDefaultModel']
export function apply(ctx, config = {}) {
  const file = config.stateFile || join(process.env.DSH_HOME || join(homedir(), '.dsh'), 'api-switcher', 'state.json')
  const controller = createController(ctx, file)
  const ready = controller.initialize()
  // Let the local route report initialization failures without unhandled rejections.
  ready.catch(() => {})
  ctx.inject(['webServer'], webCtx => webCtx.effect(() => {
    const route = buildRoute(controller), handle = route.handler
    route.handler = async (req, res) => { await ready.catch(() => {}); return handle(req, res) }
    return webCtx.webServer.register(route)
  }))
}
