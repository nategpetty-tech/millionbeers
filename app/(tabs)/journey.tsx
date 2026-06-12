import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ActivityItem } from "@/components/ActivityItem";
import { CheckInModal } from "@/components/CheckInModal";
import { EmptyState } from "@/components/EmptyState";
import { PrimaryButton } from "@/components/PrimaryButton";
import { ProgressBar } from "@/components/ProgressBar";
import { SectionTitle } from "@/components/SectionTitle";
import { StatCard } from "@/components/StatCard";
import { usePassport } from "@/store/passportStore";
import { theme } from "@/theme";
import { formatNumber, percent } from "@/utils/format";

export default function JourneyScreen() {
  const router = useRouter();
  const [checkInOpen, setCheckInOpen] = useState(false);
  const { user, groups, friends, globalCount, challenges, checkIns, initializeSeedData, reactToCheckIn, updateCheckIn, deleteCheckIn } = usePassport();
  const nextChallenge = challenges.find((challenge) => challenge.current < challenge.goal) ?? challenges[0];
  const memberGroups = groups.filter((group) => group.members.some((member) => member.userId === user.id));
  const activeGroups = memberGroups.slice(0, 3);
  const memberGroupIds = new Set(memberGroups.map((group) => group.id));
  const friendIds = new Set(friends.map((friend) => friend.userId));
  const friendActivity = checkIns.filter((checkIn) => friendIds.has(checkIn.userId)).slice(0, 5);
  const groupActivity = checkIns
    .filter((checkIn) => checkIn.groupIds.some((groupId) => memberGroupIds.has(groupId)))
    .slice(0, 5)
    .map((checkIn) => {
      const matchingGroups = checkIn.groupIds
        .map((groupId) => memberGroups.find((group) => group.id === groupId)?.name)
        .filter((name): name is string => Boolean(name));
      return { checkIn, groupLabel: matchingGroups.slice(0, 2).join(", "), extraGroups: Math.max(0, matchingGroups.length - 2) };
    });
  const globalCountText = formatNumber(globalCount);
  const globalCountFontSize = globalCountText.length > 8 ? 38 : globalCountText.length > 6 ? 44 : 50;

  useEffect(() => {
    void initializeSeedData();
    const interval = setInterval(() => {
      void initializeSeedData();
    }, 60000);
    return () => clearInterval(interval);
  }, [initializeSeedData]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 120 }}>
        <View style={{ paddingHorizontal: 20, paddingTop: 14, paddingBottom: 12 }}>
          <View style={{ alignItems: "center", justifyContent: "center", minHeight: 42 }}>
            <Text style={{ color: theme.colors.text, fontFamily: "Georgia", fontSize: 22, fontWeight: "900", letterSpacing: 1 }}>PINTLY</Text>
          </View>
        </View>
        <View style={{ paddingHorizontal: 20, gap: 12 }}>
          <View
            style={{
              backgroundColor: theme.colors.card,
              borderRadius: 24,
              borderWidth: 1,
              borderColor: theme.colors.border,
              padding: 18
            }}
          >
            <Text style={{ color: theme.colors.muted, textAlign: "center", fontSize: 11, fontWeight: "900", letterSpacing: 1 }}>GLOBAL BEER COUNT</Text>
            <Text
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.68}
              style={{ color: theme.colors.neon, fontSize: globalCountFontSize, fontWeight: "900", fontFamily: "Georgia", textAlign: "center", marginTop: 8, marginBottom: 14 }}
            >
              {globalCountText}
              <Text style={{ color: theme.colors.text, fontSize: 19, fontFamily: undefined, fontWeight: "800" }}> / 1,000,000</Text>
            </Text>
            <ProgressBar current={globalCount} goal={1000000} height={12} />
            <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 10 }}>
              <Text style={{ color: theme.colors.neon, fontWeight: "900", fontSize: 12 }}>{percent(globalCount, 1000000)}% complete</Text>
              <Text style={{ color: theme.colors.text, fontSize: 12, fontWeight: "800" }}>{formatNumber(1000000 - globalCount)} to go</Text>
            </View>
          </View>

          <PrimaryButton label="Log a Beer" icon="camera-outline" onPress={() => setCheckInOpen(true)} />

          <View style={{ backgroundColor: theme.colors.card, borderRadius: theme.radius.lg, borderWidth: 1, borderColor: theme.colors.border, padding: 14 }}>
            <Text style={{ color: theme.colors.muted, fontSize: 11, fontWeight: "900", letterSpacing: 1, marginBottom: 12 }}>YOUR CONTRIBUTION</Text>
            <View style={{ flexDirection: "row", gap: 8 }}>
              <StatCard label="Beers" value={formatNumber(user.totalBeers)} />
              <StatCard label="Cities" value={user.cities} accent={theme.colors.gold} />
              <StatCard label="States" value={user.states} />
            </View>
          </View>

          <SectionTitle title="Friends Activity" detail="Beer logs from people you follow outside of groups." />
          {friendActivity.length ? (
            friendActivity.map((checkIn) => (
              <ActivityItem key={checkIn.id} item={checkIn} currentUserId={user.id} onReact={reactToCheckIn} onEdit={updateCheckIn} onDelete={deleteCheckIn} />
            ))
          ) : (
            <EmptyState title="No friend activity yet" body="Add friends from the Friends tab to see where they are logging beers." icon="person-add-outline" />
          )}

          <SectionTitle title="Group Activity" detail="Recent beers from crews you belong to." />
          {groupActivity.length ? (
            groupActivity.map(({ checkIn, groupLabel, extraGroups }) => (
              <View key={checkIn.id}>
                {groupLabel ? (
                  <View
                    style={{
                      alignSelf: "flex-start",
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 6,
                      backgroundColor: theme.colors.neonSoft,
                      borderRadius: theme.radius.pill,
                      borderWidth: 1,
                      borderColor: theme.colors.neon,
                      paddingHorizontal: 10,
                      paddingVertical: 5,
                      marginBottom: 7
                    }}
                  >
                    <Text style={{ color: theme.colors.neon, fontWeight: "900", fontSize: 11 }}>
                      {groupLabel}
                      {extraGroups ? ` +${extraGroups}` : ""}
                    </Text>
                  </View>
                ) : null}
                <ActivityItem item={checkIn} currentUserId={user.id} onReact={reactToCheckIn} onEdit={updateCheckIn} onDelete={deleteCheckIn} />
              </View>
            ))
          ) : (
            <EmptyState title="No group activity yet" body="When you or your friends log beers into shared groups, they will show up here." icon="people-outline" />
          )}

          <SectionTitle title="Your Groups" detail="Goal pace across your current groups." />
          {activeGroups.length ? (
            activeGroups.map((group) => (
              <View
                key={group.id}
                style={{
                  backgroundColor: theme.colors.card,
                  borderRadius: theme.radius.md,
                  borderWidth: 1,
                  borderColor: theme.colors.border,
                  padding: 14
                }}
              >
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
                  <Text style={{ color: theme.colors.text, fontWeight: "900", flex: 1 }}>{group.name}</Text>
                  <Text style={{ color: theme.colors.gold, fontWeight: "900" }}>{percent(group.beerCount, group.goal)}%</Text>
                </View>
                <View style={{ marginTop: 9 }}>
                  <ProgressBar current={group.beerCount} goal={group.goal} />
                </View>
                <Text style={{ color: theme.colors.dim, marginTop: 7 }}>
                  {formatNumber(group.beerCount)} / {formatNumber(group.goal)} beers
                </Text>
              </View>
            ))
          ) : (
            <EmptyState
              title="No crews yet"
              body="Create a group to start a shared beer goal, feed, and leaderboard."
              icon="people-outline"
              actionLabel="Create a Crew"
              onAction={() => router.push("/groups")}
            />
          )}

          <View style={{ backgroundColor: theme.colors.card, borderRadius: theme.radius.lg, borderWidth: 1, borderColor: theme.colors.border, padding: 16 }}>
            <Text style={{ color: theme.colors.text, fontWeight: "900", fontSize: 18 }}>Next Unlock</Text>
            <Text style={{ color: theme.colors.gold, fontWeight: "900", marginTop: 8 }}>{nextChallenge.title}</Text>
            <Text style={{ color: theme.colors.muted, marginTop: 4, lineHeight: 20 }}>{nextChallenge.description}</Text>
            <View style={{ marginTop: 13 }}>
              <ProgressBar current={nextChallenge.current} goal={nextChallenge.goal} color={theme.colors.gold} />
              <Text style={{ color: theme.colors.amber, marginTop: 7, fontWeight: "800" }}>
                {nextChallenge.current} / {nextChallenge.goal} stamps
              </Text>
            </View>
          </View>

          <SectionTitle title="Current Community Goal" detail="Reach 500,000 beers together." />
          <View style={{ backgroundColor: theme.colors.card, borderRadius: theme.radius.lg, borderWidth: 1, borderColor: theme.colors.border, padding: 14 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
              <View>
                <Text style={{ color: theme.colors.neon, fontFamily: "Georgia", fontSize: 28, fontWeight: "900" }}>{percent(globalCount, 500000)}%</Text>
                <Text style={{ color: theme.colors.neon, fontSize: 11, fontWeight: "900" }}>COMPLETE</Text>
              </View>
              <Text style={{ color: theme.colors.muted, flex: 1, textAlign: "right", lineHeight: 18 }}>
                {formatNumber(Math.max(0, 500000 - globalCount))} beers to the next community milestone.
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>
      <CheckInModal visible={checkInOpen} onClose={() => setCheckInOpen(false)} />
    </SafeAreaView>
  );
}
