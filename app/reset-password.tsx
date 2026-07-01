import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Alert, Pressable, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "@/store/authStore";
import { theme } from "@/theme";
import { isStrongPassword, passwordRequirements } from "@/utils/accountValidation";

export default function ResetPasswordScreen() {
  const router = useRouter();
  const { updatePassword } = useAuth();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const canSubmit = isStrongPassword(password) && password === confirmPassword && !busy;

  async function submit() {
    if (!canSubmit) return;
    setBusy(true);
    try {
      await updatePassword(password);
      Alert.alert("Password updated", "You can keep using Pintly with your new password.");
      router.replace("/journey");
    } catch (error) {
      Alert.alert("Password update failed", error instanceof Error ? error.message : "Try the reset link again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <View style={{ flex: 1, padding: 24, justifyContent: "center" }}>
        <View
          style={{
            width: 76,
            height: 76,
            borderRadius: 26,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: theme.colors.primarySoft,
            borderWidth: 1,
            borderColor: theme.colors.primary,
            marginBottom: 22
          }}
        >
          <Ionicons name="key-outline" color={theme.colors.primary} size={34} />
        </View>
        <Text style={{ color: theme.colors.primary, fontWeight: "900", letterSpacing: 2, fontSize: 12 }}>PINTLY</Text>
        <Text style={{ color: theme.colors.textPrimary, fontSize: 38, fontWeight: "900", fontFamily: "Georgia", marginTop: 8 }}>Reset Password</Text>
        <Text style={{ color: theme.colors.textSecondary, lineHeight: 22, marginTop: 10 }}>Choose a new password for your Pintly account.</Text>

        <View style={{ marginTop: 24, gap: 14 }}>
          <Field label="New password" value={password} onChangeText={setPassword} placeholder="Create a strong password" />
          <Field label="Confirm password" value={confirmPassword} onChangeText={setConfirmPassword} placeholder="Re-enter password" />
        </View>
        <PasswordRequirements value={password} />

        <Pressable
          onPress={() => void submit()}
          disabled={!canSubmit}
          style={{
            backgroundColor: canSubmit ? theme.colors.primary : theme.colors.surfaceAlt,
            borderRadius: theme.radius.pill,
            paddingVertical: 16,
            alignItems: "center",
            marginTop: 24
          }}
        >
          <Text style={{ color: canSubmit ? theme.colors.textOnPrimary : theme.colors.textMuted, fontWeight: "900", fontSize: 16 }}>
            {busy ? "Saving..." : "Update Password"}
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

function PasswordRequirements({ value }: { value: string }) {
  return (
    <View style={{ marginTop: 12, gap: 6 }}>
      {passwordRequirements.map((requirement) => {
        const met = requirement.test(value);
        return (
          <View key={requirement.id} style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Ionicons name={met ? "checkmark-circle" : "ellipse-outline"} color={met ? theme.colors.success : theme.colors.textMuted} size={15} />
            <Text style={{ color: met ? theme.colors.textSecondary : theme.colors.textMuted, fontSize: 12, fontWeight: "700" }}>{requirement.label}</Text>
          </View>
        );
      })}
    </View>
  );
}

function Field({
  label,
  value,
  placeholder,
  onChangeText
}: {
  label: string;
  value: string;
  placeholder: string;
  onChangeText: (value: string) => void;
}) {
  return (
    <View>
      <Text style={{ color: theme.colors.textSecondary, fontWeight: "800", marginBottom: 7 }}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={theme.colors.textMuted}
        secureTextEntry
        style={{
          height: 54,
          color: theme.colors.textPrimary,
          backgroundColor: theme.colors.card,
          borderWidth: 1,
          borderColor: theme.colors.cardBorder,
          borderRadius: theme.radius.md,
          paddingHorizontal: 15,
          fontSize: 16
        }}
      />
    </View>
  );
}
