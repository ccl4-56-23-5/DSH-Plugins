import assert from 'node:assert/strict'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { resolve, dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { VERSION } from '../lib/core.js'

export const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
export function walk(directory, prefix = '') {
  return readdirSync(directory, { withFileTypes: true }).sort((a,b)=>a.name.localeCompare(b.name,'en')).flatMap(entry => {
    if (['.work','dist','node_modules','.git'].includes(entry.name)) return []
    assert.ok(!entry.isSymbolicLink(), `Symlinks are not allowed: ${prefix}${entry.name}`)
    const name = `${prefix}${entry.name}`
    return entry.isDirectory() ? walk(join(directory,entry.name),`${name}/`) : [name]
  })
}
export function checkProject() {
  const manifest = JSON.parse(readFileSync(join(root,'package.json'),'utf8'))
  assert.equal(manifest.name,'dsh-api-switcher')
  assert.equal(manifest.title,'api-switcher')
  assert.equal(manifest.version,VERSION)
  assert.match(VERSION,/^\d+\.\d+\.\d+$/)
  assert.ok(!Object.keys(manifest.dependencies || {}).length, 'Unexpected runtime dependencies')
  for (const file of ['Install-DSH.ps1','Verify-Package.mjs']) assert.ok(readFileSync(join(root,file),'utf8').includes(`'${VERSION}'`) || readFileSync(join(root,file),'utf8').includes(`@${VERSION}`), `Version mismatch: ${file}`)
  for (const [name,size] of [['lib/assets/icon.png',256],['lib/assets/logo.png',512]]) {
    const bytes = readFileSync(join(root,name))
    assert.equal(bytes.subarray(0,8).toString('hex'),'89504e470d0a1a0a')
    assert.equal(bytes.readUInt32BE(16),size); assert.equal(bytes.readUInt32BE(20),size)
    assert.equal(bytes[25],6,'PNG must be RGBA')
    if(size===256) assert.ok(bytes.length<=256*1024,'DSH icon exceeds 256KiB')
  }
  const files=walk(root); let localLinks=0
  for(const name of files) {
    assert.ok(!/(^|\/)(?:\.credentials\.yaml|\.env(?:\..*)?|state\.json|profiles|deployment-backups)$/.test(name),`Private file: ${name}`)
    if(!/\.(?:js|mjs|md|json|yml|ps1|cmd)$/.test(name))continue
    const text=readFileSync(join(root,name),'utf8')
    assert.ok(!/\b(?:sk|sk-ant)-[A-Za-z0-9_-]{20,}\b/.test(text),`Possible secret in ${name}`)
    assert.ok(!/C:[\\/]Users[\\/]ccl(?:[\\/]|\b)/i.test(text),`Personal absolute path in ${name}`)
    if(name.endsWith('.md'))for(const match of text.matchAll(/\]\(([^)]+)\)|\bsrc="([^"]+)"/g)) {
      const href=(match[1]||match[2]).split('#')[0]
      if(!href||/^[a-z][a-z0-9+.-]*:/i.test(href))continue
      assert.ok(statSync(resolve(root,dirname(name),decodeURIComponent(href))).isFile()||statSync(resolve(root,dirname(name),decodeURIComponent(href))).isDirectory(),`Broken local link: ${name} -> ${href}`)
      localLinks++
    }
  }
  return {version:VERSION,checkedSourceFiles:files.length,localLinks,icon:'256px RGBA <256KiB',runtimeDependencies:0}
}
if(process.argv[1] && resolve(process.argv[1])===fileURLToPath(import.meta.url))console.log(JSON.stringify(checkProject(),null,2))
