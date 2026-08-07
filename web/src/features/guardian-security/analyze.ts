import { createHash } from "node:crypto";

import {
  GuardianSecurityError,
  type FormalAnalysis,
  type GuardianSecurityRequest,
  type GuardianSecuritySuccess,
  type MossEvidence,
  type ReentrancySignal,
} from "./analysis-types";
import { classifyElements, classifyRealm } from "./classification";
import { createBestiaryDraft, createQuestDraft } from "./draft-generator";
import {
  QUEST_ONE_BUILTIN_SOURCES,
  QUEST_ONE_EVIDENCE_PROFILE,
} from "./quest-one-evidence";
import {
  analyzeReentrancySignals,
  signalMatched,
  supportsClassicReentrancy,
} from "./reentrancy-rules";
import { assessConfidence, assessSeverity } from "./severity";

function normalizeDraftSource(value: string | undefined): string {
  return (value ?? "")
    .replace(/\r\n?/gu, "\n")
    .split("\n")
    .map((line) => line.replace(/[ \t]+$/gu, ""))
    .join("\n")
    .trim();
}

function sourceFingerprint(sources: {
  vulnerableSource: string;
  attackSource?: string;
  fixedSource?: string;
}): string {
  return createHash("sha256")
    .update(JSON.stringify([
      normalizeDraftSource(sources.vulnerableSource),
      normalizeDraftSource(sources.attackSource),
      normalizeDraftSource(sources.fixedSource),
    ]), "utf8")
    .digest("hex");
}

function buildFormalAnalysis(
  signals: readonly ReentrancySignal[],
  inputMode: "builtin" | "sample",
): FormalAnalysis {
  const sourceProvenance =
    inputMode === "builtin"
      ? "frozen-repository-evidence"
      : "user-provided-unverified";
  const matchedEvidence = signals
    .filter((entry) => entry.matched)
    .map((entry) => ({
      text: entry.explanation,
      provenance: entry.evidenceType,
    }));
  const attackStructurePresent =
    signalMatched(signals, "callback-entry") &&
    signalMatched(signals, "callback-reentry");

  return {
    formalType: "Classic Reentrancy",
    category: "Reentrancy",
    rootCause:
      "A native-value external interaction can occur before the caller's internal accounting state is finalized, allowing callback control flow to observe stale state.",
    affectedFunctions: ["withdraw-like payout function"],
    prerequisites: [
      "The target holds native value and records per-caller accounting state.",
      "The payout recipient can execute code during the external value call.",
      "The same withdrawal path remains callable before internal state is finalized.",
    ],
    attackPath: [
      "Establish a positive internal balance.",
      "Invoke the withdrawal-like function.",
      "Receive native value before the target finalizes accounting.",
      "Re-enter the withdrawal-like function from receive/fallback.",
      "Repeat while the stale balance remains observable.",
    ],
    impact:
      "Repeated payouts may cause the contract's external native balance to diverge from its internal accounting and may drain custodied funds.",
    repeatability: attackStructurePresent
      ? "The observed callback structure can repeat the withdrawal path while the target balance permits it."
      : "Repeatability is inferred from the vulnerable ordering and requires separate execution evidence.",
    privilegeRequired:
      "No privileged role is required by the matched classic pattern; the caller needs a positive withdrawable balance and callback-capable recipient code.",
    mitigations: [
      "Apply Checks-Effects-Interactions and finalize internal state before the external value call.",
      "Verify normal withdrawal behavior and the adversarial callback regression path.",
      "Use a reentrancy guard as supplemental defense where appropriate, not as a substitute for correct accounting order.",
    ],
    evidence: matchedEvidence,
    inferences: [
      {
        text: "The combined source patterns are consistent with Classic Reentrancy.",
        provenance: "generated-inference",
      },
      {
        text: "Potential fund loss follows from the value-flow and stale-accounting structure; the rules do not calculate a monetary amount.",
        provenance: "generated-inference",
      },
    ],
    limitations: [
      {
        text:
          inputMode === "sample"
            ? "The supplied source text is unverified and was not compiled or executed."
            : "The conclusion is scoped to the frozen teaching case and its recorded evidence.",
        provenance:
          inputMode === "sample" ? sourceProvenance : "known-limitation",
      },
      {
        text: "Deterministic pattern matching is not a complete formal security audit.",
        provenance: "known-limitation",
      },
    ],
  };
}

export function analyzeGuardianSecurityCase(
  request: GuardianSecurityRequest,
  mossEvidence: MossEvidence,
): GuardianSecuritySuccess {
  const isBuiltin = request.mode === "builtin";
  const sources = isBuiltin ? QUEST_ONE_BUILTIN_SOURCES : request.sample;
  const signals = analyzeReentrancySignals(
    sources,
    isBuiltin
      ? "frozen-repository-evidence"
      : "user-provided-unverified",
    isBuiltin,
  );

  if (!supportsClassicReentrancy(signals)) {
    throw new GuardianSecurityError("UNSUPPORTED_VULNERABILITY");
  }

  const analysis = buildFormalAnalysis(signals, request.mode);
  const elements = classifyElements(signals);
  const realm = classifyRealm(signals);
  const severity = assessSeverity(signals);
  const confidence = assessConfidence(signals, request.mode, mossEvidence);
  const displayName = isBuiltin
    ? QUEST_ONE_EVIDENCE_PROFILE.displayName
    : request.sample.name;
  const limitations = isBuiltin
    ? QUEST_ONE_EVIDENCE_PROFILE.knownLimitations.map((entry) => entry.value)
    : [
        "User-provided source text is unverified.",
        "No proof of concept, Foundry test, invariant, or Slither scan was executed.",
        "No on-chain Guardian Quest identity applies to a user-provided sample.",
      ];
  const draftContext = {
    inputMode: request.mode,
    displayName,
    signals,
    analysis,
    elements,
    realm,
    severity,
    confidence,
    limitations,
    sourceFingerprint: sourceFingerprint(sources),
  } as const;
  const reviewReasons = [
    "Deterministic rules are not a formal audit.",
    "Generated drafts require editorial and security review.",
    ...(isBuiltin
      ? [
          "Moss verifies the registered Quest identity, not the complete security conclusion.",
        ]
      : [
          "Source text is user-provided and unverified.",
          "No proof of concept, Slither, Foundry, or invariant was executed.",
        ]),
  ];

  return {
    ok: true,
    schemaVersion: "guardian-security-analysis-v1",
    analyzedAt: new Date().toISOString(),
    agent: {
      mode: "deterministic-rules",
      externalModelConnected: false,
    },
    inputMode: request.mode,
    case: {
      caseId: isBuiltin ? QUEST_ONE_EVIDENCE_PROFILE.caseId : "user-sample",
      displayName,
      provenance: isBuiltin
        ? "frozen-repository-evidence"
        : "user-provided-unverified",
      ...(isBuiltin ? { evidenceProfile: QUEST_ONE_EVIDENCE_PROFILE } : {}),
    },
    mossEvidence,
    signals,
    analysis,
    classification: { elements, realm },
    severity,
    confidence,
    bestiaryDraft: createBestiaryDraft(draftContext),
    questDraft: createQuestDraft(draftContext),
    review: {
      status: "draft",
      requiresHumanApproval: true,
      publishAllowed: false,
      reasons: reviewReasons,
    },
    limitations,
  };
}
