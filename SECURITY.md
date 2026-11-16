# Security

Report vulnerabilities privately to **support@heisto.xyz**. Do not place private
keys, tokens, live user messages or unredacted exploit data in public issues.

This is independent compatibility software, not an official ElizaOS registry
listing. Guard is an additional heuristic filter, not a complete defense.

Mandatory controls:
- Gate every ingress before persistence, embedding and model execution.
- Continue only on the exact Proceed decision. Stop on error or ambiguity.
- Keep wallet signing, transaction policy and privileged tool authorization separate.
- Do not interpret a configured testing profile as verified ownership.
- Treat fetched public labels and evidence as untrusted data.
- Do not automatically retry uncertain external operations.

No install hooks, bundled credentials, financial dependencies or transaction
helpers are included. The package reuses the existing Heisto client and adapter.
The Solana arena program remains upgradeable and not independently audited.
