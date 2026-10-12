import { readFileSync } from 'node:fs'
export const apiyiCatalog = JSON.parse(readFileSync(new URL('./assets/apiyi-catalog.json', import.meta.url), 'utf8'))
export const mimoCatalog = JSON.parse(readFileSync(new URL('./assets/mimo-catalog.json', import.meta.url), 'utf8'))
export const limitFields = ['contextWindow', 'maxTokens']
export const validLimit = value => Number.isSafeInteger(value) && value > 0 && value <= 100000000
export function catalogFor(baseURL) {
  try {
    const url = new URL(baseURL)
    if (url.protocol !== 'https:' || url.port || url.username || url.password || url.search || url.hash) return
    if (url.hostname === 'api.xiaomimimo.com' && ['/v1', '/v1/', '/anthropic', '/anthropic/'].includes(url.pathname)) return mimoCatalog
    if (url.hostname === 'api.apiyi.com' && ['/', '/v1', '/v1/'].includes(url.pathname)) return apiyiCatalog
  } catch {}
}
export function normalizeDiscovered(models, baseURL) {
  if (!Array.isArray(models)) throw new Error('模型发现结果不是列表。')
  const known = catalogFor(baseURL)?.models || [], seen = new Set()
  return models.flatMap(model => {
    const id = model?.id?.trim?.()
    if (typeof id !== 'string' || !id || id.length > 200 || /[\u0000-\u001f\u007f]/.test(id) || seen.has(id)) return []
    seen.add(id)
    const entry = known.find(m => m.id === id)
    const declared = model.inputModalities ?? model.input ?? entry?.input
    const input = Array.isArray(declared) ? [...new Set(declared.filter(v => ['text', 'image'].includes(v)))] : undefined
    const result = { id, discoveryEndpoint: baseURL, name: typeof model.name === 'string' && model.name.trim() ? model.name.trim().slice(0,200) : entry?.name || id,
      ...(input?.length ? { input, inputEvidence: model.inputModalities || model.input ? 'discovery' : entry.inputEvidence } : { inputEvidence: 'unknown' }), limitModes: {contextWindow:'auto',maxTokens:'auto'}, limitEvidence: {} }
    // Accept only capacities declared by discovery or an exact endpoint+model catalog.
    // Never infer reseller capacity from a similarly named upstream model.
    for (const field of limitFields) {
      const n = validLimit(model[field]) ? model[field] : entry?.[field]
      if (validLimit(n)) { result[field] = n; result.limitEvidence[field] = validLimit(model[field]) ? 'discovery' : entry.limitEvidence?.[field] || 'catalog' }
    }
    if (result.maxTokens && result.contextWindow && result.maxTokens >= result.contextWindow) {
      delete result.maxTokens; delete result.limitEvidence.maxTokens
      result.capacityWarning = '目录输出上限不小于上下文窗口，未自动采用输出值，请核对。'
    }
    return [result]
  })
}
// Stored numbers without provenance are manual, including values edited in DSH.
export function limitMode(pref, model, field) {
  const mode = pref?.modelLimitModes?.[model?.id]?.[field]
  const auto = pref?.modelAutoLimits?.[model?.id]?.[field]
  if (model?.[field] !== undefined && (mode === 'default' || mode === 'auto' && model[field] !== auto)) return 'manual'
  return ['auto','manual','default'].includes(mode) ? mode : model?.[field] === undefined ? 'auto' : 'manual'
}
