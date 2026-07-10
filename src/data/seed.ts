import { Badge, BeerCheckIn, Challenge, Group, User } from "@/types";

export const seedUser: User = {
  id: "user-current",
  name: "",
  favoriteBeer: "",
  avatar: "PS",
  hasOnboarded: false,
  level: 1,
  xp: 0,
  xpGoal: 500,
  totalBeers: 0,
  breweries: 0,
  cities: 0,
  states: 0,
  challengesCompleted: 0,
  badges: []
};

export const seedBadges: Badge[] = [
  { id: "badge-first-stamp", title: "First Stamp", description: "Check in your first beer.", icon: "beer" },
  { id: "badge-crew", title: "Crew Starter", description: "Create your first group.", icon: "people" },
  { id: "badge-states", title: "State Lines", description: "Check in across multiple states.", icon: "map" },
  { id: "badge-location", title: "Mapped Stamp", description: "Capture GPS-backed stamps.", icon: "location" }
];

export const seedGroups: Group[] = [];

export const seedCheckIns: BeerCheckIn[] = [];

export const seedChallenges: Challenge[] = [
  { id: "challenge-first-week", title: "First Week", description: "Log 7 beers in your first week.", current: 0, goal: 7, rewardBadgeId: "badge-first-stamp", icon: "calendar" },
  { id: "challenge-crew", title: "Crew Starter", description: "Create a group and post 10 crew check-ins.", current: 0, goal: 10, rewardBadgeId: "badge-crew", icon: "people" },
  { id: "challenge-cities", title: "City Explorer", description: "Check in beers across 10 different cities.", current: 0, goal: 10, rewardBadgeId: "badge-location", icon: "business" },
  { id: "challenge-states", title: "State Lines", description: "Collect beer stamps from 5 different states.", current: 0, goal: 5, rewardBadgeId: "badge-states", icon: "map" },
  { id: "challenge-location", title: "Mapped Stamps", description: "Capture 10 GPS-backed photo/location stamps.", current: 0, goal: 10, rewardBadgeId: "badge-location", icon: "location" },
  { id: "challenge-century", title: "Century Club", description: "Log 100 beers in Pintly.", current: 0, goal: 100, rewardBadgeId: "badge-first-stamp", icon: "trophy" }
];

export const seedGlobalCount = 0;
