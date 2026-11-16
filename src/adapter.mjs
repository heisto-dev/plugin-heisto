import { HeistoClient, profileLink } from './client.mjs';

/**
 * Explicit ingress, not an event listener. Wire BEFORE bootstrap/persistence.
 * Only text-only messages supported; attachments require a separately guarded extractor.
 */
export async function guardedIngress(message, handleMessage, client = new HeistoClient()) {
  if (typeof handleMessage !== 'function') throw new TypeError('A trusted handler is required.');
  if (message?.content?.attachments?.length ||
      Object.keys(message?.content ?? {}).some(k => !['text', 'source'].includes(k))) {
    return { delivered: false, decision: { route: 'unavailable', canProceed: false, reason: 'unsupported_content' } };
  }
  // Snapshot before awaiting: channel code must not change text after it was checked.
  const text = message?.content?.text;
  const snapshot = { ...message, content: { text, source: message?.content?.source } };
  const decision = await client.check(text);
  if (!decision.canProceed || decision.route !== 'proceed') return { delivered: false, decision };
  return { delivered: true, decision, result: await handleMessage(snapshot) };
}
/**
 * ElizaOS Plugin shape (1.7.2 / 2.0.5 interface checks).
 * Neither action is a global model/tool authorization gate.
 * @param {{sentinelId: string, client?: HeistoClient}} options
 */
export function createHeistoPlugin({ sentinelId, client = new HeistoClient() }) {
  const link = profileLink(sentinelId); // Administrator-supplied string, never a model argument.
  return {
    name: 'heisto-guard',
    description: 'Input screening and read-only public Heisto evidence. Explicit ingress wiring is required.',
    providers: [{
      name: 'HEISTO_PROFILE',
      description: 'Administrator-configured Heisto testing-page link; not ownership verification.',
      get: async () => ({
        text: `Configured Heisto testing page: ${link}. Association is self-declared, not verified ownership or an audit.`,
        values: { heistoTestingPage: link }, data: { sentinelId, link, association: 'self-declared' },
      }),
    }],
    actions: [{
      name: 'HEISTO_CHECK_INPUT',
      description: 'Screen the current text on demand. This action is not a pre-model interception hook.',
      examples: [],
      validate: async () => true,
      handler: async (_runtime, message, _state, _options, callback) => {
        const decision = await client.check(message?.content?.text);
        const text = `Heisto Guard route: ${decision.route}. Additional filter, not a safety guarantee.`;
        if (callback) await callback({ text });
        return { success: decision.route !== 'unavailable', text, data: { decision } };
      },
    }, {
      name: 'HEISTO_PUBLIC_EVIDENCE',
      description: 'Read settled verdict metadata for the configured Heisto profile; no attacks or transactions.',
      examples: [],
      validate: async () => true,
      handler: async (_runtime, _message, _state, _options, callback) => {
        try {
          const [profile, attempts] = await Promise.all([
            client.getSentinel(sentinelId), client.recentAttempts(sentinelId, 10),
          ]);
          const text = `Public testing records: ${link}. Not an independent audit.`;
          if (callback) await callback({ text });
          return { success: true, text, data: { profile, attempts } };
        } catch {
          const text = 'Public Heisto evidence is unavailable. No verification claim was made.';
          if (callback) await callback({ text });
          return { success: false, text };
        }
      },
    }],
  };
}
