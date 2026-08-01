# Quest 1 Phase 8B Chain Status evidence

## Record metadata

| Field | Value |
|---|---|
| Record date | 2026-08-02 (UTC+8 context) |
| Environment | Vercel Preview (`target=preview`) |
| Branch | `fix/quest1-chain-api-hardening` |
| Current repository HEAD | `c3340c227def133fe9b9256c83bc35c9c8f799f3` |
| Runtime code commit | `37becb7f27a00b6a9cf278020ed276e388bcccb0` |
| Deployment ID | `dpl_4rgvbHkyZJh3MUgwoZBjd73Mw6Zn` |
| Deployment URL | https://chain-security-cultivation-i6piztofm-honora888888.vercel.app |
| Deployment status | Ready |
| Source provenance | Deployment and response values in this update are browser-observed Preview API JSON supplied by the user. The runtime commit object was independently confirmed in local Git history; it is distinct from the current repository HEAD. |

## Target configuration

| Field | Value |
|---|---|
| Network | Monad Testnet |
| Chain ID | `10143` |
| GuardianQuest | `0x131DEbd042208A327841128e5800dd4a833032ab` |
| Quest ID | `1` |
| Learner address | `0x0A31d11Fd14029c12Ef07c2c200085aE622c1541` |

## Completed learner live-chain verification

Evidence source: **Browser-observed Preview API JSON response supplied by the user.**

Request URL:

```text
https://chain-security-cultivation-i6piztofm-honora888888.vercel.app/api/quest-1/chain-status?address=0x0A31d11Fd14029c12Ef07c2c200085aE622c1541
```

HTTP status: **NOT RECORDED**.

Response headers, including `content-type`, `cache-control`, and `x-content-type-options`: **NOT RECORDED**.

Actual response:

```json
{
  "ok": true,
  "schemaVersion": "quest-1-chain-status-v1",
  "dataSource": "monad-testnet-rpc",
  "queriedAt": "2026-08-01T21:27:30.070Z",
  "network": { "name": "Monad Testnet", "chainId": 10143 },
  "contract": { "address": "0x131DEbd042208A327841128e5800dd4a833032ab" },
  "query": {
    "address": "0x0A31d11Fd14029c12Ef07c2c200085aE622c1541",
    "questId": 1
  },
  "status": {
    "completed": true,
    "reportHash": "0xef3b4f9d8637a0a9b30e5dcba100216506a7844eea31c9ea107c08c29d4f306c",
    "badgeBalance": "1"
  },
  "blockNumber": "50063287"
}
```

Extracted values:

- `learnerAddress`: `0x0A31d11Fd14029c12Ef07c2c200085aE622c1541`
- `completed`: `true`
- `reportHash`: `0xef3b4f9d8637a0a9b30e5dcba100216506a7844eea31c9ea107c08c29d4f306c`
- `badgeBalance`: `1`
- `blockNumber`: `50063287`
- `queriedAt UTC`: `2026-08-01T21:27:30.070Z`
- `queriedAt UTC+8`: `2026-08-02 05:27:30.070`

Conclusion: **PASS — completed=true learner status, reportHash and badgeBalance were read through the Preview API from Monad Testnet, according to the supplied browser observation.**

## Non-completed learner live-chain verification

Evidence source: **Browser-observed Preview API JSON response supplied by the user.**

Request URL:

```text
https://chain-security-cultivation-i6piztofm-honora888888.vercel.app/api/quest-1/chain-status?address=0x000000000000000000000000000000000000dEaD
```

HTTP status: **NOT RECORDED**.

Response headers, including `content-type`, `cache-control`, and `x-content-type-options`: **NOT RECORDED**.

Actual response:

```json
{
  "ok": true,
  "schemaVersion": "quest-1-chain-status-v1",
  "dataSource": "monad-testnet-rpc",
  "queriedAt": "2026-08-01T21:26:38.841Z",
  "network": { "name": "Monad Testnet", "chainId": 10143 },
  "contract": { "address": "0x131DEbd042208A327841128e5800dd4a833032ab" },
  "query": {
    "address": "0x000000000000000000000000000000000000dEaD",
    "questId": 1
  },
  "status": {
    "completed": false,
    "reportHash": "0x0000000000000000000000000000000000000000000000000000000000000000",
    "badgeBalance": "0"
  },
  "blockNumber": "50063117"
}
```

Extracted values:

- `learnerAddress`: `0x000000000000000000000000000000000000dEaD`
- `completed`: `false`
- `reportHash`: `0x0000000000000000000000000000000000000000000000000000000000000000`
- `badgeBalance`: `0`
- `blockNumber`: `50063117`
- `queriedAt UTC`: `2026-08-01T21:26:38.841Z`
- `queriedAt UTC+8`: `2026-08-02 05:26:38.841`

Conclusion: **PASS — the legal but incomplete Quest 1 address returned completed=false, zero reportHash and zero badge balance through the Preview API, according to the supplied browser observation. This is not an RPC-failure fallback.**

## Updated verification summary

- completed=true live-chain path: **PASS** (browser-observed Preview response supplied by user)
- completed=false live-chain path: **PASS** (browser-observed Preview response supplied by user)
- reportHash decoding: **PASS**
- ERC-1155 badge balance decoding: **PASS**
- blockNumber evidence: **PASS**
- queriedAt evidence: **PASS**
- Monad Testnet chain identity: **PASS**
- GuardianQuest contract identity: **PASS**
- false fallback prevention: **PASS**

These conclusions are scoped to the two supplied Runtime Preview JSON responses. They do not promote missing headers, screenshots, or Production verification to PASS.

## Recorded request and response

Request path:

```text
GET /api/quest-1/chain-status?address=0x0A31d11Fd14029c12Ef07c2c200085aE622c1541
```

HTTP status: **NOT RECORDED** in the supplied handoff. The handoff identifies this as a successful response; a raw status/header capture is still required.

Response headers: **NOT RECORDED**.

Response body supplied in the handoff:

```json
{
  "ok": true,
  "schemaVersion": "quest-1-chain-status-v1",
  "dataSource": "monad-testnet-rpc",
  "queriedAt": "2026-08-01T21:25:03.889Z",
  "network": { "name": "Monad Testnet", "chainId": 10143 },
  "contract": { "address": "0x131DEbd042208A327841128e5800dd4a833032ab" },
  "query": {
    "address": "0x0A31d11Fd14029c12Ef07c2c200085aE622c1541",
    "questId": 1
  },
  "status": {
    "completed": true,
    "reportHash": "0xef3b4f9d8637a0a9b30e5dcba100216506a7844eea31c9ea107c08c29d4f306c",
    "badgeBalance": "1"
  },
  "blockNumber": "50062802"
}
```

Recorded facts from that supplied response:

- `completed=true`
- `reportHash=0xef3b4f9d8637a0a9b30e5dcba100216506a7844eea31c9ea107c08c29d4f306c`
- `badgeBalance=1`
- `blockNumber=50062802`
- `queriedAt=2026-08-01T21:25:03.889Z`
- UTC+8 interpretation: `2026-08-02 05:25:03.889`

## Verification claims in the supplied handoff

The handoff reports the following as PASS:

- Preview environment variable injection
- Monad Testnet RPC
- Chain ID validation
- GuardianQuest bytecode check
- `completed` query
- `reportHashes` query
- ERC-1155 `balanceOf` query
- ABI decoding
- `completed=true` live-chain evidence

These are recorded as **handoff-reported PASS**, not independently re-run in this documentation-only task. No RPC URL, environment value, token, bypass token, or `.env` content was read or recorded.

## Local network limitation

The handoff records:

- PowerShell curl could not connect to Preview port 443;
- `Test-NetConnection` returned `False`;
- Browser access to the same Preview API succeeded.

Classification: **BLOCKED — LOCAL NETWORK / DNS / HTTPS ROUTING**. This discrepancy is not evidence of an application code failure. A future raw capture should retain the browser request status, safe response headers, and timestamp.

## Evidence not recorded

The following remain explicitly **NOT RECORDED** and must not be inferred:

- HTTP status code DevTools capture or raw record;
- Response-header capture, including `content-type`, `Cache-Control`, and `X-Content-Type-Options`;
- Browser Network panel screenshot;
- Raw Node 6/6 test log;
- Raw lint log;
- Raw TypeScript log;
- Raw production-build log;
- ACT6 UI screenshot;
- Post-merge Production verification;
- Explorer link;
- Completion transaction hash.

## Repository cross-checks

Existing related records include:

- `docs/quest-1-chain-verification.md` — previously documented the public incomplete-state fixture and explicitly stated that `completed=true` live evidence was not yet recorded.
- `docs/quest-1-production-deployment.md` — documented the Preview/Production route boundary and the read-only API.
- `design-sources/quest-1/freeze-v1/chain-api-audit/` — Phase 8A code-level audit and local/Production network limitation.
- `design-sources/quest-1/freeze-v1/chain-api-hardening/` — Phase 8B protocol hardening, six dependency-free validator tests, lint/typecheck/build evidence, and secret-redaction checks.
- `deployments/quest-1-completion.md` — existing deployment/completion record for the learner address; it is not substituted for the supplied Preview API response.

## Conclusion

**Phase 8B Preview chain-status evidence: PASS (browser-observed responses supplied by the user, with evidence gaps).**

The supplied responses are internally consistent with the fixed chain, contract, Quest ID and response schema. The record is not a complete production certification because HTTP status/header captures, raw test/build logs, screenshots, Explorer data, and post-merge Production verification were not supplied.

Known warnings:

1. The successful responses and verification list are sourced from browser-observed JSON supplied by the user rather than a raw Network export stored in the repository.
2. Local PowerShell HTTPS routing is blocked while browser access was reported successful.
3. Production merge verification and completion transaction/Explorer evidence remain NOT RECORDED.
