import { Ionicons } from "@expo/vector-icons";
import { useEffect, useRef } from "react";
import { Animated, Platform, Text, View } from "react-native";
import { useAppTheme } from "@/theme";

type AppLoadingScreenProps = {
  title?: string;
  subtitle?: string;
};

export function AppLoadingScreen({ title = "Opening Pintly...", subtitle = "Getting your beer passport ready." }: AppLoadingScreenProps) {
  const theme = useAppTheme();
  const pulse = useRef(new Animated.Value(0)).current;
  const useNativeDriver = Platform.OS !== "web";

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 900,
          useNativeDriver
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 900,
          useNativeDriver
        })
      ])
    );

    animation.start();
    return () => animation.stop();
  }, [pulse, useNativeDriver]);

  const iconTranslateY = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -8]
  });
  const iconScale = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.06]
  });
  const bubbleTranslateY = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -18]
  });
  const bubbleOpacity = pulse.interpolate({
    inputRange: [0, 0.25, 1],
    outputRange: [0.28, 1, 0.24]
  });

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background, alignItems: "center", justifyContent: "center", padding: 28 }}>
      <View
        style={{
          width: 122,
          height: 122,
          borderRadius: 61,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: theme.colors.primarySoft,
          borderWidth: 1,
          borderColor: theme.colors.primary,
          ...theme.shadow.button
        }}
      >
        <Animated.View
          style={{
            position: "absolute",
            top: 22,
            right: 32,
            opacity: bubbleOpacity,
            transform: [{ translateY: bubbleTranslateY }]
          }}
        >
          <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: theme.colors.primary }} />
        </Animated.View>
        <Animated.View
          style={{
            position: "absolute",
            top: 32,
            left: 31,
            opacity: bubbleOpacity,
            transform: [{ translateY: bubbleTranslateY }]
          }}
        >
          <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: theme.colors.primary }} />
        </Animated.View>
        <Animated.View style={{ transform: [{ translateY: iconTranslateY }, { scale: iconScale }] }}>
          <Ionicons name="beer-outline" color={theme.colors.primary} size={54} />
        </Animated.View>
      </View>

      <Text style={{ color: theme.colors.primary, fontWeight: "900", letterSpacing: 2, fontSize: 12, marginTop: 26 }}>PINTLY</Text>
      <Text style={{ color: theme.colors.textPrimary, fontSize: 25, fontWeight: "900", marginTop: 10, textAlign: "center" }}>{title}</Text>
      <Text style={{ color: theme.colors.textSecondary, lineHeight: 21, marginTop: 8, textAlign: "center", maxWidth: 280 }}>{subtitle}</Text>
    </View>
  );
}
