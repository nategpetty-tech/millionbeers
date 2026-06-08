import { Ionicons } from "@expo/vector-icons";
import MapView, { Marker, Region } from "react-native-maps";
import { Text, View } from "react-native";
import { theme } from "@/theme";
import type { BeerMapPin } from "./BeerMap.types";

type Props = {
  pins: BeerMapPin[];
  selectedId?: string;
  onSelect: (id: string) => void;
};

export function BeerMap({ pins, selectedId, onSelect }: Props) {
  const gpsPins = pins.filter((pin) => typeof pin.latitude === "number" && typeof pin.longitude === "number");
  const region = getRegion(gpsPins);

  if (!gpsPins.length) {
    return <NoGpsMap />;
  }

  return (
    <MapView
      style={{ height: 360, borderRadius: 28, overflow: "hidden" }}
      initialRegion={region}
      showsUserLocation
      showsCompass
      showsScale
    >
      {gpsPins.map((pin) => {
        const active = selectedId === pin.id;
        return (
          <Marker
            key={pin.id}
            coordinate={{ latitude: pin.latitude as number, longitude: pin.longitude as number }}
            title={pin.title}
            description={pin.subtitle}
            onPress={() => onSelect(pin.id)}
          >
            <View
              style={{
                width: active ? 46 : 38,
                height: active ? 46 : 38,
                borderRadius: active ? 23 : 19,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: active ? theme.colors.neon : theme.colors.gold,
                borderWidth: 2,
                borderColor: theme.colors.text
              }}
            >
              <Ionicons name="beer-outline" color={theme.colors.ink} size={active ? 24 : 20} />
            </View>
          </Marker>
        );
      })}
    </MapView>
  );
}

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
  return (
    <View
      style={{
        height: 360,
        borderRadius: 28,
        backgroundColor: theme.colors.card,
        borderWidth: 1,
        borderColor: theme.colors.border,
        alignItems: "center",
        justifyContent: "center",
        padding: 24
      }}
    >
      <Ionicons name="map-outline" color={theme.colors.gold} size={38} />
      <Text style={{ color: theme.colors.text, fontWeight: "900", marginTop: 12, fontSize: 18 }}>No GPS stamps yet</Text>
      <Text style={{ color: theme.colors.muted, textAlign: "center", lineHeight: 20, marginTop: 6 }}>
        Allow location on your next check-in to place a beer marker on the map.
      </Text>
    </View>
  );
}
