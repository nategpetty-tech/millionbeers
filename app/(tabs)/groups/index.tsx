import { Ionicons } from "@expo/vector-icons";
import { useEffect, useMemo, useState } from "react";
import { Alert, Image, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { CreateGroupModal } from "@/components/CreateGroupModal";
import { EmptyState } from "@/components/EmptyState";
import { GroupCard } from "@/components/GroupCard";
import { usePassport } from "@/store/passportStore";
import { theme } from "@/theme";
import { groupPhotoFor } from "@/utils/groupVisuals";

export default function GroupsScreen() {
  const { groups, user, requestJoinGroup, initializeSeedData } = usePassport();
  const [query, setQuery] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [searchingCloud, setSearchingCloud] = useState(false);
  const normalizedQuery = query.toLowerCase().trim();
  const myGroups = useMemo(() => groups.filter((group) => group.members.some((member) => member.userId === user.id)), [groups, user.id]);
  const pendingMemberships = useMemo(
    () =>
      groups.filter(
        (group) =>
          !group.members.some((member) => member.userId === user.id) &&
          group.pendingRequests.some((request) => request.userId === user.id && request.status === "pending")
      ),
    [groups, user.id]
  );
  const searchResults = useMemo(
    () =>
      groups.filter((group) => {
        const matches = group.name.toLowerCase().includes(normalizedQuery) || group.inviteCode.toLowerCase().includes(normalizedQuery);
        const member = group.members.some((item) => item.userId === user.id);
        return normalizedQuery.length > 0 && matches && !member;
      }),
    [groups, normalizedQuery, user.id]
  );
  const filteredMyGroups = useMemo(
    () => myGroups.filter((group) => group.name.toLowerCase().includes(normalizedQuery) || group.inviteCode.toLowerCase().includes(normalizedQuery)),
    [myGroups, normalizedQuery]
  );
  const showingSearch = normalizedQuery.length > 0;

  useEffect(() => {
    if (normalizedQuery.length < 2) return;
    const timeout = setTimeout(() => {
      setSearchingCloud(true);
      initializeSeedData().finally(() => setSearchingCloud(false));
    }, 450);
    return () => clearTimeout(timeout);
  }, [initializeSeedData, normalizedQuery]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 120 }}>
        <View style={{ paddingHorizontal: 20, paddingTop: 14, paddingBottom: 12 }}>
          <View style={{ alignItems: "center", justifyContent: "center", minHeight: 42 }}>
            <Text style={{ color: theme.colors.text, fontFamily: "Georgia", fontSize: 20, fontWeight: "900", letterSpacing: 1 }}>GROUPS</Text>
            <Pressable onPress={() => setCreateOpen(true)} style={{ position: "absolute", right: 0, top: 5, padding: 4 }}>
              <Ionicons name="add" color={theme.colors.text} size={27} />
            </Pressable>
          </View>
        </View>
        <View style={{ paddingHorizontal: 20 }}>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 10,
              backgroundColor: theme.colors.card,
              borderRadius: theme.radius.sm,
              borderWidth: 1,
              borderColor: theme.colors.border,
              paddingHorizontal: 14,
              marginBottom: 18
            }}
          >
            <Ionicons name="search" color={theme.colors.muted} size={18} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Search groups or invite codes"
              placeholderTextColor={theme.colors.dim}
              style={{ color: theme.colors.text, flex: 1, height: 48 }}
            />
            {searchingCloud ? <Ionicons name="sync-outline" color={theme.colors.neon} size={18} /> : null}
          </View>
          <View
            style={{
              backgroundColor: theme.colors.card,
              borderRadius: theme.radius.md,
              borderWidth: 1,
              borderColor: theme.colors.border,
              padding: 12,
              marginBottom: 16
            }}
          >
            <Text style={{ color: theme.colors.text, fontWeight: "900" }}>Join a group</Text>
            <Text style={{ color: theme.colors.muted, marginTop: 4, lineHeight: 19 }}>
              Search a group name or paste an invite code. Founders approve requests before group photos and feeds become visible.
            </Text>
          </View>

          {pendingMemberships.length ? (
            <View style={{ marginBottom: 16 }}>
              <Text style={{ color: theme.colors.gold, fontSize: 12, fontWeight: "900", marginBottom: 10 }}>WAITING FOR APPROVAL</Text>
              {pendingMemberships.map((group) => (
                <View
                  key={group.id}
                  style={{
                    backgroundColor: theme.colors.card,
                    borderRadius: theme.radius.md,
                    borderWidth: 1,
                    borderColor: theme.colors.border,
                    padding: 12,
                    marginBottom: 8,
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 10
                  }}
                >
                  <Ionicons name="hourglass-outline" color={theme.colors.gold} size={18} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: theme.colors.text, fontWeight: "900" }}>{group.name}</Text>
                    <Text style={{ color: theme.colors.muted, marginTop: 2 }}>Founder approval pending</Text>
                  </View>
                </View>
              ))}
            </View>
          ) : null}

          {myGroups.length > 1 ? (
            <View style={{ marginBottom: 18 }}>
              <Text style={{ color: theme.colors.gold, fontSize: 12, fontWeight: "900", marginBottom: 10 }}>GROUP LEADERBOARD</Text>
              <View style={{ backgroundColor: theme.colors.card, borderRadius: theme.radius.lg, borderWidth: 1, borderColor: theme.colors.border, padding: 12, gap: 8 }}>
                {[...myGroups]
                  .sort((a, b) => b.beerCount - a.beerCount)
                  .slice(0, 5)
                  .map((group, index) => (
                    <View key={group.id} style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 6 }}>
                      <Text style={{ color: index === 0 ? theme.colors.neon : theme.colors.muted, width: 22, fontWeight: "900" }}>{index + 1}</Text>
                      <View
                        style={{
                          width: 36,
                          height: 36,
                          borderRadius: 13,
                          overflow: "hidden",
                          backgroundColor: theme.colors.cardSoft,
                          borderWidth: 1,
                          borderColor: index === 0 ? theme.colors.neon : theme.colors.border
                        }}
                      >
                        <Image source={{ uri: group.backdropUrl ?? groupPhotoFor(group.name) }} style={{ width: "100%", height: "100%" }} resizeMode="cover" />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: theme.colors.text, fontWeight: "900" }}>{group.name}</Text>
                        <Text style={{ color: theme.colors.muted, marginTop: 2, fontSize: 12 }}>{group.memberCount} members</Text>
                      </View>
                      <View style={{ alignItems: "flex-end" }}>
                        <Text style={{ color: theme.colors.neon, fontWeight: "900", fontSize: 18 }}>{group.beerCount.toLocaleString()}</Text>
                        <Text style={{ color: theme.colors.dim, fontSize: 10, fontWeight: "900" }}>BEERS</Text>
                      </View>
                    </View>
                  ))}
              </View>
            </View>
          ) : null}

          {showingSearch ? (
            <View>
              {filteredMyGroups.length ? (
                <>
                  <Text style={{ color: theme.colors.neon, fontSize: 12, fontWeight: "900", marginBottom: 10 }}>YOUR GROUPS</Text>
                  {filteredMyGroups.map((group) => <GroupCard key={group.id} group={group} />)}
                </>
              ) : null}
              {searchResults.length ? <Text style={{ color: theme.colors.gold, fontSize: 12, fontWeight: "900", marginBottom: 10 }}>REQUEST TO JOIN</Text> : null}
              {searchResults.map((group) => {
                const pending = group.pendingRequests.some((request) => request.userId === user.id && request.status === "pending");
                const source = group.inviteCode.toLowerCase().includes(normalizedQuery) ? "invite" : "search";
                return (
                  <View
                    key={group.id}
                    style={{
                      backgroundColor: theme.colors.card,
                      borderRadius: theme.radius.lg,
                      borderWidth: 1,
                      borderColor: theme.colors.border,
                      padding: 14,
                      marginBottom: 10
                    }}
                  >
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                      <View
                        style={{
                          width: 44,
                          height: 44,
                          borderRadius: 16,
                          overflow: "hidden",
                          backgroundColor: theme.colors.cardSoft,
                          borderWidth: 1,
                          borderColor: theme.colors.neon
                        }}
                      >
                        <Image source={{ uri: group.backdropUrl ?? groupPhotoFor(group.name) }} style={{ width: "100%", height: "100%" }} resizeMode="cover" />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: theme.colors.text, fontWeight: "900", fontSize: 16 }}>{group.name}</Text>
                        <Text style={{ color: theme.colors.muted, marginTop: 3 }}>
                          {group.memberCount} members • {group.privacy}
                        </Text>
                        <Text style={{ color: theme.colors.dim, marginTop: 2, fontSize: 12 }}>
                          {source === "invite" ? "Invite code matched" : "Name matched"} • founder approval required
                        </Text>
                      </View>
                      <Pressable
                        disabled={pending}
                        onPress={() => {
                          requestJoinGroup(group.id, source);
                          Alert.alert("Request sent", `${group.name}'s founder can approve you in the group request queue.`);
                        }}
                        style={{
                          backgroundColor: pending ? theme.colors.cardSoft : theme.colors.neon,
                          borderRadius: theme.radius.pill,
                          paddingHorizontal: 12,
                          paddingVertical: 9
                        }}
                      >
                        <Text style={{ color: pending ? theme.colors.dim : theme.colors.ink, fontWeight: "900" }}>
                          {pending ? "Pending" : source === "invite" ? "Use Invite" : "Request"}
                        </Text>
                      </Pressable>
                    </View>
                  </View>
                );
              })}
              {!filteredMyGroups.length && !searchResults.length ? (
                <EmptyState
                  title="No matching groups"
                  body="Try the exact group name or invite code."
                  icon="search-outline"
                />
              ) : null}
            </View>
          ) : myGroups.length ? (
            <View>
              <Text style={{ color: theme.colors.neon, fontSize: 12, fontWeight: "900", marginBottom: 10 }}>YOUR GROUPS</Text>
              {myGroups.map((group) => <GroupCard key={group.id} group={group} />)}
            </View>
          ) : (
            <EmptyState title="No groups yet" body="Create your first group and set a shared beer goal." icon="people-outline" />
          )}
        </View>
      </ScrollView>
      <CreateGroupModal visible={createOpen} onClose={() => setCreateOpen(false)} />
    </SafeAreaView>
  );
}
