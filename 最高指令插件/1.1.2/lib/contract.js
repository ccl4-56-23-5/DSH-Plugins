import { createHash } from 'node:crypto'

export const PROTOCOL_VERSION = 2
function required(value, name) {
  if (typeof value !== 'string' || !value.trim()) throw Object.assign(new Error(`${name}不能为空。`), { status: 400 })
  return value
}
export function prepareRun(input) {
  if (!input || typeof input !== 'object') throw new Error('缺少交接内容。')
  const runId = required(input.runId, 'runId')
  if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]{7,80}$/.test(runId)) throw new Error('runId须为8至81个字母、数字、下划线或连字符。')
  if (!['chat', 'test', 'task'].includes(input.purpose)) throw new Error('必须明确选择chat、test或task。')
  const workspacePath = required(input.workspacePath, 'workspacePath')
  const original = required(input.message, 'message')
  if (Buffer.byteLength(original, 'utf8') > 48 * 1024) throw new Error('交接消息超过48KiB。')
  let message = original
  let contract = { purpose: input.purpose, owner: 'Codex' }
  if (input.purpose === 'chat') {
    if (input.explicitUserMessage !== true) throw new Error('chat必须确认message是用户明确要求发送的消息，不能自动转发父任务。')
    contract = { ...contract, explicitUserMessage: true }
  } else if (input.purpose === 'test') {
    const packageName = required(input.packageName, 'packageName')
    const packageVersion = required(input.packageVersion, 'packageVersion')
    if (packageName !== 'dsh-top-directive') throw new Error('本验证接口仅验证dsh-top-directive。')
    if (/开发.{0,4}插件|编写.{0,4}插件|搓.{0,4}插件|实现.{0,4}插件|写.{0,4}插件|(?:create|write|implement|build).{0,20}plugin/i.test(original)) throw new Error('测试问题包含插件开发指令，请改为只需回答的验证问题。')
    contract = { ...contract, packageName, packageVersion, allowedActions: ['answer'], expectedEvidence: ['actual_reply', 'prompt_assembly', 'tool_call_count'] }
    message = `[Codex验证交接]\n实现负责人：Codex。现有插件：${packageName}@${packageVersion}。\n你的任务仅为回答下面的测试问题；请勿编写、安装或修改插件和文件。工具已由宿主在本次测试中关闭。\n\n测试问题：\n${original}`
  } else {
    const objective = required(input.objective, 'objective')
    const authorization = required(input.authorization, 'authorization')
    const allowedFiles = input.allowedFiles
    const expectedEvidence = input.expectedEvidence
    if (!Array.isArray(allowedFiles) || !allowedFiles.length || allowedFiles.some(v => typeof v !== 'string' || !v.trim())) throw new Error('委派任务必须列出allowedFiles。')
    if (!Array.isArray(expectedEvidence) || !expectedEvidence.length || expectedEvidence.some(v => typeof v !== 'string' || !v.trim())) throw new Error('委派任务必须列出expectedEvidence。')
    contract = { purpose: 'task', owner: 'DSH', objective, authorization, allowedFiles, expectedEvidence }
    message = `[Codex任务交接]\n${JSON.stringify(contract, null, 2)}\n工作区：${workspacePath}\n请复用工作区现有成果，仅处理列出的文件范围。遇到范围不明时先报告，不另建同用途插件。\n\n具体任务：\n${original}`
  }
  const fingerprint = createHash('sha256').update(JSON.stringify({ workspacePath, message, contract })).digest('hex')
  return { runId, purpose: input.purpose, workspacePath, message, contract, fingerprint, showInDesktop: input.showInDesktop !== false }
}
