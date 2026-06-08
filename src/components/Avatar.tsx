import { Image, Text, View } from "react-native";
import { theme } from "@/theme";

type Props = {
  label: string;
  uri?: string;
  size?: number;
  borderColor?: string;
};

export function Avatar({ label, uri, size = 40, borderColor = theme.colors.border }: Props) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        overflow: "hidden",
        backgroundColor: theme.colors.cardSoft,
        alignItems: "center",
        justifyContent: "center",
        borderWidth: 1,
        borderColor
      }}
    >
      {uri ? (
        <Image source={{ uri }} style={{ width: "100%", height: "100%" }} resizeMode="cover" />
      ) : (
        <Text style={{ color: theme.colors.neon, fontWeight: "900", fontSize: Math.max(12, Math.round(size * 0.38)) }}>{label}</Text>
      )}
    </View>
  );
}
