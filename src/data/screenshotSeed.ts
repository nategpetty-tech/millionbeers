import { BeerCheckIn, Group, User } from "@/types";

const now = Date.now();
const hoursAgo = (hours: number) => new Date(now - hours * 60 * 60 * 1000).toISOString();
const daysAgo = (days: number) => new Date(now - days * 24 * 60 * 60 * 1000).toISOString();

export const screenshotDemoUser: User = {
  id: "demo-user-nate",
  name: "Nate",
  username: "nate_pints",
  favoriteBeer: "Crisp Pilsner",
  avatar: "NP",
  hasOnboarded: true,
  level: 4,
  xp: 325,
  xpGoal: 500,
  totalBeers: 0,
  breweries: 0,
  cities: 0,
  states: 0,
  challengesCompleted: 0,
  badges: []
};

const members = [
  { userId: "demo-user-nate", name: "Nate", avatar: "NP", beerCount: 0, checkInCount: 0, isCurrentUser: true },
  { userId: "demo-user-maya", name: "Maya", avatar: "MK", beerCount: 18, checkInCount: 14 },
  { userId: "demo-user-jordan", name: "Jordan", avatar: "JR", beerCount: 15, checkInCount: 12 },
  { userId: "demo-user-sam", name: "Sam", avatar: "SC", beerCount: 12, checkInCount: 9 }
];

export const screenshotDemoGroups: Group[] = [
  {
    id: "demo-group-chicago",
    name: "Chicago Tap Crew",
    description: "Weekend brewery visits around the city.",
    image: "CT",
    backdropUrl: "https://images.unsplash.com/photo-1559526324-593bc073d938?auto=format&fit=crop&w=1200&q=80",
    privacy: "Invite Only",
    memberCount: 4,
    goal: 250,
    beerCount: 0,
    breweryCount: 0,
    cityCount: 0,
    createdAt: daysAgo(36),
    founderId: "demo-user-nate",
    inviteCode: "TAPCREW",
    members,
    pendingRequests: [{ id: "demo-request-riley", userId: "demo-user-riley", name: "Riley", avatar: "RB", requestedAt: hoursAgo(8), source: "invite", status: "pending" }]
  },
  {
    id: "demo-group-afterwork",
    name: "After Work Pints",
    description: "Low-key check-ins after the laptop closes.",
    image: "AW",
    backdropUrl: "https://images.unsplash.com/photo-1518176258769-f227c798150e?auto=format&fit=crop&w=1200&q=80",
    privacy: "Private",
    memberCount: 4,
    goal: 100,
    beerCount: 0,
    breweryCount: 0,
    cityCount: 0,
    createdAt: daysAgo(18),
    founderId: "demo-user-maya",
    inviteCode: "AFTER5",
    members,
    pendingRequests: []
  },
  {
    id: "demo-group-brewery",
    name: "Brewery Passport",
    description: "Taprooms, patios, and beer gardens.",
    image: "BP",
    backdropUrl: "https://images.unsplash.com/photo-1535958636474-b021ee887b13?auto=format&fit=crop&w=1200&q=80",
    privacy: "Public",
    memberCount: 4,
    goal: 500,
    beerCount: 0,
    breweryCount: 0,
    cityCount: 0,
    createdAt: daysAgo(62),
    founderId: "demo-user-jordan",
    inviteCode: "PASSPORT",
    members,
    pendingRequests: []
  }
];

const users = {
  nate: { id: "demo-user-nate", name: "Nate", avatar: "NP" },
  maya: { id: "demo-user-maya", name: "Maya", avatar: "MK" },
  jordan: { id: "demo-user-jordan", name: "Jordan", avatar: "JR" },
  sam: { id: "demo-user-sam", name: "Sam", avatar: "SC" }
};

export const screenshotDemoCheckIns: BeerCheckIn[] = [
  {
    id: "demo-checkin-1",
    userId: "demo-user-nate",
    userName: "Nate",
    userAvatar: "NP",
    beerName: "Hazy River IPA",
    quantity: 1,
    brewery: "River North Brewing",
    style: "IPA",
    abv: 6.8,
    rating: 4.5,
    location: { city: "Chicago", state: "IL", country: "US", latitude: 41.884, longitude: -87.632 },
    venueProvider: "foursquare",
    venueProviderPlaceId: "demo-river-north-taproom",
    venueName: "River North Taproom",
    venueCategory: "Brewery",
    venueLatitude: 41.884,
    venueLongitude: -87.632,
    venueAddress: "Demo venue near River North",
    venueDistanceMeters: 42,
    venueConfirmationStatus: "confirmed",
    note: "Great patio pour before dinner.",
    photoUrl: "https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?auto=format&fit=crop&w=1200&q=80",
    photoSyncStatus: "synced",
    remoteSyncStatus: "synced",
    groupIds: ["demo-group-chicago", "demo-group-brewery"],
    createdAt: hoursAgo(2),
    reactions: 3,
    reactedBy: ["demo-user-maya", "demo-user-jordan", "demo-user-sam"],
    reactionUsers: [users.maya, users.jordan, users.sam],
    comments: [
      {
        id: "demo-comment-1",
        checkInId: "demo-checkin-1",
        userId: "demo-user-maya",
        userName: "Maya",
        userAvatar: "MK",
        body: "That patio looks perfect.",
        createdAt: hoursAgo(1.5)
      },
      {
        id: "demo-comment-2",
        checkInId: "demo-checkin-1",
        userId: "demo-user-jordan",
        userName: "Jordan",
        userAvatar: "JR",
        body: "Adding this spot to my list.",
        createdAt: hoursAgo(1)
      }
    ]
  },
  {
    id: "demo-checkin-2",
    userId: "demo-user-maya",
    userName: "Maya",
    userAvatar: "MK",
    beerName: "Patio Pils",
    quantity: 2,
    brewery: "Lakefront Lager Co.",
    style: "Pilsner",
    abv: 5.1,
    rating: 4,
    location: { city: "Chicago", state: "IL", country: "US", latitude: 41.91, longitude: -87.677 },
    venueName: "Logan Square Beer Garden",
    venueCategory: "Beer Garden",
    venueConfirmationStatus: "confirmed",
    note: "Crisp, sunny, exactly the vibe.",
    photoUrl: "https://images.unsplash.com/photo-1532634786-c8f8c1a006db?auto=format&fit=crop&w=1200&q=80",
    photoSyncStatus: "synced",
    remoteSyncStatus: "synced",
    groupIds: ["demo-group-chicago", "demo-group-afterwork"],
    createdAt: hoursAgo(5),
    reactions: 2,
    reactedBy: ["demo-user-nate", "demo-user-jordan"],
    reactionUsers: [users.nate, users.jordan],
    comments: [
      {
        id: "demo-comment-3",
        checkInId: "demo-checkin-2",
        userId: "demo-user-nate",
        userName: "Nate",
        userAvatar: "NP",
        body: "Solid pick after work.",
        createdAt: hoursAgo(4)
      }
    ]
  },
  {
    id: "demo-checkin-3",
    userId: "demo-user-jordan",
    userName: "Jordan",
    userAvatar: "JR",
    beerName: "Midnight Porter",
    quantity: 1,
    brewery: "Foundry Barrel House",
    style: "Porter",
    abv: 6.2,
    rating: 4.25,
    location: { city: "Evanston", state: "IL", country: "US", latitude: 42.045, longitude: -87.688 },
    venueName: "Foundry Barrel House",
    venueCategory: "Taproom",
    venueConfirmationStatus: "confirmed",
    note: "Roasty and smooth.",
    photoUrl: "https://images.unsplash.com/photo-1608270586620-248524c67de9?auto=format&fit=crop&w=1200&q=80",
    photoSyncStatus: "synced",
    remoteSyncStatus: "synced",
    groupIds: ["demo-group-brewery"],
    createdAt: daysAgo(1),
    reactions: 2,
    reactedBy: ["demo-user-nate", "demo-user-maya"],
    reactionUsers: [users.nate, users.maya],
    comments: []
  },
  {
    id: "demo-checkin-4",
    userId: "demo-user-nate",
    userName: "Nate",
    userAvatar: "NP",
    beerName: "Citrus Wheat",
    quantity: 1,
    brewery: "Prairie Path Brewing",
    style: "Wheat",
    abv: 5.4,
    rating: 4,
    location: { city: "Oak Park", state: "IL", country: "US", latitude: 41.885, longitude: -87.784 },
    venueName: "Prairie Path Brewing",
    venueCategory: "Brewery",
    venueConfirmationStatus: "confirmed",
    note: "Easy win after the train ride.",
    photoUrl: "https://images.unsplash.com/photo-1571613316887-6f8d5cbf7ef7?auto=format&fit=crop&w=1200&q=80",
    photoSyncStatus: "synced",
    remoteSyncStatus: "synced",
    groupIds: ["demo-group-brewery"],
    createdAt: daysAgo(2),
    reactions: 1,
    reactedBy: ["demo-user-sam"],
    reactionUsers: [users.sam],
    comments: []
  }
];

export const screenshotDemoGlobalCount = 12847;
