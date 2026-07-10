import type { ImageSourcePropType } from "react-native";

export type ProfileBorderMilestone = {
  beers: number;
  source: ImageSourcePropType;
};

export const profileBorderMilestones: ProfileBorderMilestone[] = [
  { beers: 10, source: require("../../assets/profile/borders/10_beers.png") },
  { beers: 25, source: require("../../assets/profile/borders/25_beers.png") },
  { beers: 50, source: require("../../assets/profile/borders/50_beers.png") },
  { beers: 75, source: require("../../assets/profile/borders/75_beers.png") },
  { beers: 100, source: require("../../assets/profile/borders/100_beers.png") },
  { beers: 200, source: require("../../assets/profile/borders/200_beers.png") },
  { beers: 400, source: require("../../assets/profile/borders/400_beers.png") },
  { beers: 600, source: require("../../assets/profile/borders/600_beers.png") },
  { beers: 800, source: require("../../assets/profile/borders/800_beers.png") },
  { beers: 1000, source: require("../../assets/profile/borders/1000_beers.png") }
];

export function profileBorderForBeerCount(beerCount?: number | null) {
  const count = Math.max(0, Math.floor(Number(beerCount) || 0));
  for (let index = profileBorderMilestones.length - 1; index >= 0; index -= 1) {
    const milestone = profileBorderMilestones[index];
    if (count >= milestone.beers) return milestone;
  }
  return null;
}

export function nextProfileBorderMilestone(beerCount?: number | null) {
  const count = Math.max(0, Math.floor(Number(beerCount) || 0));
  return profileBorderMilestones.find((milestone) => count < milestone.beers) ?? null;
}

export function profileBorderProgress(beerCount?: number | null) {
  const count = Math.max(0, Math.floor(Number(beerCount) || 0));
  const nextMilestone = nextProfileBorderMilestone(count);
  if (!nextMilestone) {
    const finalMilestone = profileBorderMilestones[profileBorderMilestones.length - 1];
    return {
      current: finalMilestone.beers,
      goal: finalMilestone.beers,
      remaining: 0,
      nextMilestone: null
    };
  }

  return {
    current: Math.min(count, nextMilestone.beers),
    goal: nextMilestone.beers,
    remaining: Math.max(0, nextMilestone.beers - count),
    nextMilestone
  };
}

export function profileBorderDrinkerLabel(beerCount?: number | null) {
  const currentMilestone = profileBorderForBeerCount(beerCount);
  const tierIndex = currentMilestone ? profileBorderMilestones.findIndex((milestone) => milestone.beers === currentMilestone.beers) + 2 : 1;
  return `Level ${tierIndex} Drinker`;
}

export function profileBorderFrameSize(avatarSize: number) {
  return Math.round(avatarSize * 1.42);
}
