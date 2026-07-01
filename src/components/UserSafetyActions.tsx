import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { Alert, Modal, Pressable, Text, TextInput, View } from "react-native";
import { usePassport } from "@/store/passportStore";
import { AppTheme } from "@/theme";
import { ModerationReportReason } from "@/types";

type Props = {
  targetUserId: string;
  targetName: string;
  groupId?: string;
  checkInId?: string;
  theme: AppTheme;
};

const reasons: Array<{ value: ModerationReportReason; label: string }> = [
  { value: "harassment", label: "Harassment" },
  { value: "hate", label: "Hate or abuse" },
  { value: "sexual_content", label: "Sexual content" },
  { value: "violence", label: "Violence" },
  { value: "spam", label: "Spam" },
  { value: "other", label: "Other" }
];

export function UserSafetyActions({ targetUserId, targetName, groupId, checkInId, theme }: Props) {
  const { user, blockedUserIds, blockUser, unblockUser, reportUser } = usePassport();
  const [reportOpen, setReportOpen] = useState(false);
  const [reason, setReason] = useState<ModerationReportReason>("harassment");
  const [details, setDetails] = useState("");
  const isSelf = targetUserId === user.id;
  const blocked = blockedUserIds.includes(targetUserId);
  if (isSelf) return null;

  function confirmBlock() {
    if (blocked) {
      unblockUser(targetUserId);
      return;
    }
    Alert.alert(`Block ${targetName}?`, "You will no longer see this person's posts. Their beers still count for shared group totals.", [
      { text: "Cancel", style: "cancel" },
      { text: "Block", style: "destructive", onPress: () => blockUser(targetUserId) }
    ]);
  }

  function submitReport() {
    reportUser({ reportedUserId: targetUserId, checkInId, groupId, reason, details });
    setReportOpen(false);
    setDetails("");
    setReason("harassment");
    Alert.alert("Report sent", "Thanks. Pintly will review this report.");
  }

  return (
    <>
      <View style={{ flexDirection: "row", gap: 10 }}>
        <Pressable onPress={() => setReportOpen(true)} style={safetyButton(theme)}>
          <Ionicons name="flag-outline" color={theme.colors.textSecondary} size={17} />
          <Text style={{ color: theme.colors.textSecondary, fontWeight: "900" }}>Report</Text>
        </Pressable>
        <Pressable onPress={confirmBlock} style={[safetyButton(theme), blocked ? { borderColor: theme.colors.danger } : null]}>
          <Ionicons name={blocked ? "ban" : "remove-circle-outline"} color={blocked ? theme.colors.danger : theme.colors.textSecondary} size={17} />
          <Text style={{ color: blocked ? theme.colors.danger : theme.colors.textSecondary, fontWeight: "900" }}>{blocked ? "Unblock" : "Block"}</Text>
        </Pressable>
      </View>
      <Modal visible={reportOpen} transparent animationType="slide" onRequestClose={() => setReportOpen(false)}>
        <Pressable onPress={() => setReportOpen(false)} style={{ flex: 1, justifyContent: "flex-end", backgroundColor: theme.colors.modalBackdrop }}>
          <Pressable onPress={(event) => event.stopPropagation()} style={{ backgroundColor: theme.colors.card, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 20, borderWidth: 1, borderColor: theme.colors.cardBorder }}>
            <Text style={{ color: theme.colors.textPrimary, fontSize: 24, fontWeight: "900" }}>Report {targetName}</Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 16 }}>
              {reasons.map((item) => {
                const active = item.value === reason;
                return (
                  <Pressable key={item.value} onPress={() => setReason(item.value)} style={{ borderRadius: theme.radius.pill, paddingHorizontal: 12, paddingVertical: 9, backgroundColor: active ? theme.colors.accent : theme.colors.surfaceAlt }}>
                    <Text style={{ color: active ? theme.colors.textOnPrimary : theme.colors.textSecondary, fontWeight: "900", fontSize: 12 }}>{item.label}</Text>
                  </Pressable>
                );
              })}
            </View>
            <TextInput
              value={details}
              onChangeText={setDetails}
              placeholder="Add details for the moderator"
              placeholderTextColor={theme.colors.textMuted}
              multiline
              style={{ minHeight: 94, color: theme.colors.textPrimary, backgroundColor: theme.colors.surfaceAlt, borderRadius: theme.radius.md, padding: 12, marginTop: 14, textAlignVertical: "top" }}
            />
            <Pressable onPress={submitReport} style={{ backgroundColor: theme.colors.accent, borderRadius: theme.radius.pill, paddingVertical: 15, alignItems: "center", marginTop: 16 }}>
              <Text style={{ color: theme.colors.textOnPrimary, fontWeight: "900" }}>Submit Report</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

function safetyButton(theme: AppTheme) {
  return {
    flex: 1,
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    gap: 7,
    minHeight: 44,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.surfaceAlt,
    borderWidth: 1,
    borderColor: theme.colors.cardBorder
  };
}
