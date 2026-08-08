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
      "候选漏洞源码中存在低级原生资产 call。",
    ),
    signal(
      "withdrawal-semantics",
      vulnerableOrdering !== null,
      "moderate",
      "vulnerableSource",
      evidenceType,
      "同一支付函数先读取账户状态，再执行原生资产 call，最后才更新同一账户状态。",
    ),
    signal(
      "state-update-after-external-call",
      vulnerableOrdering !== null,
      "strong",
      "vulnerableSource",
      evidenceType,
      "匹配到的支付函数在携带价值的外部调用之后才更新同一账户 mapping。",
    ),
    signal(
      "callback-entry",
      hasCallback,
      "strong",
      "attackSource",
      evidenceType,
      "提交的攻击结构包含 receive() 或 fallback() 回调。",
    ),
    signal(
      "callback-reentry",
      callbackReentry,
      "strong",
      "attackSource",
      evidenceType,
      "回调再次调用了源码顺序证据所识别的同一漏洞支付函数。",
    ),
    signal(
      "fixed-state-before-call",
      fixedOrdering !== null,
      "strong",
      "fixedSource",
      evidenceType,
      "修复对照源码在携带价值的外部调用之前更新了同一账户状态。",
    ),
    signal(
      "fixed-non-reentrant",
      /\bnonReentrant\b/.test(fixed),
      "moderate",
      "fixedSource",
      evidenceType,
      "修复对照源码包含 nonReentrant 重入保护，作为补充防线。",
    ),
    signal(
      "accounting-state",
      vulnerableOrdering !== null,
      "moderate",
      "vulnerableSource",
      evidenceType,
      "检测到账户 mapping 的读取操作，且随后写入同一 mapping 条目。",
    ),
    signal(
      "fund-flow",
      vulnerableOrdering !== null,
      "moderate",
      "vulnerableSource",
      evidenceType,
      "关联的账户状态与原生资产 call 构成了资金托管与支付流程。",
    ),
    signal(
      "access-control",
      /\b(?:onlyOwner|onlyRole|AccessControl|Ownable|msg\.sender\s*==)\b/i.test(
        vulnerable,
      ),
      "weak",
      "vulnerableSource",
      evidenceType,
      "分析源码中存在访问控制模式。",
    ),
    signal(
      "state-lifecycle",
      /\b(?:pause|paused|active|status|phase|initialize|finalize)\b/i.test(
        vulnerable,
      ),
      "weak",
      "vulnerableSource",
      evidenceType,
      "分析源码中存在生命周期或阶段状态模式。",
    ),
    signal(
      "price-oracle-arithmetic",
      /\b(?:oracle|price|quote|rate|overflow|underflow)\b/i.test(vulnerable),
      "weak",
      "vulnerableSource",
      evidenceType,
      "分析源码中存在价格、预言机或显式算术风险模式。",
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
        "冻结的 Foundry 证据记录了教学攻击样例的成功复现。",
      ),
      signal(
        "verified-fixed-regression",
        true,
        "strong",
        "frozenEvidence",
        "frozen-repository-evidence",
        "冻结的回归证据记录了修复样例能够阻断同一攻击路径。",
      ),
      signal(
        "verified-invariant",
        true,
        "moderate",
        "frozenEvidence",
        "frozen-repository-evidence",
        "冻结的记账 Invariant 完成 64 轮、2,048 次调用，且没有 revert。",
      ),
      signal(
        "verified-slither-contrast",
        true,
        "moderate",
        "frozenEvidence",
        "frozen-repository-evidence",
        "冻结的 Slither 证据在漏洞样例中命中重入检测器，而修复样例的同一目标路径未命中。",
      ),
      signal(
        "verified-human-conclusion",
        true,
        "strong",
        "frozenEvidence",
        "human-reviewed",
        "冻结案例已经人工复核，确认为经典重入漏洞（Classic Reentrancy）教学样例。",
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
