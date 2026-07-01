import { Ionicons } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import { Modal, Pressable, Text, TextInput, View } from "react-native";
import { usePassport } from "@/store/passportStore";
import { theme } from "@/theme";

export function OnboardingModal() {
  const { initialized, user, updateProfile } = usePassport();
  const [name, setName] = useState(user.name);
  const visible = initialized && !user.hasOnboarded;

  useEffect(() => {
    if (visible) setName(user.name);
  }, [user.name, visible]);

  function submit() {
    const trimmed = name.trim();
    if (!trimmed) return;
    updateProfile({ name: trimmed });
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen">
      <View style={{ flex: 1, backgroundColor: theme.colors.background, padding: 24, justifyContent: "center" }}>
        <View
          style={{
            width: 82,
            height: 82,
            borderRadius: 28,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: theme.colors.primarySoft,
            borderWidth: 1,
            borderColor: theme.colors.primary,
            marginBottom: 22
          }}
        >
          <Ionicons name="id-card-outline" color={theme.colors.primary} size={36} />
        </View>
        <Text style={{ color: theme.colors.primary, fontWeight: "900", letterSpacing: 2, fontSize: 12 }}>PINTLY</Text>
        <Text style={{ color: theme.colors.textPrimary, fontSize: 38, fontWeight: "900", fontFamily: "Georgia", marginTop: 8 }}>
          Set up Pintly
        </Text>
        <Text style={{ color: theme.colors.textSecondary, lineHeight: 22, marginTop: 10 }}>
          Add the name your friends will see on check-ins, crew leaderboards, and map stamps.
        </Text>

        <View style={{ marginTop: 26 }}>
          <Text style={{ color: theme.colors.textSecondary, fontWeight: "800", marginBottom: 7 }}>Display name</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Your name"
            placeholderTextColor={theme.colors.textMuted}
            autoCapitalize="words"
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

        <View
          style={{
            marginTop: 18,
            backgroundColor: theme.colors.card,
            borderRadius: theme.radius.lg,
            borderWidth: 1,
            borderColor: theme.colors.cardBorder,
            padding: 16
          }}
        >
          <Text style={{ color: theme.colors.textPrimary, fontWeight: "900" }}>What happens next</Text>
          <Text style={{ color: theme.colors.textSecondary, marginTop: 6, lineHeight: 21 }}>
            Start clean, create a crew if you want, then use Log a Beer to add real stamps with camera and location permission.
          </Text>
        </View>

        <Pressable
          onPress={submit}
          style={({ pressed }) => ({
            opacity: pressed ? 0.84 : 1,
            backgroundColor: name.trim() ? theme.colors.primary : theme.colors.surfaceAlt,
            borderRadius: theme.radius.pill,
            paddingVertical: 17,
            alignItems: "center",
            marginTop: 26
          })}
        >
          <Text style={{ color: name.trim() ? theme.colors.textOnPrimary : theme.colors.textMuted, fontWeight: "900", fontSize: 16 }}>Start Pintly</Text>
        </Pressable>
      </View>
    </Modal>
  );
}
