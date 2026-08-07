import {
  BESTIARY_SEVERITIES,
  type BestiaryQuestConversionStatus,
  type BestiarySourceDisclosure,
  type PublishedBestiaryEntry,
} from "./bestiary-types";

const QUEST_CONVERSION_STATUSES = [
  "not_started",
  "candidate",
  "ready",
  "registered_on_monad",
] as const satisfies readonly BestiaryQuestConversionStatus[];

const SOURCE_DISCLOSURES = [
  "summary_only",
  "reviewed_excerpt",
  "full_source",
] as const satisfies readonly BestiarySourceDisclosure[];

export class BestiaryApiError extends Error {
  constructor() {
    super("异兽志暂时无法展开，请稍后再试。");
    this.name = "BestiaryApiError";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requiredString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0
    ? value
    : null;
}

function nullableIso(value: unknown): string | null | undefined {
  if (value === null) return null;
  if (typeof value !== "string" || Number.isNaN(Date.parse(value))) {
    return undefined;
  }
  return value;
}

function stringArray(value: unknown): readonly string[] | null {
  return Array.isArray(value) && value.every((item) => typeof item === "string")
    ? value
    : null;
}

function oneOf<const T extends readonly string[]>(
  value: unknown,
  allowed: T,
): T[number] | null {
  return typeof value === "string" && allowed.includes(value)
    ? (value as T[number])
    : null;
}

function parseEntry(value: unknown): PublishedBestiaryEntry | null {
  if (!isRecord(value)) return null;

  const caseId = requiredString(value.caseId);
  const displayName = requiredString(value.displayName);
  const formalType = requiredString(value.formalType);
  const primaryElement = value.primaryElement === null
    ? null
    : requiredString(value.primaryElement);
  const secondaryElements = stringArray(value.secondaryElements);
  const realm = requiredString(value.realm);
  const severity = oneOf(value.severity, BESTIARY_SEVERITIES);
  const confidence = requiredString(value.confidence);
  const contributorAddress = requiredString(value.contributorAddress);
  const approvedAt = nullableIso(value.approvedAt);
  const publicationStatus = value.publicationStatus;
  const questConversionStatus = oneOf(
    value.questConversionStatus,
    QUEST_CONVERSION_STATUSES,
  );
  const summary = requiredString(value.summary);
  const attackPattern = stringArray(value.attackPattern);
  const prerequisites = stringArray(value.prerequisites);
  const impact = requiredString(value.impact);
  const mitigations = stringArray(value.mitigations);
  const knownLimitations = stringArray(value.knownLimitations);
  const sourceDisclosure = oneOf(value.sourceDisclosure, SOURCE_DISCLOSURES);

  if (
    !caseId || !displayName || !formalType || primaryElement === null && value.primaryElement !== null ||
    !secondaryElements || !realm || !severity || !confidence ||
    !contributorAddress || approvedAt === undefined ||
    publicationStatus !== "published" || !questConversionStatus ||
    !summary || !attackPattern || !prerequisites || !impact ||
    !mitigations || !knownLimitations || !sourceDisclosure
  ) {
    return null;
  }

  return {
    caseId,
    displayName,
    formalType,
    primaryElement,
    secondaryElements,
    realm,
    severity,
    confidence,
    contributorAddress,
    approvedAt,
    publicationStatus,
    questConversionStatus,
    summary,
    attackPattern,
    prerequisites,
    impact,
    mitigations,
    knownLimitations,
    sourceDisclosure,
  };
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json() as unknown;
  } catch {
    throw new BestiaryApiError();
  }
}

export async function fetchPublishedBestiary(
  signal?: AbortSignal,
): Promise<readonly PublishedBestiaryEntry[]> {
  const response = await fetch("/api/bestiary", {
    method: "GET",
    headers: { Accept: "application/json" },
    cache: "no-store",
    signal,
  });
  const body = await readJson(response);

  if (
    !response.ok || !isRecord(body) || body.ok !== true ||
    !Array.isArray(body.entries)
  ) {
    throw new BestiaryApiError();
  }

  const entries = body.entries.map(parseEntry);
  if (entries.some((entry) => entry === null)) throw new BestiaryApiError();
  return entries as readonly PublishedBestiaryEntry[];
}

export async function fetchPublishedBestiaryEntry(
  caseId: string,
  signal?: AbortSignal,
): Promise<PublishedBestiaryEntry> {
  const response = await fetch(`/api/bestiary/${encodeURIComponent(caseId)}`, {
    method: "GET",
    headers: { Accept: "application/json" },
    cache: "no-store",
    signal,
  });
  const body = await readJson(response);

  if (!response.ok || !isRecord(body) || body.ok !== true) {
    throw new BestiaryApiError();
  }
  const entry = parseEntry(body.entry);
  if (!entry) throw new BestiaryApiError();
  return entry;
}
