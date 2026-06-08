import { Ionicons } from "@expo/vector-icons";
import { Pressable, Text } from "react-native";
import { theme } from "@/theme";

type Props = {
  label: string;
  icon?: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
};

export function PrimaryButton({ label, icon = "camera-outline", onPress }: Props) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        opacity: pressed ? 0.84 : 1,
        backgroundColor: theme.colors.neon,
        borderRadius: theme.radius.sm,
        paddingVertical: 14,
        alignItems: "center",
        flexDirection: "row",
        justifyContent: "center",
        gap: 8
      })}
    >
      <Ionicons name={icon} color={theme.colors.ink} size={22} />
      <Text style={{ color: theme.colors.ink, fontSize: 16, fontWeight: "900" }}>{label}</Text>
    </Pressable>
  );
}
