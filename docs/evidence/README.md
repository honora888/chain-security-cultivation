# Evidence record system

This directory is the maintained index for verifiable project evidence. It records facts that can be traced to repository files, Git history, an attached artifact, or an explicitly identified human-provided record. Missing material is recorded as `NOT RECORDED`; it is never inferred from a passing build or from an older report.

## Evidence sources found

- `docs/quest-1-chain-verification.md` — documented Monad Testnet read-only route, target chain, contract, selectors, public incomplete-state fixture, and mock-vs-live boundary.
- `docs/quest-1-production-deployment.md` — deployment target, routes, environment variable names, and historical Production notes.
- `deployments/monad-testnet.md`, `deployments/quest-1.md`, and `deployments/quest-1-completion.md` — deployment and completion records already present in the repository.
- `README.md` — project scope, public routes, learner/demo references, and the distinction between local completion and chain completion.
- `design-sources/quest-1/freeze-v1/` — Phase 7 security freeze reports, Phase 8A chain API audit, Phase 8B hardening evidence, mobile QA, release-candidate QA, and final-main verification artifacts.
- Git history — Phase 8B hardening commit `37becb7f27a00b6a9cf278020ed276e388bcccb0` was merged into `main` through pull request #3 at merge commit `8198485a12287b40c9c3ab003dea54cbdc991591`. The Phase 8C implementation commit `550ac81ff3d4e95248bcb55b2803310c1242581c` was merged into `main` through pull request #4 at merge commit `d0fa2378b14380726c42e1c0b3ceb4e692e715ec`.

- User-observed Production browser smoke verification — the Vercel Production deployment of merge commit `d0fa2378b14380726c42e1c0b3ceb4e692e715ec` was checked with one completed learner and one non-completed learner. No Production screenshot, exact block number, query timestamp, or full report hash was recorded.

The Phase 8B Preview record is documented in [quest-1/phase-8b-chain-status.md](quest-1/phase-8b-chain-status.md). Values supplied directly in the release handoff are labeled as such; they are not presented as independently recovered from an unavailable network capture.

The Phase 8C ACT6 evidence-panel implementation and verification record is documented in [quest-1/phase-8c-act6-chain-panel.md](quest-1/phase-8c-act6-chain-panel.md). The Phase 8C implementation commit `550ac81ff3d4e95248bcb55b2803310c1242581c` was merged into `main` through pull request #4 at merge commit `d0fa2378b14380726c42e1c0b3ceb4e692e715ec`.

The correct Preview automated browser supplement records completed=true and completed=false desktop and mobile core scenarios as PASS. The earlier automated BLOCKED result against `https://chain-security-cultivation-bz7wmf8f1-honora888888.vercel.app` used an incorrect deployment target and is marked `INVALID TARGET — excluded from certification`.

A user-observed Production browser smoke verification against the deployment of merge commit `d0fa2378b14380726c42e1c0b3ceb4e692e715ec` records both the completed learner and non-completed learner queries as PASS. No Production screenshot, exact Production block number, query timestamp, or full report hash was recorded, and this smoke verification is not presented as a complete Production regression suite.

Explorer support remains a GAP until a verified Monad Testnet Explorer base URL is recorded in the repository. Invalid-address browser regression, trim normalization, refresh/requery, loading-state preservation, API/network failure, client timeout, real-time stale transition, bestiary state preservation, keyboard behavior, reduced-motion behavior, and a complete Production regression suite remain `NOT RECORDED`.

## Evidence status vocabulary

- **PASS** — directly supported by a repository artifact, Git object, or attached record with enough context to reproduce the claim.
- **NOT RECORDED** — the requested evidence was not found and is not reconstructed.
- **BLOCKED — LOCAL NETWORK / DNS / HTTPS ROUTING** — a local network path failed while the same operation was reported successful in a browser or external environment; this is not classified as an application failure without additional evidence.
- **INVALID TARGET — excluded from certification** — an observation was made against the wrong deployment, branch, commit, or environment and is retained only as historical context; it does not contribute to release certification.
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

Quest 1 Phase 7 final contract-security verification is documented in [quest-1/phase-7-security-freeze.md](quest-1/phase-7-security-freeze.md). Foundry formatting, compilation, the complete 14-test suite and the FixedCharityVault invariant passed. Slither reproduced the expected vulnerable-versus-fixed reentrancy contrast. GuardianQuest produced one reviewed `reentrancy-events` Low warning caused by the ERC-1155 receiver callback occurring before the final business event. A malicious receiver regression confirms that callback reentry cannot duplicate completion, overwrite the report hash or mint a second Badge. The phase conclusion is **PASS WITH KNOWN LOW WARNING**.
The Quest 1 Phase 8D final release regression is documented in [quest-1/phase-8d-release-regression.md](quest-1/phase-8d-release-regression.md). The Phase 8D deterministic baseline passed the JSON-RPC validator suite, ACT6 panel suite, TypeScript check, ESLint, and Production build. User-observed Production browser regression passed invalid-address handling, trim normalization, requery replacement, refresh loading-state preservation, bestiary state preservation, safe network-failure handling and recovery, keyboard operation, visible focus, and reduced-motion behavior. No application-code change was required. Real-time browser timeout and five-minute stale waits remain unrecorded because those boundaries were verified deterministically; Explorer support remains a documented GAP.