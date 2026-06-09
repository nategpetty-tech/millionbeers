import { Ionicons } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import { Alert, Image } from "react-native";
import { Modal, Pressable, Text, TextInput, View } from "react-native";
import { Avatar } from "@/components/Avatar";
import { BeerCheckIn } from "@/types";
import { theme } from "@/theme";
import { broadPlaceLabel, timeAgo } from "@/utils/format";

type Props = {
  item: BeerCheckIn;
  currentUserId: string;
  onReact?: (id: string) => void;
  onEdit?: (id: string, input: { quantity: number; note?: string }) => void;
  onDelete?: (id: string) => void;
  variant?: "compact" | "photo";
};

export function ActivityItem({ item, currentUserId, onReact, onEdit, onDelete, variant = "compact" }: Props) {
  const reacted = item.reactedBy.includes(currentUserId);
  const canDelete = item.userId === currentUserId && Boolean(onDelete);
  const photoSource = item.photoUrl ?? item.photoUri;
  const placeLabel = broadPlaceLabel(item.location);
  const normalizedBrewery = item.brewery.toLowerCase();
  const showBrewery = item.brewery && !normalizedBrewery.includes("check-in") && !normalizedBrewery.includes("pintly log");
  const isGenericPhotoStamp = ["photo stamp", "beer log"].includes(item.beerName.trim().toLowerCase());
  const loggedCopy = `logged ${item.quantity} beer${item.quantity === 1 ? "" : "s"}`;
  const [imageFailed, setImageFailed] = useState(false);
  const [photoOpen, setPhotoOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [photoSize, setPhotoSize] = useState<{ width: number; height: number } | undefined>();

  useEffect(() => {
    setImageFailed(false);
    setPhotoSize(undefined);
    if (photoSource) {
      Image.getSize(
        photoSource,
        (width, height) => setPhotoSize({ width, height }),
        () => setPhotoSize(undefined)
      );
    }
  }, [item.id, photoSource]);

  function confirmDelete() {
    Alert.alert("Delete check-in?", "This removes the stamp from Pintly and any selected group trackers.", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => onDelete?.(item.id) }
    ]);
  }

  return (
    <View
      style={{
        backgroundColor: theme.colors.card,
        borderRadius: theme.radius.md,
        borderWidth: 1,
        borderColor: theme.colors.border,
        padding: 12,
        marginBottom: 9
      }}
    >
      <View style={{ flexDirection: "row", gap: 11, alignItems: "center" }}>
        <Avatar label={item.userAvatar} uri={item.userAvatarUrl} size={38} />
        <View style={{ flex: 1 }}>
          <Text style={{ color: theme.colors.muted, fontSize: 12 }}>
            <Text style={{ color: theme.colors.neon, fontWeight: "900" }}>{item.userName}</Text> {loggedCopy}
          </Text>
          {!isGenericPhotoStamp ? (
            <Text style={{ color: theme.colors.text, marginTop: 2, fontWeight: "900", fontSize: 15 }}>{item.beerName}</Text>
          ) : null}
          <Text style={{ color: theme.colors.dim, marginTop: 2, fontSize: 12 }}>{timeAgo(item.createdAt)}</Text>
        </View>
        {variant === "compact" ? (
          <PhotoThumb photoSource={photoSource} imageFailed={imageFailed} onPress={() => setPhotoOpen(true)} onError={() => setImageFailed(true)} />
        ) : null}
        <View style={{ alignItems: "center", gap: 8 }}>
          {canDelete && onEdit ? (
            <Pressable onPress={() => setEditOpen(true)} hitSlop={8}>
              <Ionicons name="create-outline" color={theme.colors.neon} size={18} />
            </Pressable>
          ) : null}
          {canDelete ? (
            <Pressable onPress={confirmDelete} hitSlop={8}>
              <Ionicons name="trash-outline" color={theme.colors.dim} size={18} />
            </Pressable>
          ) : null}
        </View>
      </View>
      {variant === "photo" ? (
        <PhotoPanel
          item={item}
          photoSource={photoSource}
          photoSize={photoSize}
          imageFailed={imageFailed}
          onPress={() => setPhotoOpen(true)}
          onError={() => setImageFailed(true)}
        />
      ) : null}
      {item.note ? <Text style={{ color: theme.colors.muted, marginTop: 12, lineHeight: 20 }}>{item.note}</Text> : null}
      {item.quantity > 1 ? (
        <View
          style={{
            alignSelf: "flex-start",
            marginTop: 10,
            paddingHorizontal: 10,
            paddingVertical: 6,
            borderRadius: theme.radius.pill,
            backgroundColor: theme.colors.neonSoft,
            borderWidth: 1,
            borderColor: theme.colors.neon
          }}
        >
          <Text style={{ color: theme.colors.neon, fontWeight: "900", fontSize: 12 }}>{item.quantity} beers counted</Text>
        </View>
      ) : null}
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 12 }}>
        <View style={{ flex: 1, paddingRight: 10 }}>
          <Text style={{ color: theme.colors.dim, fontSize: 12 }}>{placeLabel}</Text>
          {showBrewery ? <Text style={{ color: theme.colors.dim, fontSize: 11, marginTop: 2 }}>{item.brewery}</Text> : null}
        </View>
        <Pressable
          onPress={() => onReact?.(item.id)}
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 6,
            paddingHorizontal: 10,
            paddingVertical: 6,
            borderRadius: theme.radius.pill,
            backgroundColor: reacted ? theme.colors.neonSoft : theme.colors.cardSoft
          }}
        >
          <Ionicons name={reacted ? "heart" : "heart-outline"} color={reacted ? theme.colors.neon : theme.colors.muted} size={16} />
          <Text style={{ color: reacted ? theme.colors.neon : theme.colors.muted, fontWeight: "800" }}>{item.reactions}</Text>
        </Pressable>
      </View>
      <PhotoViewer visible={photoOpen && Boolean(photoSource) && !imageFailed} item={item} photoSource={photoSource} photoSize={photoSize} onClose={() => setPhotoOpen(false)} />
      <EditCheckInModal
        visible={editOpen}
        item={item}
        onClose={() => setEditOpen(false)}
        onSave={(input) => {
          onEdit?.(item.id, input);
          setEditOpen(false);
        }}
      />
    </View>
  );
}

function PhotoThumb({ photoSource, imageFailed, onPress, onError }: { photoSource?: string; imageFailed: boolean; onPress: () => void; onError: () => void }) {
  if (photoSource && !imageFailed) {
    return (
      <Pressable onPress={onPress} style={({ pressed }) => ({ opacity: pressed ? 0.82 : 1 })}>
        <Image source={{ uri: photoSource }} onError={onError} style={{ width: 48, height: 52, borderRadius: 9 }} resizeMode="cover" />
      </Pressable>
    );
  }
  return (
    <View
      style={{
        width: 48,
        height: 52,
        borderRadius: 9,
        backgroundColor: theme.colors.cardSoft,
        alignItems: "center",
        justifyContent: "center",
        borderWidth: 1,
        borderColor: theme.colors.border
      }}
    >
      <Ionicons name="beer-outline" color={theme.colors.gold} size={24} />
    </View>
  );
}

function PhotoPanel({
  item,
  photoSource,
  photoSize,
  imageFailed,
  onPress,
  onError
}: {
  item: BeerCheckIn;
  photoSource?: string;
  photoSize?: { width: number; height: number };
  imageFailed: boolean;
  onPress: () => void;
  onError: () => void;
}) {
  const [previewSize, setPreviewSize] = useState({ width: 0, height: 0 });

  return (
    <View
      onLayout={(event) => {
        const { width, height } = event.nativeEvent.layout;
        setPreviewSize({ width, height });
      }}
      style={{
        marginTop: 12,
        borderRadius: theme.radius.lg,
        overflow: "hidden",
        borderWidth: 1,
        borderColor: photoSource && !imageFailed ? theme.colors.neon : theme.colors.border,
        backgroundColor: theme.colors.surface,
        minHeight: 178
      }}
    >
      {photoSource && !imageFailed ? (
        <Pressable onPress={onPress} style={({ pressed }) => ({ opacity: pressed ? 0.9 : 1 })}>
          <Image source={{ uri: photoSource }} onError={onError} style={{ width: "100%", aspectRatio: 4 / 3 }} resizeMode="contain" />
        </Pressable>
      ) : (
        <View style={{ minHeight: 178, alignItems: "center", justifyContent: "center", padding: 18 }}>
          <Ionicons name="beer-outline" size={30} color={theme.colors.gold} />
          <Text style={{ color: theme.colors.text, fontWeight: "900", marginTop: 10 }}>{photoSource ? "Photo could not load" : "No photo attached"}</Text>
        </View>
      )}
    </View>
  );
}

function EditCheckInModal({
  visible,
  item,
  onClose,
  onSave
}: {
  visible: boolean;
  item: BeerCheckIn;
  onClose: () => void;
  onSave: (input: { quantity: number; note?: string }) => void;
}) {
  const [quantity, setQuantity] = useState(String(item.quantity));
  const [note, setNote] = useState(item.note ?? "");

  useEffect(() => {
    if (!visible) return;
    setQuantity(String(item.quantity));
    setNote(item.note ?? "");
  }, [item.id, item.note, item.quantity, visible]);

  const numericQuantity = Math.max(1, Math.min(24, Math.floor(Number(quantity) || 1)));

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: theme.colors.background, padding: 20 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
          <View>
            <Text style={{ color: theme.colors.gold, fontSize: 12, fontWeight: "900", letterSpacing: 2 }}>EDIT LOG</Text>
            <Text style={{ color: theme.colors.text, fontSize: 28, fontWeight: "900", fontFamily: "Georgia" }}>Beer Count</Text>
          </View>
          <Pressable onPress={onClose} style={{ padding: 8 }}>
            <Ionicons name="close" color={theme.colors.text} size={28} />
          </Pressable>
        </View>

        <View style={{ backgroundColor: theme.colors.card, borderRadius: theme.radius.lg, borderWidth: 1, borderColor: theme.colors.border, padding: 14, gap: 12 }}>
          <Text style={{ color: theme.colors.text, fontWeight: "900", fontSize: 16 }}>Beers counted</Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <Pressable
              onPress={() => setQuantity(String(Math.max(1, numericQuantity - 1)))}
              style={{
                width: 42,
                height: 42,
                borderRadius: 21,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: theme.colors.neonSoft,
                borderWidth: 1,
                borderColor: theme.colors.neon
              }}
            >
              <Ionicons name="remove" color={theme.colors.neon} size={22} />
            </Pressable>
            <TextInput
              value={quantity}
              onChangeText={setQuantity}
              keyboardType="number-pad"
              placeholder="1"
              placeholderTextColor={theme.colors.dim}
              style={{
                flex: 1,
                color: theme.colors.neon,
                fontWeight: "900",
                fontSize: 24,
                textAlign: "center",
                backgroundColor: theme.colors.surface,
                borderRadius: theme.radius.md,
                borderWidth: 1,
                borderColor: theme.colors.border,
                paddingVertical: 10
              }}
            />
            <Pressable
              onPress={() => setQuantity(String(Math.min(24, numericQuantity + 1)))}
              style={{
                width: 42,
                height: 42,
                borderRadius: 21,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: theme.colors.neonSoft,
                borderWidth: 1,
                borderColor: theme.colors.neon
              }}
            >
              <Ionicons name="add" color={theme.colors.neon} size={22} />
            </Pressable>
          </View>
          <Text style={{ color: theme.colors.muted, lineHeight: 20 }}>
            {typeof item.scannedBeerCount === "number"
              ? `Scanner originally saw ${item.scannedBeerCount}. Saving this edit marks the log as a manual count.`
              : "Saving this edit marks the log as a manual count."}
          </Text>
        </View>

        <View style={{ marginTop: 14 }}>
          <Text style={{ color: theme.colors.muted, fontWeight: "800", marginBottom: 7 }}>Note</Text>
          <TextInput
            value={note}
            onChangeText={setNote}
            placeholder="Optional note"
            placeholderTextColor={theme.colors.dim}
            multiline
            style={{
              minHeight: 120,
              color: theme.colors.text,
              backgroundColor: theme.colors.card,
              borderWidth: 1,
              borderColor: theme.colors.border,
              borderRadius: theme.radius.md,
              paddingHorizontal: 14,
              paddingVertical: 12,
              textAlignVertical: "top"
            }}
          />
        </View>

        <Pressable
          onPress={() => onSave({ quantity: numericQuantity, note })}
          style={{ backgroundColor: theme.colors.neon, borderRadius: theme.radius.pill, paddingVertical: 16, alignItems: "center", marginTop: 18 }}
        >
          <Text style={{ color: theme.colors.ink, fontWeight: "900", fontSize: 16 }}>Save Changes</Text>
        </Pressable>
      </View>
    </Modal>
  );
}

function PhotoViewer({
  visible,
  item,
  photoSource,
  photoSize,
  onClose
}: {
  visible: boolean;
  item: BeerCheckIn;
  photoSource?: string;
  photoSize?: { width: number; height: number };
  onClose: () => void;
}) {
  const [previewSize, setPreviewSize] = useState({ width: 0, height: 0 });
  if (!photoSource) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.92)", justifyContent: "center", padding: 16 }}>
        <Pressable onPress={onClose} style={{ position: "absolute", top: 54, right: 22, zIndex: 2, padding: 8 }}>
          <Ionicons name="close-circle" color={theme.colors.text} size={34} />
        </Pressable>
        <View
          onLayout={(event) => {
            const { width, height } = event.nativeEvent.layout;
            setPreviewSize({ width, height });
          }}
          style={{ width: "100%", aspectRatio: 3 / 4, borderRadius: theme.radius.lg, overflow: "hidden" }}
        >
          <Image source={{ uri: photoSource }} style={{ width: "100%", height: "100%" }} resizeMode="contain" />
    </View>
      </View>
    </Modal>
  );
}
