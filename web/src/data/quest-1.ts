import type {
  ClassificationAnswers,
  ClassificationField,
  CodeLine,
} from "@/features/quest-1/battle-types";

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
} as const;
