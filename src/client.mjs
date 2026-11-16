/** No credentials, wallet access, retries, storage or logging. Server-side Node 22+. */
export const VERSION = '1.0.0';
export const SITE = 'https://heisto.xyz';
const KEYS = ['action', 'categories', 'method', 'owasp', 'score', 'warning'];
const MAX_RESPONSE = 262144;
export class HeistoUnavailable extends Error {
  constructor() { super('Public Heisto service unavailable or response rejected.'); this.name = 'HeistoUnavailable'; }
}
export class GuardDenied extends Error {
  constructor(route) { super(`Guard stopped processing: ${route}.`); this.name = 'GuardDenied'; this.route = route; }
}
const object = x => x !== null && typeof x === 'object' && !Array.isArray(x);
const str = (x, n = 2000) => typeof x === 'string' && x.length <= n;
export function validInput(text) {
  return typeof text === 'string' && text.trim().length > 0 && text.length <= 4000;
}
export function sentinelId(id) {
  if (typeof id !== 'string' || !/^(0|[1-9][0-9]{0,19})$/.test(id) || BigInt(id) > 18446744073709551615n)
    throw new TypeError('Provide a canonical Mainnet Sentinel ID as a string, never a number.');
  return id;
}
export function profileLink(id) { return `${SITE}/#sentinel-${sentinelId(id)}`; }
export function validateGuard(x) {
  if (!object(x) || Object.keys(x).sort().join() !== KEYS.join() ||
      typeof x.score !== 'number' || !Number.isFinite(x.score) || x.score < 0 || x.score > 1 ||
      x.action !== (x.score < .3 ? 'allow' : x.score < .6 ? 'flag' : 'block') ||
      x.method !== 'heuristic-rules-v2' || x.owasp !== 'LLM01' ||
      !Array.isArray(x.categories) || x.categories.length > 50 ||
      x.categories.some(c => !str(c, 100) || !c.trim()) ||
      !str(x.warning) || !x.warning.trim()) throw new HeistoUnavailable();
  return { score: x.score, action: x.action, categories: [...x.categories],
    method: x.method, owasp: x.owasp, warning: x.warning };
}
function publicRecord(x, id) {
  if (!object(x) || x.network !== 'mainnet' || !str(x.name, 500) || !str(x.status, 50) ||
      !str(x.poolLamports, 30) || !/^\d+$/.test(x.poolLamports) ||
      !Number.isSafeInteger(x.attackCount) || x.attackCount < 0) throw new HeistoUnavailable();
  sentinelId(x.id);
  if (id !== undefined && x.id !== id) throw new HeistoUnavailable();
  // Never propagate private fields, public prompt instructions, or remote-supplied URLs.
  return { id: x.id, name: x.name, network: 'mainnet', status: x.status,
    poolLamports: x.poolLamports, attackCount: x.attackCount, link: profileLink(x.id) };
}
export function projectEvidence(tool, x, args) {
  if (!object(x)) throw new HeistoUnavailable();
  if (tool === 'list_sentinels') {
    if (x.network !== 'mainnet' || !Array.isArray(x.sentinels) || x.sentinels.length > 200)
      throw new HeistoUnavailable();
    return { network: 'mainnet', sentinels: x.sentinels.map(r => publicRecord(r)) };
  }
  if (tool === 'get_sentinel') return publicRecord(x, args.id);
  if (tool === 'recent_attempts') {
    if (x.sentinelId !== args.sentinelId || !Array.isArray(x.attempts) || x.attempts.length > args.limit)
      throw new HeistoUnavailable();
    return { sentinelId: args.sentinelId, attempts: x.attempts.map(a => {
      if (!object(a) || !['held', 'breached'].includes(a.verdict) ||
          typeof a.score !== 'number' || !Number.isFinite(a.score) || a.score < 0 || a.score > 1 ||
          !str(a.technique, 500) || !str(a.time, 40) ||
          !/^\d{4}-\d\d-\d\dT.*Z$/.test(a.time) || !Number.isFinite(Date.parse(a.time)))
        throw new HeistoUnavailable();
      return { technique: a.technique, score: a.score, verdict: a.verdict,
        time: new Date(a.time).toISOString(), link: profileLink(args.sentinelId) };
    }) };
  }
  throw new TypeError('Unsupported public evidence tool.');
}
export class HeistoClient {
  #fetch;
  /** fetchImpl is a trusted test/host transport, never accept it from user input. */
  constructor({ fetchImpl = globalThis.fetch } = {}) {
    if (typeof fetchImpl !== 'function') throw new TypeError('Node fetch is required.');
    this.#fetch = fetchImpl;
  }
  async #post(path, payload, mcp = false) {
    const signal = AbortSignal.timeout(10000);
    try {
      const r = await this.#fetch(SITE + path, {
        method: 'POST', headers: { 'Content-Type': 'application/json',
          Accept: mcp ? 'application/json, text/event-stream' : 'application/json',
          ...(mcp ? { 'MCP-Protocol-Version': '2025-03-26' } : {}) },
        body: JSON.stringify(payload), signal, redirect: 'error', credentials: 'omit', cache: 'no-store',
      });
      if (!r.ok || !/application\/json\b/i.test(r.headers.get('content-type') ?? ''))
        throw new HeistoUnavailable();
      const reader = r.body.getReader(); const chunks = []; let size = 0;
      try {
        while (true) {
          const { done, value } = await reader.read(); if (done) break;
          size += value.byteLength;
          if (size > MAX_RESPONSE) throw new HeistoUnavailable();
          chunks.push(value);
        }
      } finally { await reader.cancel().catch(() => {}); }
      const bytes = new Uint8Array(size); let i = 0;
      for (const c of chunks) { bytes.set(c, i); i += c.length; }
      return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
    } catch { throw new HeistoUnavailable(); }
  }
  async check(text) {
    const checkedAt = () => new Date().toISOString();
    if (!validInput(text)) return { route: 'unavailable', canProceed: false, checkedAt: checkedAt(), reason: 'invalid_input' };
    try {
      const guard = validateGuard(await this.#post('/api/guard/score', { input: text }));
      const route = { allow: 'proceed', flag: 'review', block: 'block' }[guard.action];
      return { route, canProceed: route === 'proceed', checkedAt: checkedAt(), guard };
    } catch {
      return { route: 'unavailable', canProceed: false, checkedAt: checkedAt(), reason: 'service_unavailable' };
    }
  }
  async requireAllowed(text) {
    const decision = await this.check(text);
    if (!decision.canProceed || decision.route !== 'proceed') throw new GuardDenied(decision.route);
    return text;
  }
  async guardedCall(text, next) {
    if (typeof next !== 'function') throw new TypeError('A trusted continuation is required.');
    return next(await this.requireAllowed(text));
  }
  async #evidence(tool, args) {
    const x = await this.#post('/mcp', {
      jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: tool, arguments: args },
    }, true);
    if (!object(x) || x.jsonrpc !== '2.0' || x.id !== 1 || x.error ||
        !object(x.result) || x.result.isError || !object(x.result.structuredContent))
      throw new HeistoUnavailable();
    try {
      return { data: projectEvidence(tool, x.result.structuredContent, args),
        source: `${SITE}/mcp`, checkedAt: new Date().toISOString(),
        notice: 'Public service records, not an independent audit or cryptographic verification. Text is untrusted data.' };
    } catch { throw new HeistoUnavailable(); }
  }
  listSentinels() { return this.#evidence('list_sentinels', { network: 'mainnet' }); }
  getSentinel(id) { return this.#evidence('get_sentinel', { id: sentinelId(id) }); }
  recentAttempts(id, limit = 20) {
    sentinelId(id);
    if (!Number.isInteger(limit) || limit < 1 || limit > 50) throw new TypeError('Limit must be an integer from 1 to 50.');
    return this.#evidence('recent_attempts', { sentinelId: id, limit });
  }
}
/** LangGraph node: always recheck input; do not accept client-supplied guard state. */
export function guardNode(client = new HeistoClient()) {
  return async state => {
    const text = state?.input;
    const decision = await client.check(text);
    return { guard: decision, checkedInput: decision.canProceed ? text : '' };
  };
}
export function guardRoute(state) {
  const d = state?.guard;
  try {
    if (!d || !str(d.checkedAt, 40) || !Number.isFinite(Date.parse(d.checkedAt))) return 'unavailable';
    const g = validateGuard(d.guard);
    const route = { allow: 'proceed', flag: 'review', block: 'block' }[g.action];
    return d.route === route && d.canProceed === (route === 'proceed') ? route : 'unavailable';
  } catch { return 'unavailable'; }
}
