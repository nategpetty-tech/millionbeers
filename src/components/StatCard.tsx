import { Text, View } from "react-native";
import { theme } from "@/theme";

type Props = {
  label: string;
  value: string | number;
  accent?: string;
};

export function StatCard({ label, value, accent = theme.colors.neon }: Props) {
  return (
    <View
      style={{
        flex: 1,
        minWidth: 104,
        backgroundColor: theme.colors.card,
        borderColor: theme.colors.border,
        borderWidth: 1,
        borderRadius: theme.radius.lg,
        padding: 13
      }}
    >
      <Text style={{ color: accent, fontSize: 21, fontWeight: "900", fontFamily: "Georgia" }}>{value}</Text>
      <Text style={{ color: theme.colors.muted, fontSize: 10, marginTop: 4, textTransform: "uppercase", fontWeight: "800" }}>{label}</Text>
    </View>
  );
}
