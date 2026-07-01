import { Ionicons } from "@expo/vector-icons";
import { Pressable, Text, View } from "react-native";
import { theme } from "@/theme";

type Props = {
  title: string;
  body: string;
  icon?: keyof typeof Ionicons.glyphMap;
  actionLabel?: string;
  onAction?: () => void;
};

export function EmptyState({ title, body, icon = "beer-outline", actionLabel, onAction }: Props) {
  return (
    <View
      style={{
        alignItems: "center",
        justifyContent: "center",
        padding: 28,
        borderRadius: theme.radius.lg,
        backgroundColor: theme.colors.card,
        borderWidth: 1,
        borderColor: theme.colors.cardBorder,
        ...theme.shadow.card
      }}
    >
      <Ionicons name={icon} color={theme.colors.primary} size={34} />
      <Text style={{ color: theme.colors.textPrimary, fontWeight: "900", fontSize: 18, marginTop: 10 }}>{title}</Text>
      <Text style={{ color: theme.colors.textSecondary, textAlign: "center", marginTop: 6, lineHeight: 20 }}>{body}</Text>
      {actionLabel && onAction ? (
        <Pressable
          onPress={onAction}
          style={{
            backgroundColor: theme.colors.primary,
            borderRadius: theme.radius.pill,
            paddingHorizontal: 16,
            paddingVertical: 10,
            marginTop: 16
          }}
        >
          <Text style={{ color: theme.colors.textOnPrimary, fontWeight: "900" }}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}
