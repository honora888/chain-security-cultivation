import type {
  EvidenceProvenance,
  ReentrancySignal,
  SignalSource,
  SignalStrength,
} from "./analysis-types";

export interface ReentrancyRuleSources {
  vulnerableSource: string;
  attackSource?: string;
  fixedSource?: string;
}

function signal(
  id: string,
  matched: boolean,
  strength: SignalStrength,
  source: SignalSource,
  evidenceType: EvidenceProvenance,
  explanation: string,
): ReentrancySignal {
  return { id, matched, strength, source, evidenceType, explanation };
}

function firstMatchIndex(source: string, pattern: RegExp): number {
  const match = pattern.exec(source);
  return match?.index ?? -1;
}

export function analyzeReentrancySignals(
  sources: ReentrancyRuleSources,
  evidenceType: EvidenceProvenance,
  includeFrozenEvidence: boolean,
): readonly ReentrancySignal[] {
  const vulnerable = sources.vulnerableSource;
  const attack = sources.attackSource ?? "";
  const fixed = sources.fixedSource ?? "";
  const nativeCallPattern = /\.call\s*\{\s*value\s*:/i;
  const withdrawalPattern =
    /\b(?:function\s+)?(?:withdraw|withdrawal|claim|redeem|payout|cashout)\b/i;
  const accountingPattern =
    /\b(?:balance|balances|credit|credits|deposit|deposits|ledger|accounting)\b/i;
  const stateMutationPattern =
    /(?:balances?|credits?|deposits?|ledger|accounting)\s*\[[^\]]+\]\s*(?:=|-=|\+=)/i;
  const callbackPattern = /\b(?:receive|fallback)\s*\([^)]*\)/i;

  const vulnerableCallIndex = firstMatchIndex(vulnerable, nativeCallPattern);
  const mutationAfterCall =
    vulnerableCallIndex >= 0 &&
    stateMutationPattern.test(vulnerable.slice(vulnerableCallIndex));
  const attackCallbackIndex = firstMatchIndex(attack, callbackPattern);
  const callbackReentry =
    attackCallbackIndex >= 0 &&
    /\.\s*(?:withdraw|claim|redeem|payout|cashout)\s*\(/i.test(
      attack.slice(attackCallbackIndex),
    );
  const fixedCallIndex = firstMatchIndex(fixed, nativeCallPattern);
  const fixedMutationIndex = firstMatchIndex(fixed, stateMutationPattern);
  const fixedStateFirst =
    fixedCallIndex >= 0 &&
    fixedMutationIndex >= 0 &&
    fixedMutationIndex < fixedCallIndex;
  const hasFundFlow =
    /\b(?:payable|donate|deposit|withdraw|transfer|vault)\b/i.test(
      `${vulnerable}\n${attack}`,
    ) && nativeCallPattern.test(vulnerable);

  const signals: ReentrancySignal[] = [
    signal(
      "external-native-value-call",
      vulnerableCallIndex >= 0,
      "strong",
      "vulnerableSource",
      evidenceType,
      "A low-level native-value call is present in the candidate vulnerable source.",
    ),
    signal(
      "withdrawal-semantics",
      withdrawalPattern.test(vulnerable),
      "moderate",
      "vulnerableSource",
      evidenceType,
      "The source contains a withdrawal-like function or payout semantic.",
    ),
    signal(
      "state-update-after-external-call",
      mutationAfterCall,
      "strong",
      "vulnerableSource",
      evidenceType,
      "Internal account state appears to be mutated only after the external value call.",
    ),
    signal(
      "callback-entry",
      attackCallbackIndex >= 0,
      "strong",
      "attackSource",
      evidenceType,
      "The supplied attack structure contains a receive or fallback callback.",
    ),
    signal(
      "callback-reentry",
      callbackReentry,
      "strong",
      "attackSource",
      evidenceType,
      "The callback contains another withdrawal-like call into its target.",
    ),
    signal(
      "fixed-state-before-call",
      fixedStateFirst,
      "strong",
      "fixedSource",
      evidenceType,
      "The comparison source updates internal account state before the external value call.",
    ),
    signal(
      "fixed-non-reentrant",
      /\bnonReentrant\b/.test(fixed),
      "moderate",
      "fixedSource",
      evidenceType,
      "The comparison source includes a nonReentrant guard as a supplemental defense.",
    ),
    signal(
      "accounting-state",
      accountingPattern.test(vulnerable),
      "moderate",
      "vulnerableSource",
      evidenceType,
      "The code refers to internal balance, credit, deposit, ledger, or accounting state.",
    ),
    signal(
      "fund-flow",
      hasFundFlow,
      "moderate",
      "vulnerableSource",
      evidenceType,
      "The matched patterns describe native-fund custody and payout flow.",
    ),
    signal(
      "access-control",
      /\b(?:onlyOwner|onlyRole|AccessControl|Ownable|msg\.sender\s*==)\b/i.test(
        vulnerable,
      ),
      "weak",
      "vulnerableSource",
      evidenceType,
      "An access-control pattern is present in the analyzed source.",
    ),
    signal(
      "state-lifecycle",
      /\b(?:pause|paused|active|status|phase|initialize|finalize)\b/i.test(
        vulnerable,
      ),
      "weak",
      "vulnerableSource",
      evidenceType,
      "A lifecycle or phase-state pattern is present in the analyzed source.",
    ),
    signal(
      "price-oracle-arithmetic",
      /\b(?:oracle|price|quote|rate|overflow|underflow)\b/i.test(vulnerable),
      "weak",
      "vulnerableSource",
      evidenceType,
      "A price, oracle, or explicit arithmetic-risk pattern is present.",
    ),
  ];

  if (includeFrozenEvidence) {
    signals.push(
      signal(
        "verified-attack-test",
        true,
        "strong",
        "frozenEvidence",
        "frozen-repository-evidence",
        "Frozen Foundry evidence records successful reproduction of the intentional attack fixture.",
      ),
      signal(
        "verified-fixed-regression",
        true,
        "strong",
        "frozenEvidence",
        "frozen-repository-evidence",
        "Frozen regression evidence records that the fixed fixture blocks the same attack path.",
      ),
      signal(
        "verified-invariant",
        true,
        "moderate",
        "frozenEvidence",
        "frozen-repository-evidence",
        "The frozen accounting invariant passed 64 runs and 2,048 calls with zero reverts.",
      ),
      signal(
        "verified-slither-contrast",
        true,
        "moderate",
        "frozenEvidence",
        "frozen-repository-evidence",
        "Frozen Slither evidence finds reentrancy detectors on the vulnerable fixture but not the same target path on the fixed fixture.",
      ),
      signal(
        "verified-human-conclusion",
        true,
        "strong",
        "frozenEvidence",
        "human-reviewed",
        "The frozen case conclusion was reviewed as an intentional Classic Reentrancy teaching fixture.",
      ),
    );
  }

  return signals;
}

export function signalMatched(
  signals: readonly ReentrancySignal[],
  id: string,
): boolean {
  return signals.some((entry) => entry.id === id && entry.matched);
}

export function supportsClassicReentrancy(
  signals: readonly ReentrancySignal[],
): boolean {
  const hasCoreSourcePattern =
    signalMatched(signals, "external-native-value-call") &&
    signalMatched(signals, "withdrawal-semantics") &&
    signalMatched(signals, "state-update-after-external-call");
  const hasAttackStructure =
    signalMatched(signals, "callback-entry") &&
    signalMatched(signals, "callback-reentry");

  return hasCoreSourcePattern &&
    (hasAttackStructure || signalMatched(signals, "verified-attack-test"));
}
