import { readFileSync, mkdirSync, writeFileSync, renameSync, unlinkSync } from 'node:fs'
import { dirname } from 'node:path'
import { randomUUID } from 'node:crypto'

export function readMetadata(path) {
  try {
    const value = JSON.parse(readFileSync(path, 'utf8').replace(/^\uFEFF/, ''))
    if (![1, 2].includes(value.version) || !Array.isArray(value.managed) || !Array.isArray(value.favorites)) throw new Error('invalid')
    const providers = value.version === 2 && value.providers && typeof value.providers === 'object' && !Array.isArray(value.providers) ? value.providers : {}
    return { version: 2, managed: value.managed.filter(v => typeof v === 'string'), favorites: value.favorites.filter(v => typeof v === 'string'), providers, initialized: value.initialized === true }
  } catch (error) {
    if (error.code === 'ENOENT') return { version: 2, managed: [], favorites: [], providers: {}, initialized: false }
    throw Object.assign(new Error('API来源收藏文件损坏或无法读取，请先恢复备份。'), { status: 503, code: 'METADATA_UNAVAILABLE' })
  }
}

export function writeMetadata(path, value) {
  mkdirSync(dirname(path), { recursive: true })
  const temp = `${path}.${randomUUID()}.tmp`
  try {
    writeFileSync(temp, JSON.stringify(value, null, 2) + '\n', { flag: 'wx', mode: 0o600 })
    renameSync(temp, path)
  } finally { try { unlinkSync(temp) } catch {} }
}
