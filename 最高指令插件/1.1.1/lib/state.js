import { mkdirSync, readFileSync, openSync, writeFileSync, fsyncSync, closeSync, renameSync, unlinkSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { homedir } from 'node:os'
import { createHash, randomUUID } from 'node:crypto'

export const MAX_TEXT_BYTES = 32 * 1024
export const defaultState = () => ({ enabled: true, text: '' })
export const digest = value => createHash('sha256').update(value).digest('hex')
export const fault = (message, status = 400) => Object.assign(new Error(message), { status })
export function resolveStateFile(configured) {
  return configured || join(process.env.DSH_HOME || join(homedir(), '.dsh'), 'top-directive', 'config.json')
}
export function readJson(file) {
  return JSON.parse(readFileSync(file, 'utf8').replace(/^\uFEFF/, ''))
}
export function validateState(value) {
  if (typeof value?.enabled !== 'boolean' || typeof value?.text !== 'string') throw fault('配置必须包含enabled布尔值和text字符串。')
  if (Buffer.byteLength(value.text, 'utf8') > MAX_TEXT_BYTES) throw fault('提示词超过32KiB，请缩短正文后保存。', 413)
  return { enabled: value.enabled, text: value.text }
}
export function atomicJson(file, value) {
  mkdirSync(dirname(file), { recursive: true })
  const tmp = `${file}.${process.pid}.${randomUUID()}.tmp`
  let fd
  try {
    fd = openSync(tmp, 'wx', 0o600)
    writeFileSync(fd, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
    fsyncSync(fd)
    closeSync(fd); fd = undefined
    renameSync(tmp, file)
  } finally {
    if (fd !== undefined) closeSync(fd)
    if (existsSync(tmp)) unlinkSync(tmp)
  }
}
export const writeState = (file, value) => atomicJson(file, validateState(value))
function load(file) {
  if (!existsSync(file)) return { state: defaultState(), recovered: false, warning: '' }
  try { return { state: validateState(readJson(file)), recovered: false, warning: '' } }
  catch {
    try {
      return { state: validateState(readJson(`${file}.bak`)), recovered: true, warning: '主配置无法读取，已载入上次保存的备份。请核对后保存。' }
    } catch { return { state: defaultState(), recovered: false, warning: '配置和备份无法读取，已载入默认值。原文件仍保留。' } }
  }
}
export const readState = file => load(file).state
export function createStateController(file) {
  let { state, recovered, warning } = load(file)
  const get = () => ({ ...state, stateFile: file, revision: digest(JSON.stringify(state)), recovered, warning })
  const set = patch => {
    if (!patch || typeof patch !== 'object' || Array.isArray(patch)) throw fault('配置更新必须是JSON对象。')
    if (patch.expectedRevision !== undefined && patch.expectedRevision !== get().revision) throw fault('配置已在其他窗口修改。请重新读取后保存。', 409)
    const next = validateState({ enabled: Object.hasOwn(patch, 'enabled') ? patch.enabled : state.enabled, text: Object.hasOwn(patch, 'text') ? patch.text : state.text })
    // Do not publish the new value until its durable write succeeds.
    atomicJson(`${file}.bak`, state)
    atomicJson(file, next)
    state = next; recovered = false; warning = ''
    return get()
  }
  return { get, set }
}
