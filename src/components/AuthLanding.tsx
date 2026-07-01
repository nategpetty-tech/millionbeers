import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { Alert, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "@/store/authStore";
import { theme } from "@/theme";
import { isStrongPassword, normalizeUsername, passwordRequirements, usernameValidationError } from "@/utils/accountValidation";

export function AuthLanding() {
  const { configured, signIn, signUp, sendPasswordReset } = useAuth();
  const [mode, setMode] = useState<"create" | "signIn">("create");
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [ageAcknowledged, setAgeAcknowledged] = useState(false);
  const [busy, setBusy] = useState(false);
  const [legalDoc, setLegalDoc] = useState<"privacy" | "terms" | null>(null);
  const isCreate = mode === "create";
  const usernameError = isCreate ? usernameValidationError(username) : undefined;
  const passwordReady = isCreate ? isStrongPassword(password) : password.length > 0;
  const canSubmit = configured && email.trim() && passwordReady && (!isCreate || (displayName.trim() && !usernameError && ageAcknowledged));

  async function submit() {
    if (!canSubmit) return;
    setBusy(true);
    try {
      if (isCreate) {
        const result = await signUp(email, password, displayName, username);
        if (result.needsEmailConfirmation) {
          Alert.alert("Check your email", "Confirm your account, then come back and sign in.");
          setMode("signIn");
        }
      } else {
        await signIn(email, password);
      }
    } catch (error) {
      Alert.alert("Account error", error instanceof Error ? error.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  async function resetPassword() {
    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      Alert.alert("Email needed", "Enter your email address first, then tap Forgot password.");
      return;
    }
    setBusy(true);
    try {
      await sendPasswordReset(trimmedEmail);
      Alert.alert("Check your email", "We sent a Pintly password reset link to that address.");
    } catch (error) {
      Alert.alert("Reset failed", error instanceof Error ? error.message : "Could not send a reset email.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={{ flexGrow: 1, padding: 24, justifyContent: "center" }}>
          <View
            style={{
              width: 84,
              height: 84,
              borderRadius: 28,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: theme.colors.primarySoft,
              borderWidth: 1,
              borderColor: theme.colors.primary,
              marginBottom: 22
            }}
          >
            <Ionicons name="id-card-outline" color={theme.colors.primary} size={38} />
          </View>
          <Text style={{ color: theme.colors.primary, fontWeight: "900", letterSpacing: 2, fontSize: 12 }}>PINTLY</Text>
          <Text style={{ color: theme.colors.textPrimary, fontSize: 42, fontWeight: "900", fontFamily: "Georgia", marginTop: 8 }}>
            Start your Pintly profile
          </Text>
          <Text style={{ color: theme.colors.textSecondary, lineHeight: 22, marginTop: 10 }}>
            Create an account so your beers, crews, photos, and badges belong to you.
          </Text>

          {!configured ? <SetupNotice /> : null}

          <View
            style={{
              flexDirection: "row",
              backgroundColor: theme.colors.card,
              borderRadius: theme.radius.pill,
              padding: 4,
              borderWidth: 1,
              borderColor: theme.colors.cardBorder,
              marginTop: 24
            }}
          >
            <Segment label="Create" active={isCreate} onPress={() => setMode("create")} />
            <Segment label="Sign in" active={!isCreate} onPress={() => setMode("signIn")} />
          </View>

          <View style={{ marginTop: 18, gap: 13 }}>
            {isCreate ? (
              <>
                <Field
                  label="Username"
                  value={username}
                  onChangeText={(value) => setUsername(normalizeUsername(value))}
                  placeholder="unique_username"
                  autoCapitalize="none"
                />
                <Text style={{ color: usernameError ? theme.colors.danger : theme.colors.textMuted, lineHeight: 18, fontSize: 12, marginTop: -8 }}>
                  {usernameError ?? "This is unique and cannot be changed yet. Display names can be changed anytime."}
                </Text>
                <Field label="Display name" value={displayName} onChangeText={setDisplayName} placeholder="Name friends will see" autoCapitalize="words" />
              </>
            ) : null}
            <Field label="Email" value={email} onChangeText={setEmail} placeholder="you@example.com" autoCapitalize="none" keyboardType="email-address" />
            <Field label="Password" value={password} onChangeText={setPassword} placeholder={isCreate ? "Create a strong password" : "Password"} secureTextEntry />
          </View>

          {isCreate ? <PasswordRequirements value={password} /> : null}

          {isCreate ? <AgeAcknowledgement checked={ageAcknowledged} onToggle={() => setAgeAcknowledged((value) => !value)} /> : null}

          <Pressable
            onPress={() => void submit()}
            disabled={!canSubmit || busy}
            style={({ pressed }) => ({
              opacity: pressed ? 0.84 : 1,
              backgroundColor: canSubmit && !busy ? theme.colors.primary : theme.colors.surfaceAlt,
              borderRadius: theme.radius.pill,
              paddingVertical: 17,
              alignItems: "center",
              marginTop: 24
            })}
          >
            <Text style={{ color: canSubmit && !busy ? theme.colors.textOnPrimary : theme.colors.textMuted, fontWeight: "900", fontSize: 16 }}>
              {busy ? "Working..." : isCreate ? "Create Account" : "Sign In"}
            </Text>
          </Pressable>

          {!isCreate ? (
            <Pressable onPress={() => void resetPassword()} disabled={busy || !configured} style={{ alignSelf: "center", paddingVertical: 14, paddingHorizontal: 10 }}>
              <Text style={{ color: theme.colors.primary, fontWeight: "900" }}>Forgot password?</Text>
            </Pressable>
          ) : null}

          <Text style={{ color: theme.colors.textMuted, marginTop: 18, lineHeight: 19, fontSize: 12 }}>
            Pintly uses Supabase Auth to separate each tester's account and Cloudflare Images for shared check-in photos.
          </Text>
          <View style={{ flexDirection: "row", justifyContent: "center", gap: 18, marginTop: 18 }}>
            <Pressable onPress={() => setLegalDoc("privacy")}>
              <Text style={{ color: theme.colors.primary, fontWeight: "900", fontSize: 12 }}>Privacy Policy</Text>
            </Pressable>
            <Pressable onPress={() => setLegalDoc("terms")}>
              <Text style={{ color: theme.colors.primary, fontWeight: "900", fontSize: 12 }}>Terms</Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
      <LegalModal doc={legalDoc} onClose={() => setLegalDoc(null)} />
    </SafeAreaView>
  );
}

function LegalModal({ doc, onClose }: { doc: "privacy" | "terms" | null; onClose: () => void }) {
  const title = doc === "privacy" ? "Privacy Policy" : "Terms of Service";
  const sections =
    doc === "privacy"
      ? [
          "Pintly collects account information, beer logs, group memberships, photos you choose to upload, approximate check-in location details, reactions, reports, and device push tokens when notifications are enabled.",
          "Pintly uses this information to operate beer logging, groups, leaderboards, venue suggestions, photo storage, safety features, support, abuse prevention, and app reliability.",
          "You can request account deletion inside Pintly. Blocking hides another user's posts from your view while preserving group totals.",
          "For privacy requests, contact Pintly at nade.million.beers@gmail.com."
        ]
      : [
          "Pintly is for personal beer logging, group sharing, and friendly competition. You are responsible for the content you post.",
          "Do not post illegal, abusive, hateful, harassing, sexually explicit, or spam content. Pintly may remove content or restrict accounts that violate these terms.",
          "You can report users, block users, and delete your account from inside Pintly.",
          "Questions about these terms can be sent to nade.million.beers@gmail.com."
        ];
  return (
    <Modal visible={Boolean(doc)} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable onPress={onClose} style={{ flex: 1, justifyContent: "flex-end", backgroundColor: theme.colors.modalBackdrop }}>
        <Pressable onPress={(event) => event.stopPropagation()} style={{ backgroundColor: theme.colors.card, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 20, maxHeight: "72%" }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
            <Text style={{ color: theme.colors.textPrimary, fontSize: 24, fontWeight: "900" }}>{title}</Text>
            <Pressable onPress={onClose} hitSlop={8}>
              <Ionicons name="close" color={theme.colors.textPrimary} size={24} />
            </Pressable>
          </View>
          <ScrollView style={{ marginTop: 14 }}>
            <Text style={{ color: theme.colors.textMuted, lineHeight: 20 }}>Effective date: June 21, 2026</Text>
            {sections.map((section, index) => (
              <Text key={index} style={{ color: theme.colors.textSecondary, lineHeight: 22, marginTop: 14 }}>
                {section}
              </Text>
            ))}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function SetupNotice() {
  return (
    <View
      style={{
        backgroundColor: theme.colors.card,
        borderRadius: theme.radius.lg,
        borderWidth: 1,
        borderColor: theme.colors.primary,
        padding: 15,
        marginTop: 22
      }}
    >
      <Text style={{ color: theme.colors.textPrimary, fontWeight: "900" }}>Supabase credentials needed</Text>
      <Text style={{ color: theme.colors.textSecondary, marginTop: 6, lineHeight: 20 }}>
        Create a Supabase project, then add the project URL and publishable key to your local `.env` file.
      </Text>
    </View>
  );
}

function Segment({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        flex: 1,
        alignItems: "center",
        paddingVertical: 11,
        borderRadius: theme.radius.pill,
        backgroundColor: active ? theme.colors.primary : "transparent"
      }}
    >
      <Text style={{ color: active ? theme.colors.textOnPrimary : theme.colors.textSecondary, fontWeight: "900" }}>{label}</Text>
    </Pressable>
  );
}

function AgeAcknowledgement({ checked, onToggle }: { checked: boolean; onToggle: () => void }) {
  return (
    <Pressable
      onPress={onToggle}
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      style={{
        flexDirection: "row",
        alignItems: "flex-start",
        gap: 10,
        marginTop: 16,
        padding: 13,
        borderRadius: theme.radius.md,
        backgroundColor: theme.colors.card,
        borderWidth: 1,
        borderColor: checked ? theme.colors.primary : theme.colors.cardBorder
      }}
    >
      <View
        style={{
          width: 22,
          height: 22,
          borderRadius: 7,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: checked ? theme.colors.primary : "transparent",
          borderWidth: 1,
          borderColor: checked ? theme.colors.primary : theme.colors.cardBorder,
          marginTop: 1
        }}
      >
        {checked ? <Ionicons name="checkmark" color={theme.colors.textOnPrimary} size={16} /> : null}
      </View>
      <Text style={{ color: theme.colors.textSecondary, lineHeight: 20, flex: 1, fontSize: 13 }}>
        I confirm that I am 21 years of age or older and agree to Pintly’s Terms and Privacy Policy.
      </Text>
    </Pressable>
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

type FieldProps = {
  label: string;
  value: string;
  placeholder: string;
  onChangeText: (value: string) => void;
  autoCapitalize?: "none" | "sentences" | "words" | "characters";
  keyboardType?: "default" | "email-address";
  secureTextEntry?: boolean;
};

function Field({ label, value, placeholder, onChangeText, autoCapitalize = "sentences", keyboardType = "default", secureTextEntry }: FieldProps) {
  return (
    <View>
      <Text style={{ color: theme.colors.textSecondary, fontWeight: "800", marginBottom: 7 }}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={theme.colors.textMuted}
        autoCapitalize={autoCapitalize}
        keyboardType={keyboardType}
        secureTextEntry={secureTextEntry}
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
