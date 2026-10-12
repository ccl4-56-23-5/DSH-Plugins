import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
export const REPO='ccl4-56-23-5/DSH-Plugins';
export const sha256=b=>createHash('sha256').update(b).digest('hex');
export function compare(a,b){
  const parse=v=>{if(!/^\d+\.\d+\.\d+$/.test(v))throw new Error('不支持的版本格式：'+v);return v.split('.').map(Number);};
  const x=parse(a),y=parse(b);for(let i=0;i<3;i++)if(x[i]!==y[i])return Math.sign(x[i]-y[i]);return 0;
}
export function assetURL(value){const u=new URL(value);if(u.protocol!=='https:'||u.hostname!=='github.com'||u.username||u.password||u.search||u.hash||!u.pathname.startsWith('/'+REPO+'/releases/download/'))throw new Error('安装文件不属于指定仓库');return u.href;}
export async function bytes(url,max=2*1024*1024){
  const r=await fetch(url,{headers:{'User-Agent':'DSH-Repo-Manager','Accept':'application/vnd.github+json'},signal:AbortSignal.timeout(60000)});
  if(!r.ok)throw new Error('GitHub请求失败：HTTP '+r.status+(r.status===403?'（可能达到访问频率限制）':''));
  if(Number(r.headers.get('content-length'))>max)throw new Error('下载文件过大');
  const chunks=[];let size=0;for await(const chunk of r.body){size+=chunk.length;if(size>max)throw new Error('下载文件过大');chunks.push(chunk);}return Buffer.concat(chunks);
}
export async function discover(read=bytes){
  const releases=[];for(let page=1;page<=10;page++){const batch=JSON.parse(await read(`https://api.github.com/repos/${REPO}/releases?per_page=100&page=${page}`,8*1024*1024));if(!Array.isArray(batch))throw new Error('Release列表无效');releases.push(...batch);if(batch.length<100)break;}
  const byName=new Map(),errors=[];
  for(const release of releases.filter(r=>!r.draft&&!r.prerelease)){
    const manifestAsset=release.assets?.find(a=>a.name==='release-manifest.json');if(!manifestAsset)continue;
    try{
      const m=JSON.parse(await read(assetURL(manifestAsset.browser_download_url)));m.name??=m.project;
      if(!/^dsh-[a-z0-9-]+$/.test(m.name)||!/^\d+\.\d+\.\d+$/.test(m.version))throw new Error('包名或版本无效');
      const filename=`${m.name}-${m.version}.tgz`,a=release.assets.find(a=>a.name===filename),f=m.files?.[filename]||m.assets?.find(a=>a.file===filename);
      if(!a||!f||!Number.isSafeInteger(f.bytes)||f.bytes<=0||f.bytes>64*1024*1024||!/^([a-f0-9]{64})$/.test(f.sha256)||a.size!==f.bytes)throw new Error('安装包或SHA-256记录不完整');
      if(a.digest&&a.digest!=='sha256:'+f.sha256)throw new Error('GitHub与清单哈希不一致');
      const item={name:m.name,version:m.version,title:release.name||m.name,notes:(release.body||'').slice(0,12000),tag:release.tag_name,url:assetURL(a.browser_download_url),releaseURL:`https://github.com/${REPO}/releases/tag/${encodeURIComponent(release.tag_name)}`,sha256:f.sha256,bytes:f.bytes};
      if(!byName.has(m.name)||compare(item.version,byName.get(m.name).version)>0)byName.set(m.name,item);
    }catch(e){errors.push(`${release.tag_name}：${e.message}`);}
  }
  return {items:[...byName.values()].sort((a,b)=>a.name.localeCompare(b.name)),errors,checkedAt:new Date().toISOString()};
}
export function verifyPackage(data,item){
  if(data.length!==item.bytes||sha256(data)!==item.sha256)throw new Error('安装包SHA-256校验失败');
  const tar=gunzipSync(data,{maxOutputLength:128*1024*1024});let pkg;const seen=new Set();
  for(let at=0;at+512<=tar.length;){const h=tar.subarray(at,at+512);if(h.every(b=>b===0))break;const n=h.subarray(0,100).toString().split('\0')[0],size=parseInt(h.subarray(124,136).toString().replace(/\0/g,'').trim(),8);if(!n.startsWith('package/')||n.includes('..')||n.includes('\\')||!Number.isSafeInteger(size)||size<0||at+512+size>tar.length||![0,48].includes(h[156])||seen.has(n))throw new Error('安装包结构无效');seen.add(n);if(n==='package/package.json')pkg=JSON.parse(tar.subarray(at+512,at+512+size));at+=512+Math.ceil(size/512)*512;}
  if(pkg?.name!==item.name||pkg?.version!==item.version)throw new Error('安装包身份与Release不一致');
  if(Object.keys(pkg.scripts||{}).some(k=>['preinstall','install','postinstall'].includes(k)))throw new Error('安装包包含未允许的安装脚本');return pkg;
}
