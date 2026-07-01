import { Session } from "@supabase/supabase-js";
import * as Linking from "expo-linking";
import React, { createContext, PropsWithChildren, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { screenshotDemoEnabled } from "@/config/features";
import { isSupabaseConfigured, supabase } from "@/services/supabase";
import { normalizeUsername, usernameValidationError } from "@/utils/accountValidation";

export type AuthProfile = {
  id: string;
  email?: string;
  displayName?: string;
  username?: string;
};

type AuthContextValue = {
  configured: boolean;
  loading: boolean;
  session: Session | null;
  profile: AuthProfile | null;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, displayName: string, username: string) => Promise<{ needsEmailConfirmation: boolean }>;
  isUsernameAvailable: (username: string) => Promise<boolean>;
  sendPasswordReset: (email: string) => Promise<void>;
  updatePassword: (password: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function authParamsFromUrl(url: string) {
  const [, queryAndHash = ""] = url.split("?");
  const [query = "", hashFromQuery = ""] = queryAndHash.split("#");
  const hash = url.includes("#") ? url.split("#")[1] : hashFromQuery;
  return new URLSearchParams([query, hash].filter(Boolean).join("&"));
}

export function AuthProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(isSupabaseConfigured && !screenshotDemoEnabled);

  useEffect(() => {
    if (screenshotDemoEnabled) {
      setLoading(false);
      return;
    }
    if (!supabase) {
      setLoading(false);
      return;
    }
    const client = supabase;

    async function handleAuthUrl(url: string | null) {
      if (!url) return;
      const params = authParamsFromUrl(url);
      const accessToken = params.get("access_token");
      const refreshToken = params.get("refresh_token");
      const code = params.get("code");
      if (code) {
        const { data, error } = await client.auth.exchangeCodeForSession(code);
        if (!error) setSession(data.session);
        return;
      }
      if (!accessToken || !refreshToken) return;
      const { data, error } = await client.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken
      });
      if (!error) setSession(data.session);
    }

    void client.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    void Linking.getInitialURL().then(handleAuthUrl);

    const { data } = client.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setLoading(false);
    });
    const linkingSubscription = Linking.addEventListener("url", ({ url }) => {
      void handleAuthUrl(url);
    });

    return () => {
      data.subscription.unsubscribe();
      linkingSubscription.remove();
    };
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    if (!supabase) throw new Error("Supabase is not configured.");
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password
    });
    if (error) throw error;
  }, []);

  const isUsernameAvailable = useCallback(async (username: string) => {
    if (!supabase) return false;
    const normalizedUsername = normalizeUsername(username);
    if (usernameValidationError(normalizedUsername)) return false;
    const { data, error } = await supabase.rpc("is_username_available", {
      username_input: normalizedUsername
    });
    if (error) throw error;
    return data === true;
  }, []);

  const signUp = useCallback(async (email: string, password: string, displayName: string, username: string) => {
    if (!supabase) throw new Error("Supabase is not configured.");
    const normalizedUsername = normalizeUsername(username);
    const usernameError = usernameValidationError(normalizedUsername);
    if (usernameError) throw new Error(usernameError);
    const available = await isUsernameAvailable(normalizedUsername);
    if (!available) throw new Error("That username is already taken.");
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: {
          display_name: displayName.trim(),
          username: normalizedUsername
        }
      }
    });
    if (error) throw error;
    return { needsEmailConfirmation: !data.session };
  }, [isUsernameAvailable]);

  const sendPasswordReset = useCallback(async (email: string) => {
    if (!supabase) throw new Error("Supabase is not configured.");
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: "pintly:///reset-password"
    });
    if (error) throw error;
  }, []);

  const updatePassword = useCallback(async (password: string) => {
    if (!supabase) throw new Error("Supabase is not configured.");
    const { error } = await supabase.auth.updateUser({ password });
    if (error) throw error;
  }, []);

  const signOut = useCallback(async () => {
    if (!supabase) return;
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  }, []);

  const profile = useMemo<AuthProfile | null>(() => {
    if (screenshotDemoEnabled) {
      return {
        id: "demo-user-nate",
        email: "demo@pintly.app",
        displayName: "Nate",
        username: "nate_pints"
      };
    }
    const user = session?.user;
    if (!user) return null;
    const displayName = typeof user.user_metadata?.display_name === "string" ? user.user_metadata.display_name : undefined;
    const username = typeof user.user_metadata?.username === "string" ? user.user_metadata.username : undefined;
    return {
      id: user.id,
      email: user.email,
      displayName,
      username
    };
  }, [session]);

  const value = useMemo(
    () => ({
      configured: isSupabaseConfigured,
      loading,
      session,
      profile,
      signIn,
      signUp,
      isUsernameAvailable,
      sendPasswordReset,
      updatePassword,
      signOut
    }),
    [isUsernameAvailable, loading, profile, sendPasswordReset, session, signIn, signOut, signUp, updatePassword]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
