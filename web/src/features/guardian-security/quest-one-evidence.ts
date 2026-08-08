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
    "源码快照 commit；三个核心教学合约在最终安全冻结基线前保持不变。",
  },
  freezeBaselineCommit: {
  value: "a43a7c5da76a7046008b9820bb1a76d91fcb62b1",
  provenance: "frozen-repository-evidence",
  note:
    "Quest 1 最终安全冻结合并基线；Foundry 14/14 与人工复核的安全结论均记录于该基线。",
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
    note: "Quest 1 最终安全冻结已记录并在本地复核：14/14 项测试通过。",
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
    note: "项目级 build-info 包含已知的传递依赖发现；目标结论仅适用于具名合约。",
  },
  humanConclusion: {
    value:
      "漏洞教学样例展示了经典重入漏洞（Classic Reentrancy）；修复样例采用 Checks-Effects-Interactions（检查-效果-交互），且冻结回归证据未复现同一路径。",
    provenance: "human-reviewed",
  },
  contentHash: {
  value: QUEST_ONE_CONTENT_HASH,
  provenance: "on-chain-fact",
  note:
    "已通过 Monad Testnet 上的 Moss guardian.quest 核验 Quest 1 注册 Content Hash。",
  },
  reportHash: {
  value:
    "0xef3b4f9d8637a0a9b30e5dcba100216506a7844eea31c9ea107c08c29d4f306c",
  provenance: "on-chain-fact",
  note:
    "Report Hash 由 Phase 8B Monad 链上状态证据记录；guardian.quest 不返回学习者 Report Hash。",
  },
  knownLimitations: [
    {
      value:
        "确定性文本规则与冻结证据属于教学证据，不等同于完整的正式安全审计。",
      provenance: "known-limitation",
    },
    {
      value:
        "Moss guardian.quest 核验已注册的 Quest 身份与 Content Hash，不核验漏洞结论本身。",
      provenance: "known-limitation",
    },
    {
      value:
        "冻结的 Slither build-info 覆盖整个项目，包含教学样例与依赖项的预期发现。",
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
