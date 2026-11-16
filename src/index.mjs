import { HeistoClient, profileLink } from './client.mjs';
import { createHeistoPlugin, guardedIngress } from './adapter.mjs';

export { HeistoClient, createHeistoPlugin, guardedIngress };

/**
 * Loadable ElizaOS plugin around the existing Heisto adapter.
 * Registration alone is NOT a pre-model gate: wire guardedIngress separately.
 * Configuration is per runtime; no shared mutable agent/profile association.
 */
export function createRuntimePlugin({ client = new HeistoClient() } = {}) {
  const configured = new WeakMap();
  function resolve(runtime) {
    const id = configured.get(runtime) ?? runtime?.getSetting?.('HEISTO_SENTINEL_ID');
    profileLink(id);
    return createHeistoPlugin({ sentinelId: id, client });
  }
  return {
    name: 'heisto-guard',
    description: 'Heisto input screening and read-only testing evidence. Explicit ingress wiring required.',
    init: async (config, runtime) => {
      const id = config?.HEISTO_SENTINEL_ID ?? runtime?.getSetting?.('HEISTO_SENTINEL_ID');
      profileLink(id);
      configured.set(runtime, id);
    },
    providers: [{
      name: 'HEISTO_PROFILE',
      description: 'Configured Heisto profile link; association is self-declared, not ownership verification.',
      get: async (runtime, ...args) => resolve(runtime).providers[0].get(runtime, ...args),
    }],
    actions: ['HEISTO_CHECK_INPUT', 'HEISTO_PUBLIC_EVIDENCE'].map((name, index) => ({
      name,
      description: index === 0
        ? 'Check current text on demand; not a global pre-model interception hook.'
        : 'Read public testing evidence; does not submit attacks or transactions.',
      examples: [],
      validate: async runtime => {
        try { resolve(runtime); return true; } catch { return false; }
      },
      handler: async (runtime, ...args) => resolve(runtime).actions[index].handler(runtime, ...args),
    })),
  };
}

export const heistoPlugin = createRuntimePlugin();
export default heistoPlugin;
