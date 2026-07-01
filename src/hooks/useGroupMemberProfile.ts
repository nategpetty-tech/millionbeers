import { useEffect, useMemo, useState } from "react";
import { fetchRemoteGroupMemberProfile } from "@/services/pintlyData";
import { isRemoteDataConfigured } from "@/services/pintlyData";
import { buildCloudflareImageUrl } from "@/services/photoStorage";
import { usePassport } from "@/store/passportStore";
import { BeerCheckIn, GroupMemberProfile } from "@/types";

type GroupMemberProfileState = {
  data: GroupMemberProfile | null;
  loading: boolean;
  error: string | null;
  forbidden: boolean;
};

export function useGroupMemberProfile(groupId?: string, userId?: string): GroupMemberProfileState {
  const passport = usePassport();
  const localProfile = useMemo(() => {
    if (!groupId || !userId) return null;
    return buildLocalGroupMemberProfile({
      groupId,
      userId,
      currentUserId: passport.user.id,
      groups: passport.groups,
      checkIns: passport.checkIns,
      badgeCount: passport.badges.length || passport.user.badges.length,
      currentUserTopPercent: passport.globalUserRank?.topPercent
    });
  }, [groupId, passport.badges.length, passport.checkIns, passport.globalUserRank?.topPercent, passport.groups, passport.user.badges.length, passport.user.id, userId]);
  const [state, setState] = useState<GroupMemberProfileState>(() => ({
    data: localProfile,
    loading: Boolean(groupId && userId && isRemoteDataConfigured()),
    error: null,
    forbidden: Boolean(groupId && userId && !localProfile)
  }));

  useEffect(() => {
    let cancelled = false;
    if (!groupId || !userId) {
      setState({ data: null, loading: false, error: "Missing group or member.", forbidden: false });
      return;
    }

    if (!isRemoteDataConfigured()) {
      setState({ data: localProfile, loading: false, error: localProfile ? null : "This member profile is not available.", forbidden: !localProfile });
      return;
    }

    setState((current) => ({ ...current, data: current.data ?? localProfile, loading: true, error: null }));
    fetchRemoteGroupMemberProfile(groupId, userId)
      .then((remoteProfile) => {
        if (cancelled) return;
        const data = remoteProfile ? mergeLocalSharedContext(remoteProfile, localProfile, passport.user.id, passport.globalUserRank?.topPercent) : null;
        setState({
          data,
          loading: false,
          error: data ? null : "This member profile is locked or no longer available.",
          forbidden: !data
        });
      })
      .catch((error: { code?: string; message?: string }) => {
        if (cancelled) return;
        const canUseLocalFallback = isMissingRpcError(error) && Boolean(localProfile);
        setState({
          data: canUseLocalFallback ? localProfile : null,
          loading: false,
          error: canUseLocalFallback ? null : error.message ?? "This member profile could not be loaded.",
          forbidden: false
        });
      });

    return () => {
      cancelled = true;
    };
  }, [groupId, localProfile, passport.globalUserRank?.topPercent, passport.user.id, userId]);

  return state;
}

function buildLocalGroupMemberProfile({
  groupId,
  userId,
  currentUserId,
  groups,
  checkIns,
  badgeCount,
  currentUserTopPercent
}: {
  groupId: string;
  userId: string;
  currentUserId: string;
  groups: ReturnType<typeof usePassport>["groups"];
  checkIns: BeerCheckIn[];
  badgeCount: number;
  currentUserTopPercent?: number;
}): GroupMemberProfile | null {
  const group = groups.find((item) => item.id === groupId);
  if (!group) return null;
  const viewerCanAccess = group.privacy === "Public" || group.members.some((member) => member.userId === currentUserId);
  const member = group.members.find((item) => item.userId === userId);
  if (!viewerCanAccess || !member) return null;

  const userLogs = checkIns.filter((checkIn) => checkIn.userId === userId);
  const groupLogs = userLogs.filter((checkIn) => checkIn.groupIds.includes(groupId));
  const sharedGroups = groups
    .filter((item) => {
      const viewerCanSeeGroup = item.privacy === "Public" || item.members.some((member) => member.userId === currentUserId);
      const targetIsMember = item.members.some((member) => member.userId === userId);
      return viewerCanSeeGroup && targetIsMember;
    })
    .map((item) => ({
      id: item.id,
      name: item.name,
      beers: totalBeerQuantity(userLogs.filter((checkIn) => checkIn.groupIds.includes(item.id))),
      rank: rankForGroup(item.members, userId),
      isViewedGroup: item.id === groupId
    }))
    .sort((a, b) => Number(b.isViewedGroup) - Number(a.isViewedGroup) || b.beers - a.beers || a.name.localeCompare(b.name));
  const allTimeBeers = totalBeerQuantity(userLogs);
  const beersInThisGroup = totalBeerQuantity(groupLogs);
  const points = allTimeBeers * 25;
  const nextLevelXp = 500;
  const levelNumber = Math.floor(points / nextLevelXp) + 1;
  const groupRank = rankForGroup(group.members, userId);
  const globalRank = rankAcrossVisibleMembers(groups, userId);
  const percentile = userId === currentUserId && currentUserTopPercent ? currentUserTopPercent : globalRank.percentile;

  return {
    user: {
      id: userId,
      displayName: member.name || "Pintly User",
      avatar: member.avatar || initialsFor(member.name),
      avatarUrl: buildCloudflareImageUrl(member.avatarCloudflareImageId, "avatar") ?? member.avatarUrl,
      avatarCloudflareImageId: member.avatarCloudflareImageId
    },
    group: {
      id: group.id,
      name: group.name
    },
    level: {
      label: `Level ${levelNumber} Pintly Collector`,
      currentXp: points % nextLevelXp,
      nextLevelXp,
      points,
      percentile
    },
    stats: {
      allTimeBeers,
      beersInThisGroup,
      groupCount: sharedGroups.length,
      badgeCount: userId === currentUserId ? badgeCount : 0,
      groupRank
    },
    sharedGroups,
    recentActivity: groupLogs
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 3)
      .map((checkIn) => ({
        id: checkIn.id,
        type: "beer_log",
        title: "Logged a beer",
        subtitle: checkIn.beerName,
        imageUrl: buildCloudflareImageUrl(checkIn.photoCloudflareImageId, "thumbnail") ?? checkIn.photoThumbnailUrl ?? checkIn.photoUrl ?? checkIn.photoUri,
        createdAt: checkIn.createdAt
      }))
  };
}

function mergeLocalSharedContext(remoteProfile: GroupMemberProfile, localProfile: GroupMemberProfile | null, currentUserId: string, currentUserTopPercent?: number): GroupMemberProfile {
  const level =
    remoteProfile.user.id === currentUserId && currentUserTopPercent
      ? {
          ...remoteProfile.level,
          percentile: currentUserTopPercent
        }
      : remoteProfile.level;
  if (!localProfile?.sharedGroups?.length) return { ...remoteProfile, level };
  return {
    ...remoteProfile,
    level,
    stats: {
      ...remoteProfile.stats,
      groupCount: localProfile.sharedGroups.length
    },
    sharedGroups: localProfile.sharedGroups
  };
}

function totalBeerQuantity(checkIns: BeerCheckIn[]) {
  return checkIns.reduce((sum, checkIn) => sum + Math.max(1, Number.isFinite(checkIn.quantity) ? checkIn.quantity : 1), 0);
}

function rankForGroup(members: ReturnType<typeof usePassport>["groups"][number]["members"], userId: string) {
  const ranked = [...members].sort((a, b) => b.beerCount - a.beerCount || a.name.localeCompare(b.name));
  const index = ranked.findIndex((member) => member.userId === userId);
  return index >= 0 ? index + 1 : undefined;
}

function rankAcrossVisibleMembers(groups: ReturnType<typeof usePassport>["groups"], userId: string) {
  const membersById = new Map<string, number>();
  groups.forEach((group) => {
    group.members.forEach((member) => {
      membersById.set(member.userId, Math.max(membersById.get(member.userId) ?? 0, member.beerCount));
    });
  });
  const ranked = [...membersById.entries()].sort((a, b) => b[1] - a[1]);
  const index = ranked.findIndex(([id]) => id === userId);
  if (index < 0 || ranked.length <= 1) return { percentile: 1 };
  return { percentile: Math.max(1, Math.min(100, Math.ceil((index / (ranked.length - 1)) * 99 + 1))) };
}

function initialsFor(name: string) {
  const initials = name
    .trim()
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  return initials || "PU";
}

function isMissingRpcError(error: { code?: string; message?: string }) {
  return error.code === "42883" || Boolean(error.message?.toLowerCase().includes("get_group_member_profile"));
}
