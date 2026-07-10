import * as Sentry from "@sentry/react-native";
import * as Updates from "expo-updates";
import { Stack } from "expo-router";
import { useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { AppLoadingScreen } from "@/components/AppLoadingScreen";
import { AuthGate } from "@/components/AuthGate";
import { OnboardingModal } from "@/components/OnboardingModal";
import { screenshotDemoEnabled } from "@/config/features";
import { registerForGroupBeerNotifications } from "@/services/notifications";
import { AuthProvider, useAuth } from "@/store/authStore";
import { PassportProvider, usePassport } from "@/store/passportStore";
import { AppThemeProvider, useAppTheme, useThemePreference } from "@/theme";
import { PropsWithChildren, useEffect } from "react";

const sentryDsn = process.env.EXPO_PUBLIC_SENTRY_DSN;
const isSentryEnabled = Boolean(sentryDsn);

if (isSentryEnabled) {
  Sentry.init({
    dsn: sentryDsn,
    environment: __DEV__ ? "development" : "production",
    sendDefaultPii: false,
    tracesSampleRate: __DEV__ ? 1 : 0.1
  });

  const scope = Sentry.getGlobalScope();
  scope.setTag("expo-update-id", Updates.updateId ?? "embedded");
  scope.setTag("expo-is-embedded-update", String(Updates.isEmbeddedLaunch));
}

function RootLayout() {
  return (
    <AppThemeProvider>
      <ThemedRoot />
    </AppThemeProvider>
  );
}

function ThemedRoot() {
  const theme = useAppTheme();

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
  const { resolvedTheme, theme } = useThemePreference();
  const segments = useSegments();
  const isResetPasswordRoute = segments[0] === "reset-password";
  const statusBarStyle = resolvedTheme === "light" ? "dark" : "light";

  useEffect(() => {
    if (!profile?.id) {
      if (isSentryEnabled) Sentry.setUser(null);
      return;
    }
    if (isSentryEnabled) {
      Sentry.setUser({ id: profile.id, username: profile.username, name: profile.displayName });
    }
    if (screenshotDemoEnabled) return;
    void registerForGroupBeerNotifications(profile.id);
  }, [profile?.displayName, profile?.id, profile?.username]);

  if (isResetPasswordRoute) {
    return (
      <>
        <StatusBar style={statusBarStyle} />
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
        <StatusBar style={statusBarStyle} />
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
      <StatusBar style={statusBarStyle} />
      <AuthGate>
        <PassportDataGate>
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: theme.colors.background }
            }}
          />
          <OnboardingModal />
        </PassportDataGate>
      </AuthGate>
    </PassportProvider>
  );
}

function PassportDataGate({ children }: PropsWithChildren) {
  const { initialized } = usePassport();

  if (!initialized) {
    return <AppLoadingScreen title="Loading your Pintly..." subtitle="Syncing your beers, groups, photos, and stats." />;
  }

  return <>{children}</>;
}

export default isSentryEnabled ? Sentry.wrap(RootLayout) : RootLayout;
