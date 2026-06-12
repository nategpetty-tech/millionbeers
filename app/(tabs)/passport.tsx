import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { Modal, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ActivityItem } from "@/components/ActivityItem";
import { Avatar } from "@/components/Avatar";
import { BadgeIcon } from "@/components/BadgeIcon";
import { FriendsPanel } from "@/components/FriendsPanel";
import { ProgressBar } from "@/components/ProgressBar";
import { ProfileModal } from "@/components/ProfileModal";
import { ScreenHeader } from "@/components/ScreenHeader";
import { SectionTitle } from "@/components/SectionTitle";
import { StatCard } from "@/components/StatCard";
import { useAuth } from "@/store/authStore";
import { usePassport } from "@/store/passportStore";
import { theme } from "@/theme";
import { Badge, Challenge } from "@/types";
import { formatNumber } from "@/utils/format";

export default function PassportScreen() {
  const [profileOpen, setProfileOpen] = useState(false);
  const [selectedStamp, setSelectedStamp] = useState<Challenge | null>(null);
  const { profile, signOut } = useAuth();
  const { user, checkIns, challenges, badges, initializeSeedData, reactToCheckIn, updateCheckIn, deleteCheckIn } = usePassport();
  const personalActivity = checkIns.filter((item) => item.userId === user.id).slice(0, 6);
  const completed = challenges.filter((challenge) => challenge.current >= challenge.goal).length;
  const completedStamps = challenges.filter((challenge) => challenge.current >= challenge.goal);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 120 }}>
        <ScreenHeader title="Passport" subtitle="Your Pintly profile, badges, activity, and beer identity." />
        <View style={{ paddingHorizontal: 20, gap: 14 }}>
          <View style={{ backgroundColor: theme.colors.card, borderRadius: 28, borderWidth: 1, borderColor: theme.colors.border, padding: 20 }}>
            <View style={{ flexDirection: "row", gap: 14, alignItems: "center" }}>
              <Avatar label={user.avatar} uri={user.avatarUrl} size={72} borderColor={theme.colors.neon} />
              <View style={{ flex: 1 }}>
                <Text style={{ color: theme.colors.text, fontSize: 24, fontWeight: "900" }}>{user.name || "Pintly User"}</Text>
                <Text style={{ color: theme.colors.gold, marginTop: 4, fontWeight: "900" }}>Level {user.level} Pintly Collector</Text>
                {profile?.email ? <Text style={{ color: theme.colors.dim, marginTop: 3 }}>{profile.email}</Text> : null}
              </View>
              <Pressable onPress={() => setProfileOpen(true)} style={{ padding: 8 }}>
                <Ionicons name="create-outline" color={theme.colors.neon} size={22} />
              </Pressable>
            </View>
            <View style={{ marginTop: 18 }}>
              <ProgressBar current={user.xp} goal={user.xpGoal} color={theme.colors.gold} />
              <Text style={{ color: theme.colors.amber, marginTop: 7, fontWeight: "800" }}>
                {user.xp} / {user.xpGoal} XP
              </Text>
            </View>
          </View>

          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
            <StatCard label="Total beers" value={formatNumber(user.totalBeers)} />
            <StatCard label="Cities" value={user.cities} />
            <StatCard label="States" value={user.states} accent={theme.colors.gold} />
            <StatCard label="Badges" value={user.badges.length} />
            <StatCard label="Challenges" value={completed || user.challengesCompleted} accent={theme.colors.gold} />
          </View>

          <FriendsPanel />

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
            <View style={{ backgroundColor: theme.colors.card, borderRadius: theme.radius.lg, borderWidth: 1, borderColor: theme.colors.border, padding: 16 }}>
              <Text style={{ color: theme.colors.text, fontWeight: "900" }}>No badges yet</Text>
              <Text style={{ color: theme.colors.muted, marginTop: 5 }}>Your first badge will unlock after real check-ins.</Text>
            </View>
          )}

          <SectionTitle title="Collection Routes" detail="Progress from places, crews, and Pintly milestones." />
          {[
            { label: "Cities", current: user.cities, goal: 50 },
            { label: "States", current: user.states, goal: 50 },
            { label: "Group stamps", current: personalActivity.filter((item) => item.groupIds.length > 0).length, goal: 100 }
          ].map((route) => {
            return (
              <View key={route.label} style={{ backgroundColor: theme.colors.card, borderRadius: theme.radius.md, padding: 14, borderWidth: 1, borderColor: theme.colors.border }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                  <Text style={{ color: theme.colors.text, fontWeight: "900" }}>{route.label}</Text>
                  <Text style={{ color: theme.colors.gold, fontWeight: "900" }}>
                    {route.current} / {route.goal}
                  </Text>
                </View>
                <View style={{ marginTop: 8 }}>
                  <ProgressBar current={route.current} goal={route.goal} />
                </View>
              </View>
            );
          })}

          <SectionTitle title="Personal Activity" />
          {personalActivity.length ? (
            personalActivity.map((item) => (
              <ActivityItem key={item.id} item={item} currentUserId={user.id} onReact={reactToCheckIn} onEdit={updateCheckIn} onDelete={deleteCheckIn} />
            ))
          ) : (
            <View style={{ backgroundColor: theme.colors.card, borderRadius: theme.radius.lg, borderWidth: 1, borderColor: theme.colors.border, padding: 16 }}>
              <Text style={{ color: theme.colors.text, fontWeight: "900" }}>No personal stamps yet</Text>
              <Text style={{ color: theme.colors.muted, marginTop: 5 }}>Use Log a Beer to create your first real entry.</Text>
            </View>
          )}

          <Pressable onPress={() => void initializeSeedData()} style={{ alignSelf: "center", paddingVertical: 12, paddingHorizontal: 16 }}>
            <Text style={{ color: theme.colors.dim, fontWeight: "800" }}>Refresh cloud data</Text>
          </Pressable>

          <Pressable
            onPress={() => void signOut()}
            style={{
              alignSelf: "center",
              paddingVertical: 12,
              paddingHorizontal: 18,
              borderRadius: theme.radius.pill,
              borderWidth: 1,
              borderColor: theme.colors.border
            }}
          >
            <Text style={{ color: theme.colors.muted, fontWeight: "900" }}>Sign out</Text>
          </Pressable>

          <View style={{ backgroundColor: theme.colors.card, borderRadius: theme.radius.lg, borderWidth: 1, borderColor: theme.colors.border, padding: 16 }}>
            <Text style={{ color: theme.colors.text, fontWeight: "900" }}>Privacy</Text>
            <Text style={{ color: theme.colors.muted, marginTop: 6, lineHeight: 20 }}>
              Pintly asks for camera and location only when you create a stamp. Account sessions are handled by Supabase, and photos upload to Pintly storage when configured.
            </Text>
          </View>
        </View>
      </ScrollView>
      <ProfileModal visible={profileOpen} onClose={() => setProfileOpen(false)} />
      <ChallengeStampModal
        challenge={selectedStamp}
        badge={selectedStamp ? badges.find((badge) => badge.id === selectedStamp.rewardBadgeId) : undefined}
        onClose={() => setSelectedStamp(null)}
      />
    </SafeAreaView>
  );
}

function ChallengeStampModal({ challenge, badge, onClose }: { challenge: Challenge | null; badge?: Badge; onClose: () => void }) {
  if (!challenge) return null;

  return (
    <Modal visible animationType="fade" transparent onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: "rgba(0, 0, 0, 0.72)", justifyContent: "center", padding: 22 }}>
        <View
          style={{
            backgroundColor: theme.colors.card,
            borderRadius: 28,
            borderWidth: 1,
            borderColor: theme.colors.gold,
            padding: 20
          }}
        >
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
            <View style={{ flexDirection: "row", gap: 14, flex: 1 }}>
              <BadgeIcon icon={challenge.icon} size={58} />
              <View style={{ flex: 1 }}>
                <Text style={{ color: theme.colors.gold, fontWeight: "900", letterSpacing: 1, fontSize: 12 }}>COMPLETED CHALLENGE</Text>
                <Text style={{ color: theme.colors.text, fontSize: 24, fontWeight: "900", fontFamily: "Georgia", marginTop: 4 }}>
                  {challenge.title}
                </Text>
              </View>
            </View>
            <Pressable onPress={onClose} hitSlop={10}>
              <Ionicons name="close" color={theme.colors.text} size={24} />
            </Pressable>
          </View>

          <Text style={{ color: theme.colors.muted, lineHeight: 21, marginTop: 16 }}>{challenge.description}</Text>

          <View style={{ marginTop: 18 }}>
            <ProgressBar current={challenge.current} goal={challenge.goal} color={theme.colors.gold} />
            <Text style={{ color: theme.colors.amber, fontWeight: "900", marginTop: 8 }}>
              {challenge.current} / {challenge.goal} completed
            </Text>
          </View>

          <View
            style={{
              backgroundColor: theme.colors.surface,
              borderRadius: theme.radius.lg,
              borderWidth: 1,
              borderColor: theme.colors.border,
              padding: 14,
              marginTop: 18
            }}
          >
            <Text style={{ color: theme.colors.text, fontWeight: "900" }}>Reward badge</Text>
            <Text style={{ color: theme.colors.muted, marginTop: 5, lineHeight: 20 }}>
              {badge ? `${badge.title}: ${badge.description}` : "Badge reward unlocked for this challenge."}
            </Text>
          </View>

          <Pressable
            onPress={onClose}
            style={{
              backgroundColor: theme.colors.neon,
              borderRadius: theme.radius.pill,
              paddingVertical: 14,
              alignItems: "center",
              marginTop: 18
            }}
          >
            <Text style={{ color: theme.colors.ink, fontWeight: "900" }}>Done</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}
