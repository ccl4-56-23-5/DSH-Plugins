import { fault, safeMessage } from './core.js'
import { readFileSync } from 'node:fs'
export const ROUTE_PREFIX = '/api-switcher/api'
export function trusted(req) {
  const host = req.headers?.host
  if (typeof host !== 'string' || /[\s/@\\]/.test(host)) return false
  let parsed
  try { parsed = new URL(`http://${host}`) } catch { return false }
  const name = parsed.hostname
  if (!(name === 'localhost' || name === '[::1]' || /^127(?:\.\d{1,3}){3}$/.test(name) && name.split('.').every(n => +n <= 255))) return false
  if (req.headers?.['sec-fetch-site'] === 'cross-site') return false
  const origin = req.headers?.origin
  if (origin !== undefined) { try { if (new URL(origin).host !== parsed.host) return false } catch { return false } }
  return true
}
async function readBody(req) {
  if (!(req.headers?.['content-type'] || '').toLowerCase().startsWith('application/json')) throw fault('写入请求必须使用application/json。', 415, 'JSON_REQUIRED')
  const chunks = []; let length = 0
  for await (const chunk of req) {
    const bytes = Buffer.from(chunk); length += bytes.length
    if (length > 512 * 1024) throw fault('请求超过512KiB。', 413, 'BODY_TOO_LARGE')
    chunks.push(bytes)
  }
  let result
  try { result = JSON.parse(Buffer.concat(chunks).toString('utf8')) } catch { throw fault('请求体必须是有效JSON。') }
  if (!result || typeof result !== 'object' || Array.isArray(result)) throw fault('请求体必须是JSON对象。')
  return result
}
function send(res, value, status = 200) {
  res.statusCode = status
  res.setHeader('content-type', 'application/json; charset=utf-8')
  res.setHeader('cache-control', 'no-store')
  res.setHeader('x-content-type-options', 'nosniff')
  res.end(JSON.stringify(value))
}
export function buildRoute(controller) {
  return { kind: 'prefix', path: ROUTE_PREFIX, handler: async (req, res) => {
    try {
      if (!trusted(req)) throw fault('仅接受本机同源请求。', 403, 'FORBIDDEN')
      const path = new URL(req.url || '/', 'http://localhost').pathname
      const leaf = path.slice(ROUTE_PREFIX.length + 1)
      if (leaf === 'styles' && req.method === 'GET') {
        res.statusCode = 200; res.setHeader('content-type', 'text/css; charset=utf-8'); res.setHeader('cache-control', 'no-cache'); res.setHeader('x-content-type-options', 'nosniff'); res.end(readFileSync(new URL('./assets/theme.css', import.meta.url))); return
      }
      if (req.method === 'GET' && (leaf === 'brand' || leaf.startsWith('logo/'))) {
        const image = leaf === 'brand' ? {bytes:readFileSync(new URL('./assets/logo.png', import.meta.url)),type:'image/png'} : await controller.logo({provider:decodeURIComponent(leaf.slice(5))})
        res.statusCode = 200
        res.setHeader('content-type', image.type)
        res.setHeader('cache-control', 'private, max-age=3600')
        res.setHeader('x-content-type-options', 'nosniff')
        res.setHeader('content-security-policy', "default-src 'none'; sandbox")
        res.end(image.bytes); return
      }
      let value
      if (leaf === 'state' && req.method === 'GET') value = await controller.state()
      else if (req.method === 'POST' && Object.hasOwn({ sources: 1, activate: 1, test: 1, discover: 1, favorite: 1, preferences: 1, logo: 1, delete: 1 }, leaf)) {
        const body = await readBody(req)
        const method = { sources: 'save', delete: 'remove' }[leaf] || leaf
        value = await controller[method](body)
      } else throw fault('未知接口或请求方法。', 404, 'NOT_FOUND')
      send(res, { ok: true, value })
    } catch (error) { send(res, { ok: false, error: { code: error.code || 'INTERNAL_ERROR', message: error.status ? safeMessage(error) : '操作失败，请检查DSH配置或稍后重试。' } }, error.status || 500) }
  } }
}
