import { Text, View } from "react-native";
import { Avatar } from "@/components/Avatar";
import { GroupMember } from "@/types";
import { theme } from "@/theme";

type Props = {
  member: GroupMember;
  rank: number;
  mode: "beers" | "checkIns";
};

export function LeaderboardRow({ member, rank, mode }: Props) {
  const count = mode === "beers" ? member.beerCount : member.checkInCount;
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        backgroundColor: member.isCurrentUser ? theme.colors.neonSoft : theme.colors.card,
        borderWidth: 1,
        borderColor: member.isCurrentUser ? theme.colors.neon : theme.colors.border,
        borderRadius: theme.radius.md,
        padding: 13,
        marginBottom: 9
      }}
    >
      <Text style={{ color: member.isCurrentUser ? theme.colors.neon : theme.colors.gold, width: 22, fontWeight: "900", fontSize: 16 }}>{rank}</Text>
      <Avatar label={member.avatar} uri={member.avatarUrl} size={40} borderColor={member.isCurrentUser ? theme.colors.neon : theme.colors.border} />
      <Text style={{ color: theme.colors.text, flex: 1, fontWeight: "900" }}>{member.name}</Text>
      <View style={{ alignItems: "flex-end" }}>
        <Text style={{ color: theme.colors.text, fontWeight: "900", fontSize: 18 }}>{count}</Text>
        <Text style={{ color: theme.colors.muted, fontSize: 10, fontWeight: "800" }}>{mode === "beers" ? "BEERS" : "CHECK-INS"}</Text>
      </View>
    </View>
  );
}
