import test from 'node:test';
import assert from 'node:assert/strict';
import { AgentRuntime } from '@elizaos/core';
import { createRuntimePlugin, HeistoClient, guardedIngress } from '../dist/index.mjs';

// Real framework class; controlled transport and public fixture data.
// No database initialization, bootstrap model, chat channel or paid AI provider.
const id = '3544635135356959125';
function runtime(name = 'Heisto compatibility test', sentinelId = id) {
  return new AgentRuntime({
    character: { name, bio: 'Isolated plugin compatibility fixture', settings: { HEISTO_SENTINEL_ID: sentinelId }, plugins: [] },
    settings: { HEISTO_SENTINEL_ID: sentinelId },
    logLevel: 'error',
  });
}
const fixture = score => ({ score, action: score < .3 ? 'allow' : score < .6 ? 'flag' : 'block',
  categories: [], method: 'heuristic-rules-v2', owasp: 'LLM01', warning: 'Controlled fixture.' });
const reply = value => new Response(JSON.stringify(value), { headers: { 'Content-Type': 'application/json' } });

test('real AgentRuntime registers loadable plugin and executes provider/action', async () => {
  const r = runtime();
  let count = 0;
  const p = createRuntimePlugin({ client: new HeistoClient({ fetchImpl: async () => { count++; return reply(fixture(.03)); } }) });
  await r.registerPlugin(p);
  assert.equal(count, 0);
  assert.ok(r.plugins.some(x => x.name === 'heisto-guard'));
  const provider = r.providers.find(x => x.name === 'HEISTO_PROFILE');
  assert.equal((await provider.get(r)).data.sentinelId, id);
  const action = r.actions.find(x => x.name === 'HEISTO_CHECK_INPUT');
  assert.equal(await action.validate(r), true);
  const result = await action.handler(r, { content: { text: 'What are the public opening hours?' } });
  assert.equal(result.data.decision.route, 'proceed');
  assert.equal(count, 1);
});
test('real AgentRuntime rejects missing configuration without registering actions', async () => {
  const r = runtime('Missing configuration', '');
  await assert.rejects(r.registerPlugin(createRuntimePlugin()));
  assert.equal(r.actions.some(x => x.name === 'HEISTO_CHECK_INPUT'), false);
});
test('one plugin instance registers in two real runtimes without leaking profile IDs', async () => {
  const p = createRuntimePlugin();
  const a = runtime('Fixture A', '1'), b = runtime('Fixture B', '2');
  await a.registerPlugin(p); await b.registerPlugin(p);
  assert.equal((await a.providers.find(x => x.name === 'HEISTO_PROFILE').get(a)).data.sentinelId, '1');
  assert.equal((await b.providers.find(x => x.name === 'HEISTO_PROFILE').get(b)).data.sentinelId, '2');
});
test('real runtime registered action is never reached on denied ingress', async () => {
  const r = runtime();
  const allow = new HeistoClient({ fetchImpl: async () => reply(fixture(.03)) });
  await r.registerPlugin(createRuntimePlugin({ client: allow }));
  const action = r.actions.find(x => x.name === 'HEISTO_CHECK_INPUT');
  for (const score of [.33, .98]) {
    let called = 0;
    const checked = await guardedIngress({ content: { text: 'Public fixture' } }, async msg => {
      called++; return action.handler(r, msg);
    }, new HeistoClient({ fetchImpl: async () => reply(fixture(score)) }));
    assert.equal(checked.delivered, false);
    assert.equal(called, 0);
  }
});
test('real runtime evidence action reads filtered public fixtures', async () => {
  const r = runtime();
  const c = new HeistoClient({ fetchImpl: async (_url, init) => {
    const tool = JSON.parse(init.body).params.name;
    const data = tool === 'get_sentinel'
      ? { id, name: 'Explicit fixture', network: 'mainnet', status: 'live', poolLamports: '0', attackCount: 0, hidden: 'must not escape' }
      : { sentinelId: id, attempts: [] };
    return reply({ jsonrpc: '2.0', id: 1, result: { structuredContent: data } });
  } });
  await r.registerPlugin(createRuntimePlugin({ client: c }));
  const result = await r.actions.find(x => x.name === 'HEISTO_PUBLIC_EVIDENCE').handler(r, {});
  assert.equal(result.success, true);
  assert.equal(result.data.profile.data.id, id);
  assert.ok(!JSON.stringify(result).includes('must not escape'));
});
