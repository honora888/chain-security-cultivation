import type {
  AttackReplayStep,
  ClassificationAnswers,
  ClassificationField,
  CodeLine,
  RepairCodeBlock,
  RepairDiffLine,
} from "@/features/quest-1/battle-types";
import type { RepairBlockId } from "@/features/quest-1/battle-types";

export const QUEST_ONE = {
  id: 1,
  name: "噬灵回环兽",
  realm: "金丹期",
  element: "水",
  vulnerability: "经典重入漏洞",
  risk: "High",
  badge: "水系守护者",
  exp: 120,
  mastery: 1,
} as const;

export const QUEST_ONE_CODE_LINES: CodeLine[] = [
  {
    id: "amount-read",
    lineNumber: 31,
    code: "uint256 amount = balances[msg.sender];",
    verdict: "wrong",
  },
  {
    id: "external-call",
    lineNumber: 32,
    code: '(bool success, ) = msg.sender.call{value: amount}("");',
    verdict: "correct",
  },
  {
    id: "require-success",
    lineNumber: 33,
    code: 'require(success, "Transfer failed");',
    verdict: "wrong",
  },
  {
    id: "balance-reset",
    lineNumber: 35,
    code: "balances[msg.sender] = 0;",
    verdict: "partial",
  },
];

export const QUEST_ONE_CLASSIFICATION_CORRECT: ClassificationAnswers = {
  vulnerability: "classic-reentrancy",
  element: "water",
  risk: "High",
};

export const QUEST_ONE_CLASSIFICATION_GROUPS: Array<{
  field: ClassificationField;
  legend: string;
  correctValue: string;
  correctLabel: string;
  explanation: string;
  options: Array<{ value: string; label: string }>;
}> = [
  {
    field: "vulnerability",
    legend: "漏洞类型",
    correctValue: "classic-reentrancy",
    correctLabel: "经典重入漏洞",
    explanation:
      "外部调用发生在余额清零之前，攻击者可在状态更新前重新进入 withdraw。",
    options: [
      { value: "classic-reentrancy", label: "经典重入漏洞" },
      { value: "access-control", label: "访问控制漏洞" },
      { value: "integer-overflow", label: "整数溢出漏洞" },
    ],
  },
  {
    field: "element",
    legend: "五行属性",
    correctValue: "water",
    correctLabel: "水",
    explanation: "回调沿外部调用形成回环水道，本关五行属性为水。",
    options: [
      { value: "water", label: "水" },
      { value: "fire", label: "火" },
      { value: "metal", label: "金" },
    ],
  },
  {
    field: "risk",
    legend: "风险等级",
    correctValue: "High",
    correctLabel: "High",
    explanation: "攻击者可重复提款直至金库资产被抽空，因此风险等级为 High。",
    options: [
      { value: "High", label: "High" },
      { value: "Medium", label: "Medium" },
      { value: "Low", label: "Low" },
    ],
  },
];

export const QUEST_ONE_ATTACK_REPLAY_STEPS: AttackReplayStep[] = [
  {
    id: 0,
    title: "布下诱饵",
    actor: "攻击合约",
    fn: "attack() → donate()",
    funds: "攻击合约向漏洞金库存入 1 ETH，金库由 10 ETH 增至 11 ETH。",
    vaultBalance: "11 ETH",
    attackerBalance: "0 ETH",
    ledgerBalance: "1 ETH",
    ledgerCleared: false,
    reentryReason:
      "donate() 已为攻击合约建立 1 ETH 账面余额，下一次 withdraw() 的余额检查能够通过。",
    callStack: [
      "ReentrancyAttacker.attack()",
      "VulnerableCharityVault.donate()",
    ],
    flow: "deposit",
  },
  {
    id: 1,
    title: "首次提款",
    actor: "漏洞金库",
    fn: "withdraw()",
    funds: "金库读取 balances[msg.sender]，得到攻击合约可提取余额 1 ETH。",
    vaultBalance: "11 ETH",
    attackerBalance: "0 ETH",
    ledgerBalance: "1 ETH",
    ledgerCleared: false,
    reentryReason:
      "require(amount > 0) 已通过，但 balances[msg.sender] = 0 尚未执行。",
    callStack: [
      "ReentrancyAttacker.attack()",
      "VulnerableCharityVault.withdraw()",
    ],
    flow: "read",
  },
  {
    id: 2,
    title: "外部转账",
    actor: "漏洞金库",
    fn: 'msg.sender.call{value: amount}("")',
    funds: "金库向攻击合约发送 1 ETH，攻击合约 receive() 被触发。",
    vaultBalance: "10 ETH",
    attackerBalance: "1 ETH",
    ledgerBalance: "1 ETH",
    ledgerCleared: false,
    reentryReason:
      "外部调用发生在余额清零之前；receive() 执行时账面余额仍是 1 ETH。",
    callStack: [
      "ReentrancyAttacker.attack()",
      "VulnerableCharityVault.withdraw()",
      "ReentrancyAttacker.receive()",
    ],
    flow: "transfer",
  },
  {
    id: 3,
    title: "回环重入",
    actor: "攻击合约",
    fn: "receive() → withdraw()",
    funds:
      "receive() 沿同一调用水道再次进入 withdraw()，每次继续提取 1 ETH。",
    vaultBalance: "10 → 0 ETH",
    attackerBalance: "1 → 11 ETH",
    ledgerBalance: "1 ETH",
    ledgerCleared: false,
    reentryReason:
      "每次重入读取到的仍是 1 ETH；只要金库余额不少于 1 ETH，检查就会再次通过。",
    callStack: [
      "ReentrancyAttacker.attack()",
      "VulnerableCharityVault.withdraw()",
      "ReentrancyAttacker.receive()",
      "VulnerableCharityVault.withdraw() · 重入",
    ],
    flow: "loop",
  },
  {
    id: 4,
    title: "金库枯竭",
    actor: "调用栈回退",
    fn: "withdraw() 返回后清零",
    funds:
      "回环持续到金库余额为 0 ETH；调用栈逐层返回后，余额清零语句才执行。",
    vaultBalance: "0 ETH",
    attackerBalance: "11 ETH",
    ledgerBalance: "0 ETH",
    ledgerCleared: true,
    reentryReason:
      "金库已无足够余额继续发送 1 ETH，receive() 停止重入；此前提款均发生在清零之前。",
    callStack: [
      "receive() 不再重入",
      "嵌套 withdraw() 逐层返回",
      "balances[msg.sender] = 0",
    ],
    flow: "drained",
  },
];

export const QUEST_ONE_REPLAY_TIMING = {
  autoAdvance: 3200,
  balanceTransition: 450,
  transferPath: 900,
  loopPath: 1200,
  warningReveal: 600,
} as const;

export const QUEST_ONE_REPAIR_BLOCKS: RepairCodeBlock[] = [
  {
    id: "checks",
    englishName: "Checks",
    chineseName: "前置检查",
    code: [
      "uint256 amount = balances[msg.sender];",
      'require(amount > 0, "No balance to withdraw");',
    ],
    purpose: "读取并验证调用者余额，确认提款条件成立。",
  },
  {
    id: "effects",
    englishName: "Effects",
    chineseName: "内部生效",
    code: [
      "balances[msg.sender] = 0;",
      "emit Withdrawn(msg.sender, amount);",
    ],
    purpose: "先清零账面余额，并记录本次状态变化。",
  },
  {
    id: "interactions",
    englishName: "Interactions",
    chineseName: "外部交互",
    code: [
      '(bool success,) = msg.sender.call{value: amount}("");',
      'require(success, "Transfer failed");',
    ],
    purpose: "最后向外部地址转账，并确认调用成功。",
  },
];

export const QUEST_ONE_REPAIR_INITIAL_ORDER: RepairBlockId[] = [
  "checks",
  "interactions",
  "effects",
];

export const QUEST_ONE_REPAIR_CORRECT_ORDER: RepairBlockId[] = [
  "checks",
  "effects",
  "interactions",
];

export const QUEST_ONE_REPAIR_DIFF: {
  vulnerable: RepairDiffLine[];
  fixed: RepairDiffLine[];
} = {
  vulnerable: [
    {
      code: "uint256 amount = balances[msg.sender];",
      marker: "context",
    },
    {
      code: 'require(amount > 0, "No balance to withdraw");',
      marker: "context",
    },
    {
      code: '(bool success,) = msg.sender.call{value: amount}("");',
      marker: "context",
    },
    {
      code: 'require(success, "Transfer failed");',
      marker: "context",
    },
    {
      code: "balances[msg.sender] = 0;",
      marker: "removed",
      label: "− 删除/原位置",
    },
    {
      code: "emit Withdrawn(msg.sender, amount);",
      marker: "removed",
      label: "− 删除/原位置",
    },
  ],
  fixed: [
    {
      code: "uint256 amount = balances[msg.sender];",
      marker: "context",
    },
    {
      code: 'require(amount > 0, "No balance to withdraw");',
      marker: "context",
    },
    {
      code: "balances[msg.sender] = 0;",
      marker: "added",
      label: "+ 新增/新位置",
    },
    {
      code: "emit Withdrawn(msg.sender, amount);",
      marker: "added",
      label: "+ 新增/新位置",
    },
    {
      code: '(bool success,) = msg.sender.call{value: amount}("");',
      marker: "context",
    },
    {
      code: 'require(success, "Transfer failed");',
      marker: "context",
    },
  ],
};

export const QUEST_ONE_SEAL_TIMING = {
  sequence: 2400,
  sealStagger: 360,
  diffMove: 650,
  hpTransition: 700,
} as const;

export const QUEST_ONE_COPY = {
  act1: {
    eyebrow: "第一幕 · 妖兽现身",
    dialogue: "回环妖兽已现，金库灵脉正被它吞噬。",
    target: "找出最先打开重入窗口的代码。",
    action: "迎战",
    hint: "Boss HP 为本地学习进度，不是链上数据。",
  },
  act2: {
    eyebrow: "第二幕 · 寻出妖气",
    dialogue: "妖气藏在外部调用与账本更新之间。",
    target: "点击最先打开重入窗口的一行。",
    action: "确认剑诀",
    hint: "留意外部调用发生在余额清零之前。",
  },
  act3: {
    eyebrow: "第三幕 · 识破妖法",
    dialogue: "认清妖法，水阵才会回应。",
    target: "判断漏洞类型、五行属性和风险等级。",
    action: "显化水阵",
    hint: "三个判断全部正确后才能继续。",
  },
  act4: {
    eyebrow: "第四幕 · 回环噬灵",
    dialogue: "账本未清零，回调沿同一水道再次取款。",
    target: "看清 call、receive 与 withdraw 的回环。",
    action: "看破回环",
    hint: "Foundry 场景复现，不是 Monad 实时攻击。",
  },
  act5: {
    eyebrow: "第五幕 · 布阵封印",
    dialogue: "先断账本回环，再放灵力出阵。",
    target: "将余额清零移到外部调用之前。",
    action: "落阵封印",
    hint: "Checks → Effects → Interactions。",
    error: "阵序未成：Effects 必须先于 Interactions。",
    success: "回环已断，封印成阵。",
  },
} as const;
