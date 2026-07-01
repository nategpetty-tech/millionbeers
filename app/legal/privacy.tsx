import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { ScrollView, Text, Pressable, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAppTheme } from "@/theme";

const policySections = [
  {
    title: "Overview / Scope",
    body:
      "This Privacy Policy explains how Pintly collects, uses, shares, and protects information when you use the Pintly mobile app and related services. Pintly is a social beer-tracking app where users can create accounts, log beers, upload photos, join groups, interact with friends, report or block users, receive push notifications, and optionally use location-based venue suggestions."
  },
  {
    title: "Age Requirement",
    body:
      "Pintly is intended only for users who are 21 years of age or older. We do not knowingly allow users under 21 to create accounts or use Pintly. If we learn that a user under 21 has created an account, we may delete the account and associated information. We do not knowingly collect personal information from children under 13."
  },
  {
    title: "Information We Collect",
    body:
      "We collect account information such as email address, display name, username, profile photo, authentication identifiers, and related settings. We also collect beer logs, uploaded photos, captions or notes, group memberships, group activity, reactions, reports, blocks, safety-related actions, friend interactions, and group join requests. When location features are used, we may collect GPS coordinates, approximate location, city/state, suggested venue results, confirmed venue names, venue or place identifiers, and related check-in details. We and our service providers may collect device type, operating system, app version, IP address or similar technical metadata, usage information, crash logs, diagnostics, push notification tokens, and support communications."
  },
  {
    title: "How We Use Information",
    body:
      "We use information to create and maintain accounts, let users log beers, upload photos, join groups, view feeds, interact with friends, suggest nearby venues, display group totals, leaderboards, stats, and app activity, send push notifications, provide support, moderate content, prevent abuse, debug issues, improve reliability, enforce terms, and comply with legal obligations."
  },
  {
    title: "Location, Camera, Photos, and Venue Suggestions",
    body:
      "Pintly asks for location permission when you use features that rely on location or venue suggestions, such as logging a beer with a location or finding nearby venues. Pintly does not need continuous background location tracking for normal use unless that feature is explicitly added later. You can confirm a suggested venue, choose another venue, or skip venue selection. If you confirm a venue and log the beer, Pintly may store the confirmed venue name, venue or place identifier, approximate location, city/state, and associated check-in information. Location or venue information may be shown to other users through Pintly features depending on app settings. Camera and photo library access are used only when you choose to take, upload, or edit photos."
  },
  {
    title: "Sharing and Visibility",
    body:
      "Some profile information and activity may be visible to other Pintly users depending on Pintly’s features and settings. Beer logs, photos, captions or notes, reactions, stats, venue or check-in details, leaderboards, and profile information may be visible depending on app design, group membership, and privacy settings if available. Group activity may be visible to members of the relevant group. Blocking or reporting another user may limit what you see or help us review safety issues, but it may not remove historical contributions from aggregate group totals, leaderboards, or other app stats."
  },
  {
    title: "Service Providers",
    body:
      "Pintly uses service providers to operate the app. Supabase provides authentication, database, backend, and related infrastructure services. Cloudflare R2 and related Cloudflare services may be used for image and file storage or delivery. Sentry may be used for crash reporting, error reporting, and diagnostics. Expo, Apple, or similar providers may process push notification tokens and notification delivery data. Foursquare or another places, maps, or point-of-interest provider may process your location or search query when Pintly requests nearby venue results."
  },
  {
    title: "Data Retention",
    body:
      "Pintly keeps account information while your account is active. Beer logs, photos, group activity, reactions, reports, blocks, and similar content are kept until deleted by you, affected by account deletion, or no longer needed for app functionality. Some limited information may be retained for backups, safety, abuse prevention, legal compliance, dispute resolution, or aggregate and anonymized stats."
  },
  {
    title: "Account Deletion",
    body:
      "You can initiate account deletion from inside the app by going to Profile -> Settings -> Delete account. When you delete your account, Pintly will delete or anonymize personal account data where reasonably possible. Photos and user-generated content will be deleted or disconnected from your account unless retention is necessary for safety, abuse prevention, legal compliance, backups, dispute resolution, or aggregate and anonymized statistics."
  },
  {
    title: "User Choices and Rights",
    body:
      "You can update profile information in the app. Where supported, you can delete certain content you created. You can disable push notifications, location access, camera access, and photo library access in your device settings. Depending on where you live, you may have rights to request access, correction, deletion, portability, objection, or other controls over your personal information."
  },
  {
    title: "Security",
    body:
      "Pintly uses reasonable administrative, technical, and organizational safeguards to protect information. No app, network, or storage system is perfectly secure, so we cannot guarantee absolute security."
  },
  {
    title: "International and State Privacy",
    body:
      "Depending on where you live, additional privacy laws may apply. Pintly will respond to applicable privacy requests as required by law. Contact us using the email below to exercise rights that may apply to you."
  },
  {
    title: "Changes to This Policy",
    body:
      "Pintly may update this Privacy Policy from time to time. When we make changes, we will update the effective date. Material changes may also be communicated in the app or by other reasonable means."
  },
  {
    title: "Contact",
    body: "For privacy requests, contact Pintly at nade.million.beers@gmail.com."
  }
];

export default function PrivacyPolicyScreen() {
  const theme = useAppTheme();
  const router = useRouter();
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <ScrollView contentContainerStyle={{ padding: 22, paddingBottom: 80 }}>
        <Pressable onPress={() => router.back()} hitSlop={10} style={{ alignSelf: "flex-start", padding: 6, marginBottom: 10 }}>
          <Ionicons name="chevron-back" color={theme.colors.textPrimary} size={28} />
        </Pressable>
        <Text style={{ color: theme.colors.textPrimary, fontSize: 32, fontWeight: "900" }}>Privacy Policy</Text>
        <Text style={{ color: theme.colors.textSecondary, marginTop: 8, lineHeight: 21 }}>Effective date: June 21, 2026</Text>
        {policySections.map((section) => (
          <PolicySection key={section.title} title={section.title} body={section.body} />
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

function PolicySection({ title, body }: { title: string; body: string }) {
  const theme = useAppTheme();
  return (
    <View style={{ marginTop: 22 }}>
      <Text style={{ color: theme.colors.textPrimary, fontSize: 18, fontWeight: "900" }}>{title}</Text>
      <Text style={{ color: theme.colors.textSecondary, marginTop: 7, lineHeight: 22 }}>{body}</Text>
    </View>
  );
}
