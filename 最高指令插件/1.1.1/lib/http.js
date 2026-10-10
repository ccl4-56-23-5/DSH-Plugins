import { timingSafeEqual } from 'node:crypto'
import { fault } from './state.js'

export function isTrusted(req) {
  const host = req.headers?.host
  if (typeof host !== 'string' || /[\s/@\\]/.test(host)) return false
  let url
  try { url = new URL(`http://${host}`) } catch { return false }
  const parts = url.hostname.split('.')
  const loopback = url.hostname === 'localhost' || url.hostname === '[::1]'
    || (parts.length === 4 && parts[0] === '127' && parts.every(p => /^\d{1,3}$/.test(p) && +p <= 255))
  if (!loopback || req.headers?.['sec-fetch-site'] === 'cross-site') return false
  const origin = req.headers?.origin
  if (origin === undefined) return true
  try { return new URL(origin).host === url.host } catch { return false }
}
export function authorized(req, token) {
  const supplied = req.headers?.['x-codex-dsh-token']
  if (typeof supplied !== 'string' || !token) return false
  const a = Buffer.from(supplied), b = Buffer.from(token)
  return a.length === b.length && timingSafeEqual(a, b)
}
export function writeJson(res, value, status = 200) {
  res.statusCode = status
  res.setHeader('content-type', 'application/json; charset=utf-8')
  res.setHeader('cache-control', 'no-store')
  res.setHeader('x-content-type-options', 'nosniff')
  res.end(JSON.stringify(value))
}
export async function readBody(req) {
  const chunks = []; let bytes = 0
  for await (const chunk of req) {
    const buffer = Buffer.from(chunk); bytes += buffer.length
    if (bytes > 64 * 1024) throw fault('请求体超过64KiB。', 413)
    chunks.push(buffer)
  }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}') }
  catch { throw fault('请求体必须是有效JSON。') }
}
