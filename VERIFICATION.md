# ElizaOS standalone distribution verification

Package: **elizaos-plugin-heisto 1.0.0**.
Checked **2026-11-16 UTC** on Node 24, with **@elizaos/core 2.0.5**.

The canonical client and ElizaOS adapter come from the existing Heisto developer
kit 1.0.0. Packaging does not upgrade the Mainnet program or change the API.

## Completed

- **21 automated tests passed**: 16 package/adapter checks and five checks using
  the actual `AgentRuntime` class from the pinned official npm package.
- Real framework registration, configuration rejection, provider/action
  execution, two-runtime isolation and evidence projection were exercised.
- The ingress suite checks that Review, Block, malformed responses and service
  errors do not invoke the downstream handler. Fault transport is controlled;
  no production service was disrupted.
- Exact checked-text delivery, unsupported attachment rejection, input length,
  no retries, no input echo, no startup network call and no install hooks checked.
- The canonical developer-kit client is copied unchanged. The canonical
  ElizaOS adapter differs only in its relative client import; the loadable default
  export is a thin wrapper, not a new Guard implementation.
- Type declarations passed TypeScript validation.
- The isolated pinned compatibility dependency graph passed `pnpm audit` with
  **zero advisories**, including development dependencies. The production
  package has zero runtime dependencies. This is not a whole-application audit.
- The public export is allowlisted and scanned against configured credential
  values and known credential patterns before publication.

## Actual production checks

At **2026-11-16T15:22:24.635Z**, the packaged plugin made three HTTPS requests:

| Operation | Observed result |
| --- | --- |
| On-demand Guard check of an ordinary public opening-hours question | `proceed` |
| Configured public profile read | ID `3544635135356959125` |
| Recent settled public attempts read | 10 records returned |

These were existing public records, not new attacks or ownership verification.
No provider LLM, chat platform, wallet or funding operation was invoked.

## Reproduce

```sh
pnpm install --frozen-lockfile --ignore-scripts
pnpm build
pnpm test
pnpm --ignore-workspace audit
```

The five runtime tests create the real framework runtime and register the plugin,
but do not initialize a database, bootstrap a full conversational agent, or call
a model provider. This is stronger than an interface-only check but is not
a complete bot end-to-end test.

## Not claimed

Official registry acceptance, full Telegram/Discord bot execution,
paid model calls, comprehensive detection accuracy, independent audit, npm
publication, wallet transactions or SOL spend.

The official community registry returned HTTP 410 `registry_retired` when checked.
The upstream repository states third-party plugin/listing submissions are out of
scope. This release uses independent distribution, not that retired registry.

Evidence:
- https://plugins.elizacloud.ai
- https://github.com/elizaOS/eliza/blob/e682daad5a5c70d4334abe7ef287211d3675b8e2/README.md#contributing
