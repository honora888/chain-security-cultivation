export type GuardianLlmMode = "disabled" | "hybrid";

export function parseGuardianLlmMode(
  raw: string | undefined,
): GuardianLlmMode {
  return raw === "hybrid" ? "hybrid" : "disabled";
}
