import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { Alert, Image, ImageBackground, Modal, Pressable, ScrollView, Share, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Avatar } from "@/components/Avatar";
import { CommentButton, CommentsSheet } from "@/components/CommentsSheet";
import { EmptyState } from "@/components/EmptyState";
import { PostDetailModal } from "@/components/PostDetailModal";
import { ProgressBar } from "@/components/ProgressBar";
import { compressBackdropPhoto } from "@/services/photoCompression";
import { buildCloudflareImageUrl, deleteCloudflareImage, isGroupBackdropStorageConfigured, uploadGroupBackdrop } from "@/services/photoStorage";
import { usePassport } from "@/store/passportStore";
import { AppTheme, useAppTheme } from "@/theme";
import { BeerCheckIn, BeerComment, Group, GroupMember, ModerationReportReason } from "@/types";
import { broadPlaceLabel, formatNumber, timeAgo } from "@/utils/format";
import { getGroupMilestoneProgress } from "@/utils/groupMilestones";
import { groupPhotoFor } from "@/utils/groupVisuals";
import { checkInPhotoUrl } from "@/utils/photoUrls";
import { reactionUsersForCheckIn } from "@/utils/reactions";

type DetailTab = "Activity" | "Leaderboard" | "About";
type Timeframe = "This Month" | "All Time";

export default function GroupDetailScreen() {
  const theme = useAppTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [tab, setTab] = useState<DetailTab>("Activity");
  const [timeframe, setTimeframe] = useState<Timeframe>("All Time");
  const [membersOpen, setMembersOpen] = useState(false);
  const {
    groups,
    user,
    getGroupActivity,
    getGroupLeaderboard,
    approveJoinRequest,
    rejectJoinRequest,
    updateGroupBackdrop,
    updateGroupNotifications,
    reactToCheckIn,
    addCheckInComment,
    deleteCheckInComment,
    reportUser,
    updateCheckIn,
    deleteCheckIn
  } = usePassport();
  const group = groups.find((item) => item.id === id);
  const activity = useMemo(() => (group ? getGroupActivity(group.id).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()) : []), [group, getGroupActivity]);
  const monthlyActivity = useMemo(() => activity.filter(isThisMonth), [activity]);
  const allTimeLeaderboard = group ? getGroupLeaderboard(group.id, "beers") : [];
  const monthBeerByUser = useMemo(() => {
    const map = new Map<string, number>();
    monthlyActivity.forEach((checkIn) => map.set(checkIn.userId, (map.get(checkIn.userId) ?? 0) + (checkIn.quantity ?? 1)));
    return map;
  }, [monthlyActivity]);
  const leaderboard = useMemo(() => {
    if (!group || timeframe === "All Time") return allTimeLeaderboard;
    return [...group.members]
      .map((member) => ({ ...member, beerCount: monthBeerByUser.get(member.userId) ?? 0 }))
      .sort((a, b) => b.beerCount - a.beerCount);
  }, [allTimeLeaderboard, group, monthBeerByUser, timeframe]);
  const metrics = useMemo(() => group ? buildGroupMetrics(group, activity, monthlyActivity) : null, [activity, group, monthlyActivity]);
  const pendingRequests = group?.pendingRequests.filter((request) => request.status === "pending") ?? [];
  const isFounder = group?.founderId === user.id;

  async function shareInvite() {
    if (!group) return;
    const link = `pintly:///groups/join?code=${group.inviteCode}`;
    try {
      await Share.share({
        title: `Join ${group.name} on Pintly`,
        message: `Join my Pintly crew "${group.name}": ${link}\n\nIf the link does not open, search invite code ${group.inviteCode} in Pintly.`
      });
    } catch {
      Alert.alert("Invite code", group.inviteCode);
    }
  }

  async function changeBackdrop() {
    if (!group || !isFounder) return;
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Photo access needed", "Allow photo library access to choose a custom crew backdrop.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      allowsEditing: true,
      aspect: [16, 9],
      quality: 0.82
    });
    if (result.canceled || !result.assets[0]?.uri) return;

    try {
      const compressed = await compressBackdropPhoto(result.assets[0].uri);
      if (isGroupBackdropStorageConfigured()) {
        const uploaded = await uploadGroupBackdrop(compressed.uri, user.id, group.id, { width: compressed.width, height: compressed.height });
        updateGroupBackdrop(group.id, {
          backdropUrl: uploaded.signedUrl,
          backdropStoragePath: uploaded.storagePath,
          backdropCloudflareImageId: uploaded.cloudflareImageId,
          backdropImageWidth: uploaded.width,
          backdropImageHeight: uploaded.height
        });
        if (group.backdropCloudflareImageId && group.backdropCloudflareImageId !== uploaded.cloudflareImageId) {
          void deleteCloudflareImage(group.backdropCloudflareImageId);
        }
      } else {
        updateGroupBackdrop(group.id, { backdropUrl: compressed.uri, backdropImageWidth: compressed.width, backdropImageHeight: compressed.height });
      }
    } catch {
      Alert.alert("Backdrop update failed", "The crew backdrop could not be updated. Try again in a moment.");
    }
  }

  function openCrewActions() {
    if (!group) return;
    const notificationsEnabled = group.notificationsEnabled ?? true;
    const buttons = [
      { text: "Share invite", onPress: () => void shareInvite() },
      {
        text: notificationsEnabled ? "Turn notifications off" : "Turn notifications on",
        onPress: () => updateGroupNotifications(group.id, !notificationsEnabled)
      },
      ...(isFounder ? [{ text: "Change backdrop", onPress: () => void changeBackdrop() }] : []),
      { text: "Cancel", style: "cancel" as const }
    ];
    Alert.alert("Crew actions", group.name, buttons);
  }

  function openMemberProfile(targetUserId: string) {
    if (!group) return;
    router.push({ pathname: "/member-profile", params: { groupId: group.id, userId: targetUserId } });
  }

  if (!group || !metrics) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background, padding: 20 }}>
        <Pressable onPress={() => router.back()} style={{ paddingVertical: 12 }}>
          <Text style={{ color: theme.colors.accent, fontWeight: "900" }}>Back</Text>
        </Pressable>
        <EmptyState title="Crew not found" body="This Pintly crew is not available in local storage." />
      </SafeAreaView>
    );
  }

  const milestoneProgress = getGroupMilestoneProgress(group.beerCount);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 120 }}>
        <CrewHero group={group} metrics={metrics} onBack={() => router.back()} onActions={openCrewActions} theme={theme} />

        <View style={{ paddingHorizontal: 20, gap: 18 }}>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
            <HeroMetric label="Beers" value={formatNumber(group.beerCount)} theme={theme} />
            <HeroMetric label="Members" value={formatNumber(group.memberCount)} onPress={() => setMembersOpen(true)} theme={theme} />
            <HeroMetric label="Active this week" value={formatNumber(metrics.activeThisWeek)} theme={theme} />
            <HeroMetric label="This month" value={formatNumber(metrics.beersThisMonth)} theme={theme} />
          </View>

          <View style={cardStyle(theme, 16, theme.radius.lg)}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 12 }}>
              <Text style={{ color: theme.colors.textPrimary, fontWeight: "900" }}>Next milestone</Text>
              <Text style={{ color: theme.colors.accent, fontWeight: "900" }}>
                {milestoneProgress.completed ? "All tiers complete" : `${formatNumber(group.beerCount)} / ${formatNumber(milestoneProgress.target)} beers`}
              </Text>
            </View>
            <View style={{ marginTop: 10 }}>
              <ProgressBar current={milestoneProgress.current} goal={milestoneProgress.target} color={theme.colors.accent} />
            </View>
            <Text style={{ color: theme.colors.textSecondary, marginTop: 8, lineHeight: 20 }}>
              {milestoneProgress.completed
                ? "This crew has unlocked every milestone badge."
                : `${formatNumber(milestoneProgress.remaining)} beers until the ${formatNumber(milestoneProgress.target)} badge.`}
            </Text>
            <Pressable onPress={() => void shareInvite()} style={[primaryButton(theme), { marginTop: 15 }]}>
              <Ionicons name="person-add-outline" color={theme.colors.textOnPrimary} size={18} />
              <Text style={{ color: theme.colors.textOnPrimary, fontWeight: "900" }}>Invite Members</Text>
            </Pressable>
          </View>

          <View style={{ flexDirection: "row", gap: 8 }}>
            {(["Activity", "Leaderboard", "About"] as DetailTab[]).map((item) => (
              <Pressable key={item} onPress={() => setTab(item)} style={tabStyle(item === tab, theme)}>
                <Text style={{ color: item === tab ? theme.colors.textOnPrimary : theme.colors.textSecondary, fontWeight: "900", fontSize: 12 }}>{item}</Text>
              </Pressable>
            ))}
          </View>

          {tab === "Activity" ? (
            <View style={{ gap: 10 }}>
              {activity.length ? (
                activity.map((item) => (
                  <CrewActivityRow
                    key={item.id}
                    activity={item}
                    currentUserId={user.id}
                    onUserPress={openMemberProfile}
                    onReact={reactToCheckIn}
                    onAddComment={addCheckInComment}
                    onDeleteComment={deleteCheckInComment}
                    onReportComment={reportUser}
                    onEdit={updateCheckIn}
                    onDelete={deleteCheckIn}
                    theme={theme}
                  />
                ))
              ) : (
                <EmptyState title="No crew activity yet." body="Log a beer to get the crew started." icon="beer-outline" />
              )}
            </View>
          ) : null}

          {tab === "Leaderboard" ? (
            <View style={{ gap: 12 }}>
              <View style={{ flexDirection: "row", gap: 8 }}>
                {(["This Month", "All Time"] as Timeframe[]).map((item) => (
                  <Pressable key={item} onPress={() => setTimeframe(item)} style={smallPillStyle(timeframe === item, theme)}>
                    <Text style={{ color: timeframe === item ? theme.colors.textOnPrimary : theme.colors.textSecondary, fontWeight: "900", fontSize: 12 }}>{item}</Text>
                  </Pressable>
                ))}
              </View>
              {leaderboard.map((member, index) => (
                <LeaderboardRow key={member.userId} member={member} rank={index + 1} currentUserId={user.id} onPress={() => openMemberProfile(member.userId)} theme={theme} />
              ))}
            </View>
          ) : null}

          {tab === "About" ? (
            <View style={{ gap: 12 }}>
              <AboutCard
                group={group}
                metrics={metrics}
                onToggleNotifications={() => updateGroupNotifications(group.id, !(group.notificationsEnabled ?? true))}
                theme={theme}
              />
              {isFounder ? (
                <JoinRequestsCard
                  group={group}
                  pendingRequests={pendingRequests}
                  onApprove={(requestId) => approveJoinRequest(group.id, requestId)}
                  onReject={(requestId) => rejectJoinRequest(group.id, requestId)}
                  theme={theme}
                />
              ) : null}
            </View>
          ) : null}
        </View>
      </ScrollView>
      <GroupMembersModal
        visible={membersOpen}
        group={group}
        currentUserId={user.id}
        onClose={() => setMembersOpen(false)}
        onMemberPress={(memberId) => {
          setMembersOpen(false);
          openMemberProfile(memberId);
        }}
        theme={theme}
      />
    </SafeAreaView>
  );
}

function CrewHero({ group, metrics, onBack, onActions, theme }: { group: Group; metrics: ReturnType<typeof buildGroupMetrics>; onBack: () => void; onActions: () => void; theme: AppTheme }) {
  const image = group.backdropUrl ?? groupPhotoFor(group.name);
  return (
    <View style={{ padding: 20, paddingBottom: 16 }}>
      <ImageBackground source={{ uri: image }} imageStyle={{ borderRadius: 28 }} style={{ minHeight: 260, overflow: "hidden", borderRadius: 28, justifyContent: "space-between" }} resizeMode="cover">
        <View pointerEvents="none" style={{ position: "absolute", inset: 0, backgroundColor: theme.colors.imageOverlay }} />
        <View style={{ flexDirection: "row", justifyContent: "space-between", padding: 14 }}>
          <Pressable onPress={onBack} style={heroIcon(theme)}>
            <Ionicons name="arrow-back" color={theme.colors.overlayText} size={21} />
          </Pressable>
          <Pressable onPress={onActions} style={heroIcon(theme)}>
            <Ionicons name="ellipsis-horizontal" color={theme.colors.overlayText} size={22} />
          </Pressable>
        </View>
        <View style={{ padding: 18 }}>
          <View style={{ width: 70, height: 70, borderRadius: 24, overflow: "hidden", borderWidth: 2, borderColor: theme.colors.imageOverlayBorder, backgroundColor: theme.colors.surfaceAlt }}>
            <Image source={{ uri: image }} style={{ width: "100%", height: "100%" }} resizeMode="cover" />
          </View>
          <Text style={{ color: theme.colors.overlayText, fontWeight: "900", fontSize: 32, marginTop: 12, textShadowColor: theme.colors.mediaBackdropSoft, textShadowRadius: 8 }}>{group.name}</Text>
          <Text style={{ color: theme.colors.overlayTextMuted, fontWeight: "800", marginTop: 5 }}>Your crew since {formatMonthYear(group.createdAt)}</Text>
          <Text style={{ color: theme.colors.overlayTextMuted, marginTop: 5 }}>Last beer logged: {metrics.lastBeerAt ? timeAgo(metrics.lastBeerAt) : "No activity yet"}</Text>
        </View>
      </ImageBackground>
    </View>
  );
}

function buildGroupMetrics(group: Group, activity: BeerCheckIn[], monthlyActivity: BeerCheckIn[]) {
  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  return {
    activeThisWeek: new Set(activity.filter((checkIn) => new Date(checkIn.createdAt).getTime() >= weekAgo).map((checkIn) => checkIn.userId)).size,
    beersThisMonth: monthlyActivity.reduce((total, checkIn) => total + (checkIn.quantity ?? 1), 0),
    lastBeerAt: activity[0]?.createdAt,
    totalBeers: group.beerCount
  };
}

function CrewActivityRow({
  activity,
  currentUserId,
  onReact,
  onAddComment,
  onDeleteComment,
  onReportComment,
  onEdit,
  onDelete,
  onUserPress,
  theme
}: {
  activity: BeerCheckIn;
  currentUserId: string;
  onReact: (id: string) => void;
  onAddComment: (checkInId: string, body: string) => void;
  onDeleteComment: (checkInId: string, commentId: string) => void;
  onReportComment: (input: { reportedUserId: string; checkInId?: string; groupId?: string; reason: ModerationReportReason; details?: string }) => void;
  onEdit: (id: string, input: { quantity: number; note?: string }) => void;
  onDelete: (id: string) => void;
  onUserPress: (userId: string) => void;
  theme: AppTheme;
}) {
  const [editOpen, setEditOpen] = useState(false);
  const [postDetailOpen, setPostDetailOpen] = useState(false);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const count = activity.quantity ?? 1;
  const photo = photoFor(activity);
  const fullPhoto = fullPhotoFor(activity);
  const reacted = activity.reactedBy.includes(currentUserId);
  const reactionUsers = reactionUsersForCheckIn(activity, currentUserId);
  const canEdit = activity.userId === currentUserId;
  const lastPostTap = useRef(0);
  const lastPhotoTap = useRef(0);
  const singleTapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (singleTapTimer.current) clearTimeout(singleTapTimer.current);
    };
  }, []);

  function likeFromDoubleTap() {
    if (!reacted) onReact(activity.id);
  }

  function handlePostPress() {
    const now = Date.now();
    if (now - lastPostTap.current < 280) {
      if (singleTapTimer.current) {
        clearTimeout(singleTapTimer.current);
        singleTapTimer.current = null;
      }
      lastPostTap.current = 0;
      likeFromDoubleTap();
      return;
    }
    lastPostTap.current = now;
    singleTapTimer.current = setTimeout(() => {
      setPostDetailOpen(true);
      singleTapTimer.current = null;
      lastPostTap.current = 0;
    }, 280);
  }

  function handlePhotoPress() {
    const now = Date.now();
    if (now - lastPhotoTap.current < 260) {
      if (singleTapTimer.current) {
        clearTimeout(singleTapTimer.current);
        singleTapTimer.current = null;
      }
      lastPhotoTap.current = 0;
      likeFromDoubleTap();
      return;
    }
    lastPhotoTap.current = now;
    singleTapTimer.current = setTimeout(() => {
      setPostDetailOpen(true);
      singleTapTimer.current = null;
      lastPhotoTap.current = 0;
    }, 260);
  }

  function handleReactPress() {
    if (singleTapTimer.current) {
      clearTimeout(singleTapTimer.current);
      singleTapTimer.current = null;
    }
    lastPostTap.current = 0;
    lastPhotoTap.current = 0;
    onReact(activity.id);
  }

  function confirmDelete() {
    Alert.alert("Delete check-in?", "This removes the beer log from Pintly and any selected crew trackers.", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => onDelete(activity.id) }
    ]);
  }

  return (
    <Pressable onPress={handlePostPress} style={cardStyle(theme, 12, theme.radius.lg)}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        <Pressable
          onPress={(event) => {
            event.stopPropagation();
            onUserPress(activity.userId);
          }}
          hitSlop={2}
          style={({ pressed }) => ({ opacity: pressed ? 0.76 : 1 })}
        >
          <Avatar label={activity.userAvatar} uri={activity.userAvatarUrl} size={42} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap" }}>
            <Pressable
              onPress={(event) => {
                event.stopPropagation();
                onUserPress(activity.userId);
              }}
              hitSlop={2}
              style={({ pressed }) => ({ opacity: pressed ? 0.72 : 1 })}
            >
              <Text style={{ color: theme.colors.textPrimary, fontWeight: "900" }}>{activity.userName}</Text>
            </Pressable>
            <Text style={{ color: theme.colors.textSecondary, fontWeight: "800" }}> logged {count === 1 ? "a beer" : `${count} beers`}</Text>
          </View>
          <Text style={{ color: theme.colors.textSecondary, marginTop: 4 }}>{placeLine(activity)}</Text>
          <Text style={{ color: theme.colors.textMuted, marginTop: 4, fontSize: 12 }}>{timeAgo(activity.createdAt)}</Text>
        </View>
        {photo ? (
          <Pressable onPress={handlePhotoPress} hitSlop={6}>
            <Image source={{ uri: photo }} style={{ width: 58, height: 64, borderRadius: 14, backgroundColor: theme.colors.surfaceAlt }} resizeMode="cover" />
          </Pressable>
        ) : null}
      </View>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 12 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
          <Pressable
            onPress={(event) => {
              event.stopPropagation();
              handleReactPress();
            }}
            accessibilityRole="button"
            accessibilityLabel={reacted ? "Unlike post" : "Like post"}
            hitSlop={10}
            style={({ pressed }) => ({
              height: 40,
              minWidth: 62,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: 5,
              backgroundColor: theme.colors.card,
              borderRadius: theme.radius.pill,
              paddingHorizontal: 12,
              opacity: pressed ? 0.72 : 1
            })}
          >
            <View style={{ height: 40, justifyContent: "center" }}>
              <Ionicons name={reacted ? "heart" : "heart-outline"} color={reacted ? theme.colors.error : theme.colors.textPrimary} size={18} />
            </View>
            <View style={{ height: 40, justifyContent: "center", minWidth: 22 }}>
              <Text style={{ color: reacted ? theme.colors.error : theme.colors.textPrimary, fontWeight: "900", fontSize: 13 }}>{activity.reactions}</Text>
            </View>
          </Pressable>
          <CommentButton count={activity.comments.length} onPress={() => setCommentsOpen(true)} theme={theme} compact />
        </View>
        {canEdit ? (
          <View style={{ flexDirection: "row", gap: 8 }}>
            <Pressable onPress={() => setEditOpen(true)} hitSlop={8} style={{ padding: 8 }}>
              <Ionicons name="create-outline" color={theme.colors.iconSecondary} size={18} />
            </Pressable>
            <Pressable onPress={confirmDelete} hitSlop={8} style={{ padding: 8 }}>
              <Ionicons name="trash-outline" color={theme.colors.textMuted} size={18} />
            </Pressable>
          </View>
        ) : null}
      </View>
      {activity.note ? <CaptionText text={activity.note} theme={theme} /> : null}
      <EditCrewLogModal
        visible={editOpen}
        activity={activity}
        onClose={() => setEditOpen(false)}
        onSave={(input) => {
          onEdit(activity.id, input);
          setEditOpen(false);
        }}
        theme={theme}
      />
      <PostDetailModal
        visible={postDetailOpen}
        checkIn={activity}
        currentUserId={currentUserId}
        photoUri={fullPhoto ?? photo}
        reacted={reacted}
        reactionUsers={reactionUsers}
        onReact={onReact}
        onAddComment={onAddComment}
        onDeleteComment={onDeleteComment}
        onReportComment={({ comment, reason, details }) =>
          onReportComment({
            reportedUserId: comment.userId,
            checkInId: activity.id,
            groupId: activity.groupIds[0],
            reason,
            details
          })
        }
        onUserPress={onUserPress}
        onClose={() => setPostDetailOpen(false)}
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
            groupId: activity.groupIds[0],
            reason,
            details
          })
        }
        onUserPress={onUserPress}
        onClose={() => setCommentsOpen(false)}
        theme={theme}
      />
    </Pressable>
  );
}

function CaptionText({ text, theme }: { text: string; theme: AppTheme }) {
  return (
    <View style={{ marginTop: 13, borderRadius: theme.radius.md, backgroundColor: theme.colors.surfaceAlt, paddingHorizontal: 12, paddingVertical: 10 }}>
      <Text style={{ color: theme.colors.textPrimary, fontSize: 15, lineHeight: 22, fontWeight: "700" }}>{text}</Text>
    </View>
  );
}

function EditCrewLogModal({
  visible,
  activity,
  onClose,
  onSave,
  theme
}: {
  visible: boolean;
  activity: BeerCheckIn;
  onClose: () => void;
  onSave: (input: { quantity: number; note?: string }) => void;
  theme: AppTheme;
}) {
  const [note, setNote] = useState(activity.note ?? "");

  useEffect(() => {
    if (visible) setNote(activity.note ?? "");
  }, [activity.id, activity.note, visible]);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }}>
        <View style={{ padding: 20 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
            <View>
              <Text style={{ color: theme.colors.accent, fontSize: 12, fontWeight: "900", letterSpacing: 1.5 }}>EDIT LOG</Text>
              <Text style={{ color: theme.colors.textPrimary, fontSize: 28, fontWeight: "900", marginTop: 3 }}>Beer Note</Text>
            </View>
            <Pressable onPress={onClose} hitSlop={8} style={{ padding: 8 }}>
              <Ionicons name="close" color={theme.colors.textPrimary} size={28} />
            </Pressable>
          </View>
          <TextInput
            value={note}
            onChangeText={setNote}
            placeholder="Optional note"
            placeholderTextColor={theme.colors.textMuted}
            multiline
            style={{
              minHeight: 130,
              color: theme.colors.textPrimary,
              backgroundColor: theme.colors.card,
              borderWidth: 1,
              borderColor: theme.colors.cardBorder,
              borderRadius: theme.radius.md,
              paddingHorizontal: 14,
              paddingVertical: 12,
              textAlignVertical: "top"
            }}
          />
          <Pressable onPress={() => onSave({ quantity: activity.quantity ?? 1, note })} style={[primaryButton(theme), { marginTop: 16 }]}>
            <Text style={{ color: theme.colors.textOnPrimary, fontWeight: "900" }}>Save Changes</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

function LeaderboardRow({ member, rank, currentUserId, onPress, theme }: { member: GroupMember; rank: number; currentUserId: string; onPress: () => void; theme: AppTheme }) {
  const current = member.userId === currentUserId || member.isCurrentUser;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => ({ ...cardStyle(theme, 13, theme.radius.md), backgroundColor: current ? theme.colors.accentSoft : theme.colors.card, borderColor: current ? theme.colors.accent : theme.colors.cardBorder, opacity: pressed ? 0.78 : 1 })}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        <Text style={{ color: current ? theme.colors.accent : theme.colors.textSecondary, width: 24, fontWeight: "900", fontSize: 16 }}>{rank}</Text>
        <Avatar label={member.avatar} uri={member.avatarUrl} size={40} borderColor={current ? theme.colors.accent : theme.colors.cardBorder} />
        <Text style={{ color: theme.colors.textPrimary, flex: 1, fontWeight: "900" }}>{member.name}</Text>
        <View style={{ alignItems: "flex-end" }}>
          <Text style={{ color: theme.colors.textPrimary, fontWeight: "900", fontSize: 18 }}>{formatNumber(member.beerCount)}</Text>
          <Text style={{ color: theme.colors.textSecondary, fontSize: 10, fontWeight: "800" }}>BEERS</Text>
        </View>
      </View>
    </Pressable>
  );
}

function AboutCard({
  group,
  metrics,
  onToggleNotifications,
  theme
}: {
  group: Group;
  metrics: ReturnType<typeof buildGroupMetrics>;
  onToggleNotifications: () => void;
  theme: AppTheme;
}) {
  const milestoneProgress = getGroupMilestoneProgress(group.beerCount);
  const notificationsEnabled = group.notificationsEnabled ?? true;
  return (
    <View style={cardStyle(theme, 16, theme.radius.lg)}>
      <Text style={{ color: theme.colors.textPrimary, fontWeight: "900", fontSize: 18 }}>Crew details</Text>
      <Pressable
        onPress={onToggleNotifications}
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 10,
          borderTopWidth: 1,
          borderTopColor: theme.colors.cardBorder,
          paddingTop: 11,
          marginTop: 11
        }}
      >
        <View style={{ width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: notificationsEnabled ? theme.colors.accentSoft : theme.colors.surfaceAlt }}>
          <Ionicons name={notificationsEnabled ? "notifications-outline" : "notifications-off-outline"} color={notificationsEnabled ? theme.colors.accent : theme.colors.textMuted} size={19} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ color: theme.colors.textPrimary, fontWeight: "900" }}>Notifications</Text>
          <Text style={{ color: theme.colors.textSecondary, marginTop: 2 }}>{notificationsEnabled ? "On for this crew" : "Off for this crew"}</Text>
        </View>
        <Text style={{ color: theme.colors.accent, fontWeight: "900" }}>{notificationsEnabled ? "Turn off" : "Turn on"}</Text>
      </Pressable>
      <InfoRow label="Members" value={formatNumber(group.memberCount)} theme={theme} />
      <InfoRow label="Total beers" value={formatNumber(group.beerCount)} theme={theme} />
      <InfoRow label="Created" value={formatDate(group.createdAt)} theme={theme} />
      <InfoRow label="Next milestone" value={milestoneProgress.completed ? "All tiers complete" : `${formatNumber(milestoneProgress.target)} beers`} theme={theme} />
      <InfoRow label="This month" value={`${formatNumber(metrics.beersThisMonth)} beers`} theme={theme} />
      <InfoRow label="Privacy" value={group.privacy} theme={theme} />
      <InfoRow label="Invite code" value={group.inviteCode} theme={theme} />
    </View>
  );
}

function JoinRequestsCard({
  group,
  pendingRequests,
  onApprove,
  onReject,
  theme
}: {
  group: Group;
  pendingRequests: Group["pendingRequests"];
  onApprove: (requestId: string) => void;
  onReject: (requestId: string) => void;
  theme: AppTheme;
}) {
  return (
    <View style={cardStyle(theme, 16, theme.radius.lg)}>
      <Text style={{ color: theme.colors.textPrimary, fontWeight: "900", fontSize: 18 }}>Join requests</Text>
      {pendingRequests.length ? (
        pendingRequests.map((request) => (
          <View key={request.id} style={{ flexDirection: "row", alignItems: "center", gap: 10, borderTopWidth: 1, borderTopColor: theme.colors.cardBorder, paddingTop: 12, marginTop: 12 }}>
            <Avatar label={request.avatar} uri={request.avatarUrl} size={38} borderColor={theme.colors.accent} />
            <View style={{ flex: 1 }}>
              <Text style={{ color: theme.colors.textPrimary, fontWeight: "900" }}>{request.name}</Text>
              <Text style={{ color: theme.colors.textSecondary, marginTop: 2 }}>{request.source === "invite" ? "Used invite code" : "Found by search"}</Text>
            </View>
            <Pressable onPress={() => onApprove(request.id)} style={{ backgroundColor: theme.colors.accent, borderRadius: theme.radius.pill, paddingHorizontal: 10, paddingVertical: 8 }}>
              <Text style={{ color: theme.colors.textOnPrimary, fontWeight: "900", fontSize: 12 }}>Approve</Text>
            </Pressable>
            <Pressable onPress={() => onReject(request.id)} hitSlop={8}>
              <Ionicons name="close-circle" color={theme.colors.danger} size={26} />
            </Pressable>
          </View>
        ))
      ) : (
        <Text style={{ color: theme.colors.textSecondary, lineHeight: 20, marginTop: 8 }}>Requests to join {group.name} will appear here.</Text>
      )}
    </View>
  );
}

function GroupMembersModal({
  visible,
  group,
  currentUserId,
  onClose,
  onMemberPress,
  theme
}: {
  visible: boolean;
  group: Group;
  currentUserId: string;
  onClose: () => void;
  onMemberPress: (memberId: string) => void;
  theme: AppTheme;
}) {
  const members = useMemo(
    () => [...group.members].sort((a, b) => (b.beerCount ?? 0) - (a.beerCount ?? 0) || a.name.localeCompare(b.name)),
    [group.members]
  );

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable onPress={onClose} style={{ flex: 1, justifyContent: "flex-end", backgroundColor: theme.colors.modalBackdrop }}>
        <Pressable
          onPress={(event) => event.stopPropagation()}
          style={{
            maxHeight: "76%",
            backgroundColor: theme.colors.card,
            borderTopLeftRadius: 28,
            borderTopRightRadius: 28,
            borderWidth: 1,
            borderColor: theme.colors.cardBorder,
            padding: 20,
            paddingBottom: 24
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 14 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: theme.colors.accent, fontWeight: "900", fontSize: 12, letterSpacing: 1.4 }}>MEMBERS</Text>
              <Text numberOfLines={1} style={{ color: theme.colors.textPrimary, fontWeight: "900", fontSize: 24, marginTop: 2 }}>{group.name}</Text>
            </View>
            <Pressable onPress={onClose} hitSlop={8}>
              <Ionicons name="close" color={theme.colors.textPrimary} size={26} />
            </Pressable>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            <View style={{ gap: 10, paddingBottom: 8 }}>
              {members.map((member) => {
                const current = member.userId === currentUserId || member.isCurrentUser;
                const founder = member.userId === group.founderId;
                return (
                  <Pressable
                    key={member.userId}
                    onPress={() => onMemberPress(member.userId)}
                    style={({ pressed }) => ({
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 10,
                      borderRadius: theme.radius.md,
                      backgroundColor: current ? theme.colors.accentSoft : theme.colors.surfaceAlt,
                      borderWidth: 1,
                      borderColor: current ? theme.colors.accent : theme.colors.cardBorder,
                      padding: 11,
                      opacity: pressed ? 0.76 : 1
                    })}
                  >
                    <Avatar label={member.avatar} uri={member.avatarUrl} size={42} borderColor={current ? theme.colors.accent : theme.colors.cardBorder} />
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 6 }}>
                        <Text numberOfLines={1} style={{ color: theme.colors.textPrimary, fontWeight: "900", fontSize: 16, maxWidth: founder ? 170 : 230 }}>{member.name}</Text>
                        {founder ? (
                          <View style={{ borderRadius: theme.radius.pill, backgroundColor: theme.colors.accent, paddingHorizontal: 8, paddingVertical: 3 }}>
                            <Text style={{ color: theme.colors.textOnPrimary, fontWeight: "900", fontSize: 10 }}>FOUNDER</Text>
                          </View>
                        ) : null}
                      </View>
                      <Text style={{ color: theme.colors.textSecondary, marginTop: 3, fontSize: 12 }}>
                        {formatNumber(member.beerCount)} beers - {formatNumber(member.checkInCount)} logs
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" color={theme.colors.iconSecondary} size={18} />
                  </Pressable>
                );
              })}
            </View>
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function HeroMetric({ label, value, onPress, theme }: { label: string; value: string; onPress?: () => void; theme: AppTheme }) {
  const content = (
    <>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <Text style={{ color: theme.colors.textPrimary, fontWeight: "900", fontSize: 19 }}>{value}</Text>
        {onPress ? <Ionicons name="people-outline" color={theme.colors.accent} size={18} /> : null}
      </View>
      <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.82} style={{ color: theme.colors.textSecondary, fontWeight: "800", fontSize: 11, marginTop: 3 }}>{label}</Text>
    </>
  );
  const style = { width: "48.5%" as const, backgroundColor: theme.colors.card, borderWidth: 1, borderColor: theme.colors.cardBorder, borderRadius: theme.radius.md, padding: 11, ...theme.shadow.card };

  if (onPress) {
    return (
      <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel="View group members" style={({ pressed }) => ({ ...style, opacity: pressed ? 0.78 : 1 })}>
        {content}
      </Pressable>
    );
  }

  return (
    <View style={style}>
      {content}
    </View>
  );
}

function InfoRow({ label, value, theme }: { label: string; value: string; theme: AppTheme }) {
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 14, borderTopWidth: 1, borderTopColor: theme.colors.cardBorder, paddingTop: 11, marginTop: 11 }}>
      <Text style={{ color: theme.colors.textSecondary, fontWeight: "800" }}>{label}</Text>
      <Text style={{ color: theme.colors.textPrimary, fontWeight: "900", flex: 1, textAlign: "right" }}>{value}</Text>
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

function heroIcon(theme: AppTheme) {
  return {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    backgroundColor: theme.colors.imageOverlay,
    borderWidth: 1,
    borderColor: theme.colors.imageOverlayBorder
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

function tabStyle(active: boolean, theme: AppTheme) {
  return {
    flex: 1,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    minHeight: 42,
    borderRadius: theme.radius.pill,
    backgroundColor: active ? theme.colors.accent : theme.colors.surfaceAlt,
    borderWidth: 1,
    borderColor: active ? theme.colors.accent : theme.colors.cardBorder
  };
}

function smallPillStyle(active: boolean, theme: AppTheme) {
  return {
    minHeight: 38,
    justifyContent: "center" as const,
    borderRadius: theme.radius.pill,
    backgroundColor: active ? theme.colors.accent : theme.colors.surfaceAlt,
    borderWidth: 1,
    borderColor: active ? theme.colors.accent : theme.colors.cardBorder,
    paddingHorizontal: 13
  };
}

function isThisMonth(checkIn: BeerCheckIn) {
  const now = new Date();
  const date = new Date(checkIn.createdAt);
  return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
}

function formatMonthYear(iso: string) {
  return new Date(iso).toLocaleDateString([], { month: "short", year: "numeric" });
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });
}

function placeLine(activity: BeerCheckIn) {
  const brewery = activity.brewery?.trim();
  const location = broadPlaceLabel(activity.location);
  if (brewery && !["photo stamp", "beer log", "pintly log"].some((value) => brewery.toLowerCase().includes(value))) return `${brewery} · ${location}`;
  return location;
}

function photoFor(activity: BeerCheckIn) {
  return checkInPhotoUrl(activity, "feed");
}

function fullPhotoFor(activity: BeerCheckIn) {
  return checkInPhotoUrl(activity, "full") ?? photoFor(activity);
}
