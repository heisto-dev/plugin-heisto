import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import plugin, { createRuntimePlugin, createHeistoPlugin, guardedIngress, HeistoClient } from '../dist/index.mjs';

const id = '3544635135356959125'; // Public identifier; responses below are fixtures.
const runtime = { getSetting: key => key === 'HEISTO_SENTINEL_ID' ? id : undefined };
const fixture = score => ({
  score, action: score < .3 ? 'allow' : score < .6 ? 'flag' : 'block',
  categories: [], method: 'heuristic-rules-v2', owasp: 'LLM01', warning: 'Controlled test fixture, not a safety guarantee.',
});
const response = data => new Response(JSON.stringify(data), { headers: { 'Content-Type': 'application/json' } });
const clientFor = data => new HeistoClient({ fetchImpl: async () => response(data) });

test('default export is a loadable plugin object, named exports retain existing adapter', () => {
  assert.equal(plugin.name, 'heisto-guard');
  assert.equal(typeof plugin.init, 'function');
  assert.equal(typeof createHeistoPlugin, 'function');
  assert.equal(plugin.events, undefined);
  assert.equal(plugin.models, undefined);
  assert.equal(plugin.evaluators, undefined);
});
test('no outbound request during import, construction, initialization or profile provider', async () => {
  let calls = 0;
  const p = createRuntimePlugin({ client: new HeistoClient({ fetchImpl: async () => { calls++; throw Error(); } }) });
  await p.init({}, runtime);
  const result = await p.providers[0].get(runtime);
  assert.equal(result.data.association, 'self-declared');
  assert.equal(calls, 0);
});
test('missing/invalid profile configuration is rejected', async () => {
  const p = createRuntimePlugin();
  for (const value of [undefined, '', '01', 123, '../profile', '18446744073709551616']) {
    const r = { getSetting: () => value };
    await assert.rejects(p.init({}, r));
    assert.equal(await p.actions[0].validate(r), false);
  }
});
test('same plugin object keeps runtime configuration isolated', async () => {
  const p = createRuntimePlugin();
  const a = {}, b = {};
  await p.init({ HEISTO_SENTINEL_ID: '1' }, a);
  await p.init({ HEISTO_SENTINEL_ID: '2' }, b);
  assert.equal((await p.providers[0].get(a)).data.sentinelId, '1');
  assert.equal((await p.providers[0].get(b)).data.sentinelId, '2');
});
for (const [score, route, delivered] of [[.03, 'proceed', true], [.33, 'review', false], [.98, 'block', false]]) {
  test(`${route} controls actual downstream invocation`, async () => {
    let count = 0;
    const result = await guardedIngress({ content: { text: 'Public test text' } }, () => ++count, clientFor(fixture(score)));
    assert.equal(result.delivered, delivered);
    assert.equal(result.decision.route, route);
    assert.equal(count, Number(delivered));
  });
}
for (const data of [{}, { ...fixture(.98), action: 'allow' }, null]) {
  test(`malformed response ${JSON.stringify(data)} stops downstream`, async () => {
    const result = await guardedIngress({ content: { text: 'Public test' } }, () => assert.fail('must stop'), clientFor(data));
    assert.equal(result.delivered, false);
    assert.equal(result.decision.route, 'unavailable');
  });
}
test('HTTP failure/timeout/rejected redirect stops without retry or internal error disclosure', async () => {
  for (const mode of ['http', 'timeout', 'redirect']) {
    let calls = 0;
    const c = new HeistoClient({ fetchImpl: async (_url, init) => {
      calls++;
      assert.equal(init.redirect, 'error');
      if (mode === 'http') return new Response('', { status: 429 });
      throw Error('Internal diagnostic must not be returned');
    } });
    const result = await guardedIngress({ content: { text: 'Public test' } }, () => assert.fail(), c);
    assert.equal(result.delivered, false);
    assert.equal(calls, 1);
    assert.ok(!JSON.stringify(result).includes('Internal diagnostic'));
  }
});
test('attachments, extra content and overlong text never call the API', async () => {
  let count = 0;
  const c = new HeistoClient({ fetchImpl: async () => { count++; throw Error(); } });
  for (const content of [{ text: 'x', attachments: [{}] }, { text: 'x', image: 'unchecked' }, { text: 'x'.repeat(4001) }])
    assert.equal((await guardedIngress({ content }, () => assert.fail(), c)).delivered, false);
  assert.equal(count, 0);
});
test('checked text snapshot is what downstream receives', async () => {
  const message = { content: { text: 'original' } };
  const c = new HeistoClient({ fetchImpl: async () => {
    message.content.text = 'unchecked replacement'; return response(fixture(.03));
  } });
  const result = await guardedIngress(message, x => x.content.text, c);
  assert.equal(result.result, 'original');
});
test('on-demand action calls existing client and returns route without input text', async () => {
  const p = createRuntimePlugin({ client: clientFor(fixture(.98)) });
  await p.init({}, runtime);
  const result = await p.actions[0].handler(runtime, { content: { text: 'Do not echo this test text' } });
  assert.equal(result.data.decision.route, 'block');
  assert.ok(!JSON.stringify(result).includes('Do not echo this test text'));
});
test('unavailable evidence is not misrepresented as verified or an empty successful result', async () => {
  const p = createRuntimePlugin({ client: clientFor({}) });
  const result = await p.actions[1].handler(runtime, {});
  assert.equal(result.success, false);
  assert.match(result.text, /unavailable/);
});
test('package has no runtime dependencies or install hooks', async () => {
  const pkg = JSON.parse(await fs.readFile(new URL('../package.json', import.meta.url)));
  assert.equal(pkg.dependencies, undefined);
  for (const hook of ['install', 'postinstall', 'preinstall']) assert.equal(pkg.scripts[hook], undefined);
  assert.equal(pkg.devDependencies['@elizaos/core'], '2.0.5');
});
