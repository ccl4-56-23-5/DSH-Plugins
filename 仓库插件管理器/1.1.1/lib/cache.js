import {readFileSync,writeFileSync,renameSync,unlinkSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {REPO,assetURL} from './catalog.js';

export const KNOWN_PLUGINS = [
  ['dsh-api-switcher','Api-Switcher'], ['dsh-control-bridge','DSH控制桥'],
  ['dsh-repo-manager','鲸鱼娘插件仓库'], ['dsh-top-directive','最高指令'],
  ['dsh-usage-statistics-panel','使用统计'],
  ['dsh-storydeck','故事中控台'],
];
const MAX_BYTES=4*1024*1024;
export function normalizeCatalog(value) {
  if(!value||!Array.isArray(value.items)||value.items.length>200)throw new Error('仓库缓存格式无效');
  const checkedAt=value.checkedAt||new Date().toISOString();
  if(!Number.isFinite(Date.parse(checkedAt))||Date.parse(checkedAt)>Date.now()+300000)throw new Error('仓库缓存时间无效');
  const seen=new Set();
  const items=value.items.map(i=>{
    if(!i||!/^dsh-[a-z0-9-]{1,100}$/.test(i.name)||seen.has(i.name)||!/^\d+\.\d+\.\d+$/.test(i.version)||!Number.isSafeInteger(i.bytes)||i.bytes<=0||i.bytes>64*1024*1024||! /^[a-f0-9]{64}$/.test(i.sha256))throw new Error('仓库缓存插件记录无效');
    seen.add(i.name);
    const url=assetURL(i.url),tag=typeof i.tag==='string'?i.tag:new URL(url).pathname.split('/')[5];
    if(!tag||tag.length>200)throw new Error('发布标签无效');
    return {name:i.name,version:i.version,bytes:i.bytes,sha256:i.sha256,url,tag,title:String(i.title||i.name).slice(0,200),notes:String(i.notes||'').slice(0,12000),releaseURL:`https://github.com/${REPO}/releases/tag/${encodeURIComponent(tag)}`};
  });
  return {items,checkedAt,errors:Array.isArray(value.errors)?value.errors.map(String).slice(0,200):[]};
}
export function readCatalogCache(path){
  try{const b=readFileSync(path);if(b.length>MAX_BYTES)throw new Error('仓库缓存过大');const v=JSON.parse(b.toString('utf8'));
    if(v.schema!==1||v.repo!==REPO||typeof v.catalog?.checkedAt!=='string')throw new Error('仓库缓存版本或来源无效');
    return {catalog:normalizeCatalog(v.catalog),warning:null};
  }catch(e){return {catalog:null,warning:e.code==='ENOENT'?null:'缓存不可用，正在使用本地插件信息'};}
}
export function writeCatalogCache(path,catalog){
  const data=JSON.stringify({schema:1,repo:REPO,catalog:normalizeCatalog(catalog)});
  if(Buffer.byteLength(data)>MAX_BYTES)throw new Error('仓库缓存过大');
  const temp=path+'.'+randomUUID()+'.tmp';
  try{writeFileSync(temp,data,{encoding:'utf8',mode:0o600});renameSync(temp,path);}finally{try{unlinkSync(temp);}catch{}}
}
export function localCatalog(){return KNOWN_PLUGINS.map(([name,title])=>({name,title,version:null,notes:'',releaseURL:`https://github.com/${REPO}/releases`,url:null,sha256:null,bytes:null}));}
