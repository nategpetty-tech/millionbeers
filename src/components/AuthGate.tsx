import { PropsWithChildren } from "react";
import { Text, View } from "react-native";
import { AuthLanding } from "@/components/AuthLanding";
import { useAuth } from "@/store/authStore";
import { useAppTheme } from "@/theme";

export function AuthGate({ children }: PropsWithChildren) {
  const theme = useAppTheme();
  const { loading, profile } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.colors.background, alignItems: "center", justifyContent: "center", padding: 24 }}>
        <Text style={{ color: theme.colors.primary, fontWeight: "900", letterSpacing: 2, fontSize: 12 }}>PINTLY</Text>
        <Text style={{ color: theme.colors.textPrimary, fontSize: 24, fontWeight: "900", marginTop: 10 }}>Opening Pintly...</Text>
      </View>
    );
  }

  if (!profile) {
    return <AuthLanding />;
  }

  return <>{children}</>;
}
