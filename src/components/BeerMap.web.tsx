import { Ionicons } from "@expo/vector-icons";
import { Pressable, Text, View } from "react-native";
import { useAppTheme } from "@/theme";
import type { BeerMapProps } from "./BeerMap.types";

export function BeerMap({ pins, selectedId, onSelect }: BeerMapProps) {
  const theme = useAppTheme();

  return (
    <View
      style={{
        height: 360,
        borderRadius: 28,
        backgroundColor: theme.colors.mapPreviewBackground,
        borderWidth: 1,
        borderColor: theme.colors.cardBorder,
        overflow: "hidden"
      }}
    >
      <MapGrid color={theme.colors.mapGrid} />
      <Text style={{ position: "absolute", top: 18, left: 18, color: theme.colors.primary, fontWeight: "900", letterSpacing: 1 }}>
        WEB MAP PREVIEW
      </Text>
      <Text style={{ position: "absolute", top: 38, left: 18, color: theme.colors.textSecondary, fontSize: 12 }}>
        Native Apple/Google map appears in Expo Go
      </Text>
      {pins.map((pin, index) => {
        const active = selectedId === pin.id;
        const markerColor = active ? theme.colors.accent : theme.colors.accentSoft;
        const iconColor = active ? theme.colors.textOnPrimary : theme.colors.accent;
        const markerSize = active ? 42 : 34;
        const x = 28 + ((index * 23) % 48);
        const y = 24 + ((index * 19) % 50);
        return (
          <Pressable
            key={pin.id}
            onPress={() => onSelect(pin.id)}
            style={{
              position: "absolute",
              left: `${x}%`,
              top: `${y}%`,
              transform: [{ translateX: -18 }, { translateY: -42 }],
              alignItems: "center"
            }}
          >
            <View
              style={{
                width: markerSize,
                height: markerSize,
                borderTopLeftRadius: markerSize / 2,
                borderTopRightRadius: markerSize / 2,
                borderBottomLeftRadius: markerSize / 2,
                borderBottomRightRadius: 8,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: markerColor,
                borderWidth: 2,
                borderColor: active ? theme.colors.accent : theme.colors.cardBorder,
                transform: [{ rotate: "45deg" }]
              }}
            >
              <Ionicons name="beer-outline" color={iconColor} size={active ? 22 : 18} style={{ transform: [{ rotate: "-45deg" }] }} />
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

function MapGrid({ color }: { color: string }) {
  return (
    <>
      <View style={{ position: "absolute", left: 0, right: 0, top: 92, height: 2, backgroundColor: color }} />
      <View style={{ position: "absolute", left: 0, right: 0, top: 185, height: 2, backgroundColor: color }} />
      <View style={{ position: "absolute", left: 0, right: 0, top: 292, height: 2, backgroundColor: color }} />
      <View style={{ position: "absolute", top: 0, bottom: 0, left: "32%", width: 2, backgroundColor: color }} />
      <View style={{ position: "absolute", top: 0, bottom: 0, left: "55%", width: 2, backgroundColor: color }} />
      <View style={{ position: "absolute", top: 0, bottom: 0, left: "74%", width: 2, backgroundColor: color }} />
    </>
  );
}
