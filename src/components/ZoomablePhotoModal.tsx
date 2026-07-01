import { Ionicons } from "@expo/vector-icons";
import { useEffect, useMemo, useRef, useState } from "react";
import { Animated, Dimensions, Image, Modal, PanResponder, Pressable, ScrollView, Text, View } from "react-native";
import { AppTheme } from "@/theme";

type Props = {
  visible: boolean;
  uri?: string | null;
  onClose: () => void;
  theme: AppTheme;
  footerText?: string;
};

export function ZoomablePhotoModal({ visible, uri, onClose, theme, footerText = "Pinch to zoom" }: Props) {
  const [imageSize, setImageSize] = useState<{ width: number; height: number } | null>(null);
  const translateY = useRef(new Animated.Value(0)).current;
  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gesture) => Math.abs(gesture.dy) > 8 && Math.abs(gesture.dy) > Math.abs(gesture.dx) * 0.8,
      onMoveShouldSetPanResponderCapture: (_, gesture) => Math.abs(gesture.dy) > 8 && Math.abs(gesture.dy) > Math.abs(gesture.dx) * 0.8,
      onPanResponderGrant: () => {
        translateY.stopAnimation();
      },
      onPanResponderMove: (_, gesture) => {
        translateY.setValue(gesture.dy);
      },
      onPanResponderRelease: (_, gesture) => {
        if (Math.abs(gesture.dy) > 52 || Math.abs(gesture.vy) > 0.55) {
          Animated.timing(translateY, {
            toValue: gesture.dy > 0 ? Dimensions.get("window").height : -Dimensions.get("window").height,
            duration: 150,
            useNativeDriver: true
          }).start(() => {
            translateY.setValue(0);
            onClose();
          });
          return;
        }
        Animated.spring(translateY, {
          toValue: 0,
          useNativeDriver: true,
          bounciness: 4
        }).start();
      },
      onPanResponderTerminate: () => {
        Animated.spring(translateY, {
          toValue: 0,
          useNativeDriver: true,
          bounciness: 4
        }).start();
      },
      onShouldBlockNativeResponder: () => true
    })
  ).current;

  useEffect(() => {
    if (visible) translateY.setValue(0);
  }, [translateY, visible]);

  useEffect(() => {
    if (!uri) {
      setImageSize(null);
      return;
    }
    Image.getSize(
      uri,
      (width, height) => setImageSize({ width, height }),
      () => setImageSize(null)
    );
  }, [uri]);

  const window = Dimensions.get("window");
  const maxPhotoWidth = window.width - 32;
  const maxPhotoHeight = window.height * 0.78;
  const photoFrame = useMemo(() => {
    if (!imageSize?.width || !imageSize.height) {
      return { width: maxPhotoWidth, height: maxPhotoHeight };
    }
    const scale = Math.min(maxPhotoWidth / imageSize.width, maxPhotoHeight / imageSize.height);
    return {
      width: imageSize.width * scale,
      height: imageSize.height * scale
    };
  }, [imageSize, maxPhotoHeight, maxPhotoWidth]);
  if (!uri) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: theme.colors.mediaBackdrop }}>
        <Pressable onPress={onClose} style={{ position: "absolute", top: 54, right: 22, zIndex: 2, padding: 8 }}>
          <Ionicons name="close-circle" color={theme.colors.overlayText} size={34} />
        </Pressable>
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ minHeight: "100%", alignItems: "center", justifyContent: "center", padding: 16 }}
          centerContent
          maximumZoomScale={4}
          minimumZoomScale={1}
          showsHorizontalScrollIndicator={false}
          showsVerticalScrollIndicator={false}
          bouncesZoom
        >
          <Pressable onPress={onClose} style={{ position: "absolute", inset: 0 }} />
          <Animated.View
            {...panResponder.panHandlers}
            style={{
              transform: [{ translateY }],
              opacity: translateY.interpolate({
                inputRange: [-220, 0, 220],
                outputRange: [0.35, 1, 0.35],
                extrapolate: "clamp"
              })
            }}
          >
            <Image source={{ uri }} style={{ width: photoFrame.width, height: photoFrame.height, borderRadius: theme.radius.lg }} resizeMode="contain" />
          </Animated.View>
        </ScrollView>
        {footerText ? (
          <Text pointerEvents="none" style={{ position: "absolute", bottom: 34, alignSelf: "center", color: theme.colors.overlayText, fontWeight: "900" }}>
            {footerText}
          </Text>
        ) : null}
      </View>
    </Modal>
  );
}
