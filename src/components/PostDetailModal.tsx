import { Ionicons } from "@expo/vector-icons";
import { useEffect, useMemo, useRef, useState } from "react";
import { Alert, Image, Keyboard, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Avatar } from "@/components/Avatar";
import { ZoomablePhotoModal } from "@/components/ZoomablePhotoModal";
import { AppTheme } from "@/theme";
import { BeerCheckIn, BeerComment, ModerationReportReason, ReactionUser } from "@/types";
import { broadPlaceLabel, timeAgo } from "@/utils/format";

type Props = {
  visible: boolean;
  checkIn: BeerCheckIn;
  currentUserId: string;
  photoUri?: string;
  reacted: boolean;
  reactionUsers: ReactionUser[];
  onReact?: (checkInId: string) => void;
  onAddComment?: (checkInId: string, body: string) => void;
  onDeleteComment?: (checkInId: string, commentId: string) => void;
  onReportComment?: (input: { comment: BeerComment; reason: ModerationReportReason; details: string }) => void;
  onUserPress?: (userId: string) => void;
  onClose: () => void;
  theme: AppTheme;
};

const maxCommentLength = 500;
const reportReasons: Array<{ value: ModerationReportReason; label: string }> = [
  { value: "harassment", label: "Harassment" },
  { value: "hate", label: "Hate or abuse" },
  { value: "sexual_content", label: "Sexual content" },
  { value: "violence", label: "Violence" },
  { value: "spam", label: "Spam" },
  { value: "other", label: "Other" }
];

export function PostDetailModal({
  visible,
  checkIn,
  currentUserId,
  photoUri,
  reacted,
  reactionUsers,
  onReact,
  onAddComment,
  onDeleteComment,
  onReportComment,
  onUserPress,
  onClose,
  theme
}: Props) {
  const [body, setBody] = useState("");
  const [reportTarget, setReportTarget] = useState<BeerComment | null>(null);
  const [reportReason, setReportReason] = useState<ModerationReportReason>("harassment");
  const [reportDetails, setReportDetails] = useState("");
  const [photoViewerOpen, setPhotoViewerOpen] = useState(false);
  const scrollRef = useRef<ScrollView | null>(null);
  const lastSubmitAtRef = useRef(0);
  const insets = useSafeAreaInsets();
  const comments = useMemo(
    () => [...(checkIn.comments ?? [])].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()),
    [checkIn.comments]
  );
  const trimmedBody = body.trim();
  const placeLabel = broadPlaceLabel(checkIn.location);
  const topPadding = Math.max(insets.top, Platform.OS === "ios" ? 54 : 24);
  const bottomPadding = Math.max(insets.bottom, 12);
  const composerHeight = 68 + bottomPadding;

  useEffect(() => {
    if (!visible) {
      setBody("");
      setReportTarget(null);
      setReportReason("harassment");
      setReportDetails("");
      setPhotoViewerOpen(false);
      return;
    }
    const timer = setTimeout(() => scrollRef.current?.scrollTo({ y: 0, animated: false }), 40);
    return () => clearTimeout(timer);
  }, [visible, checkIn.id]);

  function submitComment() {
    const nextBody = body.trim().slice(0, maxCommentLength);
    if (!nextBody || !onAddComment) return;

    const now = Date.now();
    if (now - lastSubmitAtRef.current < 250) return;
    lastSubmitAtRef.current = now;

    onAddComment(checkIn.id, nextBody);
    setBody("");
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 80);
  }

  function closeAndVisitUser(userId: string) {
    onClose();
    onUserPress?.(userId);
  }

  function submitReport() {
    if (!reportTarget || !onReportComment) return;
    const commentPreview = reportTarget.body.trim().slice(0, 350);
    const extraDetails = reportDetails.trim();
    onReportComment({
      comment: reportTarget,
      reason: reportReason,
      details: [`Reported comment: "${commentPreview}"`, extraDetails ? `Reporter details: ${extraDetails}` : null].filter(Boolean).join("\n")
    });
    setReportTarget(null);
    setReportDetails("");
    setReportReason("harassment");
    Alert.alert("Report sent", "Thanks. Pintly will review this comment.");
  }

  const composerEnabled = Boolean(onAddComment && onDeleteComment);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <View style={{ paddingHorizontal: 18, paddingTop: topPadding + 8, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: theme.colors.cardBorder }}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10, flex: 1 }}>
                <Pressable
                  disabled={!onUserPress}
                  onPress={() => closeAndVisitUser(checkIn.userId)}
                  hitSlop={2}
                  style={({ pressed }) => ({ opacity: pressed ? 0.75 : 1 })}
                >
                  <Avatar label={checkIn.userAvatar} uri={checkIn.userAvatarUrl} size={42} />
                </Pressable>
                <View style={{ flex: 1 }}>
                  <Pressable
                    disabled={!onUserPress}
                    onPress={() => closeAndVisitUser(checkIn.userId)}
                    hitSlop={2}
                    style={({ pressed }) => ({ alignSelf: "flex-start", maxWidth: "100%", opacity: pressed ? 0.75 : 1 })}
                  >
                    <Text numberOfLines={1} style={{ color: theme.colors.textPrimary, fontWeight: "900", fontSize: 17 }}>{checkIn.userName}</Text>
                  </Pressable>
                  <Text numberOfLines={1} style={{ color: theme.colors.textSecondary, marginTop: 2 }}>{timeAgo(checkIn.createdAt)} - {placeLabel}</Text>
                </View>
              </View>
              <Pressable onPress={onClose} hitSlop={8} style={{ width: 42, height: 42, alignItems: "center", justifyContent: "center" }}>
                <Ionicons name="close" color={theme.colors.textPrimary} size={28} />
              </Pressable>
            </View>
          </View>

          <ScrollView ref={scrollRef} keyboardShouldPersistTaps="handled" style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 18, paddingTop: 14, paddingBottom: composerEnabled ? composerHeight + 28 : bottomPadding + 20 }}>
            <View style={{ gap: 14 }}>
              {photoUri ? (
                <View style={{ borderRadius: theme.radius.lg, overflow: "hidden", borderWidth: 1, borderColor: theme.colors.cardBorder, backgroundColor: theme.colors.mediaBackdrop }}>
                  <Pressable onPress={() => setPhotoViewerOpen(true)} style={({ pressed }) => ({ opacity: pressed ? 0.9 : 1 })}>
                    <Image source={{ uri: photoUri }} style={{ width: "100%", aspectRatio: 4 / 3 }} resizeMode="contain" />
                    <View
                      pointerEvents="none"
                      style={{
                        position: "absolute",
                        right: 10,
                        bottom: 10,
                        width: 34,
                        height: 34,
                        borderRadius: 17,
                        alignItems: "center",
                        justifyContent: "center",
                        backgroundColor: theme.colors.mediaBackdropSoft
                      }}
                    >
                      <Ionicons name="expand-outline" color={theme.colors.overlayText} size={18} />
                    </View>
                  </Pressable>
                </View>
              ) : (
                <View style={{ minHeight: 190, borderRadius: theme.radius.lg, borderWidth: 1, borderColor: theme.colors.cardBorder, backgroundColor: theme.colors.surfaceAlt, alignItems: "center", justifyContent: "center", gap: 8 }}>
                  <Ionicons name="beer-outline" color={theme.colors.accent} size={30} />
                  <Text style={{ color: theme.colors.textSecondary, fontWeight: "900" }}>No photo attached</Text>
                </View>
              )}

              {checkIn.note ? (
                <View style={{ borderRadius: theme.radius.md, backgroundColor: theme.colors.surfaceAlt, paddingHorizontal: 12, paddingVertical: 10 }}>
                  <Text style={{ color: theme.colors.textPrimary, lineHeight: 21, fontWeight: "700" }}>{checkIn.note}</Text>
                </View>
              ) : null}

              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Pressable
                  onPress={() => onReact?.(checkIn.id)}
                  disabled={!onReact}
                  style={{
                    height: 42,
                    minWidth: 88,
                    borderRadius: theme.radius.pill,
                    backgroundColor: reacted ? theme.colors.dangerSoft : theme.colors.surfaceAlt,
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 7,
                    paddingHorizontal: 14
                  }}
                >
                  <Ionicons name={reacted ? "heart" : "heart-outline"} color={reacted ? theme.colors.danger : theme.colors.textPrimary} size={20} />
                  <Text style={{ color: reacted ? theme.colors.danger : theme.colors.textPrimary, fontWeight: "900" }}>{checkIn.reactions}</Text>
                </Pressable>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: theme.colors.textPrimary, fontWeight: "900" }}>Liked by</Text>
                  <Text numberOfLines={1} style={{ color: theme.colors.textSecondary, marginTop: 2 }}>{likedByCopy(reactionUsers)}</Text>
                </View>
              </View>

              {reactionUsers.length ? (
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                  {reactionUsers.slice(0, 8).map((reactionUser) => (
                    <Pressable
                      key={reactionUser.id}
                      disabled={!onUserPress}
                      onPress={() => closeAndVisitUser(reactionUser.id)}
                      style={({ pressed }) => ({
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 7,
                        borderRadius: theme.radius.pill,
                        backgroundColor: theme.colors.surfaceAlt,
                        paddingVertical: 7,
                        paddingHorizontal: 9,
                        opacity: pressed ? 0.74 : 1
                      })}
                    >
                      <Avatar label={reactionUser.avatar} uri={reactionUser.avatarUrl} size={24} />
                      <Text numberOfLines={1} style={{ color: theme.colors.textPrimary, fontWeight: "900", maxWidth: 118 }}>{reactionUser.name}</Text>
                    </Pressable>
                  ))}
                </View>
              ) : null}

              <View style={{ borderTopWidth: 1, borderTopColor: theme.colors.cardBorder, paddingTop: 14 }}>
                <Text style={{ color: theme.colors.textPrimary, fontWeight: "900", fontSize: 18 }}>Comments</Text>
                {comments.length ? (
                  <View style={{ marginTop: 8 }}>
                    {comments.map((comment) => {
                      const canDelete = Boolean(onDeleteComment) && (comment.userId === currentUserId || checkIn.userId === currentUserId);
                      const canReport = Boolean(onReportComment) && comment.userId !== currentUserId;
                      return (
                        <View key={comment.id} style={{ flexDirection: "row", gap: 10, paddingVertical: 11 }}>
                          <Pressable
                            disabled={!onUserPress}
                            onPress={() => closeAndVisitUser(comment.userId)}
                            hitSlop={6}
                            style={({ pressed }) => ({ opacity: pressed ? 0.75 : 1 })}
                          >
                            <Avatar label={comment.userAvatar} uri={comment.userAvatarUrl} size={34} />
                          </Pressable>
                          <View style={{ flex: 1 }}>
                            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                              <Text style={{ color: theme.colors.textPrimary, fontWeight: "900" }}>{comment.userName}</Text>
                              <Text style={{ color: theme.colors.textMuted, fontSize: 11, fontWeight: "800" }}>{timeAgo(comment.createdAt)}</Text>
                            </View>
                            <Text style={{ color: theme.colors.textSecondary, lineHeight: 20, marginTop: 4 }}>{comment.body}</Text>
                            {canDelete || canReport ? (
                              <View style={{ flexDirection: "row", gap: 14, marginTop: 6 }}>
                                {canDelete ? (
                                  <Pressable onPress={() => onDeleteComment?.(checkIn.id, comment.id)} hitSlop={8}>
                                    <Text style={{ color: theme.colors.textMuted, fontSize: 12, fontWeight: "900" }}>Delete</Text>
                                  </Pressable>
                                ) : null}
                                {canReport ? (
                                  <Pressable onPress={() => setReportTarget(comment)} hitSlop={8}>
                                    <Text style={{ color: theme.colors.textMuted, fontSize: 12, fontWeight: "900" }}>Report</Text>
                                  </Pressable>
                                ) : null}
                              </View>
                            ) : null}
                          </View>
                        </View>
                      );
                    })}
                  </View>
                ) : (
                  <View style={{ alignItems: "center", paddingVertical: 26 }}>
                    <Ionicons name="chatbubble-outline" color={theme.colors.textMuted} size={28} />
                    <Text style={{ color: theme.colors.textPrimary, fontWeight: "900", marginTop: 9 }}>No comments yet</Text>
                    <Text style={{ color: theme.colors.textSecondary, marginTop: 4 }}>Start the conversation on this post.</Text>
                  </View>
                )}
              </View>
            </View>
          </ScrollView>

          {composerEnabled ? (
            <View style={{ borderTopWidth: 1, borderTopColor: theme.colors.cardBorder, backgroundColor: theme.colors.background, paddingHorizontal: 14, paddingTop: 10, paddingBottom: bottomPadding }}>
              <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 10 }}>
                <TextInput
                  value={body}
                  onChangeText={setBody}
                  placeholder="Add a comment"
                  placeholderTextColor={theme.colors.textMuted}
                  multiline
                  blurOnSubmit={false}
                  returnKeyType="send"
                  onSubmitEditing={Platform.OS === "ios" ? undefined : submitComment}
                  maxLength={maxCommentLength}
                  style={{
                    flex: 1,
                    minHeight: 44,
                    maxHeight: 110,
                    color: theme.colors.textPrimary,
                    backgroundColor: theme.colors.card,
                    borderWidth: 1,
                    borderColor: theme.colors.cardBorder,
                    borderRadius: theme.radius.md,
                    paddingHorizontal: 12,
                    paddingVertical: 10,
                    textAlignVertical: "top"
                  }}
                />
                <Pressable
                  onPress={() => {
                    submitComment();
                    Keyboard.dismiss();
                  }}
                  disabled={!trimmedBody}
                  hitSlop={12}
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 22,
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: trimmedBody ? theme.colors.accent : theme.colors.surfaceAlt
                  }}
                >
                  <Ionicons name="send" color={trimmedBody ? theme.colors.textOnPrimary : theme.colors.textMuted} size={18} />
                </Pressable>
              </View>
            </View>
          ) : null}

          <Modal visible={Boolean(reportTarget)} transparent animationType="slide" onRequestClose={() => setReportTarget(null)}>
            <Pressable onPress={() => setReportTarget(null)} style={{ flex: 1, justifyContent: "flex-end", backgroundColor: theme.colors.modalBackdrop }}>
              <Pressable
                onPress={(event) => event.stopPropagation()}
                style={{ backgroundColor: theme.colors.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 18, paddingBottom: bottomPadding + 18, borderWidth: 1, borderColor: theme.colors.cardBorder }}
              >
                <Text style={{ color: theme.colors.textPrimary, fontSize: 22, fontWeight: "900" }}>Report comment</Text>
                <Text numberOfLines={2} style={{ color: theme.colors.textSecondary, lineHeight: 20, marginTop: 6 }}>{reportTarget?.body}</Text>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 14 }}>
                  {reportReasons.map((item) => {
                    const active = reportReason === item.value;
                    return (
                      <Pressable key={item.value} onPress={() => setReportReason(item.value)} style={{ borderRadius: theme.radius.pill, paddingHorizontal: 12, paddingVertical: 9, backgroundColor: active ? theme.colors.accent : theme.colors.surfaceAlt }}>
                        <Text style={{ color: active ? theme.colors.textOnPrimary : theme.colors.textSecondary, fontWeight: "900", fontSize: 12 }}>{item.label}</Text>
                      </Pressable>
                    );
                  })}
                </View>
                <TextInput
                  value={reportDetails}
                  onChangeText={setReportDetails}
                  placeholder="Add details for the moderator"
                  placeholderTextColor={theme.colors.textMuted}
                  multiline
                  style={{ minHeight: 90, color: theme.colors.textPrimary, backgroundColor: theme.colors.surfaceAlt, borderRadius: theme.radius.md, padding: 12, marginTop: 14, textAlignVertical: "top" }}
                />
                <Pressable onPress={submitReport} style={{ backgroundColor: theme.colors.accent, borderRadius: theme.radius.pill, paddingVertical: 14, alignItems: "center", marginTop: 14 }}>
                  <Text style={{ color: theme.colors.textOnPrimary, fontWeight: "900" }}>Submit Report</Text>
                </Pressable>
                <Pressable onPress={() => setReportTarget(null)} hitSlop={8} style={{ alignItems: "center", paddingVertical: 12, marginTop: 2 }}>
                  <Text style={{ color: theme.colors.textSecondary, fontWeight: "900" }}>Cancel</Text>
                </Pressable>
              </Pressable>
            </Pressable>
          </Modal>
        </KeyboardAvoidingView>
        <ZoomablePhotoModal
          visible={photoViewerOpen && Boolean(photoUri)}
          uri={photoUri}
          onClose={() => setPhotoViewerOpen(false)}
          theme={theme}
        />
      </View>
    </Modal>
  );
}

function likedByCopy(reactionUsers: ReactionUser[]) {
  if (!reactionUsers.length) return "No likes yet";
  if (reactionUsers.length === 1) return reactionUsers[0].name;
  if (reactionUsers.length === 2) return `${reactionUsers[0].name} and ${reactionUsers[1].name}`;
  return `${reactionUsers[0].name}, ${reactionUsers[1].name}, and ${reactionUsers.length - 2} more`;
}
