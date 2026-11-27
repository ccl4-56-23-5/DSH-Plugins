import test from 'node:test'
import assert from 'node:assert/strict'
import { createServer, request } from 'node:http'
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
  const lookalike = await fetch(url + 'sources', {method:'POST',headers:{'content-type':'application/json-not-json'},body:'{}'}); assert.equal(lookalike.status,415)
  assert.equal(saves, 0)
  const brand=await fetch(url+'brand');assert.equal(brand.headers.get('content-type'),'image/png');assert.ok(brand.headers.get('content-security-policy').includes('sandbox'));const png=Buffer.from(await brand.arrayBuffer());assert.equal(png.subarray(0,8).toString('hex'),'89504e470d0a1a0a');assert.equal(png[25],6);assert.equal(png.readUInt32BE(16),512)
  const styles=await fetch(url+'styles');assert.equal(styles.status,200);assert.ok(styles.headers.get('content-type').startsWith('text/css'))
})

test('credential requests support DSH forwarding while rejecting unmarked or foreign requests', async t => {
  const requests = []
  const server = createServer(buildRoute({
    revealCredential: async body => {
      requests.push(body)
      return { apiKey: 'fixture-key' }
    }
  }).handler)
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  t.after(() => server.close())
  const origin = 'http://127.0.0.1:' + server.address().port
  const url = origin + '/api-switcher/api/credential'
  const post = headers => new Promise((resolve, reject) => {
    const req = request(url, { method: 'POST', headers: { 'content-type': 'application/json', ...headers } }, async res => {
      const chunks = []
      for await (const chunk of res) chunks.push(chunk)
      resolve({ status: res.statusCode, headers: res.headers, body: JSON.parse(Buffer.concat(chunks)) })
    })
    req.on('error', reject)
    req.end('{"provider":"existing"}')
  })
  assert.equal((await fetch(url)).status, 404)
  assert.equal((await post({ origin })).status, 403)
  assert.equal((await post({ 'sec-fetch-site': 'same-origin' })).status, 403)
  assert.equal((await post({ origin, 'sec-fetch-site': 'same-origin' })).status, 403)
  const marker = { 'x-dsh-api-switcher': '1' }
  assert.equal((await post({ ...marker, origin, 'sec-fetch-site': 'same-site' })).status, 403)
  assert.equal((await post({ ...marker, origin: 'https://other.test', 'sec-fetch-site': 'cross-site' })).status, 403)
  assert.equal((await post({ ...marker, origin: origin.replace('http:', 'https:') })).status, 403)
  assert.equal((await post({ ...marker, origin: 'null' })).status, 403)
  assert.equal(requests.length, 0)

  for (const headers of [marker, { ...marker, origin, 'sec-fetch-site': 'same-origin' }]) {
    const response = await post(headers)
    assert.equal(response.status, 200)
    assert.equal(response.headers['cache-control'], 'no-store')
    assert.equal(response.headers['cross-origin-resource-policy'], 'same-origin')
    assert.deepEqual(response.body, { ok: true, value: { apiKey: 'fixture-key' } })
  }
  assert.deepEqual(requests, [{ provider: 'existing' }, { provider: 'existing' }])
})
