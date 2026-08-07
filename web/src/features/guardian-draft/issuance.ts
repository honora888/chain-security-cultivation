import "server-only";

import type { GuardianHybridPublicResponse } from "@/features/guardian-llm/hybrid-analysis-types";
import {
  issueSignedGuardianDraftV1,
  type IssueSignedGuardianDraftV1Input,
} from "@/lib/guardian-draft-signing";

import type { SignedGuardianDraftV1 } from "./contracts";

export interface GuardianDraftIssuanceInput {
  readonly analysis: GuardianHybridPublicResponse;
  readonly authenticatedWallet: string | null;
  readonly caseName: string;
  readonly vulnerableSource: string;
  readonly attackSource?: string;
  readonly fixedSource?: string;
  readonly secret: string | null | undefined;
  readonly now?: IssueSignedGuardianDraftV1Input["now"];
  readonly randomBytes?: IssueSignedGuardianDraftV1Input["randomBytes"];
}

export function selectedBestiaryNameForGuardianDraft(
  analysis: GuardianHybridPublicResponse,
): string {
  if (analysis.schemaVersion === "guardian-security-candidate-analysis-v1") {
    return analysis.llmEnhancement.bestiaryNameCandidates[0];
  }
  return analysis.bestiaryDraft.name;
}

export function issueGuardianDraftForAuthenticatedSample(
  input: GuardianDraftIssuanceInput,
): SignedGuardianDraftV1 | null {
  if (input.authenticatedWallet === null) {
    return null;
  }

  return issueSignedGuardianDraftV1({
    analysis: input.analysis,
    selectedBestiaryName: selectedBestiaryNameForGuardianDraft(input.analysis),
    caseName: input.caseName,
    authenticatedWallet: input.authenticatedWallet,
    vulnerableSource: input.vulnerableSource,
    attackSource: input.attackSource,
    fixedSource: input.fixedSource,
    secret: input.secret,
    now: input.now,
    randomBytes: input.randomBytes,
  });
}
