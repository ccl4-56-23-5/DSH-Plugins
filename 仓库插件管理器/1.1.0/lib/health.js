// Runtime health is independent of the cached release catalog.
export function runtimeHealth(bundle, plugins, versionStatus, verified, error, checkedAt=new Date().toISOString()) {
  const result=(level,label,detail)=>({level,label,detail,checkedAt});
  if(!bundle)return result('gray','未安装','安装后检测运行状态');
  if(bundle.enabled===false)return result('gray','已停用','用户停用不视为运行异常');
  if(error||!Array.isArray(plugins))return result('gray','运行状态未知','无法读取DSH运行状态；请重新检测');
  const rows=Array.isArray(bundle.rows)?bundle.rows:[];
  if(!rows.length)return result('gray','运行状态未知','宿主未提供插件入口信息');
  const states=rows.map(row=>({row,plugin:plugins.find(p=>row.entryId?p.entryId===row.entryId:p.moduleName===row.moduleName)}));
  const failed=states.filter(({plugin})=>!plugin||plugin.enabled!==true||plugin.fiberPhase!=='active');
  if(failed.length)return result('red','运行异常',failed.map(({row,plugin})=>`${row.moduleName}: ${!plugin?'入口未加载':plugin.enabled!==true?'入口未启用':plugin.fiberPhase||'未激活'}`).join('；'));
  if(!verified)return result('gray','运行正常，版本待核对','DSH所有入口active；正在核对最新发布版本');
  if(versionStatus==='update')return result('yellow','运行正常，待更新','DSH所有入口active；可在本卡片更新插件');
  if(versionStatus==='current')return result('green','运行正常，已是最新','DSH所有入口active；版本与已验证发布一致。运行状态检测不替代每项功能实测。');
  return result('gray','运行正常，版本待核对',versionStatus==='newer'?'本地版本高于仓库发布':'无法比较本地与仓库版本');
}

export async function readRuntime(manager,timeoutMs=1500){
  if(typeof manager.listPlugins!=='function')return {plugins:null,error:true};
  let timer;
  try{return {plugins:await Promise.race([Promise.resolve().then(()=>manager.listPlugins()),new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('runtime timeout')),timeoutMs);})]),error:false};}
  catch{return {plugins:null,error:true};}finally{clearTimeout(timer);}
}
