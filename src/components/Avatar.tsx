import { useEffect, useState } from "react";
import { ActivityIndicator, Image, Text, View } from "react-native";
import { theme } from "@/theme";
import { profileBorderForBeerCount, profileBorderFrameSize } from "@/utils/profileBorders";

type Props = {
  label: string;
  uri?: string;
  size?: number;
  borderColor?: string;
  beerCount?: number;
};

export function Avatar({ label, uri, size = 40, borderColor = theme.colors.cardBorder, beerCount }: Props) {
  const [loadedUri, setLoadedUri] = useState<string | undefined>();
  const [failedUri, setFailedUri] = useState<string | undefined>();
  const failed = Boolean(uri && failedUri === uri);
  const loading = Boolean(uri && loadedUri !== uri && !failed);
  const profileBorder = profileBorderForBeerCount(beerCount);
  const frameSize = profileBorderFrameSize(size);
  const avatar = (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        overflow: "hidden",
        backgroundColor: theme.colors.surfaceAlt,
        alignItems: "center",
        justifyContent: "center",
        borderWidth: 1,
        borderColor
      }}
    >
      {uri && !failed ? (
        <>
          <Image
            source={{ uri }}
            style={{ width: "100%", height: "100%", opacity: loading ? 0 : 1 }}
            resizeMode="cover"
            onLoadEnd={() => setLoadedUri(uri)}
            onError={() => setFailedUri(uri)}
          />
          {loading ? (
            <View style={{ position: "absolute", inset: 0, alignItems: "center", justifyContent: "center" }}>
              <ActivityIndicator color={theme.colors.primary} size={size >= 64 ? "large" : "small"} />
            </View>
          ) : null}
        </>
      ) : null}
      {!uri || loading || failed ? (
        <Text style={{ position: loading ? "absolute" : "relative", color: theme.colors.primary, fontWeight: "900", fontSize: Math.max(12, Math.round(size * 0.38)) }}>
          {label}
        </Text>
      ) : null}
    </View>
  );

  useEffect(() => {
    setLoadedUri(undefined);
    setFailedUri(undefined);
  }, [uri]);

  if (profileBorder) {
    return (
      <View style={{ width: frameSize, height: frameSize, alignItems: "center", justifyContent: "center" }}>
        <View style={{ position: "absolute", alignItems: "center", justifyContent: "center" }}>{avatar}</View>
        <View pointerEvents="none" style={{ position: "absolute", width: frameSize, height: frameSize }}>
          <Image source={profileBorder.source} style={{ width: frameSize, height: frameSize }} resizeMode="contain" />
        </View>
      </View>
    );
  }

  return avatar;
}
