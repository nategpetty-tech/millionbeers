import { useEffect, useState } from "react";
import { ActivityIndicator, Image, Text, View } from "react-native";
import { theme } from "@/theme";

type Props = {
  label: string;
  uri?: string;
  size?: number;
  borderColor?: string;
};

export function Avatar({ label, uri, size = 40, borderColor = theme.colors.cardBorder }: Props) {
  const [loadedUri, setLoadedUri] = useState<string | undefined>();
  const [failedUri, setFailedUri] = useState<string | undefined>();
  const failed = Boolean(uri && failedUri === uri);
  const loading = Boolean(uri && loadedUri !== uri && !failed);

  useEffect(() => {
    setLoadedUri(undefined);
    setFailedUri(undefined);
  }, [uri]);

  return (
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
}
