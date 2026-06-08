import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { Alert, ImageBackground, Pressable, ScrollView, Share, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ActivityItem } from "@/components/ActivityItem";
import { Avatar } from "@/components/Avatar";
import { EmptyState } from "@/components/EmptyState";
import { LeaderboardRow } from "@/components/LeaderboardRow";
import { ProgressBar } from "@/components/ProgressBar";
import { SectionTitle } from "@/components/SectionTitle";
import { StatCard } from "@/components/StatCard";
import { isGroupBackdropStorageConfigured, uploadGroupBackdrop } from "@/services/photoStorage";
import { usePassport } from "@/store/passportStore";
import { theme } from "@/theme";
import { formatNumber, percent } from "@/utils/format";
import { groupPhotoFor } from "@/utils/groupVisuals";

type Segment = "Overview" | "Activity" | "Leaderboard" | "Stats";

export default function GroupDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [segment, setSegment] = useState<Segment>("Overview");
  const {
    groups,
    user,
    getGroupActivity,
    getGroupLeaderboard,
    getGroupStats,
    reactToCheckIn,
    deleteCheckIn,
    approveJoinRequest,
    rejectJoinRequest,
    updateGroupBackdrop
  } = usePassport();
  const group = groups.find((item) => item.id === id);
  const activity = useMemo(() => (group ? getGroupActivity(group.id) : []), [group, getGroupActivity]);
  const leaderboard = group ? getGroupLeaderboard(group.id, "beers") : [];
  const stats = group ? getGroupStats(group.id) : null;
  const isFounder = group?.founderId === user.id;
  const pendingRequests = group?.pendingRequests.filter((request) => request.status === "pending") ?? [];
  const heroImage = group ? group.backdropUrl ?? groupPhotoFor(group.name) : undefined;

  async function shareInvite() {
    if (!group) return;
    const link = `pintly://groups/join?code=${group.inviteCode}`;
    try {
      await Share.share({
        title: `Join ${group.name} on Pintly`,
        message: `Join my Pintly group "${group.name}". Search invite code ${group.inviteCode} or open ${link}`
      });
    } catch {
      Alert.alert("Invite code", group.inviteCode);
    }
  }

  async function changeBackdrop() {
    if (!group || !isFounder) return;
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Photo access needed", "Allow photo library access to choose a custom group backdrop.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      allowsEditing: true,
      aspect: [16, 9],
      quality: 0.82
    });

    if (result.canceled || !result.assets[0]?.uri) return;

    try {
      const localUri = result.assets[0].uri;
      if (isGroupBackdropStorageConfigured()) {
        const uploaded = await uploadGroupBackdrop(localUri, user.id);
        updateGroupBackdrop(group.id, { backdropUrl: uploaded.signedUrl, backdropStoragePath: uploaded.storagePath });
        return;
      }
      updateGroupBackdrop(group.id, { backdropUrl: localUri });
    } catch {
      Alert.alert("Backdrop upload failed", "The custom backdrop could not upload. Try again in a moment.");
    }
  }

  if (!group) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background, padding: 20 }}>
        <Pressable onPress={() => router.back()} style={{ paddingVertical: 12 }}>
          <Text style={{ color: theme.colors.neon, fontWeight: "900" }}>Back</Text>
        </Pressable>
        <EmptyState title="Group not found" body="This Pintly crew is not available in local storage." />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 120 }}>
        <View style={{ padding: 20, paddingBottom: 10 }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <Pressable onPress={() => router.back()} style={{ padding: 6 }}>
              <Ionicons name="arrow-back" color={theme.colors.text} size={22} />
            </Pressable>
            <Text style={{ color: theme.colors.text, fontFamily: "Georgia", fontSize: 18, fontWeight: "900" }}>{group.name.toUpperCase()}</Text>
            <Pressable onPress={() => void shareInvite()} style={{ padding: 6 }}>
              <Ionicons name="settings-outline" color={theme.colors.text} size={22} />
            </Pressable>
          </View>
          <View style={{ backgroundColor: theme.colors.card, borderRadius: theme.radius.lg, borderWidth: 1, borderColor: theme.colors.border, overflow: "hidden" }}>
            <ImageBackground source={{ uri: heroImage }} style={{ height: 165, justifyContent: "space-between" }} resizeMode="cover">
              <View style={{ alignItems: "flex-end", padding: 12 }}>
                {isFounder ? (
                  <Pressable
                    onPress={() => void changeBackdrop()}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 6,
                      backgroundColor: "rgba(0,0,0,0.58)",
                      borderRadius: theme.radius.pill,
                      paddingHorizontal: 11,
                      paddingVertical: 8,
                      borderWidth: 1,
                      borderColor: "rgba(255,255,255,0.18)"
                    }}
                  >
                    <Ionicons name="image-outline" color={theme.colors.text} size={16} />
                    <Text style={{ color: theme.colors.text, fontWeight: "900", fontSize: 12 }}>Backdrop</Text>
                  </Pressable>
                ) : null}
              </View>
              <View style={{ padding: 14 }}>
                <Text style={{ color: theme.colors.gold, fontSize: 11, fontWeight: "900", letterSpacing: 1, textShadowColor: "rgba(0,0,0,0.75)", textShadowRadius: 8 }}>
                  {group.privacy.toUpperCase()}
                </Text>
                <Text
                  style={{
                    color: theme.colors.text,
                    fontSize: 25,
                    fontWeight: "900",
                    fontFamily: "Georgia",
                    marginTop: 4,
                    textShadowColor: "rgba(0,0,0,0.85)",
                    textShadowRadius: 10
                  }}
                >
                  {group.name}
                </Text>
                {group.description ? (
                  <Text style={{ color: theme.colors.text, marginTop: 4, textShadowColor: "rgba(0,0,0,0.85)", textShadowRadius: 8 }}>{group.description}</Text>
                ) : null}
              </View>
            </ImageBackground>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 10,
                backgroundColor: theme.colors.surface,
                borderRadius: theme.radius.md,
                borderWidth: 1,
                borderColor: theme.colors.border,
                padding: 12,
                margin: 14,
                marginBottom: 0
              }}
            >
              <View style={{ flex: 1 }}>
                <Text style={{ color: theme.colors.dim, fontSize: 11, fontWeight: "900" }}>INVITE CODE</Text>
                <Text style={{ color: theme.colors.text, fontWeight: "900", fontSize: 18, marginTop: 2 }}>{group.inviteCode}</Text>
              </View>
              <Pressable
                onPress={() => void shareInvite()}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 6,
                  backgroundColor: theme.colors.neon,
                  borderRadius: theme.radius.pill,
                  paddingHorizontal: 12,
                  paddingVertical: 9
                }}
              >
                <Ionicons name="share-outline" color={theme.colors.ink} size={17} />
                <Text style={{ color: theme.colors.ink, fontWeight: "900" }}>Share</Text>
              </Pressable>
            </View>
            <View style={{ paddingHorizontal: 14, paddingTop: 16 }}>
              <Text style={{ color: theme.colors.muted, fontSize: 11, fontWeight: "900", letterSpacing: 1 }}>GROUP BEER TRACKER</Text>
              <Text style={{ color: theme.colors.text, fontSize: 34, fontWeight: "900", marginTop: 7 }}>
                <Text style={{ color: theme.colors.neon, fontFamily: "Georgia" }}>{formatNumber(group.beerCount)}</Text>{" "}
                <Text style={{ color: theme.colors.text, fontSize: 25 }}>/ {formatNumber(group.goal)}</Text>
              </Text>
              <Text style={{ color: theme.colors.text, marginTop: 2, fontSize: 13 }}>Beers</Text>
              <View style={{ flexDirection: "row", gap: 10, marginTop: 12 }}>
                <View style={{ flex: 1, backgroundColor: theme.colors.surface, borderRadius: theme.radius.md, padding: 12 }}>
                  <Text style={{ color: theme.colors.gold, fontWeight: "900", fontSize: 20 }}>{group.memberCount}</Text>
                  <Text style={{ color: theme.colors.muted, marginTop: 2, fontSize: 12 }}>Members</Text>
                </View>
                <View style={{ flex: 1, backgroundColor: theme.colors.surface, borderRadius: theme.radius.md, padding: 12 }}>
                  <Text style={{ color: theme.colors.neon, fontWeight: "900", fontSize: 20 }}>{formatNumber(group.beerCount)}</Text>
                  <Text style={{ color: theme.colors.muted, marginTop: 2, fontSize: 12 }}>Total beers</Text>
                </View>
              </View>
            </View>
            <View style={{ padding: 14, paddingTop: 12 }}>
              <ProgressBar current={group.beerCount} goal={group.goal} height={8} />
              <Text style={{ color: theme.colors.neon, fontWeight: "900", marginTop: 8, textAlign: "right" }}>{percent(group.beerCount, group.goal)}%</Text>
            </View>
          </View>

          <View style={{ flexDirection: "row", gap: 8, marginTop: 14, borderBottomWidth: 1, borderBottomColor: theme.colors.border }}>
            {(["Overview", "Activity", "Leaderboard", "Stats"] as Segment[]).map((item) => (
              <Pressable
                key={item}
                onPress={() => setSegment(item)}
                style={{
                  flex: 1,
                  paddingVertical: 10,
                  alignItems: "center",
                  borderBottomWidth: 2,
                  borderBottomColor: segment === item ? theme.colors.neon : "transparent"
                }}
              >
                <Text style={{ color: segment === item ? theme.colors.neon : theme.colors.muted, fontSize: 11, fontWeight: "900" }}>{item}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={{ paddingHorizontal: 20 }}>
          {segment === "Overview" ? (
            <View style={{ gap: 14 }}>
              {isFounder ? (
                <View style={{ backgroundColor: theme.colors.card, borderRadius: theme.radius.lg, borderWidth: 1, borderColor: theme.colors.border, padding: 16 }}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                    <Text style={{ color: theme.colors.text, fontSize: 18, fontWeight: "900" }}>Join Requests</Text>
                    <Text style={{ color: theme.colors.gold, fontWeight: "900" }}>{pendingRequests.length}</Text>
                  </View>
                  {pendingRequests.length ? (
                    pendingRequests.map((request) => (
                      <View
                        key={request.id}
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 10,
                          paddingVertical: 10,
                          borderTopWidth: 1,
                          borderTopColor: theme.colors.border
                        }}
                      >
                        <Avatar label={request.avatar} uri={request.avatarUrl} size={38} borderColor={theme.colors.neon} />
                        <View style={{ flex: 1 }}>
                          <Text style={{ color: theme.colors.text, fontWeight: "900" }}>{request.name}</Text>
                          <Text style={{ color: theme.colors.muted, marginTop: 2 }}>{request.source === "invite" ? "Used invite code" : "Found by search"}</Text>
                        </View>
                        <Pressable onPress={() => approveJoinRequest(group.id, request.id)} style={{ padding: 8 }}>
                          <Ionicons name="checkmark-circle" color={theme.colors.neon} size={26} />
                        </Pressable>
                        <Pressable onPress={() => rejectJoinRequest(group.id, request.id)} style={{ padding: 8 }}>
                          <Ionicons name="close-circle" color={theme.colors.danger} size={26} />
                        </Pressable>
                      </View>
                    ))
                  ) : (
                    <Text style={{ color: theme.colors.muted, lineHeight: 19 }}>Requests from search and invite links will appear here for founder approval.</Text>
                  )}
                </View>
              ) : null}
              <SectionTitle title="Group Feed" />
              {activity.length ? (
                activity.map((item) => <ActivityItem key={item.id} item={item} currentUserId={user.id} onReact={reactToCheckIn} onDelete={deleteCheckIn} />)
              ) : (
                <EmptyState title="No check-ins yet" body="Log the first beer and it will appear in this group's feed." />
              )}
            </View>
          ) : null}

          {segment === "Activity" ? (
            <View>
              {activity.length ? (
                activity.map((item) => <ActivityItem key={item.id} item={item} currentUserId={user.id} onReact={reactToCheckIn} onDelete={deleteCheckIn} />)
              ) : (
                <EmptyState title="No activity" body="Group check-ins will appear here as members log beers." />
              )}
            </View>
          ) : null}

          {segment === "Leaderboard" ? (
            <View>
              {leaderboard.map((member, index) => (
                <LeaderboardRow key={member.userId} member={member} rank={index + 1} mode="beers" />
              ))}
            </View>
          ) : null}

          {segment === "Stats" && stats ? (
            <View style={{ gap: 14 }}>
              <View style={{ flexDirection: "row", gap: 10 }}>
                <StatCard label="This week" value={stats.weeklyTotal} />
                <StatCard label="This month" value={stats.monthlyTotal} accent={theme.colors.gold} />
              </View>
              <View style={{ backgroundColor: theme.colors.card, borderRadius: theme.radius.lg, borderWidth: 1, borderColor: theme.colors.border, padding: 16 }}>
                <Text style={{ color: theme.colors.text, fontSize: 18, fontWeight: "900", marginBottom: 10 }}>Milestones</Text>
                {stats.milestones.map((milestone) => (
                  <View key={milestone.label} style={{ flexDirection: "row", alignItems: "center", gap: 10, marginVertical: 6 }}>
                    <Ionicons name={milestone.complete ? "checkmark-circle" : "ellipse-outline"} color={milestone.complete ? theme.colors.neon : theme.colors.dim} size={20} />
                    <Text style={{ color: milestone.complete ? theme.colors.text : theme.colors.muted }}>{milestone.label}</Text>
                  </View>
                ))}
              </View>
            </View>
          ) : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
