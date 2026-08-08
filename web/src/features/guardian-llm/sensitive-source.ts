import "server-only";

import type { GuardianLlmUntrustedSources } from "./contracts";

export type GuardianSensitiveSourceScan =
  | { readonly blocked: false }
  | { readonly blocked: true; readonly reason: "SENSITIVE_SOURCE" };

/*
 * Keep this list deliberately narrow. Solidity commonly contains arbitrary
 * bytes32 values, hashes, addresses, signatures, and test constants; none of
 * those shapes are sensitive without an explicit credential context.
 */
const CONTEXTUAL_CREDENTIAL_PATTERN =
  /\b(?:PRIVATE[\s_-]*KEY|MNEMONIC|SEED[\s_-]*PHRASE|API[\s_-]*KEY|ACCESS[\s_-]*TOKEN|AUTH[\s_-]*TOKEN|PASSWORD|SECRET)\b\s*(?:=|:)\s*(?:["'][^"'\r\n]{8,}["']|[^\s"'();,}]{8,})/iu;

const HIGH_CONFIDENCE_PREFIX_PATTERNS: readonly RegExp[] = [
  /\bAKIA[0-9A-Z]{16}\b/u,
  /\bAIza[0-9A-Za-z_-]{35}\b/u,
  /\bgithub_pat_[0-9A-Za-z_]{20,}\b/u,
  /\bgh[opusr]_[0-9A-Za-z]{36,}\b/u,
  /\bsk_(?:live|test)_[0-9A-Za-z]{16,}\b/u,
  /\bxox[baprs]-[0-9A-Za-z-]{10,}\b/u,
];

export function scanGuardianSensitiveSource(
  source: string,
): GuardianSensitiveSourceScan {
  if (
    CONTEXTUAL_CREDENTIAL_PATTERN.test(source) ||
    HIGH_CONFIDENCE_PREFIX_PATTERNS.some((pattern) => pattern.test(source))
  ) {
    return { blocked: true, reason: "SENSITIVE_SOURCE" };
  }

  return { blocked: false };
}

export function scanGuardianLlmSources(
  sources: GuardianLlmUntrustedSources,
): GuardianSensitiveSourceScan {
  for (const source of [
    sources.vulnerableSource,
    sources.attackSource,
    sources.fixedSource,
  ]) {
    if (source !== undefined && scanGuardianSensitiveSource(source).blocked) {
      return { blocked: true, reason: "SENSITIVE_SOURCE" };
    }
  }

  return { blocked: false };
}
