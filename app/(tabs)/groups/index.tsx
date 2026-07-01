import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import type { ImageSourcePropType } from "react-native";
import { Alert, Image, Modal, Pressable, RefreshControl, ScrollView, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { CreateGroupModal } from "@/components/CreateGroupModal";
import { Avatar } from "@/components/Avatar";
import { CommentButton, CommentsSheet } from "@/components/CommentsSheet";
import { LikersModal } from "@/components/LikersModal";
import { ZoomablePhotoModal } from "@/components/ZoomablePhotoModal";
import { buildCloudflareImageUrl } from "@/services/photoStorage";
import { usePassport } from "@/store/passportStore";
import { AppTheme, useAppTheme } from "@/theme";
import { BeerCheckIn, BeerComment, Group, ModerationReportReason } from "@/types";
import { broadPlaceLabel, formatNumber, timeAgo } from "@/utils/format";
import { GROUP_MILESTONE_TIERS } from "@/utils/groupMilestones";
import { groupPhotoFor } from "@/utils/groupVisuals";
import { reactionUsersForCheckIn } from "@/utils/reactions";

type GroupMetrics = {
  activity: BeerCheckIn[];
  activeThisWeek: number;
  beersThisMonth: number;
  lastBeerAt?: string;
};

type CrewActivityItem = {
  activity: BeerCheckIn;
  groups: Group[];
};

const groupMilestoneBadges: Record<number, ImageSourcePropType> = {
  10: require("../../../assets/group-milestones/group-milestone-10.png"),
  25: require("../../../assets/group-milestones/group-milestone-25.png"),
  50: require("../../../assets/group-milestones/group-milestone-50.png"),
  100: require("../../../assets/group-milestones/group-milestone-100.png"),
  250: require("../../../assets/group-milestones/group-milestone-250.png"),
  500: require("../../../assets/group-milestones/group-milestone-500.png"),
  1000: require("../../../assets/group-milestones/group-milestone-1000.png"),
  2500: require("../../../assets/group-milestones/group-milestone-2500.png"),
  5000: require("../../../assets/group-milestones/group-milestone-5000.png"),
  10000: require("../../../assets/group-milestones/group-milestone-10000.png"),
  25000: require("../../../assets/group-milestones/group-milestone-25000.png"),
  50000: require("../../../assets/group-milestones/group-milestone-50000.png"),
  100000: require("../../../assets/group-milestones/group-milestone-100000.png"),
  250000: require("../../../assets/group-milestones/group-milestone-250000.png"),
  500000: require("../../../assets/group-milestones/group-milestone-500000.png"),
  1000000: require("../../../assets/group-milestones/group-milestone-1000000.png")
};

export default function GroupsScreen() {
  const theme = useAppTheme();
  const router = useRouter();
  const { groups, checkIns, blockedUserIds, user, requestJoinGroup, requestJoinGroupFromInvite, cancelJoinRequest, findGroupByInviteCode, initializeSeedData, reactToCheckIn, addCheckInComment, deleteCheckInComment, reportUser } = usePassport();
  const [query, setQuery] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [searchingCloud, setSearchingCloud] = useState(false);
  const [remoteInviteGroup, setRemoteInviteGroup] = useState<Group | null>(null);
  const [remoteInviteQuery, setRemoteInviteQuery] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [previewPhoto, setPreviewPhoto] = useState<string | null>(null);
  const scrollRef = useRef<ScrollView | null>(null);
  const normalizedQuery = query.toLowerCase().trim();
  const normalizedInviteQuery = query.trim().toUpperCase();
  const myGroups = useMemo(() => groups.filter((group) => group.members.some((member) => member.userId === user.id)), [groups, user.id]);
  const metricsByGroup = useMemo(() => buildMetrics(groups, checkIns, blockedUserIds, user.id), [blockedUserIds, checkIns, groups, user.id]);
  const crewActivity = useMemo(() => buildCrewActivity(myGroups, checkIns, blockedUserIds, user.id), [blockedUserIds, checkIns, myGroups, user.id]);
  const topCrewsThisMonth = useMemo(
    () =>
      [...myGroups]
        .sort((a, b) => (metricsByGroup.get(b.id)?.beersThisMonth ?? 0) - (metricsByGroup.get(a.id)?.beersThisMonth ?? 0) || b.beerCount - a.beerCount)
        .slice(0, 5),
    [metricsByGroup, myGroups]
  );
  const hasMonthlyActivity = topCrewsThisMonth.some((group) => (metricsByGroup.get(group.id)?.beersThisMonth ?? 0) > 0);
  const pendingMemberships = useMemo(
    () =>
      groups.filter(
        (group) =>
          !group.members.some((member) => member.userId === user.id) &&
          group.pendingRequests.some((request) => request.userId === user.id && request.status === "pending")
      ),
    [groups, user.id]
  );
  const founderRequestGroups = useMemo(
    () =>
      groups
        .filter((group) => group.founderId === user.id)
        .map((group) => ({
          group,
          pendingCount: group.pendingRequests.filter((request) => request.status === "pending").length
        }))
        .filter((item) => item.pendingCount > 0),
    [groups, user.id]
  );
  const searchResults = useMemo(() => {
    const localResults = groups.filter((group) => {
      const matches = group.name.toLowerCase().includes(normalizedQuery) || group.inviteCode.toLowerCase().includes(normalizedQuery);
      const member = group.members.some((item) => item.userId === user.id);
      return normalizedQuery.length > 0 && matches && !member;
    });
    if (
      remoteInviteGroup &&
      remoteInviteQuery === normalizedInviteQuery &&
      !remoteInviteGroup.members.some((member) => member.userId === user.id) &&
      !localResults.some((group) => group.id === remoteInviteGroup.id)
    ) {
      return [remoteInviteGroup, ...localResults];
    }
    return localResults;
  }, [groups, normalizedInviteQuery, normalizedQuery, remoteInviteGroup, remoteInviteQuery, user.id]);
  const discoverGroups = useMemo(() => {
    return groups.filter((group) => !group.members.some((member) => member.userId === user.id)).slice(0, 4);
  }, [groups, user.id]);

  function openMemberProfile(groupId: string, targetUserId: string) {
    router.push({ pathname: "/member-profile", params: { groupId, userId: targetUserId } });
  }

  useEffect(() => {
    void initializeSeedData();
    const interval = setInterval(() => {
      void initializeSeedData();
    }, 60000);
    return () => clearInterval(interval);
  }, [initializeSeedData]);

  useEffect(() => {
    if (normalizedQuery.length < 2) {
      setRemoteInviteGroup(null);
      setRemoteInviteQuery("");
      return;
    }
    let active = true;
    const timeout = setTimeout(() => {
      setSearchingCloud(true);
      void Promise.all([initializeSeedData(), findGroupByInviteCode(normalizedInviteQuery)])
        .then(([, foundGroup]) => {
          if (!active) return;
          setRemoteInviteGroup(foundGroup);
          setRemoteInviteQuery(normalizedInviteQuery);
        })
        .finally(() => {
          if (active) setSearchingCloud(false);
        });
    }, 450);
    return () => {
      active = false;
      clearTimeout(timeout);
    };
  }, [findGroupByInviteCode, initializeSeedData, normalizedInviteQuery, normalizedQuery]);

  async function refreshNow() {
    setRefreshing(true);
    try {
      await initializeSeedData();
      if (normalizedInviteQuery.length >= 2) {
        const foundGroup = await findGroupByInviteCode(normalizedInviteQuery);
        setRemoteInviteGroup(foundGroup);
        setRemoteInviteQuery(normalizedInviteQuery);
      }
    } finally {
      setRefreshing(false);
    }
  }

  function requestJoin(group: Group) {
    const source = normalizedQuery.length > 0 && group.inviteCode.toLowerCase().includes(normalizedQuery) ? "invite" : "search";
    if (remoteInviteGroup?.id === group.id) {
      requestJoinGroupFromInvite(group, "invite");
    } else {
      requestJoinGroup(group.id, source);
    }
    Alert.alert("Request sent", `${group.name}'s founder can approve you in the crew request queue.`);
  }

  function cancelPendingRequest(group: Group) {
    cancelJoinRequest(group.id);
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={{ paddingBottom: 120 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void refreshNow()}
            tintColor={theme.colors.accent}
            colors={[theme.colors.accent]}
            progressBackgroundColor={theme.colors.surface}
          />
        }
      >
        <View style={{ paddingHorizontal: 22, paddingTop: 14, paddingBottom: 8 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 16 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: theme.colors.accent, fontSize: 12, fontWeight: "900", letterSpacing: 2 }}>PINTLY</Text>
              <Text style={{ color: theme.colors.textPrimary, fontSize: 38, fontWeight: "900", marginTop: 6 }}>Groups</Text>
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel="Create group" onPress={() => setCreateOpen(true)} style={roundIcon(theme)}>
              <Ionicons name="add" color={theme.colors.iconSecondary} size={23} />
            </Pressable>
          </View>
        </View>

        <View style={{ gap: 24 }}>
          <View style={{ paddingHorizontal: 20, gap: 12 }}>
            <View style={searchStyle(theme)}>
              <Ionicons name="search" color={theme.colors.iconSecondary} size={18} />
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder="Search groups or invite codes"
                placeholderTextColor={theme.colors.textMuted}
                style={{ color: theme.colors.textPrimary, flex: 1, minHeight: 46 }}
              />
              {searchingCloud ? <Ionicons name="sync-outline" color={theme.colors.accent} size={18} /> : null}
            </View>
            {normalizedQuery.length ? (
              searchResults.length ? (
                <View style={{ gap: 10 }}>
                  {searchResults.map((group) => {
                    const pending = group.pendingRequests.some((request) => request.userId === user.id && request.status === "pending");
                    return <DiscoverGroupCard key={group.id} group={group} pending={pending} onJoin={() => requestJoin(group)} onCancel={() => cancelPendingRequest(group)} theme={theme} />;
                  })}
                </View>
              ) : (
                <EmptyCrewCard title="No matching groups" body="Try the exact crew name or invite code." theme={theme} />
              )
            ) : null}
          </View>

          {myGroups.length ? (
            <>
              <View style={{ gap: 12 }}>
                <SectionHeader title="Your Crews" theme={theme} inset />
                <View style={{ paddingHorizontal: 20, gap: 10 }}>
                  {myGroups.map((group) => (
                    <CrewListCard key={group.id} group={group} onPress={() => router.push(`/groups/${group.id}`)} theme={theme} />
                  ))}
                </View>
              </View>

              <View style={{ paddingHorizontal: 20, gap: 12 }}>
                <SectionHeader title="Crew Activity" detail="Recent logs from your crews." theme={theme} />
                {crewActivity.length ? (
                  <View style={{ gap: 10 }}>
                    {crewActivity.map(({ groups, activity }) => (
                      <CrewActivityRow
                        key={activity.id}
                        groups={groups}
                        activity={activity}
                        currentUserId={user.id}
                        onReact={reactToCheckIn}
                        onAddComment={addCheckInComment}
                        onDeleteComment={deleteCheckInComment}
                        onReportComment={reportUser}
                        onPhotoPress={setPreviewPhoto}
                        onUserPress={openMemberProfile}
                        theme={theme}
                      />
                    ))}
                  </View>
                ) : (
                  <EmptyCrewCard title="No crew activity yet." body="Log a beer to get the crew started." theme={theme} />
                )}
              </View>

              <View style={{ paddingHorizontal: 20, gap: 12 }}>
                <SectionHeader title={hasMonthlyActivity ? "Top Crews This Month" : "Top Crews"} detail={hasMonthlyActivity ? "Monthly competition across your crews." : "All-time totals until this month has activity."} theme={theme} />
                <View style={cardStyle(theme, 12, theme.radius.lg)}>
                  {topCrewsThisMonth.map((group, index) => {
                    const metric = metricsByGroup.get(group.id);
                    const count = hasMonthlyActivity ? metric?.beersThisMonth ?? 0 : group.beerCount;
                    return <TopCrewRow key={group.id} group={group} rank={index + 1} count={count} onPress={() => router.push(`/groups/${group.id}`)} theme={theme} />;
                  })}
                </View>
              </View>
            </>
          ) : (
            <View style={{ paddingHorizontal: 20 }}>
              <View style={cardStyle(theme, 20, 24)}>
                <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: theme.colors.accentSoft, alignItems: "center", justifyContent: "center" }}>
                  <Ionicons name="people-outline" color={theme.colors.accent} size={24} />
                </View>
                <Text style={{ color: theme.colors.textPrimary, fontWeight: "900", fontSize: 20, marginTop: 14 }}>Join or create a crew to start tracking beers together.</Text>
                <Text style={{ color: theme.colors.textSecondary, lineHeight: 21, marginTop: 6 }}>Your crew activity, leaderboard, and milestone progress will appear here.</Text>
                <View style={{ flexDirection: "row", gap: 10, marginTop: 16 }}>
                  <Pressable onPress={() => setCreateOpen(true)} style={[primaryButton(theme), { flex: 1 }]}>
                    <Text style={{ color: theme.colors.textOnPrimary, fontWeight: "900" }}>Create Group</Text>
                  </Pressable>
                  <Pressable onPress={() => scrollRef.current?.scrollToEnd({ animated: true })} style={[secondaryButton(theme), { flex: 1 }]}>
                    <Text style={{ color: theme.colors.textSecondary, fontWeight: "900" }}>Join Group</Text>
                  </Pressable>
                </View>
              </View>
            </View>
          )}

          {founderRequestGroups.length || pendingMemberships.length ? (
            <View style={{ paddingHorizontal: 20, gap: 10 }}>
              <SectionHeader title="Crew Requests" theme={theme} />
              {founderRequestGroups.map(({ group, pendingCount }) => (
                <Pressable key={group.id} onPress={() => router.push(`/groups/${group.id}`)} style={requestCardStyle(theme)}>
                  <Ionicons name="person-add-outline" color={theme.colors.accent} size={20} />
                  <Text style={{ color: theme.colors.textPrimary, fontWeight: "900", flex: 1 }}>{group.name}</Text>
                  <Text style={{ color: theme.colors.textSecondary, fontWeight: "800" }}>{pendingCount} pending</Text>
                </Pressable>
              ))}
              {pendingMemberships.map((group) => (
                <View key={group.id} style={requestCardStyle(theme)}>
                  <Ionicons name="hourglass-outline" color={theme.colors.accent} size={20} />
                  <Text style={{ color: theme.colors.textPrimary, fontWeight: "900", flex: 1 }}>{group.name}</Text>
                  <Pressable onPress={() => cancelPendingRequest(group)} hitSlop={8} style={{ paddingVertical: 4, paddingHorizontal: 4 }}>
                    <Text style={{ color: theme.colors.accent, fontWeight: "900" }}>Cancel</Text>
                  </Pressable>
                </View>
              ))}
            </View>
          ) : null}

          <View style={{ paddingHorizontal: 20, gap: 10 }}>
            {discoverGroups.length ? (
              <View style={{ gap: 10 }}>
                {discoverGroups.map((group) => {
                  const pending = group.pendingRequests.some((request) => request.userId === user.id && request.status === "pending");
                  return <DiscoverGroupCard key={group.id} group={group} pending={pending} onJoin={() => requestJoin(group)} onCancel={() => cancelPendingRequest(group)} theme={theme} />;
                })}
              </View>
            ) : (
              <EmptyCrewCard title="No matching groups" body="Try the exact crew name or invite code." theme={theme} />
            )}
          </View>
        </View>
      </ScrollView>
      <CreateGroupModal visible={createOpen} onClose={() => setCreateOpen(false)} />
      <PhotoPreviewModal uri={previewPhoto} onClose={() => setPreviewPhoto(null)} theme={theme} />
    </SafeAreaView>
  );
}

function buildMetrics(groups: Group[], checkIns: BeerCheckIn[], blockedUserIds: string[], currentUserId: string) {
  const map = new Map<string, GroupMetrics>();
  const now = new Date();
  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  groups.forEach((group) => {
    const allActivity = checkIns.filter((checkIn) => checkIn.groupIds.includes(group.id));
    const activity = allActivity
      .filter((checkIn) => checkIn.userId === currentUserId || !blockedUserIds.includes(checkIn.userId))
      .filter((checkIn) => checkIn.groupIds.includes(group.id))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    const monthActivity = allActivity.filter((checkIn) => {
      const date = new Date(checkIn.createdAt);
      return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
    });
    const activeThisWeek = new Set(activity.filter((checkIn) => new Date(checkIn.createdAt).getTime() >= weekAgo).map((checkIn) => checkIn.userId)).size;
    map.set(group.id, {
      activity,
      activeThisWeek,
      beersThisMonth: monthActivity.reduce((total, checkIn) => total + (checkIn.quantity ?? 1), 0),
      lastBeerAt: activity[0]?.createdAt
    });
  });
  return map;
}

function buildCrewActivity(myGroups: Group[], checkIns: BeerCheckIn[], blockedUserIds: string[], currentUserId: string): CrewActivityItem[] {
  const memberGroupById = new Map(myGroups.map((group) => [group.id, group]));
  return checkIns
    .filter((checkIn) => checkIn.userId === currentUserId || !blockedUserIds.includes(checkIn.userId))
    .map((activity) => ({
      activity,
      groups: activity.groupIds.map((groupId) => memberGroupById.get(groupId)).filter((group): group is Group => Boolean(group))
    }))
    .filter((item) => item.groups.length > 0)
    .sort((a, b) => new Date(b.activity.createdAt).getTime() - new Date(a.activity.createdAt).getTime())
    .slice(0, 4);
}

function CrewListCard({ group, onPress, theme }: { group: Group; onPress: () => void; theme: AppTheme }) {
  const latestMilestone = latestGroupMilestone(group.beerCount);
  const milestoneBadge = latestMilestone ? groupMilestoneBadges[latestMilestone] : undefined;
  return (
    <Pressable onPress={onPress} style={cardStyle(theme, 12, theme.radius.lg)}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        <Image source={{ uri: group.backdropUrl ?? groupPhotoFor(group.name) }} style={{ width: 58, height: 58, borderRadius: 18, backgroundColor: theme.colors.surfaceAlt }} resizeMode="cover" />
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 7 }}>
            <Text numberOfLines={1} style={{ color: theme.colors.textPrimary, fontWeight: "900", fontSize: 18, flexShrink: 1 }}>{group.name}</Text>
            {milestoneBadge ? (
              <Image
                source={milestoneBadge}
                accessibilityLabel={`${formatNumber(latestMilestone ?? 0)} beer milestone badge`}
                style={{ width: 24, height: 26, flexShrink: 0 }}
                resizeMode="contain"
              />
            ) : null}
          </View>
          <Text style={{ color: theme.colors.textSecondary, fontWeight: "800", marginTop: 4 }}>
            {formatNumber(group.memberCount)} {group.memberCount === 1 ? "member" : "members"}
          </Text>
        </View>
        <View style={{ alignItems: "flex-end" }}>
          <Text style={{ color: theme.colors.accent, fontWeight: "900", fontSize: 18 }}>{formatNumber(group.beerCount)}</Text>
          <Text style={{ color: theme.colors.textMuted, fontWeight: "800", fontSize: 11 }}>beers</Text>
        </View>
        <Ionicons name="chevron-forward" color={theme.colors.iconSecondary} size={18} />
      </View>
    </Pressable>
  );
}

function latestGroupMilestone(beerCount: number) {
  const count = Math.max(0, Math.floor(Number.isFinite(beerCount) ? beerCount : 0));
  return [...GROUP_MILESTONE_TIERS].reverse().find((tier) => count >= tier);
}

function CrewActivityRow({
  groups,
  activity,
  currentUserId,
  onReact,
  onAddComment,
  onDeleteComment,
  onReportComment,
  onPhotoPress,
  onUserPress,
  theme
}: {
  groups: Group[];
  activity: BeerCheckIn;
  currentUserId: string;
  onReact: (id: string) => void;
  onAddComment: (checkInId: string, body: string) => void;
  onDeleteComment: (checkInId: string, commentId: string) => void;
  onReportComment: (input: { reportedUserId: string; checkInId?: string; groupId?: string; reason: ModerationReportReason; details?: string }) => void;
  onPhotoPress: (uri: string) => void;
  onUserPress: (groupId: string, userId: string) => void;
  theme: AppTheme;
}) {
  const [likersOpen, setLikersOpen] = useState(false);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const photo = photoFor(activity);
  const fullPhoto = fullPhotoFor(activity);
  const count = activity.quantity ?? 1;
  const primaryGroup = groups[0];
  const reacted = activity.reactedBy.includes(currentUserId);
  const reactionUsers = reactionUsersForCheckIn(activity, currentUserId);
  return (
    <View style={cardStyle(theme, 12, theme.radius.lg)}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        <Pressable onPress={() => primaryGroup && onUserPress(primaryGroup.id, activity.userId)} hitSlop={8} style={({ pressed }) => ({ opacity: pressed ? 0.76 : 1 })}>
          <Avatar label={activity.userAvatar} uri={activity.userAvatarUrl} size={42} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Pressable onPress={() => primaryGroup && onUserPress(primaryGroup.id, activity.userId)} hitSlop={6} style={({ pressed }) => ({ opacity: pressed ? 0.72 : 1 })}>
            <Text style={{ color: theme.colors.textPrimary, fontWeight: "900" }}>{activity.userName} <Text style={{ color: theme.colors.textSecondary, fontWeight: "800" }}>logged {count === 1 ? "a beer" : `${count} beers`}</Text></Text>
          </Pressable>
          <Text style={{ color: theme.colors.textSecondary, marginTop: 3 }}>{placeLine(activity)}</Text>
          <View style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 6, marginTop: 5 }}>
            <GroupSummaryPill groups={groups} theme={theme} />
            <Text style={{ color: theme.colors.textMuted, fontSize: 12, fontWeight: "800" }}>{timeAgo(activity.createdAt)}</Text>
          </View>
        </View>
        {photo ? (
          <Pressable onPress={() => onPhotoPress(fullPhoto ?? photo)} hitSlop={6}>
            <Image source={{ uri: photo }} style={{ width: 56, height: 62, borderRadius: 14, backgroundColor: theme.colors.surfaceAlt }} resizeMode="cover" />
          </Pressable>
        ) : null}
      </View>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "flex-start", gap: 5, marginTop: 10 }}>
        <View style={{ height: 36, minWidth: 52, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5, backgroundColor: theme.colors.card, borderRadius: theme.radius.pill }}>
          <Pressable onPress={() => onReact(activity.id)} hitSlop={12} style={{ height: 36, justifyContent: "center", paddingLeft: 11 }}>
            <Ionicons name={reacted ? "heart" : "heart-outline"} color={reacted ? theme.colors.error : theme.colors.textPrimary} size={18} />
          </Pressable>
          <Pressable onPress={() => setLikersOpen(true)} hitSlop={12} style={{ height: 36, justifyContent: "center", paddingRight: 11, minWidth: 22 }}>
            <Text style={{ color: reacted ? theme.colors.error : theme.colors.textPrimary, fontWeight: "900", fontSize: 13 }}>{activity.reactions}</Text>
          </Pressable>
        </View>
        <CommentButton count={activity.comments.length} onPress={() => setCommentsOpen(true)} theme={theme} compact />
      </View>
      {activity.note ? <CaptionText text={activity.note} theme={theme} /> : null}
      <LikersModal
        visible={likersOpen}
        reactionUsers={reactionUsers}
        onUserPress={primaryGroup ? (userId) => onUserPress(primaryGroup.id, userId) : undefined}
        onClose={() => setLikersOpen(false)}
        theme={theme}
      />
      <CommentsSheet
        visible={commentsOpen}
        checkIn={activity}
        currentUserId={currentUserId}
        onAddComment={onAddComment}
        onDeleteComment={onDeleteComment}
        onReportComment={({ comment, reason, details }: { comment: BeerComment; reason: ModerationReportReason; details: string }) =>
          onReportComment({
            reportedUserId: comment.userId,
            checkInId: activity.id,
            groupId: primaryGroup?.id,
            reason,
            details
          })
        }
        onUserPress={primaryGroup ? (userId) => onUserPress(primaryGroup.id, userId) : undefined}
        onClose={() => setCommentsOpen(false)}
        theme={theme}
      />
    </View>
  );
}

function CaptionText({ text, theme }: { text: string; theme: AppTheme }) {
  return (
    <View style={{ marginTop: 13, borderRadius: theme.radius.md, backgroundColor: theme.colors.surfaceAlt, paddingHorizontal: 12, paddingVertical: 10 }}>
      <Text style={{ color: theme.colors.textPrimary, fontSize: 15, lineHeight: 22, fontWeight: "700" }}>{text}</Text>
    </View>
  );
}

function TopCrewRow({ group, rank, count, onPress, theme }: { group: Group; rank: number; count: number; onPress: () => void; theme: AppTheme }) {
  return (
    <Pressable onPress={onPress} style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 9 }}>
      <Text style={{ color: rank === 1 ? theme.colors.accent : theme.colors.textSecondary, width: 24, fontWeight: "900", fontSize: 16 }}>{rank}</Text>
      <Image source={{ uri: group.backdropUrl ?? groupPhotoFor(group.name) }} style={{ width: 40, height: 40, borderRadius: 14, backgroundColor: theme.colors.surfaceAlt }} resizeMode="cover" />
      <View style={{ flex: 1 }}>
        <Text style={{ color: theme.colors.textPrimary, fontWeight: "900" }}>{group.name}</Text>
        <Text style={{ color: theme.colors.textSecondary, fontSize: 12, marginTop: 2 }}>{group.memberCount} members</Text>
      </View>
      <Text style={{ color: theme.colors.accent, fontWeight: "900" }}>{formatNumber(count)} beers</Text>
    </Pressable>
  );
}

function DiscoverGroupCard({ group, pending, onJoin, onCancel, theme }: { group: Group; pending: boolean; onJoin: () => void; onCancel: () => void; theme: AppTheme }) {
  return (
    <View style={cardStyle(theme, 12, theme.radius.lg)}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        <Image source={{ uri: group.backdropUrl ?? groupPhotoFor(group.name) }} style={{ width: 54, height: 54, borderRadius: 16, backgroundColor: theme.colors.surfaceAlt }} resizeMode="cover" />
        <View style={{ flex: 1 }}>
          <Text style={{ color: theme.colors.textPrimary, fontWeight: "900", fontSize: 16 }}>{group.name}</Text>
          {group.description ? <Text numberOfLines={1} style={{ color: theme.colors.textSecondary, marginTop: 3 }}>{group.description}</Text> : null}
          <Text style={{ color: theme.colors.textMuted, marginTop: 3, fontSize: 12 }}>{group.memberCount} members</Text>
        </View>
        <Pressable onPress={pending ? onCancel : onJoin} style={{ backgroundColor: pending ? theme.colors.surfaceAlt : theme.colors.accent, borderRadius: theme.radius.pill, paddingHorizontal: 13, paddingVertical: 10 }}>
          <Text style={{ color: pending ? theme.colors.textSecondary : theme.colors.textOnPrimary, fontWeight: "900" }}>{pending ? "Cancel" : "Join"}</Text>
        </Pressable>
      </View>
    </View>
  );
}

function EmptyCrewCard({ title, body, theme }: { title: string; body: string; theme: AppTheme }) {
  return (
    <View style={cardStyle(theme, 16, theme.radius.lg)}>
      <Text style={{ color: theme.colors.textPrimary, fontWeight: "900" }}>{title}</Text>
      <Text style={{ color: theme.colors.textSecondary, lineHeight: 20, marginTop: 5 }}>{body}</Text>
    </View>
  );
}

function GroupSummaryPill({ groups, theme }: { groups: Group[]; theme: AppTheme }) {
  return (
    <View
      style={{
        backgroundColor: theme.mode === "light" ? "rgba(245, 158, 11, 0.18)" : "rgba(245, 158, 11, 0.22)",
        borderRadius: 8,
        borderWidth: 1,
        borderColor: theme.mode === "light" ? "rgba(245, 158, 11, 0.26)" : "rgba(245, 158, 11, 0.34)",
        paddingHorizontal: 8,
        paddingVertical: 4
      }}
    >
      <Text numberOfLines={1} style={{ color: theme.colors.accent, fontWeight: "900", fontSize: 11 }}>{groupSummary(groups)}</Text>
    </View>
  );
}

function groupSummary(groups: Group[]) {
  if (!groups.length) return "Crew activity";
  if (groups.length === 1) return groups[0].name;
  return `${groups[0].name} + ${groups.length - 1} ${groups.length === 2 ? "other" : "others"}`;
}

function SectionHeader({ title, detail, theme, inset = false }: { title: string; detail?: string; theme: AppTheme; inset?: boolean }) {
  return (
    <View style={{ paddingHorizontal: inset ? 20 : 0 }}>
      <Text style={{ color: theme.colors.textPrimary, fontWeight: "900", fontSize: 21 }}>{title}</Text>
      {detail ? <Text style={{ color: theme.colors.textSecondary, lineHeight: 19, marginTop: 4 }}>{detail}</Text> : null}
    </View>
  );
}

function cardStyle(theme: AppTheme, padding = 16, radius = theme.radius.lg) {
  return {
    backgroundColor: theme.colors.card,
    borderRadius: radius,
    borderWidth: 1,
    borderColor: theme.colors.cardBorder,
    padding,
    ...theme.shadow.card
  };
}

function requestCardStyle(theme: AppTheme) {
  return {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 10,
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.cardBorder,
    padding: 13
  };
}

function searchStyle(theme: AppTheme) {
  return {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 10,
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.cardBorder,
    paddingHorizontal: 14
  };
}

function roundIcon(theme: AppTheme) {
  return {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.cardBorder
  };
}

function primaryButton(theme: AppTheme) {
  return {
    minHeight: 46,
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    gap: 8,
    backgroundColor: theme.colors.accent,
    borderRadius: theme.radius.pill,
    paddingHorizontal: 15
  };
}

function secondaryButton(theme: AppTheme) {
  return {
    minHeight: 46,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    backgroundColor: theme.colors.surfaceAlt,
    borderWidth: 1,
    borderColor: theme.colors.cardBorder,
    borderRadius: theme.radius.pill,
    paddingHorizontal: 15
  };
}

function placeLine(activity: BeerCheckIn) {
  const brewery = activity.brewery?.trim();
  const location = broadPlaceLabel(activity.location);
  if (brewery && !["photo stamp", "beer log", "pintly log"].some((value) => brewery.toLowerCase().includes(value))) return `${brewery} · ${location}`;
  return location;
}

function photoFor(activity: BeerCheckIn) {
  return buildCloudflareImageUrl(activity.photoCloudflareImageId, "feed") ?? activity.photoUrl ?? activity.photoUri ?? activity.photoThumbnailUrl ?? buildCloudflareImageUrl(activity.photoCloudflareImageId, "thumbnail");
}

function fullPhotoFor(activity: BeerCheckIn) {
  return buildCloudflareImageUrl(activity.photoCloudflareImageId, "feed") ?? activity.photoUrl ?? activity.photoUri ?? photoFor(activity);
}

function PhotoPreviewModal({ uri, onClose, theme }: { uri: string | null; onClose: () => void; theme: AppTheme }) {
  return <ZoomablePhotoModal visible={Boolean(uri)} uri={uri} onClose={onClose} theme={theme} />;
}
