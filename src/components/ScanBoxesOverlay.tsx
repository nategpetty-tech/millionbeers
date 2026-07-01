import { Text, View } from "react-native";
import { useAppTheme } from "@/theme";
import type { BeerScanBox } from "@/types";

type Props = {
  boxes?: BeerScanBox[];
  photoSize?: { width: number; height: number };
  previewSize: { width: number; height: number };
};

export function ScanBoxesOverlay({ boxes = [], photoSize, previewSize }: Props) {
  const theme = useAppTheme();
  if (!boxes.length || !photoSize || !previewSize.width || !previewSize.height) return null;
  const frame = containedFrame(photoSize, previewSize);

  return (
    <>
      {boxes.map((box, index) => (
        <View
          key={`${box.label}-${index}`}
          style={{
            position: "absolute",
            left: frame.left + box.x * frame.width,
            top: frame.top + box.y * frame.height,
            width: box.width * frame.width,
            height: box.height * frame.height,
            borderWidth: 2,
            borderColor: theme.colors.primary,
            borderRadius: 6,
            backgroundColor: theme.colors.scanOverlay
          }}
        >
          <View
            style={{
              position: "absolute",
              left: -2,
              top: -24,
              paddingHorizontal: 7,
              paddingVertical: 3,
              borderRadius: theme.radius.pill,
              backgroundColor: theme.colors.primary
            }}
          >
            <Text style={{ color: theme.colors.textOnPrimary, fontSize: 10, fontWeight: "900" }}>{Math.round(box.confidence * 100)}%</Text>
          </View>
        </View>
      ))}
    </>
  );
}

function containedFrame(photoSize: { width: number; height: number }, previewSize: { width: number; height: number }) {
  const imageRatio = photoSize.width / photoSize.height;
  const previewRatio = previewSize.width / previewSize.height;
  if (imageRatio > previewRatio) {
    const width = previewSize.width;
    const height = width / imageRatio;
    return {
      left: 0,
      top: (previewSize.height - height) / 2,
      width,
      height
    };
  }

  const height = previewSize.height;
  const width = height * imageRatio;
  return {
    left: (previewSize.width - width) / 2,
    top: 0,
    width,
    height
  };
}
