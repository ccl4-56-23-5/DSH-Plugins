import { createHash } from 'node:crypto'
import { readMetadata, writeMetadata } from './store.js'
import { createLogoStore, providerWebsite } from './logos.js'
import { dirname, join } from 'node:path'
import { readFileSync } from 'node:fs'

export const VERSION = '2.1.3'
export const apiyiCatalog = JSON.parse(readFileSync(new URL('./assets/apiyi-catalog.json', import.meta.url), 'utf8'))
export const protocols = [
  { id: 'openai-completions', name: 'OpenAI Chat Completions' },
  { id: 'openai-responses', name: 'OpenAI Responses' },
  { id: 'anthropic-messages', name: 'Anthropic Messages' }
]
export const presets = [
  { id: 'apiyi', name: 'API易', website: 'https://api.apiyi.com', baseURL: 'https://api.apiyi.com/v1', api: 'openai-completions', docs: 'https://docs.apiyi.com/getting-started' },
  { id: 'deepseek', name: 'DeepSeek', baseURL: 'https://api.deepseek.com', api: 'openai-completions' },
  { id: 'openai', name: 'OpenAI兼容接口', baseURL: 'https://api.openai.com/v1', api: 'openai-completions' },
  { id: 'anthropic', name: 'Anthropic', baseURL: 'https://api.anthropic.com', api: 'anthropic-messages' },
  { id: 'ollama', name: 'Ollama本机', baseURL: 'http://localhost:11434/v1', api: 'openai-completions' }
]
export const fault = (message, status = 400, code = 'INVALID_INPUT') => Object.assign(new Error(message), { status, code })
const clone = value => structuredClone(value)
const cleanText = (value, label, max = 200) => {
  if (typeof value !== 'string' || !value.trim() || value.length > max || /[\u0000-\u001f\u007f]/.test(value)) throw fault(`${label}无效。`)
  return value.trim()
}
function providerId(value) {
  if (typeof value !== 'string' || !/^[a-z][a-z0-9-]{0,63}$/.test(value) || ['constructor', 'prototype', '__proto__'].includes(value)) throw fault('来源ID必须以小写字母开头，只含小写字母、数字和短横线，最多64字符。')
  return value
}
function keyInput(value) {
  if (value === undefined || value === '') return undefined
  if (typeof value !== 'string' || !/^[\x21-\x7e]+$/.test(value) || value.length > 8192) throw fault('API密钥不可含空白、换行或非ASCII字符。')
  return value
}
export function validateEndpoint(value) {
  const text = cleanText(value, 'API地址', 2048)
  let url
  try { url = new URL(text) } catch { throw fault('API地址必须是完整URL。') }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) throw fault('API地址仅支持HTTP/HTTPS，不可含账号、密码、查询参数或片段。')
  return text.replace(/\/+$/, '')
}
export function validateSource(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw fault('缺少来源配置。')
  const id = providerId(input.id)
  const name = cleanText(input.name, '来源名称', 100)
  if (!protocols.some(p => p.id === input.api)) throw fault('请选择受支持的API协议。')
  const baseURL = validateEndpoint(input.baseURL)
  if (!Array.isArray(input.models) || input.models.length === 0 || input.models.length > 500) throw fault('请配置1至500个模型。')
  const seen = new Set()
  const models = input.models.map(model => {
    const id = cleanText(model?.id, '模型ID', 200)
    if (seen.has(id)) throw fault('模型ID不能重复。')
    seen.add(id)
    const result = { id }
    if (model.name !== undefined && model.name !== '') result.name = cleanText(model.name, '模型名称', 200)
    for (const field of ['contextWindow', 'maxTokens']) {
      if (model[field] === undefined || model[field] === null || model[field] === '') continue
      if (!Number.isSafeInteger(model[field]) || model[field] < 1 || model[field] > 100000000) throw fault('上下文和最大输出必须是正整数。')
      result[field] = model[field]
    }
    if (result.contextWindow && result.maxTokens && result.maxTokens > result.contextWindow) throw fault('最大输出不能大于上下文窗口。')
    if (model.input !== undefined) {
      if (!Array.isArray(model.input) || !model.input.length || model.input.some(v => !['text', 'image'].includes(v))) throw fault('模型输入类型仅支持text/image，至少选择一项。')
      result.input = [...new Set(model.input)]
    }
    if (model.reasoningEfforts !== undefined) {
      const allowed = ['off', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max']
      if (!Array.isArray(model.reasoningEfforts) || model.reasoningEfforts.some(v => !allowed.includes(v))) throw fault('推理强度仅支持off、minimal、low、medium、high、xhigh、max。')
      result.reasoningEfforts = Object.fromEntries([...new Set(model.reasoningEfforts)].map(v => [v, v === 'off' ? null : v]))
    }
    return result
  })
  return { id, name, api: input.api, baseURL, models }
}

export function safeMessage(error, secrets = []) {
  let text = String(error?.message || error || '未知错误')
  for (const secret of secrets) if (secret) text = text.split(secret).join('[已隐藏]')
  return text.replace(/\b(?:sk|sk-ant)-[a-zA-Z0-9_-]+/g, '[已隐藏]').replace(/Bearer\s+[^\s"']+/gi, 'Bearer [已隐藏]').slice(0, 360)
}

export function createController(ctx, stateFile, options = {}) {
  const logos = options.logos || createLogoStore(join(dirname(stateFile), 'icons'))
  let queue = Promise.resolve()
  const serialize = work => {
    const next = queue.then(work)
    queue = next.catch(() => {})
    return next
  }
  const views = () => ctx.settings.describe({ redactSecrets: false })
  const piView = () => {
    const all = views()
    const directory = ctx.llm.listConfigurableProviders()
    const candidate = directory.find(v => v.settingsPath?.[0] === 'providers' && all.some(n => n.ns === v.settingsNs))
    return all.find(v => v.ns === candidate?.settingsNs) || all.find(v => v.ns === 'llm-pi-ai')
  }
  async function credential(ref, stamps) {
    if (!ref) return { configured: false }
    try {
      const resolved = await ctx.get('credentials')?.resolve(ref)
      stamps.push([ref, resolved?.source, createHash('sha256').update(resolved?.value || '').digest('hex')])
      return { configured: !!resolved?.value, ref }
    }
    catch { return { configured: false, ref } }
  }
  async function state() {
    const descriptors = views()
    const pi = piView()
    const providers = pi?.value?.providers || {}
    const metadata = readMetadata(stateFile)
    const registered = ctx.llm.listProviders()
    const directory = ctx.llm.listConfigurableProviders()
    const ids = [...new Set([...registered.map(p => p.id), ...Object.keys(providers)])]
    const credentialStamps = []
    const sources = await Promise.all(ids.map(async id => {
      const preferences = Object.hasOwn(metadata.providers, id) ? metadata.providers[id] : {}
      const raw = Object.hasOwn(providers, id) ? providers[id] : undefined
      const entry = directory.find(v => v.provider === id)
      const descriptor = descriptors.find(v => v.ns === entry?.settingsNs)
      let data = descriptor?.value
      for (const part of entry?.settingsPath || []) data = data?.[part]
      const config = raw || data || {}
      let models = []
      let message
      try { models = await ctx.llm.listModels(id) } catch (error) { message = safeMessage(error) }
      const projected = models.map(model => {
        const configured = raw?.models?.find(m => m.id === model.id) || raw?.modelOverrides?.[model.id]
        const efforts = model.reasoning?.efforts?.map(v => String(v.id)) || (configured?.reasoningEfforts && typeof configured.reasoningEfforts === 'object' ? Object.keys(configured.reasoningEfforts) : undefined)
        return {
        id: model.id, name: model.name || model.id, enabled: !Array.isArray(preferences.enabledModels) || preferences.enabledModels.includes(model.id),
        ...(model.contextWindow ?? configured?.contextWindow) === undefined ? {} : { contextWindow: model.contextWindow ?? configured?.contextWindow },
        ...(model.maxTokens ?? configured?.maxTokens) === undefined ? {} : { maxTokens: model.maxTokens ?? configured?.maxTokens },
        ...(model.inputModalities ?? configured?.input) === undefined ? {} : { input: [...(model.inputModalities ?? configured?.input)] },
        ...efforts === undefined ? {} : { reasoningEfforts: efforts }
      } })
      if (!projected.length && Array.isArray(raw?.models)) projected.push(...raw.models.map(m => ({ id: m.id, name: m.name || m.id, enabled: !Array.isArray(preferences.enabledModels) || preferences.enabledModels.includes(m.id), input: m.input })))
      const info = registered.find(v => v.id === id)
      const source = {
        id, name: preferences.name || config.displayName || info?.name || id,
        baseURL: config.baseURL || '', api: config.api || 'native', models: projected,
        enabled: preferences.enabled !== false,
        website: preferences.website || '',
        credential: await credential(config.apiKeyEnv, credentialStamps),
        editable: !!raw && ctx.settings.writable === true,
        managed: metadata.managed.includes(id), favorite: metadata.favorites.includes(id),
        ...message ? { message } : {}
      }
      // Account routes use their own credential/session plane.
      if (id === 'deepseek-account') source.credential.configured = true
      if (id === 'deepseek-official' && !source.baseURL) source.baseURL = 'https://api.deepseek.com'
      source.website = providerWebsite(source)
      const icon = logos.cached(source.website)
      source.logo = icon ? `/api-switcher/api/logo/${encodeURIComponent(id)}?v=${icon.hash.slice(0, 12)}` : null
      source.logoFrom = icon?.from
      if (!icon && source.website) logos.refresh(source.website).catch(() => {})
      return source
    }))
    const active = clone(ctx.agentDefaultModel.currentSelection())
    const revision = createHash('sha256').update(JSON.stringify({ namespaces: descriptors.map(v => [v.ns, v.revision]), metadata, active, credentials: credentialStamps.sort((a, b) => a[0].localeCompare(b[0])) })).digest('hex')
    return { version: VERSION, revision, writable: ctx.settings.writable === true && !!pi, active, sources, protocols, presets,
      catalogs: { apiyi: apiyiCatalog },
      ...pi ? {} : { notice: '当前DSH未挂载第三方模型配置服务；现有来源仍可使用。' } }
  }
  async function checked(expectedRevision) {
    const snapshot = await state()
    if (typeof expectedRevision !== 'string' || expectedRevision !== snapshot.revision) throw fault('配置已被其他窗口修改，请刷新后重试。未保存的内容仍可保留。', 409, 'CONFLICT')
    return snapshot
  }
  function requireWritable() {
    const pi = piView()
    if (!ctx.settings.writable || !pi) throw fault('当前DSH的模型配置不可写。', 503, 'READ_ONLY')
    return pi
  }
  async function initialize() {
    return serialize(async () => {
      const metadata = readMetadata(stateFile)
      if (metadata.initialized) return
      const pi = piView()
      if (!pi || !ctx.settings.writable) return
      const snapshot = await state()
      if (!snapshot.sources.some(s => s.id === 'apiyi')) {
        await ctx.settings.mutate(pi.ns, [{op:'set',path:['providers','apiyi'],value:{displayName:'API易',baseURL:'https://api.apiyi.com/v1',api:'openai-completions',apiKeyEnv:'DSH_API_SWITCHER_APIYI_KEY',models:apiyiCatalog.models.map(m=>({id:m.id,name:m.name,input:m.input}))}}], pi.revision)
        metadata.managed.push('apiyi')
        metadata.providers.apiyi = {enabled:false,enabledModels:apiyiCatalog.models.filter(m=>m.id==='gpt-5.4-mini').map(m=>m.id),website:'https://api.apiyi.com'}
      }
      metadata.initialized = true
      writeMetadata(stateFile, metadata)
      logos.refresh('https://api.apiyi.com').catch(() => {})
    })
  }
  function preferenceFields(input, source) {
    const value = {}
    if (input.enabled !== undefined) { if (typeof input.enabled !== 'boolean') throw fault('供应商开关无效。'); value.enabled = input.enabled }
    if (input.name !== undefined) value.name = cleanText(input.name, '供应商名称', 100)
    if (input.website !== undefined) value.website = input.website === '' ? '' : validateEndpoint(input.website)
    if (input.enabledModels !== undefined) {
      if (!Array.isArray(input.enabledModels) || input.enabledModels.length > 500 || input.enabledModels.some(id => typeof id !== 'string' || !source.models.some(m => m.id === id))) throw fault('启用模型列表无效。')
      value.enabledModels = [...new Set(input.enabledModels)]
    }
    return value
  }
  async function save(input) {
    return serialize(async () => {
      const source = validateSource(input.source)
      const preference = preferenceFields({ ...input.source, enabledModels: input.source.models.some(m => m.enabled !== undefined) ? input.source.models.filter(m => m.enabled !== false).map(m => m.id) : undefined }, source)
      const key = keyInput(input.apiKey)
      const snapshot = await checked(input.expectedRevision)
      const pi = requireWritable()
      const stored = pi.value.providers || {}
      const existing = Object.hasOwn(stored, source.id) ? clone(stored[source.id]) : undefined
      if (!existing && snapshot.sources.some(v => v.id === source.id)) throw fault('该ID属于DSH原生来源，请换一个来源ID。')
      const ref = existing?.apiKeyEnv || `DSH_API_SWITCHER_${source.id.toUpperCase().replaceAll('-', '_')}_KEY`
      const profile = { ...existing, displayName: source.name, baseURL: source.baseURL, api: source.api,
        models: source.models.map(m => ({ ...existing?.models?.find(old => old.id === m.id), ...m })) }
      if (key || existing?.apiKeyEnv) profile.apiKeyEnv = ref
      const store = ctx.get('credentials')
      let previous, keyWritten = false
      if (key) {
        if (!store?.set) throw fault('DSH未提供可写凭据存储。', 503, 'NO_CREDENTIAL_STORE')
        // Capture the local override rather than the environment fallback where available.
        const info = await store.describe(ref)
        if (info?.writable === false) throw fault('该来源密钥来自启动环境，不能在面板中覆盖。请使用新的来源ID。', 400, 'ENV_CREDENTIAL')
        previous = info?.source === 'file' ? (await store.resolve(ref))?.value : undefined
        await store.set(ref, key)
        keyWritten = true
      }
      try {
        await ctx.settings.mutate(pi.ns, [{ op: 'set', path: ['providers', source.id], value: profile }], pi.revision)
      } catch (error) {
        if (keyWritten) {
          try {
            if ((await store.resolve(ref))?.value !== key) throw new Error('Credential was edited elsewhere')
            if (previous !== undefined) await store.set(ref, previous); else await store.unset(ref)
          }
          catch { throw fault('来源保存失败，密钥回滚失败；请在DSH模型设置中核对该来源凭据。', 500, 'ROLLBACK_FAILED') }
        }
        throw fault(safeMessage(error, [key, previous]), error?.name === 'SettingsConflictError' ? 409 : 400, error?.name === 'SettingsConflictError' ? 'CONFLICT' : 'SAVE_REJECTED')
      }
      const metadata = readMetadata(stateFile)
      if (!existing && !metadata.managed.includes(source.id)) metadata.managed.push(source.id)
      metadata.providers[source.id] = { ...(Object.hasOwn(metadata.providers, source.id) ? metadata.providers[source.id] : {}), ...preference }
      writeMetadata(stateFile, metadata)
      const site = preference.website || providerWebsite(source)
      if (site) logos.refresh(site).catch(() => {})
      return state()
    })
  }
  async function activate(input) {
    return serialize(async () => {
      const snapshot = await checked(input.expectedRevision)
      const provider = cleanText(input.provider, '来源ID', 100)
      const model = cleanText(input.model, '模型ID', 200)
      const source = snapshot.sources.find(s => s.id === provider)
      if (!source?.enabled || !source.models.some(m => m.id === model && m.enabled)) throw fault('请先在供应商设置中启用该供应商和模型。', 400, 'MODEL_DISABLED')
      if (!(await ctx.llm.listModels(provider)).some(v => v.id === model)) throw fault('来源或模型当前不可用，请刷新后重试。', 400, 'MODEL_UNAVAILABLE')
      const effort = input.reasoningEffort === undefined ? {} : { reasoningEffort: cleanText(input.reasoningEffort, '推理强度', 40) }
      const resolved = await ctx.llm.resolveCallConfig({ provider, model, ...effort })
      const selected = { provider: resolved.provider, model: resolved.model, ...resolved.reasoningEffort === undefined ? {} : { reasoningEffort: resolved.reasoningEffort } }
      let scope = 'default'
      if (input.sessionId !== undefined) {
        const sessionId = cleanText(input.sessionId, '会话ID', 160)
        const sessions = ctx.get('sessionController')
        if (!sessions?.selectModel) throw fault('会话控制服务尚未就绪。', 503, 'SESSION_UNAVAILABLE')
        await sessions.selectModel({ sessionId, ...selected })
        scope = 'session-and-default'
      }
      await ctx.agentDefaultModel.saveSelection(selected)
      const updated = await state()
      if (updated.active.provider !== selected.provider || updated.active.model !== selected.model) throw fault('会话来源已切换，但新会话默认来源尚未同步，请刷新核对。', 503, 'DEFAULT_NOT_SYNCED')
      return { state: updated, selected, scope }
    })
  }
  async function favorite(input) {
    return serialize(async () => {
      const snapshot = await checked(input.expectedRevision)
      if (!snapshot.sources.some(s => s.id === input.provider) || typeof input.favorite !== 'boolean') throw fault('收藏参数无效。')
      const metadata = readMetadata(stateFile)
      metadata.favorites = metadata.favorites.filter(id => id !== input.provider)
      if (input.favorite) metadata.favorites.push(input.provider)
      writeMetadata(stateFile, metadata)
      return state()
    })
  }
  async function preferences(input) {
    return serialize(async () => {
      const snapshot = await checked(input.expectedRevision)
      const source = snapshot.sources.find(s => s.id === input.provider)
      if (!source) throw fault('供应商不存在。', 404, 'NOT_FOUND')
      const fields = preferenceFields(input, source)
      const metadata = readMetadata(stateFile)
      metadata.providers[source.id] = { ...(Object.hasOwn(metadata.providers, source.id) ? metadata.providers[source.id] : {}), ...fields }
      writeMetadata(stateFile, metadata)
      const site = fields.website || source.website
      if (site) logos.refresh(site).catch(() => {})
      return state()
    })
  }
  async function logo(input) {
    const snapshot = await state()
    const source = snapshot.sources.find(s => s.id === input.provider)
    if (!source) throw fault('供应商不存在。', 404, 'NOT_FOUND')
    if (input.refresh) {
      try { await logos.refresh(source.website, true) } catch (error) { throw fault(safeMessage(error), 400, 'LOGO_UNAVAILABLE') }
      return state()
    }
    const image = logos.read(source.website)
    if (!image) throw fault('图标尚未获取。', 404, 'LOGO_UNAVAILABLE')
    return image
  }
  async function remove(input) {
    return serialize(async () => {
      const snapshot = await checked(input.expectedRevision)
      const provider = providerId(input.provider)
      const source = snapshot.sources.find(v => v.id === provider)
      if (!source?.managed) throw fault('仅可删除通过本插件创建的来源。', 403, 'NOT_MANAGED')
      if (snapshot.active.provider === provider) throw fault('请先切换默认来源，再删除。', 409, 'SOURCE_IN_USE')
      const pi = requireWritable()
      await ctx.settings.mutate(pi.ns, [{ op: 'unset', path: ['providers', provider] }], pi.revision)
      const metadata = readMetadata(stateFile)
      metadata.managed = metadata.managed.filter(id => id !== provider)
      metadata.favorites = metadata.favorites.filter(id => id !== provider)
      delete metadata.providers[provider]
      writeMetadata(stateFile, metadata)
      // Keep credentials for rollback and recorded sessions; never erase shared keys.
      return state()
    })
  }
  const testing = new Set()
  async function test(input) {
    const provider = cleanText(input.provider, '来源ID', 100)
    const model = cleanText(input.model, '模型ID', 200)
    if (testing.has(provider)) throw fault('该来源的连接测试正在进行。', 409, 'TEST_RUNNING')
    testing.add(provider)
    const started = Date.now()
    const secrets = []
    try {
      const snapshot = await state()
      const source = snapshot.sources.find(s => s.id === provider)
      if (!source?.models.some(m => m.id === model)) throw fault('来源或模型不可用。')
      if (source.credential.ref) secrets.push((await ctx.get('credentials')?.resolve(source.credential.ref))?.value)
      const info = await ctx.llm.resolveModelInfo?.(provider, model)
      const effort = info?.reasoning?.efforts?.some(v => v.id === 'off') ? { reasoningEffort: 'off' } : {}
      const options = { provider, model, ...effort, messages: [{ role: 'user', content: [{ type: 'text', text: 'Reply with exactly OK.' }] }], tools: [], maxTokens: 256, signal: AbortSignal.timeout(45000) }
      let reply = '', finish
      for await (const chunk of ctx.llm.stream(options)) {
        if (chunk.type === 'text-delta') reply = (reply + (chunk.delta ?? chunk.text ?? '')).slice(0, 300)
        if (chunk.type === 'finish') finish = chunk.reason
      }
      if (!finish || ['error', 'aborted'].includes(finish.kind)) throw fault(finish?.failure?.message || '模型流未正常完成。', 400, finish?.failure?.code || 'INCOMPLETE_STREAM')
      if (!reply.trim()) throw fault('请求完成，但模型没有返回可见文本。', 400, 'EMPTY_RESPONSE')
      return { success: true, latencyMs: Date.now() - started, reply: safeMessage(reply, secrets), message: '已收到该来源的实际模型回复。' }
    } catch (error) { return { success: false, latencyMs: Date.now() - started, message: safeMessage(error, secrets) } }
    finally { testing.delete(provider) }
  }
  async function discover(input) {
    if (!protocols.some(p => p.id === input.api)) throw fault('API协议无效。')
    const baseURL = validateEndpoint(input.baseURL)
    const apiKey = keyInput(input.apiKey)
    const pi = piView()
    if (!pi) throw fault('模型发现服务不可用。', 503, 'NO_DISCOVERY')
    const provider = input.provider ? providerId(input.provider) : undefined
    // A stored key is sent only to the endpoint and protocol it was saved for.
    if (provider && !apiKey) {
      const stored = pi.value.providers?.[provider]
      if (stored && (stored.baseURL?.replace(/\/+$/, '') !== baseURL || stored.api !== input.api)) throw fault('草稿地址或协议已改变，请重新输入该地址的密钥后获取模型。', 400, 'DRAFT_CREDENTIAL_REQUIRED')
    }
    try {
      const models = await ctx.llm.discoverModels(pi.ns, { ...(provider ? { provider } : {}), api: input.api, baseURL, ...(apiKey ? { apiKey } : {}) }, AbortSignal.timeout(15000))
      return { models: models.slice(0, 500), ...models.length ? {} : { message: '接口未返回模型；仍可手工输入模型ID。' } }
    } catch (error) { throw fault(safeMessage(error, [apiKey]), 400, 'DISCOVERY_FAILED') }
  }
  return { initialize, state, save, activate, favorite, preferences, logo, remove, test, discover }
}
