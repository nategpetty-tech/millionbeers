import { BeerCheckIn, Group } from "@/types";

export function sortActivityNewestFirst<T extends Pick<BeerCheckIn, "createdAt">>(items: T[]) {
  return [...items].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export function memberGroupsForUser(groups: Group[], userId: string) {
  return groups.filter((group) => group.members.some((member) => member.userId === userId));
}

export function memberGroupIdSet(groups: Group[], userId: string) {
  return new Set(memberGroupsForUser(groups, userId).map((group) => group.id));
}

export function isVisibleActivity(checkIn: BeerCheckIn, currentUserId: string, blockedUserIds: string[]) {
  return checkIn.userId === currentUserId || !blockedUserIds.includes(checkIn.userId);
}

export function visibleActivity(checkIns: BeerCheckIn[], currentUserId: string, blockedUserIds: string[]) {
  return sortActivityNewestFirst(checkIns.filter((checkIn) => isVisibleActivity(checkIn, currentUserId, blockedUserIds)));
}

export function groupActivity(checkIns: BeerCheckIn[], groupId: string, currentUserId: string, blockedUserIds: string[]) {
  return visibleActivity(checkIns, currentUserId, blockedUserIds).filter((checkIn) => checkIn.groupIds.includes(groupId));
}

export function activityForMemberGroups(checkIns: BeerCheckIn[], groups: Group[], currentUserId: string, blockedUserIds: string[]) {
  const groupIds = memberGroupIdSet(groups, currentUserId);
  return visibleActivity(checkIns, currentUserId, blockedUserIds).filter((checkIn) => checkIn.groupIds.some((groupId) => groupIds.has(groupId)));
}

export function activityGroups(checkIn: BeerCheckIn, groups: Group[], allowedGroupIds?: Set<string>) {
  const groupById = new Map(groups.map((group) => [group.id, group]));
  return checkIn.groupIds
    .filter((groupId) => !allowedGroupIds || allowedGroupIds.has(groupId))
    .map((groupId) => groupById.get(groupId))
    .filter((group): group is Group => Boolean(group));
}
