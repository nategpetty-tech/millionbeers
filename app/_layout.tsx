import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { AuthGate } from "@/components/AuthGate";
import { OnboardingModal } from "@/components/OnboardingModal";
import { AuthProvider, useAuth } from "@/store/authStore";
import { PassportProvider } from "@/store/passportStore";
import { theme } from "@/theme";

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <AuthProvider>
        <AuthenticatedApp />
      </AuthProvider>
    </GestureHandlerRootView>
  );
}

function AuthenticatedApp() {
  const { profile } = useAuth();

  return (
    <AuthGate>
      <PassportProvider authenticatedUser={profile ?? undefined}>
        <StatusBar style="light" />
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: theme.colors.background }
          }}
        />
        <OnboardingModal />
      </PassportProvider>
    </AuthGate>
  );
}
