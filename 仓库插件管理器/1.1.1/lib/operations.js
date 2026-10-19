import { existsSync,readFileSync } from 'node:fs';
import { isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';
import { sha256 } from './catalog.js';
export function localSource(source){
  if(typeof source!=='string'||!source.startsWith('file:'))return null;
  try{if(source.startsWith('file://'))return fileURLToPath(source);}catch{return null;}
  const path=source.slice(5);return isAbsolute(path)||/^[A-Za-z]:[/\\]/.test(path)?path:null;
}
export function checkSources(bundles){
  for(const bundle of bundles){if(bundle.installed===false)continue;const path=localSource(bundle.source);
    if(path&&!existsSync(path))throw new Error('已安装插件 '+bundle.name+' 的本地安装源不存在：'+path+'。请先恢复该安装包或重新安装此插件，再更新；未执行安装。');
  }
}
export function installedTarget(bundle,target){
  if(!bundle||bundle.installed===false||bundle.version!==target?.version||(target.preserveDisabled&&bundle.enabled!==false))return false;
  const path=localSource(bundle.source);if(!path)return false;
  try{return sha256(readFileSync(path))===target.sha256;}catch{return false;}
}
export function diagnostic(error){
  let value=error instanceof Error?error.message:error;
  if(typeof value==='string'){try{value=JSON.parse(value);}catch{}}
  const detail=String(typeof value==='object'&&value!==null?value.diagnostic||value.message||JSON.stringify(value):value||'未知错误').slice(-24000);
  const lines=detail.split(/\r?\n/).map(s=>s.trim()).filter(Boolean);
  const cause=lines.find(s=>/ENOENT|ERR_PNPM_|ENOTFOUND|ECONNREFUSED|ETIMEDOUT|already-installed|incompatible-version|not-bundle/i.test(s));
  return {message:(cause||lines.at(-1)||detail).slice(0,1200),detail};
}
