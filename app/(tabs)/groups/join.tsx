import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { Alert, Image, Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { usePassport } from "@/store/passportStore";
import { useAppTheme } from "@/theme";
import type { Group } from "@/types";
import { groupPhotoFor } from "@/utils/groupVisuals";

type JoinState = "loading" | "missing" | "notFound" | "member" | "pending" | "ready" | "sent";
const INVITE_LOOKUP_TIMEOUT_MS = 12000;

export default function JoinGroupScreen() {
  const theme = useAppTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{ code?: string | string[] }>();
  const rawCode = Array.isArray(params.code) ? params.code[0] : params.code;
  const inviteCode = rawCode?.trim().toUpperCase() ?? "";
  const { groups, user, initializeSeedData, findGroupByInviteCode, requestJoinGroupFromInvite } = usePassport();
  const [joinState, setJoinState] = useState<JoinState>("loading");
  const [invitedGroup, setInvitedGroup] = useState<Group | null>(null);
  const initializeSeedDataRef = useRef(initializeSeedData);
  const findGroupByInviteCodeRef = useRef(findGroupByInviteCode);
  const localGroup = useMemo(() => groups.find((item) => item.inviteCode.toUpperCase() === inviteCode), [groups, inviteCode]);
  const resolvedGroup = localGroup ?? invitedGroup;

  useEffect(() => {
    initializeSeedDataRef.current = initializeSeedData;
    findGroupByInviteCodeRef.current = findGroupByInviteCode;
  }, [findGroupByInviteCode, initializeSeedData]);

  useEffect(() => {
    let active = true;
    async function load() {
      if (!inviteCode) {
        setJoinState("missing");
        return;
      }
      setJoinState("loading");
      if (localGroup) {
        setInvitedGroup(null);
        setJoinState(stateForGroup(localGroup, user.id));
        return;
      }
      try {
        const foundGroup = await withTimeout(findGroupByInviteCodeRef.current(inviteCode), INVITE_LOOKUP_TIMEOUT_MS);
        if (!active) return;
        setInvitedGroup(foundGroup);
        setJoinState(foundGroup ? stateForGroup(foundGroup, user.id) : "notFound");
      } catch {
        if (!active) return;
        setInvitedGroup(null);
        setJoinState("notFound");
      } finally {
        void initializeSeedDataRef.current();
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, [inviteCode, localGroup?.id, user.id]);

  useEffect(() => {
    if (!inviteCode) {
      setJoinState("missing");
      return;
    }
    if (!resolvedGroup) {
      if (joinState === "loading") return;
      setJoinState("notFound");
      return;
    }
    setJoinState(stateForGroup(resolvedGroup, user.id));
  }, [inviteCode, joinState, resolvedGroup, user.id]);

  function sendRequest() {
    if (!resolvedGroup) return;
    requestJoinGroupFromInvite(resolvedGroup, "invite");
    setJoinState("sent");
    Alert.alert("Request sent", `${resolvedGroup.name}'s founder can approve you in Pintly.`);
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <View style={{ flex: 1, padding: 20, justifyContent: "center" }}>
        <Pressable onPress={() => router.replace("/groups")} style={{ position: "absolute", left: 18, top: 18, padding: 8 }}>
          <Ionicons name="arrow-back" color={theme.colors.textPrimary} size={24} />
        </Pressable>
        <Text style={{ color: theme.colors.primary, fontSize: 12, fontWeight: "900", letterSpacing: 2 }}>PINTLY INVITE</Text>
        <Text style={{ color: theme.colors.textPrimary, fontSize: 36, fontWeight: "900", fontFamily: "Georgia", marginTop: 8 }}>Join Group</Text>
        <Text style={{ color: theme.colors.textSecondary, lineHeight: 22, marginTop: 10 }}>{messageFor(joinState, inviteCode, resolvedGroup?.name)}</Text>

        {resolvedGroup ? (
          <View style={{ backgroundColor: theme.colors.card, borderRadius: theme.radius.lg, borderWidth: 1, borderColor: theme.colors.cardBorder, padding: 14, marginTop: 24 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
              <Image
                source={{ uri: resolvedGroup.backdropUrl ?? groupPhotoFor(resolvedGroup.name) }}
                style={{ width: 58, height: 58, borderRadius: 18, backgroundColor: theme.colors.surface }}
              />
              <View style={{ flex: 1 }}>
                <Text style={{ color: theme.colors.textPrimary, fontWeight: "900", fontSize: 18 }}>{resolvedGroup.name}</Text>
                <Text style={{ color: theme.colors.textSecondary, marginTop: 4 }}>
                  {resolvedGroup.memberCount} members • {resolvedGroup.privacy}
                </Text>
              </View>
            </View>
          </View>
        ) : null}

        <Pressable
          onPress={joinState === "ready" ? sendRequest : () => router.replace("/groups")}
          disabled={joinState === "loading"}
          style={{
            backgroundColor: joinState === "ready" ? theme.colors.primary : theme.colors.surfaceAlt,
            borderRadius: theme.radius.pill,
            paddingVertical: 16,
            alignItems: "center",
            marginTop: 24
          }}
        >
          <Text style={{ color: joinState === "ready" ? theme.colors.textOnPrimary : theme.colors.textPrimary, fontWeight: "900", fontSize: 16 }}>
            {buttonLabelFor(joinState)}
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

function stateForGroup(group: Group, userId: string): JoinState {
  if (group.members.some((member) => member.userId === userId)) return "member";
  if (group.pendingRequests.some((request) => request.userId === userId && request.status === "pending")) return "pending";
  return "ready";
}

function messageFor(state: JoinState, inviteCode: string, groupName?: string) {
  if (state === "loading") return "Looking up this group invite...";
  if (state === "missing") return "This invite link is missing a group code.";
  if (state === "notFound") return `No group was found for invite code ${inviteCode}. Ask the founder for a fresh invite.`;
  if (state === "member") return `You are already in ${groupName}.`;
  if (state === "pending" || state === "sent") return `Your request to join ${groupName} is waiting for founder approval.`;
  return `Request access to ${groupName}. The founder approves new members before group photos and feeds are visible.`;
}

function buttonLabelFor(state: JoinState) {
  if (state === "loading") return "Loading...";
  if (state === "ready") return "Request to Join";
  if (state === "member") return "Open Groups";
  if (state === "pending" || state === "sent") return "Request Pending";
  return "Back to Groups";
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("Invite lookup timed out")), timeoutMs);
    promise.then(
      (value) => {
        clearTimeout(timeout);
        resolve(value);
      },
      (error) => {
        clearTimeout(timeout);
        reject(error);
      }
    );
  });
}
