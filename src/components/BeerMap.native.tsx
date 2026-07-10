import { Ionicons } from "@expo/vector-icons";
import * as Location from "expo-location";
import { useEffect, useMemo, useRef, useState } from "react";
import MapView, { Marker, Region } from "react-native-maps";
import { Text, View } from "react-native";
import { useAppTheme } from "@/theme";
import type { BeerMapPin, BeerMapProps } from "./BeerMap.types";

const mapRadiusMiles = 2.5;

export function BeerMap({ pins, selectedId, onSelect, focusKey = 0 }: BeerMapProps) {
  const appTheme = useAppTheme();
  const mapRef = useRef<MapView | null>(null);
  const gpsPins = useMemo(() => pins.filter((pin) => typeof pin.latitude === "number" && typeof pin.longitude === "number"), [pins]);
  const fallbackRegion = useMemo(() => getInitialRegion(gpsPins), [gpsPins]);
  const [region, setRegion] = useState<Region | null>(fallbackRegion);

  useEffect(() => {
    setRegion(fallbackRegion);
  }, [fallbackRegion]);

  useEffect(() => {
    let cancelled = false;

    async function centerOnCurrentLocation() {
      const currentRegion = await getCurrentLocationRegion();
      if (cancelled || !currentRegion) return;
      setRegion(currentRegion);
      mapRef.current?.animateToRegion(currentRegion, 450);
    }

    void centerOnCurrentLocation();

    return () => {
      cancelled = true;
    };
  }, [focusKey]);

  if (!gpsPins.length) {
    return <NoGpsMap />;
  }

  return (
    <MapView
      ref={mapRef}
      style={{ height: 360, borderRadius: 28, overflow: "hidden" }}
      initialRegion={region ?? fallbackRegion ?? undefined}
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

async function getCurrentLocationRegion(): Promise<Region | null> {
  try {
    const permission = await Location.requestForegroundPermissionsAsync();
    if (!permission.granted) return null;

    const position = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced
    });

    return getRadiusRegion(position.coords.latitude, position.coords.longitude);
  } catch {
    return null;
  }
}

function getInitialRegion(pins: BeerMapPin[]): Region | null {
  const [mostRecentPin] = pins;
  if (mostRecentPin && typeof mostRecentPin.latitude === "number" && typeof mostRecentPin.longitude === "number") {
    return getRadiusRegion(mostRecentPin.latitude, mostRecentPin.longitude);
  }

  return getFitRegion(pins);
}

function getRadiusRegion(latitude: number, longitude: number): Region {
  const latitudeDelta = Math.max(0.06, (mapRadiusMiles * 2) / 69);
  const longitudeMilesPerDegree = Math.max(1, 69 * Math.cos((latitude * Math.PI) / 180));
  const longitudeDelta = Math.max(0.06, (mapRadiusMiles * 2) / longitudeMilesPerDegree);
  return {
    latitude,
    longitude,
    latitudeDelta,
    longitudeDelta
  };
}

function getFitRegion(pins: BeerMapPin[]): Region | null {
  if (!pins.length) return null;
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
