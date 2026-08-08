export const ZERO_BYTES32 = `0x${"0".repeat(64)}` as const;

export const COMPLETION_CREDENTIAL_STATES = [
  "NOT_EARNED",
  "READY_FOR_ONCHAIN",
  "VERIFIED",
  "LEGACY_CREDENTIAL",
  "INCONSISTENT",
] as const;

export type CompletionCredentialState = typeof COMPLETION_CREDENTIAL_STATES[number];

export type CompletionCredentialStateInput = {
  completionHash?: unknown;
  hasCompletion: boolean;
  chainCompleted: unknown;
  reportHash: unknown;
  badgeBalance: unknown;
};

export function normalizeCredentialAddress(value: unknown): `0x${string}` | null {
  if (typeof value !== "string" || !/^0x[0-9a-f]{40}$/i.test(value)) return null;
  return value.toLowerCase() as `0x${string}`;
}

export function normalizeCredentialBytes32(value: unknown): `0x${string}` | null {
  if (typeof value !== "string" || !/^0x[0-9a-f]{64}$/i.test(value)) return null;
  return value.toLowerCase() as `0x${string}`;
}

export function normalizeCredentialBadgeBalance(value: unknown): bigint | null {
  if (typeof value === "bigint") return value >= BigInt(0) ? value : null;
  if (typeof value === "number") {
    return Number.isSafeInteger(value) && value >= 0 ? BigInt(value) : null;
  }
  if (typeof value === "string" && /^(?:0|[1-9][0-9]*)$/.test(value)) {
    try {
      return BigInt(value);
    } catch {
      return null;
    }
  }
  return null;
}

export function deriveCompletionCredentialState(
  input: CompletionCredentialStateInput,
): CompletionCredentialState {
  if (!input.hasCompletion) return "NOT_EARNED";

  const completionHash = normalizeCredentialBytes32(input.completionHash);
  const reportHash = normalizeCredentialBytes32(input.reportHash);
  const badgeBalance = normalizeCredentialBadgeBalance(input.badgeBalance);
  if (
    completionHash === null ||
    reportHash === null ||
    badgeBalance === null ||
    typeof input.chainCompleted !== "boolean"
  ) {
    return "INCONSISTENT";
  }

  if (!input.chainCompleted && reportHash === ZERO_BYTES32 && badgeBalance === BigInt(0)) {
    return "READY_FOR_ONCHAIN";
  }

  if (input.chainCompleted && badgeBalance >= BigInt(1)) {
    return reportHash === completionHash ? "VERIFIED" : "LEGACY_CREDENTIAL";
  }

  return "INCONSISTENT";
}

export function credentialStateForDto(state: CompletionCredentialState) {
  return state.toLowerCase() as Lowercase<CompletionCredentialState>;
}
