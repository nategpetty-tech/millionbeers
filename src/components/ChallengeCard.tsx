import { Ionicons } from "@expo/vector-icons";
import { Text, View } from "react-native";
import { Challenge } from "@/types";
import { theme } from "@/theme";
import { ProgressBar } from "./ProgressBar";

type Props = {
  challenge: Challenge;
};

export function ChallengeCard({ challenge }: Props) {
  const completed = challenge.current >= challenge.goal;
  return (
    <View
      style={{
        backgroundColor: theme.colors.card,
        borderWidth: 1,
        borderColor: completed ? theme.colors.gold : theme.colors.border,
        borderRadius: theme.radius.lg,
        padding: 16,
        marginBottom: 12
      }}
    >
      <View style={{ flexDirection: "row", gap: 14 }}>
        <View
          style={{
            width: 54,
            height: 54,
            borderRadius: 27,
            backgroundColor: theme.colors.gold,
            alignItems: "center",
            justifyContent: "center"
          }}
        >
          <Ionicons name={(completed ? "checkmark" : challenge.icon) as keyof typeof Ionicons.glyphMap} size={25} color={theme.colors.ink} />
        </View>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Text style={{ color: theme.colors.text, fontWeight: "900", fontSize: 17, flex: 1 }}>{challenge.title}</Text>
            {completed ? (
              <View style={{ backgroundColor: theme.colors.neonSoft, borderRadius: theme.radius.pill, paddingHorizontal: 8, paddingVertical: 4 }}>
                <Text style={{ color: theme.colors.neon, fontWeight: "900", fontSize: 11 }}>COMPLETE</Text>
              </View>
            ) : null}
          </View>
          <Text style={{ color: theme.colors.muted, marginTop: 4, lineHeight: 19 }}>{challenge.description}</Text>
          <View style={{ marginTop: 12 }}>
            <ProgressBar current={challenge.current} goal={challenge.goal} color={theme.colors.gold} />
            <Text style={{ color: theme.colors.amber, fontSize: 12, fontWeight: "800", marginTop: 7 }}>
              {completed ? "Challenge completed • Badge unlocked" : `${challenge.current} / ${challenge.goal} • Badge reward`}
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
}
