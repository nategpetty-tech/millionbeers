import { Link } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Image, Pressable, Text, View } from "react-native";
import { Group } from "@/types";
import { theme } from "@/theme";
import { formatNumber } from "@/utils/format";
import { getGroupMilestoneProgress } from "@/utils/groupMilestones";
import { groupPhotoFor } from "@/utils/groupVisuals";
import { ProgressBar } from "./ProgressBar";

type Props = {
  group: Group;
  pendingRequestCount?: number;
};

export function GroupCard({ group, pendingRequestCount = 0 }: Props) {
  const groupImage = group.backdropUrl ?? groupPhotoFor(group.name);
  const milestoneProgress = getGroupMilestoneProgress(group.beerCount);
  return (
    <Link href={`/groups/${group.id}`} asChild>
      <Pressable
        style={({ pressed }) => ({
          opacity: pressed ? 0.82 : 1,
          backgroundColor: theme.colors.card,
          borderWidth: 1,
          borderColor: theme.colors.cardBorder,
          borderRadius: theme.radius.lg,
          padding: 16,
          marginBottom: 12,
          ...theme.shadow.card
        })}
      >
        <View style={{ flexDirection: "row", gap: 14, alignItems: "center" }}>
          <View
            style={{
              width: 58,
              height: 58,
              borderRadius: 29,
              overflow: "hidden",
              borderWidth: 1,
              borderColor: theme.colors.cardBorder,
              backgroundColor: theme.colors.surfaceAlt
            }}
          >
            <Image source={{ uri: groupImage }} style={{ width: "100%", height: "100%" }} resizeMode="cover" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: theme.colors.textPrimary, fontSize: 15, fontWeight: "900", flex: 1 }}>{group.name}</Text>
            <Text style={{ color: theme.colors.textSecondary, marginTop: 4 }}>
              {group.memberCount} members • {formatNumber(group.beerCount)} beers
            </Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 10 }}>
              <Pill icon="people-outline" text={`${group.memberCount} members`} />
              <Pill icon="chatbubbles-outline" text="Feed" />
              {pendingRequestCount ? <Pill icon="person-add-outline" text={`${pendingRequestCount} request${pendingRequestCount === 1 ? "" : "s"}`} accent /> : null}
            </View>
            <View style={{ marginTop: 10 }}>
              <ProgressBar current={milestoneProgress.current} goal={milestoneProgress.target} />
              <Text style={{ color: theme.colors.textMuted, marginTop: 6, fontSize: 12 }}>
                {milestoneProgress.completed
                  ? "All milestone tiers complete"
                  : `${formatNumber(group.beerCount)} / ${formatNumber(milestoneProgress.target)} beers to next badge`}
              </Text>
            </View>
          </View>
          <View style={{ alignItems: "flex-end" }}>
            <Text style={{ color: theme.colors.primary, fontFamily: "Georgia", fontSize: 26, fontWeight: "900" }}>{formatNumber(group.beerCount)}</Text>
            <Text style={{ color: theme.colors.textSecondary, fontSize: 10, fontWeight: "900" }}>BEERS</Text>
            <Ionicons name="chevron-forward" color={theme.colors.textMuted} size={18} style={{ marginTop: 8 }} />
          </View>
        </View>
      </Pressable>
    </Link>
  );
}

function Pill({ icon, text, accent = false }: { icon: keyof typeof Ionicons.glyphMap; text: string; accent?: boolean }) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
        backgroundColor: accent ? theme.colors.primary : theme.colors.surface,
        borderRadius: theme.radius.pill,
        paddingHorizontal: 8,
        paddingVertical: 5
      }}
    >
      <Ionicons name={icon} color={accent ? theme.colors.textOnPrimary : theme.colors.textSecondary} size={12} />
      <Text style={{ color: accent ? theme.colors.textOnPrimary : theme.colors.textSecondary, fontSize: 11, fontWeight: "900" }}>{text}</Text>
    </View>
  );
}
