import test from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { once } from 'node:events'
import { buildRoute } from '../lib/http.js'
test('HTTP boundary rejects cross-site writes, wrong content types, malformed JSON, and unimplemented methods', async t => {
  let saves = 0
  const controller = { state: async () => ({ version: '1.0.0' }), save: async () => { saves++; return {} } }
  const server = createServer(buildRoute(controller).handler)
  server.listen(0, '127.0.0.1'); await once(server, 'listening')
  t.after(() => server.close())
  const url = `http://127.0.0.1:${server.address().port}/api-switcher/api/`
  const get = await fetch(url + 'state'); assert.equal(get.status, 200)
  const forbidden = await fetch(url + 'sources', { method: 'POST', headers: { 'content-type': 'application/json', origin: 'https://evil.test' }, body: '{}' }); assert.equal(forbidden.status, 403)
  const plain = await fetch(url + 'sources', { method: 'POST', body: '{}' }); assert.equal(plain.status, 415)
  const malformed = await fetch(url + 'sources', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '[' }); assert.equal(malformed.status, 400)
  const unknown = await fetch(url + 'constructor', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' }); assert.equal(unknown.status, 404)
  assert.equal(saves, 0)
  const brand=await fetch(url+'brand');assert.equal(brand.headers.get('content-type'),'image/png');assert.ok(brand.headers.get('content-security-policy').includes('sandbox'));const png=Buffer.from(await brand.arrayBuffer());assert.equal(png.subarray(0,8).toString('hex'),'89504e470d0a1a0a');assert.equal(png[25],6);assert.equal(png.readUInt32BE(16),512)
  const styles=await fetch(url+'styles');assert.equal(styles.status,200);assert.ok(styles.headers.get('content-type').startsWith('text/css'))
})
