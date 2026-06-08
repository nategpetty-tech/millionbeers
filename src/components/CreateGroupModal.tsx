import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Alert, ImageBackground, Modal, Pressable, Text, TextInput, View } from "react-native";
import { compressBackdropPhoto } from "@/services/photoCompression";
import { isGroupBackdropStorageConfigured, uploadGroupBackdrop } from "@/services/photoStorage";
import { usePassport } from "@/store/passportStore";
import { Group } from "@/types";
import { theme } from "@/theme";
import { groupPhotoFor } from "@/utils/groupVisuals";

type Props = {
  visible: boolean;
  onClose: () => void;
};

const privacyOptions: Group["privacy"][] = ["Private", "Invite Only", "Public"];

export function CreateGroupModal({ visible, onClose }: Props) {
  const router = useRouter();
  const { createGroup, groups, user } = usePassport();
  const [name, setName] = useState("");
  const [goal, setGoal] = useState("1000");
  const [privacy, setPrivacy] = useState<Group["privacy"]>("Private");
  const [description, setDescription] = useState("");
  const [backdropUri, setBackdropUri] = useState<string | undefined>();
  const [saving, setSaving] = useState(false);

  async function pickBackdrop() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Photo access needed", "Allow photo library access to choose a custom group backdrop.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      allowsEditing: true,
      aspect: [16, 9],
      quality: 0.82
    });

    if (!result.canceled && result.assets[0]?.uri) {
      const compressed = await compressBackdropPhoto(result.assets[0].uri);
      setBackdropUri(compressed.uri);
    }
  }

  async function submit() {
    if (!name.trim()) {
      Alert.alert("Name required", "Give this crew a name first.");
      return;
    }
    if (groups.some((group) => group.name.trim().toLowerCase() === name.trim().toLowerCase())) {
      Alert.alert("Group already exists", "Choose a different name so crews stay easy to tell apart.");
      return;
    }
    setSaving(true);
    try {
      let uploadedBackdrop: { signedUrl: string; storagePath: string } | undefined;
      if (backdropUri && isGroupBackdropStorageConfigured()) {
        uploadedBackdrop = await uploadGroupBackdrop(backdropUri, user.id);
      }
      const group = createGroup({
        name,
        goal: Number(goal) || 1000,
        privacy,
        description,
        backdropUrl: uploadedBackdrop?.signedUrl ?? backdropUri,
        backdropStoragePath: uploadedBackdrop?.storagePath
      });
      setName("");
      setGoal("1000");
      setPrivacy("Private");
      setDescription("");
      setBackdropUri(undefined);
      onClose();
      router.push(`/groups/${group.id}`);
    } catch {
      Alert.alert("Backdrop upload failed", "The group was not created because the custom backdrop could not upload. Try again in a moment.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: theme.colors.background, padding: 20 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
          <View>
            <Text style={{ color: theme.colors.gold, fontSize: 12, fontWeight: "900", letterSpacing: 2 }}>PRIVATE CREW</Text>
            <Text style={{ color: theme.colors.text, fontSize: 28, fontWeight: "900", fontFamily: "Georgia" }}>Create Group</Text>
          </View>
          <Pressable onPress={onClose} style={{ padding: 8 }}>
            <Ionicons name="close" color={theme.colors.text} size={28} />
          </Pressable>
        </View>
        <Text style={{ color: theme.colors.muted, fontWeight: "800", marginBottom: 8 }}>Backdrop</Text>
        <ImageBackground
          source={{ uri: backdropUri ?? groupPhotoFor(name || "Pintly Crew") }}
          style={{ height: 128, justifyContent: "flex-end", marginBottom: 12, overflow: "hidden" }}
          imageStyle={{ borderRadius: theme.radius.lg }}
          resizeMode="cover"
        >
          <View style={{ padding: 12 }}>
            <Text
              style={{
                color: theme.colors.text,
                fontWeight: "900",
                fontFamily: "Georgia",
                fontSize: 20,
                textShadowColor: "rgba(0,0,0,0.85)",
                textShadowRadius: 10
              }}
            >
              {name.trim() || "New Group"}
            </Text>
            <Pressable
              onPress={() => void pickBackdrop()}
              style={{
                alignSelf: "flex-start",
                flexDirection: "row",
                alignItems: "center",
                gap: 7,
                backgroundColor: theme.colors.neon,
                borderRadius: theme.radius.pill,
                paddingHorizontal: 11,
                paddingVertical: 8,
                marginTop: 10
              }}
            >
              <Ionicons name="image-outline" color={theme.colors.ink} size={16} />
              <Text style={{ color: theme.colors.ink, fontWeight: "900" }}>{backdropUri ? "Change backdrop" : "Choose backdrop"}</Text>
            </Pressable>
          </View>
        </ImageBackground>
        <Field label="Group name" value={name} onChangeText={setName} placeholder="Rooftop Club" />
        <Field label="Goal beers" value={goal} onChangeText={setGoal} placeholder="1000" keyboardType="decimal-pad" />
        <Text style={{ color: theme.colors.muted, fontWeight: "800", marginBottom: 8 }}>Privacy</Text>
        <View style={{ flexDirection: "row", gap: 8, marginBottom: 14 }}>
          {privacyOptions.map((option) => (
            <Pressable
              key={option}
              onPress={() => setPrivacy(option)}
              style={{
                flex: 1,
                paddingVertical: 11,
                borderRadius: theme.radius.pill,
                backgroundColor: privacy === option ? theme.colors.neon : theme.colors.card,
                alignItems: "center",
                borderWidth: 1,
                borderColor: privacy === option ? theme.colors.neon : theme.colors.border
              }}
            >
              <Text style={{ color: privacy === option ? theme.colors.ink : theme.colors.text, fontWeight: "800", fontSize: 12 }}>
                {option}
              </Text>
            </Pressable>
          ))}
        </View>
        <Field label="Description" value={description} onChangeText={setDescription} placeholder="Optional group note" multiline />
        <Pressable
          onPress={() => void submit()}
          disabled={saving}
          style={{
            backgroundColor: saving ? theme.colors.cardSoft : theme.colors.neon,
            borderRadius: theme.radius.pill,
            paddingVertical: 16,
            alignItems: "center",
            marginTop: 14
          }}
        >
          {saving ? <ActivityIndicator color={theme.colors.dim} /> : <Text style={{ color: theme.colors.ink, fontWeight: "900", fontSize: 16 }}>Create Group</Text>}
        </Pressable>
      </View>
    </Modal>
  );
}

type FieldProps = {
  label: string;
  value: string;
  placeholder: string;
  onChangeText: (value: string) => void;
  keyboardType?: "default" | "decimal-pad";
  multiline?: boolean;
};

function Field({ label, value, placeholder, onChangeText, keyboardType = "default", multiline }: FieldProps) {
  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={{ color: theme.colors.muted, fontWeight: "800", marginBottom: 7 }}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={theme.colors.dim}
        keyboardType={keyboardType}
        multiline={multiline}
        style={{
          minHeight: multiline ? 110 : 50,
          color: theme.colors.text,
          backgroundColor: theme.colors.card,
          borderWidth: 1,
          borderColor: theme.colors.border,
          borderRadius: theme.radius.md,
          paddingHorizontal: 14,
          paddingVertical: 12,
          textAlignVertical: multiline ? "top" : "center"
        }}
      />
    </View>
  );
}
