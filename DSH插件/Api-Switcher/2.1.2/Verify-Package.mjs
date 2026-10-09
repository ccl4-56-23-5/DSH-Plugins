import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { createHash } from 'node:crypto'
import { resolve, sep } from 'node:path'
import assert from 'node:assert/strict'

const [archive, installed] = process.argv.slice(2)
assert.ok(archive && installed, 'Usage: Verify-Package.mjs package.tgz installed-package-directory')
const bytes = gunzipSync(readFileSync(archive))
const files = new Map()
const field = (header, start, length) => header.subarray(start, start + length).toString().replace(/\0.*$/s, '')
for (let offset = 0; offset + 512 <= bytes.length;) {
  const header = bytes.subarray(offset, offset + 512)
  if (header.every(value => value === 0)) break
  const name = [field(header, 345, 155), field(header, 0, 100)].filter(Boolean).join('/')
  const size = Number.parseInt(field(header, 124, 12).trim() || '0', 8)
  assert.ok(Number.isSafeInteger(size) && size >= 0 && offset + 512 + size <= bytes.length, 'Invalid archive size')
  const type = header[156]
  if (type === 0 || type === 48) {
    assert.ok(name.startsWith('package/') && !name.includes('..') && !name.includes('\\'), 'Invalid package path')
    files.set(name.slice(8), bytes.subarray(offset + 512, offset + 512 + size))
  } else assert.ok(type === 53 || type === 120 || type === 103, 'Unsupported archive entry')
  offset += 512 + Math.ceil(size / 512) * 512
}
const manifest = JSON.parse(files.get('package.json'))
assert.equal(manifest.name, 'dsh-api-switcher')
assert.equal(manifest.version, '2.1.2')
assert.ok(files.has('lib/client.js') && files.has('lib/core.js') && files.has('cordis.patch.yml'), 'Incomplete package')
assert.equal(manifest.title, 'api-switcher')
const icon = files.get(manifest.icon)
assert.ok(icon && icon.length <= 256 * 1024, 'Missing or oversized plugin icon')
assert.equal(icon.subarray(0,8).toString('hex'),'89504e470d0a1a0a')
const hash = value => createHash('sha256').update(value).digest('hex')
const root = resolve(installed)
for (const [name, expected] of files) {
  const target = resolve(root, name)
  assert.ok(target.toLowerCase().startsWith(root.toLowerCase() + sep), 'Invalid installation target')
  assert.equal(hash(readFileSync(target)), hash(expected), `Installed file mismatch: ${name}`)
}
console.log(JSON.stringify({ package: `${manifest.name}@${manifest.version}`, verifiedInstalledFiles: files.size }))
