import { readFileSync, writeFileSync, mkdirSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { gzipSync } from 'node:zlib'
import { createHash } from 'node:crypto'
import assert from 'node:assert/strict'
import { checkProject, root, walk } from './check-project.mjs'

checkProject()
const manifest=JSON.parse(readFileSync(join(root,'package.json'),'utf8'))
const output=resolve(process.argv[2]||join(root,'dist'))
const timestamp=Number(process.env.SOURCE_DATE_EPOCH||Date.parse('2026-10-09T00:00:00Z')/1000)
assert.ok(Number.isSafeInteger(timestamp)&&timestamp>=0,'Invalid SOURCE_DATE_EPOCH')
const names=[...new Set(['package.json',...manifest.files.flatMap(name=>statSync(join(root,name)).isDirectory()?walk(join(root,name),`${name}/`):[name])])].sort()
const hash=bytes=>createHash('sha256').update(bytes).digest('hex')
const octal=(header,start,length,value)=>header.write(value.toString(8).padStart(length-1,'0')+'\0',start,length,'ascii')
const tarEntries=[],fileHashes={}
for(const name of names){
  assert.ok(!name.includes('..')&&!name.includes('\\')&&!name.startsWith('/'),'Unsafe package path')
  const fullName=`package/${name}`,data=readFileSync(join(root,name)),header=Buffer.alloc(512)
  assert.ok(Buffer.byteLength(fullName)<100,`Path too long: ${fullName}`)
  header.write(fullName,0,100,'utf8');octal(header,100,8,0o644);octal(header,108,8,0);octal(header,116,8,0)
  octal(header,124,12,data.length);octal(header,136,12,timestamp)
  header.fill(32,148,156);header[156]=48;header.write('ustar\0',257,6,'ascii');header.write('00',263,2,'ascii')
  const checksum=header.reduce((sum,value)=>sum+value,0)
  header.write(checksum.toString(8).padStart(6,'0')+'\0 ',148,8,'ascii')
  tarEntries.push(header,data,Buffer.alloc((512-data.length%512)%512))
  fileHashes[name]=hash(data)
}
tarEntries.push(Buffer.alloc(1024))
const archive=gzipSync(Buffer.concat(tarEntries),{level:9})
const packageName=`${manifest.name}-${manifest.version}.tgz`
mkdirSync(output,{recursive:true});writeFileSync(join(output,packageName),archive)
const release={schemaVersion:1,name:manifest.name,title:manifest.title,version:manifest.version,buildEpoch:timestamp,runtimeDependencies:0,packageFiles:names.length,files:{[packageName]:{bytes:archive.length,sha256:hash(archive)}},packageFileSHA256:fileHashes}
writeFileSync(join(output,'release-manifest.json'),JSON.stringify(release,null,2)+'\n')
writeFileSync(join(output,'SHA256SUMS.txt'),`${hash(archive)}  ${packageName}\n`)
console.log(JSON.stringify({version:manifest.version,package:packageName,bytes:archive.length,files:names.length,sha256:hash(archive)}))
