import { Ionicons } from "@expo/vector-icons";
import { Text, View } from "react-native";
import { theme } from "@/theme";

type Props = {
  icon?: keyof typeof Ionicons.glyphMap | string;
  label?: string;
  size?: number;
};

export function BadgeIcon({ icon = "star", label, size = 48 }: Props) {
  return (
    <View style={{ alignItems: "center", gap: 6 }}>
      <View
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: theme.colors.gold,
          borderWidth: 2,
          borderColor: theme.colors.amber
        }}
      >
        <Ionicons name={(icon as keyof typeof Ionicons.glyphMap) || "star"} size={Math.round(size * 0.48)} color={theme.colors.ink} />
      </View>
      {label ? <Text style={{ color: theme.colors.muted, fontSize: 11, maxWidth: 80, textAlign: "center" }}>{label}</Text> : null}
    </View>
  );
}
