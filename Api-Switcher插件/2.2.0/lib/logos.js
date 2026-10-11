import { lookup } from 'node:dns/promises'
import { request } from 'node:https'
import { isIP } from 'node:net'
import { createHash, randomUUID } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync, renameSync, unlinkSync } from 'node:fs'
import { join } from 'node:path'

const MAX_IMAGE = 256 * 1024
const MAX_PAGE = 2 * 1024 * 1024
// Clash/TUN Fake-IP DNS uses the benchmarking ranges for public hostnames.
// Permit DNS answers in those ranges while still rejecting literal URLs;
// HTTPS retains hostname/certificate verification and the socket is pinned.
const fakeDNSAddress = address => /^198\.(?:18|19)\./.test(address) || /^2001:2:/i.test(address)
export function privateAddress(address) {
  const a = address.toLowerCase().split('%')[0]
  if (a.includes(':')) return a === '::' || a === '::1' || /^f[cd]|^fe[89ab]|^ff/.test(a) || a.startsWith('::ffff:') && privateAddress(a.slice(7)) || /^::(?:ffff:)?[0-9a-f]{1,4}:[0-9a-f]{1,4}$/.test(a)
  const n = a.split('.').map(Number)
  return n.length !== 4 || n.some(v => !Number.isInteger(v) || v < 0 || v > 255) || n[0] === 0 || n[0] === 10 || n[0] === 127 || n[0] >= 224 || n[0] === 169 && n[1] === 254 || n[0] === 172 && n[1] >= 16 && n[1] <= 31 || n[0] === 192 && (n[1] === 168 || n[1] === 0) || n[0] === 100 && n[1] >= 64 && n[1] <= 127 || n[0] === 198 && [18, 19].includes(n[1])
}
export function publicLogoURL(value) {
  let url
  try { url = new URL(value) } catch { throw new Error('图标网址无效') }
  if (url.protocol !== 'https:' || url.username || url.password || url.port && url.port !== '443' || ['localhost', 'localhost.localdomain'].includes(url.hostname) || url.hostname.endsWith('.localhost') || isIP(url.hostname.replace(/^\[|\]$/g, '')) && (privateAddress(url.hostname.replace(/^\[|\]$/g, '')) || fakeDNSAddress(url.hostname.replace(/^\[|\]$/g, '')))) throw new Error('自动图标仅从公开HTTPS网站获取')
  return url
}
// Pin the validated DNS result to this HTTPS socket, including every redirect.
export async function fetchPublic(value, depth = 0) {
  const url = publicLogoURL(value)
  if (depth > 3) throw new Error('图标重定向过多')
  const addresses = await lookup(url.hostname, { all: true })
  if (!addresses.length || addresses.some(a => privateAddress(a.address) && !fakeDNSAddress(a.address))) throw new Error('图标地址不可指向本机或内网')
  const response = await new Promise((resolve, reject) => {
    const req = request(url, { method: 'GET', headers: { accept: 'image/*,text/html;q=0.8', 'user-agent': 'API-Port/2.0' }, lookup: (_host, opts, done) => done(null, opts?.all ? addresses : addresses[0].address, opts?.all ? undefined : addresses[0].family) }, res => {
      if ([301, 302, 303, 307, 308].includes(res.statusCode)) { res.resume(); resolve({ redirect: res.headers.location }); return }
      if (res.statusCode !== 200) { res.resume(); reject(new Error(`网站返回${res.statusCode}`)); return }
      const chunks = []; let size = 0
      const limit = /^text\/html\b/i.test(String(res.headers['content-type'] || '')) ? MAX_PAGE : MAX_IMAGE
      res.on('data', chunk => { size += chunk.length; if (size > limit) { req.destroy(new Error(limit === MAX_PAGE ? '网站页面超过2MiB' : '网站图标超过256KiB')); return }; chunks.push(chunk) })
      res.on('end', () => resolve({ bytes: Buffer.concat(chunks), type: String(res.headers['content-type'] || '').split(';')[0].toLowerCase() }))
      res.on('error', reject)
    })
    req.setTimeout(5000, () => req.destroy(new Error('图标网站响应超时')))
    req.on('error', reject); req.end()
  })
  if (response.redirect) return fetchPublic(new URL(response.redirect, url).href, depth + 1)
  return response
}
export function imageType(bytes) {
  if (bytes.length < 8 || bytes.length > MAX_IMAGE) throw new Error('图标大小无效')
  if (bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) return 'image/png'
  if (bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) return 'image/jpeg'
  if (bytes.subarray(0, 6).toString().match(/^GIF8[79]a$/)) return 'image/gif'
  if (bytes.subarray(0, 4).toString() === 'RIFF' && bytes.subarray(8, 12).toString() === 'WEBP') return 'image/webp'
  if (bytes.subarray(0, 4).equals(Buffer.from([0, 0, 1, 0]))) return 'image/x-icon'
  const text = bytes.toString('utf8')
  if (/<svg[\s>]/i.test(text) && !/<(?:script|foreignObject|iframe|image|use)\b|\bon\w+\s*=|<!DOCTYPE|<!ENTITY|(?:href\s*=\s*["']\s*(?:https?:|\/\/|data:|javascript:))/i.test(text)) return 'image/svg+xml'
  throw new Error('网站图标格式不受支持')
}
export function logoCandidates(html, site) {
  const result = []
  for (const match of html.matchAll(/<link\b[^>]*>/gi)) {
    const attrs = Object.fromEntries([...match[0].matchAll(/([\w-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g)].map(v => [v[1].toLowerCase(), v[2] ?? v[3] ?? v[4]]))
    if (/(?:^|\s)(?:icon|apple-touch-icon)(?:\s|$)/i.test(attrs.rel || '') && attrs.href) { try { result.push(publicLogoURL(new URL(attrs.href.replaceAll('&amp;', '&'), site).href).href) } catch {} }
  }
  for (const path of ['/favicon.ico', '/favicon.png', '/favicon.svg']) result.push(new URL(path, site).href)
  return [...new Set(result)].slice(0, 8)
}
export function providerWebsite(source) {
  if (source.website) return source.website
  if (source.id.startsWith('deepseek-')) return 'https://www.deepseek.com'
  if (!source.baseURL) return ''
  try {
    const url = new URL(source.baseURL)
    if (url.protocol !== 'https:') return ''
    if (url.hostname === 'api.xiaomimimo.com') return 'https://platform.xiaomimimo.com'
    return url.origin
  } catch { return '' }
}
export function createLogoStore(folder, fetcher = fetchPublic) {
  const running = new Map(), attempts = new Map()
  const identity = website => createHash('sha256').update(website).digest('hex')
  function cached(website) {
    if (!website) return undefined
    try {
      const record = JSON.parse(readFileSync(join(folder, `${identity(website)}.json`), 'utf8'))
      if (!existsSync(join(folder, `${record.hash}.img`))) return undefined
      return record
    } catch { return undefined }
  }
  async function refresh(website, force = false) {
    if (!website) return undefined
    publicLogoURL(website)
    if (!force && cached(website)) return cached(website)
    if (running.has(website)) return running.get(website)
    if (!force && Date.now() - (attempts.get(website) || 0) < 3600000) return undefined
    const job = (async () => {
      attempts.set(website, Date.now())
      // A missing/oversized homepage must not block an accessible favicon.
      let page
      try { page = await fetcher(website) } catch {}
      let bytes, type, from
      try { type = imageType(page.bytes); bytes = page.bytes; from = website } catch {}
      if (!bytes) for (const candidate of logoCandidates(page?.bytes.toString('utf8') || '', website)) {
        try { const image = await fetcher(candidate); type = imageType(image.bytes); bytes = image.bytes; from = candidate; break } catch {}
      }
      if (!bytes) throw new Error('未找到可用网站图标，已使用名称图标')
      mkdirSync(folder, {recursive:true})
      const hash = createHash('sha256').update(bytes).digest('hex'), record = {hash,type,from,website,updatedAt:new Date().toISOString()}
      writeFileSync(join(folder, `${hash}.img`), bytes)
      const temp = join(folder, `${randomUUID()}.tmp`)
      try { writeFileSync(temp, JSON.stringify(record)); renameSync(temp, join(folder, `${identity(website)}.json`)) } finally {try{unlinkSync(temp)}catch{}}
      return record
    })().finally(() => running.delete(website))
    running.set(website, job); return job
  }
  function read(website) {
    const record = cached(website)
    if (!record) return undefined
    return {bytes:readFileSync(join(folder, `${record.hash}.img`)),type:record.type,hash:record.hash}
  }
  return {cached,refresh,read}
}
