import { Redirect } from "expo-router";
import { ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ActivityItem } from "@/components/ActivityItem";
import { EmptyState } from "@/components/EmptyState";
import { FriendsPanel } from "@/components/FriendsPanel";
import { ScreenHeader } from "@/components/ScreenHeader";
import { SectionTitle } from "@/components/SectionTitle";
import { friendsFeatureEnabled } from "@/config/features";
import { usePassport } from "@/store/passportStore";
import { theme } from "@/theme";

export default function FriendsScreen() {
  if (!friendsFeatureEnabled) return <Redirect href="/journey" />;

  return <EnabledFriendsScreen />;
}

function EnabledFriendsScreen() {
  const { friends, checkIns, user, reactToCheckIn, updateCheckIn, deleteCheckIn } = usePassport();
  const friendIds = new Set(friends.map((friend) => friend.userId));
  const friendActivity = checkIns.filter((checkIn) => friendIds.has(checkIn.userId)).slice(0, 20);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 120 }}>
        <ScreenHeader title="Friends" subtitle="Find friends, approve requests, and see beer logs outside of groups." />
        <View style={{ paddingHorizontal: 20, gap: 14 }}>
          <FriendsPanel />

          <SectionTitle title="Friends Feed" detail="Recent beer logs from people you are connected with." />
          {friendActivity.length ? (
            friendActivity.map((item) => (
              <ActivityItem key={item.id} item={item} currentUserId={user.id} onReact={reactToCheckIn} onEdit={updateCheckIn} onDelete={deleteCheckIn} />
            ))
          ) : (
            <EmptyState title="No friend activity yet" body="Add a friend and their beer logs will appear here." icon="people-outline" />
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
