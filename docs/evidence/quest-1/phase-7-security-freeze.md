# Quest 1 Phase 7 — security evidence freeze

## Record identity

| Field | Value |
|---|---|
| Phase | Quest 1 Phase 7 |
| Purpose | Final Foundry, invariant and Slither security-evidence freeze |
| Branch | `test/quest1-final-security-freeze` |
| Baseline commit | `a4c0b0b1946eefa88e9c093aaebafb9918c06aa6` |
| Record date | 2026-08-04 (Asia/Shanghai) |
| Application contract changes | None |
| Test changes | One malicious ERC-1155 receiver regression test |
| Final conclusion | **PASS WITH KNOWN LOW WARNING** |

## Scope

This phase revalidates the Quest 1 contracts before the project enters the Moss × Guardian × Monad integration stages.

The review covers:

- Solidity formatting;
- contract compilation and size reporting;
- unit and integration tests;
- the FixedCharityVault invariant;
- vulnerable-versus-fixed Slither comparison;
- GuardianQuest Slither analysis;
- an ERC-1155 receiver callback regression.

No production contract implementation was changed. The deployed GuardianQuest bytecode and contract address remain unchanged.

## Tool identity

| Tool | Version |
|---|---|
| Foundry Forge | `1.7.1` |
| Slither | `0.11.5` |
| Solidity compiler used by final regression | `0.8.35` |

## Foundry verification

| Check | Result |
|---|---|
| `forge fmt --check` | **PASS** |
| `forge build --sizes` | **PASS** |
| Full Foundry suite | **PASS — 14/14** |
| Failed tests | `0` |
| Skipped tests | `0` |
| FixedCharityVault invariant | **PASS** |
| Invariant runs | `64` |
| Invariant calls | `2048` |
| Invariant reverts | `0` |

The full suite verifies:

- VulnerableCharityVault can be drained through reentrancy;
- FixedCharityVault blocks reentrancy;
- normal fixed-vault withdrawal remains available;
- GuardianQuest registration, funding, completion, access control, withdrawal and non-transferable Badge behavior;
- FixedCharityVault accounting remains consistent under invariant fuzzing;
- an ERC-1155 receiver callback cannot duplicate completion, overwrite the anchored report hash or mint a second Badge.

## Contract-size result

`GuardianQuest` compiled to:

| Measurement | Value |
|---|---:|
| Runtime size | `14,933 B` |
| Runtime margin | `9,643 B` |
| Initcode size | `16,593 B` |
| Initcode margin | `32,559 B` |

No contract-size limit failure was observed.

## Slither comparison

### VulnerableCharityVault

Command:

```text
slither src/VulnerableCharityVault.sol --detect reentrancy-eth,reentrancy-events
```

Result:

| Detector | Result |
|---|---|
| `reentrancy-eth` | Detected |
| `reentrancy-events` | Detected |
| Total findings | `2` |

This is the expected result for the intentionally vulnerable teaching contract.

### FixedCharityVault

Command:

```text
slither src/FixedCharityVault.sol --detect reentrancy-eth,reentrancy-events
```

Result:

| Detector | Result |
|---|---|
| `reentrancy-eth` | Not detected |
| `reentrancy-events` | Not detected |
| Total findings | `0` |

The selected reentrancy detectors confirm the intended vulnerable-versus-fixed contrast.

### GuardianQuest reentrancy scan

Result:

| Detector | Result |
|---|---|
| `reentrancy-eth` | Not detected |
| `reentrancy-events` | One finding |

The finding concerns `verifyCompletion()` calling ERC-1155 `_mint()` before emitting `QuestCompleted`.

ERC-1155 safe minting may invoke the recipient contract's callback. Slither therefore reports that the business event is emitted after an external interaction.

## GuardianQuest finding review

The finding is accepted as a known Low event-ordering warning for the current Testnet and hackathon deployment.

The source order is:

```text
validate learner, Quest and report hash
→ reject an existing completion
→ set completed = true
→ anchor reportHash
→ mint the Badge
→ emit QuestCompleted
```

Critical completion state and the report hash are written before the ERC-1155 callback.

No funding, privilege, completion or report state is updated after `_mint()`. The remaining post-callback operation is the `QuestCompleted` event.

## Malicious receiver regression

A test-only `ReentrantGuardianReceiver` was added.

During `onERC1155Received`, the receiver attempts to call `verifyCompletion()` again for the same Quest and learner.

Verified behavior:

- the ERC-1155 callback occurs;
- the callback attempts reentry;
- the second verification reverts with `AlreadyCompleted`;
- the outer completion succeeds;
- the original report hash remains unchanged;
- the reentry report hash is not stored;
- Badge balance remains exactly `1`.

Result:

```text
testReceiverCallbackCannotDuplicateCompletion — PASS
```

## Pragma finding

The GuardianQuest full scan also reports multiple Solidity pragma constraints across GuardianQuest and imported OpenZeppelin contracts.

This is treated as informational dependency metadata:

- GuardianQuest declares `^0.8.24`;
- the complete Foundry build passes;
- the imported OpenZeppelin contracts compile successfully in the same build;
- no compilation error or unsupported compiler range was observed.

## Evidence files

The raw logs are stored under:

```text
design-sources/quest-1/freeze-v1/security-verification/
```

They include:

- final Foundry and invariant output;
- vulnerable Slither output;
- fixed Slither output;
- GuardianQuest reentrancy scan;
- GuardianQuest full scan;
- final 14-test regression output.

## Limitations

- Slither findings are scoped to the analyzed source, Slither version and enabled detectors.
- A clean Slither result is not equivalent to a complete formal audit.
- The malicious receiver regression proves the tested same-Quest, same-learner callback behavior; it is not a proof against every possible privileged cross-function call.
- GuardianQuest remains a Testnet and hackathon demonstration contract.
- The accepted event-ordering warning should be reconsidered before a future production or mainnet deployment.

## Final conclusion

**PASS WITH KNOWN LOW WARNING**

Quest 1 passes formatting, compilation, size, unit, integration and invariant verification.

The intentionally vulnerable contract produces the expected Slither findings, while the fixed vault produces none under the selected reentrancy detectors.

GuardianQuest has no reported `reentrancy-eth` finding. Its single `reentrancy-events` finding has been manually reviewed and covered by a malicious ERC-1155 receiver regression test.

No production contract change or redeployment is required for the current Testnet hackathon scope.