import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, PropsWithChildren, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { seedBadges, seedChallenges, seedCheckIns, seedGlobalCount, seedGroups, seedUser } from "@/data/seed";
import {
  approveRemoteJoinRequest,
  createRemoteCheckIn,
  createRemoteGroup,
  deleteRemoteCheckIn,
  fetchRemoteSnapshot,
  rejectRemoteJoinRequest,
  requestRemoteGroupJoin,
  toggleRemoteReaction,
  updateRemoteGroupBackdrop,
  upsertProfile
} from "@/services/pintlyData";
import {
  Badge,
  BeerCheckIn,
  Challenge,
  CheckInInput,
  CreateGroupInput,
  Group,
  GroupJoinRequest,
  GroupMember,
  GroupStats,
  UpdateProfileInput,
  UpdateGroupBackdropInput,
  User
} from "@/types";
import { makeId, makeUuid } from "@/utils/format";
import type { AuthProfile } from "./authStore";

const STORAGE_KEY_PREFIX = "passport.mvp.state.v5";

type PassportState = {
  user: User;
  groups: Group[];
  checkIns: BeerCheckIn[];
  challenges: Challenge[];
  badges: Badge[];
  globalCount: number;
  initialized: boolean;
};

type PassportActions = {
  initializeSeedData: () => Promise<void>;
  updateProfile: (input: UpdateProfileInput) => void;
  createGroup: (input: CreateGroupInput) => Group;
  updateGroupBackdrop: (groupId: string, input: UpdateGroupBackdropInput) => void;
  requestJoinGroup: (groupId: string, source?: GroupJoinRequest["source"]) => void;
  approveJoinRequest: (groupId: string, requestId: string) => void;
  rejectJoinRequest: (groupId: string, requestId: string) => void;
  checkInBeer: (input: CheckInInput) => CheckInResult;
  deleteCheckIn: (checkInId: string) => void;
  reactToCheckIn: (checkInId: string) => void;
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
  const displayName = authenticatedUser?.displayName ?? authenticatedUser?.email?.split("@")[0] ?? "";
  return {
    user: {
      ...seedUser,
      id: authenticatedUser?.id ?? seedUser.id,
      name: displayName,
      avatar: initialsFor(displayName),
      hasOnboarded: Boolean(displayName)
    },
    groups: seedGroups,
    checkIns: seedCheckIns,
    challenges: seedChallenges,
    badges: seedBadges,
    globalCount: seedGlobalCount,
    initialized: true
  };
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
  return {
    ...user,
    totalBeers: ownBeerTotal,
    cities: Math.max(user.cities, countDistinct(own.map((checkIn) => checkIn.location.city))),
    states: Math.max(user.states, countDistinct(own.map((checkIn) => checkIn.location.state ?? ""))),
    xp: Math.min(user.xpGoal, ownBeerTotal * 25)
  };
}

function deriveCounts(baseUser: User, checkIns: BeerCheckIn[], groups: Group[], globalFloor = 0) {
  const own = checkIns.filter((checkIn) => checkIn.userId === baseUser.id);
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
      totalBeers: totalBeerQuantity(own),
      cities: countDistinct(own.map((item) => item.location.city)),
      states: countDistinct(own.map((item) => item.location.state ?? "")),
      xp: Math.min(baseUser.xpGoal, totalBeerQuantity(own) * 25)
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
    pendingRequests: group.pendingRequests ?? []
  }));
  const checkIns = savedState.checkIns.map((checkIn) => ({
    ...checkIn,
    quantity: beerQuantity(checkIn)
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
    user: userWithBadges,
    groups: derived.groups,
    challenges,
    globalCount: derived.globalCount,
    initialized: true
  };
}

type PassportProviderProps = PropsWithChildren<{
  authenticatedUser?: AuthProfile;
}>;

export function PassportProvider({ children, authenticatedUser }: PassportProviderProps) {
  const storageKey = storageKeyFor(authenticatedUser?.id ?? seedUser.id);
  const [state, setState] = useState<PassportState>(() => ({ ...createSeedState(authenticatedUser), initialized: false }));

  const persist = useCallback(
    async (nextState: PassportState) => {
      await AsyncStorage.setItem(storageKey, JSON.stringify({ ...nextState, initialized: true }));
    },
    [storageKey]
  );

  const initializeSeedData = useCallback(async () => {
    const saved = await AsyncStorage.getItem(storageKey);
    if (saved) {
      const normalized = normalizeStoredState(JSON.parse(saved));
      const remote = await fetchRemoteSnapshot(normalized.user);
      const nextState = remote
        ? normalizeStoredState({ ...normalized, groups: remote.groups, checkIns: remote.checkIns, globalCount: remote.globalCount })
        : normalized;
      setState(nextState);
      await persist(nextState);
      return;
    }
    const seeded = createSeedState(authenticatedUser);
    const remote = await fetchRemoteSnapshot(seeded.user);
    const nextState = remote
      ? normalizeStoredState({ ...seeded, groups: remote.groups, checkIns: remote.checkIns, globalCount: remote.globalCount })
      : seeded;
    setState(nextState);
    await persist(nextState);
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
          avatar: initialsFor(name),
          avatarUrl: input.avatarUrl ?? current.user.avatarUrl,
          avatarStoragePath: input.avatarStoragePath ?? current.user.avatarStoragePath,
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
            member.userId === current.user.id ? { ...member, name: name || "You", avatar: nextUser.avatar, avatarUrl: nextUser.avatarUrl } : member
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
        privacy: input.privacy,
        memberCount: 1,
        goal: Math.max(1, input.goal),
        beerCount: 0,
        breweryCount: 0,
        cityCount: 0,
        createdAt: new Date().toISOString(),
        founderId: state.user.id,
        inviteCode: inviteCodeFor(trimmedName),
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
            backdropStoragePath: input.backdropStoragePath
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
      const quantity = Math.max(1, Math.min(24, Math.floor(input.quantity ?? 1)));
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
        note: input.note?.trim(),
        photoUri: input.photoUri,
        photoUrl: input.photoUrl,
        photoStoragePath: input.photoStoragePath,
        scannedBeerCount: input.scannedBeerCount,
        scanConfidence: input.scanConfidence,
        scanStatus: input.scanStatus,
        scanBoxes: input.scanBoxes,
        groupIds: input.groupIds,
        createdAt: new Date().toISOString(),
        reactions: 0,
        reactedBy: []
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
      syncRemote(createRemoteCheckIn(input, checkIn));

      return { checkIn, ...projectedUnlocks };
    },
    [persist, state.badges, state.challenges, state.checkIns, state.user]
  );

  const deleteCheckIn = useCallback(
    (checkInId: string) => {
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
      syncRemote(deleteRemoteCheckIn(checkInId));
    },
    [persist]
  );

  const reactToCheckIn = useCallback(
    (checkInId: string) => {
      setState((current) => {
        const target = current.checkIns.find((checkIn) => checkIn.id === checkInId);
        const wasReacted = target?.reactedBy.includes(current.user.id) ?? false;
        const nextCheckIns = current.checkIns.map((checkIn) => {
          if (checkIn.id !== checkInId) return checkIn;
          const alreadyReacted = checkIn.reactedBy.includes(current.user.id);
          return {
            ...checkIn,
            reactions: alreadyReacted ? Math.max(0, checkIn.reactions - 1) : checkIn.reactions + 1,
            reactedBy: alreadyReacted
              ? checkIn.reactedBy.filter((id) => id !== current.user.id)
              : [...checkIn.reactedBy, current.user.id]
          };
        });
        const next = { ...current, checkIns: nextCheckIns };
        void persist(next);
        syncRemote(toggleRemoteReaction(checkInId, current.user.id, wasReacted));
        return next;
      });
    },
    [persist]
  );

  const getGroupActivity = useCallback(
    (groupId: string) => state.checkIns.filter((checkIn) => checkIn.groupIds.includes(groupId)),
    [state.checkIns]
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
      const activity = state.checkIns.filter((checkIn) => checkIn.groupIds.includes(groupId));
      const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
      const monthAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
      const group = state.groups.find((item) => item.id === groupId);
      return {
        weeklyTotal: totalBeerQuantity(activity.filter((item) => new Date(item.createdAt).getTime() >= weekAgo)),
        monthlyTotal: totalBeerQuantity(activity.filter((item) => new Date(item.createdAt).getTime() >= monthAgo)),
        milestones: [
          { label: "First 10 beers", complete: (group?.beerCount ?? 0) >= 10 },
          { label: "First 100 beers", complete: (group?.beerCount ?? 0) >= 100 },
          { label: "10 feed posts", complete: activity.length >= 10 },
          { label: "Halfway to goal", complete: (group?.beerCount ?? 0) >= (group?.goal ?? 1) / 2 }
        ]
      };
    },
    [state.checkIns, state.groups]
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
      createGroup,
      updateGroupBackdrop,
      requestJoinGroup,
      approveJoinRequest,
      rejectJoinRequest,
      checkInBeer,
      deleteCheckIn,
      reactToCheckIn,
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
      createGroup,
      updateGroupBackdrop,
      requestJoinGroup,
      approveJoinRequest,
      rejectJoinRequest,
      checkInBeer,
      deleteCheckIn,
      reactToCheckIn,
      getGroupLeaderboard,
      getGroupStats,
      getGroupActivity,
      updateChallengeProgress,
      resetDemoData
    ]
  );

  return <PassportContext.Provider value={value}>{children}</PassportContext.Provider>;
}

export function usePassport() {
  const context = useContext(PassportContext);
  if (!context) {
    throw new Error("usePassport must be used within PassportProvider");
  }
  return context;
}
