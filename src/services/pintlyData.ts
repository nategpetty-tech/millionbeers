import { supabase } from "@/services/supabase";
import { buildCloudflareImageUrl, createSignedGroupBackdropUrl, createSignedPhotoUrl, createSignedProfilePhotoUrl } from "@/services/photoStorage";
import { friendsFeatureEnabled } from "@/config/features";
import {
  BeerCheckIn,
  BeerComment,
  CheckInInput,
  CreateGroupInput,
  FriendProfile,
  FriendRequest,
  GlobalUserRank,
  Group,
  GroupMemberProfile,
  GroupJoinRequest,
  GroupMember,
  ModerationReport,
  ModerationReportReason,
  ModerationReportStatus,
  UpdateCheckInInput,
  UpdateCheckInPhotoInput,
  UpdateCheckInScanInput,
  UpdateGroupBackdropInput,
  User,
  UserSearchResult
} from "@/types";

type ProfileRow = {
  id: string;
  display_name: string;
  username: string | null;
  avatar: string;
  avatar_url: string | null;
  avatar_storage_path: string | null;
  avatar_cloudflare_image_id: string | null;
  avatar_image_width: number | null;
  avatar_image_height: number | null;
  avatar_blurhash: string | null;
};

type GroupRow = {
  id: string;
  name: string;
  description: string | null;
  image: string;
  backdrop_url: string | null;
  backdrop_storage_path: string | null;
  backdrop_cloudflare_image_id: string | null;
  backdrop_image_width: number | null;
  backdrop_image_height: number | null;
  backdrop_blurhash: string | null;
  privacy: Group["privacy"];
  goal: number;
  founder_id: string;
  invite_code: string;
  created_at: string;
  member_count?: number;
};

type MembershipRow = {
  group_id: string;
  user_id: string;
  notifications_enabled?: boolean | null;
  profiles?: ProfileRow | ProfileRow[] | null;
};

type JoinRequestRow = {
  id: string;
  group_id: string;
  user_id: string;
  source: GroupJoinRequest["source"];
  status: GroupJoinRequest["status"];
  requested_at: string;
  profiles?: ProfileRow | ProfileRow[] | null;
};

type FriendRow = {
  friend_id: string;
  profiles?: ProfileRow | ProfileRow[] | null;
};

type FriendRequestRow = {
  id: string;
  requester_id: string;
  addressee_id: string;
  status: FriendRequest["status"];
  created_at: string;
  requester?: ProfileRow | ProfileRow[] | null;
  addressee?: ProfileRow | ProfileRow[] | null;
};

type UserSearchRow = {
  user_id: string;
  display_name: string;
  avatar: string;
  avatar_url: string | null;
  avatar_cloudflare_image_id?: string | null;
  relationship: UserSearchResult["relationship"];
};

type CheckInGroupRow = {
  group_id: string;
};

type ReactionRow = {
  user_id: string;
  profiles?: ProfileRow | ProfileRow[] | null;
};

type CommentRow = {
  id: string;
  check_in_id: string;
  user_id: string;
  body: string;
  created_at: string;
  profiles?: ProfileRow | ProfileRow[] | null;
};

type BlockRow = {
  blocked_id: string;
  created_at: string;
};

type ModerationReportRow = {
  id: string;
  reporter_id: string;
  reported_user_id: string;
  check_in_id: string | null;
  group_id: string | null;
  reason: ModerationReportReason;
  details: string | null;
  status: ModerationReportStatus;
  created_at: string;
  reporter?: ProfileRow | ProfileRow[] | null;
  reported_user?: ProfileRow | ProfileRow[] | null;
};

type CheckInRow = {
  id: string;
  user_id: string;
  beer_name: string;
  brewery: string;
  style: BeerCheckIn["style"];
  quantity: number;
  abv: number | null;
  rating: number | null;
  city: string;
  state: string | null;
  country: string | null;
  latitude: number | null;
  longitude: number | null;
  venue_id: string | null;
  venue_provider: BeerCheckIn["venueProvider"] | null;
  venue_provider_place_id: string | null;
  venue_name: string | null;
  venue_category: string | null;
  venue_latitude: number | null;
  venue_longitude: number | null;
  venue_address: string | null;
  venue_distance_meters: number | null;
  venue_confirmed?: boolean | null;
  venue_confirmation_status: BeerCheckIn["venueConfirmationStatus"] | null;
  venue_selection_status?: BeerCheckIn["venueSelectionStatus"] | null;
  note: string | null;
  photo_url: string | null;
  photo_storage_path: string | null;
  photo_thumbnail_url: string | null;
  photo_thumbnail_storage_path: string | null;
  photo_cloudflare_image_id: string | null;
  photo_image_width: number | null;
  photo_image_height: number | null;
  photo_blurhash: string | null;
  scanned_beer_count: number | null;
  scan_confidence: number | null;
  scan_status: BeerCheckIn["scanStatus"] | null;
  scan_boxes: BeerCheckIn["scanBoxes"] | null;
  count_source: BeerCheckIn["countSource"] | null;
  created_at: string;
  profiles?: ProfileRow | ProfileRow[] | null;
  check_in_groups?: CheckInGroupRow[];
  check_in_reactions?: ReactionRow[];
  check_in_comments?: CommentRow[];
};

export type RemoteSnapshot = {
  user: User;
  groups: Group[];
  checkIns: BeerCheckIn[];
  friends: FriendProfile[];
  friendRequests: FriendRequest[];
  blockedUserIds: string[];
  globalCount: number;
  globalUserRank?: GlobalUserRank;
};

const profileColumns = "id,display_name,username,avatar,avatar_url,avatar_storage_path,avatar_cloudflare_image_id,avatar_image_width,avatar_image_height,avatar_blurhash";

export function isRemoteDataConfigured() {
  return Boolean(supabase);
}

export async function fetchRemoteGlobalCount(): Promise<number | null> {
  if (!supabase) return null;
  const { data, error } = await supabase.rpc("get_global_beer_count");
  if (error) return null;
  return Number(data ?? 0);
}

export async function fetchRemoteGlobalUserRank(): Promise<GlobalUserRank | null> {
  if (!supabase) return null;
  const { data, error } = await supabase.rpc("get_current_user_global_rank");
  if (error) return null;
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return null;
  return {
    userId: row.user_id,
    totalBeers: Number(row.total_beers ?? 0),
    checkInCount: Number(row.check_in_count ?? 0),
    rank: Number(row.rank ?? 1),
    totalUsers: Number(row.total_users ?? 1),
    topPercent: Number(row.top_percent ?? 1)
  };
}

export async function fetchRemoteBlockedUserIds(): Promise<string[]> {
  if (!supabase) return [];
  const { data, error } = await supabase.from("user_blocks").select("blocked_id");
  if (error) return [];
  return ((data ?? []) as BlockRow[]).map((row) => row.blocked_id);
}

export async function claimRemoteUsername(username: string): Promise<string> {
  if (!supabase) throw new Error("Supabase is not configured.");
  const { data, error } = await supabase.rpc("claim_username", {
    username_input: username
  });
  if (error) throw error;
  if (typeof data !== "string" || !data) throw new Error("Could not claim username.");
  return data;
}

export async function fetchRemoteGroupMemberProfile(groupId: string, userId: string): Promise<GroupMemberProfile | null> {
  if (!supabase) return null;
  const { data, error } = await supabase.rpc("get_group_member_profile", {
    group_id_input: groupId,
    target_user_id_input: userId
  });
  if (error) throw error;
  if (!data) return null;
  const row = data as {
    user?: {
      id?: string;
      displayName?: string;
      display_name?: string;
      username?: string | null;
      avatar?: string;
      avatarUrl?: string | null;
      avatar_url?: string | null;
      avatarCloudflareImageId?: string | null;
      avatar_cloudflare_image_id?: string | null;
      createdAt?: string | null;
      created_at?: string | null;
    };
    group?: { id?: string; name?: string };
    level?: {
      label?: string;
      currentXp?: number;
      current_xp?: number;
      nextLevelXp?: number;
      next_level_xp?: number;
      points?: number;
      percentile?: number | null;
    };
    stats?: {
      allTimeBeers?: number;
      all_time_beers?: number;
      beersInThisGroup?: number;
      beers_in_this_group?: number;
      groupCount?: number;
      group_count?: number;
      badgeCount?: number;
      badge_count?: number;
      groupRank?: number | null;
      group_rank?: number | null;
    };
    recentActivity?: GroupMemberProfile["recentActivity"];
    recent_activity?: GroupMemberProfile["recentActivity"];
  };
  const displayName = row.user?.displayName ?? row.user?.display_name ?? "Pintly User";
  const avatarCloudflareImageId = row.user?.avatarCloudflareImageId ?? row.user?.avatar_cloudflare_image_id ?? undefined;
  return {
    user: {
      id: row.user?.id ?? userId,
      displayName,
      username: row.user?.username ?? undefined,
      avatar: row.user?.avatar ?? initialsFor(displayName),
      avatarUrl: buildCloudflareImageUrl(avatarCloudflareImageId, "avatar") ?? row.user?.avatarUrl ?? row.user?.avatar_url ?? undefined,
      avatarCloudflareImageId,
      createdAt: row.user?.createdAt ?? row.user?.created_at ?? undefined
    },
    group: {
      id: row.group?.id ?? groupId,
      name: row.group?.name ?? "this group"
    },
    level: {
      label: row.level?.label ?? "Level 1 Pintly Collector",
      currentXp: Number(row.level?.currentXp ?? row.level?.current_xp ?? 0),
      nextLevelXp: Number(row.level?.nextLevelXp ?? row.level?.next_level_xp ?? 500),
      points: Number(row.level?.points ?? 0),
      percentile: row.level?.percentile ?? undefined
    },
    stats: {
      allTimeBeers: Number(row.stats?.allTimeBeers ?? row.stats?.all_time_beers ?? 0),
      beersInThisGroup: Number(row.stats?.beersInThisGroup ?? row.stats?.beers_in_this_group ?? 0),
      groupCount: Number(row.stats?.groupCount ?? row.stats?.group_count ?? 0),
      badgeCount: Number(row.stats?.badgeCount ?? row.stats?.badge_count ?? 0),
      groupRank: row.stats?.groupRank ?? row.stats?.group_rank ?? undefined
    },
    recentActivity: row.recentActivity ?? row.recent_activity ?? []
  };
}

export async function upsertProfile(user: User) {
  if (!supabase) return;
  if (!user.name.trim()) return;
  await supabase.from("profiles").upsert({
    id: user.id,
    display_name: user.name || "Pintly User",
    avatar: user.avatar,
    avatar_url: user.avatarUrl ?? null,
    avatar_storage_path: user.avatarStoragePath ?? null,
    avatar_cloudflare_image_id: user.avatarCloudflareImageId ?? null,
    avatar_image_width: user.avatarImageWidth ?? null,
    avatar_image_height: user.avatarImageHeight ?? null,
    avatar_blurhash: user.avatarBlurhash ?? null
  });
}

export async function fetchRemoteSnapshot(currentUser: User): Promise<RemoteSnapshot | null> {
  if (!supabase) return null;

  try {
    const remoteUser = await fetchRemoteUserProfile(currentUser);
    await upsertProfile(remoteUser);

    const [
      { data: groupRows, error: groupError },
      { data: membershipRows, error: membershipError },
      { data: requestRows, error: requestError },
      { data: friendRows, error: friendError },
      { data: friendRequestRows, error: friendRequestError },
      { data: globalCount },
      globalUserRank,
      blockedUserIds
    ] = await Promise.all([
      supabase.from("groups").select("*").order("created_at", { ascending: false }),
      fetchRemoteMembershipRows(),
      supabase
        .from("group_join_requests")
        .select(
          `id,group_id,user_id,source,status,requested_at,profiles!group_join_requests_user_id_fkey(${profileColumns})`
        ),
      friendsFeatureEnabled
        ? supabase.from("friendships").select(`friend_id,profiles!friendships_friend_id_fkey(${profileColumns})`)
        : Promise.resolve({ data: [], error: null }),
      friendsFeatureEnabled
        ? supabase
            .from("friend_requests")
            .select(
              `id,requester_id,addressee_id,status,created_at,requester:profiles!friend_requests_requester_id_fkey(${profileColumns}),addressee:profiles!friend_requests_addressee_id_fkey(${profileColumns})`
            )
            .eq("status", "pending")
        : Promise.resolve({ data: [], error: null }),
      supabase.rpc("get_global_beer_count"),
      fetchRemoteGlobalUserRank(),
      fetchRemoteBlockedUserIds()
    ]);

    if (groupError) console.warn("Could not load remote groups", groupError.message);
    if (membershipError) console.warn("Could not load remote memberships", membershipError.message);
    if (requestError) console.warn("Could not load remote group requests", requestError.message);
    if (friendError) console.warn("Could not load remote friends", friendError.message);
    if (friendRequestError) console.warn("Could not load remote friend requests", friendRequestError.message);

    const ownMembershipResult = await fetchOwnRemoteMembershipRows(currentUser.id);
    const typedMemberships = mergeMembershipRows(
      membershipError ? [] : ((membershipRows ?? []) as MembershipRow[]),
      ownMembershipResult.error ? [] : ((ownMembershipResult.data ?? []) as MembershipRow[])
    );
    const typedRequests = requestError ? [] : ((requestRows ?? []) as JoinRequestRow[]);
    const typedFriends = friendError ? [] : ((friendRows ?? []) as FriendRow[]);
    const typedFriendRequests = friendRequestError ? [] : ((friendRequestRows ?? []) as FriendRequestRow[]);
    const accessibleGroupIds = new Set(typedMemberships.map((row) => row.group_id));
    let { data: checkInRows, error: checkInError } = await fetchRemoteCheckInRows();
    const ownCheckInResult = await fetchOwnRemoteCheckInRows(currentUser.id);

    if (checkInError) {
      console.warn("Could not load remote check-ins", checkInError.message);
      checkInRows = ownCheckInResult.data;
      checkInError = ownCheckInResult.error;
    }

    if (checkInError || ownCheckInResult.error) {
      console.warn("Could not load own remote check-ins", (checkInError ?? ownCheckInResult.error)?.message);
    }

    const mappedCheckIns = await Promise.all(mergeCheckInRows((checkInRows ?? []) as CheckInRow[], (ownCheckInResult.data ?? []) as CheckInRow[]).map(mapCheckInRow));
    const publishableCheckIns = mappedCheckIns.filter((checkIn) => checkIn.userId === currentUser.id || hasRemotePhoto(checkIn));
    const checkIns = friendsFeatureEnabled
      ? publishableCheckIns
      : publishableCheckIns.filter((checkIn) => checkIn.userId === currentUser.id || checkIn.groupIds.some((groupId) => accessibleGroupIds.has(groupId)));
    const resolvedGroupRows =
      groupError || !((groupRows ?? []) as GroupRow[]).some((group) => accessibleGroupIds.has(group.id))
        ? await fetchOwnRemoteGroupRows([...accessibleGroupIds])
        : { data: groupRows, error: null };
    if (resolvedGroupRows.error) console.warn("Could not load own remote groups", resolvedGroupRows.error.message);
    const visibleCheckIns = checkIns.filter((checkIn) => checkIn.userId === currentUser.id || !blockedUserIds.includes(checkIn.userId));
    const groups = await Promise.all(
      ((resolvedGroupRows.data ?? []) as GroupRow[]).map((group) =>
        mapGroupRow(
        group,
        typedMemberships,
        typedRequests,
        checkIns.filter((checkIn) => checkIn.groupIds.includes(group.id)),
        currentUser.id,
        accessibleGroupIds.has(group.id)
      )
      )
    );

    return {
      user: remoteUser,
      groups,
      checkIns: visibleCheckIns,
      friends: await Promise.all(typedFriends.map(mapFriendRow)),
      friendRequests: await Promise.all(typedFriendRequests.map((row) => mapFriendRequestRow(row, currentUser.id))),
      blockedUserIds,
      globalCount: Number(globalCount ?? checkIns.reduce((sum, item) => sum + item.quantity, 0)),
      globalUserRank: globalUserRank ?? undefined
    };
  } catch {
    console.warn("Could not load remote snapshot");
    return null;
  }
}

async function fetchOwnRemoteMembershipRows(userId: string) {
  if (!supabase) return { data: [], error: null };
  const richResult = await supabase
    .from("group_memberships")
    .select(`group_id,user_id,notifications_enabled,profiles!group_memberships_user_id_fkey(${profileColumns})`)
    .eq("user_id", userId);
  if (!richResult.error) return richResult;
  console.warn("Falling back while loading own memberships", richResult.error.message);
  return supabase
    .from("group_memberships")
    .select(`group_id,user_id,profiles!group_memberships_user_id_fkey(${profileColumns})`)
    .eq("user_id", userId);
}

async function fetchRemoteMembershipRows() {
  if (!supabase) return { data: [], error: null };
  const richResult = await supabase
    .from("group_memberships")
    .select(`group_id,user_id,notifications_enabled,profiles!group_memberships_user_id_fkey(${profileColumns})`);
  if (!richResult.error) return richResult;
  console.warn("Falling back while loading memberships", richResult.error.message);
  return supabase
    .from("group_memberships")
    .select(`group_id,user_id,profiles!group_memberships_user_id_fkey(${profileColumns})`);
}

async function fetchOwnRemoteGroupRows(groupIds: string[]) {
  if (!supabase || !groupIds.length) return { data: [], error: null };
  return supabase.from("groups").select("*").in("id", groupIds).order("created_at", { ascending: false });
}

async function fetchRemoteCheckInRows() {
  if (!supabase) return { data: [], error: null };
  const richResult = await supabase
    .from("check_ins")
    .select(
      `*,profiles!check_ins_user_id_fkey(${profileColumns}),check_in_groups(group_id),check_in_reactions(user_id,profiles!check_in_reactions_user_id_fkey(${profileColumns})),check_in_comments(id,check_in_id,user_id,body,created_at,profiles!check_in_comments_user_id_fkey(${profileColumns}))`
    )
    .order("created_at", { ascending: false });

  if (!richResult.error) return richResult;

  console.warn("Falling back to reaction ids while loading check-ins", richResult.error.message);
  return supabase
    .from("check_ins")
    .select(`*,profiles!check_ins_user_id_fkey(${profileColumns}),check_in_groups(group_id),check_in_reactions(user_id)`)
    .order("created_at", { ascending: false });
}

function mergeMembershipRows(primary: MembershipRow[], fallback: MembershipRow[]) {
  const rowsByKey = new Map<string, MembershipRow>();
  [...primary, ...fallback].forEach((row) => rowsByKey.set(`${row.group_id}:${row.user_id}`, row));
  return [...rowsByKey.values()];
}

function mergeCheckInRows(primary: CheckInRow[], fallback: CheckInRow[]) {
  const rowsById = new Map<string, CheckInRow>();
  [...primary, ...fallback].forEach((row) => {
    const existing = rowsById.get(row.id);
    if (!existing) {
      rowsById.set(row.id, row);
      return;
    }
    rowsById.set(row.id, {
      ...existing,
      ...row,
      profiles: row.profiles ?? existing.profiles,
      check_in_groups: row.check_in_groups?.length ? row.check_in_groups : existing.check_in_groups,
      check_in_reactions: row.check_in_reactions ?? existing.check_in_reactions,
      check_in_comments: row.check_in_comments ?? existing.check_in_comments
    });
  });
  return [...rowsById.values()].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
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

async function fetchOwnRemoteCheckInRows(userId: string) {
  if (!supabase) return { data: [], error: null };
  const richResult = await supabase
    .from("check_ins")
    .select(
      `*,profiles!check_ins_user_id_fkey(${profileColumns}),check_in_groups(group_id),check_in_reactions(user_id,profiles!check_in_reactions_user_id_fkey(${profileColumns})),check_in_comments(id,check_in_id,user_id,body,created_at,profiles!check_in_comments_user_id_fkey(${profileColumns}))`
    )
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (!richResult.error) return richResult;
  return supabase
    .from("check_ins")
    .select(`*,profiles!check_ins_user_id_fkey(${profileColumns}),check_in_groups(group_id),check_in_reactions(user_id)`)
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
}

async function fetchRemoteUserProfile(currentUser: User): Promise<User> {
  if (!supabase) return currentUser;
  const { data, error } = await supabase
    .from("profiles")
    .select(profileColumns)
    .eq("id", currentUser.id)
    .maybeSingle();
  if (error || !data) return currentUser;
  const profile = data as ProfileRow;
  const name = profile.display_name || currentUser.name;
  const avatarUrl = await resolveProfileAvatarUrl(profile);
  return {
    ...currentUser,
    name,
    username: profile.username ?? currentUser.username,
    avatar: profile.avatar || initialsFor(name),
    avatarUrl,
    avatarStoragePath: profile.avatar_storage_path ?? currentUser.avatarStoragePath,
    avatarCloudflareImageId: profile.avatar_cloudflare_image_id ?? currentUser.avatarCloudflareImageId,
    avatarImageWidth: profile.avatar_image_width ?? currentUser.avatarImageWidth,
    avatarImageHeight: profile.avatar_image_height ?? currentUser.avatarImageHeight,
    avatarBlurhash: profile.avatar_blurhash ?? currentUser.avatarBlurhash,
    hasOnboarded: Boolean(name.trim()) || currentUser.hasOnboarded
  };
}

export async function findRemoteGroupByInviteCode(inviteCode: string, currentUser: User): Promise<Group | null> {
  if (!supabase) return null;

  try {
    await upsertProfile(currentUser);
    const { data, error } = await supabase.rpc("find_group_by_invite_code", {
      invite_code_input: inviteCode.trim().toUpperCase()
    });
    if (error) return null;
    const row = Array.isArray(data) ? data[0] : data;
    if (!row) return null;
    return mapGroupRow(row as GroupRow, [], [], [], currentUser.id, false);
  } catch {
    return null;
  }
}

export async function createRemoteGroup(input: CreateGroupInput, localGroup: Group) {
  if (!supabase) return;
  const { error } = await supabase.from("groups").insert({
    id: localGroup.id,
    name: localGroup.name,
    description: input.description?.trim() || null,
    image: localGroup.image,
    backdrop_url: localGroup.backdropUrl ?? null,
    backdrop_storage_path: localGroup.backdropStoragePath ?? null,
    backdrop_cloudflare_image_id: localGroup.backdropCloudflareImageId ?? null,
    backdrop_image_width: localGroup.backdropImageWidth ?? null,
    backdrop_image_height: localGroup.backdropImageHeight ?? null,
    backdrop_blurhash: localGroup.backdropBlurhash ?? null,
    privacy: input.privacy,
    goal: localGroup.goal,
    founder_id: localGroup.founderId,
    invite_code: localGroup.inviteCode
  });
  if (error) throw error;

  const { error: membershipError } = await supabase.from("group_memberships").insert({
    group_id: localGroup.id,
    user_id: localGroup.founderId,
    role: "founder"
  });
  if (membershipError) throw membershipError;
}

export async function updateRemoteGroupBackdrop(groupId: string, input: UpdateGroupBackdropInput) {
  if (!supabase) return;
  const { error } = await supabase
    .from("groups")
    .update({
      backdrop_url: input.backdropUrl ?? null,
      backdrop_storage_path: input.backdropStoragePath ?? null,
      backdrop_cloudflare_image_id: input.backdropCloudflareImageId ?? null,
      backdrop_image_width: input.backdropImageWidth ?? null,
      backdrop_image_height: input.backdropImageHeight ?? null,
      backdrop_blurhash: input.backdropBlurhash ?? null
    })
    .eq("id", groupId);
  if (error) throw error;
}

export async function updateRemoteGroupNotifications(groupId: string, enabled: boolean) {
  if (!supabase) return;
  const { error } = await supabase
    .from("group_memberships")
    .update({ notifications_enabled: enabled })
    .eq("group_id", groupId);
  if (error) throw error;
}

export async function requestRemoteGroupJoin(groupId: string, user: User, source: GroupJoinRequest["source"]) {
  if (!supabase) return;
  await upsertProfile(user);
  const { error } = await supabase.from("group_join_requests").upsert(
    {
      group_id: groupId,
      user_id: user.id,
      source,
      status: "pending"
    },
    { onConflict: "group_id,user_id" }
  );
  if (error) throw error;
}

export async function blockRemoteUser(blockedUserId: string, blockerId: string) {
  if (!supabase || blockedUserId === blockerId) return;
  const { error } = await supabase
    .from("user_blocks")
    .upsert({ blocker_id: blockerId, blocked_id: blockedUserId }, { onConflict: "blocker_id,blocked_id", ignoreDuplicates: true });
  if (error) throw error;
}

export async function unblockRemoteUser(blockedUserId: string, blockerId: string) {
  if (!supabase) return;
  const { error } = await supabase.from("user_blocks").delete().eq("blocker_id", blockerId).eq("blocked_id", blockedUserId);
  if (error) throw error;
}

export async function reportRemoteUser(input: {
  reporterId: string;
  reportedUserId: string;
  checkInId?: string;
  groupId?: string;
  reason: ModerationReportReason;
  details?: string;
}) {
  if (!supabase || input.reporterId === input.reportedUserId) return;
  const { error } = await supabase.from("user_reports").insert({
    reporter_id: input.reporterId,
    reported_user_id: input.reportedUserId,
    check_in_id: input.checkInId ?? null,
    group_id: input.groupId ?? null,
    reason: input.reason,
    details: input.details?.trim() || null
  });
  if (error) throw error;
}

export async function deleteRemoteAccount() {
  if (!supabase) throw new Error("Supabase is not configured.");
  const { error } = await supabase.functions.invoke("delete-account", { body: {} });
  if (error) throw error;
}

export async function fetchRemoteAdminReports(): Promise<ModerationReport[]> {
  if (!supabase) return [];
  const { data: isAdmin } = await supabase.rpc("current_user_is_admin");
  if (!isAdmin) return [];
  const { data, error } = await supabase
    .from("user_reports")
    .select(`id,reporter_id,reported_user_id,check_in_id,group_id,reason,details,status,created_at,reporter:profiles!user_reports_reporter_id_fkey(${profileColumns}),reported_user:profiles!user_reports_reported_user_id_fkey(${profileColumns})`)
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw error;
  return ((data ?? []) as ModerationReportRow[]).map(mapModerationReportRow);
}

export async function updateRemoteReportStatus(reportId: string, status: ModerationReportStatus) {
  if (!supabase) return;
  const { data: isAdmin } = await supabase.rpc("current_user_is_admin");
  if (!isAdmin) throw new Error("Admin access required.");
  const { error } = await supabase.from("user_reports").update({ status, reviewed_at: new Date().toISOString() }).eq("id", reportId);
  if (error) throw error;
}

export async function searchRemoteUsers(query: string): Promise<UserSearchResult[]> {
  if (!supabase || !friendsFeatureEnabled) return [];
  const trimmed = query.trim();
  if (trimmed.length < 2) return [];
  const { data, error } = await supabase.rpc("search_profiles_for_friends", {
    search_input: trimmed
  });
  if (error) throw error;
  return Promise.all(
    ((data ?? []) as UserSearchRow[]).map(async (row) => ({
      userId: row.user_id,
      name: row.display_name || "Pintly User",
      avatar: row.avatar || initialsFor(row.display_name || "Pintly User"),
      avatarUrl: buildCloudflareImageUrl(row.avatar_cloudflare_image_id ?? undefined, "avatar") ?? row.avatar_url ?? undefined,
      avatarCloudflareImageId: row.avatar_cloudflare_image_id ?? undefined,
      relationship: row.relationship
    }))
  );
}

export async function requestRemoteFriend(user: User, addresseeId: string) {
  if (!supabase || !friendsFeatureEnabled) return;
  await upsertProfile(user);
  const { error } = await supabase.from("friend_requests").upsert(
    {
      requester_id: user.id,
      addressee_id: addresseeId,
      status: "pending"
    },
    { onConflict: "requester_id,addressee_id" }
  );
  if (error) throw error;
}

export async function approveRemoteFriendRequest(requestId: string) {
  if (!supabase || !friendsFeatureEnabled) return;
  const { error } = await supabase.rpc("approve_friend_request", { request_id: requestId });
  if (error) throw error;
}

export async function rejectRemoteFriendRequest(requestId: string) {
  if (!supabase || !friendsFeatureEnabled) return;
  const { error } = await supabase.from("friend_requests").update({ status: "rejected" }).eq("id", requestId);
  if (error) throw error;
}

export async function approveRemoteJoinRequest(requestId: string) {
  if (!supabase) return;
  const { error } = await supabase.rpc("approve_join_request", { request_id: requestId });
  if (error) throw error;
}

export async function rejectRemoteJoinRequest(requestId: string) {
  if (!supabase) return;
  const { error } = await supabase.from("group_join_requests").update({ status: "rejected" }).eq("id", requestId);
  if (error) throw error;
}

export async function cancelRemoteJoinRequest(requestId: string) {
  if (!supabase) return;
  const { error } = await supabase
    .from("group_join_requests")
    .update({ status: "rejected" })
    .eq("id", requestId)
    .eq("status", "pending");
  if (error) throw error;
}

export async function createRemoteCheckIn(input: CheckInInput, localCheckIn: BeerCheckIn) {
  return createRemoteCheckInFromLocal(localCheckIn, input.groupIds);
}

export async function createRemoteCheckInFromLocal(localCheckIn: BeerCheckIn, groupIds = localCheckIn.groupIds) {
  if (!supabase) return;
  const {
    data: { user: authUser },
    error: authError
  } = await supabase.auth.getUser();
  if (authError || !authUser) throw authError ?? new Error("Sign in before syncing a stamp.");
  const remoteUserId = authUser.id;
  const { error: profileError } = await supabase.from("profiles").upsert({
    id: remoteUserId,
    display_name: localCheckIn.userName || "Pintly User",
    avatar: localCheckIn.userAvatar || initialsFor(localCheckIn.userName || "Pintly User"),
    avatar_url: localCheckIn.userAvatarUrl ?? null
  });
  if (profileError) throw new Error(`Profile sync failed: ${profileError.message}`);
  let venueId: string | null = localCheckIn.venueId ?? null;
  const venueSelectionStatus = localCheckIn.venueSelectionStatus ?? (localCheckIn.venueConfirmationStatus === "confirmed" ? "confirmed" : localCheckIn.venueConfirmationStatus ?? "skipped");
  const venueConfirmed = localCheckIn.venueConfirmed ?? (venueSelectionStatus === "confirmed" || venueSelectionStatus === "changed");
  const legacyVenueConfirmationStatus = venueConfirmed ? "confirmed" : venueSelectionStatus === "unavailable" ? "unavailable" : "skipped";

  if (venueConfirmed && localCheckIn.venueProvider && localCheckIn.venueProviderPlaceId && localCheckIn.venueName) {
    const { data: venue, error: venueError } = await supabase
      .from("venues")
      .upsert(
        {
          provider: localCheckIn.venueProvider,
          provider_place_id: localCheckIn.venueProviderPlaceId,
          name: localCheckIn.venueName,
          category: localCheckIn.venueCategory ?? null,
          latitude: localCheckIn.venueLatitude ?? localCheckIn.location.latitude ?? null,
          longitude: localCheckIn.venueLongitude ?? localCheckIn.location.longitude ?? null,
          address: localCheckIn.venueAddress ?? null,
          updated_at: new Date().toISOString()
        },
        { onConflict: "provider,provider_place_id" }
      )
      .select("id")
      .maybeSingle();
    if (venueError) throw new Error(`Venue sync failed: ${venueError.message}`);
    venueId = venue?.id ?? venueId;
  }
  const checkInPayload = {
    id: localCheckIn.id,
    user_id: remoteUserId,
    beer_name: localCheckIn.beerName,
    brewery: localCheckIn.brewery,
    style: localCheckIn.style,
    quantity: 1,
    abv: localCheckIn.abv ?? null,
    rating: localCheckIn.rating ?? null,
    city: localCheckIn.location.city,
    state: localCheckIn.location.state ?? null,
    country: localCheckIn.location.country ?? null,
    latitude: localCheckIn.location.latitude ?? null,
    longitude: localCheckIn.location.longitude ?? null,
    venue_id: venueId,
    venue_provider: venueConfirmed ? localCheckIn.venueProvider ?? null : venueSelectionStatus,
    venue_provider_place_id: venueConfirmed ? localCheckIn.venueProviderPlaceId ?? null : null,
    venue_name: venueConfirmed ? localCheckIn.venueName ?? null : null,
    venue_category: venueConfirmed ? localCheckIn.venueCategory ?? null : null,
    venue_latitude: venueConfirmed ? localCheckIn.venueLatitude ?? null : null,
    venue_longitude: venueConfirmed ? localCheckIn.venueLongitude ?? null : null,
    venue_address: venueConfirmed ? localCheckIn.venueAddress ?? null : null,
    venue_distance_meters: venueConfirmed ? localCheckIn.venueDistanceMeters ?? null : null,
    venue_confirmed: venueConfirmed,
    venue_confirmation_status: legacyVenueConfirmationStatus,
    venue_selection_status: venueSelectionStatus,
    note: localCheckIn.note ?? null,
    photo_url: localCheckIn.photoUrl ?? null,
    photo_storage_path: localCheckIn.photoStoragePath ?? null,
    photo_thumbnail_url: localCheckIn.photoThumbnailUrl ?? null,
    photo_thumbnail_storage_path: localCheckIn.photoThumbnailStoragePath ?? null,
    photo_cloudflare_image_id: localCheckIn.photoCloudflareImageId ?? null,
    photo_image_width: localCheckIn.photoImageWidth ?? null,
    photo_image_height: localCheckIn.photoImageHeight ?? null,
    photo_blurhash: localCheckIn.photoBlurhash ?? null,
    scanned_beer_count: localCheckIn.scannedBeerCount ?? null,
    scan_confidence: localCheckIn.scanConfidence ?? null,
    scan_status: localCheckIn.scanStatus ?? null,
    scan_boxes: localCheckIn.scanBoxes ?? null,
    count_source: localCheckIn.countSource ?? "manual",
    created_at: localCheckIn.createdAt
  };
  const { error } = await supabase.from("check_ins").insert(checkInPayload);
  const insertedCheckIn = !error;
  if (error) {
    if (error.code !== "23505") throw new Error(`Stamp insert failed: ${error.message}`);

    const { error: updateError } = await supabase.from("check_ins").update(checkInPayload).eq("id", localCheckIn.id);
    if (updateError) throw new Error(`Stamp repair failed: ${updateError.message}`);
  }

  if (groupIds.length) {
    const { error: groupLinkError } = await supabase
      .from("check_in_groups")
      .upsert(groupIds.map((groupId) => ({ check_in_id: localCheckIn.id, group_id: groupId })), { onConflict: "check_in_id,group_id" });
    if (groupLinkError) {
      if (insertedCheckIn) {
        await supabase.from("check_ins").delete().eq("id", localCheckIn.id);
      }
      throw new Error(`Group link failed: ${groupLinkError.message}`);
    }
  }

  if (insertedCheckIn && groupIds.length) {
    void supabase.functions.invoke("send-check-in-notifications", {
      body: { checkInId: localCheckIn.id }
    }).catch((notifyError) => {
      console.warn("Could not send check-in notifications", notifyError);
    });
  }
}

export async function updateRemoteCheckIn(checkInId: string, input: UpdateCheckInInput) {
  if (!supabase) return;
  const { error } = await supabase
    .from("check_ins")
    .update({
      quantity: 1,
      note: input.note?.trim() || null,
      count_source: "manual"
    })
    .eq("id", checkInId);
  if (error) throw error;
}

export async function updateRemoteCheckInScan(checkInId: string, input: UpdateCheckInScanInput) {
  if (!supabase) return;
  const { error } = await supabase
    .from("check_ins")
    .update({
      scanned_beer_count: input.scannedBeerCount ?? null,
      scan_confidence: input.scanConfidence ?? null,
      scan_status: input.scanStatus ?? null,
      scan_boxes: input.scanBoxes ?? null
    })
    .eq("id", checkInId);
  if (error) throw error;
}

export async function updateRemoteCheckInPhoto(checkInId: string, input: UpdateCheckInPhotoInput) {
  if (!supabase) return;
  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const { error } = await supabase
      .from("check_ins")
      .update({
        photo_url: input.photoUrl ?? null,
        photo_storage_path: input.photoStoragePath ?? null,
        photo_thumbnail_url: input.photoThumbnailUrl ?? null,
        photo_thumbnail_storage_path: input.photoThumbnailStoragePath ?? null,
        photo_cloudflare_image_id: input.photoCloudflareImageId ?? null,
        photo_image_width: input.photoImageWidth ?? null,
        photo_image_height: input.photoImageHeight ?? null,
        photo_blurhash: input.photoBlurhash ?? null
      })
      .eq("id", checkInId);
    if (!error) {
      await upsertCheckInImageMetadata(checkInId, input);
      return;
    }
    lastError = error;
    await wait(900 * (attempt + 1));
  }
  throw lastError;
}

async function upsertCheckInImageMetadata(checkInId: string, input: UpdateCheckInPhotoInput) {
  if (!supabase || !input.photoCloudflareImageId) return;
  const { data } = await supabase.from("check_ins").select("user_id").eq("id", checkInId).maybeSingle();
  if (!data?.user_id) return;
  await supabase.from("image_uploads").upsert(
    {
      cloudflare_image_id: input.photoCloudflareImageId,
      image_type: "beer_photo",
      owner_user_id: data.user_id,
      check_in_id: checkInId,
      width: input.photoImageWidth ?? null,
      height: input.photoImageHeight ?? null,
      blurhash: input.photoBlurhash ?? null,
      delivery_url: input.photoUrl ?? null
    },
    { onConflict: "cloudflare_image_id" }
  );
}

export async function deleteRemoteCheckIn(checkInId: string) {
  if (!supabase) return;
  const { error } = await supabase.from("check_ins").delete().eq("id", checkInId);
  if (error) throw error;
}

export async function toggleRemoteReaction(checkInId: string, userId: string, reacted: boolean) {
  if (!supabase) return;
  if (reacted) {
    const { error } = await supabase.from("check_in_reactions").delete().eq("check_in_id", checkInId).eq("user_id", userId);
    if (error) throw error;
    return;
  }
  const { error } = await supabase
    .from("check_in_reactions")
    .upsert({ check_in_id: checkInId, user_id: userId }, { onConflict: "check_in_id,user_id", ignoreDuplicates: true });
  if (error) throw error;

  void supabase.functions.invoke("send-like-notification", {
    body: { checkInId }
  }).catch((notifyError) => {
    console.warn("Could not send like notification", notifyError);
  });
}

export async function createRemoteCheckInComment(comment: BeerComment) {
  if (!supabase) return;
  const { error } = await supabase.from("check_in_comments").insert({
    id: comment.id,
    check_in_id: comment.checkInId,
    user_id: comment.userId,
    body: comment.body,
    created_at: comment.createdAt
  });
  if (error) throw error;

  void supabase.functions.invoke("send-comment-notification", {
    body: { checkInId: comment.checkInId, commentId: comment.id }
  }).catch((notifyError) => {
    console.warn("Could not send comment notification", notifyError);
  });
}

export async function deleteRemoteCheckInComment(commentId: string) {
  if (!supabase) return;
  const { error } = await supabase.from("check_in_comments").delete().eq("id", commentId);
  if (error) throw error;
}

async function mapGroupRow(
  row: GroupRow,
  memberships: MembershipRow[],
  requests: JoinRequestRow[],
  checkIns: BeerCheckIn[],
  currentUserId: string,
  isAccessible: boolean
): Promise<Group> {
  const cloudflareBackdropUrl = buildCloudflareImageUrl(row.backdrop_cloudflare_image_id ?? undefined, "feed");
  const signedBackdropUrl = !cloudflareBackdropUrl && row.backdrop_storage_path ? await createSignedGroupBackdropUrl(row.backdrop_storage_path).catch(() => undefined) : undefined;
  const currentMembership = memberships.find((membership) => membership.group_id === row.id && membership.user_id === currentUserId);
  const members: GroupMember[] = await Promise.all(
    memberships
      .filter((membership) => membership.group_id === row.id)
      .map(async (membership) => {
      const userCheckIns = checkIns.filter((checkIn) => checkIn.userId === membership.user_id);
      const profile = normalizeProfile(membership.profiles);
      return {
        userId: membership.user_id,
        name: profile?.display_name ?? "Pintly User",
        avatar: profile?.avatar ?? "HU",
        avatarUrl: await resolveProfileAvatarUrl(profile),
        avatarCloudflareImageId: profile?.avatar_cloudflare_image_id ?? undefined,
        beerCount: userCheckIns.reduce((sum, item) => sum + item.quantity, 0),
        checkInCount: userCheckIns.length,
        isCurrentUser: membership.user_id === currentUserId
      };
      })
  );

  return {
    id: row.id,
    name: row.name,
    description: row.description ?? undefined,
    image: row.image,
    backdropUrl: cloudflareBackdropUrl ?? signedBackdropUrl ?? row.backdrop_url ?? undefined,
    backdropStoragePath: row.backdrop_storage_path ?? undefined,
    backdropCloudflareImageId: row.backdrop_cloudflare_image_id ?? undefined,
    backdropImageWidth: row.backdrop_image_width ?? undefined,
    backdropImageHeight: row.backdrop_image_height ?? undefined,
    backdropBlurhash: row.backdrop_blurhash ?? undefined,
    privacy: row.privacy,
    memberCount: Math.max(members.length, row.member_count ?? (isAccessible ? members.length : 0)),
    goal: row.goal,
    beerCount: checkIns.reduce((sum, item) => sum + item.quantity, 0),
    breweryCount: new Set(checkIns.map((item) => item.brewery).filter(Boolean)).size,
    cityCount: new Set(checkIns.map((item) => item.location.city).filter(Boolean)).size,
    createdAt: row.created_at,
    founderId: row.founder_id,
    inviteCode: row.invite_code,
    notificationsEnabled: currentMembership?.notifications_enabled ?? true,
    members,
    pendingRequests: await Promise.all(requests.filter((request) => request.group_id === row.id).map(mapJoinRequestRow))
  };
}

async function mapJoinRequestRow(row: JoinRequestRow): Promise<GroupJoinRequest> {
  const profile = normalizeProfile(row.profiles);
  return {
    id: row.id,
    userId: row.user_id,
    name: profile?.display_name ?? "Pintly User",
    avatar: profile?.avatar ?? "HU",
    avatarUrl: await resolveProfileAvatarUrl(profile),
    avatarCloudflareImageId: profile?.avatar_cloudflare_image_id ?? undefined,
    requestedAt: row.requested_at,
    source: row.source,
    status: row.status
  };
}

function mapModerationReportRow(row: ModerationReportRow): ModerationReport {
  const reporter = normalizeProfile(row.reporter);
  const reportedUser = normalizeProfile(row.reported_user);
  return {
    id: row.id,
    reporterId: row.reporter_id,
    reportedUserId: row.reported_user_id,
    checkInId: row.check_in_id ?? undefined,
    groupId: row.group_id ?? undefined,
    reason: row.reason,
    details: row.details ?? undefined,
    status: row.status,
    createdAt: row.created_at,
    reporterName: reporter?.display_name ?? undefined,
    reportedUserName: reportedUser?.display_name ?? undefined
  };
}

async function mapCheckInRow(row: CheckInRow): Promise<BeerCheckIn> {
  const reactionUsers = await Promise.all((row.check_in_reactions ?? []).map(async (reaction) => {
    const reactionProfile = normalizeProfile(reaction.profiles);
    const name = reactionProfile?.display_name ?? "Pintly User";
    return {
      id: reaction.user_id,
      name,
      avatar: reactionProfile?.avatar ?? initialsFor(name),
      avatarUrl: await resolveProfileAvatarUrl(reactionProfile),
      avatarCloudflareImageId: reactionProfile?.avatar_cloudflare_image_id ?? undefined
    };
  }));
  const reactedBy = reactionUsers.map((reaction) => reaction.id);
  const comments = await Promise.all(
    [...(row.check_in_comments ?? [])]
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
      .map(async (comment) => mapCommentRow(comment))
  );
  const profile = normalizeProfile(row.profiles);
  const cloudflarePhotoUrl = buildCloudflareImageUrl(row.photo_cloudflare_image_id ?? undefined, "feed");
  const cloudflareThumbnailUrl = buildCloudflareImageUrl(row.photo_cloudflare_image_id ?? undefined, "thumbnail");
  const signedPhotoUrl = !cloudflarePhotoUrl && row.photo_storage_path ? await createSignedPhotoUrl(row.photo_storage_path).catch(() => undefined) : undefined;
  const signedThumbnailUrl = !cloudflareThumbnailUrl && row.photo_thumbnail_storage_path ? await createSignedPhotoUrl(row.photo_thumbnail_storage_path).catch(() => undefined) : undefined;
  const userAvatarUrl = await resolveProfileAvatarUrl(profile);
  return {
    id: row.id,
    userId: row.user_id,
    userName: profile?.display_name ?? "Pintly User",
    userAvatar: profile?.avatar ?? "HU",
    userAvatarUrl,
    beerName: row.beer_name,
    quantity: row.quantity,
    brewery: row.brewery,
    style: row.style,
    abv: row.abv ?? undefined,
    rating: row.rating ?? undefined,
    location: {
      city: row.city,
      state: row.state ?? undefined,
      country: row.country ?? undefined,
      latitude: row.latitude ?? undefined,
      longitude: row.longitude ?? undefined
    },
    venueId: row.venue_id ?? undefined,
    venueProvider: row.venue_provider ?? undefined,
    venueProviderPlaceId: row.venue_provider_place_id ?? undefined,
    venueName: row.venue_name ?? undefined,
    venueCategory: row.venue_category ?? undefined,
    venueLatitude: row.venue_latitude ?? undefined,
    venueLongitude: row.venue_longitude ?? undefined,
    venueAddress: row.venue_address ?? undefined,
    venueDistanceMeters: row.venue_distance_meters ?? undefined,
    venueConfirmed: row.venue_confirmed ?? (row.venue_confirmation_status === "confirmed"),
    venueConfirmationStatus: row.venue_confirmation_status ?? "skipped",
    venueSelectionStatus: row.venue_selection_status ?? (row.venue_confirmation_status === "confirmed" ? "confirmed" : row.venue_confirmation_status ?? "skipped"),
    note: row.note ?? undefined,
    photoUrl: cloudflarePhotoUrl ?? signedPhotoUrl ?? row.photo_url ?? undefined,
    photoStoragePath: row.photo_storage_path ?? undefined,
    photoThumbnailUrl: cloudflareThumbnailUrl ?? signedThumbnailUrl ?? row.photo_thumbnail_url ?? undefined,
    photoThumbnailStoragePath: row.photo_thumbnail_storage_path ?? undefined,
    photoCloudflareImageId: row.photo_cloudflare_image_id ?? undefined,
    photoImageWidth: row.photo_image_width ?? undefined,
    photoImageHeight: row.photo_image_height ?? undefined,
    photoBlurhash: row.photo_blurhash ?? undefined,
    photoSyncStatus: row.photo_cloudflare_image_id || row.photo_storage_path || row.photo_url ? "synced" : undefined,
    remoteSyncStatus: "synced",
    scannedBeerCount: row.scanned_beer_count ?? undefined,
    scanConfidence: row.scan_confidence ?? undefined,
    scanStatus: row.scan_status ?? undefined,
    scanBoxes: row.scan_boxes ?? undefined,
    countSource: row.count_source ?? undefined,
    groupIds: (row.check_in_groups ?? []).map((item) => item.group_id),
    createdAt: row.created_at,
    reactions: reactedBy.length,
    reactedBy,
    reactionUsers,
    comments
  };
}

async function mapCommentRow(row: CommentRow): Promise<BeerComment> {
  const profile = normalizeProfile(row.profiles);
  const name = profile?.display_name ?? "Pintly User";
  return {
    id: row.id,
    checkInId: row.check_in_id,
    userId: row.user_id,
    userName: name,
    userAvatar: profile?.avatar ?? initialsFor(name),
    userAvatarUrl: await resolveProfileAvatarUrl(profile),
    userAvatarCloudflareImageId: profile?.avatar_cloudflare_image_id ?? undefined,
    body: row.body,
    createdAt: row.created_at
  };
}

function normalizeProfile(profile: ProfileRow | ProfileRow[] | null | undefined) {
  return Array.isArray(profile) ? profile[0] : profile;
}

async function mapFriendRow(row: FriendRow): Promise<FriendProfile> {
  const profile = normalizeProfile(row.profiles);
  return {
    userId: row.friend_id,
    name: profile?.display_name ?? "Pintly User",
    avatar: profile?.avatar ?? initialsFor(profile?.display_name ?? "Pintly User"),
    avatarUrl: await resolveProfileAvatarUrl(profile),
    avatarCloudflareImageId: profile?.avatar_cloudflare_image_id ?? undefined
  };
}

async function mapFriendRequestRow(row: FriendRequestRow, currentUserId: string): Promise<FriendRequest> {
  const incoming = row.addressee_id === currentUserId;
  const otherProfile = normalizeProfile(incoming ? row.requester : row.addressee);
  return {
    id: row.id,
    userId: incoming ? row.requester_id : row.addressee_id,
    name: otherProfile?.display_name ?? "Pintly User",
    avatar: otherProfile?.avatar ?? initialsFor(otherProfile?.display_name ?? "Pintly User"),
    avatarUrl: await resolveProfileAvatarUrl(otherProfile),
    avatarCloudflareImageId: otherProfile?.avatar_cloudflare_image_id ?? undefined,
    direction: incoming ? "incoming" : "outgoing",
    status: row.status,
    requestedAt: row.created_at
  };
}

async function resolveProfileAvatarUrl(profile: ProfileRow | null | undefined) {
  if (!profile) return undefined;
  const cloudflareAvatarUrl = buildCloudflareImageUrl(profile.avatar_cloudflare_image_id ?? undefined, "avatar");
  if (cloudflareAvatarUrl) return cloudflareAvatarUrl;
  if (!profile.avatar_storage_path) return profile.avatar_url ?? undefined;
  return createSignedProfilePhotoUrl(profile.avatar_storage_path).catch(() => profile.avatar_url ?? undefined);
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

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
