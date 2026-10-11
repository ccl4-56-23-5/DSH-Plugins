import { readFileSync } from 'node:fs'

export const apiyiCatalog = JSON.parse(readFileSync(new URL('./assets/apiyi-catalog.json', import.meta.url), 'utf8'))
export const mimoCatalog = JSON.parse(readFileSync(new URL('./assets/mimo-catalog.json', import.meta.url), 'utf8'))
export function catalogFor(baseURL) {
  try {
    const url = new URL(baseURL)
    if (url.protocol !== 'https:' || url.port || url.username || url.password) return
    if (url.hostname === 'api.xiaomimimo.com' && ['/v1', '/v1/', '/anthropic', '/anthropic/'].includes(url.pathname)) return mimoCatalog
    if (url.hostname === 'api.apiyi.com' && ['/', '/v1', '/v1/'].includes(url.pathname)) return apiyiCatalog
  } catch {}
}
export function normalizeDiscovered(models, baseURL) {
  const known = catalogFor(baseURL)?.models || [], seen = new Set()
  return models.flatMap(model => {
    if (!model || typeof model.id !== 'string' || !model.id.trim() || seen.has(model.id)) return []
    seen.add(model.id)
    const entry = known.find(m => m.id === model.id)
    const declared = model.inputModalities ?? model.input ?? entry?.input
    const input = Array.isArray(declared) ? [...new Set(declared.filter(v => ['text', 'image'].includes(v)))] : undefined
    return [{ ...model, ...(input?.length ? { input, inputEvidence: model.inputModalities || model.input ? 'discovery' : entry.inputEvidence } : { input: undefined, inputEvidence: 'unknown' }) }]
  })
}
