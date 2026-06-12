import { Stack } from "expo-router";
import { useSegments } from "expo-router";
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
  const segments = useSegments();
  const isResetPasswordRoute = segments[0] === "reset-password";

  return (
    <PassportProvider authenticatedUser={profile ?? undefined}>
      <StatusBar style="light" />
      {isResetPasswordRoute ? (
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: theme.colors.background }
          }}
        />
      ) : (
        <AuthGate>
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: theme.colors.background }
            }}
          />
          <OnboardingModal />
        </AuthGate>
      )}
    </PassportProvider>
  );
}
