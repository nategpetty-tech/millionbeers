import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Tabs } from "expo-router";
import { useMemo, useState } from "react";
import { Pressable, View } from "react-native";
import { CheckInModal } from "@/components/CheckInModal";
import { friendsFeatureEnabled } from "@/config/features";
import { usePassport } from "@/store/passportStore";
import { useAppTheme } from "@/theme";

type IconName = keyof typeof Ionicons.glyphMap;

const icons: Record<string, IconName> = {
  journey: "home-outline",
  map: "map-outline",
  groups: "people-outline",
  friends: "person-add-outline",
  profile: "id-card-outline"
};

export default function TabsLayout() {
  const theme = useAppTheme();
  const router = useRouter();
  const [checkInOpen, setCheckInOpen] = useState(false);
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
    () => friendsFeatureEnabled ? friendRequests.filter((request) => request.status === "pending" && request.direction === "incoming").length : 0,
    [friendRequests]
  );

  return (
    <>
      <Tabs
        screenOptions={({ route }) => ({
          headerShown: false,
          tabBarActiveTintColor: theme.colors.tabActive,
          tabBarInactiveTintColor: theme.colors.tabInactive,
          tabBarStyle: {
            position: "absolute",
            backgroundColor: theme.mode === "light" ? theme.colors.surface : theme.colors.surface,
            borderTopColor: theme.colors.cardBorder,
            borderTopWidth: 1,
            height: 82,
            paddingTop: 8,
            paddingBottom: 14,
            shadowColor: theme.colors.shadow,
            shadowOpacity: theme.mode === "light" ? 1 : 0,
            shadowRadius: theme.mode === "light" ? 16 : 0,
            shadowOffset: { width: 0, height: -5 },
            elevation: theme.mode === "light" ? 14 : 0
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
        <Tabs.Screen name="journey" options={{ title: "Home" }} />
        <Tabs.Screen name="map" options={{ title: "Map" }} />
        <Tabs.Screen
          name="add"
          options={{
            title: "",
            tabBarButton: (props) => (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Log a beer"
                onPress={() => setCheckInOpen(true)}
                style={({ pressed }) => [
                  props.style,
                  {
                    alignItems: "center",
                    justifyContent: "center",
                    transform: [{ scale: pressed ? 0.96 : 1 }]
                  }
                ]}
              >
                <View
                  style={{
                    marginTop: -28,
                    width: 64,
                    height: 64,
                    borderRadius: 32,
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: theme.colors.primary,
                    borderWidth: 4,
                    borderColor: theme.colors.background,
                    shadowColor: theme.colors.primary,
                    shadowOpacity: theme.mode === "light" ? 0.28 : 0.2,
                    shadowRadius: 14,
                    shadowOffset: { width: 0, height: 8 },
                    elevation: 8
                  }}
                >
                  <Ionicons name="add" color={theme.colors.textOnPrimary} size={34} />
                </View>
              </Pressable>
            )
          }}
        />
        <Tabs.Screen
          name="groups"
          listeners={{
            tabPress: (event) => {
              event.preventDefault();
              router.replace("/groups");
            }
          }}
          options={{
            title: "Groups",
            tabBarBadge: pendingJoinRequests || undefined,
            tabBarBadgeStyle: {
              backgroundColor: theme.colors.primary,
              color: theme.colors.textOnPrimary,
              fontWeight: "900"
            }
          }}
        />
        <Tabs.Screen name="challenges" options={{ href: null }} />
        <Tabs.Screen
          name="friends"
          options={{
            title: "Friends",
            href: friendsFeatureEnabled ? undefined : null,
            tabBarBadge: incomingFriendRequests || undefined,
            tabBarBadgeStyle: {
              backgroundColor: theme.colors.primary,
              color: theme.colors.textOnPrimary,
              fontWeight: "900"
            }
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            title: "Profile"
          }}
        />
        <Tabs.Screen name="passport" options={{ href: null }} />
      </Tabs>
      <CheckInModal visible={checkInOpen} onClose={() => setCheckInOpen(false)} />
    </>
  );
}
