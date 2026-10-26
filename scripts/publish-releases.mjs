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
    const isApi=plugin.pkg.name==='dsh-api-switcher', isUsage=plugin.pkg.name==='dsh-usage-statistics-panel', isControl=plugin.pkg.name==='dsh-control-bridge', isRepo=plugin.pkg.name==='dsh-repo-manager', isStory=plugin.pkg.name==='dsh-storydeck';
    const sourceName=`DSH-Plugins-${isApi?'Api-Switcher':isUsage?'Token-Usage':isControl?'DSH-Control':isRepo?'Repo-Manager':isStory?'StoryDeck':'Top-Directive'}-${plugin.version}-Source.zip`;
    const sourcePath=join(destination,sourceName);
    execFileSync('git',['archive','--format=zip',`--prefix=${plugin.pkg.name}-${plugin.version}/`,`--output=${sourcePath}`,`${context.sha}:${plugin.directory}/${plugin.version}`],{cwd:root});
    const names=isApi||isUsage||isControl||isRepo||isStory?[`${plugin.pkg.name}-${plugin.version}-Windows.zip`,`${plugin.pkg.name}-${plugin.version}.tgz`,'release-manifest.json']:[`${plugin.pkg.name}-${plugin.version}.tgz`,'Install-DSH.ps1','release-manifest.json'];
    const assets=names.map(name=>({name,data:readFileSync(join(plugin.releaseDirectory,name))}));
    assets.push({name:sourceName,data:readFileSync(sourcePath)});
    assets.push({name:'SHA256SUMS.txt',data:Buffer.from(assets.map(item=>`${hash(item.data)}  ${item.name}`).join('\n')+'\n')});
    const body=isRepo ? '鲸鱼娘插件仓库 '+plugin.version+'：新增仓库未安装插件计数与筛选，从GitHub Release动态发现新插件；已安装列表合并仅本地插件。通过DSH正式接口卸载，确认后执行并读回核验，保留用户数据，保护仓库管理器与控制桥。操作去重、失败诊断和待核对恢复覆盖卸载。'+plugin.version+'：修复从下方卡片更新时确认框跑出视口，自动滚动并聚焦确认按钮；安装后读回目标版本与源包SHA-256，无法确认则待核对；自更新恢复回执而不重复执行。区分进行中、完成、失败和待核对，保留完整诊断并显示ENOENT等根因。安装前检查缺失本地源包，补齐故事中控台卡片说明和透明图标，6张卡片缓存优先展示。29项回归及浏览器检查通过，安装验收见交付记录。' : isControl ? 'DSH Control Bridge 1.0.0：宿主结构化API与DOM控件树，无截图识别。配合独立Codex插件，提供持久化操作去重、真实回复读取、工作区与插件设置管理、动态Remote契约及流式控制。实际验收与边界见源码VALIDATION.md；Codex端源码与安装包位于ccl4-56-23-5/Codex-Plugins。' : isUsage ? '基于HaoyueQin/dsh-usage-statistics-panel0.3.2的MIT定制版。替换现有使用统计并保留历史数据与设置；保留左上角入口和方块热力图，移除缓存命中率折线、百分比轴与图例，新增透明大肥鱼Logo。详见源码README和VALIDATION；Windows ZIP内含安装器、TGZ、manifest与校验文件。' : isApi ? '按供应商地址、协议和模型适配思考控制：MiMo使用真实开关，已确认GPT/Claude使用实际支持的档位，未知组合不猜测。保留现有配置、自定义映射及凭据，支持添加原生协议来源。65项回归、145种真实宿主请求映射及真实API对照通过；重启加载后的桌面验收待完成。含Windows安装ZIP、TGZ、源码ZIP和SHA-256；实测范围见docs/VALIDATION.md。' : '新增最高指令透明logo和插件图标，右下角使用与Api-Switcher一致的大肥鱼角色。提示词保存与会话桥沿用1.1.1；通过宿主、图片路由和打包检查。下载TGZ与Install-DSH.ps1放在同一目录，退出DSH后运行安装器。真实模型的历史验收范围见源码docs/VALIDATION.md。';
    const releaseBody=isStory?'故事中控台 StoryDeck '+plugin.version+'：入口改为右上角灰蓝两头身鲸鱼娘，双手抓绳；相对审核预览宽高各缩为1/3、面积为1/9，宽35px。以绳顶为支点轻微摆动，悬停、键盘聚焦和弹窗打开时暂停，并支持减少动态效果。沿用世界书、多书条目选择及按真实会话隔离的剧情状态；不改变用户数据格式。含Windows ZIP、TGZ、源码和SHA-256，更新后实际桌面验收由用户手动更新完成。':body;
    let release;
    try { release=(await github.rest.repos.getReleaseByTag({...scope,tag:plugin.tag})).data; }
    catch(error) { if(error.status!==404)throw error; release=(await github.rest.repos.createRelease({...scope,tag_name:plugin.tag,target_commitish:context.sha,name:`${plugin.directory}${plugin.version}`,body:releaseBody,draft:true,prerelease:false})).data; }
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
    await github.rest.repos.updateRelease({...scope,release_id:release.id,name:`${plugin.directory}${plugin.version}`,body:releaseBody,draft:false,prerelease:false,make_latest:isApi?'true':'false'});
    await verifyDownloads(release);
    core.info(`Published and verified ${plugin.tag}`);
    await core.summary.addHeading(`${plugin.directory}${plugin.version}`).addLink('Release',release.html_url).addRaw('\n').write();
  }
  // Remove old DSH releases only after BOTH latest releases have verified assets.
  const oldReleases=await github.paginate(github.rest.repos.listReleases,{...scope,per_page:100});
  for(const release of oldReleases) {
    if(!/^(?:api-switcher|top-directive|token-usage|dsh-control|repo-manager|storydeck)-v\d+\.\d+\.\d+$/.test(release.tag_name)||kept.has(release.tag_name))continue;
    await github.rest.repos.deleteRelease({...scope,release_id:release.id}); core.info(`Removed old release ${release.tag_name}`);
  }
  const tags=await github.paginate(github.rest.git.listMatchingRefs,{...scope,ref:'tags/'});
  for(const tag of tags) {
    const name=tag.ref.slice('refs/tags/'.length);
    if(!/^(?:api-switcher|top-directive|token-usage|dsh-control|repo-manager|storydeck)-v\d+\.\d+\.\d+$/.test(name)||kept.has(name))continue;
    await github.rest.git.deleteRef({...scope,ref:`tags/${name}`}); core.info(`Removed old version tag ${name}`);
  }
}
