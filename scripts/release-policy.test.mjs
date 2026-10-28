import {test} from 'node:test';import assert from 'node:assert/strict';
import {retentionPlan,promoteRelease} from './release-policy.mjs';
const rel=(id,tag,prerelease=false)=>({id,tag_name:tag,prerelease,draft:false,published_at:new Date(id*1000).toISOString()});
test('automatic retention keeps every stable and the newest two tests for each plugin',()=>{
 const stable=rel(1,'storydeck-v0.7.1'),tests=[2,3,4].map((i)=>rel(i,'storydeck-v0.'+i+'.0',true));
 const manager=rel(5,'repo-manager-v1.2.3');const draft={...rel(8,'storydeck-v0.9.0',true),draft:true};
 assert.deepEqual(retentionPlan([stable,...tests,manager,draft]).map(x=>x.id),[2]);assert.deepEqual(retentionPlan([stable,manager]),[]);
});
test('explicit promotion verifies before mutation and never alters other plugins or test assets',async()=>{
 const old=rel(1,'storydeck-v0.7.1'),target=rel(2,'storydeck-v0.8.0',true),other=rel(3,'repo-manager-v1.2.3'),calls=[];
 const github={paginate:async()=>[old,{...target,prerelease:false},other],rest:{repos:{getReleaseByTag:async()=>({data:target}),listReleases:()=>{},updateRelease:async p=>calls.push(['update',p]),deleteRelease:async p=>calls.push(['delete',p.release_id])},git:{deleteRef:async p=>calls.push(['tag',p.ref])}}};
 await promoteRelease({github,scope:{owner:'o',repo:'r'},tag:target.tag_name,verify:async()=>calls.push(['verify'])});assert.deepEqual(calls.map(c=>c[0]),['verify','update','verify','delete','tag']);assert.equal(calls[3][1],old.id);assert.equal(calls[1][1].prerelease,false);
});
test('failed promotion verification preserves the stable release',async()=>{
 let mutations=0;const github={rest:{repos:{getReleaseByTag:async()=>({data:rel(2,'storydeck-v0.8.0',true)}),updateRelease:async()=>mutations++}}};
 await assert.rejects(promoteRelease({github,scope:{},tag:'storydeck-v0.8.0',verify:async()=>{throw Error('bad asset');}}),/bad asset/);assert.equal(mutations,0);
});
