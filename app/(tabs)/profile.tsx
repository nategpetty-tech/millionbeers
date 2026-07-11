import { Ionicons } from "@expo/vector-icons";
import Constants from "expo-constants";
import { useRouter } from "expo-router";
import * as Updates from "expo-updates";
import { useMemo, useRef, useState } from "react";
import { Alert, Image, type ImageSourcePropType, Modal, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Avatar } from "@/components/Avatar";
import { BadgeIcon } from "@/components/BadgeIcon";
import { ChallengeCard } from "@/components/ChallengeCard";
import { ProgressBar } from "@/components/ProgressBar";
import { ProfileModal } from "@/components/ProfileModal";
import { SectionTitle } from "@/components/SectionTitle";
import { ZoomablePhotoModal } from "@/components/ZoomablePhotoModal";
import { useAuth } from "@/store/authStore";
import { usePassport } from "@/store/passportStore";
import { AppTheme, ThemePreference, theme as staticTheme, useThemePreference } from "@/theme";
import { Badge, BeerCheckIn, Challenge } from "@/types";
import { broadPlaceLabel, formatNumber } from "@/utils/format";
import { checkInPhotoUrl } from "@/utils/photoUrls";
import { profileBorderDrinkerLabel, profileBorderForBeerCount, profileBorderFrameSize, profileBorderProgress } from "@/utils/profileBorders";

type Memory = {
  id: string;
  date: Date;
  title: string;
  locationSummary: string;
  beerCount: number;
  photos: string[];
  checkIns: BeerCheckIn[];
};

const profileStatIcons = {
  beers: require("../../assets/profile/stat-beer.png"),
  locations: require("../../assets/profile/stat-map.png"),
  groups: require("../../assets/profile/stat-groups.png"),
  badges: require("../../assets/profile/stat-badges.png")
} satisfies Record<string, ImageSourcePropType>;

type AppDiagnostic = {
  label: string;
  value: string;
};

export default function ProfileScreen() {
  const [profileOpen, setProfileOpen] = useState(false);
  const [profileInitialFocus, setProfileInitialFocus] = useState<"favoriteBeer" | undefined>();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [selectedStamp, setSelectedStamp] = useState<Challenge | null>(null);
  const [selectedMemory, setSelectedMemory] = useState<Memory | null>(null);
  const [selectedAvatarUri, setSelectedAvatarUri] = useState<string | null>(null);
  const [visibleMonth, setVisibleMonth] = useState(() => startOfMonth(new Date()));
  const scrollViewRef = useRef<ScrollView>(null);
  const router = useRouter();
  const memoryYById = useRef(new Map<string, number>());
  const recentMemoriesY = useRef(0);
  const { signOut } = useAuth();
  const { preference, setPreference, theme } = useThemePreference();
  const { user, groups, checkIns, challenges, badges, globalUserRank, initializeSeedData, deleteAccount } = usePassport();
  const personalLogs = useMemo(
    () => checkIns.filter((item) => item.userId === user.id).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [checkIns, user.id]
  );
  const memberGroups = useMemo(() => groups.filter((group) => group.members.some((member) => member.userId === user.id)), [groups, user.id]);
  const memories = useMemo(() => buildMemories(personalLogs), [personalLogs]);
  const monthLogs = useMemo(() => logsForMonth(personalLogs, visibleMonth), [personalLogs, visibleMonth]);
  const completed = challenges.filter((challenge) => challenge.current >= challenge.goal).length;
  const completedStamps = challenges.filter((challenge) => challenge.current >= challenge.goal);
  const activeChallenges = challenges.filter((challenge) => challenge.current < challenge.goal);
  const monthSummary = getMonthSummary(monthLogs);
  const topPercent = globalUserRank?.topPercent ?? getTopUserPercentile(memberGroups, user.id, user.totalBeers);

  function openMemoryFromCalendar(date: Date) {
    const key = localDateKey(date);
    const memory = memories.find((item) => item.id === key);
    if (!memory) return;
    const y = memoryYById.current.get(memory.id) ?? recentMemoriesY.current;
    scrollViewRef.current?.scrollTo({ y: Math.max(0, y - 12), animated: true });
    setTimeout(() => setSelectedMemory(memory), 260);
  }

  function handleDeleteAccount() {
    Alert.alert("Delete account?", "This permanently deletes your Pintly account. Your group contributions may remain as anonymized totals.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete account",
        style: "destructive",
        onPress: () => {
          void deleteAccount()
            .then(() => signOut())
            .catch(() => Alert.alert("Could not delete account", "Try again in a moment or contact support."));
        }
      }
    ]);
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <ScrollView ref={scrollViewRef} contentContainerStyle={{ paddingBottom: 124 }}>
        <View style={{ paddingHorizontal: 22, paddingTop: 14, paddingBottom: 8 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 16 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: theme.colors.accent, fontSize: 12, fontWeight: "900", letterSpacing: 2 }}>PINTLY</Text>
              <Text numberOfLines={2} style={{ color: theme.colors.textPrimary, fontSize: 38, lineHeight: 42, fontWeight: "900", marginTop: 6 }}>
                {user.name || "Pintly User"}
              </Text>
            </View>
            <View style={{ flexDirection: "row", gap: 8 }}>
              <IconButton
                icon="create-outline"
                label="Edit profile"
                onPress={() => {
                  setProfileInitialFocus(undefined);
                  setProfileOpen(true);
                }}
                theme={theme}
              />
              <IconButton icon="settings-outline" label="Profile settings" onPress={() => setSettingsOpen(true)} theme={theme} />
            </View>
          </View>
        </View>

        <View style={{ paddingHorizontal: 20, gap: 24 }}>
          <IdentityCard
            user={user}
            topPercent={topPercent}
            onAvatarPress={user.avatarUrl ? () => setSelectedAvatarUri(user.avatarUrl ?? null) : undefined}
            onFavoriteBeerPress={() => {
              setProfileInitialFocus("favoriteBeer");
              setProfileOpen(true);
            }}
            theme={theme}
          />

          <ProfileStatsRail
            stats={[
              { image: profileStatIcons.beers, label: "Beers Logged", value: formatNumber(user.totalBeers) },
              { image: profileStatIcons.locations, label: "Stamp Locations", value: countUniqueStampLocations(personalLogs) },
              { image: profileStatIcons.groups, label: "Groups", value: memberGroups.length },
              { image: profileStatIcons.badges, label: "Badges", value: user.badges.length || completedStamps.length }
            ]}
            theme={theme}
          />

          <JourneyCard
            month={visibleMonth}
            logs={monthLogs}
            summary={monthSummary}
            onPrevious={() => setVisibleMonth(addMonths(visibleMonth, -1))}
            onNext={() => setVisibleMonth(addMonths(visibleMonth, 1))}
            onSelectDate={openMemoryFromCalendar}
            theme={theme}
          />

          <View
            style={{ gap: 12 }}
            onLayout={(event) => {
              recentMemoriesY.current = event.nativeEvent.layout.y;
            }}
          >
            <SectionTitle title="Recent Memories" detail="Photos and places gathered into day-level moments." />
            {memories.length ? (
              memories.slice(0, 5).map((memory) => (
                <View
                  key={memory.id}
                  onLayout={(event) => {
                    memoryYById.current.set(memory.id, recentMemoriesY.current + event.nativeEvent.layout.y);
                  }}
                >
                  <MemoryCard memory={memory} onPress={() => setSelectedMemory(memory)} theme={theme} />
                </View>
              ))
            ) : (
              <EmptyProfileCard title="No memories yet" body="Use Log Beer to create your first Pintly memory." icon="images-outline" theme={theme} />
            )}
          </View>

          <View style={{ gap: 12 }}>
            <SectionTitle title="Challenges" detail="Optional goals and milestones you are working toward." />
            {activeChallenges.length ? (
              activeChallenges.slice(0, 3).map((challenge) => <ChallengeCard key={challenge.id} challenge={challenge} />)
            ) : (
              <EmptyProfileCard title="All challenges complete" body="Completed challenge stamps live in your badges below." icon="trophy-outline" theme={theme} />
            )}
          </View>

          <View style={{ gap: 12 }}>
            <SectionTitle title="Badges" detail="Challenge stamps unlocked in Pintly." />
            {completedStamps.length ? (
              <View style={{ flexDirection: "row", gap: 14, flexWrap: "wrap" }}>
                {completedStamps.map((challenge) => (
                  <Pressable key={challenge.id} onPress={() => setSelectedStamp(challenge)} style={({ pressed }) => ({ opacity: pressed ? 0.78 : 1 })}>
                    <BadgeIcon icon={challenge.icon} label={challenge.title} />
                  </Pressable>
                ))}
              </View>
            ) : (
              <EmptyProfileCard title="No badges yet" body="Your first badge unlocks after real check-ins." icon="ribbon-outline" theme={theme} />
            )}
          </View>

          <View style={{ gap: 12 }}>
            <SectionTitle title="Collection Routes" detail="Progress from places, groups, and Pintly milestones." />
            {[
              { label: "Cities", current: user.cities, goal: 50 },
              { label: "States", current: user.states, goal: 50 },
              { label: "Group memories", current: personalLogs.filter((item) => item.groupIds.length > 0).length, goal: 100 }
            ].map((route) => (
              <View key={route.label} style={cardStyle(theme, 16, theme.radius.md)}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 12 }}>
                  <Text style={{ color: theme.colors.textPrimary, fontWeight: "900" }}>{route.label}</Text>
                  <Text style={{ color: theme.colors.accent, fontWeight: "900" }}>
                    {route.current} / {route.goal}
                  </Text>
                </View>
                <View style={{ marginTop: 10 }}>
                  <ProgressBar current={route.current} goal={route.goal} />
                </View>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>

      <ProfileModal
        visible={profileOpen}
        initialFocus={profileInitialFocus}
        onClose={() => {
          setProfileOpen(false);
          setProfileInitialFocus(undefined);
        }}
      />
      <SettingsModal
        visible={settingsOpen}
        preference={preference}
        setPreference={setPreference}
        onClose={() => setSettingsOpen(false)}
        onRefresh={() => void initializeSeedData()}
        onSignOut={() => {
          setSettingsOpen(false);
          void signOut();
        }}
        onOpenPrivacy={() => {
          setSettingsOpen(false);
          router.push("/legal/privacy");
        }}
        onOpenTerms={() => {
          setSettingsOpen(false);
          router.push("/legal/terms");
        }}
        onDeleteAccount={handleDeleteAccount}
        theme={theme}
      />
      <ChallengeStampModal
        challenge={selectedStamp}
        badge={selectedStamp ? badges.find((badge) => badge.id === selectedStamp.rewardBadgeId) : undefined}
        onClose={() => setSelectedStamp(null)}
      />
      <MemoryDetailModal memory={selectedMemory} onClose={() => setSelectedMemory(null)} theme={theme} />
      <ZoomablePhotoModal visible={Boolean(selectedAvatarUri)} uri={selectedAvatarUri} onClose={() => setSelectedAvatarUri(null)} theme={theme} footerText="Tap outside to close" />
    </SafeAreaView>
  );
}

function IdentityCard({
  user,
  topPercent,
  onAvatarPress,
  onFavoriteBeerPress,
  theme
}: {
  user: ReturnType<typeof usePassport>["user"];
  topPercent: number;
  onAvatarPress?: () => void;
  onFavoriteBeerPress: () => void;
  theme: AppTheme;
}) {
  const hasProfileBorder = Boolean(profileBorderForBeerCount(user.totalBeers));
  const avatarSize = 86;
  const avatarSlotSize = hasProfileBorder ? profileBorderFrameSize(avatarSize) : avatarSize + 6;
  const borderProgress = profileBorderProgress(user.totalBeers);
  const drinkerLabel = profileBorderDrinkerLabel(user.totalBeers);
  const favoriteBeer = user.favoriteBeer?.trim();
  return (
    <View style={{ paddingVertical: 6 }}>
      <View style={{ flexDirection: "row", gap: 16, alignItems: "center" }}>
        <Pressable
          disabled={!onAvatarPress}
          onPress={onAvatarPress}
          style={{ width: avatarSlotSize, height: avatarSlotSize, alignItems: "center", justifyContent: "center" }}
        >
          {hasProfileBorder ? (
            <Avatar label={user.avatar} uri={user.avatarUrl} size={avatarSize} borderColor={theme.colors.surface} beerCount={user.totalBeers} />
          ) : (
            <View style={{ padding: 3, borderRadius: 999, borderWidth: 2, borderColor: theme.colors.accent }}>
              <Avatar label={user.avatar} uri={user.avatarUrl} size={avatarSize} borderColor={theme.colors.surface} />
            </View>
          )}
        </Pressable>
        <View style={{ flex: 1, minWidth: 0, gap: 12 }}>
          <Pressable
            onPress={onFavoriteBeerPress}
            style={{
              minHeight: 58,
              justifyContent: "center",
              borderRadius: theme.radius.md,
              borderWidth: favoriteBeer ? 0 : 1,
              borderColor: theme.colors.cardBorder,
              backgroundColor: favoriteBeer ? "transparent" : theme.colors.surfaceAlt,
              paddingHorizontal: favoriteBeer ? 0 : 11,
              paddingVertical: favoriteBeer ? 0 : 9
            }}
          >
            <Text style={{ color: theme.colors.textMuted, fontSize: 11, fontWeight: "900", textTransform: "uppercase", letterSpacing: 0.7 }}>Favorite Beer</Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 3 }}>
              {!favoriteBeer ? <Ionicons name="add-circle" color={theme.colors.accent} size={20} /> : null}
              <Text numberOfLines={2} style={{ flex: 1, color: favoriteBeer ? theme.colors.textPrimary : theme.colors.accent, fontSize: 19, lineHeight: 23, fontWeight: "900" }}>
                {favoriteBeer || "Add favorite beer"}
              </Text>
            </View>
          </Pressable>
          <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
            <View
              style={{
                backgroundColor: theme.colors.accentSoft,
                borderRadius: theme.radius.pill,
                paddingHorizontal: 11,
                paddingVertical: 7,
                flexShrink: 1
              }}
            >
              <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.78} style={{ color: theme.colors.accentText, fontWeight: "900", fontSize: 14 }}>
                Top {topPercent}%
              </Text>
            </View>
            <View
              style={{
                backgroundColor: theme.colors.surfaceAlt,
                borderRadius: theme.radius.pill,
                borderWidth: 1,
                borderColor: theme.colors.cardBorder,
                paddingHorizontal: 11,
                paddingVertical: 7,
                flexShrink: 1
              }}
            >
              <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.78} style={{ color: theme.colors.textPrimary, fontWeight: "900", fontSize: 14 }}>
                {drinkerLabel}
              </Text>
            </View>
          </View>
        </View>
      </View>

      <View style={{ marginTop: 18 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 8 }}>
          <Text style={{ color: theme.colors.textSecondary, fontWeight: "800" }}>
            {borderProgress.nextMilestone ? "Next profile border" : "Top profile border"}
          </Text>
          <Text style={{ color: theme.colors.textPrimary, fontWeight: "900" }}>
            {formatNumber(borderProgress.current)} / {formatNumber(borderProgress.goal)} beers
          </Text>
        </View>
        <ProgressBar current={borderProgress.current} goal={borderProgress.goal} color={theme.colors.accent} />
        <Text style={{ color: theme.colors.textSecondary, marginTop: 8, fontWeight: "700" }}>
          {borderProgress.nextMilestone
            ? `${formatNumber(borderProgress.remaining)} beers until the ${formatNumber(borderProgress.nextMilestone.beers)} beer border`
            : `${formatNumber(borderProgress.goal)} beer border unlocked`}
        </Text>
      </View>

    </View>
  );
}

function ProfileStatsRail({
  stats,
  theme
}: {
  stats: Array<{ image: ImageSourcePropType; label: string; value: string | number }>;
  theme: AppTheme;
}) {
  return (
    <View style={{ flexDirection: "row", gap: 8 }}>
      {stats.map((stat) => (
        <View
          key={stat.label}
          style={{
            flex: 1,
            minHeight: 152,
            alignItems: "center",
            justifyContent: "space-between",
            paddingHorizontal: 7,
            paddingTop: 12,
            paddingBottom: 10,
            backgroundColor: theme.colors.card,
            borderRadius: theme.radius.lg,
            borderWidth: 1,
            borderColor: theme.colors.cardBorder,
            ...theme.shadow.card
          }}
        >
          <View style={{ height: 62, alignItems: "center", justifyContent: "flex-end" }}>
            <Image source={stat.image} style={{ width: 56, height: 56 }} resizeMode="contain" />
          </View>
          <View style={{ height: 55, alignItems: "center", justifyContent: "flex-end" }}>
            <Text style={{ color: theme.colors.textPrimary, fontWeight: "900", fontSize: 24, lineHeight: 28 }}>{stat.value}</Text>
            <View style={{ height: 26, justifyContent: "flex-start", marginTop: 1 }}>
              <Text numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.86} style={{ color: theme.colors.textSecondary, fontWeight: "800", fontSize: 11, textAlign: "center", lineHeight: 13 }}>
                {stat.label}
              </Text>
            </View>
          </View>
        </View>
      ))}
    </View>
  );
}

function JourneyCard({
  month,
  logs,
  summary,
  onPrevious,
  onNext,
  onSelectDate,
  theme
}: {
  month: Date;
  logs: BeerCheckIn[];
  summary: { beers: number; places: number; activeDays: number };
  onPrevious: () => void;
  onNext: () => void;
  onSelectDate: (date: Date) => void;
  theme: AppTheme;
}) {
  const countsByDay = new Map<string, number>();
  logs.forEach((log) => {
    const key = localDateKey(new Date(log.createdAt));
    countsByDay.set(key, (countsByDay.get(key) ?? 0) + 1);
  });
  const days = daysInMonth(month);
  const leadingBlanks = new Date(month.getFullYear(), month.getMonth(), 1).getDay();
  const calendarCells = [
    ...Array.from({ length: leadingBlanks }, () => null),
    ...days,
    ...Array.from({ length: (7 - ((leadingBlanks + days.length) % 7)) % 7 }, () => null)
  ];
  const calendarWeeks = chunk(calendarCells, 7);
  const today = new Date();

  return (
    <View style={cardStyle(theme, 18, 24)}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
        <View style={{ flex: 1 }}>
          <Text style={{ color: theme.colors.textPrimary, fontWeight: "900", fontSize: 22 }}>Your Journey</Text>
          <Text style={{ color: theme.colors.textSecondary, marginTop: 3 }}>Your beer memories over time.</Text>
        </View>
        <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
          <MonthButton icon="chevron-back" onPress={onPrevious} theme={theme} />
          <Text style={{ color: theme.colors.textPrimary, fontWeight: "900", minWidth: 88, textAlign: "center" }}>{monthLabel(month)}</Text>
          <MonthButton icon="chevron-forward" onPress={onNext} theme={theme} />
        </View>
      </View>

      <View style={{ marginTop: 18 }}>
        <View style={{ flexDirection: "row", marginBottom: 10 }}>
          {["S", "M", "T", "W", "T", "F", "S"].map((label, index) => (
            <Text key={`${label}-${index}`} style={{ color: theme.colors.textSecondary, flex: 1, textAlign: "center", fontWeight: "800", fontSize: 12 }}>{label}</Text>
          ))}
        </View>
        <View style={{ gap: 8 }}>
          {calendarWeeks.map((week, weekIndex) => (
            <View key={`week-${weekIndex}`} style={{ flexDirection: "row" }}>
              {week.map((date, dayIndex) => {
                const count = date ? countsByDay.get(localDateKey(date)) ?? 0 : 0;
                const isToday = Boolean(date && isSameLocalDay(date, today));
                const dotStyle = activityDotStyle(count, theme);
                return (
                  <View key={date ? localDateKey(date) : `blank-${weekIndex}-${dayIndex}`} style={{ flex: 1, alignItems: "center", minHeight: 24, justifyContent: "center" }}>
                    {date ? (
                      <Pressable
                        disabled={count === 0}
                        onPress={() => onSelectDate(date)}
                        hitSlop={8}
                        style={
                          isToday
                            ? {
                                width: 24,
                                height: 24,
                                borderRadius: 7,
                                borderWidth: 2,
                                borderColor: theme.colors.accent,
                                backgroundColor: theme.colors.card,
                                alignItems: "center",
                                justifyContent: "center"
                              }
                            : { ...dotStyle, borderWidth: 1, borderColor: count ? theme.colors.accent : theme.colors.cardBorder }
                        }
                      >
                        {isToday ? (
                          <View style={{ ...dotStyle, width: 16, height: 16, opacity: 1, borderWidth: 0, alignItems: "center", justifyContent: "center" }}>
                            <Text style={{ color: count ? theme.colors.textOnPrimary : theme.colors.accent, fontSize: 9, fontWeight: "900" }}>{date.getDate()}</Text>
                          </View>
                        ) : null}
                      </Pressable>
                    ) : null}
                  </View>
                );
              })}
            </View>
          ))}
        </View>
      </View>

      <View style={{ flexDirection: "row", gap: 10, borderTopWidth: 1, borderTopColor: theme.colors.cardBorder, paddingTop: 14, marginTop: 16 }}>
        <JourneyMetric icon="beer-outline" value={summary.beers} label="Beers" theme={theme} />
        <JourneyMetric icon="location-outline" value={summary.places} label="Locations" theme={theme} />
        <JourneyMetric icon="calendar-outline" value={summary.activeDays} label="Active Days" theme={theme} />
      </View>
    </View>
  );
}

function JourneyMetric({ icon, value, label, theme }: { icon: keyof typeof Ionicons.glyphMap; value: number; label: string; theme: AppTheme }) {
  return (
    <View style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 7 }}>
      <Ionicons name={icon} color={icon === "beer-outline" ? theme.colors.accent : theme.colors.iconSecondary} size={21} />
      <View style={{ flex: 1 }}>
        <Text style={{ color: theme.colors.textPrimary, fontWeight: "900", fontSize: 20 }}>{value}</Text>
        <Text style={{ color: theme.colors.textSecondary, fontWeight: "800", fontSize: 11, marginTop: 1 }}>{label}</Text>
      </View>
    </View>
  );
}

function MemoryCard({ memory, onPress, theme }: { memory: Memory; onPress: () => void; theme: AppTheme }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [cardStyle(theme, 12, 20), { opacity: pressed ? 0.86 : 1 }]}>
      <View style={{ flexDirection: "row", gap: 14, alignItems: "center" }}>
        <PhotoCollage photos={memory.photos} theme={theme} />
        <View style={{ flex: 1 }}>
          <Text style={{ color: theme.colors.textPrimary, fontWeight: "900", fontSize: 18 }}>{memory.title}</Text>
          <Text style={{ color: theme.colors.textSecondary, marginTop: 4 }}>{memory.locationSummary}</Text>
          <Text style={{ color: theme.colors.accent, fontWeight: "900", marginTop: 8 }}>{memory.beerCount === 1 ? "1 beer" : `${memory.beerCount} beers`}</Text>
        </View>
        <Ionicons name="chevron-forward" color={theme.colors.iconSecondary} size={20} />
      </View>
    </Pressable>
  );
}

function MemoryDetailModal({ memory, onClose, theme }: { memory: Memory | null; onClose: () => void; theme: AppTheme }) {
  const [previewPhoto, setPreviewPhoto] = useState<string | null>(null);
  if (!memory) return null;
  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }}>
        <Pressable
          onPress={onClose}
          hitSlop={8}
          style={{
            position: "absolute",
            top: 14,
            right: 16,
            zIndex: 10,
            width: 42,
            height: 42,
            borderRadius: 21,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: theme.colors.card,
            borderWidth: 1,
            borderColor: theme.colors.cardBorder,
            ...theme.shadow.card
          }}
        >
          <Ionicons name="close" color={theme.colors.textPrimary} size={24} />
        </Pressable>
        <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 42 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 14 }}>
            <View style={{ flex: 1, paddingRight: 52 }}>
              <Text style={{ color: theme.colors.accent, fontSize: 12, fontWeight: "900", letterSpacing: 1.7 }}>MEMORY</Text>
              <Text style={{ color: theme.colors.textPrimary, fontSize: 30, fontWeight: "900", marginTop: 5 }}>{memory.title}</Text>
              <Text style={{ color: theme.colors.textSecondary, marginTop: 6 }}>{memory.locationSummary}</Text>
            </View>
          </View>

          <View style={{ gap: 12, marginTop: 22 }}>
            {memory.checkIns.map((log) => (
              <View key={log.id} style={cardStyle(theme, 12, theme.radius.md)}>
                {photoFor(log) ? (
                  <Pressable onPress={() => setPreviewPhoto(photoFor(log) as string)} style={{ marginBottom: 12 }}>
                    <Image source={{ uri: photoFor(log) }} style={{ width: "100%", aspectRatio: 4 / 3, borderRadius: 16 }} resizeMode="cover" />
                  </Pressable>
                ) : null}
                <Text style={{ color: theme.colors.textPrimary, fontWeight: "900", fontSize: 17 }}>{cleanBeerTitle(log)}</Text>
                <Text style={{ color: theme.colors.textSecondary, marginTop: 4 }}>{locationLabel(log)}</Text>
                <Text style={{ color: theme.colors.textMuted, marginTop: 4, fontSize: 12 }}>{new Date(log.createdAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</Text>
                {log.note ? <Text style={{ color: theme.colors.textSecondary, lineHeight: 20, marginTop: 10 }}>{log.note}</Text> : null}
              </View>
            ))}
          </View>
        </ScrollView>
        {previewPhoto ? <InlinePhotoPreview uri={previewPhoto} onClose={() => setPreviewPhoto(null)} theme={theme} /> : null}
      </SafeAreaView>
    </Modal>
  );
}

function SettingsModal({
  visible,
  preference,
  setPreference,
  onRefresh,
  onSignOut,
  onOpenPrivacy,
  onOpenTerms,
  onDeleteAccount,
  onClose,
  theme
}: {
  visible: boolean;
  preference: ThemePreference;
  setPreference: (preference: ThemePreference) => void;
  onRefresh: () => void;
  onSignOut: () => void;
  onOpenPrivacy: () => void;
  onOpenTerms: () => void;
  onDeleteAccount: () => void;
  onClose: () => void;
  theme: AppTheme;
}) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <View style={{ flex: 1, justifyContent: "flex-end", backgroundColor: theme.colors.modalBackdrop }}>
        <View
          style={{
            height: "90%",
            backgroundColor: theme.colors.background,
            borderTopLeftRadius: 28,
            borderTopRightRadius: 28,
            borderWidth: 1,
            borderColor: theme.colors.cardBorder,
            overflow: "hidden"
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 16, paddingHorizontal: 22, paddingTop: 18, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: theme.colors.cardBorder }}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: theme.colors.textPrimary, fontSize: 24, fontWeight: "900" }}>Settings</Text>
              <Text style={{ color: theme.colors.textSecondary, marginTop: 4 }}>Appearance, legal, account, and app diagnostics.</Text>
            </View>
            <IconButton icon="close" label="Close settings" onPress={onClose} theme={theme} />
          </View>
          <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 34 }}>
            <SettingsStack
              preference={preference}
              setPreference={setPreference}
              onRefresh={onRefresh}
              onSignOut={onSignOut}
              onOpenPrivacy={onOpenPrivacy}
              onOpenTerms={onOpenTerms}
              onDeleteAccount={onDeleteAccount}
              theme={theme}
            />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function SettingsStack({
  preference,
  setPreference,
  onRefresh,
  onSignOut,
  onOpenPrivacy,
  onOpenTerms,
  onDeleteAccount,
  theme
}: {
  preference: ThemePreference;
  setPreference: (preference: ThemePreference) => void;
  onRefresh: () => void;
  onSignOut: () => void;
  onOpenPrivacy: () => void;
  onOpenTerms: () => void;
  onDeleteAccount: () => void;
  theme: AppTheme;
}) {
  const diagnostics = useMemo(buildAppDiagnostics, []);

  return (
    <View style={{ gap: 12 }}>
      <View style={cardStyle(theme, 16, theme.radius.lg)}>
        <Text style={{ color: theme.colors.textPrimary, fontWeight: "900" }}>Appearance</Text>
        <View style={{ flexDirection: "row", gap: 8, marginTop: 12 }}>
          {appearanceOptions.map((option) => {
            const active = preference === option.value;
            return (
              <Pressable
                key={option.value}
                accessibilityRole="button"
                accessibilityLabel={`Use ${option.label.toLowerCase()} appearance`}
                accessibilityState={{ selected: active }}
                onPress={() => setPreference(option.value)}
                style={{
                  flex: 1,
                  alignItems: "center",
                  minHeight: 44,
                  justifyContent: "center",
                  borderRadius: theme.radius.pill,
                  backgroundColor: active ? theme.colors.accent : theme.colors.surfaceAlt,
                  borderWidth: 1,
                  borderColor: active ? theme.colors.accent : theme.colors.cardBorder
                }}
              >
                <Text style={{ color: active ? theme.colors.textOnPrimary : theme.colors.textPrimary, fontWeight: "900", fontSize: 12 }}>{option.label}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>
      <View style={cardStyle(theme, 16, theme.radius.lg)}>
        <Text style={{ color: theme.colors.textPrimary, fontWeight: "900" }}>Legal</Text>
        <SettingsRow label="Privacy Policy" icon="lock-closed-outline" onPress={onOpenPrivacy} theme={theme} />
        <SettingsRow label="Terms of Service" icon="document-text-outline" onPress={onOpenTerms} theme={theme} />
      </View>
      <AppDiagnosticsCard diagnostics={diagnostics} theme={theme} />
      <View style={{ flexDirection: "row", gap: 10 }}>
        <Pressable onPress={onRefresh} style={[secondaryButton(theme), { flex: 1 }]}>
          <Text style={{ color: theme.colors.textSecondary, fontWeight: "900" }}>Refresh data</Text>
        </Pressable>
        <Pressable onPress={onSignOut} style={[secondaryButton(theme), { flex: 1 }]}>
          <Text style={{ color: theme.colors.textSecondary, fontWeight: "900" }}>Sign out</Text>
        </Pressable>
      </View>
      <Pressable onPress={onDeleteAccount} style={[secondaryButton(theme), { borderColor: theme.colors.danger }]}>
        <Text style={{ color: theme.colors.danger, fontWeight: "900", textAlign: "center" }}>Delete account</Text>
      </Pressable>
    </View>
  );
}

function AppDiagnosticsCard({ diagnostics, theme }: { diagnostics: AppDiagnostic[]; theme: AppTheme }) {
  return (
    <View style={cardStyle(theme, 16, theme.radius.lg)}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 9 }}>
        <Ionicons name="information-circle-outline" color={theme.colors.primary} size={20} />
        <Text style={{ color: theme.colors.textPrimary, fontWeight: "900" }}>App diagnostics</Text>
      </View>
      <Text style={{ color: theme.colors.textSecondary, marginTop: 6, lineHeight: 19, fontSize: 12 }}>
        Use this when checking whether your phone has the latest update.
      </Text>
      <View style={{ marginTop: 12, borderTopWidth: 1, borderTopColor: theme.colors.cardBorder }}>
        {diagnostics.map((item) => (
          <View key={item.label} style={{ paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: theme.colors.cardBorder }}>
            <Text style={{ color: theme.colors.textMuted, fontSize: 11, fontWeight: "900", textTransform: "uppercase", letterSpacing: 0.6 }}>{item.label}</Text>
            <Text selectable style={{ color: theme.colors.textPrimary, marginTop: 4, fontWeight: "800", lineHeight: 19 }}>
              {item.value}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function SettingsRow({ label, icon, onPress, theme }: { label: string; icon: keyof typeof Ionicons.glyphMap; onPress: () => void; theme: AppTheme }) {
  return (
    <Pressable onPress={onPress} style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 13, borderTopWidth: 1, borderTopColor: theme.colors.cardBorder, marginTop: 12 }}>
      <Ionicons name={icon} color={theme.colors.iconSecondary} size={20} />
      <Text style={{ color: theme.colors.textPrimary, fontWeight: "900", flex: 1 }}>{label}</Text>
      <Ionicons name="chevron-forward" color={theme.colors.textMuted} size={18} />
    </Pressable>
  );
}

const appearanceOptions: Array<{ label: string; value: ThemePreference }> = [
  { label: "Light", value: "light" },
  { label: "Dark", value: "dark" }
];

function buildAppDiagnostics(): AppDiagnostic[] {
  const appVersion = Constants.expoConfig?.version ?? "unknown";
  const iosBuildNumber = Constants.platform?.ios?.buildNumber;
  const androidVersionCode = Constants.platform?.android?.versionCode;
  const nativeBuild = iosBuildNumber ?? (typeof androidVersionCode === "number" ? String(androidVersionCode) : undefined);
  return [
    { label: "App version", value: nativeBuild ? `${appVersion} (${nativeBuild})` : appVersion },
    { label: "Runtime", value: Updates.runtimeVersion ?? Constants.expoRuntimeVersion ?? "unknown" },
    { label: "Channel", value: Updates.channel ?? "not set" },
    { label: "Update ID", value: Updates.updateId ?? "embedded / development" },
    { label: "Update created", value: Updates.createdAt ? Updates.createdAt.toISOString() : "unknown" },
    { label: "Launch source", value: Updates.isEmbeddedLaunch ? "embedded build" : "OTA update" },
    { label: "Updates enabled", value: Updates.isEnabled ? "yes" : "no" },
    { label: "Emergency launch", value: Updates.isEmergencyLaunch ? Updates.emergencyLaunchReason ?? "yes" : "no" }
  ];
}

function buildMemories(logs: BeerCheckIn[]): Memory[] {
  const byDay = new Map<string, BeerCheckIn[]>();
  logs.forEach((log) => {
    const key = localDateKey(new Date(log.createdAt));
    byDay.set(key, [...(byDay.get(key) ?? []), log]);
  });

  return Array.from(byDay.entries())
    .map(([key, dayLogs]) => {
      const sorted = dayLogs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      const locations = unique(sorted.map(locationLabel).filter(Boolean));
      const date = new Date(`${key}T12:00:00`);
      return {
        id: key,
        date,
        title: memoryTitle(sorted, date),
        locationSummary: locationSummary(locations),
        beerCount: sorted.length,
        photos: sorted.map(photoFor).filter((photo): photo is string => Boolean(photo)).slice(0, 4),
        checkIns: sorted
      };
    })
    .sort((a, b) => b.date.getTime() - a.date.getTime());
}

function getMonthSummary(logs: BeerCheckIn[]) {
  return {
    beers: logs.length,
    places: countUniqueStampLocations(logs),
    activeDays: unique(logs.map((log) => localDateKey(new Date(log.createdAt)))).length
  };
}

function getTopUserPercentile(groups: ReturnType<typeof usePassport>["groups"], userId: string, fallbackBeerCount: number) {
  const beerCountByUser = new Map<string, number>([[userId, fallbackBeerCount]]);
  groups.forEach((group) => {
    group.members.forEach((member) => {
      beerCountByUser.set(member.userId, Math.max(beerCountByUser.get(member.userId) ?? 0, member.beerCount));
    });
  });

  const ranked = Array.from(beerCountByUser.entries()).sort((left, right) => right[1] - left[1]);
  const rank = ranked.findIndex(([id]) => id === userId) + 1;
  if (rank <= 1 || ranked.length <= 1) return 1;
  return Math.max(1, Math.min(100, Math.ceil(((rank - 1) / Math.max(1, ranked.length - 1)) * 99) + 1));
}

function countUniqueStampLocations(logs: BeerCheckIn[]) {
  return unique(logs.map(stampLocationKey)).length;
}

function stampLocationKey(log: BeerCheckIn) {
  const brewery = log.brewery?.trim();
  if (brewery && !isGenericPlaceLabel(brewery)) return normalizePlaceText(brewery);
  if (typeof log.location.latitude === "number" && typeof log.location.longitude === "number") {
    return `${log.location.latitude.toFixed(4)},${log.location.longitude.toFixed(4)}`;
  }
  const label = broadPlaceLabel(log.location);
  return label === "Location hidden" ? "" : normalizePlaceText(label);
}

function logsForMonth(logs: BeerCheckIn[], month: Date) {
  return logs.filter((log) => {
    const date = new Date(log.createdAt);
    return date.getFullYear() === month.getFullYear() && date.getMonth() === month.getMonth();
  });
}

function photoFor(log: BeerCheckIn) {
  return checkInPhotoUrl(log, "feed");
}

function locationLabel(log: BeerCheckIn) {
  const brewery = log.brewery?.trim();
  if (brewery && !isGenericPlaceLabel(brewery)) return brewery;
  return broadPlaceLabel(log.location);
}

function isGenericPlaceLabel(value: string) {
  const normalized = value.trim().toLowerCase();
  return ["photo stamp", "beer log", "pintly log", "check-in"].some((generic) => normalized.includes(generic));
}

function locationSummary(locations: string[]) {
  if (!locations.length) return "Unknown location";
  if (locations.length === 1) return locations[0];
  return `${locations[0]} + ${locations.length - 1} more ${locations.length === 2 ? "stop" : "stops"}`;
}

function memoryTitle(logs: BeerCheckIn[], date: Date) {
  return date.toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" });
}

function cleanBeerTitle(log: BeerCheckIn) {
  return isGenericPlaceLabel(log.beerName) ? "Beer Memory" : log.beerName;
}

function unique(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

function chunk<T>(items: T[], size: number) {
  const result: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    result.push(items.slice(index, index + size));
  }
  return result;
}

function normalizePlaceText(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function localDateKey(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function isSameLocalDay(left: Date, right: Date) {
  return left.getFullYear() === right.getFullYear() && left.getMonth() === right.getMonth() && left.getDate() === right.getDate();
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function addMonths(date: Date, count: number) {
  return new Date(date.getFullYear(), date.getMonth() + count, 1);
}

function daysInMonth(month: Date) {
  const total = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  return Array.from({ length: total }, (_, index) => new Date(month.getFullYear(), month.getMonth(), index + 1));
}

function monthLabel(month: Date) {
  return month.toLocaleDateString([], { month: "long", year: "numeric" });
}

function activityDotStyle(count: number, theme: AppTheme, size = 14) {
  const opacity = count === 0 ? 1 : Math.min(1, 0.36 + count * 0.18);
  return {
    width: size,
    height: size,
    borderRadius: 4,
    backgroundColor: count ? theme.colors.accent : theme.colors.surfaceAlt,
    opacity,
    borderWidth: 1,
    borderColor: count ? theme.colors.accent : theme.colors.cardBorder
  };
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

function secondaryButton(theme: AppTheme) {
  return {
    minHeight: 46,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    borderColor: theme.colors.cardBorder,
    backgroundColor: theme.colors.surfaceAlt,
    paddingHorizontal: 14
  };
}

function IconButton({ icon, label, onPress, theme }: { icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void; theme: AppTheme }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={{
        width: 44,
        height: 44,
        borderRadius: 22,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: theme.colors.surface,
        borderWidth: 1,
        borderColor: theme.colors.cardBorder
      }}
    >
      <Ionicons name={icon} color={theme.colors.iconSecondary} size={20} />
    </Pressable>
  );
}

function MonthButton({ icon, onPress, theme }: { icon: keyof typeof Ionicons.glyphMap; onPress: () => void; theme: AppTheme }) {
  return (
    <Pressable onPress={onPress} hitSlop={8} style={{ width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center", backgroundColor: theme.colors.surfaceAlt }}>
      <Ionicons name={icon} color={theme.colors.iconSecondary} size={17} />
    </Pressable>
  );
}

function PhotoCollage({ photos, theme }: { photos: string[]; theme: AppTheme }) {
  if (!photos.length) {
    return (
      <View style={{ width: 88, height: 88, borderRadius: 18, backgroundColor: theme.colors.surfaceAlt, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: theme.colors.cardBorder }}>
        <Ionicons name="beer-outline" color={theme.colors.accent} size={30} />
      </View>
    );
  }

  return (
    <View style={{ width: 88, height: 88, borderRadius: 18, overflow: "hidden", backgroundColor: theme.colors.surfaceAlt }}>
      {photos.slice(0, 4).map((photo, index) => (
        <Image
          key={`${photo}-${index}`}
          source={{ uri: photo }}
          style={collagePhotoStyle(Math.min(photos.length, 4), index)}
          resizeMode="cover"
        />
      ))}
    </View>
  );
}

function collagePhotoStyle(count: number, index: number) {
  if (count === 1) return { position: "absolute" as const, width: "100%" as const, height: "100%" as const, left: 0, top: 0 };
  if (count === 2) return { position: "absolute" as const, width: "50%" as const, height: "100%" as const, left: index === 0 ? 0 : "50%" as const, top: 0 };
  if (count === 3) {
    return {
      position: "absolute" as const,
      width: index === 0 ? "50%" as const : "50%" as const,
      height: index === 0 ? "100%" as const : "50%" as const,
      left: index === 0 ? 0 : "50%" as const,
      top: index === 2 ? "50%" as const : 0
    };
  }
  return {
    position: "absolute" as const,
    width: "50%" as const,
    height: "50%" as const,
    left: index % 2 === 0 ? 0 : "50%" as const,
    top: index < 2 ? 0 : "50%" as const
  };
}

function InlinePhotoPreview({ uri, onClose, theme }: { uri: string; onClose: () => void; theme: AppTheme }) {
  return <ZoomablePhotoModal visible uri={uri} onClose={onClose} theme={theme} />;
}

function EmptyProfileCard({ title, body, icon, theme }: { title: string; body: string; icon: keyof typeof Ionicons.glyphMap; theme: AppTheme }) {
  return (
    <View style={cardStyle(theme, 16, theme.radius.lg)}>
      <View style={{ flexDirection: "row", gap: 12 }}>
        <View style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: theme.colors.surfaceAlt, alignItems: "center", justifyContent: "center" }}>
          <Ionicons name={icon} color={theme.colors.accent} size={20} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ color: theme.colors.textPrimary, fontWeight: "900" }}>{title}</Text>
          <Text style={{ color: theme.colors.textSecondary, marginTop: 5, lineHeight: 20 }}>{body}</Text>
        </View>
      </View>
    </View>
  );
}

function ChallengeStampModal({ challenge, badge, onClose }: { challenge: Challenge | null; badge?: Badge; onClose: () => void }) {
  if (!challenge) return null;

  return (
    <Modal visible animationType="fade" transparent onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: staticTheme.colors.modalBackdrop, justifyContent: "center", padding: 22 }}>
        <View style={{ backgroundColor: staticTheme.colors.card, borderRadius: 28, borderWidth: 1, borderColor: staticTheme.colors.cardBorder, padding: 20 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
            <View style={{ flexDirection: "row", gap: 14, flex: 1 }}>
              <BadgeIcon icon={challenge.icon} size={58} />
              <View style={{ flex: 1 }}>
                <Text style={{ color: staticTheme.colors.accent, fontWeight: "900", letterSpacing: 1, fontSize: 12 }}>COMPLETED CHALLENGE</Text>
                <Text style={{ color: staticTheme.colors.textPrimary, fontSize: 24, fontWeight: "900", marginTop: 4 }}>{challenge.title}</Text>
              </View>
            </View>
            <Pressable onPress={onClose} hitSlop={10}>
              <Ionicons name="close" color={staticTheme.colors.textPrimary} size={24} />
            </Pressable>
          </View>

          <Text style={{ color: staticTheme.colors.textSecondary, lineHeight: 21, marginTop: 16 }}>{challenge.description}</Text>
          <View style={{ marginTop: 18 }}>
            <ProgressBar current={challenge.current} goal={challenge.goal} color={staticTheme.colors.accent} />
            <Text style={{ color: staticTheme.colors.accent, fontWeight: "900", marginTop: 8 }}>
              {challenge.current} / {challenge.goal} completed
            </Text>
          </View>
          <View style={{ backgroundColor: staticTheme.colors.surfaceAlt, borderRadius: staticTheme.radius.lg, borderWidth: 1, borderColor: staticTheme.colors.cardBorder, padding: 14, marginTop: 18 }}>
            <Text style={{ color: staticTheme.colors.textPrimary, fontWeight: "900" }}>Reward badge</Text>
            <Text style={{ color: staticTheme.colors.textSecondary, marginTop: 5, lineHeight: 20 }}>{badge ? `${badge.title}: ${badge.description}` : "Badge reward unlocked for this challenge."}</Text>
          </View>
          <Pressable onPress={onClose} style={{ backgroundColor: staticTheme.colors.accent, borderRadius: staticTheme.radius.pill, paddingVertical: 14, alignItems: "center", marginTop: 18 }}>
            <Text style={{ color: staticTheme.colors.textOnPrimary, fontWeight: "900" }}>Done</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}
