const SIMPLIFIED_CHINESE_ORIENTED_PATTERN = /\p{Script=Han}/u;

/**
 * User-facing candidate prose must contain Chinese text. Technical literals
 * such as Solidity identifiers may remain embedded unchanged.
 */
export function isSimplifiedChineseOrientedText(value: string): boolean {
  return SIMPLIFIED_CHINESE_ORIENTED_PATTERN.test(value);
}
