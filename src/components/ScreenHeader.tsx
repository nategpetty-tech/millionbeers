import { Text, View } from "react-native";
import { useAppTheme } from "@/theme";

type Props = {
  eyebrow?: string;
  title: string;
  subtitle?: string;
};

export function ScreenHeader({ eyebrow = "PINTLY", title, subtitle }: Props) {
  const theme = useAppTheme();

  return (
    <View style={{ paddingHorizontal: 20, paddingTop: 18, paddingBottom: 14 }}>
      <Text
        style={{
          color: theme.colors.primary,
          letterSpacing: 2,
          fontSize: 12,
          fontWeight: "900"
        }}
      >
        {eyebrow}
      </Text>
      <Text
        style={{
          color: theme.colors.textPrimary,
          fontSize: 34,
          fontWeight: "900",
          marginTop: 4,
          fontFamily: "Georgia"
        }}
      >
        {title}
      </Text>
      {subtitle ? <Text style={{ color: theme.colors.textSecondary, marginTop: 6, lineHeight: 20 }}>{subtitle}</Text> : null}
    </View>
  );
}
