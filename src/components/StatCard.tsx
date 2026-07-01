import { Text, View } from "react-native";
import { theme } from "@/theme";

type Props = {
  label: string;
  value: string | number;
  accent?: string;
};

export function StatCard({ label, value, accent = theme.colors.primary }: Props) {
  return (
    <View
      style={{
        flex: 1,
        minWidth: 104,
        backgroundColor: theme.colors.card,
        borderColor: theme.colors.cardBorder,
        borderWidth: 1,
        borderRadius: theme.radius.lg,
        padding: 13,
        ...theme.shadow.card
      }}
    >
      <Text style={{ color: accent, fontSize: 21, fontWeight: "900", fontFamily: "Georgia" }}>{value}</Text>
      <Text style={{ color: theme.colors.textSecondary, fontSize: 10, marginTop: 4, textTransform: "uppercase", fontWeight: "800" }}>{label}</Text>
    </View>
  );
}
