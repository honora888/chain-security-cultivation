export const SAMPLE_BESTIARY_NAME_ATTEMPTS = 4;

const ELEMENT_NAME_STEMS = {
  Metal: "玄鉴破禁兽",
  Wood: "青藤迁化兽",
  Water: "回环噬灵兽",
  Fire: "赤焰衡价兽",
  Earth: "厚土守衡兽",
} as const;

/** Create a deterministic Agent draft name without accepting contributor naming input. */
export function createSampleBestiaryDraftName(
  primaryElement: keyof typeof ELEMENT_NAME_STEMS,
  sourceFingerprint: string,
  attempt = 0,
): string {
  if (!/^[0-9a-f]{64}$/u.test(sourceFingerprint)) {
    throw new Error("INVALID_SOURCE_FINGERPRINT");
  }
  if (!Number.isInteger(attempt) || attempt < 0 || attempt >= SAMPLE_BESTIARY_NAME_ATTEMPTS) {
    throw new Error("INVALID_NAME_ATTEMPT");
  }
  const offset = attempt * 12;
  const suffix = sourceFingerprint.slice(offset, offset + 12).toUpperCase();
  return `${ELEMENT_NAME_STEMS[primaryElement]}·${suffix}`;
}
