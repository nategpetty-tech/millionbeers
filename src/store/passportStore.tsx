import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, PropsWithChildren, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { friendsFeatureEnabled, screenshotDemoEnabled } from "@/config/features";
import { screenshotDemoCheckIns, screenshotDemoGlobalCount, screenshotDemoGroups, screenshotDemoUser } from "@/data/screenshotSeed";
import { seedBadges, seedChallenges, seedCheckIns, seedGlobalCount, seedGroups, seedUser } from "@/data/seed";
import {
  approveRemoteFriendRequest,
  approveRemoteJoinRequest,
  blockRemoteUser,
  cancelRemoteJoinRequest,
  claimRemoteUsername,
  createRemoteCheckInComment,
  createRemoteCheckInFromLocal,
  createRemoteGroup,
  deleteRemoteAccount,
  deleteRemoteCheckInComment,
  deleteRemoteCheckIn,
  fetchRemoteGlobalCount,
  fetchRemoteSnapshot,
  findRemoteGroupByInviteCode,
  rejectRemoteFriendRequest,
  rejectRemoteJoinRequest,
  reportRemoteUser,
  requestRemoteFriend,
  requestRemoteGroupJoin,
  searchRemoteUsers,
  toggleRemoteReaction,
  unblockRemoteUser,
  updateRemoteCheckIn,
  updateRemoteCheckInScan,
  updateRemoteGroupBackdrop,
  updateRemoteGroupNotifications,
  upsertProfile
} from "@/services/pintlyData";
import { cancelPhotoUpload, configurePhotoUploadQueue, enqueuePhotoUpload, startPhotoUploadQueueLifecycle } from "@/services/photoUploadQueue";
import { buildCloudflareImageUrl, createSignedProfilePhotoUrl, deleteCloudflareImage } from "@/services/photoStorage";
import {
  Badge,
  BeerCheckIn,
  Challenge,
  CheckInInput,
  CreateGroupInput,
  FriendProfile,
  FriendRequest,
  GlobalUserRank,
  Group,
  GroupJoinRequest,
  GroupMember,
  GroupStats,
  ModerationReportReason,
  UpdateProfileInput,
  UpdateGroupBackdropInput,
  UpdateCheckInInput,
  UpdateCheckInPhotoInput,
  UpdateCheckInScanInput,
  User,
  UserSearchResult
} from "@/types";
import { makeId, makeUuid } from "@/utils/format";
import { groupActivity } from "@/utils/activityFeed";
import { GROUP_MILESTONE_TIERS } from "@/utils/groupMilestones";
import type { AuthProfile } from "./authStore";

const STORAGE_KEY_PREFIX = "passport.mvp.state.v5";

type PassportState = {
  user: User;
  groups: Group[];
  checkIns: BeerCheckIn[];
  challenges: Challenge[];
  badges: Badge[];
  friends: FriendProfile[];
  friendRequests: FriendRequest[];
  globalCount: number;
  globalUserRank?: GlobalUserRank;
  blockedUserIds: string[];
  initialized: boolean;
};

type PassportActions = {
  initializeSeedData: () => Promise<void>;
  updateProfile: (input: UpdateProfileInput) => void;
  claimUsername: (username: string) => Promise<string>;
  createGroup: (input: CreateGroupInput) => Group;
  updateGroupBackdrop: (groupId: string, input: UpdateGroupBackdropInput) => void;
  updateGroupNotifications: (groupId: string, enabled: boolean) => void;
  requestJoinGroup: (groupId: string, source?: GroupJoinRequest["source"]) => void;
  requestJoinGroupFromInvite: (group: Group, source?: GroupJoinRequest["source"]) => void;
  cancelJoinRequest: (groupId: string) => void;
  findGroupByInviteCode: (inviteCode: string) => Promise<Group | null>;
  searchUsers: (query: string) => Promise<UserSearchResult[]>;
  requestFriend: (user: UserSearchResult) => void;
  approveFriendRequest: (requestId: string) => void;
  rejectFriendRequest: (requestId: string) => void;
  approveJoinRequest: (groupId: string, requestId: string) => void;
  rejectJoinRequest: (groupId: string, requestId: string) => void;
  checkInBeer: (input: CheckInInput) => CheckInResult;
  updateCheckIn: (checkInId: string, input: UpdateCheckInInput) => void;
  updateCheckInPhoto: (checkInId: string, input: UpdateCheckInPhotoInput) => void;
  updateCheckInScan: (checkInId: string, input: UpdateCheckInScanInput) => void;
  deleteCheckIn: (checkInId: string) => void;
  reactToCheckIn: (checkInId: string) => void;
  addCheckInComment: (checkInId: string, body: string) => void;
  deleteCheckInComment: (checkInId: string, commentId: string) => void;
  blockUser: (userId: string) => void;
  unblockUser: (userId: string) => void;
  reportUser: (input: { reportedUserId: string; checkInId?: string; groupId?: string; reason: ModerationReportReason; details?: string }) => void;
  deleteAccount: () => Promise<void>;
  getGroupLeaderboard: (groupId: string, mode?: "beers" | "checkIns") => GroupMember[];
  getGroupStats: (groupId: string) => GroupStats;
  getGroupActivity: (groupId: string) => BeerCheckIn[];
  updateChallengeProgress: (checkIn: BeerCheckIn) => void;
  resetDemoData: () => Promise<void>;
};

type PassportContextValue = PassportState & PassportActions;

const PassportContext = createContext<PassportContextValue | undefined>(undefined);

type CheckInResult = {
  checkIn: BeerCheckIn;
  completedChallenges: Challenge[];
  unlockedBadges: Badge[];
};

function storageKeyFor(userId: string) {
  return `${STORAGE_KEY_PREFIX}.${userId}`;
}

function createSeedState(authenticatedUser?: AuthProfile): PassportState {
  if (screenshotDemoEnabled) {
    return normalizeStoredState({
      user: screenshotDemoUser,
      groups: screenshotDemoGroups,
      checkIns: screenshotDemoCheckIns,
      challenges: seedChallenges,
      badges: seedBadges,
      friends: [],
      friendRequests: [],
      blockedUserIds: [],
      globalCount: screenshotDemoGlobalCount,
      globalUserRank: { userId: screenshotDemoUser.id, totalBeers: 2, checkInCount: 2, rank: 42, totalUsers: 520, topPercent: 8 },
      initialized: true
    });
  }
  const displayName = authenticatedUser?.displayName ?? authenticatedUser?.email?.split("@")[0] ?? "";
  return {
    user: {
      ...seedUser,
      id: authenticatedUser?.id ?? seedUser.id,
      name: displayName,
      username: authenticatedUser?.username,
      avatar: initialsFor(displayName),
      hasOnboarded: Boolean(displayName)
    },
    groups: seedGroups,
    checkIns: seedCheckIns,
    challenges: seedChallenges,
    badges: seedBadges,
    friends: [],
    friendRequests: [],
    blockedUserIds: [],
    globalCount: seedGlobalCount,
    globalUserRank: undefined,
    initialized: true
  };
}

function displayNameForAuthUser(authenticatedUser?: AuthProfile) {
  return authenticatedUser?.displayName ?? authenticatedUser?.email?.split("@")[0] ?? "";
}

function countDistinct<T>(items: T[]) {
  return new Set(items.filter(Boolean)).size;
}

function beerQuantity(checkIn: Pick<BeerCheckIn, "quantity">) {
  return Math.max(1, Number.isFinite(checkIn.quantity) ? checkIn.quantity : 1);
}

function totalBeerQuantity(checkIns: BeerCheckIn[]) {
  return checkIns.reduce((sum, checkIn) => sum + beerQuantity(checkIn), 0);
}

function levelProgressForBeerTotal(beerTotal: number, xpGoal: number) {
  const goal = Math.max(1, xpGoal);
  const totalXp = beerTotal * 25;
  return {
    level: Math.floor(totalXp / goal) + 1,
    xp: totalXp % goal,
    xpGoal: goal
  };
}

function initialsFor(name: string) {
  const initials = name
    .trim()
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  return initials || "PS";
}

function syncRemote(task: Promise<unknown>) {
  task.catch((error) => {
    console.warn("Pintly remote sync failed", error);
  });
}

function inviteCodeFor(name: string) {
  const prefix = name
    .replace(/[^a-z0-9]/gi, "")
    .slice(0, 4)
    .toUpperCase() || "PINT";
  return `${prefix}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
}

function incrementMember(members: GroupMember[], user: User, quantity: number) {
  const exists = members.some((member) => member.userId === user.id);
  const nextMembers = exists
    ? members.map((member) =>
        member.userId === user.id
          ? {
              ...member,
              avatarUrl: user.avatarUrl,
              beerCount: member.beerCount + quantity,
              checkInCount: member.checkInCount + 1,
              isCurrentUser: true
            }
          : member
      )
    : [
        ...members,
        {
          userId: user.id,
          name: user.name,
          avatar: user.avatar,
          avatarUrl: user.avatarUrl,
          beerCount: quantity,
          checkInCount: 1,
          isCurrentUser: true
        }
      ];
  return nextMembers;
}

function deriveUserAfterCheckIn(user: User, checkIns: BeerCheckIn[]) {
  const own = checkIns.filter((checkIn) => checkIn.userId === user.id);
  const ownBeerTotal = totalBeerQuantity(own);
  const levelProgress = levelProgressForBeerTotal(ownBeerTotal, user.xpGoal);
  return {
    ...user,
    ...levelProgress,
    totalBeers: ownBeerTotal,
    cities: Math.max(user.cities, countDistinct(own.map((checkIn) => checkIn.location.city))),
    states: Math.max(user.states, countDistinct(own.map((checkIn) => checkIn.location.state ?? "")))
  };
}

function deriveCounts(baseUser: User, checkIns: BeerCheckIn[], groups: Group[], globalFloor = 0) {
  const own = checkIns.filter((checkIn) => checkIn.userId === baseUser.id);
  const ownBeerTotal = totalBeerQuantity(own);
  const levelProgress = levelProgressForBeerTotal(ownBeerTotal, baseUser.xpGoal);
  const nextGroups = groups.map((group) => {
    const groupCheckIns = checkIns.filter((item) => item.groupIds.includes(group.id));
    const currentUserGroupCheckIns = groupCheckIns.filter((item) => item.userId === baseUser.id);
    const currentUserGroupBeerCount = totalBeerQuantity(currentUserGroupCheckIns);
    const members = group.members.map((member) =>
      member.userId === baseUser.id
        ? {
            ...member,
            beerCount: currentUserGroupBeerCount,
            checkInCount: currentUserGroupCheckIns.length,
            name: baseUser.name || "You",
            avatar: baseUser.avatar,
            avatarUrl: baseUser.avatarUrl
          }
        : member
    );
    return {
      ...group,
      founderId: group.founderId ?? baseUser.id,
      inviteCode: group.inviteCode ?? inviteCodeFor(group.name),
      pendingRequests: group.pendingRequests ?? [],
      beerCount: totalBeerQuantity(groupCheckIns),
      cityCount: countDistinct(groupCheckIns.map((item) => item.location.city)),
      breweryCount: countDistinct(groupCheckIns.map((item) => item.brewery)),
      members
    };
  });
  return {
    user: {
      ...baseUser,
      ...levelProgress,
      totalBeers: ownBeerTotal,
      cities: countDistinct(own.map((item) => item.location.city)),
      states: countDistinct(own.map((item) => item.location.state ?? ""))
    },
    groups: nextGroups,
    globalCount: Math.max(globalFloor, totalBeerQuantity(checkIns))
  };
}

function deriveChallenges(challenges: Challenge[], checkIns: BeerCheckIn[]) {
  const beerTotal = totalBeerQuantity(checkIns);
  const stateCount = countDistinct(checkIns.map((item) => item.location.state ?? ""));
  const cityCount = countDistinct(checkIns.map((item) => item.location.city));
  const crewCount = totalBeerQuantity(checkIns.filter((item) => item.groupIds.length > 0));
  const gpsCount = checkIns.filter((item) => typeof item.location.latitude === "number" && typeof item.location.longitude === "number").length;
  return challenges.map((challenge) => {
    if (challenge.id === "challenge-first-week") {
      return { ...challenge, current: Math.min(challenge.goal, beerTotal) };
    }
    if (challenge.id === "challenge-century") {
      return { ...challenge, current: Math.min(challenge.goal, beerTotal) };
    }
    if (challenge.id === "challenge-crew") {
      return { ...challenge, current: Math.min(challenge.goal, crewCount) };
    }
    if (challenge.id === "challenge-cities") {
      return { ...challenge, current: Math.min(challenge.goal, cityCount) };
    }
    if (challenge.id === "challenge-states") {
      return { ...challenge, current: Math.min(challenge.goal, stateCount) };
    }
    if (challenge.id === "challenge-location") {
      return { ...challenge, current: Math.min(challenge.goal, gpsCount) };
    }
    return challenge;
  });
}

function resolveChallengeUnlocks(previousChallenges: Challenge[], nextChallenges: Challenge[], badgeTemplates: Badge[], user: User) {
  const ownedBadgeIds = new Set(user.badges.map((badge) => badge.id));
  const unlockedBadgeIds = new Set<string>();
  const completedChallenges = nextChallenges.filter((challenge) => {
    const previous = previousChallenges.find((item) => item.id === challenge.id);
    return challenge.current >= challenge.goal && (previous?.current ?? 0) < challenge.goal;
  });
  const unlockedBadges = completedChallenges
    .map((challenge) => badgeTemplates.find((badge) => badge.id === challenge.rewardBadgeId))
    .filter((badge): badge is Badge => Boolean(badge))
    .filter((badge) => !ownedBadgeIds.has(badge.id))
    .filter((badge) => {
      if (unlockedBadgeIds.has(badge.id)) return false;
      unlockedBadgeIds.add(badge.id);
      return true;
    })
    .map((badge) => ({ ...badge, unlockedAt: new Date().toISOString() }));

  return { completedChallenges, unlockedBadges };
}

function deriveEarnedBadges(challenges: Challenge[], badgeTemplates: Badge[], user: User) {
  const ownedBadgeIds = new Set(user.badges.map((badge) => badge.id));
  const earned = challenges
    .filter((challenge) => challenge.current >= challenge.goal)
    .map((challenge) => badgeTemplates.find((badge) => badge.id === challenge.rewardBadgeId))
    .filter((badge): badge is Badge => Boolean(badge))
    .filter((badge) => !ownedBadgeIds.has(badge.id))
    .map((badge) => ({ ...badge, unlockedAt: new Date().toISOString() }));
  const uniqueEarned = earned.filter((badge, index, list) => list.findIndex((item) => item.id === badge.id) === index);
  return uniqueEarned.length ? [...uniqueEarned, ...user.badges] : user.badges;
}

function normalizeStoredState(savedState: PassportState): PassportState {
  const groups = savedState.groups.map((group) => ({
    ...group,
    founderId: group.founderId ?? savedState.user.id,
    inviteCode: group.inviteCode ?? inviteCodeFor(group.name),
    notificationsEnabled: group.notificationsEnabled ?? true,
    pendingRequests: group.pendingRequests ?? []
  }));
  const checkIns = savedState.checkIns.map((checkIn) => ({
    ...checkIn,
    quantity: beerQuantity(checkIn),
    photoSyncStatus: checkIn.photoSyncStatus ?? (checkIn.photoStoragePath || checkIn.photoUrl ? "synced" : checkIn.photoUri ? "queued" : undefined),
    photoCloudflareImageId: checkIn.photoCloudflareImageId,
    photoImageWidth: checkIn.photoImageWidth,
    photoImageHeight: checkIn.photoImageHeight,
    photoBlurhash: checkIn.photoBlurhash,
    photoSyncError: checkIn.photoSyncError,
    venueConfirmationStatus: checkIn.venueConfirmationStatus ?? "skipped",
    venueSelectionStatus: checkIn.venueSelectionStatus ?? (checkIn.venueConfirmationStatus === "confirmed" ? "confirmed" : checkIn.venueConfirmationStatus ?? "skipped"),
    venueConfirmed: checkIn.venueConfirmed ?? (checkIn.venueConfirmationStatus === "confirmed"),
    remoteSyncStatus: checkIn.remoteSyncStatus ?? "synced",
    comments: checkIn.comments ?? []
  }));
  const derived = deriveCounts(savedState.user, checkIns, groups, savedState.globalCount ?? seedGlobalCount);
  const challenges = deriveChallenges(savedState.challenges, checkIns);
  const badges = savedState.badges.length ? savedState.badges : seedBadges;
  const userWithBadges = {
    ...derived.user,
    badges: deriveEarnedBadges(challenges, badges, derived.user),
    challengesCompleted: challenges.filter((challenge) => challenge.current >= challenge.goal).length
  };
  return {
    ...savedState,
    checkIns,
    badges,
    friends: friendsFeatureEnabled ? savedState.friends ?? [] : [],
    friendRequests: friendsFeatureEnabled ? savedState.friendRequests ?? [] : [],
    blockedUserIds: savedState.blockedUserIds ?? [],
    user: userWithBadges,
    groups: derived.groups,
    challenges,
    globalCount: derived.globalCount,
    initialized: true
  };
}

function mergeRemoteCheckIns(localCheckIns: BeerCheckIn[], remoteCheckIns: BeerCheckIn[], currentUserId: string) {
  const remoteIds = new Set(remoteCheckIns.map((checkIn) => checkIn.id));
  const localById = new Map(localCheckIns.map((checkIn) => [checkIn.id, checkIn]));
  const mergedRemoteCheckIns = remoteCheckIns.map((remoteCheckIn) => {
    const localCheckIn = localById.get(remoteCheckIn.id);
    if (!localCheckIn || remoteCheckIn.userId !== currentUserId || hasRemotePhoto(remoteCheckIn) || !hasLocalPhoto(localCheckIn)) {
      return remoteCheckIn;
    }
    return {
      ...remoteCheckIn,
      photoUri: localCheckIn.photoUri,
      photoUrl: localCheckIn.photoUrl ?? remoteCheckIn.photoUrl,
      photoStoragePath: localCheckIn.photoStoragePath ?? remoteCheckIn.photoStoragePath,
      photoThumbnailUrl: localCheckIn.photoThumbnailUrl ?? remoteCheckIn.photoThumbnailUrl,
      photoThumbnailStoragePath: localCheckIn.photoThumbnailStoragePath ?? remoteCheckIn.photoThumbnailStoragePath,
      photoCloudflareImageId: localCheckIn.photoCloudflareImageId ?? remoteCheckIn.photoCloudflareImageId,
      photoImageWidth: localCheckIn.photoImageWidth ?? remoteCheckIn.photoImageWidth,
      photoImageHeight: localCheckIn.photoImageHeight ?? remoteCheckIn.photoImageHeight,
      photoBlurhash: localCheckIn.photoBlurhash ?? remoteCheckIn.photoBlurhash,
      photoSyncError: localCheckIn.photoSyncError,
      photoSyncStatus: localCheckIn.photoCloudflareImageId ? "synced" : localCheckIn.photoUri ? "queued" : localCheckIn.photoSyncStatus,
      remoteSyncStatus: localCheckIn.photoCloudflareImageId ? "queued" : remoteCheckIn.remoteSyncStatus
    };
  });
  const rescueCutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const localOnly = localCheckIns
    .filter((checkIn) => {
      if (remoteIds.has(checkIn.id)) return false;
      if (checkIn.remoteSyncStatus !== "synced") return true;
      if (checkIn.userId !== currentUserId) return false;
      return new Date(checkIn.createdAt).getTime() >= rescueCutoff;
    })
    .map((checkIn) =>
      checkIn.userId === currentUserId
        ? {
            ...checkIn,
            remoteSyncStatus: "queued" as const,
            remoteSyncError: undefined,
            photoSyncStatus:
              checkIn.photoUri && !checkIn.photoCloudflareImageId && checkIn.photoSyncStatus !== "synced" && checkIn.photoSyncStatus !== "failed"
                ? "queued"
                : checkIn.photoSyncStatus
          }
        : checkIn
    );
  return [...localOnly, ...mergedRemoteCheckIns].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

function hasRemotePhoto(checkIn: BeerCheckIn) {
  return Boolean(
    checkIn.photoCloudflareImageId ||
      checkIn.photoStoragePath ||
      checkIn.photoUrl ||
      checkIn.photoThumbnailStoragePath ||
      checkIn.photoThumbnailUrl
  );
}

function hasLocalPhoto(checkIn: BeerCheckIn) {
  return Boolean(checkIn.photoUri || hasRemotePhoto(checkIn));
}

async function refreshUserAvatarUrl(user: User): Promise<User> {
  const cloudflareAvatarUrl = buildCloudflareImageUrl(user.avatarCloudflareImageId, "feed");
  if (cloudflareAvatarUrl) return { ...user, avatarUrl: cloudflareAvatarUrl };
  if (!user.avatarStoragePath) return user;
  const avatarUrl = await createSignedProfilePhotoUrl(user.avatarStoragePath).catch(() => undefined);
  return avatarUrl ? { ...user, avatarUrl } : user;
}

async function loadStoredState(storageKey: string): Promise<PassportState | null> {
  const saved = await AsyncStorage.getItem(storageKey);
  if (!saved) return null;
  try {
    return normalizeStoredState(JSON.parse(saved));
  } catch {
    await AsyncStorage.removeItem(storageKey);
    return null;
  }
}

function bindStoredStateToAuthenticatedUser(savedState: PassportState, authenticatedUser?: AuthProfile): PassportState {
  if (!authenticatedUser) return savedState;
  const previousUserId = savedState.user.id;
  const displayName = savedState.user.name.trim() || displayNameForAuthUser(authenticatedUser);
  const nextAvatar = savedState.user.avatar || initialsFor(displayName);

  return {
    ...savedState,
    user: {
      ...savedState.user,
      id: authenticatedUser.id,
      name: displayName,
      username: authenticatedUser.username ?? savedState.user.username,
      avatar: nextAvatar,
      hasOnboarded: savedState.user.hasOnboarded || Boolean(displayName.trim())
    },
    checkIns: savedState.checkIns.map((checkIn) =>
      checkIn.userId === previousUserId
        ? {
            ...checkIn,
            userId: authenticatedUser.id,
            userName: displayName || checkIn.userName,
            userAvatar: nextAvatar
          }
        : checkIn
    ),
    groups: savedState.groups.map((group) => ({
      ...group,
      founderId: group.founderId === previousUserId ? authenticatedUser.id : group.founderId,
      members: group.members.map((member) =>
        member.userId === previousUserId
          ? {
              ...member,
              userId: authenticatedUser.id,
              name: displayName || member.name,
              avatar: nextAvatar
            }
          : member
      )
    }))
  };
}

type PassportProviderProps = PropsWithChildren<{
  authenticatedUser?: AuthProfile;
}>;

export function PassportProvider({ children, authenticatedUser }: PassportProviderProps) {
  const storageKey = storageKeyFor(authenticatedUser?.id ?? seedUser.id);
  const [state, setState] = useState<PassportState>(() => ({ ...createSeedState(authenticatedUser), initialized: false }));
  const remoteSyncingIds = useRef(new Set<string>());
  const remoteRetryTimers = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  const persist = useCallback(
    async (nextState: PassportState) => {
      await AsyncStorage.setItem(storageKey, JSON.stringify({ ...nextState, initialized: true }));
    },
    [storageKey]
  );

  const initializeSeedData = useCallback(async () => {
    try {
      if (screenshotDemoEnabled) {
        setState(createSeedState(authenticatedUser));
        return;
      }
      const stored = await loadStoredState(storageKey);
      const normalized = stored ? normalizeStoredState(bindStoredStateToAuthenticatedUser(stored, authenticatedUser)) : null;
      if (normalized) {
        const refreshedUser = await refreshUserAvatarUrl(normalized.user);
        const refreshed = normalizeStoredState({ ...normalized, user: refreshedUser });
        const remote = await fetchRemoteSnapshot(refreshed.user);
        const fallbackGlobalCount = remote ? null : await fetchRemoteGlobalCount();
        const nextState = remote
          ? normalizeStoredState({
              ...refreshed,
              user: remote.user,
              groups: remote.groups,
              checkIns: mergeRemoteCheckIns(refreshed.checkIns, remote.checkIns, remote.user.id),
              friends: remote.friends,
              friendRequests: remote.friendRequests,
              blockedUserIds: remote.blockedUserIds,
              globalCount: remote.globalCount,
              globalUserRank: remote.globalUserRank
            })
          : normalizeStoredState({
              ...refreshed,
              globalCount: fallbackGlobalCount ?? refreshed.globalCount
            });
        setState(nextState);
        await persist(nextState);
        return;
      }
      const seeded = createSeedState(authenticatedUser);
      const remote = await fetchRemoteSnapshot(seeded.user);
      const fallbackGlobalCount = remote ? null : await fetchRemoteGlobalCount();
      const nextState = remote
        ? normalizeStoredState({
            ...seeded,
            user: remote.user,
            groups: remote.groups,
            checkIns: mergeRemoteCheckIns(seeded.checkIns, remote.checkIns, remote.user.id),
            friends: remote.friends,
            friendRequests: remote.friendRequests,
            blockedUserIds: remote.blockedUserIds,
            globalCount: remote.globalCount,
            globalUserRank: remote.globalUserRank
          })
        : normalizeStoredState({
            ...seeded,
            globalCount: fallbackGlobalCount ?? seeded.globalCount
          });
      setState(nextState);
      await persist(nextState);
    } catch (error) {
      console.warn("Could not initialize Pintly data", errorMessage(error));
      const fallback = normalizeStoredState(createSeedState(authenticatedUser));
      setState(fallback);
      await persist(fallback).catch((persistError) => console.warn("Could not persist fallback Pintly data", errorMessage(persistError)));
    }
  }, [authenticatedUser, persist, storageKey]);

  useEffect(() => {
    void initializeSeedData();
  }, [initializeSeedData]);

  const updateProfile = useCallback(
    (input: UpdateProfileInput) => {
      const name = input.name.trim();
      setState((current) => {
        const nextUser = {
          ...current.user,
          name,
          favoriteBeer: input.favoriteBeer?.trim() ?? current.user.favoriteBeer,
          avatar: initialsFor(name),
          avatarUrl: input.avatarUrl ?? current.user.avatarUrl,
          avatarStoragePath: input.avatarStoragePath ?? current.user.avatarStoragePath,
          avatarCloudflareImageId: input.avatarCloudflareImageId ?? current.user.avatarCloudflareImageId,
          avatarImageWidth: input.avatarImageWidth ?? current.user.avatarImageWidth,
          avatarImageHeight: input.avatarImageHeight ?? current.user.avatarImageHeight,
          avatarBlurhash: input.avatarBlurhash ?? current.user.avatarBlurhash,
          hasOnboarded: Boolean(name)
        };
        const nextCheckIns = current.checkIns.map((checkIn) =>
          checkIn.userId === current.user.id
            ? { ...checkIn, userName: name || "You", userAvatar: nextUser.avatar, userAvatarUrl: nextUser.avatarUrl }
            : checkIn
        );
        const nextGroups = current.groups.map((group) => ({
          ...group,
          members: group.members.map((member) =>
            member.userId === current.user.id
              ? { ...member, name: name || "You", avatar: nextUser.avatar, avatarUrl: nextUser.avatarUrl, avatarCloudflareImageId: nextUser.avatarCloudflareImageId }
              : member
          )
        }));
        const next = { ...current, user: nextUser, checkIns: nextCheckIns, groups: nextGroups };
        void persist(next);
        syncRemote(upsertProfile(nextUser));
        return next;
      });
    },
    [persist]
  );

  const claimUsername = useCallback(
    async (username: string) => {
      const claimedUsername = await claimRemoteUsername(username);
      setState((current) => {
        const next = { ...current, user: { ...current.user, username: claimedUsername } };
        void persist(next);
        return next;
      });
      return claimedUsername;
    },
    [persist]
  );

  const createGroup = useCallback(
    (input: CreateGroupInput) => {
      const trimmedName = input.name.trim();
      const group: Group = {
        id: makeUuid(),
        name: trimmedName,
        description: input.description?.trim(),
        image: trimmedName
          .split(" ")
          .map((word) => word[0])
          .join("")
          .slice(0, 3)
          .toUpperCase(),
        backdropUrl: input.backdropUrl,
        backdropStoragePath: input.backdropStoragePath,
        backdropCloudflareImageId: input.backdropCloudflareImageId,
        backdropImageWidth: input.backdropImageWidth,
        backdropImageHeight: input.backdropImageHeight,
        backdropBlurhash: input.backdropBlurhash,
        privacy: input.privacy,
        memberCount: 1,
        goal: Math.max(1, input.goal),
        beerCount: 0,
        breweryCount: 0,
        cityCount: 0,
        createdAt: new Date().toISOString(),
        founderId: state.user.id,
        inviteCode: inviteCodeFor(trimmedName),
        notificationsEnabled: true,
        members: [
          {
            userId: state.user.id,
            name: state.user.name || "You",
            avatar: state.user.avatar,
            avatarUrl: state.user.avatarUrl,
            beerCount: 0,
            checkInCount: 0,
            isCurrentUser: true
          }
        ],
        pendingRequests: []
      };
      setState((current) => {
        const next = { ...current, groups: [group, ...current.groups] };
        void persist(next);
        return next;
      });
      syncRemote(createRemoteGroup(input, group));
      return group;
    },
    [persist, state.user]
  );

  const updateGroupBackdrop = useCallback(
    (groupId: string, input: UpdateGroupBackdropInput) => {
      setState((current) => {
        const nextGroups = current.groups.map((group) => {
          if (group.id !== groupId || group.founderId !== current.user.id) return group;
          return {
            ...group,
            backdropUrl: input.backdropUrl,
            backdropStoragePath: input.backdropStoragePath,
            backdropCloudflareImageId: input.backdropCloudflareImageId,
            backdropImageWidth: input.backdropImageWidth,
            backdropImageHeight: input.backdropImageHeight,
            backdropBlurhash: input.backdropBlurhash
          };
        });
        const next = { ...current, groups: nextGroups };
        void persist(next);
        return next;
      });
      syncRemote(updateRemoteGroupBackdrop(groupId, input));
    },
    [persist]
  );

  const updateGroupNotifications = useCallback(
    (groupId: string, enabled: boolean) => {
      setState((current) => {
        const nextGroups = current.groups.map((group) =>
          group.id === groupId && group.members.some((member) => member.userId === current.user.id)
            ? { ...group, notificationsEnabled: enabled }
            : group
        );
        const next = { ...current, groups: nextGroups };
        void persist(next);
        return next;
      });
      syncRemote(updateRemoteGroupNotifications(groupId, enabled));
    },
    [persist]
  );

  const requestJoinGroup = useCallback(
    (groupId: string, source: GroupJoinRequest["source"] = "search") => {
      setState((current) => {
        const nextGroups = current.groups.map((group) => {
          if (group.id !== groupId) return group;
          if (group.members.some((member) => member.userId === current.user.id)) return group;
          if (group.pendingRequests.some((request) => request.userId === current.user.id && request.status === "pending")) return group;
          return {
            ...group,
            pendingRequests: [
              {
                id: makeId("join"),
                userId: current.user.id,
                name: current.user.name || "Pintly User",
                avatar: current.user.avatar,
                avatarUrl: current.user.avatarUrl,
                requestedAt: new Date().toISOString(),
                source,
                status: "pending" as const
              },
              ...group.pendingRequests
            ]
          };
        });
        const next = { ...current, groups: nextGroups };
        void persist(next);
        return next;
      });
      syncRemote(requestRemoteGroupJoin(groupId, state.user, source));
    },
    [persist, state.user]
  );

  const requestJoinGroupFromInvite = useCallback(
    (invitedGroup: Group, source: GroupJoinRequest["source"] = "invite") => {
      setState((current) => {
        const pendingRequest: GroupJoinRequest = {
          id: makeId("join"),
          userId: current.user.id,
          name: current.user.name || "Pintly User",
          avatar: current.user.avatar,
          avatarUrl: current.user.avatarUrl,
          requestedAt: new Date().toISOString(),
          source,
          status: "pending"
        };
        const existing = current.groups.find((group) => group.id === invitedGroup.id);
        const nextGroups = existing
          ? current.groups.map((group) => {
              if (group.id !== invitedGroup.id) return group;
              if (group.members.some((member) => member.userId === current.user.id)) return group;
              if (group.pendingRequests.some((request) => request.userId === current.user.id && request.status === "pending")) return group;
              return { ...group, pendingRequests: [pendingRequest, ...group.pendingRequests] };
            })
          : [{ ...invitedGroup, pendingRequests: [pendingRequest, ...(invitedGroup.pendingRequests ?? [])] }, ...current.groups];
        const next = { ...current, groups: nextGroups };
        void persist(next);
        return next;
      });
      syncRemote(requestRemoteGroupJoin(invitedGroup.id, state.user, source));
    },
    [persist, state.user]
  );

  const findGroupByInviteCode = useCallback(
    async (inviteCode: string) => {
      const normalizedInviteCode = inviteCode.trim().toUpperCase();
      const localGroup = state.groups.find((group) => group.inviteCode.toUpperCase() === normalizedInviteCode);
      if (localGroup) return localGroup;
      const remoteGroup = await findRemoteGroupByInviteCode(normalizedInviteCode, state.user);
      return remoteGroup;
    },
    [state.groups, state.user]
  );

  const searchUsers = useCallback(async (query: string) => {
    if (!friendsFeatureEnabled) return [];
    return searchRemoteUsers(query);
  }, []);

  const requestFriend = useCallback(
    (target: UserSearchResult) => {
      if (!friendsFeatureEnabled) return;
      if (target.relationship !== "none") return;
      const optimisticRequest: FriendRequest = {
        id: makeId("friend"),
        userId: target.userId,
        name: target.name,
        avatar: target.avatar,
        avatarUrl: target.avatarUrl,
        direction: "outgoing",
        status: "pending",
        requestedAt: new Date().toISOString()
      };
      setState((current) => {
        if (current.friendRequests.some((request) => request.userId === target.userId && request.status === "pending")) return current;
        const next = { ...current, friendRequests: [optimisticRequest, ...current.friendRequests] };
        void persist(next);
        return next;
      });
      syncRemote(requestRemoteFriend(state.user, target.userId));
    },
    [persist, state.user]
  );

  const approveFriendRequest = useCallback(
    (requestId: string) => {
      if (!friendsFeatureEnabled) return;
      setState((current) => {
        const request = current.friendRequests.find((item) => item.id === requestId);
        if (!request) return current;
        const alreadyFriend = current.friends.some((friend) => friend.userId === request.userId);
        const next = {
          ...current,
          friends: alreadyFriend
            ? current.friends
            : [
                {
                  userId: request.userId,
                  name: request.name,
                  avatar: request.avatar,
                  avatarUrl: request.avatarUrl
                },
                ...current.friends
              ],
          friendRequests: current.friendRequests.map((item) => (item.id === requestId ? { ...item, status: "approved" as const } : item))
        };
        void persist(next);
        return next;
      });
      syncRemote(approveRemoteFriendRequest(requestId));
    },
    [persist]
  );

  const rejectFriendRequest = useCallback(
    (requestId: string) => {
      if (!friendsFeatureEnabled) return;
      setState((current) => {
        const next = {
          ...current,
          friendRequests: current.friendRequests.map((item) => (item.id === requestId ? { ...item, status: "rejected" as const } : item))
        };
        void persist(next);
        return next;
      });
      syncRemote(rejectRemoteFriendRequest(requestId));
    },
    [persist]
  );

  const approveJoinRequest = useCallback(
    (groupId: string, requestId: string) => {
      setState((current) => {
        const nextGroups = current.groups.map((group) => {
          if (group.id !== groupId || group.founderId !== current.user.id) return group;
          const request = group.pendingRequests.find((item) => item.id === requestId);
          if (!request) return group;
          const alreadyMember = group.members.some((member) => member.userId === request.userId);
          return {
            ...group,
            memberCount: alreadyMember ? group.memberCount : group.memberCount + 1,
            members: alreadyMember
              ? group.members
              : [
                  ...group.members,
                  {
                    userId: request.userId,
                    name: request.name,
                    avatar: request.avatar,
                    avatarUrl: request.avatarUrl,
                    beerCount: 0,
                    checkInCount: 0
                  }
                ],
            pendingRequests: group.pendingRequests.map((item) => (item.id === requestId ? { ...item, status: "approved" as const } : item))
          };
        });
        const next = { ...current, groups: nextGroups };
        void persist(next);
        return next;
      });
      syncRemote(approveRemoteJoinRequest(requestId));
    },
    [persist]
  );

  const rejectJoinRequest = useCallback(
    (groupId: string, requestId: string) => {
      setState((current) => {
        const nextGroups = current.groups.map((group) => {
          if (group.id !== groupId || group.founderId !== current.user.id) return group;
          return {
            ...group,
            pendingRequests: group.pendingRequests.map((item) => (item.id === requestId ? { ...item, status: "rejected" as const } : item))
          };
        });
        const next = { ...current, groups: nextGroups };
        void persist(next);
        return next;
      });
      syncRemote(rejectRemoteJoinRequest(requestId));
    },
    [persist]
  );

  const cancelJoinRequest = useCallback(
    (groupId: string) => {
      const requestId = state.groups
        .find((group) => group.id === groupId)
        ?.pendingRequests.find((item) => item.userId === state.user.id && item.status === "pending")?.id;
      if (!requestId) return;
      setState((current) => {
        const nextGroups = current.groups.map((group) => {
          if (group.id !== groupId) return group;
          const request = group.pendingRequests.find((item) => item.userId === current.user.id && item.status === "pending");
          if (!request) return group;
          return {
            ...group,
            pendingRequests: group.pendingRequests.map((item) => (item.id === request.id ? { ...item, status: "rejected" as const } : item))
          };
        });
        const next = { ...current, groups: nextGroups };
        void persist(next);
        return next;
      });
      syncRemote(cancelRemoteJoinRequest(requestId));
    },
    [persist, state.groups, state.user.id]
  );

  const updateChallengeProgress = useCallback(
    (checkIn: BeerCheckIn) => {
      setState((current) => {
        const nextChallenges = deriveChallenges(current.challenges, [...current.checkIns, checkIn]);
        const next = { ...current, challenges: nextChallenges };
        void persist(next);
        return next;
      });
    },
    [persist]
  );

  const checkInBeer = useCallback(
    (input: CheckInInput) => {
      const quantity = 1;
      const checkIn: BeerCheckIn = {
        id: makeUuid(),
        userId: state.user.id,
        userName: state.user.name || "You",
        userAvatar: state.user.avatar,
        userAvatarUrl: state.user.avatarUrl,
        beerName: input.beerName.trim(),
        quantity,
        brewery: input.brewery.trim(),
        style: input.style ?? "Other",
        abv: input.abv,
        rating: input.rating,
        location: {
          city: input.city.trim(),
          state: input.state?.trim() || undefined,
          country: input.country?.trim() || undefined,
          latitude: input.latitude,
          longitude: input.longitude
        },
        venueProvider: input.venue?.provider ?? input.venueProvider,
        venueProviderPlaceId: input.venue?.providerPlaceId,
        venueName: input.venue?.name,
        venueCategory: input.venue?.category,
        venueLatitude: input.venue?.latitude,
        venueLongitude: input.venue?.longitude,
        venueAddress: input.venue?.address,
        venueDistanceMeters: input.venue?.distanceMeters,
        venueConfirmed: input.venueConfirmed ?? (input.venueConfirmationStatus === "confirmed"),
        venueConfirmationStatus: input.venueConfirmationStatus ?? "skipped",
        venueSelectionStatus: input.venueSelectionStatus ?? (input.venueConfirmationStatus === "confirmed" ? "confirmed" : input.venueConfirmationStatus ?? "skipped"),
        note: input.note?.trim(),
        photoUri: input.photoUri,
        photoUrl: input.photoUrl,
        photoStoragePath: input.photoStoragePath,
        photoThumbnailUrl: input.photoThumbnailUrl,
        photoThumbnailStoragePath: input.photoThumbnailStoragePath,
        photoCloudflareImageId: input.photoCloudflareImageId,
        photoImageWidth: input.photoImageWidth,
        photoImageHeight: input.photoImageHeight,
        photoBlurhash: input.photoBlurhash,
        photoSyncStatus: input.photoSyncStatus ?? (input.photoStoragePath || input.photoUrl ? "synced" : input.photoUri ? "queued" : undefined),
        photoSyncError: input.photoSyncError,
        remoteSyncStatus: input.remoteSyncStatus ?? "queued",
        remoteSyncError: undefined,
        scannedBeerCount: input.scannedBeerCount,
        scanConfidence: input.scanConfidence,
        scanStatus: input.scanStatus,
        scanBoxes: input.scanBoxes,
        countSource: input.countSource ?? (input.scanStatus === "confirmed" ? "scanner" : "manual"),
        groupIds: input.groupIds,
        createdAt: new Date().toISOString(),
        reactions: 0,
        reactedBy: [],
        reactionUsers: [],
        comments: []
      };

      const projectedCheckIns = [checkIn, ...state.checkIns];
      const projectedChallenges = deriveChallenges(state.challenges, projectedCheckIns);
      const projectedUnlocks = resolveChallengeUnlocks(state.challenges, projectedChallenges, state.badges, state.user);

      setState((current) => {
        const nextCheckIns = [checkIn, ...current.checkIns];
        const nextGroups = current.groups.map((group) => {
          if (!input.groupIds.includes(group.id)) return group;
          const groupCheckIns = nextCheckIns.filter((item) => item.groupIds.includes(group.id));
          return {
            ...group,
            beerCount: group.beerCount + quantity,
            breweryCount: Math.max(group.breweryCount, countDistinct(groupCheckIns.map((item) => item.brewery))),
            cityCount: Math.max(group.cityCount, countDistinct(groupCheckIns.map((item) => item.location.city))),
            members: incrementMember(group.members, current.user, quantity)
          };
        });
        const nextUser = deriveUserAfterCheckIn(current.user, nextCheckIns);
        const nextChallenges = deriveChallenges(current.challenges, nextCheckIns);
        const { unlockedBadges } = resolveChallengeUnlocks(current.challenges, nextChallenges, current.badges, current.user);
        const userWithBadges = {
          ...nextUser,
          badges: unlockedBadges.length ? [...unlockedBadges, ...nextUser.badges] : nextUser.badges,
          challengesCompleted: nextChallenges.filter((challenge) => challenge.current >= challenge.goal).length
        };
        const next = {
          ...current,
          checkIns: nextCheckIns,
          groups: nextGroups,
          user: userWithBadges,
          challenges: nextChallenges,
          globalCount: current.globalCount + quantity
        };
        void persist(next);
        return next;
      });

      return { checkIn, ...projectedUnlocks };
    },
    [persist, state.badges, state.challenges, state.checkIns, state.user]
  );

  const updateCheckIn = useCallback(
    (checkInId: string, input: UpdateCheckInInput) => {
      setState((current) => {
        const target = current.checkIns.find((checkIn) => checkIn.id === checkInId);
        if (!target || target.userId !== current.user.id) return current;
        const quantity = 1;
        const nextCheckIns = current.checkIns.map((checkIn) =>
          checkIn.id === checkInId
            ? {
                ...checkIn,
                quantity,
                note: input.note?.trim() || undefined,
                countSource: "manual" as const,
                scanStatus:
                  typeof checkIn.scannedBeerCount === "number"
                    ? checkIn.scannedBeerCount === quantity
                      ? "confirmed"
                      : "mismatch"
                    : checkIn.scanStatus
              }
            : checkIn
        );
        const derived = deriveCounts(current.user, nextCheckIns, current.groups, seedGlobalCount);
        const nextChallenges = deriveChallenges(current.challenges, nextCheckIns);
        const next = {
          ...current,
          checkIns: nextCheckIns,
          groups: derived.groups,
          user: {
            ...derived.user,
            badges: deriveEarnedBadges(nextChallenges, current.badges, derived.user),
            challengesCompleted: nextChallenges.filter((challenge) => challenge.current >= challenge.goal).length
          },
          challenges: nextChallenges,
          globalCount: derived.globalCount
        };
        void persist(next);
        return next;
      });
      syncRemote(updateRemoteCheckIn(checkInId, input));
    },
    [persist]
  );

  useEffect(() => {
    const pending = state.checkIns.filter(
      (checkIn) =>
        checkIn.userId === state.user.id &&
        (checkIn.remoteSyncStatus === "queued" || checkIn.remoteSyncStatus === "failed") &&
        isReadyForRemotePublish(checkIn) &&
        !remoteSyncingIds.current.has(checkIn.id)
    );
    pending.forEach((checkIn) => {
      remoteSyncingIds.current.add(checkIn.id);
      setState((current) => {
        const next = {
          ...current,
          checkIns: current.checkIns.map((item) => (item.id === checkIn.id ? { ...item, remoteSyncStatus: "syncing" as const, remoteSyncError: undefined } : item))
        };
        void persist(next);
        return next;
      });
      withTimeout(createRemoteCheckInFromLocal(checkIn), 25_000, "Stamp sync timed out")
        .then(() => {
          setState((current) => {
            const next = {
              ...current,
              checkIns: current.checkIns.map((item) => (item.id === checkIn.id ? { ...item, remoteSyncStatus: "synced" as const, remoteSyncError: undefined } : item))
            };
            void persist(next);
            return next;
          });
        })
        .catch((error) => {
          console.warn("Could not sync check-in", error);
          setState((current) => {
            const next = {
              ...current,
              checkIns: current.checkIns.map((item) =>
                item.id === checkIn.id ? { ...item, remoteSyncStatus: "failed" as const, remoteSyncError: errorMessage(error) } : item
              )
            };
            void persist(next);
            return next;
          });
          if (!remoteRetryTimers.current.has(checkIn.id)) {
            const timer = setTimeout(() => {
              remoteRetryTimers.current.delete(checkIn.id);
              setState((current) => {
                const target = current.checkIns.find((item) => item.id === checkIn.id);
                if (!target || target.remoteSyncStatus !== "failed") return current;
                const next = {
                  ...current,
                  checkIns: current.checkIns.map((item) => (item.id === checkIn.id ? { ...item, remoteSyncStatus: "queued" as const } : item))
                };
                void persist(next);
                return next;
              });
            }, 15_000);
            remoteRetryTimers.current.set(checkIn.id, timer);
          }
        })
        .finally(() => {
          remoteSyncingIds.current.delete(checkIn.id);
        });
    });
  }, [persist, state.checkIns, state.user.id]);

  const updateCheckInScan = useCallback(
    (checkInId: string, input: UpdateCheckInScanInput) => {
      setState((current) => {
        const target = current.checkIns.find((checkIn) => checkIn.id === checkInId);
        if (!target || target.userId !== current.user.id) return current;
        const nextCheckIns = current.checkIns.map((checkIn) =>
          checkIn.id === checkInId
            ? {
                ...checkIn,
                scannedBeerCount: input.scannedBeerCount,
                scanConfidence: input.scanConfidence,
                scanStatus: input.scanStatus,
                scanBoxes: input.scanBoxes
              }
            : checkIn
        );
        const next = { ...current, checkIns: nextCheckIns };
        void persist(next);
        return next;
      });
      syncRemote(updateRemoteCheckInScan(checkInId, input));
    },
    [persist]
  );

  const updateCheckInPhoto = useCallback(
    (checkInId: string, input: UpdateCheckInPhotoInput) => {
      setState((current) => {
        const target = current.checkIns.find((checkIn) => checkIn.id === checkInId);
        if (!target || target.userId !== current.user.id) return current;
        const nextCheckIns = current.checkIns.map((checkIn) =>
          checkIn.id === checkInId
            ? {
                ...checkIn,
                photoUrl: input.photoUrl ?? checkIn.photoUrl,
                photoStoragePath: input.photoStoragePath ?? checkIn.photoStoragePath,
                photoThumbnailUrl: input.photoThumbnailUrl ?? checkIn.photoThumbnailUrl,
                photoThumbnailStoragePath: input.photoThumbnailStoragePath ?? checkIn.photoThumbnailStoragePath,
                photoCloudflareImageId: input.photoCloudflareImageId ?? checkIn.photoCloudflareImageId,
                photoImageWidth: input.photoImageWidth ?? checkIn.photoImageWidth,
                photoImageHeight: input.photoImageHeight ?? checkIn.photoImageHeight,
                photoBlurhash: input.photoBlurhash ?? checkIn.photoBlurhash,
                photoSyncStatus: input.photoSyncStatus ?? checkIn.photoSyncStatus,
                photoSyncError: input.photoSyncError,
                remoteSyncStatus: input.photoCloudflareImageId ? "queued" : checkIn.remoteSyncStatus,
                remoteSyncError: input.photoCloudflareImageId ? undefined : checkIn.remoteSyncError
              }
            : checkIn
        );
        const next = { ...current, checkIns: nextCheckIns };
        void persist(next);
        return next;
      });
    },
    [persist]
  );

  useEffect(() => {
    configurePhotoUploadQueue({
      onStart: ({ checkInId }) => {
        updateCheckInPhoto(checkInId, {
          photoSyncStatus: "syncing",
          photoSyncError: undefined
        });
      },
      onSuccess: async ({ checkInId, photoUrl, photoStoragePath, photoThumbnailUrl, photoThumbnailStoragePath, photoCloudflareImageId, photoImageWidth, photoImageHeight }) => {
        updateCheckInPhoto(checkInId, {
          photoUrl,
          photoStoragePath,
          photoThumbnailUrl,
          photoThumbnailStoragePath,
          photoCloudflareImageId,
          photoImageWidth,
          photoImageHeight,
          photoSyncStatus: "synced",
          photoSyncError: undefined
        });
      },
      onFailure: ({ checkInId, recoverable, error }) => {
        updateCheckInPhoto(checkInId, {
          photoSyncStatus: recoverable ? "queued" : "failed",
          photoSyncError: error
        });
      }
    });
    return startPhotoUploadQueueLifecycle();
  }, [updateCheckInPhoto]);

  useEffect(() => {
    state.checkIns
      .filter(
        (checkIn) =>
          checkIn.userId === state.user.id &&
          Boolean(checkIn.photoUri) &&
          !checkIn.photoCloudflareImageId &&
          checkIn.photoSyncStatus !== "syncing" &&
          checkIn.photoSyncStatus !== "synced" &&
          checkIn.photoSyncStatus !== "failed"
      )
      .forEach((checkIn) => {
        void enqueuePhotoUpload({
          checkInId: checkIn.id,
          localUri: checkIn.photoUri!,
          userId: state.user.id,
          width: checkIn.photoImageWidth,
          height: checkIn.photoImageHeight,
          groupIds: checkIn.groupIds
        });
      });
  }, [state.checkIns, state.user.id]);

  const deleteCheckIn = useCallback(
    (checkInId: string) => {
      const cloudflareImageId = state.checkIns.find((checkIn) => checkIn.id === checkInId && checkIn.userId === state.user.id)?.photoCloudflareImageId;
      setState((current) => {
        const target = current.checkIns.find((checkIn) => checkIn.id === checkInId);
        if (!target || target.userId !== current.user.id) return current;
        const nextCheckIns = current.checkIns.filter((checkIn) => checkIn.id !== checkInId);
        const derived = deriveCounts(current.user, nextCheckIns, current.groups, seedGlobalCount);
        const nextChallenges = deriveChallenges(current.challenges, nextCheckIns);
        const next = {
          ...current,
          checkIns: nextCheckIns,
          groups: derived.groups,
          user: {
            ...derived.user,
            challengesCompleted: nextChallenges.filter((challenge) => challenge.current >= challenge.goal).length
          },
          challenges: nextChallenges,
          globalCount: derived.globalCount
        };
        void persist(next);
        return next;
      });
      void cancelPhotoUpload(checkInId);
      syncRemote(deleteRemoteCheckIn(checkInId));
      const retryTimer = remoteRetryTimers.current.get(checkInId);
      if (retryTimer) {
        clearTimeout(retryTimer);
        remoteRetryTimers.current.delete(checkInId);
      }
      if (cloudflareImageId) syncRemote(deleteCloudflareImage(cloudflareImageId));
    },
    [persist, state.checkIns, state.user.id]
  );

  const reactToCheckIn = useCallback(
    (checkInId: string) => {
      setState((current) => {
        const target = current.checkIns.find((checkIn) => checkIn.id === checkInId);
        const wasReacted = target?.reactedBy.includes(current.user.id) ?? false;
        const nextCheckIns = current.checkIns.map((checkIn) => {
          if (checkIn.id !== checkInId) return checkIn;
          const alreadyReacted = checkIn.reactedBy.includes(current.user.id);
          const currentReactionUser = {
            id: current.user.id,
            name: current.user.name || "You",
            avatar: current.user.avatar,
            avatarUrl: current.user.avatarUrl
          };
          const existingReactionUsers = checkIn.reactionUsers ?? checkIn.reactedBy.map((id) => ({ id, name: "Pintly User", avatar: "PU" }));
          return {
            ...checkIn,
            reactions: alreadyReacted ? Math.max(0, checkIn.reactions - 1) : checkIn.reactions + 1,
            reactedBy: alreadyReacted
              ? checkIn.reactedBy.filter((id) => id !== current.user.id)
              : [...checkIn.reactedBy, current.user.id],
            reactionUsers: alreadyReacted
              ? existingReactionUsers.filter((reactionUser) => reactionUser.id !== current.user.id)
              : existingReactionUsers.some((reactionUser) => reactionUser.id === current.user.id)
                ? existingReactionUsers
                : [...existingReactionUsers, currentReactionUser]
          };
        });
        const next = { ...current, checkIns: nextCheckIns };
        void persist(next);
        syncRemote(toggleRemoteReaction(checkInId, wasReacted));
        return next;
      });
    },
    [persist]
  );

  const addCheckInComment = useCallback(
    (checkInId: string, body: string) => {
      const trimmed = body.trim().slice(0, 500);
      if (!trimmed) return;
      setState((current) => {
        const target = current.checkIns.find((checkIn) => checkIn.id === checkInId);
        if (!target) return current;
        const comment = {
          id: makeUuid(),
          checkInId,
          userId: current.user.id,
          userName: current.user.name || "You",
          userAvatar: current.user.avatar,
          userAvatarUrl: current.user.avatarUrl,
          userAvatarCloudflareImageId: current.user.avatarCloudflareImageId,
          body: trimmed,
          createdAt: new Date().toISOString()
        };
        const nextCheckIns = current.checkIns.map((checkIn) =>
          checkIn.id === checkInId ? { ...checkIn, comments: [...(checkIn.comments ?? []), comment] } : checkIn
        );
        const next = { ...current, checkIns: nextCheckIns };
        void persist(next);
        syncRemote(createRemoteCheckInComment(comment));
        return next;
      });
    },
    [persist]
  );

  const deleteCheckInComment = useCallback(
    (checkInId: string, commentId: string) => {
      setState((current) => {
        const target = current.checkIns.find((checkIn) => checkIn.id === checkInId);
        const comment = target?.comments.find((item) => item.id === commentId);
        if (!target || !comment || (comment.userId !== current.user.id && target.userId !== current.user.id)) return current;
        const nextCheckIns = current.checkIns.map((checkIn) =>
          checkIn.id === checkInId ? { ...checkIn, comments: checkIn.comments.filter((item) => item.id !== commentId) } : checkIn
        );
        const next = { ...current, checkIns: nextCheckIns };
        void persist(next);
        syncRemote(deleteRemoteCheckInComment(commentId));
        return next;
      });
    },
    [persist]
  );

  const blockUser = useCallback(
    (userId: string) => {
      if (!userId || userId === state.user.id) return;
      setState((current) => {
        if (current.blockedUserIds.includes(userId)) return current;
        const next = { ...current, blockedUserIds: [...current.blockedUserIds, userId] };
        void persist(next);
        return next;
      });
      syncRemote(blockRemoteUser(userId, state.user.id));
    },
    [persist, state.user.id]
  );

  const unblockUser = useCallback(
    (userId: string) => {
      setState((current) => {
        if (!current.blockedUserIds.includes(userId)) return current;
        const next = { ...current, blockedUserIds: current.blockedUserIds.filter((id) => id !== userId) };
        void persist(next);
        return next;
      });
      syncRemote(unblockRemoteUser(userId, state.user.id));
    },
    [persist, state.user.id]
  );

  const reportUser = useCallback(
    (input: { reportedUserId: string; checkInId?: string; groupId?: string; reason: ModerationReportReason; details?: string }) => {
      if (!input.reportedUserId || input.reportedUserId === state.user.id) return;
      syncRemote(reportRemoteUser({ ...input, reporterId: state.user.id }));
    },
    [state.user.id]
  );

  const deleteAccount = useCallback(async () => {
    await deleteRemoteAccount();
    await AsyncStorage.removeItem(storageKey);
  }, [storageKey]);

  const getGroupActivity = useCallback(
    (groupId: string) => groupActivity(state.checkIns, groupId, state.user.id, state.blockedUserIds),
    [state.blockedUserIds, state.checkIns, state.user.id]
  );

  const getGroupLeaderboard = useCallback(
    (groupId: string, mode: "beers" | "checkIns" = "beers") => {
      const group = state.groups.find((item) => item.id === groupId);
      if (!group) return [];
      const key = mode === "beers" ? "beerCount" : "checkInCount";
      return [...group.members].sort((a, b) => b[key] - a[key]);
    },
    [state.groups]
  );

  const getGroupStats = useCallback(
    (groupId: string): GroupStats => {
      const activity = groupActivity(state.checkIns, groupId, state.user.id, state.blockedUserIds);
      const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
      const monthAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
      const group = state.groups.find((item) => item.id === groupId);
      return {
        weeklyTotal: totalBeerQuantity(activity.filter((item) => new Date(item.createdAt).getTime() >= weekAgo)),
        monthlyTotal: totalBeerQuantity(activity.filter((item) => new Date(item.createdAt).getTime() >= monthAgo)),
        milestones: [
          ...GROUP_MILESTONE_TIERS.slice(0, 3).map((tier) => ({ label: `${tier.toLocaleString()} beer badge`, complete: (group?.beerCount ?? 0) >= tier })),
          { label: "10 feed posts", complete: activity.length >= 10 }
        ]
      };
    },
    [state.blockedUserIds, state.checkIns, state.groups, state.user.id]
  );

  const resetDemoData = useCallback(async () => {
    const seeded = createSeedState(authenticatedUser);
    setState(seeded);
    await persist(seeded);
  }, [authenticatedUser, persist]);

  const value = useMemo(
    () => ({
      ...state,
      initializeSeedData,
      updateProfile,
      claimUsername,
      createGroup,
      updateGroupBackdrop,
      updateGroupNotifications,
      requestJoinGroup,
      requestJoinGroupFromInvite,
      cancelJoinRequest,
      findGroupByInviteCode,
      searchUsers,
      requestFriend,
      approveFriendRequest,
      rejectFriendRequest,
      approveJoinRequest,
      rejectJoinRequest,
      checkInBeer,
      updateCheckIn,
      updateCheckInPhoto,
      updateCheckInScan,
      deleteCheckIn,
      reactToCheckIn,
      addCheckInComment,
      deleteCheckInComment,
      blockUser,
      unblockUser,
      reportUser,
      deleteAccount,
      getGroupLeaderboard,
      getGroupStats,
      getGroupActivity,
      updateChallengeProgress,
      resetDemoData
    }),
    [
      state,
      initializeSeedData,
      updateProfile,
      claimUsername,
      createGroup,
      updateGroupBackdrop,
      updateGroupNotifications,
      requestJoinGroup,
      requestJoinGroupFromInvite,
      cancelJoinRequest,
      findGroupByInviteCode,
      searchUsers,
      requestFriend,
      approveFriendRequest,
      rejectFriendRequest,
      approveJoinRequest,
      rejectJoinRequest,
      checkInBeer,
      updateCheckIn,
      updateCheckInPhoto,
      updateCheckInScan,
      deleteCheckIn,
      reactToCheckIn,
      addCheckInComment,
      deleteCheckInComment,
      blockUser,
      unblockUser,
      reportUser,
      deleteAccount,
      getGroupLeaderboard,
      getGroupStats,
      getGroupActivity,
      updateChallengeProgress,
      resetDemoData
    ]
  );

  return <PassportContext.Provider value={value}>{children}</PassportContext.Provider>;
}

function errorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (typeof error === "object" && error && "message" in error && typeof error.message === "string") return error.message;
  return "Could not sync stamp";
}

function withTimeout<T>(task: Promise<T>, ms: number, message: string) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<T>((_, reject) => {
    timer = setTimeout(() => reject(new Error(message)), ms);
  });
  return Promise.race<T>([task, timeout]).finally(() => {
    if (timer) clearTimeout(timer);
  });
}

function isReadyForRemotePublish(checkIn: BeerCheckIn) {
  if (checkIn.photoUri && !hasRemotePhoto(checkIn)) return false;
  return Boolean(checkIn.id);
}

export function usePassport() {
  const context = useContext(PassportContext);
  if (!context) {
    throw new Error("usePassport must be used within PassportProvider");
  }
  return context;
}
