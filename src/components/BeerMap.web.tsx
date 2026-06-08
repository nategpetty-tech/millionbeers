import { Ionicons } from "@expo/vector-icons";
import { Pressable, Text, View } from "react-native";
import { theme } from "@/theme";
import type { BeerMapPin } from "./BeerMap.types";

type Props = {
  pins: BeerMapPin[];
  selectedId?: string;
  onSelect: (id: string) => void;
};

export function BeerMap({ pins, selectedId, onSelect }: Props) {
  return (
    <View
      style={{
        height: 360,
        borderRadius: 28,
        backgroundColor: "#111713",
        borderWidth: 1,
        borderColor: theme.colors.border,
        overflow: "hidden"
      }}
    >
      <MapGrid />
      <Text style={{ position: "absolute", top: 18, left: 18, color: theme.colors.gold, fontWeight: "900", letterSpacing: 1 }}>
        WEB MAP PREVIEW
      </Text>
      <Text style={{ position: "absolute", top: 38, left: 18, color: theme.colors.muted, fontSize: 12 }}>
        Native Apple/Google map appears in Expo Go
      </Text>
      {pins.map((pin, index) => {
        const active = selectedId === pin.id;
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
              transform: [{ translateX: -18 }, { translateY: -18 }],
              alignItems: "center"
            }}
          >
            <View
              style={{
                width: active ? 44 : 34,
                height: active ? 44 : 34,
                borderRadius: active ? 22 : 17,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: active ? theme.colors.neon : theme.colors.neonSoft,
                borderWidth: 2,
                borderColor: active ? theme.colors.text : theme.colors.neon
              }}
            >
              <Ionicons name="beer-outline" color={active ? theme.colors.ink : theme.colors.neon} size={active ? 22 : 18} />
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

function MapGrid() {
  return (
    <>
      <View style={{ position: "absolute", left: 0, right: 0, top: 92, height: 2, backgroundColor: "#253126" }} />
      <View style={{ position: "absolute", left: 0, right: 0, top: 185, height: 2, backgroundColor: "#253126" }} />
      <View style={{ position: "absolute", left: 0, right: 0, top: 292, height: 2, backgroundColor: "#253126" }} />
      <View style={{ position: "absolute", top: 0, bottom: 0, left: "32%", width: 2, backgroundColor: "#253126" }} />
      <View style={{ position: "absolute", top: 0, bottom: 0, left: "55%", width: 2, backgroundColor: "#253126" }} />
      <View style={{ position: "absolute", top: 0, bottom: 0, left: "74%", width: 2, backgroundColor: "#253126" }} />
    </>
  );
}
