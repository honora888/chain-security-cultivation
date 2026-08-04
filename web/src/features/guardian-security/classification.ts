import type {
  ComplexityFactor,
  ElementClassification,
  ElementName,
  RealmClassification,
  RealmName,
  ReentrancySignal,
} from "./analysis-types";
import { signalMatched } from "./reentrancy-rules";

const ELEMENT_LABELS: Record<ElementName, string> = {
  Metal: "金",
  Wood: "木",
  Water: "水",
  Fire: "火",
  Earth: "土",
};

const REALM_LABELS: Record<RealmName, string> = {
  "Qi Refining": "练气期",
  "Foundation Establishment": "筑基期",
  "Core Formation": "金丹期",
  "Nascent Soul": "元婴期",
  "Spirit Transformation": "化神期",
  Mahayana: "大乘期",
  Tribulation: "渡劫期",
};

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
    rationale.push(`${element} +${points}: ${reason}`);
  }

  if (signalMatched(signals, "external-native-value-call"))
    add("Water", 2, "external native-value flow");
  if (signalMatched(signals, "callback-entry"))
    add("Water", 3, "receive/fallback callback");
  if (signalMatched(signals, "callback-reentry"))
    add("Water", 3, "callback re-entry");
  if (signalMatched(signals, "fund-flow"))
    add("Water", 1, "custodied fund flow");
  if (signalMatched(signals, "accounting-state"))
    add("Earth", 2, "internal balance accounting");
  if (signalMatched(signals, "state-update-after-external-call"))
    add("Earth", 3, "possible internal/external balance mismatch");
  if (signalMatched(signals, "access-control"))
    add("Metal", 2, "access-control signal");
  if (signalMatched(signals, "state-lifecycle"))
    add("Wood", 2, "state-lifecycle signal");
  if (signalMatched(signals, "price-oracle-arithmetic"))
    add("Fire", 2, "price, oracle, or arithmetic signal");

  const ranked = (Object.keys(scores) as ElementName[]).sort(
    (left, right) => scores[right] - scores[left],
  );
  const primaryElement = ranked[0];
  const secondaryElements = ranked.filter(
    (element) => element !== primaryElement && scores[element] >= 3,
  );

  return {
    primaryElement,
    primaryElementLabel: ELEMENT_LABELS[primaryElement],
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
      "The vulnerable state-ordering defect is concentrated in a withdrawal-like function.",
    ],
    [
      "multipleFunctions",
      false,
      2,
      "No separate multi-function state machine is established by the current evidence.",
    ],
    [
      "crossContract",
      signalMatched(signals, "callback-reentry"),
      2,
      "The attack path crosses between the vault and a callback-capable contract.",
    ],
    [
      "callbackSemantics",
      signalMatched(signals, "callback-entry"),
      2,
      "Understanding receive/fallback callback execution is required.",
    ],
    [
      "attackerContract",
      signalMatched(signals, "callback-reentry"),
      2,
      "An attacker-contract structure is part of the evidence.",
    ],
    [
      "proofOfConcept",
      signalMatched(signals, "verified-attack-test"),
      1,
      "A proof-of-concept execution is recorded only for the frozen builtin case.",
    ],
    [
      "invariantReasoning",
      signalMatched(signals, "verified-invariant"),
      1,
      "The frozen builtin case includes accounting-invariant reasoning.",
    ],
    [
      "protocolAccounting",
      false,
      2,
      "The present rules do not establish protocol-wide accounting dependencies.",
    ],
    [
      "multiTransaction",
      false,
      2,
      "The core exploit does not require a multi-transaction workflow.",
    ],
    [
      "crossProtocol",
      false,
      3,
      "No cross-protocol dependency is established.",
    ],
    [
      "crossChainOrMEV",
      false,
      4,
      "No cross-chain or MEV dependency is established.",
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
    realmLabel: REALM_LABELS[realm],
    realmScore,
    complexityFactors,
    rationale: [
      `The learning-complexity score is ${realmScore}; it does not measure financial impact.`,
      "Cross-contract callback semantics and attacker structure drive the principal complexity.",
    ],
  };
}
