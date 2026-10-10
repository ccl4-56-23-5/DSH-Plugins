import assert from 'node:assert/strict';
import { readFileSync, readdirSync, writeFileSync, statSync } from 'node:fs';
import { resolve, join, dirname } from 'node:path';
import { createHash } from 'node:crypto';
import { gunzipSync } from 'node:zlib';
export const root=resolve(import.meta.dirname,'..');
const hash=data=>createHash('sha256').update(data).digest('hex');
const json=file=>JSON.parse(readFileSync(file,'utf8'));
export function plugins() {
  return ['Api-Switcher插件','最高指令插件'].map(directory=> {
    const versions=readdirSync(join(root,directory)).filter(name=>/^\d+\.\d+\.\d+$/.test(name));
    assert.equal(versions.length,1,`${directory}: only latest source may remain`);
    const version=versions[0], path=join(root,directory,version), pkg=json(join(path,'package.json'));
    assert.equal(pkg.version,version);
    return {directory,version,path,pkg,tag:`${directory==='Api-Switcher插件'?'api-switcher':'top-directive'}-v${version}`,releaseDirectory:join(path,directory==='Api-Switcher插件'?'dist':'')};
  });
}
function walk(path,prefix='') {
  return readdirSync(path,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name,'en')).flatMap(item=> {
    if(['.git','.work','node_modules','.test-tmp','test-results'].includes(item.name)) return [];
    assert.ok(!item.isSymbolicLink(),`Unexpected link: ${prefix}${item.name}`);
    const name=prefix+item.name;
    return item.isDirectory()?walk(join(path,item.name),name+'/'):[name];
  });
}
function entries(tgz) {
  const tar=gunzipSync(tgz), files=new Map();
  for(let offset=0;offset+512<=tar.length;) {
    const header=tar.subarray(offset,offset+512); if(header.every(value=>value===0))break;
    const name=header.subarray(0,100).toString().split('\0')[0];
    const size=parseInt(header.subarray(124,136).toString().replace(/\0/g,'').trim(),8);
    assert.ok(name.startsWith('package/')&&!name.includes('..')&&Number.isFinite(size));
    assert.equal(header[156],48,'Only regular files allowed in the package');
    assert.ok(offset+512+size<=tar.length);
    assert.ok(!files.has(name)); files.set(name,tar.subarray(offset+512,offset+512+size));
    offset+=512+Math.ceil(size/512)*512;
  }
  return files;
}
export function checkRepository() {
  const current=plugins();
  for(const plugin of current) {
    const {path,pkg,releaseDirectory}=plugin;
    assert.equal(pkg.icon,'lib/assets/icon.png');
    assert.equal(Object.keys(pkg.dependencies||{}).length,0);
    const branding=json(join(path,'assets/branding.json'));
    assert.ok(/lower-right|lower right/i.test(branding.target),'Missing mascot placement record');
    for(const [name,spec] of Object.entries(branding.files)) {
      const data=readFileSync(join(path,name)); assert.equal(hash(data),spec.sha256); assert.equal(data.length,spec.bytes);
    }
    for(const [file,size] of [['lib/assets/icon.png',256],['lib/assets/logo.png',512]]) {
      const data=readFileSync(join(path,file));
      assert.equal(data.subarray(0,8).toString('hex'),'89504e470d0a1a0a');
      assert.equal(data.readUInt32BE(16),size); assert.equal(data.readUInt32BE(20),size); assert.equal(data[25],6);
      if(size===256)assert.ok(data.length<=256*1024);
    }
    const release=json(join(releaseDirectory,'release-manifest.json'));
    assert.equal(release.version,pkg.version);
    for(const line of readFileSync(join(releaseDirectory,'SHA256SUMS.txt'),'utf8').trim().split(/\r?\n/)) {
      const match=/^([a-f0-9]{64})  (.+)$/.exec(line); assert.ok(match);
      assert.ok(!match[2].includes('..')&&!match[2].includes('/')&&!match[2].includes('\\'));
      assert.equal(hash(readFileSync(join(releaseDirectory,match[2]))),match[1],`Release mismatch: ${match[2]}`);
    }
    const packed=entries(readFileSync(join(releaseDirectory,`${pkg.name}-${pkg.version}.tgz`)));
    assert.equal(JSON.parse(packed.get('package/package.json')).version,pkg.version);
    for(const [name,expected] of Object.entries(release.packageFileSHA256)) {
      assert.ok(packed.has('package/'+name),`Missing package file ${name}`);
      assert.equal(hash(packed.get('package/'+name)),expected);
      assert.equal(hash(readFileSync(join(path,name))),expected,`Stale packaged source: ${name}`);
    }
    for(const name of ['lib/assets/icon.png','lib/assets/logo.png'])assert.ok(packed.has('package/'+name));
  }
  const files=walk(root).filter(name=>name!=='PUBLISH-SHA256SUMS.txt');
  const sums=files.map(name=>`${hash(readFileSync(join(root,name)))}  ${name}`).join('\n')+'\n';
  if(process.argv.includes('--write-hashes'))writeFileSync(join(root,'PUBLISH-SHA256SUMS.txt'),sums);
  assert.equal(readFileSync(join(root,'PUBLISH-SHA256SUMS.txt'),'utf8'),sums,'Run check-repository.mjs --write-hashes after final build');
  let links=0;
  for(const name of files) {
    assert.ok(!/(^|\/)(?:\.env(?:\..*)?|\.credentials\.yaml|state\.json|profiles|deployment-backups)$/.test(name),`Private file: ${name}`);
    if(!/\.(?:md|mjs|js|json|yml|ps1|cmd)$/.test(name))continue;
    const text=readFileSync(join(root,name),'utf8');
    assert.ok(!/\b(?:sk|sk-ant)-[A-Za-z0-9_-]{20,}\b/.test(text),`Possible secret in ${name}`);
    if(!name.endsWith('.md'))continue;
    for(const match of text.matchAll(/\]\(([^)]+)\)|\bsrc="([^"]+)"/g)) {
      const href=(match[1]||match[2]).split('#')[0];
      if(!href||/^[a-z][a-z0-9+.-]*:/i.test(href))continue;
      assert.ok(statSync(resolve(root,dirname(name),decodeURIComponent(href))).isFile(),`Broken link: ${name} -> ${href}`); links++;
    }
  }
  return {plugins:current.map(({pkg,tag})=>({name:pkg.name,version:pkg.version,tag})),files:files.length,links,logoAssets:'RGBA sizes, source hashes and packed bytes verified'};
}
if(process.argv[1]&&resolve(process.argv[1])===resolve(import.meta.filename))console.log(JSON.stringify(checkRepository(),null,2));
