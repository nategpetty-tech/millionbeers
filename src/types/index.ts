export type BeerStyle =
  | "IPA"
  | "Pale Ale"
  | "Stout"
  | "Wheat"
  | "Lager"
  | "Sour"
  | "Pilsner"
  | "Porter"
  | "Saison"
  | "Other";

export type Location = {
  city: string;
  state?: string;
  country?: string;
  latitude?: number;
  longitude?: number;
};

export type Brewery = {
  id: string;
  name: string;
  location: Location;
  visitCount: number;
  beerCount: number;
};

export type Badge = {
  id: string;
  title: string;
  description: string;
  icon: string;
  unlockedAt?: string;
  color?: string;
};

export type Challenge = {
  id: string;
  title: string;
  description: string;
  current: number;
  goal: number;
  rewardBadgeId: string;
  icon: string;
};

export type GroupMember = {
  userId: string;
  name: string;
  avatar: string;
  avatarUrl?: string;
  beerCount: number;
  checkInCount: number;
  isCurrentUser?: boolean;
};

export type GroupJoinRequest = {
  id: string;
  userId: string;
  name: string;
  avatar: string;
  avatarUrl?: string;
  requestedAt: string;
  source: "search" | "invite";
  status: "pending" | "approved" | "rejected";
};

export type Group = {
  id: string;
  name: string;
  description?: string;
  image: string;
  backdropUrl?: string;
  backdropStoragePath?: string;
  privacy: "Private" | "Invite Only" | "Public";
  memberCount: number;
  goal: number;
  beerCount: number;
  breweryCount: number;
  cityCount: number;
  createdAt: string;
  founderId: string;
  inviteCode: string;
  members: GroupMember[];
  pendingRequests: GroupJoinRequest[];
};

export type BeerCheckIn = {
  id: string;
  userId: string;
  userName: string;
  userAvatar: string;
  userAvatarUrl?: string;
  beerName: string;
  quantity: number;
  brewery: string;
  style: BeerStyle;
  abv?: number;
  rating?: number;
  location: Location;
  note?: string;
  photoUri?: string;
  photoUrl?: string;
  photoStoragePath?: string;
  scannedBeerCount?: number;
  scanConfidence?: number;
  scanStatus?: "confirmed" | "mismatch" | "uncertain" | "unavailable";
  scanBoxes?: BeerScanBox[];
  countSource?: "scanner" | "manual";
  groupIds: string[];
  createdAt: string;
  reactions: number;
  reactedBy: string[];
};

export type ActivityItem = BeerCheckIn & {
  groupId: string;
};

export type User = {
  id: string;
  name: string;
  avatar: string;
  avatarUrl?: string;
  avatarStoragePath?: string;
  hasOnboarded: boolean;
  level: number;
  xp: number;
  xpGoal: number;
  totalBeers: number;
  breweries: number;
  cities: number;
  states: number;
  badges: Badge[];
  challengesCompleted: number;
};

export type CheckInInput = {
  beerName: string;
  quantity?: number;
  brewery: string;
  style?: BeerStyle;
  abv?: number;
  rating?: number;
  city: string;
  state?: string;
  country?: string;
  groupIds: string[];
  note?: string;
  photoUri?: string;
  photoUrl?: string;
  photoStoragePath?: string;
  scannedBeerCount?: number;
  scanConfidence?: number;
  scanStatus?: "confirmed" | "mismatch" | "uncertain" | "unavailable";
  scanBoxes?: BeerScanBox[];
  countSource?: "scanner" | "manual";
  latitude?: number;
  longitude?: number;
};

export type UpdateCheckInInput = {
  quantity: number;
  note?: string;
};

export type UpdateCheckInScanInput = {
  scannedBeerCount?: number;
  scanConfidence?: number;
  scanStatus?: BeerCheckIn["scanStatus"];
  scanBoxes?: BeerScanBox[];
};

export type UpdateCheckInPhotoInput = {
  photoUrl?: string;
  photoStoragePath?: string;
};

export type BeerScanBox = {
  x: number;
  y: number;
  width: number;
  height: number;
  confidence: number;
  label: string;
};

export type CreateGroupInput = {
  name: string;
  goal: number;
  privacy: Group["privacy"];
  description?: string;
  backdropUrl?: string;
  backdropStoragePath?: string;
};

export type UpdateGroupBackdropInput = {
  backdropUrl?: string;
  backdropStoragePath?: string;
};

export type UpdateProfileInput = {
  name: string;
  avatarUrl?: string;
  avatarStoragePath?: string;
};

export type GroupStats = {
  weeklyTotal: number;
  monthlyTotal: number;
  milestones: Array<{ label: string; complete: boolean }>;
};
