import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { Readable } from 'node:stream'
import { createStateController, atomicJson, digest, MAX_TEXT_BYTES } from '../lib/state.js'
import { renderSectionText, buildRoute, VERSION } from '../lib/index.js'
import { createBridge } from '../lib/bridge.js'
import { prepareRun } from '../lib/contract.js'
const base = resolve(import.meta.dirname, '../.test-tmp')
mkdirSync(base, { recursive: true })
function temporary(t) {
  const dir = mkdtempSync(join(base, 'run-'))
  t.after(() => { assert.ok(resolve(dir).startsWith(base + '\\') || resolve(dir).startsWith(base + '/')); rmSync(dir, { recursive: true, force: true }) })
  return dir
}
test('raw prompt preserves whitespace, tags, braces and multiline content', () => {
  const raw = '  中文{{name}}\n<directive>原文</directive>\n  '
  assert.equal(renderSectionText({ enabled: true, text: raw }), raw)
  assert.equal(renderSectionText({ enabled: false, text: raw }), '')
  assert.equal(renderSectionText({ enabled: true, text: ' \n ' }), '')
})
test('state rejects invalid types and UTF8 overflow without truncation or publishing', t => {
  const state = createStateController(join(temporary(t), 'config.json'))
  const exact = '😀'.repeat(MAX_TEXT_BYTES / 4)
  const saved = state.set({ text: exact })
  assert.equal(saved.text, exact)
  assert.throws(() => state.set({ text: exact + '中' }), e => e.status === 413)
  assert.throws(() => state.set({ enabled: null }))
  assert.throws(() => state.set({ text: 17 }))
  assert.equal(state.get().revision, saved.revision)
})
test('state supports partial toggles, revision conflicts and backup recovery', t => {
  const file = join(temporary(t), 'config.json')
  const state = createStateController(file)
  state.set({ text: '甲' })
  const current = state.set({ text: '乙', enabled: false })
  assert.throws(() => state.set({ text: '丙', expectedRevision: 'stale' }), e => e.status === 409)
  assert.equal(state.set({ enabled: true, expectedRevision: current.revision }).text, '乙')
  writeFileSync(file, 'broken JSON')
  const recovered = createStateController(file).get()
  assert.equal(recovered.recovered, true)
  assert.equal(recovered.text, '乙')
  assert.equal(recovered.enabled, false)
})
test('write failure leaves the active value unchanged', t => {
  const file = join(temporary(t), 'config.json')
  const state = createStateController(file)
  state.set({ text: 'persisted' })
  const old = state.get()
  rmSync(file)
  mkdirSync(file)
  assert.throws(() => state.set({ text: 'not saved' }))
  assert.deepEqual(state.get(), old)
})
async function request(route, path, method = 'GET', body, headers = {}) {
  const req = Readable.from(body === undefined ? [] : [Buffer.from(JSON.stringify(body))])
  Object.assign(req, { url: path, method, headers: { host: '127.0.0.1:12345', ...headers } })
  let output
  const res = { statusCode: 200, setHeader() {}, end(value) { output = JSON.parse(value) } }
  await route.handler(req, res)
  return { status: res.statusCode, body: output }
}
test('local route rejects cross-site requests and unauthenticated session control', async () => {
  const bridge = { token: 'test-token', status: () => ({ version: VERSION }) }
  const route = buildRoute(() => ({ enabled: true, text: '' }), p => p, () => bridge)
  assert.equal((await request(route, '/top-directive/api/state', 'GET', undefined, { origin: 'http://evil.example' })).status, 403)
  assert.equal((await request(route, '/top-directive/api/state', 'POST', {}, { 'sec-fetch-site': 'cross-site' })).status, 403)
  assert.equal((await request(route, '/top-directive/api/bridge/status')).status, 401)
  assert.equal((await request(route, '/top-directive/api/bridge/status', 'GET', undefined, { 'x-codex-dsh-token': 'test-token' })).body.value.version, VERSION)
  assert.equal((await request(route, '/top-directive/apiXYZ/state')).status, 404)
})
test('purpose contract rejects accidental development forwarding and incomplete delegation', () => {
  const base = { runId: 'contract-test-01', workspacePath: 'D:/test', message: '请制作插件并测试' }
  assert.throws(() => prepareRun({ ...base, purpose: 'chat' }))
  assert.throws(() => prepareRun({ ...base, message: '请开发插件', purpose: 'test', packageName: 'dsh-top-directive', packageVersion: VERSION }))
  assert.throws(() => prepareRun({ ...base, purpose: 'task', objective: 'x', authorization: 'user' }))
  const good = prepareRun({ ...base, purpose: 'test', message: '请只回答6×7的结果。', packageName: 'dsh-top-directive', packageVersion: VERSION })
  assert.equal(good.contract.owner, 'Codex')
  assert.deepEqual(good.contract.allowedActions, ['answer'])
})
function harness(t) {
  const directory = temporary(t), disposers = [], logs = new Map(), metrics = { creates: 0, prompts: 0 }
  let assemblyHook
  const state = createStateController(join(directory, 'config.json'))
  state.set({ enabled: true, text: ' RAW{{text}}\n' })
  const ctx = {
    logger: { warn() {} }, webServer: { port: 12345 },
    effect(fn) { const dispose = fn(); if (dispose) disposers.push(dispose) },
    on(_event, hook) { assemblyHook = hook }, workspaceRegistry: { list: () => [{ id: 'workspace', path: directory }] },
    sessionController: {
      async create({ sessionId }) { metrics.creates++; logs.set(sessionId, []); return { sessionId } },
      async prompt({ sessionId, requestId }) {
        metrics.prompts++;
        const events = logs.get(sessionId)
        events.push({ seq: 0, type: 'user/message', data: { source: { rpcId: requestId }, content: [{ type: 'text', text: '6×7?' }] } })
        const assembled = await assemblyHook({}, { agent: { id: sessionId } }, async () => ({ sections: [{ name: 'user:top-directive', text: state.get().text }, { name: 'harness:identity', text: 'identity' }], tools: [{ name: 'write' }] }))
        metrics.tools = assembled.tools.length
        events.push({ seq: 1, type: 'assistant/message', data: { message: { content: [{ type: 'reasoning', text: 'hidden' }, { type: 'text', text: '42' }] } } }, { seq: 2, type: 'turn/end', data: { reason: { kind: 'completed' } } })
        return { accepted: true }
      },
      async projections({ sessionId }) { const log = logs.get(sessionId); return log ? { asOfSeq: log.length - 1 } : null },
      async page({ address }) { return { records: logs.get(address.sessionId).map(event => ({ type: 'event', event })) } }
    }
  }
  const bridge = createBridge(ctx, { stateFile: join(directory, 'config.json'), version: VERSION, sectionName: 'user:top-directive', getState: state.get })
  t.after(() => disposers.forEach(d => d()))
  return { bridge, metrics, directory, state }
}
test('bridge serializes duplicate retries, records actual evidence, disables test tools', async t => {
  const { bridge, metrics, directory, state } = harness(t)
  const input = { runId: 'dedupe-test-01', purpose: 'test', workspacePath: directory, message: '6×7?', packageName: 'dsh-top-directive', packageVersion: VERSION }
  const [a, b] = await Promise.all([bridge.submit(input), bridge.submit(input)])
  assert.equal(metrics.creates, 1); assert.equal(metrics.prompts, 1); assert.equal(metrics.tools, 0)
  assert.equal(a.completed, true); assert.equal(b.reply, '42'); assert.equal(a.toolCalls, 0)
  assert.equal(a.promptEvidence.textSha256, digest(state.get().text))
  assert.equal(a.promptEvidence.firstNonemptySection, 'user:top-directive')
  assert.equal(a.visibleInDesktop, false)
  const nav = bridge.getNavigation()
  bridge.acknowledgeNavigation(nav)
  assert.equal((await bridge.inspect(input.runId)).visibleInDesktop, true)
  await assert.rejects(bridge.submit({ ...input, message: 'different' }), e => e.status === 409)
  await assert.rejects(bridge.inspect('foreign-session'), e => e.status === 404)
  await assert.rejects(bridge.submit({ ...input, runId: 'version-test-01', packageVersion: '1.0.0' }), e => e.status === 409)
  const descriptor = JSON.parse(readFileSync(join(directory, 'codex-bridge.json'), 'utf8'))
  assert.equal(descriptor.protocolVersion, 2)
  assert.equal(descriptor.token.length, 64)
})
test('delegated task keeps its explicit DSH owner and tools', async t => {
  const { bridge, metrics, directory } = harness(t)
  const result = await bridge.submit({ runId: 'delegate-test-01', purpose: 'task', workspacePath: directory, message: '修复已指定文件', objective: '修复', authorization: '用户明确要求DSH修复', allowedFiles: ['one.js'], expectedEvidence: ['diff'] })
  assert.equal(result.contract.owner, 'DSH')
  assert.equal(metrics.tools, 1)
})
