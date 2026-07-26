import type { CodeLine } from "@/features/quest-1/battle-types";

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
} as const;
