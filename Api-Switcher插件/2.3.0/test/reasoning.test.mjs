import test from 'node:test'
import assert from 'node:assert/strict'
import {reasoningRules,reasoningCapability,reasoningMode,reasoningStamp,applyReasoning} from '../lib/reasoning.js'
test('all published rules are scoped and have valid levels and explicit evidence',()=>{
  for(const r of reasoningRules){assert.ok(r.models.length);assert.ok(r.hosts.length);assert.match(r.source,/^https:/);assert.ok(Object.keys(r.efforts).some(k=>k!=='off'));if(r.defaultEffort)assert.ok(Object.hasOwn(r.efforts,r.defaultEffort));}
})
test('MiMo advertises a toggle, not fictitious low medium high tiers',()=>{
  const c=reasoningCapability('https://api.xiaomimimo.com/v1/','openai-completions','mimo-v2.6-flash')
  assert.equal(c.kind,'toggle');assert.deepEqual(c.efforts,{off:null,high:'high'});assert.equal(c.compat.supportsReasoningEffort,false)
  assert.equal(reasoningCapability('https://reseller.test/v1','openai-completions','mimo-v2.6-flash').status,'unknown')
  for(const url of ['http://api.xiaomimimo.com/v1','https://api.xiaomimimo.com:444/v1','https://api.xiaomimimo.com/v1?x=1','https://api.xiaomimimo.com/other'])assert.equal(reasoningCapability(url,'openai-completions','mimo-v2.6-flash').status,'unknown')
})
test('Claude native effort cannot be silently applied to the reseller chat protocol',()=>{
  const bad=reasoningCapability('https://api.apiyi.com/v1','openai-completions','claude-opus-4-8')
  assert.equal(bad.status,'protocol-required');assert.equal(bad.efforts,undefined)
  const ok=reasoningCapability('https://api.apiyi.com','anthropic-messages','claude-sonnet-4-6')
  assert.equal(ok.efforts.max,undefined);assert.equal(ok.efforts.xhigh,undefined);assert.equal(ok.compat.forceAdaptiveThinking,true)
})
test('automatic migration retains unrelated options; external edits become manual; protocol changes remove only owned fields',()=>{
  const cap=reasoningCapability('https://api.xiaomimimo.com/v1','openai-completions','mimo-v2.6-flash')
  const old={id:'mimo-v2.6-flash',maxTokens:12345,compat:{supportsStore:false},custom:7}
  const next=applyReasoning(old,cap,'auto'),stamp=reasoningStamp(next,Object.keys(cap.compat))
  const pref={modelReasoningModes:{[old.id]:'auto'},modelAutoReasoning:{[old.id]:stamp}}
  assert.equal(reasoningMode(pref,next),'auto');assert.equal(next.maxTokens,12345);assert.equal(next.compat.supportsStore,false)
  assert.deepEqual(applyReasoning(next,cap,'auto',stamp),next)
  const edited=structuredClone(next);edited.reasoningEfforts.high='custom';assert.equal(reasoningMode(pref,edited),'manual')
  assert.equal(reasoningMode({}, {id:'x',reasoningEfforts:false}),'manual')
  assert.deepEqual(applyReasoning(next,{status:'unknown'},'auto',stamp),old)
  assert.deepEqual(applyReasoning(next,cap,'default',stamp),old)
})
