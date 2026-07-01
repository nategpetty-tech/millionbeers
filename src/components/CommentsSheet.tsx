import { Ionicons } from "@expo/vector-icons";
import { useEffect, useMemo, useRef, useState } from "react";
import { Alert, Image, InputAccessoryView, Keyboard, Modal, Platform, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { TouchableOpacity as GestureTouchableOpacity } from "react-native-gesture-handler";
import type { KeyboardEvent } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Avatar } from "@/components/Avatar";
import { AppTheme } from "@/theme";
import { BeerCheckIn, BeerComment, ModerationReportReason } from "@/types";
import { timeAgo } from "@/utils/format";

type CommentsSheetProps = {
  visible: boolean;
  checkIn: BeerCheckIn;
  currentUserId: string;
  onAddComment: (checkInId: string, body: string) => void;
  onDeleteComment: (checkInId: string, commentId: string) => void;
  onReportComment?: (input: { comment: BeerComment; reason: ModerationReportReason; details: string }) => void;
  onClose: () => void;
  onUserPress?: (userId: string) => void;
  theme: AppTheme;
};

type CommentButtonProps = {
  count: number;
  onPress: () => void;
  theme: AppTheme;
  compact?: boolean;
};

const maxCommentLength = 500;
const emptyCommentsImage = require("../../assets/comments-empty-beer.png");
const reportReasons: Array<{ value: ModerationReportReason; label: string }> = [
  { value: "harassment", label: "Harassment" },
  { value: "hate", label: "Hate or abuse" },
  { value: "sexual_content", label: "Sexual content" },
  { value: "violence", label: "Violence" },
  { value: "spam", label: "Spam" },
  { value: "other", label: "Other" }
];

export function CommentButton({ count, onPress, theme, compact }: CommentButtonProps) {
  const height = compact ? 28 : 32;
  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      style={{
        height,
        minWidth: compact ? 42 : 50,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 4,
        borderRadius: theme.radius.pill,
        backgroundColor: theme.colors.card,
        paddingHorizontal: compact ? 8 : 10
      }}
    >
      <Ionicons name="chatbubble-outline" color={theme.colors.textPrimary} size={compact ? 14 : 15} />
      <Text style={{ color: theme.colors.textPrimary, fontWeight: "900", fontSize: compact ? 11 : 12 }}>{count}</Text>
    </Pressable>
  );
}

export function CommentsSheet({ visible, checkIn, currentUserId, onAddComment, onDeleteComment, onReportComment, onClose, onUserPress, theme }: CommentsSheetProps) {
  const [body, setBody] = useState("");
  const [keyboardOffset, setKeyboardOffset] = useState(0);
  const [reportTarget, setReportTarget] = useState<BeerComment | null>(null);
  const [reportReason, setReportReason] = useState<ModerationReportReason>("harassment");
  const [reportDetails, setReportDetails] = useState("");
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView | null>(null);
  const lastSubmitAtRef = useRef(0);
  const comments = useMemo(
    () => [...(checkIn.comments ?? [])].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()),
    [checkIn.comments]
  );
  const trimmedBody = body.trim();

  useEffect(() => {
    if (!visible) {
      setBody("");
      setKeyboardOffset(0);
      setReportTarget(null);
      setReportReason("harassment");
      setReportDetails("");
    }
  }, [visible]);

  useEffect(() => {
    if (!visible || Platform.OS === "ios") return;

    function syncKeyboard(event: KeyboardEvent) {
      Keyboard.scheduleLayoutAnimation(event);
      setKeyboardOffset(event.endCoordinates?.height ?? 0);
    }

    function clearKeyboard() {
      setKeyboardOffset(0);
    }

    const subscriptions = [Keyboard.addListener("keyboardDidShow", syncKeyboard), Keyboard.addListener("keyboardDidHide", clearKeyboard)];

    return () => subscriptions.forEach((subscription) => subscription.remove());
  }, [visible]);

  useEffect(() => {
    if (!visible) return;
    const timer = setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 120);
    return () => clearTimeout(timer);
  }, [comments.length, visible]);

  function submit() {
    const nextBody = body.trim().slice(0, maxCommentLength);
    if (!nextBody) return;

    const now = Date.now();
    if (now - lastSubmitAtRef.current < 250) return;
    lastSubmitAtRef.current = now;

    onAddComment(checkIn.id, nextBody);
    setBody("");
  }

  function closeSheet() {
    Keyboard.dismiss();
    onClose();
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

  const topInset = Math.max(insets.top, Platform.OS === "ios" ? 54 : 24);
  const bottomInset = Math.max(insets.bottom, 12);
  const isIos = Platform.OS === "ios";
  const composerBottomPadding = keyboardOffset > 0 ? 12 : bottomInset;
  const scrollBottomPadding = keyboardOffset > 0 || isIos ? 120 : 104;

  const composer = (
    <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 10 }}>
      <TextInput
        value={body}
        onChangeText={setBody}
        placeholder="Add a comment"
        placeholderTextColor={theme.colors.textMuted}
        multiline={!isIos}
        blurOnSubmit={false}
        submitBehavior="submit"
        returnKeyType="send"
        enablesReturnKeyAutomatically
        rejectResponderTermination={false}
        onSubmitEditing={submit}
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
          textAlignVertical: isIos ? "center" : "top"
        }}
      />
      {isIos ? null : (
        <GestureTouchableOpacity
          accessibilityRole="button"
          accessibilityState={{ disabled: !trimmedBody }}
          onPress={submit}
          disabled={!trimmedBody}
          hitSlop={12}
          activeOpacity={0.82}
          style={{
            width: 44,
            height: 44,
            borderRadius: 22,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: trimmedBody ? theme.colors.primary : theme.colors.surfaceAlt
          }}
        >
          <Ionicons name="send" color={trimmedBody ? theme.colors.textOnPrimary : theme.colors.textMuted} size={18} />
        </GestureTouchableOpacity>
      )}
    </View>
  );

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={closeSheet}>
      <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
        <View style={{ paddingTop: topInset + 10, paddingHorizontal: 18, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: theme.colors.cardBorder }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
            <View style={{ flex: 1, paddingRight: 12 }}>
              <Text style={{ color: theme.colors.primary, fontSize: 12, fontWeight: "900", letterSpacing: 2 }}>COMMENTS</Text>
              <Text numberOfLines={2} style={{ color: theme.colors.textPrimary, fontSize: 24, lineHeight: 29, fontWeight: "900", fontFamily: "Georgia", marginTop: 2 }}>
                {checkIn.userName}'s beer log
              </Text>
            </View>
            <GestureTouchableOpacity onPress={closeSheet} hitSlop={8} activeOpacity={0.75} style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center", marginTop: 2 }}>
              <Ionicons name="close" color={theme.colors.textPrimary} size={28} />
            </GestureTouchableOpacity>
          </View>
        </View>

        <ScrollView ref={scrollRef} keyboardShouldPersistTaps="always" style={{ flex: 1 }} contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 18, paddingBottom: scrollBottomPadding }}>
          {comments.length ? (
            comments.map((comment) => {
              const canDelete = comment.userId === currentUserId || checkIn.userId === currentUserId;
              const canReport = Boolean(onReportComment) && comment.userId !== currentUserId;
              return (
                <View key={comment.id} style={{ flexDirection: "row", gap: 10, paddingVertical: 11 }}>
                  <Pressable
                    disabled={!onUserPress}
                    onPress={() => onUserPress?.(comment.userId)}
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
                          <Pressable onPress={() => onDeleteComment(checkIn.id, comment.id)} hitSlop={8}>
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
            })
          ) : (
            <View style={{ alignItems: "center", paddingVertical: 42, paddingHorizontal: 18 }}>
              <Image source={emptyCommentsImage} style={{ width: 168, height: 168 }} resizeMode="contain" />
              <Text style={{ color: theme.colors.textPrimary, fontWeight: "900", fontSize: 17, marginTop: 14 }}>Start the conversation</Text>
              <Text style={{ color: theme.colors.textSecondary, textAlign: "center", lineHeight: 20, marginTop: 5 }}>
                Leave a comment on this beer log.
              </Text>
            </View>
          )}
        </ScrollView>

        <Modal visible={Boolean(reportTarget)} transparent animationType="slide" onRequestClose={() => setReportTarget(null)}>
          <Pressable onPress={() => setReportTarget(null)} style={{ flex: 1, justifyContent: "flex-end", backgroundColor: theme.colors.modalBackdrop }}>
            <Pressable
              onPress={(event) => event.stopPropagation()}
              style={{ backgroundColor: theme.colors.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 18, paddingBottom: bottomInset + 18, borderWidth: 1, borderColor: theme.colors.cardBorder }}
            >
              <Text style={{ color: theme.colors.textPrimary, fontSize: 22, fontWeight: "900" }}>Report comment</Text>
              <Text numberOfLines={2} style={{ color: theme.colors.textSecondary, lineHeight: 20, marginTop: 6 }}>{reportTarget?.body}</Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 14 }}>
                {reportReasons.map((item) => {
                  const active = reportReason === item.value;
                  return (
                    <Pressable key={item.value} onPress={() => setReportReason(item.value)} style={{ borderRadius: theme.radius.pill, paddingHorizontal: 12, paddingVertical: 9, backgroundColor: active ? theme.colors.primary : theme.colors.surfaceAlt }}>
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
              <Pressable onPress={submitReport} style={{ backgroundColor: theme.colors.primary, borderRadius: theme.radius.pill, paddingVertical: 14, alignItems: "center", marginTop: 14 }}>
                <Text style={{ color: theme.colors.textOnPrimary, fontWeight: "900" }}>Submit Report</Text>
              </Pressable>
              <Pressable onPress={() => setReportTarget(null)} hitSlop={8} style={{ alignItems: "center", paddingVertical: 12, marginTop: 2 }}>
                <Text style={{ color: theme.colors.textSecondary, fontWeight: "900" }}>Cancel</Text>
              </Pressable>
            </Pressable>
          </Pressable>
        </Modal>

        {isIos ? (
          <InputAccessoryView backgroundColor={theme.colors.background}>
            <View
              style={{
                borderTopWidth: 1,
                borderTopColor: theme.colors.cardBorder,
                backgroundColor: theme.colors.background,
                paddingHorizontal: 14,
                paddingTop: 12,
                paddingBottom: bottomInset
              }}
            >
              {composer}
            </View>
          </InputAccessoryView>
        ) : (
          <View
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              bottom: keyboardOffset,
              borderTopWidth: 1,
              borderTopColor: theme.colors.cardBorder,
              paddingTop: 12,
              paddingHorizontal: 14,
              paddingBottom: composerBottomPadding,
              backgroundColor: theme.colors.background
            }}
          >
            {composer}
          </View>
        )}
      </View>
    </Modal>
  );
}
