import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import { theme } from "@/theme";

type IconName = keyof typeof Ionicons.glyphMap;

const icons: Record<string, IconName> = {
  journey: "trail-sign-outline",
  map: "map-outline",
  groups: "people-outline",
  challenges: "trophy-outline",
  passport: "id-card-outline"
};

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: theme.colors.neon,
        tabBarInactiveTintColor: theme.colors.muted,
        tabBarStyle: {
          backgroundColor: theme.colors.surface,
          borderTopColor: theme.colors.border,
          height: 82,
          paddingTop: 8,
          paddingBottom: 14
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: "700"
        },
        tabBarIcon: ({ color, size }) => (
          <Ionicons name={icons[route.name] ?? "ellipse-outline"} color={color} size={size} />
        )
      })}
    >
      <Tabs.Screen name="journey" options={{ title: "Journey" }} />
      <Tabs.Screen name="map" options={{ title: "Map" }} />
      <Tabs.Screen name="groups" options={{ title: "Groups" }} />
      <Tabs.Screen name="challenges" options={{ title: "Challenges" }} />
      <Tabs.Screen name="passport" options={{ title: "Passport" }} />
    </Tabs>
  );
}
