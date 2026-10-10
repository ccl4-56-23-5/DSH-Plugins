import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { createLogoStore, imageType, logoCandidates, publicLogoURL, privateAddress } from '../lib/logos.js'
mkdirSync(new URL('../.work/logo-tests/',import.meta.url),{recursive:true})
test('logo discovery supports real HTML quote variants, rejects nonpublic URLs and executable SVG',()=>{
  assert.deepEqual(logoCandidates("<link href='https://static.apiyi.com/apiyi-logo.png' rel='icon'>",'https://api.apiyi.com'),['https://static.apiyi.com/apiyi-logo.png','https://api.apiyi.com/favicon.ico'])
  for(const u of['http://example.com/icon.png','https://127.0.0.1/icon','https://10.0.0.3/a','https://[::1]/a','https://localhost/a','https://user:password@example.com/a'])assert.throws(()=>publicLogoURL(u))
  for(const ip of['127.0.0.1','10.1.2.3','172.16.1.1','192.168.0.1','169.254.1.1','::ffff:127.0.0.1','fc00::1'])assert.equal(privateAddress(ip),true)
  assert.equal(privateAddress('1.1.1.1'),false)
  assert.throws(()=>imageType(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>')))
  assert.equal(imageType(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><path d="M0 0"/></svg>')),'image/svg+xml')
})
test('logo fetching caches the supplier image and deduplicates concurrent work without using credentials',async()=>{
  const calls=[],folder=mkdtempSync(fileURLToPath(new URL('../.work/logo-tests/case-',import.meta.url)))
  const bytes=Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><rect width="32" height="32"/></svg>')
  const cache=createLogoStore(folder,async url=>{calls.push(url);return url.endsWith('/icon.svg')?{bytes,type:'image/svg+xml'}:{bytes:Buffer.from('<html><link rel="icon" href="/icon.svg"></html>'),type:'text/html'}})
  const [a,b]=await Promise.all([cache.refresh('https://provider.example'),cache.refresh('https://provider.example')]);assert.equal(a.hash,b.hash);assert.deepEqual(calls,['https://provider.example','https://provider.example/icon.svg']);assert.equal(cache.read('https://provider.example').bytes.toString(),bytes.toString());await cache.refresh('https://provider.example');assert.equal(calls.length,2)
})
