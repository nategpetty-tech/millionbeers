import { ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ChallengeCard } from "@/components/ChallengeCard";
import { EmptyState } from "@/components/EmptyState";
import { ScreenHeader } from "@/components/ScreenHeader";
import { usePassport } from "@/store/passportStore";
import { theme } from "@/theme";

export default function ChallengesScreen() {
  const { challenges } = usePassport();
  const activeChallenges = challenges.filter((challenge) => challenge.current < challenge.goal);
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 120 }}>
        <ScreenHeader title="Challenges" subtitle="Progress tracks from beers, crews, cities, states, and GPS-backed stamps." />
        <View style={{ paddingHorizontal: 20 }}>
          {activeChallenges.length ? (
            activeChallenges.map((challenge) => <ChallengeCard key={challenge.id} challenge={challenge} />)
          ) : (
            <EmptyState title="All challenges complete" body="Completed challenge stamps now live in your Profile badges." icon="trophy-outline" />
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
