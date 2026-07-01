import { Ionicons } from "@expo/vector-icons";
import MapView, { Marker, Region } from "react-native-maps";
import { Text, View } from "react-native";
import { useAppTheme } from "@/theme";
import type { BeerMapPin } from "./BeerMap.types";

type Props = {
  pins: BeerMapPin[];
  selectedId?: string;
  onSelect: (id: string) => void;
};

export function BeerMap({ pins, selectedId, onSelect }: Props) {
  const appTheme = useAppTheme();
  const gpsPins = pins.filter((pin) => typeof pin.latitude === "number" && typeof pin.longitude === "number");

  if (!gpsPins.length) {
    return <NoGpsMap />;
  }

  const region = getRegion(gpsPins);

  return (
    <MapView
      style={{ height: 360, borderRadius: 28, overflow: "hidden" }}
      initialRegion={region}
      showsUserLocation
      showsCompass
      showsScale
      customMapStyle={appTheme.mode === "dark" ? darkMapStyle : []}
    >
      {gpsPins.map((pin) => {
        const active = selectedId === pin.id;
        const markerColor = active ? appTheme.colors.accent : appTheme.colors.accentSoft;
        const iconColor = active ? appTheme.colors.textOnPrimary : appTheme.colors.accent;
        const markerSize = active ? 44 : 36;
        return (
          <Marker
            key={pin.id}
            coordinate={{ latitude: pin.latitude as number, longitude: pin.longitude as number }}
            title={pin.title}
            description={pin.subtitle}
            onPress={() => onSelect(pin.id)}
            anchor={{ x: 0.5, y: 1 }}
          >
            <View style={{ alignItems: "center" }}>
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
                  borderColor: active ? appTheme.colors.accent : appTheme.colors.cardBorder,
                  transform: [{ rotate: "45deg" }]
                }}
              >
                <Ionicons name="beer-outline" color={iconColor} size={active ? 23 : 19} style={{ transform: [{ rotate: "-45deg" }] }} />
              </View>
            </View>
          </Marker>
        );
      })}
    </MapView>
  );
}

const darkMapStyle = [
  { elementType: "geometry", stylers: [{ color: "#111827" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#CBD5E1" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#070A0F" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#263241" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#0B0F17" }] },
  { featureType: "poi", elementType: "geometry", stylers: [{ color: "#161D27" }] }
];

function getRegion(pins: BeerMapPin[]): Region {
  const latitudes = pins.map((pin) => pin.latitude as number);
  const longitudes = pins.map((pin) => pin.longitude as number);
  const minLat = Math.min(...latitudes);
  const maxLat = Math.max(...latitudes);
  const minLon = Math.min(...longitudes);
  const maxLon = Math.max(...longitudes);
  const latitude = (minLat + maxLat) / 2;
  const longitude = (minLon + maxLon) / 2;
  return {
    latitude,
    longitude,
    latitudeDelta: Math.max(0.02, Math.abs(maxLat - minLat) * 1.8 || 0.04),
    longitudeDelta: Math.max(0.02, Math.abs(maxLon - minLon) * 1.8 || 0.04)
  };
}

function NoGpsMap() {
  const appTheme = useAppTheme();
  return (
    <View
      style={{
        height: 360,
        borderRadius: 28,
        backgroundColor: appTheme.colors.card,
        borderWidth: 1,
        borderColor: appTheme.colors.cardBorder,
        alignItems: "center",
        justifyContent: "center",
        padding: 24
      }}
    >
      <Ionicons name="map-outline" color={appTheme.colors.accent} size={38} />
      <Text style={{ color: appTheme.colors.textPrimary, fontWeight: "900", marginTop: 12, fontSize: 18 }}>No GPS stamps yet</Text>
      <Text style={{ color: appTheme.colors.textSecondary, textAlign: "center", lineHeight: 20, marginTop: 6 }}>
        Allow location on your next check-in to place a beer marker on the map.
      </Text>
    </View>
  );
}
