import { Ionicons } from "@expo/vector-icons";
import { useEffect, useRef, useState } from "react";
import { Alert, Image } from "react-native";
import { Modal, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { Avatar } from "@/components/Avatar";
import { CommentButton, CommentsSheet } from "@/components/CommentsSheet";
import { PostDetailModal } from "@/components/PostDetailModal";
import { BeerCheckIn, BeerComment, ModerationReportReason } from "@/types";
import { theme } from "@/theme";
import { broadPlaceLabel, timeAgo } from "@/utils/format";
import { checkInPhotoUrlCandidates } from "@/utils/photoUrls";
import { reactionUsersForCheckIn } from "@/utils/reactions";

type Props = {
  item: BeerCheckIn;
  currentUserId: string;
  onReact?: (id: string) => void;
  onAddComment?: (checkInId: string, body: string) => void;
  onDeleteComment?: (checkInId: string, commentId: string) => void;
  onReportComment?: (input: { checkInId: string; groupId?: string; comment: BeerComment; reason: ModerationReportReason; details: string }) => void;
  onEdit?: (id: string, input: { quantity: number; note?: string }) => void;
  onDelete?: (id: string) => void;
  variant?: "compact" | "photo";
};

export function ActivityItem({ item, currentUserId, onReact, onAddComment, onDeleteComment, onReportComment, onEdit, onDelete, variant = "compact" }: Props) {
  const reacted = item.reactedBy.includes(currentUserId);
  const canDelete = item.userId === currentUserId && Boolean(onDelete);
  const [imageFailed, setImageFailed] = useState(false);
  const [photoIndex, setPhotoIndex] = useState(0);
  const photoSources = checkInPhotoUrlCandidates(item, "feed");
  const fullPhotoSources = checkInPhotoUrlCandidates(item, "full");
  const photoSource = photoSources[photoIndex];
  const thumbnailSource = photoSource ?? item.photoThumbnailUrl;
  const fullPhotoSource = fullPhotoSources.find((url) => url === photoSource) ?? fullPhotoSources[0] ?? photoSource ?? item.photoThumbnailUrl;
  const placeLabel = broadPlaceLabel(item.location);
  const normalizedBrewery = item.brewery.toLowerCase();
  const showBrewery = item.brewery && !normalizedBrewery.includes("check-in") && !normalizedBrewery.includes("pintly log");
  const isGenericPhotoStamp = ["photo stamp", "beer log"].includes(item.beerName.trim().toLowerCase());
  const loggedCopy = "logged a beer";
  const [postDetailOpen, setPostDetailOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [photoSize, setPhotoSize] = useState<{ width: number; height: number } | undefined>();
  const lastPhotoTap = useRef(0);
  const lastPostTap = useRef(0);
  const singleTapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reactionUsers = reactionUsersForCheckIn(item, currentUserId);

  useEffect(() => {
    setImageFailed(false);
    setPhotoIndex(0);
    setPhotoSize(undefined);
  }, [item.id, item.photoCloudflareImageId, item.photoUrl, item.photoUri, item.photoThumbnailUrl]);

  useEffect(() => {
    if (!fullPhotoSource || (variant !== "photo" && !postDetailOpen)) return;
    Image.getSize(
      fullPhotoSource,
      (width, height) => setPhotoSize({ width, height }),
      () => setPhotoSize(undefined)
    );
  }, [fullPhotoSource, postDetailOpen, variant]);

  useEffect(
    () => () => {
      if (singleTapTimer.current) {
        clearTimeout(singleTapTimer.current);
        singleTapTimer.current = null;
      }
    },
    []
  );

  useEffect(() => {
    if (photoSource) void Image.prefetch(photoSource);
    if (fullPhotoSource && fullPhotoSource !== photoSource) void Image.prefetch(fullPhotoSource);
  }, [fullPhotoSource, photoSource]);

  function confirmDelete() {
    Alert.alert("Delete check-in?", "This removes the stamp from Pintly and any selected group trackers.", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => onDelete?.(item.id) }
    ]);
  }

  function handlePhotoPress() {
    if (!onReact) {
      setPostDetailOpen(true);
      return;
    }

    const now = Date.now();
    if (now - lastPhotoTap.current < 260) {
      if (singleTapTimer.current) {
        clearTimeout(singleTapTimer.current);
        singleTapTimer.current = null;
      }
      lastPhotoTap.current = 0;
      if (!reacted) onReact(item.id);
      return;
    }

    lastPhotoTap.current = now;
    singleTapTimer.current = setTimeout(() => {
      setPostDetailOpen(true);
      singleTapTimer.current = null;
      lastPhotoTap.current = 0;
    }, 260);
  }

  function handlePostPress() {
    if (!onReact) {
      setPostDetailOpen(true);
      return;
    }
    const now = Date.now();
    if (now - lastPostTap.current < 280) {
      if (singleTapTimer.current) {
        clearTimeout(singleTapTimer.current);
        singleTapTimer.current = null;
      }
      lastPostTap.current = 0;
      if (!reacted) onReact(item.id);
      return;
    }
    lastPostTap.current = now;
    singleTapTimer.current = setTimeout(() => {
      setPostDetailOpen(true);
      singleTapTimer.current = null;
      lastPostTap.current = 0;
    }, 280);
  }

  function handleImageError() {
    if (photoIndex < photoSources.length - 1) {
      setPhotoIndex((index) => index + 1);
      return;
    }
    setImageFailed(true);
  }

  return (
    <Pressable
      onPress={handlePostPress}
      style={{
        backgroundColor: theme.colors.card,
        borderRadius: theme.radius.md,
        borderWidth: 1,
        borderColor: theme.colors.cardBorder,
        padding: 12,
        marginBottom: 9,
        ...theme.shadow.card
      }}
    >
      <View style={{ flexDirection: "row", gap: 11, alignItems: "center" }}>
        <Avatar label={item.userAvatar} uri={item.userAvatarUrl} size={38} />
        <View style={{ flex: 1 }}>
          <Text style={{ color: theme.colors.textSecondary, fontSize: 12 }}>
            <Text style={{ color: theme.colors.primary, fontWeight: "900" }}>{item.userName}</Text> {loggedCopy}
          </Text>
          {!isGenericPhotoStamp ? (
            <Text style={{ color: theme.colors.textPrimary, marginTop: 2, fontWeight: "900", fontSize: 15 }}>{item.beerName}</Text>
          ) : null}
          <Text style={{ color: theme.colors.textMuted, marginTop: 2, fontSize: 12 }}>{timeAgo(item.createdAt)}</Text>
        </View>
        {variant === "compact" ? (
          <PhotoThumb photoSource={thumbnailSource} imageFailed={imageFailed} onPress={handlePhotoPress} onError={handleImageError} />
        ) : null}
        <View style={{ alignItems: "center", gap: 8 }}>
          {canDelete && onEdit ? (
            <Pressable onPress={() => setEditOpen(true)} hitSlop={8}>
              <Ionicons name="create-outline" color={theme.colors.primary} size={18} />
            </Pressable>
          ) : null}
          {canDelete ? (
            <Pressable onPress={confirmDelete} hitSlop={8}>
              <Ionicons name="trash-outline" color={theme.colors.textMuted} size={18} />
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
          onPress={handlePhotoPress}
          onError={handleImageError}
        />
      ) : null}
      {item.note ? <CaptionText text={item.note} /> : null}
      {item.userId === currentUserId && item.photoSyncStatus && item.photoSyncStatus !== "synced" ? (
        <View
          style={{
            alignSelf: "flex-start",
            marginTop: 10,
            flexDirection: "row",
            alignItems: "center",
            gap: 6,
            paddingHorizontal: 10,
            paddingVertical: 6,
            borderRadius: theme.radius.pill,
            backgroundColor: item.photoSyncStatus === "failed" ? theme.colors.dangerSoft : theme.colors.surfaceAlt,
            borderWidth: 1,
            borderColor: item.photoSyncStatus === "failed" ? theme.colors.danger : theme.colors.cardBorder
          }}
        >
          <Ionicons
            name={item.photoSyncStatus === "failed" ? "cloud-offline-outline" : "cloud-upload-outline"}
            color={item.photoSyncStatus === "failed" ? theme.colors.danger : theme.colors.primary}
            size={14}
          />
          <Text style={{ color: item.photoSyncStatus === "failed" ? theme.colors.danger : theme.colors.primary, fontWeight: "900", fontSize: 12 }}>
            {item.photoSyncStatus === "failed" && item.photoSyncError ? item.photoSyncError.slice(0, 64) : photoSyncCopy(item.photoSyncStatus)}
          </Text>
        </View>
      ) : null}
      {item.userId === currentUserId && item.remoteSyncStatus && item.remoteSyncStatus !== "synced" ? (
        <View
          style={{
            alignSelf: "flex-start",
            marginTop: 10,
            flexDirection: "row",
            alignItems: "center",
            gap: 6,
            paddingHorizontal: 10,
            paddingVertical: 6,
            borderRadius: theme.radius.pill,
            backgroundColor: item.remoteSyncStatus === "failed" ? theme.colors.dangerSoft : theme.colors.surfaceAlt,
            borderWidth: 1,
            borderColor: item.remoteSyncStatus === "failed" ? theme.colors.danger : theme.colors.cardBorder
          }}
        >
          <Ionicons
            name={item.remoteSyncStatus === "failed" ? "cloud-offline-outline" : "sync-outline"}
            color={item.remoteSyncStatus === "failed" ? theme.colors.danger : theme.colors.primary}
            size={14}
          />
          <Text style={{ color: item.remoteSyncStatus === "failed" ? theme.colors.danger : theme.colors.primary, fontWeight: "900", fontSize: 12 }}>
            {item.remoteSyncStatus === "failed" && item.remoteSyncError ? item.remoteSyncError.slice(0, 64) : remoteSyncCopy(item.remoteSyncStatus)}
          </Text>
        </View>
      ) : null}
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 12 }}>
        <View style={{ flex: 1, paddingRight: 10 }}>
          <Text style={{ color: theme.colors.textMuted, fontSize: 12 }}>{placeLabel}</Text>
          {showBrewery ? <Text style={{ color: theme.colors.textMuted, fontSize: 11, marginTop: 2 }}>{item.brewery}</Text> : null}
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
          {onAddComment && onDeleteComment ? <CommentButton count={item.comments.length} onPress={() => setCommentsOpen(true)} theme={theme} compact /> : null}
          <Pressable
            onPress={(event) => {
              event.stopPropagation();
              if (singleTapTimer.current) {
                clearTimeout(singleTapTimer.current);
                singleTapTimer.current = null;
              }
              lastPostTap.current = 0;
              lastPhotoTap.current = 0;
              onReact?.(item.id);
            }}
            accessibilityRole="button"
            accessibilityLabel={reacted ? "Unlike post" : "Like post"}
            hitSlop={10}
            style={({ pressed }) => ({
              height: 40,
              minWidth: 62,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: 5,
              borderRadius: theme.radius.pill,
              backgroundColor: theme.colors.card,
              opacity: pressed ? 0.72 : 1,
              paddingHorizontal: 12
            })}
          >
            <View style={{ height: 40, justifyContent: "center" }}>
              <Ionicons name={reacted ? "heart" : "heart-outline"} color={reacted ? theme.colors.error : theme.colors.textPrimary} size={18} />
            </View>
            <View style={{ height: 40, justifyContent: "center", minWidth: 22 }}>
              <Text style={{ color: reacted ? theme.colors.error : theme.colors.textPrimary, fontWeight: "900", fontSize: 13 }}>{item.reactions}</Text>
            </View>
          </Pressable>
        </View>
      </View>
      <PostDetailModal
        visible={postDetailOpen}
        checkIn={item}
        currentUserId={currentUserId}
        photoUri={!imageFailed ? fullPhotoSource : undefined}
        reacted={reacted}
        reactionUsers={reactionUsers}
        onReact={onReact}
        onAddComment={onAddComment}
        onDeleteComment={onDeleteComment}
        onReportComment={
          onReportComment
            ? ({ comment, reason, details }) =>
                onReportComment({
                  checkInId: item.id,
                  groupId: item.groupIds[0],
                  comment,
                  reason,
                  details
                })
            : undefined
        }
        onClose={() => setPostDetailOpen(false)}
        theme={theme}
      />
      {onAddComment && onDeleteComment ? (
        <CommentsSheet
          visible={commentsOpen}
          checkIn={item}
          currentUserId={currentUserId}
          onAddComment={onAddComment}
          onDeleteComment={onDeleteComment}
          onReportComment={
            onReportComment
              ? ({ comment, reason, details }) =>
                  onReportComment({
                    checkInId: item.id,
                    groupId: item.groupIds[0],
                    comment,
                    reason,
                    details
                  })
              : undefined
          }
          onClose={() => setCommentsOpen(false)}
          theme={theme}
        />
      ) : null}
      <EditCheckInModal
        visible={editOpen}
        item={item}
        onClose={() => setEditOpen(false)}
        onSave={(input) => {
          onEdit?.(item.id, input);
          setEditOpen(false);
        }}
      />
    </Pressable>
  );
}

function CaptionText({ text }: { text: string }) {
  return (
    <View style={{ marginTop: 13, borderRadius: theme.radius.md, backgroundColor: theme.colors.surfaceAlt, paddingHorizontal: 12, paddingVertical: 10 }}>
      <Text style={{ color: theme.colors.textPrimary, fontSize: 15, lineHeight: 22, fontWeight: "700" }}>{text}</Text>
    </View>
  );
}

function photoSyncCopy(status: NonNullable<BeerCheckIn["photoSyncStatus"]>) {
  if (status === "syncing") return "Photo syncing";
  if (status === "failed") return "Photo retry needed";
  return "Photo queued";
}

function remoteSyncCopy(status: NonNullable<BeerCheckIn["remoteSyncStatus"]>) {
  if (status === "syncing") return "Stamp syncing";
  if (status === "failed") return "Stamp retry pending";
  return "Stamp queued";
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
        backgroundColor: theme.colors.surfaceAlt,
        alignItems: "center",
        justifyContent: "center",
        borderWidth: 1,
        borderColor: theme.colors.cardBorder
      }}
    >
      <Ionicons name="beer-outline" color={theme.colors.primary} size={24} />
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
        borderColor: photoSource && !imageFailed ? theme.colors.primary : theme.colors.cardBorder,
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
          <Ionicons name="beer-outline" size={30} color={theme.colors.primary} />
          <Text style={{ color: theme.colors.textPrimary, fontWeight: "900", marginTop: 10 }}>{photoSource ? "Photo could not load" : "No photo attached"}</Text>
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
  const [note, setNote] = useState(item.note ?? "");

  useEffect(() => {
    if (!visible) return;
    setNote(item.note ?? "");
  }, [item.id, item.note, visible]);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: theme.colors.background, padding: 20 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
          <View>
            <Text style={{ color: theme.colors.primary, fontSize: 12, fontWeight: "900", letterSpacing: 2 }}>EDIT LOG</Text>
            <Text style={{ color: theme.colors.textPrimary, fontSize: 28, fontWeight: "900", fontFamily: "Georgia" }}>Beer Note</Text>
          </View>
          <Pressable onPress={onClose} style={{ padding: 8 }}>
            <Ionicons name="close" color={theme.colors.textPrimary} size={28} />
          </Pressable>
        </View>

        <View style={{ backgroundColor: theme.colors.card, borderRadius: theme.radius.lg, borderWidth: 1, borderColor: theme.colors.cardBorder, padding: 14, gap: 6 }}>
          <Text style={{ color: theme.colors.textPrimary, fontWeight: "900", fontSize: 16 }}>One photo stamp</Text>
          <Text style={{ color: theme.colors.textSecondary, lineHeight: 20 }}>Each log counts as one beer. You can still update the note on this log.</Text>
        </View>

        <View style={{ marginTop: 14 }}>
          <Text style={{ color: theme.colors.textSecondary, fontWeight: "800", marginBottom: 7 }}>Note</Text>
          <TextInput
            value={note}
            onChangeText={setNote}
            placeholder="Optional note"
            placeholderTextColor={theme.colors.textMuted}
            multiline
            style={{
              minHeight: 120,
              color: theme.colors.textPrimary,
              backgroundColor: theme.colors.card,
              borderWidth: 1,
              borderColor: theme.colors.cardBorder,
              borderRadius: theme.radius.md,
              paddingHorizontal: 14,
              paddingVertical: 12,
              textAlignVertical: "top"
            }}
          />
        </View>

        <Pressable
          onPress={() => onSave({ quantity: 1, note })}
          style={{ backgroundColor: theme.colors.primary, borderRadius: theme.radius.pill, paddingVertical: 16, alignItems: "center", marginTop: 18 }}
        >
          <Text style={{ color: theme.colors.textOnPrimary, fontWeight: "900", fontSize: 16 }}>Save Changes</Text>
        </Pressable>
      </View>
    </Modal>
  );
}
