import assert from 'node:assert/strict';
import { readFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { checkRepository, plugins, root } from './check-repository.mjs';
const hash=data=>createHash('sha256').update(data).digest('hex');
export default async function publish({github,context,core}) {
  assert.equal(context.repo.owner,'ccl4-56-23-5'); assert.equal(context.repo.repo,'DSH-Plugins');
  checkRepository();
  const scope=context.repo, current=plugins(), kept=new Set(current.map(item=>item.tag));
  const latest=await github.rest.repos.getBranch({...scope,branch:'main'});
  assert.equal(latest.data.commit.sha,context.sha,'Do not publish an obsolete commit');
  const destination=join(root,'.work/publication'); mkdirSync(destination,{recursive:true});
  async function verifyDownloads(release) {
    const assets=await github.paginate(github.rest.repos.listReleaseAssets,{...scope,release_id:release.id,per_page:100});
    assert.equal(assets.length,5);
    for(const asset of assets) {
      const response=await fetch(asset.browser_download_url);
      assert.ok(response.ok,`Release download failed: ${asset.name} ${response.status}`);
      const bytes=Buffer.from(await response.arrayBuffer());
      assert.equal(bytes.length,asset.size);assert.equal('sha256:'+hash(bytes),asset.digest);
    }
  }
  for(const plugin of current) {
    let published;
    try { published=(await github.rest.repos.getReleaseByTag({...scope,tag:plugin.tag})).data; } catch(error) { if(error.status!==404)throw error; }
    // Leave an unchanged plugin and its release assets byte-for-byte intact.
    if(published&&!published.draft) {
      const expected=[`${plugin.pkg.name}-${plugin.version}.tgz`,'release-manifest.json'];
      if(expected.every(name=>published.assets.some(a=>a.name===name&&a.digest==='sha256:'+hash(readFileSync(join(plugin.releaseDirectory,name)))))) {
        await verifyDownloads(published);core.info(`Verified unchanged ${plugin.tag}`);continue;
      }
    }
    const isApi=plugin.pkg.name==='dsh-api-switcher';
    const sourceName=`DSH-Plugins-${isApi?'Api-Switcher':'Top-Directive'}-${plugin.version}-Source.zip`;
    const sourcePath=join(destination,sourceName);
    execFileSync('git',['archive','--format=zip',`--prefix=${plugin.pkg.name}-${plugin.version}/`,`--output=${sourcePath}`,`${context.sha}:${plugin.directory}/${plugin.version}`],{cwd:root});
    const names=isApi?[`${plugin.pkg.name}-${plugin.version}-Windows.zip`,`${plugin.pkg.name}-${plugin.version}.tgz`,'release-manifest.json']:[`${plugin.pkg.name}-${plugin.version}.tgz`,'Install-DSH.ps1','release-manifest.json'];
    const assets=names.map(name=>({name,data:readFileSync(join(plugin.releaseDirectory,name))}));
    assets.push({name:sourceName,data:readFileSync(sourcePath)});
    assets.push({name:'SHA256SUMS.txt',data:Buffer.from(assets.map(item=>`${hash(item.data)}  ${item.name}`).join('\n')+'\n')});
    const body=isApi ? '修复MiMo图片输入与模型能力声明、同步字段和旧配置迁移。审查236个内置条目，未知能力明确标注；自动同步保留手动设置。40项离线测试通过。含Windows安装ZIP、TGZ、独立源码ZIP和SHA-256；实际验证范围见docs/VALIDATION.md。' : '新增最高指令透明logo和插件图标，右下角使用与Api-Switcher一致的大肥鱼角色。提示词保存与会话桥沿用1.1.1；通过宿主、图片路由和打包检查。下载TGZ与Install-DSH.ps1放在同一目录，退出DSH后运行安装器。真实模型的历史验收范围见源码docs/VALIDATION.md。';
    let release;
    try { release=(await github.rest.repos.getReleaseByTag({...scope,tag:plugin.tag})).data; }
    catch(error) { if(error.status!==404)throw error; release=(await github.rest.repos.createRelease({...scope,tag_name:plugin.tag,target_commitish:context.sha,name:`${plugin.directory}${plugin.version}`,body,draft:true,prerelease:false})).data; }
    let existing=await github.paginate(github.rest.repos.listReleaseAssets,{...scope,release_id:release.id,per_page:100});
    for(const asset of assets) {
      const digest='sha256:'+hash(asset.data), previous=existing.find(item=>item.name===asset.name);
      if(previous&&previous.digest===digest&&previous.size===asset.data.length)continue;
      if(previous)await github.rest.repos.deleteReleaseAsset({...scope,asset_id:previous.id});
      const uploaded=(await github.rest.repos.uploadReleaseAsset({...scope,release_id:release.id,name:asset.name,data:asset.data,headers:{'content-type':asset.name.endsWith('.zip')?'application/zip':'application/octet-stream','content-length':asset.data.length}})).data;
      assert.equal(uploaded.digest,digest); assert.equal(uploaded.size,asset.data.length);
    }
    existing=await github.paginate(github.rest.repos.listReleaseAssets,{...scope,release_id:release.id,per_page:100});
    for(const asset of assets)assert.ok(existing.some(item=>item.name===asset.name&&item.digest==='sha256:'+hash(asset.data)&&item.size===asset.data.length));
    await github.rest.repos.updateRelease({...scope,release_id:release.id,name:`${plugin.directory}${plugin.version}`,body,draft:false,prerelease:false,make_latest:isApi?'true':'false'});
    await verifyDownloads(release);
    core.info(`Published and verified ${plugin.tag}`);
    await core.summary.addHeading(`${plugin.directory}${plugin.version}`).addLink('Release',release.html_url).addRaw('\n').write();
  }
  // Remove old DSH releases only after BOTH latest releases have verified assets.
  const oldReleases=await github.paginate(github.rest.repos.listReleases,{...scope,per_page:100});
  for(const release of oldReleases) {
    if(!/^(?:api-switcher|top-directive)-v\d+\.\d+\.\d+$/.test(release.tag_name)||kept.has(release.tag_name))continue;
    await github.rest.repos.deleteRelease({...scope,release_id:release.id}); core.info(`Removed old release ${release.tag_name}`);
  }
  const tags=await github.paginate(github.rest.git.listMatchingRefs,{...scope,ref:'tags/'});
  for(const tag of tags) {
    const name=tag.ref.slice('refs/tags/'.length);
    if(!/^(?:api-switcher|top-directive)-v\d+\.\d+\.\d+$/.test(name)||kept.has(name))continue;
    await github.rest.git.deleteRef({...scope,ref:`tags/${name}`}); core.info(`Removed old version tag ${name}`);
  }
}
