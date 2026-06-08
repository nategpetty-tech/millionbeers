import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Modal, Pressable, Text, TextInput, View } from "react-native";
import { Avatar } from "@/components/Avatar";
import { compressProfilePhoto } from "@/services/photoCompression";
import { isProfilePhotoStorageConfigured, uploadProfilePhoto } from "@/services/photoStorage";
import { usePassport } from "@/store/passportStore";
import { theme } from "@/theme";

type Props = {
  visible: boolean;
  onClose: () => void;
};

export function ProfileModal({ visible, onClose }: Props) {
  const { user, updateProfile } = usePassport();
  const [name, setName] = useState(user.name);
  const [avatarUri, setAvatarUri] = useState(user.avatarUrl);
  const [avatarStoragePath, setAvatarStoragePath] = useState(user.avatarStoragePath);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (visible) {
      setName(user.name);
      setAvatarUri(user.avatarUrl);
      setAvatarStoragePath(user.avatarStoragePath);
      setSaving(false);
    }
  }, [user.avatarStoragePath, user.avatarUrl, user.name, visible]);

  async function pickPhoto() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Photo access needed", "Allow photo library access to choose a Pintly profile picture.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8
    });

    if (!result.canceled && result.assets[0]?.uri) {
      const compressed = await compressProfilePhoto(result.assets[0].uri);
      setAvatarUri(compressed.uri);
      setAvatarStoragePath(undefined);
    }
  }

  async function submit() {
    const trimmed = name.trim();
    if (!trimmed) return;
    setSaving(true);
    try {
      let nextAvatarUrl = avatarUri;
      let nextAvatarStoragePath = avatarStoragePath;
      const shouldUpload = avatarUri && avatarUri !== user.avatarUrl && isProfilePhotoStorageConfigured();

      if (shouldUpload) {
        const uploaded = await uploadProfilePhoto(avatarUri, user.id);
        nextAvatarUrl = uploaded.signedUrl;
        nextAvatarStoragePath = uploaded.storagePath;
      }

      updateProfile({ name: trimmed, avatarUrl: nextAvatarUrl, avatarStoragePath: nextAvatarStoragePath });
      onClose();
    } catch {
      Alert.alert("Profile photo failed", "Your profile was not saved because the photo could not upload. Try again in a moment.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: theme.colors.background, padding: 20 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <View>
            <Text style={{ color: theme.colors.gold, fontSize: 12, fontWeight: "900", letterSpacing: 2 }}>PROFILE</Text>
            <Text style={{ color: theme.colors.text, fontSize: 28, fontWeight: "900", fontFamily: "Georgia" }}>Edit Pintly Profile</Text>
          </View>
          <Pressable onPress={onClose} style={{ padding: 8 }}>
            <Ionicons name="close" color={theme.colors.text} size={28} />
          </Pressable>
        </View>

        <View
          style={{
            alignItems: "center",
            backgroundColor: theme.colors.card,
            borderWidth: 1,
            borderColor: theme.colors.border,
            borderRadius: theme.radius.lg,
            padding: 18,
            marginBottom: 18
          }}
        >
          <Avatar label={user.avatar} uri={avatarUri} size={96} borderColor={theme.colors.neon} />
          <Pressable
            onPress={() => void pickPhoto()}
            style={{
              marginTop: 14,
              flexDirection: "row",
              alignItems: "center",
              gap: 8,
              paddingVertical: 10,
              paddingHorizontal: 14,
              borderRadius: theme.radius.pill,
              backgroundColor: theme.colors.neonSoft,
              borderWidth: 1,
              borderColor: theme.colors.neon
            }}
          >
            <Ionicons name="image-outline" color={theme.colors.neon} size={18} />
            <Text style={{ color: theme.colors.neon, fontWeight: "900" }}>{avatarUri ? "Change profile photo" : "Add profile photo"}</Text>
          </Pressable>
        </View>

        <Text style={{ color: theme.colors.muted, fontWeight: "800", marginBottom: 7 }}>Display name</Text>
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="Your name"
          placeholderTextColor={theme.colors.dim}
          autoCapitalize="words"
          style={{
            height: 54,
            color: theme.colors.text,
            backgroundColor: theme.colors.card,
            borderWidth: 1,
            borderColor: theme.colors.border,
            borderRadius: theme.radius.md,
            paddingHorizontal: 15,
            fontSize: 16
          }}
        />

        <Pressable
          onPress={() => void submit()}
          disabled={!name.trim() || saving}
          style={{
            backgroundColor: name.trim() && !saving ? theme.colors.neon : theme.colors.cardSoft,
            borderRadius: theme.radius.pill,
            paddingVertical: 16,
            alignItems: "center",
            marginTop: 18
          }}
        >
          {saving ? <ActivityIndicator color={theme.colors.dim} /> : <Text style={{ color: name.trim() ? theme.colors.ink : theme.colors.dim, fontWeight: "900" }}>Save Profile</Text>}
        </Pressable>
      </View>
    </Modal>
  );
}
