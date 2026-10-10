import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { gzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { VERSION } from '../lib/index.js';
const root = resolve(import.meta.dirname, '..');
const pkg = JSON.parse(readFileSync(join(root,'package.json'),'utf8'));
assert.equal(pkg.version, VERSION);
const hash = data => createHash('sha256').update(data).digest('hex');
function walk(path, prefix='') {
  return readdirSync(path,{withFileTypes:true}).flatMap(item=> {
    assert.ok(!item.isSymbolicLink());
    const name=prefix+item.name;
    return item.isDirectory()?walk(join(path,item.name),name+'/'):[name];
  });
}
const names=['package.json',...pkg.files.flatMap(name=>statSync(join(root,name)).isDirectory()?walk(join(root,name),name+'/'):[name])].sort();
const entries=[], hashes={};
for(const name of names) {
  const path='package/'+name, data=readFileSync(join(root,name)), header=Buffer.alloc(512);
  assert.ok(Buffer.byteLength(path)<100 && !name.includes('..') && !name.includes('\\'));
  header.write(path);
  for(const [start,length,value] of [[100,8,0o644],[108,8,0],[116,8,0],[124,12,data.length],[136,12,1791590400]]) header.write(value.toString(8).padStart(length-1,'0')+'\0',start,length,'ascii');
  header.fill(32,148,156); header[156]=48; header.write('ustar\0',257,6); header.write('00',263,2);
  header.write(header.reduce((sum,value)=>sum+value,0).toString(8).padStart(6,'0')+'\0 ',148,8,'ascii');
  entries.push(header,data,Buffer.alloc((512-data.length%512)%512)); hashes[name]=hash(data);
}
entries.push(Buffer.alloc(1024));
const tgz=gzipSync(Buffer.concat(entries),{level:9}), archive=`${pkg.name}-${pkg.version}.tgz`;
writeFileSync(join(root,archive),tgz);
const assets=[archive,'Install-DSH.ps1'].map(file=>({file,bytes:statSync(join(root,file)).size,sha256:hash(readFileSync(join(root,file)))}));
const release={schemaVersion:1,project:pkg.name,version:VERSION,packagingRevision:'20261010-shared-mascot',repository:'https://github.com/ccl4-56-23-5/DSH-Plugins',sourcePath:`最高指令插件/${VERSION}`,releaseTag:`top-directive-v${VERSION}`,assets,packageFileSHA256:hashes,runtimeDependencies:0,priorModelAcceptanceVersion:'1.1.1',modelRetested:false,latestInstallersOnly:true};
writeFileSync(join(root,'release-manifest.json'),JSON.stringify(release,null,2)+'\n');
const sums=[...assets,{file:'release-manifest.json',sha256:hash(readFileSync(join(root,'release-manifest.json')))}].map(item=>`${item.sha256}  ${item.file}`).join('\n')+'\n';
writeFileSync(join(root,'SHA256SUMS.txt'),sums);
console.log(JSON.stringify({version:VERSION,package:archive,files:names.length,bytes:tgz.length,sha256:hash(tgz)}));
