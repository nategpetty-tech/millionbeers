import { Ionicons } from "@expo/vector-icons";
import { Modal, Pressable, ScrollView, Text, View } from "react-native";
import { Avatar } from "@/components/Avatar";
import { AppTheme } from "@/theme";
import { ReactionUser } from "@/types";

type Props = {
  visible: boolean;
  reactionUsers: ReactionUser[];
  onClose: () => void;
  onUserPress?: (userId: string) => void;
  theme: AppTheme;
};

export function LikersModal({ visible, reactionUsers, onClose, onUserPress, theme }: Props) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable onPress={onClose} style={{ flex: 1, backgroundColor: theme.colors.modalBackdrop, justifyContent: "flex-end" }}>
        <Pressable
          onPress={(event) => event.stopPropagation()}
          style={{
            backgroundColor: theme.colors.card,
            borderTopLeftRadius: 28,
            borderTopRightRadius: 28,
            borderWidth: 1,
            borderColor: theme.colors.cardBorder,
            padding: 20,
            maxHeight: "62%"
          }}
        >
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <View>
              <Text style={{ color: theme.colors.accent, fontWeight: "900", fontSize: 12, letterSpacing: 1.4 }}>LIKED BY</Text>
              <Text style={{ color: theme.colors.textPrimary, fontWeight: "900", fontSize: 24, marginTop: 2 }}>
                {reactionUsers.length || "No"} {reactionUsers.length === 1 ? "person" : "people"}
              </Text>
            </View>
            <Pressable onPress={onClose} hitSlop={8}>
              <Ionicons name="close" color={theme.colors.textPrimary} size={26} />
            </Pressable>
          </View>

          {reactionUsers.length ? (
            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={{ gap: 10, paddingBottom: 8 }}>
                {reactionUsers.map((reactionUser) => {
                  const row = (
                    <>
                      <Avatar label={reactionUser.avatar} uri={reactionUser.avatarUrl} size={38} />
                      <Text style={{ color: theme.colors.textPrimary, fontWeight: "900", fontSize: 16 }}>{reactionUser.name}</Text>
                    </>
                  );

                  if (!onUserPress) {
                    return (
                      <View key={reactionUser.id} style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                        {row}
                      </View>
                    );
                  }

                  return (
                    <Pressable
                      key={reactionUser.id}
                      onPress={() => {
                        onClose();
                        onUserPress(reactionUser.id);
                      }}
                      style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 10, opacity: pressed ? 0.76 : 1 })}
                    >
                      {row}
                    </Pressable>
                  );
                })}
              </View>
            </ScrollView>
          ) : (
            <Text style={{ color: theme.colors.textSecondary, lineHeight: 20 }}>No likes yet.</Text>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}
