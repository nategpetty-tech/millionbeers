import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, PropsWithChildren, useCallback, useContext, useEffect, useMemo, useState } from "react";

export type ThemeMode = "light" | "dark";
export type ThemePreference = ThemeMode;
export type ResolvedTheme = "light" | "dark";

const THEME_PREFERENCE_KEY = "pintly.themePreference.v1";

const sharedTheme = {
  spacing: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 24,
    xxl: 32
  },
  radius: {
    sm: 10,
    md: 16,
    lg: 22,
    xl: 28,
    pill: 999
  },
  typography: {
    title: {
      fontSize: 34,
      fontWeight: "800" as const,
      letterSpacing: 1.5
    },
    sectionTitle: {
      fontSize: 28,
      fontWeight: "800" as const
    },
    label: {
      fontSize: 13,
      fontWeight: "700" as const,
      letterSpacing: 2
    },
    body: {
      fontSize: 16,
      fontWeight: "500" as const
    }
  }
};

const lightPalette = {
  background: "#FFFDF8",
  backgroundDark: "#F7F0E3",
  backgroundSoft: "#FFFBF2",
  surface: "#FFFFFF",
  surfaceAlt: "#FFF9ED",
  surfaceElevated: "#FFFFFF",
  card: "#FFFFFF",
  cardBorder: "#E5E7EB",
  primary: "#F59E0B",
  primaryDark: "#B45309",
  primarySoft: "#FEF3C7",
  accent: "#F59E0B",
  accentSoft: "#FEF3C7",
  accentText: "#78350F",
  teal: "#0F766E",
  tealDark: "#134E4A",
  textPrimary: "#0F172A",
  textSecondary: "#64748B",
  textMuted: "#94A3B8",
  textOnPrimary: "#111827",
  textInverse: "#F8FAFC",
  tabActive: "#F59E0B",
  tabInactive: "#94A3B8",
  iconPrimary: "#0F172A",
  iconSecondary: "#64748B",
  progressTrack: "#F1E7D0",
  shadow: "rgba(15, 23, 42, 0.10)",
  modalBackdrop: "rgba(15, 23, 42, 0.58)",
  mediaBackdrop: "#0F172A",
  mediaBackdropSoft: "rgba(15, 23, 42, 0.72)",
  imageOverlay: "rgba(15, 23, 42, 0.52)",
  imageOverlayBorder: "rgba(255, 255, 255, 0.48)",
  overlayText: "#F8FAFC",
  overlayTextMuted: "rgba(248, 250, 252, 0.82)",
  dangerSoft: "rgba(239, 68, 68, 0.12)",
  success: "#10B981",
  warning: "#F59E0B",
  error: "#EF4444",
  mapPreviewBackground: "#FFFBF2",
  mapGrid: "#E5E7EB",
  scanOverlay: "rgba(245, 158, 11, 0.12)"
};

const darkPalette = {
  background: "#070A0F",
  backgroundDark: "#05070B",
  backgroundSoft: "#0B0F17",
  surface: "#111827",
  surfaceAlt: "#161D27",
  surfaceElevated: "#121821",
  card: "#111827",
  cardBorder: "#263241",
  primary: "#F59E0B",
  primaryDark: "#FBBF24",
  primarySoft: "rgba(245, 158, 11, 0.16)",
  accent: "#F59E0B",
  accentSoft: "rgba(245, 158, 11, 0.16)",
  accentText: "#FDE68A",
  teal: "#5EEAD4",
  tealDark: "#0B0F17",
  textPrimary: "#F8FAFC",
  textSecondary: "#CBD5E1",
  textMuted: "#64748B",
  textOnPrimary: "#111827",
  textInverse: "#0F172A",
  tabActive: "#F59E0B",
  tabInactive: "#64748B",
  iconPrimary: "#F8FAFC",
  iconSecondary: "#94A3B8",
  progressTrack: "#263241",
  shadow: "rgba(0, 0, 0, 0.42)",
  modalBackdrop: "rgba(0, 0, 0, 0.72)",
  mediaBackdrop: "#05070B",
  mediaBackdropSoft: "rgba(0, 0, 0, 0.72)",
  imageOverlay: "rgba(0, 0, 0, 0.58)",
  imageOverlayBorder: "rgba(255, 255, 255, 0.18)",
  overlayText: "#F8FAFC",
  overlayTextMuted: "rgba(248, 250, 252, 0.82)",
  dangerSoft: "rgba(239, 68, 68, 0.14)",
  success: "#34D399",
  warning: "#F59E0B",
  error: "#F87171",
  mapPreviewBackground: "#111827",
  mapGrid: "#334155",
  scanOverlay: "rgba(245, 158, 11, 0.14)"
};

function withAliases<T extends typeof lightPalette | typeof darkPalette>(colors: T) {
  return {
    ...colors,
    border: colors.cardBorder,
    cardSoft: colors.surfaceAlt,
    text: colors.textPrimary,
    muted: colors.textSecondary,
    dim: colors.textMuted,
    neon: colors.primary,
    neonSoft: colors.primarySoft,
    gold: colors.primary,
    amber: colors.primaryDark,
    ink: colors.textOnPrimary,
    danger: colors.error
  };
}

export const lightTheme = {
  ...sharedTheme,
  mode: "light" as const,
  colors: withAliases(lightPalette),
  shadow: {
    card: {
      shadowColor: "rgba(146, 64, 14, 0.18)",
      shadowOpacity: 1,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 6 },
      elevation: 2
    },
    button: {
      shadowColor: lightPalette.shadow,
      shadowOpacity: 1,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: 6 },
      elevation: 5
    }
  }
};

export const darkTheme = {
  ...sharedTheme,
  mode: "dark" as const,
  colors: withAliases(darkPalette),
  shadow: {
    card: {
      shadowColor: darkPalette.shadow,
      shadowOpacity: 0,
      shadowRadius: 0,
      shadowOffset: { width: 0, height: 0 },
      elevation: 0
    },
    button: {
      shadowColor: darkPalette.shadow,
      shadowOpacity: 1,
      shadowRadius: 14,
      shadowOffset: { width: 0, height: 7 },
      elevation: 6
    }
  }
};

export type AppTheme = typeof lightTheme | typeof darkTheme;

let activeTheme: AppTheme = darkTheme;

export const theme = {
  get mode() {
    return activeTheme.mode;
  },
  colors: {} as AppTheme["colors"],
  radius: sharedTheme.radius,
  spacing: sharedTheme.spacing,
  typography: sharedTheme.typography,
  shadow: {} as AppTheme["shadow"]
};

Object.defineProperties(
  theme.colors,
  Object.fromEntries(
    Object.keys(darkTheme.colors).map((key) => [
      key,
      {
        get: () => activeTheme.colors[key as keyof AppTheme["colors"]],
        enumerable: true
      }
    ])
  )
);

Object.defineProperties(
  theme.shadow,
  Object.fromEntries(
    Object.keys(darkTheme.shadow).map((key) => [
      key,
      {
        get: () => activeTheme.shadow[key as keyof AppTheme["shadow"]],
        enumerable: true
      }
    ])
  )
);

type AppThemeContextValue = {
  theme: AppTheme;
  mode: ThemeMode;
  preference: ThemePreference;
  resolvedTheme: ResolvedTheme;
  setThemeMode: (mode: ThemeMode) => void;
  setPreference: (preference: ThemePreference) => void;
  toggleTheme: () => void;
};

const AppThemeContext = createContext<AppThemeContextValue | undefined>(undefined);

export function AppThemeProvider({ children }: PropsWithChildren) {
  const [mode, setModeState] = useState<ThemeMode>("light");
  const resolvedTheme = mode;
  const selectedTheme = resolvedTheme === "light" ? lightTheme : darkTheme;
  activeTheme = selectedTheme;

  useEffect(() => {
    void AsyncStorage.getItem(THEME_PREFERENCE_KEY).then((saved) => {
      if (isThemeMode(saved)) setModeState(saved);
      if (saved === "system") {
        setModeState("light");
        void AsyncStorage.setItem(THEME_PREFERENCE_KEY, "light");
      }
    });
  }, []);

  const setThemeMode = useCallback((nextMode: ThemeMode) => {
    activeTheme = nextMode === "light" ? lightTheme : darkTheme;
    setModeState(nextMode);
    void AsyncStorage.setItem(THEME_PREFERENCE_KEY, nextMode);
  }, []);

  const value = useMemo(
    () => ({
      theme: selectedTheme,
      mode,
      preference: mode,
      resolvedTheme,
      setThemeMode,
      setPreference: setThemeMode,
      toggleTheme: () => setThemeMode(mode === "light" ? "dark" : "light")
    }),
    [mode, resolvedTheme, selectedTheme, setThemeMode]
  );

  return React.createElement(AppThemeContext.Provider, { value }, children);
}

export const ThemeProvider = AppThemeProvider;

export function useAppTheme() {
  const context = useContext(AppThemeContext);
  if (!context) throw new Error("useAppTheme must be used inside AppThemeProvider.");
  return context.theme;
}

export function useThemePreference() {
  const context = useContext(AppThemeContext);
  if (!context) throw new Error("useThemePreference must be used inside AppThemeProvider.");
  return context;
}

function isThemeMode(value: string | null): value is ThemeMode {
  return value === "light" || value === "dark";
}

export type Theme = AppTheme;
