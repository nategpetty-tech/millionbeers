import { Ionicons } from "@expo/vector-icons";
import { useScrollToTop } from "@react-navigation/native";
import { useRouter } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import type { ImageSourcePropType } from "react-native";
import { Animated, Easing, Image, ImageBackground, Pressable, RefreshControl, ScrollView, Text, useWindowDimensions, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Svg, { Circle } from "react-native-svg";
import { Avatar } from "@/components/Avatar";
import { CheckInModal } from "@/components/CheckInModal";
import { CommentButton, CommentsSheet } from "@/components/CommentsSheet";
import { PostDetailModal } from "@/components/PostDetailModal";
import { usePassport } from "@/store/passportStore";
import { AppTheme, useAppTheme } from "@/theme";
import { BeerCheckIn, BeerComment, Group, ModerationReportReason } from "@/types";
import { activityGroups, memberGroupIdSet, memberGroupsForUser, sortActivityNewestFirst, visibleActivity } from "@/utils/activityFeed";
import { broadPlaceLabel, formatNumber, timeAgo } from "@/utils/format";
import { GROUP_MILESTONE_TIERS } from "@/utils/groupMilestones";
import { groupPhotoFor } from "@/utils/groupVisuals";
import { checkInPhotoUrl } from "@/utils/photoUrls";
import { reactionUsersForCheckIn } from "@/utils/reactions";

type FeedFilter = "all" | "milestones";

type FeedItem =
  | {
      id: string;
      type: "log";
      createdAt: string;
      checkIn: BeerCheckIn;
      group: Group;
      groups: Group[];
    }
  | {
      id: string;
      type: "milestone";
      createdAt: string;
      group: Group;
      milestone: number;
    };

const MISSION_GOAL = 1000000;
const missionCardBackground = require("../../assets/mission-card-background.png");
const groupMilestoneBadges: Record<number, ImageSourcePropType> = {
  10: require("../../assets/group-milestones/group-milestone-10.png"),
  25: require("../../assets/group-milestones/group-milestone-25.png"),
  50: require("../../assets/group-milestones/group-milestone-50.png"),
  100: require("../../assets/group-milestones/group-milestone-100.png"),
  250: require("../../assets/group-milestones/group-milestone-250.png"),
  500: require("../../assets/group-milestones/group-milestone-500.png"),
  1000: require("../../assets/group-milestones/group-milestone-1000.png"),
  2500: require("../../assets/group-milestones/group-milestone-2500.png"),
  5000: require("../../assets/group-milestones/group-milestone-5000.png"),
  10000: require("../../assets/group-milestones/group-milestone-10000.png"),
  25000: require("../../assets/group-milestones/group-milestone-25000.png"),
  50000: require("../../assets/group-milestones/group-milestone-50000.png"),
  100000: require("../../assets/group-milestones/group-milestone-100000.png"),
  250000: require("../../assets/group-milestones/group-milestone-250000.png"),
  500000: require("../../assets/group-milestones/group-milestone-500000.png"),
  1000000: require("../../assets/group-milestones/group-milestone-1000000.png")
};

export default function JourneyScreen() {
  const theme = useAppTheme();
  const router = useRouter();
  const scrollRef = useRef<ScrollView>(null);
  const [checkInOpen, setCheckInOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<FeedFilter>("all");
  const [visibleActivityCount, setVisibleActivityCount] = useState(3);
  const { user, groups, globalCount, checkIns, blockedUserIds, initializeSeedData, reactToCheckIn, addCheckInComment, deleteCheckInComment, reportUser } = usePassport();
  const visibleCheckIns = useMemo(() => visibleActivity(checkIns, user.id, blockedUserIds), [blockedUserIds, checkIns, user.id]);
  const memberGroups = useMemo(() => memberGroupsForUser(groups, user.id), [groups, user.id]);
  const memberGroupIds = useMemo(() => memberGroupIdSet(groups, user.id), [groups, user.id]);
  const weeklyGroupLogs = useMemo(() => visibleCheckIns.filter((checkIn) => isRecent(checkIn.createdAt, 7) && checkIn.groupIds.some((groupId) => memberGroupIds.has(groupId))), [memberGroupIds, visibleCheckIns]);
  const todayGroupLogs = useMemo(() => visibleCheckIns.filter((checkIn) => isToday(checkIn.createdAt) && checkIn.groupIds.some((groupId) => memberGroupIds.has(groupId))), [memberGroupIds, visibleCheckIns]);
  const pulseMetrics = useMemo(() => buildPulseMetrics(memberGroups, weeklyGroupLogs, todayGroupLogs), [memberGroups, todayGroupLogs, weeklyGroupLogs]);
  const feedItems = useMemo(() => buildFeedItems(visibleCheckIns, groups, memberGroupIds), [groups, memberGroupIds, visibleCheckIns]);
  const filteredFeed = useMemo(() => {
    if (filter === "milestones") return feedItems.filter((item) => item.type === "milestone");
    return feedItems;
  }, [feedItems, filter]);
  const visibleFeed = filteredFeed.slice(0, visibleActivityCount);
  const hasMoreActivity = visibleActivityCount < filteredFeed.length;

  useScrollToTop(scrollRef);

  useEffect(() => {
    void initializeSeedData();
    const interval = setInterval(() => {
      void initializeSeedData();
    }, 60000);
    return () => clearInterval(interval);
  }, [initializeSeedData]);

  useEffect(() => {
    setVisibleActivityCount(3);
  }, [filter]);

  async function refreshNow() {
    setRefreshing(true);
    try {
      await initializeSeedData();
    } finally {
      setRefreshing(false);
    }
  }

  function openMemberProfile(groupId: string, targetUserId: string) {
    router.push({ pathname: "/member-profile", params: { groupId, userId: targetUserId } });
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
              <Text style={{ color: theme.colors.textPrimary, fontSize: 38, fontWeight: "900", marginTop: 6 }}>Home</Text>
            </View>
          </View>
        </View>

        <View style={{ paddingHorizontal: 20, gap: 20 }}>
          <MissionProgressCard count={globalCount} theme={theme} />

          <Pressable
            onPress={() => setCheckInOpen(true)}
            style={({ pressed }) => ({
              opacity: pressed ? 0.84 : 1,
              minHeight: 56,
              backgroundColor: theme.colors.accent,
              borderRadius: theme.radius.md,
              alignItems: "center",
              justifyContent: "center",
              flexDirection: "row",
              gap: 10,
              ...theme.shadow.button
            })}
          >
            <Ionicons name="camera-outline" color={theme.colors.textOnPrimary} size={23} />
            <Text style={{ color: theme.colors.textOnPrimary, fontSize: 17, fontWeight: "900" }}>Log a Beer</Text>
          </Pressable>

          <View style={{ gap: 12 }}>
            <SectionHeader title="Group Activity" theme={theme} />
            <FeedFilterBar value={filter} onChange={setFilter} theme={theme} />
            {filteredFeed.length ? (
              <View style={{ gap: 12 }}>
                {visibleFeed.map((item) => (
                  <FeedCard
                    key={item.id}
                    item={item}
                    currentUserId={user.id}
                    onReact={reactToCheckIn}
                    onAddComment={addCheckInComment}
                    onDeleteComment={deleteCheckInComment}
                    onReportComment={reportUser}
                    onUserPress={openMemberProfile}
                    theme={theme}
                  />
                ))}
                {hasMoreActivity ? (
                  <Pressable onPress={() => setVisibleActivityCount((count) => Math.min(count + 3, filteredFeed.length))} style={activityToggleStyle(theme)}>
                    <Text style={{ color: theme.colors.accent, fontWeight: "900" }}>View more</Text>
                    <Ionicons name="chevron-down" color={theme.colors.accent} size={18} />
                  </Pressable>
                ) : null}
              </View>
            ) : (
              <EmptyCard
                icon="albums-outline"
                title={memberGroups.length ? "No group activity yet" : "Group activity will appear here once you join or create a group."}
                body={memberGroups.length ? "Logs and milestones from your groups will show up here." : "Create or join a group to turn Home into your live community hub."}
                actionLabel="Go to Groups"
                onAction={() => router.push("/groups")}
                theme={theme}
              />
            )}
          </View>

          <View style={{ gap: 12 }}>
            <SectionHeader title="Community Pulse" theme={theme} />
            {memberGroups.length ? (
              <CommunityPulseBar metrics={pulseMetrics} theme={theme} />
            ) : (
              <EmptyCard
                icon="people-outline"
                title="Join a group to see your community pulse."
                body="Group activity will appear here once you join or create a group."
                actionLabel="Browse Groups"
                onAction={() => router.push("/groups")}
                theme={theme}
              />
            )}
          </View>
        </View>
      </ScrollView>
      <CheckInModal visible={checkInOpen} onClose={() => setCheckInOpen(false)} />
    </SafeAreaView>
  );
}

const filterOptions: Array<{ label: string; value: FeedFilter }> = [
  { label: "All Activity", value: "all" },
  { label: "Milestones", value: "milestones" }
];

function buildPulseMetrics(memberGroups: Group[], weeklyLogs: BeerCheckIn[], todayLogs: BeerCheckIn[]) {
  const activeToday = new Set(todayLogs.flatMap((log) => log.groupIds).filter((groupId) => memberGroups.some((group) => group.id === groupId))).size;
  return [
    {
      id: "week",
      icon: "people-outline" as const,
      value: weeklyLogs.length,
      label: "beers contributed by your groups in the last 7 days"
    },
    {
      id: "today",
      icon: "radio-outline" as const,
      value: activeToday,
      label: "groups active today"
    },
    {
      id: "beers-today",
      icon: "beer-outline" as const,
      value: todayLogs.length,
      label: "beers logged across groups today"
    }
  ];
}

function buildFeedItems(checkIns: BeerCheckIn[], groups: Group[], memberGroupIds: Set<string>): FeedItem[] {
  const logsWithGroups: FeedItem[] = checkIns
    .flatMap((checkIn) => {
      const logGroups = activityGroups(checkIn, groups, memberGroupIds);
      const primaryGroup = logGroups[0];
      if (!primaryGroup) return [];
      return [{
        id: `log-${checkIn.id}`,
        type: "log" as const,
        createdAt: checkIn.createdAt,
        checkIn,
        group: primaryGroup,
        groups: logGroups
      }];
    });

  const milestoneItems: FeedItem[] = groups
    .filter((group) => memberGroupIds.has(group.id))
    .flatMap((group) => {
      const groupLogs = checkIns
        .filter((checkIn) => checkIn.groupIds.includes(group.id))
        .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
      if (!groupLogs.length) return [];

      const groupLogTotal = groupLogs.reduce((total, checkIn) => total + (checkIn.quantity ?? 1), 0);
      let runningBeerCount = Math.max(0, group.beerCount - groupLogTotal);

      return groupLogs.flatMap((checkIn) => {
        const previousBeerCount = runningBeerCount;
        runningBeerCount += checkIn.quantity ?? 1;
        return crossedMilestones(previousBeerCount, runningBeerCount).map((milestone) => ({
          id: `milestone-${group.id}-${milestone}`,
          type: "milestone" as const,
          createdAt: checkIn.createdAt,
          group,
          milestone
        }));
      });
    });

  const allItems = [...logsWithGroups, ...milestoneItems];
  return sortActivityNewestFirst(allItems);
}

function MissionProgressCard({ count, theme }: { count: number | null | undefined; theme: AppTheme }) {
  const { width } = useWindowDimensions();
  const currentCount = Math.max(0, Number.isFinite(Number(count)) ? Number(count) : 0);
  const remaining = Math.max(MISSION_GOAL - currentCount, 0);
  const progress = Math.min(currentCount / MISSION_GOAL, 1);
  const visualProgress = progress > 0 ? Math.max(progress, 0.025) : 0;
  const progressFill = `${Math.min(100, visualProgress * 100)}%` as const;
  const countText = currentCount.toLocaleString();
  const goalText = MISSION_GOAL.toLocaleString();
  const remainingText = `${remaining.toLocaleString()} to go`;
  const percentText = formatMissionPercent(progress * 100);
  const countFontSize = Math.max(42, Math.min(64, width * 0.145));
  const ringSize = width < 380 ? 86 : 96;
  const accessibilityLabel = `Global beer count, ${countText} of ${goalText} beers logged, ${remainingText}.`;

  return (
    <ImageBackground
      source={missionCardBackground}
      resizeMode="cover"
      imageStyle={{ borderRadius: 28 }}
      accessibilityRole="summary"
      accessibilityLabel={accessibilityLabel}
      style={{
        minHeight: 204,
        borderRadius: 28,
        overflow: "hidden",
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.12)",
        shadowColor: "#071225",
        shadowOpacity: 0.34,
        shadowRadius: 24,
        shadowOffset: { width: 0, height: 14 },
        elevation: 8
      }}
    >
      <View style={{ minHeight: 204, padding: 20 }}>
        <View pointerEvents="none" style={{ position: "absolute", left: -46, bottom: -52, width: 160, height: 160, borderRadius: 80, backgroundColor: "rgba(15,118,110,0.18)" }} />
        <View pointerEvents="none" style={{ position: "absolute", inset: 1, borderRadius: 27, borderWidth: 1, borderColor: "rgba(255,255,255,0.10)" }} />

        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <View style={{ width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.10)", borderWidth: 1, borderColor: "rgba(255,255,255,0.12)" }}>
            <Ionicons name="globe-outline" color={theme.colors.accent} size={18} />
          </View>
          <Text style={{ color: "rgba(255,255,255,0.78)", fontSize: 12, fontWeight: "900", letterSpacing: 1.5 }}>GLOBAL BEER COUNT</Text>
        </View>

        <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginTop: 18 }}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.66} style={{ color: "#FFFFFF", fontSize: countFontSize, fontWeight: "900", letterSpacing: 0 }}>
              {countText}
              <Text style={{ color: "rgba(255,255,255,0.56)", fontSize: Math.max(20, countFontSize * 0.38), fontWeight: "900" }}> / {goalText}</Text>
            </Text>
            <Text style={{ color: "rgba(255,255,255,0.68)", fontSize: 14, fontWeight: "800", marginTop: 2 }}>{remainingText}</Text>
          </View>
          <MissionRing size={ringSize} progress={progress} percentText={percentText} theme={theme} />
        </View>

        <View style={{ marginTop: 18 }}>
          <View style={{ height: 10, borderRadius: 999, overflow: "hidden", backgroundColor: "rgba(255,255,255,0.16)", borderWidth: 1, borderColor: "rgba(255,255,255,0.10)" }}>
            <View
              style={{
                width: progressFill,
                minWidth: progress > 0 ? 22 : 0,
                height: "100%",
                borderRadius: 999,
                backgroundColor: theme.colors.accent,
                shadowColor: theme.colors.accent,
                shadowOpacity: 0.7,
                shadowRadius: 10,
                shadowOffset: { width: 0, height: 0 }
              }}
            />
          </View>
          <Text style={{ color: "rgba(255,255,255,0.52)", fontSize: 11, fontWeight: "800", marginTop: 10 }}>Logged by the Pintly community</Text>
        </View>
      </View>
    </ImageBackground>
  );
}

function MissionRing({ size, progress, percentText, theme }: { size: number; progress: number; percentText: string; theme: AppTheme }) {
  const strokeWidth = 10;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const visualProgress = progress > 0 ? Math.max(progress, 0.025) : 0;
  const strokeDashoffset = circumference * (1 - visualProgress);

  return (
    <View style={{ width: size, alignItems: "center" }} accessible accessibilityLabel={`${percentText} complete`}>
      <View
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "rgba(7,18,37,0.42)"
        }}
      >
        <Svg width={size} height={size} style={{ position: "absolute" }}>
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke="rgba(255,255,255,0.14)"
            strokeWidth={strokeWidth}
            fill="transparent"
          />
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={theme.colors.accent}
            strokeWidth={strokeWidth}
            fill="transparent"
            strokeLinecap="round"
            strokeDasharray={`${circumference} ${circumference}`}
            strokeDashoffset={strokeDashoffset}
            originX={size / 2}
            originY={size / 2}
            rotation="-90"
          />
        </Svg>
        <View style={{ alignItems: "center", justifyContent: "center", width: size - 18 }}>
          <Text numberOfLines={1} adjustsFontSizeToFit style={{ color: "#FFFFFF", fontSize: size < 90 ? 17 : 20, fontWeight: "900", textAlign: "center", width: "100%" }}>{percentText}</Text>
          <Text style={{ color: "rgba(255,255,255,0.58)", fontSize: 11, fontWeight: "800", marginTop: 1, textAlign: "center" }}>complete</Text>
        </View>
      </View>
    </View>
  );
}

function SparkleCluster() {
  return (
    <View pointerEvents="none">
      <Text style={{ position: "absolute", right: 116, top: 48, color: "rgba(255,255,255,0.22)", fontSize: 13 }}>✦</Text>
      <Text style={{ position: "absolute", right: 28, top: 25, color: "rgba(245,158,11,0.36)", fontSize: 16 }}>✶</Text>
      <View style={{ position: "absolute", left: 26, top: 78, width: 5, height: 5, borderRadius: 2.5, backgroundColor: "rgba(255,255,255,0.22)" }} />
      <View style={{ position: "absolute", right: 152, bottom: 34, width: 22, height: 4, borderRadius: 2, transform: [{ rotate: "-18deg" }], backgroundColor: "rgba(245,158,11,0.24)" }} />
      <View style={{ position: "absolute", right: 66, bottom: 22, width: 5, height: 5, borderRadius: 2.5, backgroundColor: "rgba(245,158,11,0.38)" }} />
    </View>
  );
}

function formatMissionPercent(percentValue: number) {
  if (percentValue === 0) return "0%";
  return `${percentValue.toFixed(2)}%`;
}

function FeedCard({
  item,
  currentUserId,
  onReact,
  onAddComment,
  onDeleteComment,
  onReportComment,
  onUserPress,
  theme
}: {
  item: FeedItem;
  currentUserId: string;
  onReact: (id: string) => void;
  onAddComment: (checkInId: string, body: string) => void;
  onDeleteComment: (checkInId: string, commentId: string) => void;
  onReportComment: (input: { reportedUserId: string; checkInId?: string; groupId?: string; reason: ModerationReportReason; details?: string }) => void;
  onUserPress: (groupId: string, userId: string) => void;
  theme: AppTheme;
}) {
  if (item.type === "milestone") {
    const badgeSource = groupMilestoneBadges[item.milestone];
    return (
      <View style={cardStyle(theme, 12, theme.radius.lg)}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <View style={{ width: 68, height: 74, alignItems: "center", justifyContent: "center", flexShrink: 0, marginLeft: -2 }}>
            {badgeSource ? (
              <Image source={badgeSource} style={{ width: "100%", height: "100%" }} resizeMode="contain" />
            ) : (
              <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: theme.colors.accentSoft, alignItems: "center", justifyContent: "center" }}>
                <Ionicons name="ribbon-outline" color={theme.colors.accent} size={24} />
              </View>
            )}
          </View>
          <View style={{ flex: 1 }}>
            <Text numberOfLines={2} style={{ color: theme.colors.textPrimary, fontWeight: "900", fontSize: 15, lineHeight: 20 }}>{item.group.name} reached {formatNumber(item.milestone)} beers!</Text>
            <Text style={{ color: theme.colors.textSecondary, marginTop: 3, lineHeight: 18, fontSize: 13 }}>Milestone badge unlocked.</Text>
            <Text style={{ color: theme.colors.textMuted, marginTop: 4, fontSize: 12 }}>{timeAgo(item.createdAt)}</Text>
          </View>
        </View>
      </View>
    );
  }

  return (
    <LogFeedCard
      item={item}
      currentUserId={currentUserId}
      onReact={onReact}
      onAddComment={onAddComment}
      onDeleteComment={onDeleteComment}
      onReportComment={onReportComment}
      onUserPress={onUserPress}
      theme={theme}
    />
  );
}

function LogFeedCard({
  item,
  currentUserId,
  onReact,
  onAddComment,
  onDeleteComment,
  onReportComment,
  onUserPress,
  theme
}: {
  item: Extract<FeedItem, { type: "log" }>;
  currentUserId: string;
  onReact: (id: string) => void;
  onAddComment: (checkInId: string, body: string) => void;
  onDeleteComment: (checkInId: string, commentId: string) => void;
  onReportComment: (input: { reportedUserId: string; checkInId?: string; groupId?: string; reason: ModerationReportReason; details?: string }) => void;
  onUserPress: (groupId: string, userId: string) => void;
  theme: AppTheme;
}) {
  const [postDetailOpen, setPostDetailOpen] = useState(false);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);
  const photo = photoFor(item.checkIn);
  const fullPhoto = checkInPhotoUrl(item.checkIn, "full") ?? photo;
  const reacted = item.checkIn.reactedBy.includes(currentUserId);
  const reactionUsers = reactionUsersForCheckIn(item.checkIn, currentUserId);
  const lastPostTap = useRef(0);
  const lastPhotoTap = useRef(0);
  const singleTapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (singleTapTimer.current) clearTimeout(singleTapTimer.current);
    };
  }, []);

  function likeFromDoubleTap() {
    if (!reacted) onReact(item.checkIn.id);
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
    onReact(item.checkIn.id);
  }

  return (
    <Pressable onPress={handlePostPress} style={cardStyle(theme, 11, theme.radius.lg)}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        <ActorAvatar checkIn={item.checkIn} onPress={() => onUserPress(item.group.id, item.checkIn.userId)} theme={theme} />
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 5 }}>
            <Pressable
              onPress={(event) => {
                event.stopPropagation();
                onUserPress(item.group.id, item.checkIn.userId);
              }}
              hitSlop={2}
              style={({ pressed }) => ({ opacity: pressed ? 0.72 : 1 })}
            >
              <Text style={{ color: theme.colors.textPrimary, fontWeight: "900", fontSize: 15, lineHeight: 19 }}>{item.checkIn.userName}</Text>
            </Pressable>
            <Text style={{ color: theme.colors.textSecondary, fontWeight: "800", fontSize: 15, lineHeight: 19 }}>logged a beer</Text>
          </View>
          <Text numberOfLines={1} style={{ color: theme.colors.textSecondary, marginTop: 3, fontSize: 13, lineHeight: 17 }}>{locationLabel(item.checkIn)}</Text>
          <FeedMeta
            time={item.createdAt}
            likes={item.checkIn.reactions}
            comments={item.checkIn.comments.length}
            reacted={reacted}
            onReact={handleReactPress}
            onCommentsPress={() => setCommentsOpen(true)}
            theme={theme}
          />
        </View>
        <PhotoThumb photo={photo} onPress={handlePhotoPress} onError={() => setImageFailed(true)} theme={theme} />
      </View>
      {item.checkIn.note ? <CaptionText text={item.checkIn.note} theme={theme} /> : null}
      <PostDetailModal
        visible={postDetailOpen}
        checkIn={item.checkIn}
        currentUserId={currentUserId}
        photoUri={!imageFailed ? fullPhoto : undefined}
        reacted={reacted}
        reactionUsers={reactionUsers}
        onReact={onReact}
        onAddComment={onAddComment}
        onDeleteComment={onDeleteComment}
        onReportComment={({ comment, reason, details }) =>
          onReportComment({
            reportedUserId: comment.userId,
            checkInId: item.checkIn.id,
            groupId: item.group.id,
            reason,
            details
          })
        }
        onUserPress={(userId) => onUserPress(item.group.id, userId)}
        onClose={() => setPostDetailOpen(false)}
        theme={theme}
      />
      <CommentsSheet
        visible={commentsOpen}
        checkIn={item.checkIn}
        currentUserId={currentUserId}
        onAddComment={onAddComment}
        onDeleteComment={onDeleteComment}
        onReportComment={({ comment, reason, details }: { comment: BeerComment; reason: ModerationReportReason; details: string }) =>
          onReportComment({
            reportedUserId: comment.userId,
            checkInId: item.checkIn.id,
            groupId: item.group.id,
            reason,
            details
          })
        }
        onUserPress={(userId) => onUserPress(item.group.id, userId)}
        onClose={() => setCommentsOpen(false)}
        theme={theme}
      />
    </Pressable>
  );
}

function ActorAvatar({ checkIn, onPress, theme }: { checkIn: BeerCheckIn; onPress: () => void; theme: AppTheme }) {
  return (
    <Pressable
      onPress={(event) => {
        event.stopPropagation();
        onPress();
      }}
      hitSlop={2}
      style={({ pressed }) => ({ opacity: pressed ? 0.76 : 1 })}
    >
      <Avatar label={checkIn.userAvatar} uri={checkIn.userAvatarUrl} size={40} borderColor={theme.colors.cardBorder} />
    </Pressable>
  );
}

function CaptionText({ text, theme }: { text: string; theme: AppTheme }) {
  return (
    <View style={{ marginTop: 10, borderRadius: theme.radius.md, backgroundColor: theme.colors.surfaceAlt, paddingHorizontal: 10, paddingVertical: 8 }}>
      <Text style={{ color: theme.colors.textPrimary, fontSize: 14, lineHeight: 20, fontWeight: "700" }}>{text}</Text>
    </View>
  );
}

function CommunityPulseBar({
  metrics,
  theme
}: {
  metrics: Array<{ id: string; icon: keyof typeof Ionicons.glyphMap; value: number; label: string }>;
  theme: AppTheme;
}) {
  return (
    <View style={{ flexDirection: "row", gap: 8 }}>
      {metrics.map((metric) => (
        <View
          key={metric.id}
          style={{
            ...cardStyle(theme, 0, theme.radius.lg),
            flex: 1,
            minHeight: 104,
            paddingHorizontal: 10,
            paddingVertical: 14
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Ionicons name={metric.icon} color={theme.colors.accent} size={22} />
            <Text style={{ color: theme.colors.textPrimary, fontWeight: "900", fontSize: 24 }}>{metric.value}</Text>
          </View>
          <Text style={{ color: theme.colors.textSecondary, fontSize: 12, lineHeight: 17, marginTop: 8 }}>{metric.label}</Text>
        </View>
      ))}
    </View>
  );
}

function MutedGlobe({ theme }: { theme: AppTheme }) {
  return (
    <View pointerEvents="none" style={{ position: "absolute", right: -52, top: 16, width: 176, height: 176, borderRadius: 88, opacity: theme.mode === "light" ? 0.2 : 0.11 }}>
      <View style={{ position: "absolute", inset: 5, borderRadius: 83, borderWidth: 2, borderColor: theme.colors.accentSoft }} />
      <Ionicons name="earth" color={theme.colors.accent} size={154} style={{ position: "absolute", right: 8, top: 10 }} />
    </View>
  );
}

function FeedFilterBar({ value, onChange, theme }: { value: FeedFilter; onChange: (value: FeedFilter) => void; theme: AppTheme }) {
  const [barWidth, setBarWidth] = useState(0);
  const selectionProgress = useRef(new Animated.Value(value === "milestones" ? 1 : 0)).current;
  const activeIndex = value === "milestones" ? 1 : 0;
  const activeWidth = Math.max(0, (barWidth - 8) / filterOptions.length);
  const translateX = selectionProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, activeWidth]
  });

  useEffect(() => {
    Animated.timing(selectionProgress, {
      toValue: activeIndex,
      duration: 220,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true
    }).start();
  }, [activeIndex, selectionProgress]);

  return (
    <View
      onLayout={(event) => setBarWidth(event.nativeEvent.layout.width)}
      style={{
        minHeight: 44,
        flexDirection: "row",
        padding: 4,
        borderRadius: theme.radius.pill,
        backgroundColor: theme.colors.surfaceAlt,
        borderWidth: 1,
        borderColor: theme.colors.cardBorder
      }}
    >
      {activeWidth > 0 ? (
        <Animated.View
          pointerEvents="none"
          style={{
            position: "absolute",
            left: 4,
            top: 4,
            width: activeWidth,
            bottom: 4,
            borderRadius: theme.radius.pill,
            backgroundColor: theme.colors.accent,
            transform: [{ translateX }]
          }}
        />
      ) : null}
      {filterOptions.map((option) => {
        const active = value === option.value;
        return (
          <Pressable
            key={option.value}
            onPress={() => onChange(option.value)}
            style={{
              flex: 1,
              minHeight: 34,
              alignItems: "center",
              justifyContent: "center",
              borderRadius: theme.radius.pill
            }}
          >
            <Text style={{ color: active ? theme.colors.textOnPrimary : theme.colors.textSecondary, fontWeight: "900", fontSize: 12 }}>{option.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function SectionHeader({ title, detail, theme }: { title: string; detail?: string; theme: AppTheme }) {
  return (
    <View>
      <Text style={{ color: theme.colors.textPrimary, fontSize: 21, fontWeight: "900" }}>{title}</Text>
      {detail ? <Text style={{ color: theme.colors.textSecondary, marginTop: 4, lineHeight: 19 }}>{detail}</Text> : null}
    </View>
  );
}

function activityToggleStyle(theme: AppTheme) {
  return {
    minHeight: 46,
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    borderColor: theme.colors.cardBorder,
    backgroundColor: theme.colors.surfaceAlt,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    flexDirection: "row" as const,
    gap: 6
  };
}

function EmptyCard({
  icon,
  title,
  body,
  actionLabel,
  onAction,
  theme
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  body: string;
  actionLabel?: string;
  onAction?: () => void;
  theme: AppTheme;
}) {
  return (
    <View style={cardStyle(theme, 18, theme.radius.lg)}>
      <View style={{ flexDirection: "row", gap: 13 }}>
        <View style={{ width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", backgroundColor: theme.colors.accentSoft }}>
          <Ionicons name={icon} color={theme.colors.accent} size={21} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ color: theme.colors.textPrimary, fontWeight: "900", fontSize: 16 }}>{title}</Text>
          <Text style={{ color: theme.colors.textSecondary, marginTop: 5, lineHeight: 20 }}>{body}</Text>
          {actionLabel && onAction ? (
            <Pressable onPress={onAction} style={{ alignSelf: "flex-start", marginTop: 13, borderRadius: theme.radius.pill, backgroundColor: theme.colors.accent, paddingHorizontal: 14, paddingVertical: 10 }}>
              <Text style={{ color: theme.colors.textOnPrimary, fontWeight: "900" }}>{actionLabel}</Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    </View>
  );
}

function FeedMeta({
  time,
  likes,
  comments,
  reacted,
  onReact,
  onCommentsPress,
  theme
}: {
  time: string;
  likes: number;
  comments: number;
  reacted?: boolean;
  onReact?: () => void;
  onCommentsPress?: () => void;
  theme: AppTheme;
}) {
  const likeColor = reacted ? theme.colors.error : theme.colors.textPrimary;
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 7 }}>
      <Text style={{ color: theme.colors.textMuted, fontSize: 12, fontWeight: "800" }}>{timeAgo(time)}</Text>
      <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: theme.colors.textMuted }} />
      <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
        {onReact ? (
          <Pressable
            onPress={(event) => {
              event.stopPropagation();
              onReact();
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
              borderRadius: theme.radius.pill,
              backgroundColor: theme.colors.card,
              paddingHorizontal: 12,
              opacity: pressed ? 0.72 : 1
            })}
          >
            <View style={{ height: 40, justifyContent: "center" }}>
              <Ionicons name={reacted ? "heart" : "heart-outline"} color={likeColor} size={18} />
            </View>
            <View style={{ height: 40, justifyContent: "center", minWidth: 22 }}>
              <Text style={{ color: likeColor, fontWeight: "900", fontSize: 13 }}>{likes}</Text>
            </View>
          </Pressable>
        ) : (
          <View style={{ height: 36, minWidth: 52, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5, borderRadius: theme.radius.pill, backgroundColor: theme.colors.card, paddingHorizontal: 11 }}>
            <Ionicons name="heart-outline" color={likeColor} size={18} />
            <Text style={{ color: likeColor, fontWeight: "900", fontSize: 13 }}>{likes}</Text>
          </View>
        )}
        {onCommentsPress ? <CommentButton count={comments} onPress={onCommentsPress} theme={theme} compact /> : null}
      </View>
    </View>
  );
}

function GroupMark({ group, theme }: { group: Group; theme: AppTheme }) {
  const [imageFailed, setImageFailed] = useState(false);
  const initials = group.name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  const image = group.backdropUrl ?? groupPhotoFor(group.name);
  return (
    <View style={{ width: 48, height: 48, borderRadius: 17, backgroundColor: theme.colors.accentSoft, overflow: "hidden", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: theme.colors.cardBorder }}>
      {!imageFailed ? (
        <Image source={{ uri: image }} onError={() => setImageFailed(true)} style={{ width: "100%", height: "100%" }} resizeMode="cover" />
      ) : (
        <Text style={{ color: theme.colors.accent, fontWeight: "900" }}>{initials || "PG"}</Text>
      )}
    </View>
  );
}

function PhotoThumb({ photo, onPress, onError, theme }: { photo?: string; onPress: () => void; onError: () => void; theme: AppTheme }) {
  if (photo) {
    return (
      <Pressable onPress={onPress} style={({ pressed }) => ({ opacity: pressed ? 0.82 : 1 })}>
        <Image source={{ uri: photo }} onError={onError} style={{ width: 52, height: 58, borderRadius: 12, backgroundColor: theme.colors.surfaceAlt }} resizeMode="cover" />
      </Pressable>
    );
  }
  return (
    <View style={{ width: 52, height: 58, borderRadius: 12, backgroundColor: theme.colors.surfaceAlt, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: theme.colors.cardBorder }}>
      <Ionicons name="beer-outline" color={theme.colors.accent} size={22} />
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

function photoFor(log: BeerCheckIn) {
  return checkInPhotoUrl(log, "feed");
}

function locationLabel(log: BeerCheckIn) {
  const brewery = log.brewery?.trim();
  const location = broadPlaceLabel(log.location);
  if (brewery && !isGenericPlaceLabel(brewery)) {
    const normalizedBrewery = normalizePlaceText(brewery);
    const normalizedLocation = normalizePlaceText(location);
    if (normalizedBrewery === normalizedLocation || normalizedLocation.startsWith(`${normalizedBrewery},`)) return location;
    return `${brewery}, ${location}`;
  }
  return location;
}

function isGenericPlaceLabel(value: string) {
  const normalized = value.trim().toLowerCase();
  return ["photo stamp", "beer log", "pintly log", "check-in"].some((generic) => normalized.includes(generic));
}

function normalizePlaceText(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function crossedMilestones(previousValue: number, nextValue: number) {
  return GROUP_MILESTONE_TIERS.filter((milestone) => previousValue < milestone && nextValue >= milestone);
}

function isRecent(iso: string, days: number) {
  return new Date(iso).getTime() >= Date.now() - days * 24 * 60 * 60 * 1000;
}

function isToday(iso: string) {
  return localDateKey(iso) === localDateKey(new Date().toISOString());
}

function localDateKey(iso: string) {
  const date = new Date(iso);
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}
