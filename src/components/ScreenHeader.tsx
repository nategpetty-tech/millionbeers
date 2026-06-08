import { Text, View } from "react-native";
import { theme } from "@/theme";

type Props = {
  eyebrow?: string;
  title: string;
  subtitle?: string;
};

export function ScreenHeader({ eyebrow = "PINTLY", title, subtitle }: Props) {
  return (
    <View style={{ paddingHorizontal: 20, paddingTop: 18, paddingBottom: 14 }}>
      <Text
        style={{
          color: theme.colors.gold,
          letterSpacing: 2,
          fontSize: 12,
          fontWeight: "900"
        }}
      >
        {eyebrow}
      </Text>
      <Text
        style={{
          color: theme.colors.text,
          fontSize: 34,
          fontWeight: "900",
          marginTop: 4,
          fontFamily: "Georgia"
        }}
      >
        {title}
      </Text>
      {subtitle ? <Text style={{ color: theme.colors.muted, marginTop: 6, lineHeight: 20 }}>{subtitle}</Text> : null}
    </View>
  );
}
