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

interface SolidityFunctionBlock {
  name: string;
  body: string;
  bodyOffset: number;
}

interface AccountingReference {
  mapping: string;
  key: string;
  index: number;
}

interface ReentrancyOrderingMatch {
  functionName: string;
  mapping: string;
  callIndex: number;
  writeIndex: number;
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

function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\/|\/\/[^\r\n]*/g, (comment) =>
    comment.replace(/[^\r\n]/g, " "),
  );
}

function matchingBrace(source: string, openingBrace: number): number {
  let depth = 0;

  for (let index = openingBrace; index < source.length; index += 1) {
    if (source[index] === "{") depth += 1;
    if (source[index] === "}") {
      depth -= 1;
      if (depth === 0) return index;
    }
  }

  return -1;
}

function extractFunctionBlocks(source: string): readonly SolidityFunctionBlock[] {
  const sanitized = stripComments(source);
  const header = /\bfunction\s+([A-Za-z_]\w*)\s*\([^)]*\)[^{;]*\{/g;
  const blocks: SolidityFunctionBlock[] = [];
  let match: RegExpExecArray | null;

  while ((match = header.exec(sanitized)) !== null) {
    const openingBrace = sanitized.indexOf("{", match.index);
    const closingBrace = matchingBrace(sanitized, openingBrace);
    if (closingBrace < 0) continue;

    blocks.push({
      name: match[1],
      body: sanitized.slice(openingBrace + 1, closingBrace),
      bodyOffset: openingBrace + 1,
    });
    header.lastIndex = closingBrace + 1;
  }

  return blocks;
}

function extractCallbackBlocks(source: string): readonly SolidityFunctionBlock[] {
  const sanitized = stripComments(source);
  const header = /\b(receive|fallback)\s*\([^)]*\)[^{;]*\{/g;
  const blocks: SolidityFunctionBlock[] = [];
  let match: RegExpExecArray | null;

  while ((match = header.exec(sanitized)) !== null) {
    const openingBrace = sanitized.indexOf("{", match.index);
    const closingBrace = matchingBrace(sanitized, openingBrace);
    if (closingBrace < 0) continue;

    blocks.push({
      name: match[1],
      body: sanitized.slice(openingBrace + 1, closingBrace),
      bodyOffset: openingBrace + 1,
    });
    header.lastIndex = closingBrace + 1;
  }

  return blocks;
}

function findMatches(source: string, pattern: RegExp): readonly RegExpExecArray[] {
  const matches: RegExpExecArray[] = [];
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(source)) !== null) {
    matches.push(match);
  }

  return matches;
}

function normalizeKey(key: string): string {
  return key.replace(/\s+/g, "");
}

function findAccountingReads(source: string): readonly AccountingReference[] {
  const reads: AccountingReference[] = [];
  const pattern =
    /\b(?:u?int(?:\d+)?|address|bool|bytes(?:\d+)?|string)\s+[A-Za-z_]\w*\s*=\s*([A-Za-z_]\w*)\s*\[\s*([^\]]+)\s*\]/g;

  for (const match of findMatches(source, pattern)) {
    reads.push({ mapping: match[1], key: normalizeKey(match[2]), index: match.index });
  }

  return reads;
}

function findAccountingWrites(source: string): readonly AccountingReference[] {
  const writes: AccountingReference[] = [];
  const assignment = /\b([A-Za-z_]\w*)\s*\[\s*([^\]]+)\s*\]\s*(?:=|[-+]=)\s*[^;]+;/g;
  const deletion = /\bdelete\s+([A-Za-z_]\w*)\s*\[\s*([^\]]+)\s*\]\s*;/g;

  for (const match of findMatches(source, assignment)) {
    writes.push({ mapping: match[1], key: normalizeKey(match[2]), index: match.index });
  }
  for (const match of findMatches(source, deletion)) {
    writes.push({ mapping: match[1], key: normalizeKey(match[2]), index: match.index });
  }

  return writes;
}

function sharesAccountingReference(
  left: AccountingReference,
  right: AccountingReference,
): boolean {
  return left.mapping === right.mapping && left.key === right.key;
}

function findOrderingMatch(
  source: string,
  stateWriteAfterCall: boolean,
): ReentrancyOrderingMatch | null {
  const nativeCall = /\.\s*call\s*\{\s*value\s*:\s*[^}]+\}\s*\(\s*(?:""|'')?\s*\)/g;

  for (const block of extractFunctionBlocks(source)) {
    const reads = findAccountingReads(block.body);
    const writes = findAccountingWrites(block.body);

    for (const call of findMatches(block.body, nativeCall)) {
      const read = reads.find((entry) => entry.index < call.index);
      if (!read) continue;
      const write = writes.find(
        (entry) =>
          sharesAccountingReference(entry, read) &&
          (stateWriteAfterCall
            ? entry.index > call.index
            : entry.index > read.index && entry.index < call.index),
      );
      if (!write) continue;

      return {
        functionName: block.name,
        mapping: read.mapping,
        callIndex: block.bodyOffset + call.index,
        writeIndex: block.bodyOffset + write.index,
      };
    }
  }

  return null;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function callbackReentersFunction(
  attackSource: string,
  functionName: string | undefined,
): boolean {
  if (!functionName) return false;

  const reentry = new RegExp(
    `\\.\\s*${escapeRegExp(functionName)}\\s*\\(`,
    "i",
  );
  return extractCallbackBlocks(attackSource).some((block) =>
    reentry.test(block.body),
  );
}

export function analyzeReentrancySignals(
  sources: ReentrancyRuleSources,
  evidenceType: EvidenceProvenance,
  includeFrozenEvidence: boolean,
): readonly ReentrancySignal[] {
  const vulnerable = sources.vulnerableSource;
  const attack = sources.attackSource ?? "";
  const fixed = sources.fixedSource ?? "";
  const vulnerableOrdering = findOrderingMatch(vulnerable, true);
  const fixedOrdering = findOrderingMatch(fixed, false);
  const hasCallback = extractCallbackBlocks(attack).length > 0;
  const callbackReentry = callbackReentersFunction(
    attack,
    vulnerableOrdering?.functionName,
  );
  const hasNativeValueCall = /\.\s*call\s*\{\s*value\s*:/i.test(
    stripComments(vulnerable),
  );

  const signals: ReentrancySignal[] = [
    signal(
      "external-native-value-call",
      hasNativeValueCall,
      "strong",
      "vulnerableSource",
      evidenceType,
      "A low-level native-value call is present in the candidate vulnerable source.",
    ),
    signal(
      "withdrawal-semantics",
      vulnerableOrdering !== null,
      "moderate",
      "vulnerableSource",
      evidenceType,
      "A single payout function reads per-account state, performs a native-value call, and finalizes the same account state afterward.",
    ),
    signal(
      "state-update-after-external-call",
      vulnerableOrdering !== null,
      "strong",
      "vulnerableSource",
      evidenceType,
      "The same per-account mapping is updated after its value-bearing external call in the matched payout function.",
    ),
    signal(
      "callback-entry",
      hasCallback,
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
      "The callback invokes the same vulnerable payout function identified by the source-ordering evidence.",
    ),
    signal(
      "fixed-state-before-call",
      fixedOrdering !== null,
      "strong",
      "fixedSource",
      evidenceType,
      "The comparison source updates the same per-account state before its value-bearing external call.",
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
      vulnerableOrdering !== null,
      "moderate",
      "vulnerableSource",
      evidenceType,
      "A per-account mapping read is linked to a later write of the same mapping entry.",
    ),
    signal(
      "fund-flow",
      vulnerableOrdering !== null,
      "moderate",
      "vulnerableSource",
      evidenceType,
      "The linked account state and native-value call describe a custody and payout flow.",
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
  return (
    signalMatched(signals, "external-native-value-call") &&
    signalMatched(signals, "accounting-state") &&
    signalMatched(signals, "state-update-after-external-call") &&
    signalMatched(signals, "callback-entry") &&
    signalMatched(signals, "callback-reentry")
  );
}
