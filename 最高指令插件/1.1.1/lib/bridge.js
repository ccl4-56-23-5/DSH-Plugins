import { join, dirname, resolve } from 'node:path'
import { homedir } from 'node:os'
import { randomBytes } from 'node:crypto'
import { atomicJson, readJson, digest, fault } from './state.js'
import { prepareRun, PROTOCOL_VERSION } from './contract.js'

const normalize = value => resolve(value).replace(/[\\/]+$/, '').toLowerCase()
const plainText = blocks => Array.isArray(blocks) ? blocks.filter(b => b.type === 'text').map(b => b.text).join('\n') : ''
export function createBridge(ctx, { stateFile, version, sectionName, getState }) {
  const directory = dirname(stateFile)
  const descriptorFile = join(directory, 'codex-bridge.json')
  const runsFile = join(directory, 'codex-runs.json')
  const token = randomBytes(32).toString('hex')
  const inflight = new Map()
  let runs = Object.create(null)
  try {
    const stored = readJson(runsFile)
    if (stored?.protocolVersion === PROTOCOL_VERSION && stored.runs && typeof stored.runs === 'object' && !Array.isArray(stored.runs)) {
      for (const [id, row] of Object.entries(stored.runs)) {
        if (/^[a-zA-Z0-9][a-zA-Z0-9_-]{7,80}$/.test(id) && row?.sessionId === `codex-${id}` && row?.requestId === id && typeof row.fingerprint === 'string') runs[id] = row
      }
    }
  } catch {}
  let navigation = { revision: 0 }
  const persist = () => atomicJson(runsFile, { protocolVersion: PROTOCOL_VERSION, runs })
  let publishedPort
  function publish() {
    const port = Number(ctx.webServer.port)
    if (!Number.isInteger(port) || port < 1 || port > 65535 || publishedPort === port) return
    atomicJson(descriptorFile, { protocolVersion: PROTOCOL_VERSION, packageName: 'dsh-top-directive', version, endpoint: `http://127.0.0.1:${port}/top-directive/api/bridge`, token, pid: process.pid })
    publishedPort = port
  }
  publish()
  const publishTimer = setInterval(() => { try { publish() } catch (error) { ctx.logger?.warn?.(`DSH bridge discovery: ${error.message}`) } }, 2000)
  publishTimer.unref?.()
  ctx.effect(() => () => clearInterval(publishTimer))

  ctx.on('system-prompt/assemble', async (_assembly, context, next) => {
    const assembly = await next()
    const row = Object.values(runs).find(r => r.sessionId === context.agent?.id)
    if (!row) return assembly
    const sections = assembly.sections || []
    const own = sections.find(s => s.name === sectionName)
    const raw = own?.text || ''
    const tools = row.purpose === 'test' ? [] : assembly.tools
    row.promptEvidence = {
      packageName: 'dsh-top-directive', version, sectionName,
      firstNonemptySection: sections.find(s => s.text?.trim())?.name ?? null,
      textSha256: digest(raw), textBytes: Buffer.byteLength(raw),
      enabled: getState().enabled, toolsAvailable: tools?.length ?? 0,
      capturedAt: new Date().toISOString()
    }
    persist()
    return row.purpose === 'test' ? { ...assembly, tools: [] } : assembly
  }, { prepend: true })

  async function eventsFor(row) {
    const signal = AbortSignal.timeout(10000)
    const baseline = await ctx.sessionController.projections({ sessionId: row.sessionId }, signal)
    if (!baseline || baseline.asOfSeq < 0) return []
    const page = await ctx.sessionController.page({ address: { kind: 'session', sessionId: row.sessionId }, throughSeq: baseline.asOfSeq, maxMessages: 30 }, signal)
    return page.records.filter(r => r.type === 'event').map(r => r.event)
  }
  async function inspect(runId) {
    const row = runs[runId]
    if (!row) throw fault('未知runId；只能读取本控制插件创建的会话。', 404)
    let events = []
    try { events = await eventsFor(row) } catch (error) {
      if (row.accepted) throw error
    }
    const user = events.find(e => e.type === 'user/message' && e.data?.source?.rpcId === row.requestId)
    const after = user ? events.filter(e => e.seq > user.seq) : []
    const assistant = after.filter(e => e.type === 'assistant/message').map(e => ({ event: e, text: plainText(e.data?.message?.content) })).filter(e => e.text.trim()).at(-1)
    const end = after.findLast(e => e.type === 'turn/end')
    const toolCalls = after.filter(e => e.type === 'tool/call' || e.type === 'tool/ptc-dispatch').length
    const reason = end?.data?.reason
    const failed = after.some(e => e.type === 'turn/error') || ['error', 'cancelled', 'aborted', 'interrupted'].includes(reason?.kind ?? reason)
    const completed = !!(user && assistant && end && !failed)
    return {
      runId, sessionId: row.sessionId, purpose: row.purpose, contract: row.contract,
      accepted: row.accepted === true, sent: !!user, completed,
      status: completed ? 'completed' : failed ? 'failed' : end ? 'ended_without_reply' : user ? 'running' : row.accepted ? 'pending' : 'not_sent',
      completionReason: reason ?? null, reply: assistant?.text.slice(0, 50000) ?? '',
      userSeq: user?.seq ?? null, assistantSeq: assistant?.event.seq ?? null,
      toolCalls, visibleInDesktop: row.visibleInDesktop === true,
      promptEvidence: row.promptEvidence ?? null, error: row.error ?? null
    }
  }
  async function submitOne(input) {
    let prepared
    try { prepared = prepareRun(input) } catch (error) { throw fault(error.message) }
    if (prepared.purpose === 'test' && prepared.contract.packageVersion !== version) throw fault(`安装版本是${version}，测试指定版本不一致。`, 409)
    let row = runs[prepared.runId]
    if (row && row.fingerprint !== prepared.fingerprint) throw fault('相同runId已经用于不同任务；请核对交接内容。', 409)
    if (row?.accepted) return inspect(prepared.runId)
    const workspace = ctx.workspaceRegistry.list().find(w => normalize(w.path) === normalize(prepared.workspacePath))
    if (!workspace) throw fault('所选工作区未注册，请在DSH中先添加工作区。')
    if (!row) {
      row = runs[prepared.runId] = { runId: prepared.runId, sessionId: `codex-${prepared.runId}`, requestId: prepared.runId, purpose: prepared.purpose, fingerprint: prepared.fingerprint, contract: prepared.contract, workspaceId: workspace.id, createdAt: new Date().toISOString(), accepted: false }
      persist()
    }
    try {
      await ctx.sessionController.create({ sessionId: row.sessionId, workspaceId: row.workspaceId })
      if (prepared.showInDesktop) navigation = { revision: navigation.revision + 1, runId: row.runId, sessionId: row.sessionId }
      const accepted = await ctx.sessionController.prompt({ sessionId: row.sessionId, requestId: row.requestId, content: [{ type: 'text', text: prepared.message }], clientTimeZone: 'Asia/Shanghai' }, AbortSignal.timeout(30000))
      row.accepted = accepted?.accepted === true
      delete row.error
      persist()
      return inspect(prepared.runId)
    } catch (error) {
      row.error = String(error?.message ?? error); persist(); throw error
    }
  }
  async function submit(input) {
    // Serialize retries for one run, including the create/send acknowledgement window.
    let prepared
    try { prepared = prepareRun(input) } catch (error) { throw fault(error.message) }
    const previous = inflight.get(prepared.runId) || Promise.resolve()
    const job = previous.catch(() => {}).then(() => submitOne(input))
    inflight.set(prepared.runId, job)
    try { return await job } finally { if (inflight.get(prepared.runId) === job) inflight.delete(prepared.runId) }
  }
  function status() {
    let defaultWorkspaceId
    try { defaultWorkspaceId = readJson(join(process.env.DSH_HOME || join(homedir(), '.dsh'), 'storages', 'workspace.json')).global?.defaultWorkspaceId } catch {}
    const state = getState()
    return { protocolVersion: PROTOCOL_VERSION, packageName: 'dsh-top-directive', version,
      prompt: { enabled: state.enabled, textBytes: Buffer.byteLength(state.text), textSha256: digest(state.text), revision: state.revision },
      workspaces: ctx.workspaceRegistry.list().map(w => ({ id: w.id, path: w.path, title: w.title, isDefault: w.id === defaultWorkspaceId })),
      runs: Object.values(runs).map(r => ({ runId: r.runId, sessionId: r.sessionId, purpose: r.purpose, accepted: r.accepted, createdAt: r.createdAt })) }
  }
  return { token, submit, inspect, status, getNavigation: () => navigation,
    acknowledgeNavigation(value) {
      if (value?.revision !== navigation.revision || value?.sessionId !== navigation.sessionId || !navigation.runId) throw fault('导航确认与当前会话不一致。', 409)
      runs[navigation.runId].visibleInDesktop = true; persist()
      return { acknowledged: true }
    } }
}
