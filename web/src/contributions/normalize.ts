import {
  CONTRIBUTION_BESTIARY_NAME_MAX_CHARS,
  CONTRIBUTION_BESTIARY_NAME_MIN_CHARS,
  ContributionHttpError,
} from "@/contributions/constants";

function hasControlCharacter(value: string): boolean {
  return /[\u0000-\u001f\u007f-\u009f]/u.test(value);
}

function cleanDisplayName(value: string): string {
  if (hasControlCharacter(value)) {
    throw new ContributionHttpError("INVALID_BESTIARY_NAME");
  }
  const normalized = value.normalize("NFKC").trim().replace(/\s+/gu, " ");
  return normalized;
}

export function normalizeCaseName(value: string): string {
  if (hasControlCharacter(value)) {
    throw new ContributionHttpError("INVALID_REQUEST");
  }
  const normalized = value.normalize("NFKC").trim().replace(/\s+/gu, " ");
  return normalized;
}

export function normalizeBestiaryName(value: string): string {
  const displayName = cleanDisplayName(value);
  const characterCount = Array.from(displayName).length;
  if (
    characterCount < CONTRIBUTION_BESTIARY_NAME_MIN_CHARS ||
    characterCount > CONTRIBUTION_BESTIARY_NAME_MAX_CHARS
  ) {
    throw new ContributionHttpError("INVALID_BESTIARY_NAME");
  }

  return displayName.replace(/[A-Z]/gu, (character) => character.toLowerCase());
}

export function displayBestiaryName(value: string): string {
  return cleanDisplayName(value);
}

export function normalizeSourceForHash(value: string): string {
  return value
    .replace(/\r\n?/gu, "\n")
    .split("\n")
    .map((line) => line.replace(/[ \t]+$/gu, ""))
    .join("\n")
    .trim();
}
