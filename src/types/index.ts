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

export type VenueConfirmationStatus = "confirmed" | "skipped" | "unavailable";
export type VenueSelectionStatus = "confirmed" | "changed" | "skipped" | "unavailable";

export type VenueCandidate = {
  provider: "google_places" | "foursquare" | "yelp" | "mock";
  providerPlaceId: string;
  name: string;
  category?: string;
  latitude: number;
  longitude: number;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  distanceMeters?: number;
  confidence?: number;
};

export type CheckInVenueProvider = VenueCandidate["provider"] | "manual" | "skipped" | "unavailable";

export type ReactionUser = {
  id: string;
  name: string;
  avatar: string;
  avatarUrl?: string;
  avatarCloudflareImageId?: string;
};

export type BeerComment = {
  id: string;
  checkInId: string;
  userId: string;
  userName: string;
  userAvatar: string;
  userAvatarUrl?: string;
  userAvatarCloudflareImageId?: string;
  body: string;
  createdAt: string;
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
  avatarCloudflareImageId?: string;
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
  avatarCloudflareImageId?: string;
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
  backdropCloudflareImageId?: string;
  backdropImageWidth?: number;
  backdropImageHeight?: number;
  backdropBlurhash?: string;
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

export type FriendProfile = {
  userId: string;
  name: string;
  avatar: string;
  avatarUrl?: string;
  avatarCloudflareImageId?: string;
  totalBeers?: number;
};

export type FriendRequest = {
  id: string;
  userId: string;
  name: string;
  avatar: string;
  avatarUrl?: string;
  avatarCloudflareImageId?: string;
  direction: "incoming" | "outgoing";
  status: "pending" | "approved" | "rejected";
  requestedAt: string;
};

export type ModerationReportStatus = "open" | "reviewed" | "dismissed" | "actioned";

export type UserBlock = {
  blockedUserId: string;
  createdAt: string;
};

export type ModerationReportReason = "harassment" | "hate" | "sexual_content" | "violence" | "spam" | "other";

export type ModerationReport = {
  id: string;
  reporterId: string;
  reportedUserId: string;
  checkInId?: string;
  groupId?: string;
  reason: ModerationReportReason;
  details?: string;
  status: ModerationReportStatus;
  createdAt: string;
  reporterName?: string;
  reportedUserName?: string;
};

export type UserSearchResult = {
  userId: string;
  name: string;
  avatar: string;
  avatarUrl?: string;
  avatarCloudflareImageId?: string;
  relationship: "none" | "friend" | "incoming" | "outgoing" | "self";
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
  venueId?: string;
  venueProvider?: CheckInVenueProvider;
  venueProviderPlaceId?: string;
  venueName?: string;
  venueCategory?: string;
  venueLatitude?: number;
  venueLongitude?: number;
  venueAddress?: string;
  venueDistanceMeters?: number;
  venueConfirmed?: boolean;
  venueConfirmationStatus?: VenueConfirmationStatus;
  venueSelectionStatus?: VenueSelectionStatus;
  note?: string;
  photoUri?: string;
  photoUrl?: string;
  photoStoragePath?: string;
  photoThumbnailUrl?: string;
  photoThumbnailStoragePath?: string;
  photoCloudflareImageId?: string;
  photoImageWidth?: number;
  photoImageHeight?: number;
  photoBlurhash?: string;
  photoSyncStatus?: "local" | "queued" | "syncing" | "synced" | "failed";
  remoteSyncStatus?: "queued" | "syncing" | "synced" | "failed";
  remoteSyncError?: string;
  scannedBeerCount?: number;
  scanConfidence?: number;
  scanStatus?: "confirmed" | "mismatch" | "uncertain" | "unavailable";
  scanBoxes?: BeerScanBox[];
  countSource?: "scanner" | "manual";
  groupIds: string[];
  createdAt: string;
  reactions: number;
  reactedBy: string[];
  reactionUsers?: ReactionUser[];
  comments: BeerComment[];
};

export type ActivityItem = BeerCheckIn & {
  groupId: string;
};

export type User = {
  id: string;
  name: string;
  username?: string;
  avatar: string;
  avatarUrl?: string;
  avatarStoragePath?: string;
  avatarCloudflareImageId?: string;
  avatarImageWidth?: number;
  avatarImageHeight?: number;
  avatarBlurhash?: string;
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

export type GlobalUserRank = {
  userId: string;
  totalBeers: number;
  checkInCount: number;
  rank: number;
  totalUsers: number;
  topPercent: number;
};

export type GroupMemberProfile = {
  user: {
    id: string;
    displayName: string;
    username?: string;
    avatar: string;
    avatarUrl?: string;
    avatarCloudflareImageId?: string;
    createdAt?: string;
  };
  group: {
    id: string;
    name: string;
  };
  level: {
    label: string;
    currentXp: number;
    nextLevelXp: number;
    points: number;
    percentile?: number;
  };
  stats: {
    allTimeBeers: number;
    beersInThisGroup: number;
    groupCount: number;
    badgeCount: number;
    groupRank?: number;
  };
  sharedGroups?: Array<{
    id: string;
    name: string;
    beers: number;
    rank?: number;
    isViewedGroup?: boolean;
  }>;
  recentActivity?: Array<{
    id: string;
    type: "beer_log" | "badge" | "challenge";
    title: string;
    subtitle?: string;
    imageUrl?: string;
    createdAt: string;
  }>;
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
  photoThumbnailUrl?: string;
  photoThumbnailStoragePath?: string;
  photoCloudflareImageId?: string;
  photoImageWidth?: number;
  photoImageHeight?: number;
  photoBlurhash?: string;
  photoSyncStatus?: BeerCheckIn["photoSyncStatus"];
  remoteSyncStatus?: BeerCheckIn["remoteSyncStatus"];
  scannedBeerCount?: number;
  scanConfidence?: number;
  scanStatus?: "confirmed" | "mismatch" | "uncertain" | "unavailable";
  scanBoxes?: BeerScanBox[];
  countSource?: "scanner" | "manual";
  latitude?: number;
  longitude?: number;
  venue?: VenueCandidate;
  venueProvider?: BeerCheckIn["venueProvider"];
  venueConfirmed?: boolean;
  venueConfirmationStatus?: VenueConfirmationStatus;
  venueSelectionStatus?: VenueSelectionStatus;
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
  photoThumbnailUrl?: string;
  photoThumbnailStoragePath?: string;
  photoCloudflareImageId?: string;
  photoImageWidth?: number;
  photoImageHeight?: number;
  photoBlurhash?: string;
  photoSyncStatus?: BeerCheckIn["photoSyncStatus"];
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
  backdropCloudflareImageId?: string;
  backdropImageWidth?: number;
  backdropImageHeight?: number;
  backdropBlurhash?: string;
};

export type UpdateGroupBackdropInput = {
  backdropUrl?: string;
  backdropStoragePath?: string;
  backdropCloudflareImageId?: string;
  backdropImageWidth?: number;
  backdropImageHeight?: number;
  backdropBlurhash?: string;
};

export type UpdateProfileInput = {
  name: string;
  avatarUrl?: string;
  avatarStoragePath?: string;
  avatarCloudflareImageId?: string;
  avatarImageWidth?: number;
  avatarImageHeight?: number;
  avatarBlurhash?: string;
};

export type GroupStats = {
  weeklyTotal: number;
  monthlyTotal: number;
  milestones: Array<{ label: string; complete: boolean }>;
};
