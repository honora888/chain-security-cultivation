# Quest 1 Phase 8C — ACT6 chain evidence panel

## Record identity

| Field | Value |
|---|---|
| Phase | Quest 1 Phase 8C |
| Environment | Local implementation and automated verification |
| Branch | `feat/quest1-chain-evidence-ui-v2` |
| Phase 8C implementation commit | `550ac81ff3d4e95248bcb55b2803310c1242581c` |
| Repository HEAD at Preview verification | `e033e35e2badd9cf7c375aceb748216e5ddb14ef` |
| Baseline commit | `adb03cfe17c3853bd82a2a44a5d1f76070ab654c` |
| Record date | 2026-08-03 (Asia/Shanghai) |
| Browser screenshots | One completed desktop screenshot recorded; remaining scenarios NOT RECORDED |
| Browser Network capture | NOT RECORDED |

This record documents implementation, automated checks, and the single manual Preview scenario recorded below. It does not claim Production verification.

## Modified files

- `web/src/components/quest-1/ChainStatusPanel.tsx`
- `web/src/components/quest-1/RewardSequence.tsx`
- `web/src/components/quest-1/quest-1.module.css`
- `web/src/lib/quest-1-chain-panel.ts`
- `web/scripts/chain-status-panel.test.mjs`
- `docs/evidence/README.md`
- `docs/evidence/quest-1/phase-8c-act6-chain-panel.md`

No contract, ABI selector, API response type, server JSON-RPC validator, package manifest, lockfile, reducer, persistence schema, or reward logic was modified.

## Design and security decisions

### Evidence fields

The successful ACT6 result now visibly presents `queriedAt`, `dataSource`, block number, network name, Chain ID, GuardianQuest address, learner address, Quest ID, `completed`, `reportHash`, and badge balance. The local rendering of `queriedAt` uses the browser locale, while the unchanged ISO value remains available through `<time dateTime>` and `title`.

`monad-testnet-rpc` is presented to users as “Monad Testnet RPC”. `schemaVersion` remains part of the validated API contract but is not promoted as a normal user-facing fact.

### Explorer links

**GAP — NOT IMPLEMENTED.** Repository searches found no verified Monad Testnet Explorer base URL or centralized Explorer configuration. No domain was guessed and no external Explorer link was added.

### Refresh and request state

- Initial action: “查询链上状态”.
- Successful result action: “刷新链上证据”.
- Loading actions: “正在查询” and “正在刷新”.
- The action is disabled while a request is active, and the submit handler also rejects concurrent submission.
- During refresh, the prior successful evidence remains visible but is explicitly identified as the previous result.
- Input changes abort the active request and clear the result.
- A new successful response replaces the prior result in full.
- API, RPC, malformed-response, network, and timeout failures enter an error state and never synthesize `completed=false`.

### Client timeout

The browser timeout is the centralized constant `QUEST_ONE_CHAIN_CLIENT_TIMEOUT_MS = 12_000`. This is two seconds longer than the approximately ten-second server RPC timeout, allowing the server to return its sanitized failure first under normal conditions. Caller cancellation and timeout are separate error kinds, and timers and abort listeners are cleaned up.

### Stale threshold

The stale threshold is the centralized constant `QUEST_ONE_CHAIN_STALE_AFTER_MS = 300_000` (five minutes). This is a conservative, deterministic threshold for a manually refreshed evidence view: it avoids representing an older block snapshot as current while not polling the chain. The label changes from “刚刚查询” to “数据可能已过期，请刷新”. Freshness is recalculated at the threshold and when a hidden page becomes visible again. Stale is a time warning only; it does not change `completed` or imply an RPC error.

### Bestiary state preservation

The chain panel remains mounted after ACT6 completion. Opening the bestiary hides the mounted panel instead of unmounting it, so the typed address and latest in-memory result survive open/close. No RPC response is persisted to `localStorage`, and a full page refresh still clears this UI state.

### Accessibility and visual semantics

- `completed=false` uses a neutral warning accent distinct from error states.
- Status text, not color alone, identifies completed, not-completed, stale, loading, and error states.
- Only the concise status message is an `aria-live="polite"` region, avoiding repeated announcement of the complete evidence table.
- Query buttons retain keyboard behavior and `focus-visible` styling.
- Long addresses and hashes retain existing wrapping and zero-min-width protections.
- Mobile retains the existing single-column facts and full-width action at 640px and below.
- No animation was added; stale state does not depend on motion.

## Automated verification

| Command | Result | Exit code |
|---|---|---:|
| `node scripts/chain-status-validator.test.mjs` | PASS — 6/6 | 0 |
| `node scripts/chain-status-panel.test.mjs` | PASS — 8/8 | 0 |
| `npx tsc --noEmit` | PASS | 0 |
| `npm run lint` | PASS | 0 |
| `npm run build` | PASS — Next.js production build completed | 0 |

The Node runner emitted the pre-existing `MODULE_TYPELESS_PACKAGE_JSON` performance warning because the package does not declare a module type. `package.json` was intentionally not changed. The warning did not fail either test suite.

`MODULE_TYPELESS_PACKAGE_JSON`: **KNOWN WARNING**.

The panel tests cover:

- trimming a valid mixed-case learner address before the request;
- rejecting invalid addresses without calling `fetch`;
- successful `completed=true` and `completed=false` decoding;
- keeping API/network failures distinct from `completed=false`;
- refresh/requery replacement behavior;
- distinct client timeout and caller-abort paths;
- the five-minute stale boundary;
- rejection of malformed success payloads.

Explorer URL generation was not tested because Explorer support is intentionally a GAP without a verified repository configuration.

## Security semantics check

- `completed=false` remains a successful, validated chain-read result: PASS.
- API/RPC/network/timeout failures cannot render as `completed=false`: PASS in automated helper tests.
- Remote JSON-RPC `error.data` remains stripped by the unchanged Phase 8B boundary helper: PASS in the existing validator suite.
- RPC URLs, environment variables, remote error data, stacks, and internal exception messages are not rendered by the panel: PASS by implementation review.
- API success schema, ABI selectors, chain constants, and `no-store` response behavior are unchanged: PASS by diff review.
- Wallet connection, account discovery, signing, and write transactions were not added: PASS by diff review.

## Manual browser regression supplement

### completed=true desktop Preview

| Field | Value |
|---|---|
| Result | **PASS — completed=true desktop Preview browser regression** |
| Environment | Vercel Preview |
| Branch | `feat/quest1-chain-evidence-ui-v2` |
| Preview URL | `https://chain-security-cultivation-bz7wmf8f1-honora888888.vercel.app` |
| Observed at | 2026-08-03 02:56 UTC+8 |
| Viewport | 1440 × 1024 |
| Learner address | `0x0A31d11Fd14029c12Ef07c2c200085aE622c1541` |
| Evidence source | User-observed browser session on the real Vercel Preview page |
| Screenshot | [completed desktop screenshot](assets/phase-8c-act6-completed-desktop-1440x1024.png) |

Observed:

- ACT6 rendered normally.
- The chain-status address query succeeded.
- `completed=true` was displayed.
- `reportHash` displayed a non-zero value.
- `badgeBalance=1` was displayed.
- `blockNumber` was visible.
- `queriedAt` was displayed in local time.
- `dataSource` displayed as “Monad Testnet RPC”.
- “刷新链上证据” was visible.
- No horizontal overflow or obvious layout breakage was observed.
- API/RPC error state was not exercised in this scenario.

No specific `blockNumber`, `queriedAt`, or `reportHash` value from this UI request is added here; earlier API response values are not reused as this screenshot's request values.

The screenshot file was checked and exists at `docs/evidence/quest-1/assets/phase-8c-act6-completed-desktop-1440x1024.png`.

The previously reported PowerShell `curl` local-network limitation remains separate from this browser-observed Preview result and is not classified as an application failure.

## Browser verification still required

The following are **NOT RECORDED** and require manual browser verification:

1. completed=true mobile.
2. completed=false desktop.
3. completed=false mobile.
4. Invalid-address UI.
5. API/network failure.
6. Refresh/requery result replacement.
7. Twelve-second timeout message under a safely simulated stalled same-origin request.
8. Five-minute stale transition and visibility-return recalculation.
9. Bestiary open/close preserving the current address and result.
10. Keyboard Tab order, visible focus, submit, and refresh.
11. Reduced-motion behavior.
12. Production deployment behavior.

Completed=true desktop Preview is the only browser scenario marked PASS by this record. No other manual regression, responsive screenshot, keyboard, stale-transition, or bestiary open/close verification is marked PASS.

## Known gaps

- Explorer links: GAP — no verified base URL in the repository.
- Browser and responsive screenshots: NOT RECORDED.
- Preview deployment verification: NOT RECORDED.
- Production verification: NOT RECORDED.
- Full-page refresh persistence: intentionally not implemented.
