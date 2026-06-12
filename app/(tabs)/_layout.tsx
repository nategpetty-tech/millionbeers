import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import { useMemo } from "react";
import { usePassport } from "@/store/passportStore";
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
  const { groups, friendRequests, user } = usePassport();
  const pendingJoinRequests = useMemo(
    () =>
      groups.reduce((total, group) => {
        if (group.founderId !== user.id) return total;
        return total + group.pendingRequests.filter((request) => request.status === "pending").length;
      }, 0),
    [groups, user.id]
  );
  const incomingFriendRequests = useMemo(
    () => friendRequests.filter((request) => request.status === "pending" && request.direction === "incoming").length,
    [friendRequests]
  );

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
      <Tabs.Screen
        name="groups"
        options={{
          title: "Groups",
          tabBarBadge: pendingJoinRequests || undefined,
          tabBarBadgeStyle: {
            backgroundColor: theme.colors.gold,
            color: theme.colors.ink,
            fontWeight: "900"
          }
        }}
      />
      <Tabs.Screen name="groups/join" options={{ href: null }} />
      <Tabs.Screen name="challenges" options={{ title: "Challenges" }} />
      <Tabs.Screen
        name="passport"
        options={{
          title: "Passport",
          tabBarBadge: incomingFriendRequests || undefined,
          tabBarBadgeStyle: {
            backgroundColor: theme.colors.gold,
            color: theme.colors.ink,
            fontWeight: "900"
          }
        }}
      />
    </Tabs>
  );
}
