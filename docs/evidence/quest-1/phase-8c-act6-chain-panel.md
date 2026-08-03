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
| Browser screenshots | One historical completed desktop screenshot recorded; this automated supplement saved no screenshots |
| Browser Network capture | NOT RECORDED |

This record documents implementation, automated checks, the historical user-provided desktop scenarios, and the separate automated Preview supplement below. It does not claim Production verification.

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

### completed=false desktop Preview

| Field | Value |
|---|---|
| Result | **PASS — completed=false desktop Preview browser regression** |
| Environment | Vercel Preview |
| Branch | `feat/quest1-chain-evidence-ui-v2` |
| Viewport | 1440 × 1024 |
| Learner address | `0x000000000000000000000000000000000000dEaD` |
| Evidence source | User observation on the real Vercel Preview page using Chrome DevTools Responsive viewport |
| Screenshot | [completed=false desktop screenshot](assets/phase-8c-act6-non-completed-desktop-1440x1024.png) |

Observed:

- ACT6 chain-status query succeeded.
- `completed=false · 尚未登记` was displayed.
- `reportHash` was the all-zero bytes32 value.
- `badgeBalance=0` was displayed.
- `blockNumber=50340004` was visible.
- `queriedAt` was displayed in local time as `2026/8/3 上午4:40:43`.
- `dataSource` displayed as “Monad Testnet RPC”.
- Network displayed as “Monad Testnet”.
- `Chain ID=10143` was visible.
- GuardianQuest contract and learner addresses were visible.
- “刷新链上证据” was visible.
- No horizontal overflow or obvious layout breakage was observed.

This is a legitimate non-completed chain-read result, not an API, RPC, network, or failure fallback state. The screenshot file was checked and exists at `docs/evidence/quest-1/assets/phase-8c-act6-non-completed-desktop-1440x1024.png`.

## Browser verification still required

The following remain **NOT RECORDED** and require future browser verification:

1. Invalid-address UI.
2. Trim normalization browser regression.
3. API/network failure.
4. Refresh/requery result replacement.
5. Twelve-second timeout message under a safely simulated stalled same-origin request.
6. Five-minute stale transition and visibility-return recalculation.
7. Bestiary open/close preserving the current address and result.
8. Keyboard Tab order, visible focus, submit, and refresh.
9. Reduced-motion behavior.
10. Production deployment behavior.

The historical user-provided desktop sections remain unchanged. The correct Preview automated supplement below additionally marks the four core completed=true/completed=false desktop and mobile scenarios PASS. No error-state, refresh, timeout, stale, bestiary, keyboard, reduced-motion, or Production verification is marked PASS.

## Known gaps

- Explorer links: GAP — no verified base URL in the repository.
- Browser and responsive screenshots: NOT RECORDED.
- Preview deployment verification: NOT RECORDED.
- Production verification: NOT RECORDED.
- Full-page refresh persistence: intentionally not implemented.

## Correct Preview automated browser certification supplement

This supplement supersedes any earlier automated result against the `bz7wmf8f1` deployment. That target is explicitly excluded from certification:

`INVALID TARGET — excluded from certification`

Evidence source: **Codex automated browser observation against the real Vercel Preview**. No screenshots were saved in this run.

Actual tested page:

`https://chain-security-cultivation-git-feat-quest1-4d6bbe-honora888888.vercel.app/quests/1`

Repository identity at record time:

| Field | Value |
|---|---|
| Branch | `feat/quest1-chain-evidence-ui-v2` |
| HEAD | `559e09ab59ba638b568c2e01add06708a9f0dc1d` |
| Staged files | None |

### completed=true desktop

| Field | Observed value |
|---|---|
| Status | **AUTOMATED BROWSER PASS** |
| Viewport | 1440 × 1024 |
| Learner | `0x0A31d11Fd14029c12Ef07c2c200085aE622c1541` |
| Chain state | `completed=true · 已登记`; 页面显示“链上已登记” |
| reportHash | Non-zero: `0xef3b…306c` |
| Quest 1 徽记余额 | `1` |
| blockNumber | `50370227` |
| queriedAt | `2026/8/3 07:12:46` |
| dataSource | `Monad Testnet RPC` |
| Layout | `innerWidth=1440`, `clientWidth=1425`, `scrollWidth=1425`, `overflow=false` |
| Product Console errors | `0` |

### completed=false desktop

| Field | Observed value |
|---|---|
| Status | **AUTOMATED BROWSER PASS** |
| Viewport | 1440 × 1024 |
| Learner | `0x000000000000000000000000000000000000dEaD` |
| Chain state | `completed=false · 尚未登记`; 页面显示“链上尚未登记” |
| reportHash | All-zero bytes32 |
| Quest 1 徽记余额 | `0` |
| blockNumber | `50371068` |
| queriedAt | `2026/8/3 07:17:00` |
| dataSource | `Monad Testnet RPC` |
| Layout | `innerWidth=1440`, `clientWidth=1425`, `scrollWidth=1425`, `overflow=false` |
| Product Console errors | `0` |
| Interpretation | 合法的成功链上未完成状态，不是错误降级 |

### completed=true mobile

| Field | Observed value |
|---|---|
| Status | **AUTOMATED BROWSER PASS** |
| Viewport | 390 × 844 |
| Learner | `0x0A31d11Fd14029c12Ef07c2c200085aE622c1541` |
| Chain state | `completed=true · 已登记`; 页面显示“链上已登记” |
| reportHash | Non-zero: `0xef3b…306c` |
| Quest 1 徽记余额 | `1` |
| blockNumber | `50371832` |
| queriedAt | `2026/8/3 07:20:51` |
| dataSource | `Monad Testnet RPC` |
| Layout | `innerWidth=390`, `clientWidth=375`, `scrollWidth=375`, `overflow=false` |
| Product Console errors | `0` |

### completed=false mobile

| Field | Observed value |
|---|---|
| Status | **AUTOMATED BROWSER PASS** |
| Viewport | 390 × 844 |
| Learner | `0x000000000000000000000000000000000000dEaD` |
| Chain state | `completed=false · 尚未登记`; 页面显示“链上尚未登记” |
| reportHash | All-zero bytes32 |
| Quest 1 徽记余额 | `0` |
| blockNumber | `50372329` |
| queriedAt | `2026/8/3 07:23:21` |
| dataSource | `Monad Testnet RPC` |
| Layout | `innerWidth=390`, `clientWidth=375`, `scrollWidth=375`, `overflow=false` |
| Product Console errors | `0` |

### Automated certification conclusion

- Real Preview completed=true desktop: **PASS**
- Real Preview completed=false desktop: **PASS**
- Real Preview completed=true mobile: **PASS**
- Real Preview completed=false mobile: **PASS**
- Successful-result desktop overflow: **PASS**
- Successful-result mobile overflow: **PASS**
- completed=false and failure separation: **PASS**
- Product Console cleanliness in all four core scenarios: **PASS**

Explorer links remain **GAP** because no verified Explorer base URL is available in the repository. The following remain **NOT RECORDED**: invalid-address browser regression, trim normalization browser regression, refresh/requery, refresh loading-state preservation, API/network failure, twelve-second client timeout, five-minute real-time browser stale transition, bestiary state preservation, keyboard, reduced motion, and Production.

No screenshot was saved by this supplement.
