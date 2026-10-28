import assert from 'node:assert/strict';
export const RELEASE_TAG=/^(api-switcher|top-directive|token-usage|dsh-control|repo-manager|storydeck)-v\d+\.\d+\.\d+$/;
export function retentionPlan(releases){
  const groups=new Map();
  for(const release of releases){const match=RELEASE_TAG.exec(release.tag_name);if(!match||release.draft)continue;if(!groups.has(match[1]))groups.set(match[1],[]);groups.get(match[1]).push(release);}
  const remove=[];
  for(const group of groups.values()){
    // Stable releases can only be replaced by an explicit promotion.
    const tests=group.filter(r=>r.prerelease).sort((a,b)=>Date.parse(b.published_at||b.created_at||0)-Date.parse(a.published_at||a.created_at||0)||b.id-a.id);
    remove.push(...tests.slice(2));
  }
  return remove;
}
export async function promoteRelease({github,scope,tag,verify}){
  const match=RELEASE_TAG.exec(tag);assert.ok(match,'Choose an existing plugin test tag');
  const target=(await github.rest.repos.getReleaseByTag({...scope,tag})).data;
  assert.ok(!target.draft,'A draft cannot be promoted');await verify(target);
  await github.rest.repos.updateRelease({...scope,release_id:target.id,prerelease:false,make_latest:match[1]==='api-switcher'?'true':'false'});
  await verify(target);
  const releases=await github.paginate(github.rest.repos.listReleases,{...scope,per_page:100});
  for(const old of releases){if(old.id===target.id||old.draft||old.prerelease||!old.tag_name.startsWith(match[1]+'-v')||!RELEASE_TAG.test(old.tag_name))continue;
    await github.rest.repos.deleteRelease({...scope,release_id:old.id});await github.rest.git.deleteRef({...scope,ref:'tags/'+old.tag_name});
  }
  return target;
}
