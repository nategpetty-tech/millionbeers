import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Modal, Pressable, Text, TextInput, View } from "react-native";
import { Avatar } from "@/components/Avatar";
import { compressProfilePhoto } from "@/services/photoCompression";
import { deleteCloudflareImage, isProfilePhotoStorageConfigured, uploadProfilePhoto } from "@/services/photoStorage";
import { usePassport } from "@/store/passportStore";
import { theme } from "@/theme";
import { normalizeUsername, usernameValidationError } from "@/utils/accountValidation";

type Props = {
  visible: boolean;
  onClose: () => void;
};

export function ProfileModal({ visible, onClose }: Props) {
  const { user, updateProfile, claimUsername } = usePassport();
  const [name, setName] = useState(user.name);
  const [username, setUsername] = useState("");
  const [avatarUri, setAvatarUri] = useState(user.avatarUrl);
  const [avatarStoragePath, setAvatarStoragePath] = useState(user.avatarStoragePath);
  const [avatarCloudflareImageId, setAvatarCloudflareImageId] = useState(user.avatarCloudflareImageId);
  const [avatarSize, setAvatarSize] = useState<{ width?: number; height?: number }>({ width: user.avatarImageWidth, height: user.avatarImageHeight });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (visible) {
      setName(user.name);
      setUsername("");
      setAvatarUri(user.avatarUrl);
      setAvatarStoragePath(user.avatarStoragePath);
      setAvatarCloudflareImageId(user.avatarCloudflareImageId);
      setAvatarSize({ width: user.avatarImageWidth, height: user.avatarImageHeight });
      setSaving(false);
    }
  }, [user.avatarCloudflareImageId, user.avatarImageHeight, user.avatarImageWidth, user.avatarStoragePath, user.avatarUrl, user.name, visible]);

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
      setAvatarCloudflareImageId(undefined);
      setAvatarSize({ width: compressed.width, height: compressed.height });
    }
  }

  async function submitUsername() {
    const normalizedUsername = normalizeUsername(username);
    const validationError = usernameValidationError(normalizedUsername);
    if (validationError) {
      Alert.alert("Username unavailable", validationError);
      return;
    }
    setSaving(true);
    try {
      await claimUsername(normalizedUsername);
      setUsername("");
      Alert.alert("Username claimed", `@${normalizedUsername} is yours.`);
    } catch (error) {
      Alert.alert("Username unavailable", error instanceof Error ? error.message : "Choose another username.");
    } finally {
      setSaving(false);
    }
  }

  async function submit() {
    const trimmed = name.trim();
    if (!trimmed) return;
    setSaving(true);
    try {
      let nextAvatarUrl = avatarUri;
      let nextAvatarStoragePath = avatarStoragePath;
      let nextAvatarCloudflareImageId = avatarCloudflareImageId;
      const shouldUpload = avatarUri && avatarUri !== user.avatarUrl && isProfilePhotoStorageConfigured();

      if (shouldUpload) {
        const uploaded = await uploadProfilePhoto(avatarUri, user.id, avatarSize);
        nextAvatarUrl = uploaded.signedUrl;
        nextAvatarStoragePath = uploaded.storagePath;
        nextAvatarCloudflareImageId = uploaded.cloudflareImageId;
        if (user.avatarCloudflareImageId && user.avatarCloudflareImageId !== nextAvatarCloudflareImageId) {
          void deleteCloudflareImage(user.avatarCloudflareImageId);
        }
      }

      updateProfile({
        name: trimmed,
        avatarUrl: nextAvatarUrl,
        avatarStoragePath: nextAvatarStoragePath,
        avatarCloudflareImageId: nextAvatarCloudflareImageId,
        avatarImageWidth: avatarSize.width,
        avatarImageHeight: avatarSize.height
      });
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
            <Text style={{ color: theme.colors.primary, fontSize: 12, fontWeight: "900", letterSpacing: 2 }}>PROFILE</Text>
            <Text style={{ color: theme.colors.textPrimary, fontSize: 28, fontWeight: "900", fontFamily: "Georgia" }}>Edit Pintly Profile</Text>
          </View>
          <Pressable onPress={onClose} style={{ padding: 8 }}>
            <Ionicons name="close" color={theme.colors.textPrimary} size={28} />
          </Pressable>
        </View>

        <View
          style={{
            alignItems: "center",
            backgroundColor: theme.colors.card,
            borderWidth: 1,
            borderColor: theme.colors.cardBorder,
            borderRadius: theme.radius.lg,
            padding: 18,
            marginBottom: 18
          }}
        >
          <Avatar label={user.avatar} uri={avatarUri} size={96} borderColor={theme.colors.primary} />
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
              backgroundColor: theme.colors.primarySoft,
              borderWidth: 1,
              borderColor: theme.colors.primary
            }}
          >
            <Ionicons name="image-outline" color={theme.colors.primary} size={18} />
            <Text style={{ color: theme.colors.primary, fontWeight: "900" }}>{avatarUri ? "Change profile photo" : "Add profile photo"}</Text>
          </Pressable>
        </View>

        {user.username ? (
          <View
            style={{
              backgroundColor: theme.colors.card,
              borderWidth: 1,
              borderColor: theme.colors.cardBorder,
              borderRadius: theme.radius.md,
              padding: 14,
              marginBottom: 14
            }}
          >
            <Text style={{ color: theme.colors.textSecondary, fontWeight: "800", marginBottom: 6 }}>Username</Text>
            <Text style={{ color: theme.colors.textPrimary, fontSize: 16, fontWeight: "900" }}>@{user.username}</Text>
            <Text style={{ color: theme.colors.textMuted, lineHeight: 18, fontSize: 12, marginTop: 4 }}>
              Usernames are unique and cannot be changed yet. Your display name below can be changed anytime.
            </Text>
          </View>
        ) : (
          <View
            style={{
              backgroundColor: theme.colors.card,
              borderWidth: 1,
              borderColor: theme.colors.cardBorder,
              borderRadius: theme.radius.md,
              padding: 14,
              marginBottom: 14
            }}
          >
            <Text style={{ color: theme.colors.textSecondary, fontWeight: "800", marginBottom: 7 }}>Username</Text>
            <TextInput
              value={username}
              onChangeText={(value) => setUsername(normalizeUsername(value))}
              placeholder="unique_username"
              placeholderTextColor={theme.colors.textMuted}
              autoCapitalize="none"
              style={{
                height: 50,
                color: theme.colors.textPrimary,
                backgroundColor: theme.colors.surfaceAlt,
                borderWidth: 1,
                borderColor: theme.colors.cardBorder,
                borderRadius: theme.radius.md,
                paddingHorizontal: 13,
                fontSize: 16
              }}
            />
            <Text style={{ color: theme.colors.textMuted, lineHeight: 18, fontSize: 12, marginTop: 6 }}>
              Usernames are unique and cannot be changed yet. Your display name below can be changed anytime.
            </Text>
            <Pressable
              onPress={() => void submitUsername()}
              disabled={Boolean(usernameValidationError(username)) || saving}
              style={{
                marginTop: 10,
                alignItems: "center",
                paddingVertical: 11,
                borderRadius: theme.radius.pill,
                backgroundColor: !usernameValidationError(username) && !saving ? theme.colors.primarySoft : theme.colors.surfaceAlt,
                borderWidth: 1,
                borderColor: !usernameValidationError(username) && !saving ? theme.colors.primary : theme.colors.cardBorder
              }}
            >
              <Text style={{ color: !usernameValidationError(username) && !saving ? theme.colors.primary : theme.colors.textMuted, fontWeight: "900" }}>
                Claim username
              </Text>
            </Pressable>
          </View>
        )}

        <Text style={{ color: theme.colors.textSecondary, fontWeight: "800", marginBottom: 7 }}>Display name</Text>
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="Your name"
          placeholderTextColor={theme.colors.textMuted}
          autoCapitalize="words"
          style={{
            height: 54,
            color: theme.colors.textPrimary,
            backgroundColor: theme.colors.card,
            borderWidth: 1,
            borderColor: theme.colors.cardBorder,
            borderRadius: theme.radius.md,
            paddingHorizontal: 15,
            fontSize: 16
          }}
        />

        <Pressable
          onPress={() => void submit()}
          disabled={!name.trim() || saving}
          style={{
            backgroundColor: name.trim() && !saving ? theme.colors.primary : theme.colors.surfaceAlt,
            borderRadius: theme.radius.pill,
            paddingVertical: 16,
            alignItems: "center",
            marginTop: 18
          }}
        >
          {saving ? <ActivityIndicator color={theme.colors.textMuted} /> : <Text style={{ color: name.trim() ? theme.colors.textOnPrimary : theme.colors.textMuted, fontWeight: "900" }}>Save Profile</Text>}
        </Pressable>
      </View>
    </Modal>
  );
}
