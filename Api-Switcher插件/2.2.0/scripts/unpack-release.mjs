import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { resolve, dirname, sep } from 'node:path'
import assert from 'node:assert/strict'
const [archive,destination]=process.argv.slice(2)
assert.ok(archive&&destination,'Usage: unpack-release.mjs archive.tgz destination')
const bytes=gunzipSync(readFileSync(archive)),root=resolve(destination)
const field=(header,start,length)=>header.subarray(start,start+length).toString().replace(/\0.*$/s,'')
let files=0
for(let offset=0;offset+512<=bytes.length;){
  const header=bytes.subarray(offset,offset+512)
  if(header.every(value=>value===0))break
  const name=[field(header,345,155),field(header,0,100)].filter(Boolean).join('/'),size=parseInt(field(header,124,12).trim()||'0',8)
  assert.ok(Number.isSafeInteger(size)&&size>=0&&offset+512+size<=bytes.length,'Invalid entry size')
  assert.ok(name.startsWith('package/')&&!name.includes('..')&&!name.includes('\\'),'Unsafe archive path')
  assert.ok(header[156]===48||header[156]===0,'Only regular files are supported')
  const target=resolve(root,name)
  assert.ok(target.toLowerCase().startsWith(root.toLowerCase()+sep),'Path escaped extraction directory')
  mkdirSync(dirname(target),{recursive:true});writeFileSync(target,bytes.subarray(offset+512,offset+512+size));files++
  offset+=512+Math.ceil(size/512)*512
}
console.log(JSON.stringify({extractedFiles:files}))
