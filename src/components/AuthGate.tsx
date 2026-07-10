import { PropsWithChildren } from "react";
import { AppLoadingScreen } from "@/components/AppLoadingScreen";
import { AuthLanding } from "@/components/AuthLanding";
import { useAuth } from "@/store/authStore";

export function AuthGate({ children }: PropsWithChildren) {
  const { loading, profile } = useAuth();

  if (loading) {
    return <AppLoadingScreen />;
  }

  if (!profile) {
    return <AuthLanding />;
  }

  return <>{children}</>;
}
