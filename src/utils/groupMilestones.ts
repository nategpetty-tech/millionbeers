export const GROUP_MILESTONE_TIERS = [10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000, 25000, 50000, 100000, 250000, 500000, 1000000] as const;

export function getGroupMilestoneProgress(beerCount: number) {
  const current = Math.max(0, Math.floor(Number.isFinite(beerCount) ? beerCount : 0));
  const finalTier = GROUP_MILESTONE_TIERS[GROUP_MILESTONE_TIERS.length - 1];
  const nextTier = GROUP_MILESTONE_TIERS.find((tier) => current < tier);

  if (!nextTier) {
    return {
      current: finalTier,
      target: finalTier,
      remaining: 0,
      completed: true
    };
  }

  return {
    current,
    target: nextTier,
    remaining: nextTier - current,
    completed: false
  };
}
