import { Text, View } from "react-native";
import { theme } from "@/theme";

type Props = {
  title: string;
  detail?: string;
};

export function SectionTitle({ title, detail }: Props) {
  return (
    <View style={{ marginTop: 4, marginBottom: 2 }}>
      <Text style={{ color: theme.colors.text, fontSize: 20, fontWeight: "900" }}>{title}</Text>
      {detail ? <Text style={{ color: theme.colors.muted, marginTop: 3, lineHeight: 19 }}>{detail}</Text> : null}
    </View>
  );
}
