import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "@/store/authStore";
import { theme } from "@/theme";

export function AuthLanding() {
  const { configured, signIn, signUp } = useAuth();
  const [mode, setMode] = useState<"create" | "signIn">("create");
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const isCreate = mode === "create";
  const canSubmit = configured && email.trim() && password.length >= 6 && (!isCreate || displayName.trim());

  async function submit() {
    if (!canSubmit) return;
    setBusy(true);
    try {
      if (isCreate) {
        const result = await signUp(email, password, displayName);
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
              backgroundColor: theme.colors.neonSoft,
              borderWidth: 1,
              borderColor: theme.colors.neon,
              marginBottom: 22
            }}
          >
            <Ionicons name="id-card-outline" color={theme.colors.neon} size={38} />
          </View>
          <Text style={{ color: theme.colors.gold, fontWeight: "900", letterSpacing: 2, fontSize: 12 }}>PINTLY</Text>
          <Text style={{ color: theme.colors.text, fontSize: 42, fontWeight: "900", fontFamily: "Georgia", marginTop: 8 }}>
            Start your Pintly profile
          </Text>
          <Text style={{ color: theme.colors.muted, lineHeight: 22, marginTop: 10 }}>
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
              borderColor: theme.colors.border,
              marginTop: 24
            }}
          >
            <Segment label="Create" active={isCreate} onPress={() => setMode("create")} />
            <Segment label="Sign in" active={!isCreate} onPress={() => setMode("signIn")} />
          </View>

          <View style={{ marginTop: 18, gap: 13 }}>
            {isCreate ? (
              <Field label="Display name" value={displayName} onChangeText={setDisplayName} placeholder="Name friends will see" autoCapitalize="words" />
            ) : null}
            <Field label="Email" value={email} onChangeText={setEmail} placeholder="you@example.com" autoCapitalize="none" keyboardType="email-address" />
            <Field label="Password" value={password} onChangeText={setPassword} placeholder="At least 6 characters" secureTextEntry />
          </View>

          <Pressable
            onPress={() => void submit()}
            disabled={!canSubmit || busy}
            style={({ pressed }) => ({
              opacity: pressed ? 0.84 : 1,
              backgroundColor: canSubmit && !busy ? theme.colors.neon : theme.colors.cardSoft,
              borderRadius: theme.radius.pill,
              paddingVertical: 17,
              alignItems: "center",
              marginTop: 24
            })}
          >
            <Text style={{ color: canSubmit && !busy ? theme.colors.ink : theme.colors.dim, fontWeight: "900", fontSize: 16 }}>
              {busy ? "Working..." : isCreate ? "Create Account" : "Sign In"}
            </Text>
          </Pressable>

          <Text style={{ color: theme.colors.dim, marginTop: 18, lineHeight: 19, fontSize: 12 }}>
            Pintly uses Supabase Auth to separate each tester's account and Supabase Storage for shared check-in photos.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function SetupNotice() {
  return (
    <View
      style={{
        backgroundColor: theme.colors.card,
        borderRadius: theme.radius.lg,
        borderWidth: 1,
        borderColor: theme.colors.gold,
        padding: 15,
        marginTop: 22
      }}
    >
      <Text style={{ color: theme.colors.text, fontWeight: "900" }}>Supabase credentials needed</Text>
      <Text style={{ color: theme.colors.muted, marginTop: 6, lineHeight: 20 }}>
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
        backgroundColor: active ? theme.colors.neon : "transparent"
      }}
    >
      <Text style={{ color: active ? theme.colors.ink : theme.colors.muted, fontWeight: "900" }}>{label}</Text>
    </Pressable>
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
      <Text style={{ color: theme.colors.muted, fontWeight: "800", marginBottom: 7 }}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={theme.colors.dim}
        autoCapitalize={autoCapitalize}
        keyboardType={keyboardType}
        secureTextEntry={secureTextEntry}
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
