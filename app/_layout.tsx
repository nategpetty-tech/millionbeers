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
  const { loading, profile } = useAuth();
  const segments = useSegments();
  const isResetPasswordRoute = segments[0] === "reset-password";

  if (isResetPasswordRoute) {
    return (
      <>
        <StatusBar style="light" />
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: theme.colors.background }
          }}
        />
      </>
    );
  }

  if (loading || !profile) {
    return (
      <>
        <StatusBar style="light" />
        <AuthGate>
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: theme.colors.background }
            }}
          />
        </AuthGate>
      </>
    );
  }

  return (
    <PassportProvider key={profile.id} authenticatedUser={profile}>
      <StatusBar style="light" />
      <AuthGate>
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: theme.colors.background }
          }}
        />
        <OnboardingModal />
      </AuthGate>
    </PassportProvider>
  );
}
