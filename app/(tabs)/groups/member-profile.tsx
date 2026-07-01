import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Image, type ImageSourcePropType, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Avatar } from "@/components/Avatar";
import { ProgressBar } from "@/components/ProgressBar";
import { UserSafetyActions } from "@/components/UserSafetyActions";
import { ZoomablePhotoModal } from "@/components/ZoomablePhotoModal";
import { useGroupMemberProfile } from "@/hooks/useGroupMemberProfile";
import { AppTheme, useAppTheme } from "@/theme";
import { GroupMemberProfile } from "@/types";
import { formatNumber } from "@/utils/format";

const profileStatIcons = {
  beers: require("../../../assets/profile/stat-beer.png"),
  locations: require("../../../assets/profile/stat-map.png"),
  groups: require("../../../assets/profile/stat-groups.png"),
  badges: require("../../../assets/profile/stat-badges.png")
} satisfies Record<string, ImageSourcePropType>;

export default function GroupMemberProfileScreen() {
  const theme = useAppTheme();
  const router = useRouter();
  const { groupId, userId } = useLocalSearchParams<{ groupId?: string; userId?: string }>();
  const { data, loading, error, forbidden } = useGroupMemberProfile(groupId, userId);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <View style={{ paddingHorizontal: 22, paddingTop: 14, paddingBottom: 8 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 16 }}>
          <View style={{ flex: 1 }}>
            <Text style={{ color: theme.colors.accent, fontSize: 12, fontWeight: "900", letterSpacing: 2 }}>PINTLY</Text>
            <Text style={{ color: theme.colors.textPrimary, fontSize: 38, fontWeight: "900", marginTop: 6 }}>Profile</Text>
            <Text numberOfLines={2} style={{ color: theme.colors.textSecondary, lineHeight: 21, marginTop: 6 }}>
              Viewed from {data?.group.name ?? "this group"}.
            </Text>
          </View>
          <IconButton icon="chevron-back" label="Back" onPress={() => router.back()} theme={theme} />
        </View>
      </View>

      {loading && !data ? (
        <CenteredState icon="hourglass-outline" title="Loading member profile" body="Gathering group stats." theme={theme} loading />
      ) : forbidden ? (
        <CenteredState icon="lock-closed-outline" title="Profile unavailable" body="You need access to this group to view this member profile." theme={theme} />
      ) : error && !data ? (
        <CenteredState icon="alert-circle-outline" title="Could not load profile" body={error} theme={theme} />
      ) : data ? (
        <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 124, gap: 24 }}>
          <ProfileHero profile={data} theme={theme} />
          <StatsRail profile={data} theme={theme} />
          <UserSafetyActions targetUserId={data.user.id} targetName={data.user.displayName} groupId={data.group.id} theme={theme} />
          <SharedGroupsCard profile={data} theme={theme} />
          <AboutCard profile={data} theme={theme} />
          <RecentActivity profile={data} theme={theme} />
        </ScrollView>
      ) : (
        <CenteredState icon="person-circle-outline" title="Member not found" body="This person is not a member of the selected group." theme={theme} />
      )}
    </SafeAreaView>
  );
}

function ProfileHero({ profile, theme }: { profile: GroupMemberProfile; theme: AppTheme }) {
  const xpRemaining = Math.max(0, profile.level.nextLevelXp - profile.level.currentXp);
  return (
    <View style={cardStyle(theme, 18, 24)}>
      <View style={{ flexDirection: "row", gap: 16, alignItems: "center" }}>
        <View style={{ width: 110, height: 110 }}>
          <View style={{ padding: 4, borderRadius: 55, borderWidth: 3, borderColor: theme.colors.accent }}>
            <Avatar label={profile.user.avatar} uri={profile.user.avatarUrl} size={98} borderColor={theme.colors.surface} />
          </View>
        </View>

        <View style={{ flex: 1, minWidth: 0 }}>
          <Text numberOfLines={2} style={{ color: theme.colors.textPrimary, fontSize: 32, lineHeight: 36, fontWeight: "900" }}>
            {profile.user.displayName}
          </Text>
          <View style={{ alignSelf: "flex-start", backgroundColor: theme.colors.accentSoft, borderRadius: theme.radius.pill, paddingHorizontal: 12, paddingVertical: 7, marginTop: 12, maxWidth: "100%" }}>
            <Text numberOfLines={2} style={{ color: theme.colors.accentText, fontWeight: "900", fontSize: 15, lineHeight: 18 }}>
              {profile.level.label}
            </Text>
          </View>
        </View>
      </View>

      <View style={{ flexDirection: "row", gap: 10, marginTop: 18, borderTopWidth: 1, borderTopColor: theme.colors.cardBorder, paddingTop: 16 }}>
        <View style={{ flex: 1 }}>
          <Text style={{ color: theme.colors.textPrimary, fontWeight: "900", fontSize: 24 }}>{formatNumber(profile.level.points)}</Text>
          <Text style={{ color: theme.colors.textSecondary, fontWeight: "800", fontSize: 12, marginTop: 2 }}>Total Points</Text>
        </View>
        {profile.level.percentile ? (
          <View style={{ alignItems: "flex-end" }}>
            <Text style={{ color: theme.colors.accent, fontWeight: "900", fontSize: 24 }}>{profile.level.percentile}%</Text>
            <Text style={{ color: theme.colors.textSecondary, fontWeight: "800", fontSize: 12, marginTop: 2 }}>of users</Text>
          </View>
        ) : null}
      </View>

      <View style={{ marginTop: 18 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 12, marginBottom: 9 }}>
          <Text style={{ color: theme.colors.textSecondary, fontWeight: "800" }}>XP progress</Text>
          <Text style={{ color: theme.colors.textPrimary, fontWeight: "900" }}>
            {formatNumber(profile.level.currentXp)} / {formatNumber(profile.level.nextLevelXp)}
          </Text>
        </View>
        <ProgressBar current={profile.level.currentXp} goal={profile.level.nextLevelXp} color={theme.colors.accent} />
        <Text style={{ color: theme.colors.textSecondary, marginTop: 9, fontWeight: "700" }}>
          {formatNumber(xpRemaining)} XP until Level {nextLevelNumber(profile.level.label)}
        </Text>
      </View>
    </View>
  );
}

function StatsRail({ profile, theme }: { profile: GroupMemberProfile; theme: AppTheme }) {
  const stats = [
    { image: profileStatIcons.beers, label: "Beers Logged", value: formatNumber(profile.stats.allTimeBeers) },
    { image: profileStatIcons.locations, label: "Group Beers", value: formatNumber(profile.stats.beersInThisGroup) },
    { image: profileStatIcons.groups, label: "Groups", value: profile.stats.groupCount },
    { image: profileStatIcons.badges, label: "Badges", value: profile.stats.badgeCount }
  ];
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

function SharedGroupsCard({ profile, theme }: { profile: GroupMemberProfile; theme: AppTheme }) {
  const sharedGroups = profile.sharedGroups ?? [];
  if (sharedGroups.length <= 1) return null;

  return (
    <View style={{ gap: 10 }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", gap: 12 }}>
        <Text style={{ color: theme.colors.textPrimary, fontWeight: "900", fontSize: 20 }}>Shared groups</Text>
        <Text style={{ color: theme.colors.textSecondary, fontWeight: "800", fontSize: 13 }}>
          {sharedGroups.length} groups together
        </Text>
      </View>
      <View style={{ ...cardStyle(theme, 0, theme.radius.lg), overflow: "hidden" }}>
        {sharedGroups.map((group, index) => (
          <View
            key={group.id}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 12,
              paddingHorizontal: 16,
              paddingVertical: 14,
              backgroundColor: group.isViewedGroup ? theme.colors.accentSoft : theme.colors.card,
              borderTopWidth: index === 0 ? 0 : 1,
              borderTopColor: theme.colors.cardBorder
            }}
          >
            <View style={{ width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center", backgroundColor: group.isViewedGroup ? theme.colors.accent : theme.colors.surfaceAlt }}>
              <Ionicons name="people-outline" color={group.isViewedGroup ? theme.colors.textOnPrimary : theme.colors.accent} size={20} />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text numberOfLines={1} style={{ color: theme.colors.textPrimary, fontWeight: "900", fontSize: 16 }}>
                {group.name}
              </Text>
              <Text style={{ color: theme.colors.textSecondary, fontWeight: "800", fontSize: 13, marginTop: 2 }}>
                {group.isViewedGroup ? "Current view" : "Also shared"}
                {group.rank ? ` · ${ordinal(group.rank)} in group` : ""}
              </Text>
            </View>
            <View style={{ alignItems: "flex-end" }}>
              <Text style={{ color: theme.colors.textPrimary, fontWeight: "900", fontSize: 18 }}>{formatNumber(group.beers)}</Text>
              <Text style={{ color: theme.colors.textSecondary, fontWeight: "800", fontSize: 12 }}>beers</Text>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

function AboutCard({ profile, theme }: { profile: GroupMemberProfile; theme: AppTheme }) {
  const joined = profile.user.createdAt ? ` joined Pintly in ${formatMonthYear(profile.user.createdAt)} and has contributed` : " has logged";
  const sharedGroupCount = profile.sharedGroups?.length ?? profile.stats.groupCount;
  const groupContext =
    sharedGroupCount > 1
      ? `${formatNumber(profile.stats.beersInThisGroup)} beers to ${profile.group.name} and shares ${formatNumber(sharedGroupCount)} groups with you.`
      : `${formatNumber(profile.stats.beersInThisGroup)} beers ${profile.user.createdAt ? "to" : "for"} ${profile.group.name}.`;
  return (
    <View style={{ borderRadius: theme.radius.lg, backgroundColor: theme.colors.surfaceAlt, borderWidth: 1, borderColor: theme.colors.accentSoft, padding: 18, flexDirection: "row", gap: 14, alignItems: "center" }}>
      <Ionicons name="people-outline" color={theme.colors.accent} size={36} />
      <View style={{ flex: 1 }}>
        <Text style={{ color: theme.colors.textPrimary, fontWeight: "900", fontSize: 16 }}>About this member</Text>
        <Text style={{ color: theme.colors.textSecondary, marginTop: 6, lineHeight: 21, fontSize: 15 }}>
          {profile.user.displayName}
          {joined} {groupContext}
        </Text>
      </View>
    </View>
  );
}

function RecentActivity({ profile, theme }: { profile: GroupMemberProfile; theme: AppTheme }) {
  const activity = profile.recentActivity ?? [];
  const [selectedPhoto, setSelectedPhoto] = useState<{ uri: string; title: string } | null>(null);
  return (
    <View style={{ gap: 12 }}>
      <Text style={{ color: theme.colors.textPrimary, fontWeight: "900", fontSize: 20 }}>Recent Activity in {profile.group.name}</Text>
      {activity.length ? (
        <View style={{ ...cardStyle(theme, 0, theme.radius.lg), overflow: "hidden" }}>
          {activity.map((item, index) => (
            <Pressable
              key={item.id}
              onPress={() => {
                if (item.imageUrl) setSelectedPhoto({ uri: item.imageUrl, title: item.subtitle ?? item.title });
              }}
              disabled={!item.imageUrl}
              style={({ pressed }) => ({
                flexDirection: "row",
                alignItems: "center",
                gap: 12,
                padding: 14,
                borderTopWidth: index === 0 ? 0 : 1,
                borderTopColor: theme.colors.cardBorder,
                opacity: pressed ? 0.72 : 1
              })}
            >
              {item.imageUrl ? (
                <Image source={{ uri: item.imageUrl }} style={{ width: 50, height: 50, borderRadius: 12, backgroundColor: theme.colors.surfaceAlt }} resizeMode="cover" />
              ) : (
                <View style={{ width: 50, height: 50, borderRadius: 12, backgroundColor: theme.colors.accentSoft, alignItems: "center", justifyContent: "center" }}>
                  <Ionicons name={item.type === "beer_log" ? "beer-outline" : "ribbon-outline"} color={theme.colors.accent} size={24} />
                </View>
              )}
              <View style={{ flex: 1 }}>
                <Text style={{ color: theme.colors.textPrimary, fontWeight: "900", fontSize: 16 }}>{item.title}</Text>
                {item.subtitle ? <Text style={{ color: theme.colors.textSecondary, marginTop: 3 }}>{item.subtitle}</Text> : null}
              </View>
              <Text style={{ color: theme.colors.textSecondary, fontWeight: "800", fontSize: 12 }}>{formatActivityDate(item.createdAt)}</Text>
              {item.imageUrl ? <Ionicons name="expand-outline" color={theme.colors.iconSecondary} size={19} /> : null}
            </Pressable>
          ))}
        </View>
      ) : (
        <View style={cardStyle(theme, 16, theme.radius.lg)}>
          <Text style={{ color: theme.colors.textSecondary, fontWeight: "800" }}>Recent group activity coming soon.</Text>
        </View>
      )}
      <ZoomablePhotoModal visible={Boolean(selectedPhoto)} uri={selectedPhoto?.uri} footerText={selectedPhoto?.title} theme={theme} onClose={() => setSelectedPhoto(null)} />
    </View>
  );
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
      <Ionicons name={icon} color={theme.colors.iconSecondary} size={22} />
    </Pressable>
  );
}

function CenteredState({ icon, title, body, theme, loading = false }: { icon: keyof typeof Ionicons.glyphMap; title: string; body: string; theme: AppTheme; loading?: boolean }) {
  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 28 }}>
      {loading ? <ActivityIndicator color={theme.colors.accent} size="large" /> : <Ionicons name={icon} color={theme.colors.accent} size={42} />}
      <Text style={{ color: theme.colors.textPrimary, fontWeight: "900", fontSize: 20, marginTop: 14, textAlign: "center" }}>{title}</Text>
      <Text style={{ color: theme.colors.textSecondary, lineHeight: 21, marginTop: 7, textAlign: "center" }}>{body}</Text>
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

function nextLevelNumber(label: string) {
  const match = label.match(/Level\s+(\d+)/i);
  return match ? Number(match[1]) + 1 : 2;
}

function ordinal(value: number) {
  const suffix = value % 10 === 1 && value % 100 !== 11 ? "st" : value % 10 === 2 && value % 100 !== 12 ? "nd" : value % 10 === 3 && value % 100 !== 13 ? "rd" : "th";
  return `${value}${suffix}`;
}

function formatMonthYear(iso: string) {
  return new Date(iso).toLocaleDateString([], { month: "long", year: "numeric" });
}

function formatActivityDate(iso: string) {
  return new Date(iso).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });
}
