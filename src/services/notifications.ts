import Constants from "expo-constants";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { supabase } from "@/services/supabase";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false
  })
});

export async function registerForGroupBeerNotifications(userId: string) {
  if (!supabase || Platform.OS === "web") return;

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("group-beers", {
      name: "Group beers",
      importance: Notifications.AndroidImportance.DEFAULT
    });
  }

  const permission = await ensureNotificationPermission();
  if (!permission) return;

  const projectId = Constants.easConfig?.projectId ?? Constants.expoConfig?.extra?.eas?.projectId;
  if (!projectId) {
    console.warn("Pintly push notifications need an EAS project id.");
    return;
  }

  const token = await Notifications.getExpoPushTokenAsync({ projectId });
  if (!token.data) return;

  const { error } = await supabase.from("push_tokens").upsert(
    {
      user_id: userId,
      token: token.data,
      platform: Platform.OS,
      enabled: true,
      updated_at: new Date().toISOString()
    },
    { onConflict: "token" }
  );
  if (error) {
    console.warn("Could not register push notifications", error.message);
  }
}

async function ensureNotificationPermission() {
  const existing = await Notifications.getPermissionsAsync();
  if (existing.granted) return true;

  const requested = await Notifications.requestPermissionsAsync();
  return requested.granted;
}
