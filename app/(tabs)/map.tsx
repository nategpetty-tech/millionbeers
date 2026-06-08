import { Ionicons } from "@expo/vector-icons";
import { useMemo, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { BeerMap, BeerMapPin } from "@/components/BeerMap";
import { CheckInModal } from "@/components/CheckInModal";
import { ProgressBar } from "@/components/ProgressBar";
import { ScreenHeader } from "@/components/ScreenHeader";
import { SectionTitle } from "@/components/SectionTitle";
import { StatCard } from "@/components/StatCard";
import { usePassport } from "@/store/passportStore";
import { theme } from "@/theme";

type Pin = {
  id: string;
  brewery: string;
  city: string;
  state?: string;
  latitude?: number;
  longitude?: number;
  hasCoordinates: boolean;
  visitCount: number;
  beerCount: number;
  visitors: string[];
  beers: string[];
  x: number;
  y: number;
};

const knownPositions: Record<string, { x: number; y: number }> = {
  "Goose Island Beer Co.": { x: 47, y: 45 },
  "Half Acre Beer Co.": { x: 55, y: 25 },
  "Revolution Brewing": { x: 43, y: 36 },
  "Maplewood Brewery": { x: 51, y: 33 },
  "Moot Court Brewing": { x: 61, y: 48 },
  "Hidden Key Brewery": { x: 37, y: 56 }
};

export default function MapScreen() {
  const { checkIns, user } = usePassport();
  const [checkInOpen, setCheckInOpen] = useState(false);
  const scopedCheckIns = useMemo(() => checkIns.filter((item) => item.userId === user.id), [checkIns, user.id]);
  const pins = useMemo(() => {
    const coordinateItems = scopedCheckIns.filter(
      (item) => typeof item.location.latitude === "number" && typeof item.location.longitude === "number"
    );
    const minLat = coordinateItems.length ? Math.min(...coordinateItems.map((item) => item.location.latitude ?? 0)) : 0;
    const maxLat = coordinateItems.length ? Math.max(...coordinateItems.map((item) => item.location.latitude ?? 0)) : 0;
    const minLon = coordinateItems.length ? Math.min(...coordinateItems.map((item) => item.location.longitude ?? 0)) : 0;
    const maxLon = coordinateItems.length ? Math.max(...coordinateItems.map((item) => item.location.longitude ?? 0)) : 0;
    const byBrewery = scopedCheckIns.reduce<Record<string, Pin>>((acc, item, index) => {
      const hasCoordinates = typeof item.location.latitude === "number" && typeof item.location.longitude === "number";
      const coordinatePosition = hasCoordinates
        ? {
            x: maxLon === minLon ? 50 : 18 + (((item.location.longitude ?? 0) - minLon) / (maxLon - minLon)) * 64,
            y: maxLat === minLat ? 50 : 18 + ((maxLat - (item.location.latitude ?? 0)) / (maxLat - minLat)) * 64
          }
        : undefined;
      const position = coordinatePosition ?? knownPositions[item.brewery] ?? {
        x: 28 + ((index * 17) % 46),
        y: 22 + ((index * 19) % 52)
      };
      if (!acc[item.brewery]) {
        acc[item.brewery] = {
          id: item.brewery,
          brewery: item.brewery,
          city: item.location.city,
          state: item.location.state,
          latitude: item.location.latitude,
          longitude: item.location.longitude,
          hasCoordinates,
          visitCount: 0,
          beerCount: 0,
          visitors: [],
          beers: [],
          x: position.x,
          y: position.y
        };
      }
      acc[item.brewery].visitCount += 1;
      acc[item.brewery].beerCount += item.quantity ?? 1;
      if (!acc[item.brewery].visitors.includes(item.userName)) acc[item.brewery].visitors.push(item.userName);
      if (!acc[item.brewery].beers.includes(item.beerName)) acc[item.brewery].beers.push(item.beerName);
      return acc;
    }, {});
    return Object.values(byBrewery).sort((a, b) => b.visitCount - a.visitCount);
  }, [scopedCheckIns]);

  const cities = useMemo(() => ["All", ...Array.from(new Set(pins.map((pin) => pin.city)))], [pins]);
  const [city, setCity] = useState("All");
  const filteredPins = city === "All" ? pins : pins.filter((pin) => pin.city === city);
  const [selected, setSelected] = useState<Pin | null>(filteredPins[0] ?? null);
  const visibleSelected = selected && filteredPins.some((pin) => pin.brewery === selected.brewery) ? selected : filteredPins[0];
  const summaryStats = useMemo(() => {
    const source = city === "All" ? scopedCheckIns : scopedCheckIns.filter((item) => item.location.city === city);
    return {
      cities: new Set(source.map((item) => item.location.city).filter(Boolean)).size,
      states: new Set(source.map((item) => item.location.state).filter(Boolean)).size,
      beers: source.reduce((sum, item) => sum + (item.quantity ?? 1), 0)
    };
  }, [city, scopedCheckIns]);
  const mapPins: BeerMapPin[] = filteredPins.map((pin) => ({
    id: pin.id,
    title: pin.brewery,
    subtitle: `${pin.city}${pin.state ? `, ${pin.state}` : ""}`,
    latitude: pin.hasCoordinates ? pin.latitude : undefined,
    longitude: pin.hasCoordinates ? pin.longitude : undefined,
    beerCount: pin.beerCount
  }));

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 120 }}>
        <ScreenHeader title="Map" subtitle="A personal atlas for the places you have logged beers." />
        <View style={{ paddingHorizontal: 20, gap: 14 }}>
          <View style={{ flexDirection: "row", gap: 10 }}>
            <StatCard label="Cities" value={summaryStats.cities} />
            <StatCard label="States" value={summaryStats.states} accent={theme.colors.gold} />
            <StatCard label="Total beers" value={summaryStats.beers} />
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={{ flexDirection: "row", gap: 8 }}>
              {cities.map((item) => {
                const active = city === item;
                return (
                  <Pressable
                    key={item}
                    onPress={() => {
                      setCity(item);
                      const firstPin = item === "All" ? pins[0] : pins.find((pin) => pin.city === item);
                      setSelected(firstPin ?? null);
                    }}
                    style={{
                      paddingHorizontal: 14,
                      paddingVertical: 10,
                      borderRadius: theme.radius.pill,
                      backgroundColor: active ? theme.colors.neon : theme.colors.card,
                      borderWidth: 1,
                      borderColor: active ? theme.colors.neon : theme.colors.border
                    }}
                  >
                    <Text style={{ color: active ? theme.colors.ink : theme.colors.text, fontWeight: "900" }}>{item}</Text>
                  </Pressable>
                );
              })}
            </View>
          </ScrollView>

          <BeerMap
            pins={mapPins}
            selectedId={visibleSelected?.id}
            onSelect={(id: string) => setSelected(filteredPins.find((pin) => pin.id === id) ?? null)}
          />

          <View
            style={{
              backgroundColor: theme.colors.card,
              borderRadius: theme.radius.lg,
              borderWidth: 1,
              borderColor: theme.colors.border,
              padding: 16
            }}
          >
            <LocationSummary pin={visibleSelected} onEmptyAction={() => setCheckInOpen(true)} />
          </View>

          <SectionTitle title="Visited Places" detail="Tap a row to focus the atlas." />
          {filteredPins.map((pin) => (
            <Pressable
              key={pin.brewery}
              onPress={() => setSelected(pin)}
              style={{
                backgroundColor: visibleSelected?.brewery === pin.brewery ? theme.colors.neonSoft : theme.colors.card,
                borderWidth: 1,
                borderColor: visibleSelected?.brewery === pin.brewery ? theme.colors.neon : theme.colors.border,
                borderRadius: theme.radius.lg,
                padding: 14
              }}
            >
              <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                <View
                  style={{
                    width: 46,
                    height: 46,
                    borderRadius: 16,
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: theme.colors.surface,
                    borderWidth: 1,
                    borderColor: theme.colors.border
                  }}
                >
                  <Ionicons name="location-outline" color={theme.colors.gold} size={22} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: theme.colors.text, fontWeight: "900", fontSize: 16 }}>{pin.brewery}</Text>
                  <Text style={{ color: theme.colors.muted, marginTop: 3 }}>
                    {pin.city}
                    {pin.state ? `, ${pin.state}` : ""} • {pin.beerCount} beers
                  </Text>
                </View>
                <Text style={{ color: theme.colors.neon, fontWeight: "900" }}>{pin.visitCount}x</Text>
              </View>
            </Pressable>
          ))}
        </View>
      </ScrollView>
      <CheckInModal visible={checkInOpen} onClose={() => setCheckInOpen(false)} />
    </SafeAreaView>
  );
}

function LocationSummary({ pin, onEmptyAction }: { pin?: Pin | null; onEmptyAction?: () => void }) {
  if (!pin) {
    return (
      <View>
        <Text style={{ color: theme.colors.text, fontWeight: "900" }}>No locations yet</Text>
        <Text style={{ color: theme.colors.muted, marginTop: 4 }}>Check in a beer to add your first map stamp.</Text>
        {onEmptyAction ? (
          <Pressable
            onPress={onEmptyAction}
            style={{
              alignSelf: "flex-start",
              backgroundColor: theme.colors.neon,
              borderRadius: theme.radius.pill,
              paddingHorizontal: 14,
              paddingVertical: 10,
              marginTop: 14
            }}
          >
            <Text style={{ color: theme.colors.ink, fontWeight: "900" }}>Log First Beer</Text>
          </Pressable>
        ) : null}
      </View>
    );
  }

  return (
    <View>
      <Text style={{ color: theme.colors.gold, fontWeight: "900", letterSpacing: 1, fontSize: 12 }}>SELECTED STAMP</Text>
      <Text style={{ color: theme.colors.text, fontSize: 19, fontWeight: "900", marginTop: 5 }}>{pin.brewery}</Text>
      <Text style={{ color: theme.colors.muted, marginTop: 3 }}>
        {pin.city}
        {pin.state ? `, ${pin.state}` : ""} • {pin.visitors.join(", ")}
      </Text>
      <Text style={{ color: pin.hasCoordinates ? theme.colors.neon : theme.colors.dim, marginTop: 5, fontSize: 12, fontWeight: "800" }}>
        {pin.hasCoordinates ? "GPS photo location" : "City-based location"}
      </Text>
      <View style={{ flexDirection: "row", gap: 10, marginTop: 12 }}>
        <Mini label="Visits" value={pin.visitCount} />
        <Mini label="Beers" value={pin.beerCount} />
      </View>
      <View style={{ marginTop: 12 }}>
        <ProgressBar current={Math.min(pin.beerCount, 10)} goal={10} color={theme.colors.gold} />
        <Text style={{ color: theme.colors.dim, marginTop: 6, fontSize: 12 }}>{pin.beers.slice(0, 3).join(" • ")}</Text>
      </View>
    </View>
  );
}

function Mini({ label, value }: { label: string; value: number }) {
  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.surface, borderRadius: theme.radius.md, padding: 10 }}>
      <Text style={{ color: theme.colors.neon, fontSize: 20, fontWeight: "900" }}>{value}</Text>
      <Text style={{ color: theme.colors.muted, marginTop: 2, fontSize: 12 }}>{label}</Text>
    </View>
  );
}
