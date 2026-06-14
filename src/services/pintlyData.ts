import { supabase } from "@/services/supabase";
import { createSignedGroupBackdropUrl, createSignedPhotoUrl, createSignedProfilePhotoUrl } from "@/services/photoStorage";
import { friendsFeatureEnabled } from "@/config/features";
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
  photo_thumbnail_url: string | null;
  photo_thumbnail_storage_path: string | null;
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
  user: User;
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
  if (!user.name.trim()) return;
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
    const remoteUser = await fetchRemoteUserProfile(currentUser);
    await upsertProfile(remoteUser);

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
      friendsFeatureEnabled
        ? supabase.from("friendships").select("friend_id,profiles!friendships_friend_id_fkey(id,display_name,avatar,avatar_url,avatar_storage_path)")
        : Promise.resolve({ data: [], error: null }),
      friendsFeatureEnabled
        ? supabase
            .from("friend_requests")
            .select(
              "id,requester_id,addressee_id,status,created_at,requester:profiles!friend_requests_requester_id_fkey(id,display_name,avatar,avatar_url,avatar_storage_path),addressee:profiles!friend_requests_addressee_id_fkey(id,display_name,avatar,avatar_url,avatar_storage_path)"
            )
            .eq("status", "pending")
        : Promise.resolve({ data: [], error: null }),
      supabase.rpc("get_global_beer_count")
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
    const checkIns = friendsFeatureEnabled
      ? mappedCheckIns
      : mappedCheckIns.filter((checkIn) => checkIn.userId === currentUser.id || checkIn.groupIds.some((groupId) => accessibleGroupIds.has(groupId)));
    const resolvedGroupRows =
      groupError || !((groupRows ?? []) as GroupRow[]).some((group) => accessibleGroupIds.has(group.id))
        ? await fetchOwnRemoteGroupRows([...accessibleGroupIds])
        : { data: groupRows, error: null };
    if (resolvedGroupRows.error) console.warn("Could not load own remote groups", resolvedGroupRows.error.message);
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
      checkIns,
      friends: await Promise.all(typedFriends.map(mapFriendRow)),
      friendRequests: await Promise.all(typedFriendRequests.map((row) => mapFriendRequestRow(row, currentUser.id))),
      globalCount: Number(globalCount ?? checkIns.reduce((sum, item) => sum + item.quantity, 0))
    };
  } catch {
    console.warn("Could not load remote snapshot");
    return null;
  }
}

async function fetchOwnRemoteMembershipRows(userId: string) {
  if (!supabase) return { data: [], error: null };
  return supabase
    .from("group_memberships")
    .select("group_id,user_id,profiles!group_memberships_user_id_fkey(id,display_name,avatar,avatar_url,avatar_storage_path)")
    .eq("user_id", userId);
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
      "*,profiles!check_ins_user_id_fkey(id,display_name,avatar,avatar_url,avatar_storage_path),check_in_groups(group_id),check_in_reactions(user_id,profiles!check_in_reactions_user_id_fkey(id,display_name,avatar,avatar_url,avatar_storage_path))"
    )
    .order("created_at", { ascending: false });

  if (!richResult.error) return richResult;

  console.warn("Falling back to reaction ids while loading check-ins", richResult.error.message);
  return supabase
    .from("check_ins")
    .select("*,profiles!check_ins_user_id_fkey(id,display_name,avatar,avatar_url,avatar_storage_path),check_in_groups(group_id),check_in_reactions(user_id)")
    .order("created_at", { ascending: false });
}

function mergeMembershipRows(primary: MembershipRow[], fallback: MembershipRow[]) {
  const rowsByKey = new Map<string, MembershipRow>();
  [...primary, ...fallback].forEach((row) => rowsByKey.set(`${row.group_id}:${row.user_id}`, row));
  return [...rowsByKey.values()];
}

function mergeCheckInRows(primary: CheckInRow[], fallback: CheckInRow[]) {
  const rowsById = new Map<string, CheckInRow>();
  [...primary, ...fallback].forEach((row) => rowsById.set(row.id, row));
  return [...rowsById.values()].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
}

async function fetchOwnRemoteCheckInRows(userId: string) {
  if (!supabase) return { data: [], error: null };
  return supabase
    .from("check_ins")
    .select("*,profiles!check_ins_user_id_fkey(id,display_name,avatar,avatar_url,avatar_storage_path),check_in_groups(group_id)")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
}

async function fetchRemoteUserProfile(currentUser: User): Promise<User> {
  if (!supabase) return currentUser;
  const { data, error } = await supabase
    .from("profiles")
    .select("id,display_name,avatar,avatar_url,avatar_storage_path")
    .eq("id", currentUser.id)
    .maybeSingle();
  if (error || !data) return currentUser;
  const profile = data as ProfileRow;
  const name = profile.display_name || currentUser.name;
  const avatarUrl = await resolveProfileAvatarUrl(profile);
  return {
    ...currentUser,
    name,
    avatar: profile.avatar || initialsFor(name),
    avatarUrl,
    avatarStoragePath: profile.avatar_storage_path ?? currentUser.avatarStoragePath,
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
      avatarUrl: row.avatar_url ?? undefined,
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
      quantity: 1,
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
      photo_thumbnail_url: localCheckIn.photoThumbnailUrl ?? null,
      photo_thumbnail_storage_path: localCheckIn.photoThumbnailStoragePath ?? null,
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
        photo_thumbnail_storage_path: input.photoThumbnailStoragePath ?? null
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
    requestedAt: row.requested_at,
    source: row.source,
    status: row.status
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
      avatarUrl: await resolveProfileAvatarUrl(reactionProfile)
    };
  }));
  const reactedBy = reactionUsers.map((reaction) => reaction.id);
  const profile = normalizeProfile(row.profiles);
  const signedPhotoUrl = row.photo_storage_path ? await createSignedPhotoUrl(row.photo_storage_path).catch(() => undefined) : undefined;
  const signedThumbnailUrl = row.photo_thumbnail_storage_path ? await createSignedPhotoUrl(row.photo_thumbnail_storage_path).catch(() => undefined) : undefined;
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
    note: row.note ?? undefined,
    photoUrl: signedPhotoUrl ?? row.photo_url ?? undefined,
    photoStoragePath: row.photo_storage_path ?? undefined,
    photoThumbnailUrl: signedThumbnailUrl ?? row.photo_thumbnail_url ?? undefined,
    photoThumbnailStoragePath: row.photo_thumbnail_storage_path ?? undefined,
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

async function mapFriendRow(row: FriendRow): Promise<FriendProfile> {
  const profile = normalizeProfile(row.profiles);
  return {
    userId: row.friend_id,
    name: profile?.display_name ?? "Pintly User",
    avatar: profile?.avatar ?? initialsFor(profile?.display_name ?? "Pintly User"),
    avatarUrl: await resolveProfileAvatarUrl(profile)
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
    direction: incoming ? "incoming" : "outgoing",
    status: row.status,
    requestedAt: row.created_at
  };
}

async function resolveProfileAvatarUrl(profile: ProfileRow | null | undefined) {
  if (!profile) return undefined;
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
