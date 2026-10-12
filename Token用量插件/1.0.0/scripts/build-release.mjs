import { readFileSync, writeFileSync, readdirSync, statSync, globSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { gzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
const root=resolve(import.meta.dirname,'..'), pkg=JSON.parse(readFileSync(join(root,'package.json'),'utf8').replace(/^\uFEFF/,''));
const hash=data=>createHash('sha256').update(data).digest('hex');
function walk(dir,prefix='') { return readdirSync(dir,{withFileTypes:true}).flatMap(e=>{assert.ok(!e.isSymbolicLink());const n=prefix+e.name;return e.isDirectory()?walk(join(dir,e.name),n+'/'):[n]}); }
const names=new Set(['package.json']);
for(const pattern of pkg.files)for(const name of globSync(pattern,{cwd:root})) {
  const normalized=name.replaceAll('\\','/');
  if(statSync(join(root,name)).isDirectory()) for(const f of walk(join(root,name),normalized+'/'))names.add(f);
  else names.add(normalized);
}
const entries=[], hashes={};
for(const name of [...names].sort()) {
  const path='package/'+name,data=readFileSync(join(root,name)),header=Buffer.alloc(512);
  assert.ok(Buffer.byteLength(path)<100&&!name.includes('..'));
  header.write(path);
  for(const [start,length,value] of [[100,8,0o644],[108,8,0],[116,8,0],[124,12,data.length],[136,12,1791763200]])header.write(value.toString(8).padStart(length-1,'0')+'\0',start,length,'ascii');
  header.fill(32,148,156);header[156]=48;header.write('ustar\0',257,6);header.write('00',263,2);
  header.write(header.reduce((s,n)=>s+n,0).toString(8).padStart(6,'0')+'\0 ',148,8,'ascii');
  entries.push(header,data,Buffer.alloc((512-data.length%512)%512));hashes[name]=hash(data);
}
const archive=`${pkg.name}-${pkg.version}.tgz`,tgz=gzipSync(Buffer.concat([...entries,Buffer.alloc(1024)]),{level:9});writeFileSync(join(root,archive),tgz);
const assets=[archive,'Install-DSH.ps1','安装.cmd'].map(file=>({file,bytes:statSync(join(root,file)).size,sha256:hash(readFileSync(join(root,file)))}));
const manifest={schemaVersion:1,project:pkg.name,version:pkg.version,upstream:{repository:'https://github.com/HaoyueQin/dsh-usage-statistics-panel',version:'0.3.2',commit:'657953bfe5567dd33299d1ca417058285071d433'},releaseTag:`token-usage-v${pkg.version}`,assets,packageFileSHA256:hashes,runtimeDependencies:0,storageDomain:'usage_history',storageSchemaUnchanged:true};
writeFileSync(join(root,'release-manifest.json'),JSON.stringify(manifest,null,2)+'\n');
const sumAssets=[...assets,{file:'release-manifest.json',sha256:hash(readFileSync(join(root,'release-manifest.json')))}];
const sums=()=>sumAssets.map(a=>`${a.sha256}  ${a.file}`).join('\n')+'\n';writeFileSync(join(root,'SHA256SUMS.txt'),sums());
// Portable ZIP with UTF-8 names. TGZ is already compressed.
function crc32(b) { let c=0xffffffff;for(const n of b){c^=n;for(let k=0;k<8;k++)c=(c>>>1)^((c&1)?0xedb88320:0)}return(c^0xffffffff)>>>0 }
const local=[],central=[];let offset=0;
for(const name of [archive,'Install-DSH.ps1','安装.cmd','release-manifest.json','README.md','SHA256SUMS.txt']) {
  const file=Buffer.from(name),data=readFileSync(join(root,name)),crc=crc32(data),a=Buffer.alloc(30),b=Buffer.alloc(46);
  a.writeUInt32LE(0x04034b50);a.writeUInt16LE(20,4);a.writeUInt16LE(0x800,6);a.writeUInt32LE(crc,14);a.writeUInt32LE(data.length,18);a.writeUInt32LE(data.length,22);a.writeUInt16LE(file.length,26);
  b.writeUInt32LE(0x02014b50);b.writeUInt16LE(20,4);b.writeUInt16LE(20,6);b.writeUInt16LE(0x800,8);b.writeUInt32LE(crc,16);b.writeUInt32LE(data.length,20);b.writeUInt32LE(data.length,24);b.writeUInt16LE(file.length,28);b.writeUInt32LE(offset,42);
  local.push(a,file,data);central.push(b,file);offset+=a.length+file.length+data.length;
}
const cd=Buffer.concat(central),end=Buffer.alloc(22);end.writeUInt32LE(0x06054b50);end.writeUInt16LE(6,8);end.writeUInt16LE(6,10);end.writeUInt32LE(cd.length,12);end.writeUInt32LE(offset,16);
const zip=Buffer.concat([...local,cd,end]),zipName=`${pkg.name}-${pkg.version}-Windows.zip`;writeFileSync(join(root,zipName),zip);
sumAssets.push({file:zipName,sha256:hash(zip)});writeFileSync(join(root,'SHA256SUMS.txt'),sums());
console.log(JSON.stringify({version:pkg.version,package:archive,files:names.size,sha256:hash(tgz),windowsZip:zipName}));
