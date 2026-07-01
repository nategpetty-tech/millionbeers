import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { ScrollView, Text, Pressable, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAppTheme } from "@/theme";

export default function TermsOfServiceScreen() {
  const theme = useAppTheme();
  const router = useRouter();
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <ScrollView contentContainerStyle={{ padding: 22, paddingBottom: 80 }}>
        <Pressable onPress={() => router.back()} hitSlop={10} style={{ alignSelf: "flex-start", padding: 6, marginBottom: 10 }}>
          <Ionicons name="chevron-back" color={theme.colors.textPrimary} size={28} />
        </Pressable>
        <Text style={{ color: theme.colors.textPrimary, fontSize: 32, fontWeight: "900" }}>Terms of Service</Text>
        <Text style={{ color: theme.colors.textSecondary, marginTop: 8, lineHeight: 21 }}>Effective date: June 21, 2026</Text>
        <TermsSection title="Using Pintly" body="Pintly is for personal beer logging, group sharing, and friendly competition. You are responsible for the content you post and for following applicable laws." />
        <TermsSection title="User Content" body="Do not post illegal, abusive, hateful, harassing, sexually explicit, or spam content. Pintly may remove content or restrict accounts that violate these terms." />
        <TermsSection title="Safety Tools" body="You can report users or block users from member profiles and posts. Blocking hides a user’s posts from your view while preserving group totals." />
        <TermsSection title="Account Deletion" body="You can delete your account from Profile settings. Some records may be retained or anonymized for safety, abuse prevention, legal compliance, and group integrity." />
        <TermsSection title="No Warranty" body="Pintly is provided as-is. Features may change, and venue suggestions or leaderboards may not always be complete or accurate." />
        <TermsSection title="Contact" body="Questions about these terms can be sent to nade.million.beers@gmail.com." />
      </ScrollView>
    </SafeAreaView>
  );
}

function TermsSection({ title, body }: { title: string; body: string }) {
  const theme = useAppTheme();
  return (
    <View style={{ marginTop: 22 }}>
      <Text style={{ color: theme.colors.textPrimary, fontSize: 18, fontWeight: "900" }}>{title}</Text>
      <Text style={{ color: theme.colors.textSecondary, marginTop: 7, lineHeight: 22 }}>{body}</Text>
    </View>
  );
}
