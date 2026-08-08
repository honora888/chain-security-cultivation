export const CONTRIBUTOR_REPUTATION_THRESHOLDS = [
  { title: "初入藏经阁", merit: 0 },
  { title: "寻卷修士", merit: 100 },
  { title: "异兽录士", merit: 500 },
  { title: "镇卷真人", merit: 1_500 },
  { title: "守阁尊者", merit: 5_000 },
] as const;

export type ContributorTitle = (typeof CONTRIBUTOR_REPUTATION_THRESHOLDS)[number]["title"];

export type ContributorReputation = {
  totalMerit: number;
  title: ContributorTitle;
  titleStartMerit: number;
  nextTitle: ContributorTitle | null;
  nextTitleMerit: number | null;
  meritIntoTitle: number;
  meritToNextTitle: number;
  progressPercent: number;
};

function normalizeMerit(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 0;
  return Math.floor(value);
}

export function deriveContributorReputation(value: number): ContributorReputation {
  const totalMerit = normalizeMerit(value);
  let index = 0;

  for (let candidate = 1; candidate < CONTRIBUTOR_REPUTATION_THRESHOLDS.length; candidate += 1) {
    if (totalMerit < CONTRIBUTOR_REPUTATION_THRESHOLDS[candidate].merit) break;
    index = candidate;
  }

  const current = CONTRIBUTOR_REPUTATION_THRESHOLDS[index];
  const next = CONTRIBUTOR_REPUTATION_THRESHOLDS[index + 1] ?? null;
  const meritIntoTitle = totalMerit - current.merit;
  const meritToNextTitle = next ? Math.max(0, next.merit - totalMerit) : 0;
  const span = next ? next.merit - current.merit : 0;
  const progressPercent = next
    ? Math.min(100, Math.max(0, (meritIntoTitle / span) * 100))
    : 100;

  return {
    totalMerit,
    title: current.title,
    titleStartMerit: current.merit,
    nextTitle: next?.title ?? null,
    nextTitleMerit: next?.merit ?? null,
    meritIntoTitle,
    meritToNextTitle,
    progressPercent,
  };
}
