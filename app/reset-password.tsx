import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Alert, Pressable, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "@/store/authStore";
import { theme } from "@/theme";

export default function ResetPasswordScreen() {
  const router = useRouter();
  const { updatePassword } = useAuth();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const canSubmit = password.length >= 6 && password === confirmPassword && !busy;

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
            backgroundColor: theme.colors.neonSoft,
            borderWidth: 1,
            borderColor: theme.colors.neon,
            marginBottom: 22
          }}
        >
          <Ionicons name="key-outline" color={theme.colors.neon} size={34} />
        </View>
        <Text style={{ color: theme.colors.gold, fontWeight: "900", letterSpacing: 2, fontSize: 12 }}>PINTLY</Text>
        <Text style={{ color: theme.colors.text, fontSize: 38, fontWeight: "900", fontFamily: "Georgia", marginTop: 8 }}>Reset Password</Text>
        <Text style={{ color: theme.colors.muted, lineHeight: 22, marginTop: 10 }}>Choose a new password for your Pintly account.</Text>

        <View style={{ marginTop: 24, gap: 14 }}>
          <Field label="New password" value={password} onChangeText={setPassword} placeholder="At least 6 characters" />
          <Field label="Confirm password" value={confirmPassword} onChangeText={setConfirmPassword} placeholder="Re-enter password" />
        </View>

        <Pressable
          onPress={() => void submit()}
          disabled={!canSubmit}
          style={{
            backgroundColor: canSubmit ? theme.colors.neon : theme.colors.cardSoft,
            borderRadius: theme.radius.pill,
            paddingVertical: 16,
            alignItems: "center",
            marginTop: 24
          }}
        >
          <Text style={{ color: canSubmit ? theme.colors.ink : theme.colors.dim, fontWeight: "900", fontSize: 16 }}>
            {busy ? "Saving..." : "Update Password"}
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
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
      <Text style={{ color: theme.colors.muted, fontWeight: "800", marginBottom: 7 }}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={theme.colors.dim}
        secureTextEntry
        style={{
          height: 54,
          color: theme.colors.text,
          backgroundColor: theme.colors.card,
          borderWidth: 1,
          borderColor: theme.colors.border,
          borderRadius: theme.radius.md,
          paddingHorizontal: 15,
          fontSize: 16
        }}
      />
    </View>
  );
}
