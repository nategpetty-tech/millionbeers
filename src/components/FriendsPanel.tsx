import { Ionicons } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import { Alert, Pressable, Text, TextInput, View } from "react-native";
import { Avatar } from "@/components/Avatar";
import { usePassport } from "@/store/passportStore";
import { theme } from "@/theme";
import type { UserSearchResult } from "@/types";

export function FriendsPanel() {
  const { friends, friendRequests, searchUsers, requestFriend, approveFriendRequest, rejectFriendRequest } = usePassport();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<UserSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const incomingRequests = friendRequests.filter((request) => request.status === "pending" && request.direction === "incoming");
  const outgoingRequests = friendRequests.filter((request) => request.status === "pending" && request.direction === "outgoing");

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setResults([]);
      return;
    }
    let active = true;
    const timeout = setTimeout(() => {
      setSearching(true);
      searchUsers(trimmed)
        .then((items) => {
          if (active) setResults(items);
        })
        .catch((error) => {
          if (active) Alert.alert("Friend search failed", error instanceof Error ? error.message : "Try again in a moment.");
        })
        .finally(() => {
          if (active) setSearching(false);
        });
    }, 350);
    return () => {
      active = false;
      clearTimeout(timeout);
    };
  }, [query, searchUsers]);

  return (
    <View style={{ gap: 12 }}>
      <View style={{ backgroundColor: theme.colors.card, borderRadius: theme.radius.lg, borderWidth: 1, borderColor: theme.colors.cardBorder, padding: 14 }}>
        <Text style={{ color: theme.colors.textPrimary, fontWeight: "900", fontSize: 18 }}>Friends</Text>
        <Text style={{ color: theme.colors.textSecondary, marginTop: 4, lineHeight: 19 }}>
          Friends can see each other's beer activity and map stamps outside of groups.
        </Text>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 9,
            backgroundColor: theme.colors.surface,
            borderRadius: theme.radius.md,
            borderWidth: 1,
            borderColor: theme.colors.cardBorder,
            paddingHorizontal: 12,
            marginTop: 12
          }}
        >
          <Ionicons name="search-outline" color={theme.colors.textSecondary} size={18} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search friends by name"
            placeholderTextColor={theme.colors.textMuted}
            autoCapitalize="words"
            style={{ color: theme.colors.textPrimary, flex: 1, height: 46 }}
          />
          {searching ? <Ionicons name="sync-outline" color={theme.colors.primary} size={18} /> : null}
        </View>
      </View>

      {incomingRequests.length ? (
        <View style={{ backgroundColor: theme.colors.card, borderRadius: theme.radius.lg, borderWidth: 1, borderColor: theme.colors.primary, padding: 14, gap: 10 }}>
          <Text style={{ color: theme.colors.primary, fontWeight: "900", fontSize: 12, letterSpacing: 1 }}>FRIEND REQUESTS</Text>
          {incomingRequests.map((request) => (
            <View key={request.id} style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <Avatar label={request.avatar} uri={request.avatarUrl} size={38} borderColor={theme.colors.primary} />
              <View style={{ flex: 1 }}>
                <Text style={{ color: theme.colors.textPrimary, fontWeight: "900" }}>{request.name}</Text>
                <Text style={{ color: theme.colors.textSecondary, marginTop: 2 }}>Wants to be friends</Text>
              </View>
              <Pressable onPress={() => approveFriendRequest(request.id)} style={{ backgroundColor: theme.colors.primary, borderRadius: theme.radius.pill, paddingHorizontal: 10, paddingVertical: 8 }}>
                <Text style={{ color: theme.colors.textOnPrimary, fontWeight: "900", fontSize: 12 }}>Accept</Text>
              </Pressable>
              <Pressable onPress={() => rejectFriendRequest(request.id)} hitSlop={8}>
                <Ionicons name="close-circle" color={theme.colors.danger} size={25} />
              </Pressable>
            </View>
          ))}
        </View>
      ) : null}

      {query.trim().length >= 2 ? (
        <View style={{ backgroundColor: theme.colors.card, borderRadius: theme.radius.lg, borderWidth: 1, borderColor: theme.colors.cardBorder, padding: 14, gap: 10 }}>
          <Text style={{ color: theme.colors.primary, fontWeight: "900", fontSize: 12, letterSpacing: 1 }}>SEARCH RESULTS</Text>
          {results.length ? (
            results.map((result) => <SearchResultRow key={result.userId} result={result} onRequest={() => requestFriend(result)} />)
          ) : (
            <Text style={{ color: theme.colors.textSecondary }}>No matching Pintly users yet.</Text>
          )}
        </View>
      ) : null}

      {friends.length ? (
        <View style={{ backgroundColor: theme.colors.card, borderRadius: theme.radius.lg, borderWidth: 1, borderColor: theme.colors.cardBorder, padding: 14, gap: 10 }}>
          <Text style={{ color: theme.colors.textPrimary, fontWeight: "900", fontSize: 18 }}>Your Friends</Text>
          {friends.map((friend) => (
            <View key={friend.userId} style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <Avatar label={friend.avatar} uri={friend.avatarUrl} size={38} borderColor={theme.colors.primary} />
              <View style={{ flex: 1 }}>
                <Text style={{ color: theme.colors.textPrimary, fontWeight: "900" }}>{friend.name}</Text>
                <Text style={{ color: theme.colors.textSecondary, marginTop: 2 }}>Friend activity appears on Journey and Map</Text>
              </View>
            </View>
          ))}
        </View>
      ) : (
        <View style={{ backgroundColor: theme.colors.card, borderRadius: theme.radius.lg, borderWidth: 1, borderColor: theme.colors.cardBorder, padding: 14 }}>
          <Text style={{ color: theme.colors.textPrimary, fontWeight: "900" }}>No friends yet</Text>
          <Text style={{ color: theme.colors.textSecondary, marginTop: 5, lineHeight: 19 }}>
            Search for a tester above. Once they accept, you can see each other's beer feed and map stamps.
          </Text>
        </View>
      )}

      {outgoingRequests.length ? (
        <Text style={{ color: theme.colors.textMuted, textAlign: "center", lineHeight: 18 }}>
          {outgoingRequests.length} outgoing friend {outgoingRequests.length === 1 ? "request is" : "requests are"} waiting for approval.
        </Text>
      ) : null}
    </View>
  );
}

function SearchResultRow({ result, onRequest }: { result: UserSearchResult; onRequest: () => void }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
      <Avatar label={result.avatar} uri={result.avatarUrl} size={38} borderColor={theme.colors.cardBorder} />
      <View style={{ flex: 1 }}>
        <Text style={{ color: theme.colors.textPrimary, fontWeight: "900" }}>{result.name}</Text>
        <Text style={{ color: theme.colors.textSecondary, marginTop: 2 }}>{relationshipCopy(result.relationship)}</Text>
      </View>
      <Pressable
        disabled={result.relationship !== "none"}
        onPress={onRequest}
        style={{
          backgroundColor: result.relationship === "none" ? theme.colors.primary : theme.colors.surfaceAlt,
          borderRadius: theme.radius.pill,
          paddingHorizontal: 10,
          paddingVertical: 8
        }}
      >
        <Text style={{ color: result.relationship === "none" ? theme.colors.textOnPrimary : theme.colors.textMuted, fontWeight: "900", fontSize: 12 }}>
          {result.relationship === "none" ? "Add" : "Added"}
        </Text>
      </Pressable>
    </View>
  );
}

function relationshipCopy(relationship: UserSearchResult["relationship"]) {
  if (relationship === "friend") return "Already friends";
  if (relationship === "incoming") return "Sent you a request";
  if (relationship === "outgoing") return "Request pending";
  if (relationship === "self") return "This is you";
  return "Pintly user";
}
