import type {
  ComplexityFactor,
  ElementClassification,
  ElementName,
  RealmClassification,
  RealmName,
  ReentrancySignal,
} from "./analysis-types";
import {
  cultivationElementLabel,
  cultivationRealmLabel,
} from "./cultivation-labels";
import { signalMatched } from "./reentrancy-rules";

export function classifyElements(
  signals: readonly ReentrancySignal[],
): ElementClassification {
  const scores: Record<ElementName, number> = {
    Metal: 0,
    Wood: 0,
    Water: 0,
    Fire: 0,
    Earth: 0,
  };
  const rationale: string[] = [];

  function add(element: ElementName, points: number, reason: string): void {
    scores[element] += points;
    rationale.push(
      `${cultivationElementLabel(element)} · ${element} +${points}：${reason}`,
    );
  }

  if (signalMatched(signals, "external-native-value-call"))
    add("Water", 2, "存在原生资产外部流动");
  if (signalMatched(signals, "callback-entry"))
    add("Water", 3, "存在 receive()/fallback() 回调");
  if (signalMatched(signals, "callback-reentry"))
    add("Water", 3, "回调可重新进入目标函数");
  if (signalMatched(signals, "fund-flow"))
    add("Water", 1, "存在托管资金流");
  if (signalMatched(signals, "accounting-state"))
    add("Earth", 2, "涉及内部余额记账");
  if (signalMatched(signals, "state-update-after-external-call"))
    add("Earth", 3, "内部与外部余额可能失配");
  if (signalMatched(signals, "access-control"))
    add("Metal", 2, "命中访问控制信号");
  if (signalMatched(signals, "state-lifecycle"))
    add("Wood", 2, "命中状态生命周期信号");
  if (signalMatched(signals, "price-oracle-arithmetic"))
    add("Fire", 2, "命中价格、预言机或算术风险信号");

  const ranked = (Object.keys(scores) as ElementName[]).sort(
    (left, right) => scores[right] - scores[left],
  );
  const primaryElement = ranked[0];
  const secondaryElements = ranked.filter(
    (element) => element !== primaryElement && scores[element] >= 3,
  );

  return {
    primaryElement,
    primaryElementLabel: cultivationElementLabel(primaryElement),
    secondaryElements,
    elementScores: scores,
    rationale,
  };
}

function realmForScore(score: number): RealmName {
  if (score <= 2) return "Qi Refining";
  if (score <= 5) return "Foundation Establishment";
  if (score <= 10) return "Core Formation";
  if (score <= 14) return "Nascent Soul";
  if (score <= 18) return "Spirit Transformation";
  if (score <= 22) return "Mahayana";
  return "Tribulation";
}

export function classifyRealm(
  signals: readonly ReentrancySignal[],
): RealmClassification {
  const factorDefinitions: readonly [string, boolean, number, string][] = [
    [
      "singleFunction",
      signalMatched(signals, "withdrawal-semantics"),
      1,
      "危险的状态更新顺序集中在单个提款类函数中。",
    ],
    [
      "multipleFunctions",
      false,
      2,
      "当前证据未建立独立的多函数状态机。",
    ],
    [
      "crossContract",
      signalMatched(signals, "callback-reentry"),
      2,
      "攻击路径跨越资产合约与可执行回调的攻击合约。",
    ],
    [
      "callbackSemantics",
      signalMatched(signals, "callback-entry"),
      2,
      "需要理解 receive()/fallback() 回调的执行语义。",
    ],
    [
      "attackerContract",
      signalMatched(signals, "callback-reentry"),
      2,
      "证据中包含攻击合约结构。",
    ],
    [
      "proofOfConcept",
      signalMatched(signals, "verified-attack-test"),
      1,
      "只有冻结的内置案例记录了攻击 PoC 执行证据。",
    ],
    [
      "invariantReasoning",
      signalMatched(signals, "verified-invariant"),
      1,
      "冻结的内置案例包含记账 Invariant 推理。",
    ],
    [
      "protocolAccounting",
      false,
      2,
      "当前规则未建立协议级记账依赖。",
    ],
    [
      "multiTransaction",
      false,
      2,
      "核心利用路径不需要多笔交易流程。",
    ],
    [
      "crossProtocol",
      false,
      3,
      "当前证据未建立跨协议依赖。",
    ],
    [
      "crossChainOrMEV",
      false,
      4,
      "当前证据未建立跨链或 MEV 依赖。",
    ],
  ];

  const complexityFactors: ComplexityFactor[] = factorDefinitions.map(
    ([id, matched, points, explanation]) => ({
      id,
      matched,
      points: matched ? points : 0,
      explanation,
    }),
  );
  const realmScore = complexityFactors.reduce(
    (total, factor) => total + factor.points,
    0,
  );
  const realm = realmForScore(realmScore);

  return {
    realm,
    realmLabel: cultivationRealmLabel(realm),
    realmScore,
    complexityFactors,
    rationale: [
      `学习复杂度评分为 ${realmScore}；该评分不衡量资金影响。`,
      "跨合约回调语义与攻击合约结构构成主要学习复杂度。",
    ],
  };
}
