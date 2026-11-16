# Heisto Guard for ElizaOS

Independent **ElizaOS-compatible integration**, distributed by Heisto.
Not an official ElizaOS plugin, registry listing, partnership or security audit.
The community registry is retired; this package does not attempt to submit to it.

This release packages the existing Heisto JavaScript client and ElizaOS adapter.
The adapter is reused, not replaced. It provides text screening and read-only
public testing evidence from the Heisto Solana Mainnet arena.

## Installation

Node **24 or newer**. Tested runtime target: `@elizaos/core@2.0.5`.
The package has **zero runtime dependencies**. Core is an optional peer:
your existing agent supplies it. The standalone Guard client does not need Core.

Until an npm release is explicitly confirmed, install from the public GitHub
source; do not assume that the proposed package name exists on npm:

```sh
git clone https://github.com/heisto-dev/plugin-heisto.git
cd plugin-heisto
npm run build
npm pack --ignore-scripts
# In YOUR agent project, install the local tarball:
npm install /absolute/path/to/plugin-heisto/elizaos-plugin-heisto-1.0.0.tgz
```

`npm pack --ignore-scripts` is used after the explicit build. No install hook
runs code. Compatibility tests require the pinned development dependency;
running the production plugin does not install it automatically.

## Configure and register

Use your own existing public Sentinel's numeric ID from its Heisto page URL,
as a string. This is public configuration, not a private key.

```js
import heistoPlugin from 'elizaos-plugin-heisto';

// Add HEISTO_SENTINEL_ID to your character settings:
// settings: { HEISTO_SENTINEL_ID: 'YOUR_EXISTING_NUMERIC_SENTINEL_ID' }
// Then, in your existing ElizaOS runtime:
await runtime.registerPlugin(heistoPlugin);
```

For programmatic configuration, use the existing adapter factory:

```js
import { createHeistoPlugin } from 'elizaos-plugin-heisto';

await runtime.registerPlugin(createHeistoPlugin({
  sentinelId: yourExistingPublicSentinelId,
}));
```

Do not convert the ID to a JavaScript number. IDs may exceed safe integer
precision. Invalid or missing profile configuration is rejected.

### Components

| Component | Purpose |
| --- | --- |
| `HEISTO_PROFILE` provider | Your configured testing-page link; self-declared association, not ownership verification |
| `HEISTO_CHECK_INPUT` action | On-demand current-message check, not automatic interception |
| `HEISTO_PUBLIC_EVIDENCE` action | Public profile and up to ten settled verdict records; no attacks or transactions |

## Required: wire the real ingress gate

**Registering the plugin alone does not protect every message.**
Actions, evaluators or an extra message-event listener are not a reliable
pre-model gate. Bootstrap may already persist text or invoke a model.

```js
import { guardedIngress } from 'elizaos-plugin-heisto';

// Replace the direct downstream call in YOUR transport.
const outcome = await guardedIngress(message, async screenedMessage => {
  // Only this branch may persist/embed text or call your agent pipeline.
  return existingHandleMessage(screenedMessage);
});
if (!outcome.delivered) {
  // Return a fixed status to the user. Do not call the normal pipeline here.
  const status = outcome.decision.route;
}
```

This is wiring code for an existing application, not a complete bot launcher.
Every channel must use the gate before persistence, embedding, state composition,
bootstrap or model/tool execution. Remove any parallel listener that bypasses it.
Text is snapshotted before the check to prevent unchecked text replacement.
Attachments and extra content fields are refused; add a separately guarded
extractor if your application needs documents or images.

## Decisions and failures

Only **`route === 'proceed' && canProceed === true`** may continue.
Review, Block, timeout, rate-limit, invalid input and malformed responses stop.
No automatic retries or redirects. Guard is heuristic, not comprehensive
prompt-injection protection, financial authorization or a guarantee of safety.

The public Guard API accepts up to **4,000 UTF-16 code units**. Public endpoints
are rate-limited; the current documented limit is 30 requests per minute per
source IP. Shared infrastructure may share that allowance. Use your own
least-privilege tool permissions and separate approval for irreversible actions.

## Data and network

Explicit checks send text to `https://heisto.xyz/api/guard/score`.
Evidence actions call the read-only endpoint `https://heisto.xyz/mcp`.
No input is sent merely by importing or registering this plugin.
No wallet keys, signing, fund transfers, local storage or input logging.
Do not submit credentials, confidential documents or personal information.
Read [PRIVACY.md](PRIVACY.md) for service/transport retention boundaries.

Evidence is public application data, not an independent on-chain attestation.
Do not feed untrusted profile text into privileged instructions. The configured
profile link does not prove ownership or equivalence to your local agent.

## Tests and evidence

```sh
pnpm install --frozen-lockfile --ignore-scripts
pnpm build
pnpm test
```

See [VERIFICATION.md](VERIFICATION.md) for exactly what was run and not run.
The runtime suite loads the real pinned ElizaOS package with controlled HTTP
fixtures. It is not a Telegram/Discord bot or a paid model-provider test.

## Links

- Heisto: https://heisto.xyz
- Integration guides: https://heisto.xyz/#integrations
- Existing client verification: https://heisto.xyz/integrations/developer/VERIFICATION.md
- Public MCP source: https://github.com/heisto-dev/heisto-mcp
- Security reports: support@heisto.xyz

The arena program is upgradeable and has not been independently audited.
