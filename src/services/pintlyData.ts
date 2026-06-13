import { supabase } from "@/services/supabase";
import { createSignedGroupBackdropUrl, createSignedPhotoUrl } from "@/services/photoStorage";
import {
  BeerCheckIn,
  CheckInInput,
  CreateGroupInput,
  FriendProfile,
  FriendRequest,
  Group,
  GroupJoinRequest,
  GroupMember,
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
  avatar: string;
  avatar_url: string | null;
  avatar_storage_path: string | null;
};

type GroupRow = {
  id: string;
  name: string;
  description: string | null;
  image: string;
  backdrop_url: string | null;
  backdrop_storage_path: string | null;
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
  relationship: UserSearchResult["relationship"];
};

type CheckInGroupRow = {
  group_id: string;
};

type ReactionRow = {
  user_id: string;
  profiles?: ProfileRow | ProfileRow[] | null;
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
  note: string | null;
  photo_url: string | null;
  photo_storage_path: string | null;
  scanned_beer_count: number | null;
  scan_confidence: number | null;
  scan_status: BeerCheckIn["scanStatus"] | null;
  scan_boxes: BeerCheckIn["scanBoxes"] | null;
  count_source: BeerCheckIn["countSource"] | null;
  created_at: string;
  profiles?: ProfileRow | ProfileRow[] | null;
  check_in_groups?: CheckInGroupRow[];
  check_in_reactions?: ReactionRow[];
};

export type RemoteSnapshot = {
  groups: Group[];
  checkIns: BeerCheckIn[];
  friends: FriendProfile[];
  friendRequests: FriendRequest[];
  globalCount: number;
};

export function isRemoteDataConfigured() {
  return Boolean(supabase);
}

export async function fetchRemoteGlobalCount(): Promise<number | null> {
  if (!supabase) return null;
  const { data, error } = await supabase.rpc("get_global_beer_count");
  if (error) return null;
  return Number(data ?? 0);
}

export async function upsertProfile(user: User) {
  if (!supabase) return;
  await supabase.from("profiles").upsert({
    id: user.id,
    display_name: user.name || "Pintly User",
    avatar: user.avatar,
    avatar_url: user.avatarUrl ?? null,
    avatar_storage_path: user.avatarStoragePath ?? null
  });
}

export async function fetchRemoteSnapshot(currentUser: User): Promise<RemoteSnapshot | null> {
  if (!supabase) return null;

  try {
    await upsertProfile(currentUser);

    const [
      { data: groupRows, error: groupError },
      { data: membershipRows, error: membershipError },
      { data: requestRows, error: requestError },
      { data: friendRows, error: friendError },
      { data: friendRequestRows, error: friendRequestError },
      { data: globalCount }
    ] = await Promise.all([
      supabase.from("groups").select("*").order("created_at", { ascending: false }),
      supabase
        .from("group_memberships")
        .select("group_id,user_id,profiles!group_memberships_user_id_fkey(id,display_name,avatar,avatar_url,avatar_storage_path)"),
      supabase
        .from("group_join_requests")
        .select(
          "id,group_id,user_id,source,status,requested_at,profiles!group_join_requests_user_id_fkey(id,display_name,avatar,avatar_url,avatar_storage_path)"
        ),
      supabase.from("friendships").select("friend_id,profiles!friendships_friend_id_fkey(id,display_name,avatar,avatar_url,avatar_storage_path)"),
      supabase
        .from("friend_requests")
        .select(
          "id,requester_id,addressee_id,status,created_at,requester:profiles!friend_requests_requester_id_fkey(id,display_name,avatar,avatar_url,avatar_storage_path),addressee:profiles!friend_requests_addressee_id_fkey(id,display_name,avatar,avatar_url,avatar_storage_path)"
        )
        .eq("status", "pending"),
      supabase.rpc("get_global_beer_count")
    ]);

    if (groupError || membershipError || requestError || friendError || friendRequestError) {
      return null;
    }

    const typedMemberships = (membershipRows ?? []) as MembershipRow[];
    const typedRequests = (requestRows ?? []) as JoinRequestRow[];
    const typedFriends = (friendRows ?? []) as FriendRow[];
    const typedFriendRequests = (friendRequestRows ?? []) as FriendRequestRow[];
    const accessibleGroupIds = new Set(typedMemberships.map((row) => row.group_id));
    const richCheckInQuery = supabase
      .from("check_ins")
      .select(
        "*,profiles!check_ins_user_id_fkey(id,display_name,avatar,avatar_url,avatar_storage_path),check_in_groups(group_id),check_in_reactions(user_id,profiles!check_in_reactions_user_id_fkey(id,display_name,avatar,avatar_url,avatar_storage_path))"
      )
      .order("created_at", { ascending: false });
    let { data: checkInRows, error: checkInError } = await richCheckInQuery;

    if (checkInError) {
      console.warn("Falling back to reaction ids while loading check-ins", checkInError.message);
      const fallbackResult = await supabase
        .from("check_ins")
        .select("*,profiles!check_ins_user_id_fkey(id,display_name,avatar,avatar_url,avatar_storage_path),check_in_groups(group_id),check_in_reactions(user_id)")
        .order("created_at", { ascending: false });
      checkInRows = fallbackResult.data;
      checkInError = fallbackResult.error;
    }

    if (checkInError) {
      console.warn("Could not load remote check-ins", checkInError.message);
      return null;
    }

    const checkIns = await Promise.all(((checkInRows ?? []) as CheckInRow[]).map(mapCheckInRow));
    const groups = await Promise.all(
      ((groupRows ?? []) as GroupRow[]).map((group) =>
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
      groups,
      checkIns,
      friends: typedFriends.map(mapFriendRow),
      friendRequests: typedFriendRequests.map((row) => mapFriendRequestRow(row, currentUser.id)),
      globalCount: Number(globalCount ?? checkIns.reduce((sum, item) => sum + item.quantity, 0))
    };
  } catch {
    return null;
  }
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
      backdrop_storage_path: input.backdropStoragePath ?? null
    })
    .eq("id", groupId);
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

export async function searchRemoteUsers(query: string): Promise<UserSearchResult[]> {
  if (!supabase) return [];
  const trimmed = query.trim();
  if (trimmed.length < 2) return [];
  const { data, error } = await supabase.rpc("search_profiles_for_friends", {
    search_input: trimmed
  });
  if (error) throw error;
  return ((data ?? []) as UserSearchRow[]).map((row) => ({
    userId: row.user_id,
    name: row.display_name || "Pintly User",
    avatar: row.avatar || initialsFor(row.display_name || "Pintly User"),
    avatarUrl: row.avatar_url ?? undefined,
    relationship: row.relationship
  }));
}

export async function requestRemoteFriend(user: User, addresseeId: string) {
  if (!supabase) return;
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
  if (!supabase) return;
  const { error } = await supabase.rpc("approve_friend_request", { request_id: requestId });
  if (error) throw error;
}

export async function rejectRemoteFriendRequest(requestId: string) {
  if (!supabase) return;
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

export async function createRemoteCheckIn(input: CheckInInput, localCheckIn: BeerCheckIn) {
  return createRemoteCheckInFromLocal(localCheckIn, input.groupIds);
}

export async function createRemoteCheckInFromLocal(localCheckIn: BeerCheckIn, groupIds = localCheckIn.groupIds) {
  if (!supabase) return;
  const { error } = await supabase.from("check_ins").upsert(
    {
      id: localCheckIn.id,
      user_id: localCheckIn.userId,
      beer_name: localCheckIn.beerName,
      brewery: localCheckIn.brewery,
      style: localCheckIn.style,
      quantity: localCheckIn.quantity,
      abv: localCheckIn.abv ?? null,
      rating: localCheckIn.rating ?? null,
      city: localCheckIn.location.city,
      state: localCheckIn.location.state ?? null,
      country: localCheckIn.location.country ?? null,
      latitude: localCheckIn.location.latitude ?? null,
      longitude: localCheckIn.location.longitude ?? null,
      note: localCheckIn.note ?? null,
      photo_url: localCheckIn.photoUrl ?? null,
      photo_storage_path: localCheckIn.photoStoragePath ?? null,
      scanned_beer_count: localCheckIn.scannedBeerCount ?? null,
      scan_confidence: localCheckIn.scanConfidence ?? null,
      scan_status: localCheckIn.scanStatus ?? null,
      scan_boxes: localCheckIn.scanBoxes ?? null,
      count_source: localCheckIn.countSource ?? "manual",
      created_at: localCheckIn.createdAt
    },
    { onConflict: "id" }
  );
  if (error) throw error;

  if (groupIds.length) {
    const { error: groupLinkError } = await supabase
      .from("check_in_groups")
      .upsert(groupIds.map((groupId) => ({ check_in_id: localCheckIn.id, group_id: groupId })), { onConflict: "check_in_id,group_id" });
    if (groupLinkError) throw groupLinkError;
  }
}

export async function updateRemoteCheckIn(checkInId: string, input: UpdateCheckInInput) {
  if (!supabase) return;
  const { error } = await supabase
    .from("check_ins")
    .update({
      quantity: Math.max(1, Math.min(24, Math.floor(input.quantity))),
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
        photo_storage_path: input.photoStoragePath ?? null
      })
      .eq("id", checkInId);
    if (!error) return;
    lastError = error;
    await wait(900 * (attempt + 1));
  }
  throw lastError;
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
}

async function mapGroupRow(
  row: GroupRow,
  memberships: MembershipRow[],
  requests: JoinRequestRow[],
  checkIns: BeerCheckIn[],
  currentUserId: string,
  isAccessible: boolean
): Promise<Group> {
  const signedBackdropUrl = row.backdrop_storage_path ? await createSignedGroupBackdropUrl(row.backdrop_storage_path).catch(() => undefined) : undefined;
  const members: GroupMember[] = memberships
    .filter((membership) => membership.group_id === row.id)
    .map((membership) => {
      const userCheckIns = checkIns.filter((checkIn) => checkIn.userId === membership.user_id);
      const profile = normalizeProfile(membership.profiles);
      return {
        userId: membership.user_id,
        name: profile?.display_name ?? "Pintly User",
        avatar: profile?.avatar ?? "HU",
        avatarUrl: profile?.avatar_url ?? undefined,
        beerCount: userCheckIns.reduce((sum, item) => sum + item.quantity, 0),
        checkInCount: userCheckIns.length,
        isCurrentUser: membership.user_id === currentUserId
      };
    });

  return {
    id: row.id,
    name: row.name,
    description: row.description ?? undefined,
    image: row.image,
    backdropUrl: signedBackdropUrl ?? row.backdrop_url ?? undefined,
    backdropStoragePath: row.backdrop_storage_path ?? undefined,
    privacy: row.privacy,
    memberCount: Math.max(members.length, row.member_count ?? (isAccessible ? members.length : 0)),
    goal: row.goal,
    beerCount: checkIns.reduce((sum, item) => sum + item.quantity, 0),
    breweryCount: new Set(checkIns.map((item) => item.brewery).filter(Boolean)).size,
    cityCount: new Set(checkIns.map((item) => item.location.city).filter(Boolean)).size,
    createdAt: row.created_at,
    founderId: row.founder_id,
    inviteCode: row.invite_code,
    members,
    pendingRequests: requests.filter((request) => request.group_id === row.id).map(mapJoinRequestRow)
  };
}

function mapJoinRequestRow(row: JoinRequestRow): GroupJoinRequest {
  const profile = normalizeProfile(row.profiles);
  return {
    id: row.id,
    userId: row.user_id,
    name: profile?.display_name ?? "Pintly User",
    avatar: profile?.avatar ?? "HU",
    avatarUrl: profile?.avatar_url ?? undefined,
    requestedAt: row.requested_at,
    source: row.source,
    status: row.status
  };
}

async function mapCheckInRow(row: CheckInRow): Promise<BeerCheckIn> {
  const reactionUsers = (row.check_in_reactions ?? []).map((reaction) => {
    const reactionProfile = normalizeProfile(reaction.profiles);
    const name = reactionProfile?.display_name ?? "Pintly User";
    return {
      id: reaction.user_id,
      name,
      avatar: reactionProfile?.avatar ?? initialsFor(name),
      avatarUrl: reactionProfile?.avatar_url ?? undefined
    };
  });
  const reactedBy = reactionUsers.map((reaction) => reaction.id);
  const profile = normalizeProfile(row.profiles);
  const signedPhotoUrl = row.photo_storage_path ? await createSignedPhotoUrl(row.photo_storage_path).catch(() => undefined) : undefined;
  return {
    id: row.id,
    userId: row.user_id,
    userName: profile?.display_name ?? "Pintly User",
    userAvatar: profile?.avatar ?? "HU",
    userAvatarUrl: profile?.avatar_url ?? undefined,
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
    note: row.note ?? undefined,
    photoUrl: signedPhotoUrl ?? row.photo_url ?? undefined,
    photoStoragePath: row.photo_storage_path ?? undefined,
    photoSyncStatus: row.photo_storage_path || row.photo_url ? "synced" : undefined,
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
    reactionUsers
  };
}

function normalizeProfile(profile: ProfileRow | ProfileRow[] | null | undefined) {
  return Array.isArray(profile) ? profile[0] : profile;
}

function mapFriendRow(row: FriendRow): FriendProfile {
  const profile = normalizeProfile(row.profiles);
  return {
    userId: row.friend_id,
    name: profile?.display_name ?? "Pintly User",
    avatar: profile?.avatar ?? initialsFor(profile?.display_name ?? "Pintly User"),
    avatarUrl: profile?.avatar_url ?? undefined
  };
}

function mapFriendRequestRow(row: FriendRequestRow, currentUserId: string): FriendRequest {
  const incoming = row.addressee_id === currentUserId;
  const otherProfile = normalizeProfile(incoming ? row.requester : row.addressee);
  return {
    id: row.id,
    userId: incoming ? row.requester_id : row.addressee_id,
    name: otherProfile?.display_name ?? "Pintly User",
    avatar: otherProfile?.avatar ?? initialsFor(otherProfile?.display_name ?? "Pintly User"),
    avatarUrl: otherProfile?.avatar_url ?? undefined,
    direction: incoming ? "incoming" : "outgoing",
    status: row.status,
    requestedAt: row.created_at
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

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
