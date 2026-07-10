import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Alert, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Avatar } from "@/components/Avatar";
import { compressProfilePhoto } from "@/services/photoCompression";
import { deleteCloudflareImage, isProfilePhotoStorageConfigured, uploadProfilePhoto } from "@/services/photoStorage";
import { usePassport } from "@/store/passportStore";
import { theme } from "@/theme";
import { normalizeUsername, usernameValidationError } from "@/utils/accountValidation";

type Props = {
  visible: boolean;
  initialFocus?: "favoriteBeer";
  onClose: () => void;
};

export function ProfileModal({ visible, initialFocus, onClose }: Props) {
  const { user, checkIns, updateProfile, claimUsername } = usePassport();
  const insets = useSafeAreaInsets();
  const scrollViewRef = useRef<ScrollView>(null);
  const favoriteBeerInputRef = useRef<TextInput>(null);
  const [name, setName] = useState(user.name);
  const [favoriteBeer, setFavoriteBeer] = useState(user.favoriteBeer ?? "");
  const [favoriteBeerFocused, setFavoriteBeerFocused] = useState(false);
  const [username, setUsername] = useState("");
  const [avatarUri, setAvatarUri] = useState(user.avatarUrl);
  const [avatarStoragePath, setAvatarStoragePath] = useState(user.avatarStoragePath);
  const [avatarCloudflareImageId, setAvatarCloudflareImageId] = useState(user.avatarCloudflareImageId);
  const [avatarSize, setAvatarSize] = useState<{ width?: number; height?: number }>({ width: user.avatarImageWidth, height: user.avatarImageHeight });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (visible) {
      setName(user.name);
      setFavoriteBeer(user.favoriteBeer ?? "");
      setUsername("");
      setAvatarUri(user.avatarUrl);
      setAvatarStoragePath(user.avatarStoragePath);
      setAvatarCloudflareImageId(user.avatarCloudflareImageId);
      setAvatarSize({ width: user.avatarImageWidth, height: user.avatarImageHeight });
      setFavoriteBeerFocused(false);
      setSaving(false);
    }
  }, [user.avatarCloudflareImageId, user.avatarImageHeight, user.avatarImageWidth, user.avatarStoragePath, user.avatarUrl, user.favoriteBeer, user.name, visible]);

  const favoriteBeerOptions = useMemo(() => favoriteBeerOptionsFor(checkIns.filter((checkIn) => checkIn.userId === user.id)), [checkIns, user.id]);
  const favoriteBeerSuggestions = useMemo(() => favoriteBeerSuggestionsFor(favoriteBeer, favoriteBeerOptions), [favoriteBeer, favoriteBeerOptions]);

  useEffect(() => {
    if (!visible || initialFocus !== "favoriteBeer") return;
    const timer = setTimeout(() => {
      favoriteBeerInputRef.current?.focus();
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 350);
    return () => clearTimeout(timer);
  }, [initialFocus, visible]);

  function revealFavoriteBeerInput() {
    setFavoriteBeerFocused(true);
    setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 120);
  }

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
        favoriteBeer: favoriteBeer.trim(),
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
      <KeyboardAvoidingView style={{ flex: 1, backgroundColor: theme.colors.background }} behavior={Platform.OS === "ios" ? "padding" : "height"} keyboardVerticalOffset={Platform.OS === "ios" ? insets.top : 0}>
        <ScrollView
          ref={scrollViewRef}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          contentContainerStyle={{ padding: 20, paddingBottom: Math.max(insets.bottom, 16) + 140 }}
        >
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
            <View style={{ flex: 1, paddingRight: 12 }}>
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
            returnKeyType="done"
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

          <Text style={{ color: theme.colors.textSecondary, fontWeight: "800", marginTop: 16, marginBottom: 7 }}>Favorite beer</Text>
          <TextInput
            ref={favoriteBeerInputRef}
            value={favoriteBeer}
            onChangeText={setFavoriteBeer}
            placeholder="Choose or type a favorite beer"
            placeholderTextColor={theme.colors.textMuted}
            autoCapitalize="words"
            returnKeyType="done"
            onFocus={revealFavoriteBeerInput}
            onBlur={() => setTimeout(() => setFavoriteBeerFocused(false), 160)}
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
          {favoriteBeerFocused && favoriteBeerSuggestions.length ? (
            <View style={{ backgroundColor: theme.colors.card, borderWidth: 1, borderColor: theme.colors.cardBorder, borderRadius: theme.radius.md, marginTop: 8, overflow: "hidden" }}>
              {favoriteBeerSuggestions.map((beer, index) => {
                const selected = favoriteBeer.trim().toLowerCase() === beer.toLowerCase();
                return (
                  <Pressable
                    key={beer}
                    onPress={() => setFavoriteBeer(beer)}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 9,
                      paddingHorizontal: 13,
                      paddingVertical: 12,
                      borderTopWidth: index === 0 ? 0 : 1,
                      borderTopColor: theme.colors.cardBorder,
                      backgroundColor: selected ? theme.colors.primarySoft : theme.colors.card
                    }}
                  >
                    <Ionicons name="beer-outline" color={selected ? theme.colors.primary : theme.colors.iconSecondary} size={17} />
                    <Text numberOfLines={1} style={{ flex: 1, color: selected ? theme.colors.primary : theme.colors.textPrimary, fontWeight: "900" }}>
                      {beer}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          ) : null}
          {favoriteBeer.trim() ? (
            <Pressable onPress={() => setFavoriteBeer("")} style={{ alignSelf: "flex-start", marginTop: 10, paddingVertical: 6 }}>
              <Text style={{ color: theme.colors.textMuted, fontWeight: "800" }}>Clear favorite beer</Text>
            </Pressable>
          ) : null}

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
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function favoriteBeerOptionsFor(checkIns: Array<{ beerName: string; createdAt: string }>) {
  const seen = new Set<string>();
  return [...checkIns]
    .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())
    .map((checkIn) => checkIn.beerName.trim())
    .filter((beerName) => {
      const key = beerName.toLowerCase();
      if (!key || seen.has(key) || isGenericBeerName(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 8);
}

function favoriteBeerSuggestionsFor(query: string, options: string[]) {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return options.slice(0, 6);
  return options
    .filter((beer) => beer.toLowerCase().includes(normalizedQuery))
    .sort((left, right) => suggestionRank(left, normalizedQuery) - suggestionRank(right, normalizedQuery))
    .slice(0, 6);
}

function suggestionRank(beerName: string, query: string) {
  const normalized = beerName.toLowerCase();
  if (normalized === query) return 0;
  if (normalized.startsWith(query)) return 1;
  return 2;
}

function isGenericBeerName(value: string) {
  return ["photo stamp", "beer log", "pintly log", "check-in"].some((generic) => value.includes(generic));
}
