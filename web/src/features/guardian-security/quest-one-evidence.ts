import { QUEST_ONE } from "@/data/quest-1";

import type { QuestOneEvidenceProfile } from "./analysis-types";

export const QUEST_ONE_CONTENT_HASH =
  QUEST_ONE.contentHash;

export const QUEST_ONE_EVIDENCE_PROFILE: QuestOneEvidenceProfile = {
  caseId: "quest-1-reentrancy",
  displayName: "Quest 1 · 噬灵回环兽",
  sourceCommit: {
  value: "ce7bf31240c39eee46936a5a06de580e6c0f9281",
  provenance: "frozen-repository-evidence",
  note:
    "Source snapshot commit; the three core teaching contracts remain unchanged through the final security-freeze baseline.",
  },
  freezeBaselineCommit: {
  value: "a43a7c5da76a7046008b9820bb1a76d91fcb62b1",
  provenance: "frozen-repository-evidence",
  note:
    "Final Quest 1 security-freeze merge baseline; Foundry 14/14 and the reviewed security conclusion are recorded against this baseline.",
  },
  vulnerabilityType: {
    value: "Classic Reentrancy",
    provenance: "human-reviewed",
  },
  affectedFunction: {
    value: "withdraw",
    provenance: "frozen-repository-evidence",
  },
  vulnerableContract: {
    value: "VulnerableCharityVault",
    provenance: "frozen-repository-evidence",
  },
  attackerContract: {
    value: "ReentrancyAttacker",
    provenance: "frozen-repository-evidence",
  },
  fixedContract: {
    value: "FixedCharityVault",
    provenance: "frozen-repository-evidence",
  },
  foundry: {
    value: {
      total: 14,
      passed: 14,
      failed: 0,
      skipped: 0,
      vulnerableAttackReproduced: true,
      fixedRegressionPassed: true,
    },
    provenance: "frozen-repository-evidence",
    note: "Recorded by the final Quest 1 security freeze and reverified locally: 14/14 tests passed.",
  },
  invariant: {
    value: {
      name: "invariant_VaultBalanceAlwaysMatchesAccounting",
      runs: 64,
      calls: 2048,
      reverts: 0,
      passed: true,
    },
    provenance: "frozen-repository-evidence",
  },
  slither: {
    value: {
      vulnerableDetectors: ["reentrancy-eth", "reentrancy-events"],
      fixedSamePathDetected: false,
      guardianTargetHighMedium: 0,
    },
    provenance: "frozen-repository-evidence",
    note: "Project-wide build-info produced known transitive findings; target conclusions are scoped to the named contracts.",
  },
  humanConclusion: {
    value:
      "The vulnerable teaching fixture demonstrates classic reentrancy; the fixed fixture applies Checks-Effects-Interactions and did not reproduce the same path in frozen regression evidence.",
    provenance: "human-reviewed",
  },
  contentHash: {
  value: QUEST_ONE_CONTENT_HASH,
  provenance: "on-chain-fact",
  note:
    "Registered Quest 1 content hash verified through Moss guardian.quest on Monad Testnet.",
  },
  reportHash: {
  value:
    "0xef3b4f9d8637a0a9b30e5dcba100216506a7844eea31c9ea107c08c29d4f306c",
  provenance: "on-chain-fact",
  note:
    "Report hash recorded by the Phase 8B Monad chain-status evidence; guardian.quest does not return learner report hashes.",
  },
  knownLimitations: [
    {
      value:
        "Deterministic text rules and frozen evidence are educational evidence, not a complete formal security audit.",
      provenance: "known-limitation",
    },
    {
      value:
        "Moss guardian.quest verifies registered Quest identity and content hash, not the vulnerability conclusion itself.",
      provenance: "known-limitation",
    },
    {
      value:
        "The frozen Slither build-info is project-wide and includes intentional fixture and dependency findings.",
      provenance: "known-limitation",
    },
  ],
};

export const QUEST_ONE_BUILTIN_SOURCES = {
  vulnerableSource: `
    function withdraw() external {
      uint256 amount = balances[msg.sender];
      require(amount > 0, "No balance to withdraw");
      (bool success,) = msg.sender.call{value: amount}("");
      require(success, "Transfer failed");
      balances[msg.sender] = 0;
    }
  `,
  attackSource: `
    function attack() external payable {
      target.donate{value: msg.value}();
      target.withdraw();
    }
    receive() external payable {
      if (address(target).balance >= attackAmount) {
        target.withdraw();
      }
    }
  `,
  fixedSource: `
    function withdraw() external {
      uint256 amount = balances[msg.sender];
      require(amount > 0, "No balance to withdraw");
      balances[msg.sender] = 0;
      emit Withdrawn(msg.sender, amount);
      (bool success,) = msg.sender.call{value: amount}("");
      require(success, "Transfer failed");
    }
  `,
} as const;
