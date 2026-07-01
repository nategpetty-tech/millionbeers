import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { fetchRemoteAdminReports, updateRemoteReportStatus } from "@/services/pintlyData";
import { useAppTheme } from "@/theme";
import { ModerationReport, ModerationReportStatus } from "@/types";

export default function AdminModerationScreen() {
  const theme = useAppTheme();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [reports, setReports] = useState<ModerationReport[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const nextReports = await fetchRemoteAdminReports();
      setReports(nextReports);
    } catch {
      setError("Moderation reports are unavailable for this account.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function setStatus(reportId: string, status: ModerationReportStatus) {
    try {
      await updateRemoteReportStatus(reportId, status);
      setReports((current) => current.map((report) => report.id === reportId ? { ...report, status } : report));
    } catch {
      Alert.alert("Could not update report", "Try again in a moment.");
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 100 }}>
        <Pressable onPress={() => router.back()} hitSlop={10} style={{ alignSelf: "flex-start", padding: 6 }}>
          <Ionicons name="chevron-back" color={theme.colors.textPrimary} size={28} />
        </Pressable>
        <Text style={{ color: theme.colors.textPrimary, fontSize: 32, fontWeight: "900", marginTop: 8 }}>Moderation</Text>
        <Text style={{ color: theme.colors.textSecondary, lineHeight: 21, marginTop: 6 }}>Review user reports and mark the moderation outcome.</Text>
        {loading ? (
          <View style={{ paddingVertical: 40, alignItems: "center" }}>
            <ActivityIndicator color={theme.colors.accent} />
          </View>
        ) : error ? (
          <Text style={{ color: theme.colors.textSecondary, marginTop: 24, lineHeight: 21 }}>{error}</Text>
        ) : reports.length ? (
          <View style={{ gap: 12, marginTop: 22 }}>
            {reports.map((report) => (
              <View key={report.id} style={{ borderRadius: theme.radius.lg, backgroundColor: theme.colors.card, borderWidth: 1, borderColor: theme.colors.cardBorder, padding: 14 }}>
                <Text style={{ color: theme.colors.textPrimary, fontWeight: "900", fontSize: 16 }}>{report.reportedUserName ?? "Reported user"}</Text>
                <Text style={{ color: theme.colors.textSecondary, marginTop: 4 }}>
                  Reported by {report.reporterName ?? "Pintly user"} · {report.reason.replace("_", " ")}
                </Text>
                {report.details ? <Text style={{ color: theme.colors.textPrimary, marginTop: 10, lineHeight: 20 }}>{report.details}</Text> : null}
                <Text style={{ color: theme.colors.textMuted, marginTop: 9, fontSize: 12 }}>{new Date(report.createdAt).toLocaleString()}</Text>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 12 }}>
                  {(["reviewed", "dismissed", "actioned"] as ModerationReportStatus[]).map((status) => (
                    <Pressable key={status} onPress={() => void setStatus(report.id, status)} style={{ borderRadius: theme.radius.pill, backgroundColor: report.status === status ? theme.colors.accent : theme.colors.surfaceAlt, paddingHorizontal: 11, paddingVertical: 8 }}>
                      <Text style={{ color: report.status === status ? theme.colors.textOnPrimary : theme.colors.textSecondary, fontWeight: "900", fontSize: 12 }}>{status}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            ))}
          </View>
        ) : (
          <Text style={{ color: theme.colors.textSecondary, marginTop: 24 }}>No reports to review.</Text>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
