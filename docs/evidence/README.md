# Evidence record system

This directory is the maintained index for verifiable project evidence. It records facts that can be traced to repository files, Git history, an attached artifact, or an explicitly identified human-provided record. Missing material is recorded as `NOT RECORDED`; it is never inferred from a passing build or from an older report.

## Evidence sources found

- `docs/quest-1-chain-verification.md` — documented Monad Testnet read-only route, target chain, contract, selectors, public incomplete-state fixture, and mock-vs-live boundary.
- `docs/quest-1-production-deployment.md` — deployment target, routes, environment variable names, and historical Production notes.
- `deployments/monad-testnet.md`, `deployments/quest-1.md`, and `deployments/quest-1-completion.md` — deployment and completion records already present in the repository.
- `README.md` — project scope, public routes, learner/demo references, and the distinction between local completion and chain completion.
- `design-sources/quest-1/freeze-v1/` — Phase 7 security freeze reports, Phase 8A chain API audit, Phase 8B hardening evidence, mobile QA, release-candidate QA, and final-main verification artifacts.
- Git history — Phase 8B hardening commit `37becb7f27a00b6a9cf278020ed276e388bcccb0` is a historical hardening commit on `fix/quest1-chain-api-hardening`; the Phase 8C implementation record identifies its own branch and commit.

The Phase 8B Preview record is documented in [quest-1/phase-8b-chain-status.md](quest-1/phase-8b-chain-status.md). Values supplied directly in the release handoff are labeled as such; they are not presented as independently recovered from an unavailable network capture.

The Phase 8C ACT6 evidence-panel implementation and automated verification record is documented in [quest-1/phase-8c-act6-chain-panel.md](quest-1/phase-8c-act6-chain-panel.md). Its recorded branch is `feat/quest1-chain-evidence-ui-v2`, and its implementation commit is `550ac81ff3d4e95248bcb55b2803310c1242581c`. Explorer support remains a GAP until a verified Monad Testnet Explorer base URL is recorded in the repository; browser and deployment checks remain `NOT RECORDED` until captured.

## Evidence status vocabulary

- **PASS** — directly supported by a repository artifact, Git object, or attached record with enough context to reproduce the claim.
- **NOT RECORDED** — the requested evidence was not found and is not reconstructed.
- **BLOCKED — LOCAL NETWORK / DNS / HTTPS ROUTING** — a local network path failed while the same operation was reported successful in a browser or external environment; this is not classified as an application failure without additional evidence.
- **Known warning** — a limitation that does not prove a product failure but must remain visible to reviewers.

## Unified record template

Each new evidence record should include, when applicable:

| Field | Value |
|---|---|
| Date and time | ISO 8601 with timezone; state whether supplied or captured |
| Environment | Local, Preview, Production, testnet, or other |
| Branch | Exact branch name |
| Commit SHA | Full SHA when available |
| Deployment ID | Provider deployment identifier, if applicable |
| Deployment URL | Exact URL, if applicable |
| Request | Method, path, query/body with secrets redacted |
| HTTP status | Numeric status or `NOT RECORDED` |
| Response headers | Exact safe headers or `NOT RECORDED` |
| Response body | Exact safe body or redacted excerpt |
| Block height | Chain block number, if applicable |
| Explorer link | Exact link or `NOT RECORDED` |
| Screenshot path | Repository-relative path or `NOT RECORDED` |
| Conclusion | PASS, NOT RECORDED, BLOCKED, or other justified status |
| Known warnings | Explicit limitations and next evidence needed |

Never store RPC URLs, `.env` contents, tokens, bypass tokens, private keys, credentials, or unredacted provider payloads in this directory.

## Maintenance rules

1. Prefer extending an existing phase record over creating a parallel report.
2. Preserve historical reports; add a dated supplement when facts change.
3. Keep source provenance beside externally supplied values.
4. Do not call a local mock, local completion flag, or screenshot proof of a live chain result.
5. Do not turn a missing response header, screenshot, or transaction hash into a positive claim.
