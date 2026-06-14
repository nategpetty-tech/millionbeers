import { Ionicons } from "@expo/vector-icons";
import { useMemo, useRef, useState } from "react";
import { Image, Modal, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { BeerMap, BeerMapPin } from "@/components/BeerMap";
import { CheckInModal } from "@/components/CheckInModal";
import { ScreenHeader } from "@/components/ScreenHeader";
import { SectionTitle } from "@/components/SectionTitle";
import { StatCard } from "@/components/StatCard";
import { friendsFeatureEnabled } from "@/config/features";
import { usePassport } from "@/store/passportStore";
import { theme } from "@/theme";
import type { BeerCheckIn } from "@/types";
import { broadPlaceLabel } from "@/utils/format";

const SAME_PLACE_METERS = 60;

type PinPhoto = {
  id: string;
  fullUri: string;
  thumbnailUri: string;
  createdAt: string;
  beerCount: number;
  userName: string;
};

type Pin = {
  id: string;
  title: string;
  city: string;
  state?: string;
  country?: string;
  latitude?: number;
  longitude?: number;
  hasCoordinates: boolean;
  visitCount: number;
  beerCount: number;
  visitors: string[];
  photos: PinPhoto[];
  x: number;
  y: number;
  latestAt: string;
};

export default function MapScreen() {
  const { checkIns, friends, user } = usePassport();
  const [checkInOpen, setCheckInOpen] = useState(false);
  const [scope, setScope] = useState<"mine" | "friends">("mine");
  const scrollRef = useRef<ScrollView | null>(null);
  const selectedStampY = useRef(0);
  const selectedPhotosY = useRef(0);
  const friendIds = useMemo(() => new Set(friends.map((friend) => friend.userId)), [friends]);
  const friendLastCheckIns = useMemo(() => latestFriendCheckIns(checkIns, friendIds), [checkIns, friendIds]);
  const scopedCheckIns = useMemo(
    () => (scope === "mine" || !friendsFeatureEnabled ? checkIns.filter((item) => item.userId === user.id) : friendLastCheckIns),
    [checkIns, friendLastCheckIns, scope, user.id]
  );
  const pins = useMemo(() => buildPlacePins(scopedCheckIns), [scopedCheckIns]);

  const cities = useMemo(() => ["All", ...Array.from(new Set(pins.map((pin) => pin.city).filter(Boolean)))], [pins]);
  const [city, setCity] = useState("All");
  const filteredPins = city === "All" ? pins : pins.filter((pin) => pin.city === city);
  const [selected, setSelected] = useState<Pin | null>(filteredPins[0] ?? null);
  const visibleSelected = selected && filteredPins.some((pin) => pin.id === selected.id) ? selected : filteredPins[0];
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
    title: pin.title,
    subtitle: `${pin.beerCount} beers • ${pin.visitCount} logs`,
    latitude: pin.hasCoordinates ? pin.latitude : undefined,
    longitude: pin.hasCoordinates ? pin.longitude : undefined,
    beerCount: pin.beerCount
  }));

  function scrollToSelectedStamp() {
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({
        y: Math.max(0, selectedStampY.current - 12),
        animated: true
      });
    });
  }

  function scrollToSelectedPhotos() {
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({
        y: Math.max(0, selectedStampY.current + selectedPhotosY.current - 12),
        animated: true
      });
    });
  }

  function selectPinAndShowPhotos(id: string) {
    const pin = filteredPins.find((item) => item.id === id) ?? null;
    setSelected(pin);
    if (pin?.photos.length) {
      scrollToSelectedPhotos();
      return;
    }
    scrollToSelectedStamp();
  }

  function changeScope(nextScope: "mine" | "friends") {
    setScope(nextScope);
    setCity("All");
    setSelected(null);
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <ScrollView ref={scrollRef} contentContainerStyle={{ paddingBottom: 120 }}>
        <ScreenHeader
          title="Map"
          subtitle={scope === "mine" || !friendsFeatureEnabled ? "A personal atlas for the places you have logged beers." : "The latest drinking location each friend has shared."}
        />
        <View style={{ paddingHorizontal: 20, gap: 14 }}>
          <View style={{ flexDirection: "row", gap: 10 }}>
            <StatCard label="Cities" value={summaryStats.cities} />
            <StatCard label="States" value={summaryStats.states} accent={theme.colors.gold} />
            <StatCard label={scope === "mine" ? "Total beers" : "Latest beers"} value={summaryStats.beers} />
          </View>

          {friendsFeatureEnabled ? (
            <View style={{ flexDirection: "row", gap: 8, backgroundColor: theme.colors.card, borderRadius: theme.radius.pill, borderWidth: 1, borderColor: theme.colors.border, padding: 4 }}>
              <ScopeButton label="My Stamps" active={scope === "mine"} onPress={() => changeScope("mine")} />
              <ScopeButton label="Friend Last Logs" active={scope === "friends"} onPress={() => changeScope("friends")} />
            </View>
          ) : null}

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
            onSelect={selectPinAndShowPhotos}
          />

          <View
            onLayout={(event) => {
              selectedStampY.current = event.nativeEvent.layout.y;
            }}
            style={{
              backgroundColor: theme.colors.card,
              borderRadius: theme.radius.lg,
              borderWidth: 1,
              borderColor: theme.colors.border,
              padding: 16
            }}
          >
            <LocationSummary
              pin={visibleSelected}
              scope={scope}
              onEmptyAction={scope === "mine" ? () => setCheckInOpen(true) : undefined}
              onViewPhotos={scrollToSelectedPhotos}
              onPhotosLayout={(y) => {
                selectedPhotosY.current = y;
              }}
            />
          </View>

          <SectionTitle
            title={scope === "mine" || !friendsFeatureEnabled ? "Visited Places" : "Friend Last Logs"}
            detail={scope === "mine" || !friendsFeatureEnabled ? "Tap a row to focus the atlas." : "One latest beer location per friend."}
          />
          {filteredPins.map((pin) => (
            <Pressable
              key={pin.id}
              onPress={() => setSelected(pin)}
              style={{
                backgroundColor: visibleSelected?.id === pin.id ? theme.colors.neonSoft : theme.colors.card,
                borderWidth: 1,
                borderColor: visibleSelected?.id === pin.id ? theme.colors.neon : theme.colors.border,
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
                  <Text style={{ color: theme.colors.text, fontWeight: "900", fontSize: 16 }}>{pin.title}</Text>
                  <Text style={{ color: theme.colors.muted, marginTop: 3 }}>
                    {scope === "mine"
                      ? `${pin.beerCount} beers • ${pin.photos.length} photos`
                      : `${pin.visitors.join(", ")} • ${pin.beerCount} latest beers`}
                  </Text>
                </View>
                <Text style={{ color: theme.colors.neon, fontWeight: "900" }}>{scope === "mine" ? `${pin.visitCount}x` : "Latest"}</Text>
              </View>
            </Pressable>
          ))}
        </View>
      </ScrollView>
      <CheckInModal visible={checkInOpen} onClose={() => setCheckInOpen(false)} />
    </SafeAreaView>
  );
}

function buildPlacePins(checkIns: BeerCheckIn[]) {
  const coordinateItems = checkIns.filter((item) => hasCoordinates(item));
  const minLat = coordinateItems.length ? Math.min(...coordinateItems.map((item) => item.location.latitude ?? 0)) : 0;
  const maxLat = coordinateItems.length ? Math.max(...coordinateItems.map((item) => item.location.latitude ?? 0)) : 0;
  const minLon = coordinateItems.length ? Math.min(...coordinateItems.map((item) => item.location.longitude ?? 0)) : 0;
  const maxLon = coordinateItems.length ? Math.max(...coordinateItems.map((item) => item.location.longitude ?? 0)) : 0;
  const pins: Pin[] = [];

  checkIns
    .slice()
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
    .forEach((item, index) => {
      const placeKey = fallbackPlaceKey(item);
      const hasGps = hasCoordinates(item);
      const pin = hasGps
        ? pins.find(
            (candidate) =>
              candidate.hasCoordinates &&
              typeof candidate.latitude === "number" &&
              typeof candidate.longitude === "number" &&
              distanceMeters(candidate.latitude, candidate.longitude, item.location.latitude as number, item.location.longitude as number) <=
                SAME_PLACE_METERS
          )
        : pins.find((candidate) => candidate.id === placeKey);

      if (pin) {
        addCheckInToPin(pin, item);
        return;
      }

      const coordinatePosition = hasGps
        ? {
            x: maxLon === minLon ? 50 : 18 + (((item.location.longitude ?? 0) - minLon) / (maxLon - minLon)) * 64,
            y: maxLat === minLat ? 50 : 18 + ((maxLat - (item.location.latitude ?? 0)) / (maxLat - minLat)) * 64
          }
        : undefined;
      pins.push({
        id: hasGps ? `gps-${item.id}` : placeKey,
        title: broadPlaceLabel(item.location),
        city: item.location.city,
        state: item.location.state,
        country: item.location.country,
        latitude: item.location.latitude,
        longitude: item.location.longitude,
        hasCoordinates: hasGps,
        visitCount: 0,
        beerCount: 0,
        visitors: [],
        photos: [],
        x: coordinatePosition?.x ?? 28 + ((index * 17) % 46),
        y: coordinatePosition?.y ?? 22 + ((index * 19) % 52),
        latestAt: item.createdAt
      });
      addCheckInToPin(pins[pins.length - 1], item);
    });

  return pins.sort((a, b) => new Date(b.latestAt).getTime() - new Date(a.latestAt).getTime());
}

function latestFriendCheckIns(checkIns: BeerCheckIn[], friendIds: Set<string>) {
  const latestByFriend = new Map<string, BeerCheckIn>();
  checkIns.forEach((checkIn) => {
    if (!friendIds.has(checkIn.userId)) return;
    const existing = latestByFriend.get(checkIn.userId);
    if (!existing || new Date(checkIn.createdAt).getTime() > new Date(existing.createdAt).getTime()) {
      latestByFriend.set(checkIn.userId, checkIn);
    }
  });
  return Array.from(latestByFriend.values()).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

function ScopeButton({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        flex: 1,
        alignItems: "center",
        paddingVertical: 10,
        borderRadius: theme.radius.pill,
        backgroundColor: active ? theme.colors.neon : "transparent"
      }}
    >
      <Text style={{ color: active ? theme.colors.ink : theme.colors.muted, fontWeight: "900" }}>{label}</Text>
    </Pressable>
  );
}

function addCheckInToPin(pin: Pin, item: BeerCheckIn) {
  const previousVisits = pin.visitCount;
  pin.visitCount += 1;
  pin.beerCount += item.quantity ?? 1;
  pin.latestAt = new Date(item.createdAt).getTime() > new Date(pin.latestAt).getTime() ? item.createdAt : pin.latestAt;
  if (!pin.visitors.includes(item.userName)) pin.visitors.push(item.userName);

  if (pin.hasCoordinates && hasCoordinates(item) && typeof pin.latitude === "number" && typeof pin.longitude === "number") {
    pin.latitude = (pin.latitude * previousVisits + (item.location.latitude as number)) / pin.visitCount;
    pin.longitude = (pin.longitude * previousVisits + (item.location.longitude as number)) / pin.visitCount;
  }

  const photoUri = item.photoUrl ?? item.photoUri;
  if (photoUri) {
    pin.photos.unshift({
      id: item.id,
      fullUri: photoUri,
      thumbnailUri: item.photoThumbnailUrl ?? photoUri,
      createdAt: item.createdAt,
      beerCount: item.quantity ?? 1,
      userName: item.userName
    });
  }
}

function fallbackPlaceKey(item: BeerCheckIn) {
  return `place-${[item.location.city, item.location.state, item.location.country].map((part) => part?.trim().toLowerCase() || "unknown").join("-")}`;
}

function hasCoordinates(item: BeerCheckIn) {
  return typeof item.location.latitude === "number" && typeof item.location.longitude === "number";
}

function distanceMeters(latA: number, lonA: number, latB: number, lonB: number) {
  const earthRadiusMeters = 6371000;
  const latDelta = toRadians(latB - latA);
  const lonDelta = toRadians(lonB - lonA);
  const a =
    Math.sin(latDelta / 2) * Math.sin(latDelta / 2) +
    Math.cos(toRadians(latA)) * Math.cos(toRadians(latB)) * Math.sin(lonDelta / 2) * Math.sin(lonDelta / 2);
  return earthRadiusMeters * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function toRadians(value: number) {
  return (value * Math.PI) / 180;
}

function LocationSummary({
  pin,
  scope,
  onEmptyAction,
  onViewPhotos,
  onPhotosLayout
}: {
  pin?: Pin | null;
  scope: "mine" | "friends";
  onEmptyAction?: () => void;
  onViewPhotos?: () => void;
  onPhotosLayout?: (y: number) => void;
}) {
  const [previewPhoto, setPreviewPhoto] = useState<PinPhoto | null>(null);
  const visiblePhotos = pin?.photos.slice(0, 8) ?? [];

  if (!pin) {
    return (
      <View>
        <Text style={{ color: theme.colors.text, fontWeight: "900" }}>No locations yet</Text>
        <Text style={{ color: theme.colors.muted, marginTop: 4 }}>
          {scope === "mine" ? "Check in a beer to add your first map stamp." : "Add friends to see their latest drinking locations here."}
        </Text>
        {onEmptyAction && scope === "mine" ? (
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
      <Text style={{ color: theme.colors.gold, fontWeight: "900", letterSpacing: 1, fontSize: 12 }}>
        {scope === "mine" ? "SELECTED STAMP" : "FRIEND LAST LOG"}
      </Text>
      <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 10, marginTop: 5 }}>
        <Text style={{ color: theme.colors.text, fontSize: 19, fontWeight: "900", flex: 1 }}>{pin.title}</Text>
        {pin.photos.length ? (
          <Pressable
            onPress={onViewPhotos}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 5,
              backgroundColor: theme.colors.neonSoft,
              borderWidth: 1,
              borderColor: theme.colors.neon,
              borderRadius: theme.radius.pill,
              paddingHorizontal: 10,
              paddingVertical: 7
            }}
          >
            <Ionicons name="images-outline" color={theme.colors.neon} size={15} />
            <Text style={{ color: theme.colors.neon, fontWeight: "900", fontSize: 12 }}>Photos</Text>
          </Pressable>
        ) : null}
      </View>
      <Text style={{ color: theme.colors.muted, marginTop: 3 }}>
        {pin.visitors.join(", ")}
      </Text>
      <Text style={{ color: pin.hasCoordinates ? theme.colors.neon : theme.colors.dim, marginTop: 5, fontSize: 12, fontWeight: "800" }}>
        {pin.hasCoordinates ? `GPS clustered within ${SAME_PLACE_METERS}m` : "City-based location"}
      </Text>
      <View style={{ flexDirection: "row", gap: 10, marginTop: 12 }}>
        <Mini label={scope === "mine" ? "Visits" : "Friends"} value={scope === "mine" ? pin.visitCount : pin.visitors.length} />
        <Mini label="Beers" value={pin.beerCount} />
        <Mini label="Photos" value={pin.photos.length} />
      </View>
      <Text style={{ color: theme.colors.dim, marginTop: 12, fontSize: 12, lineHeight: 18 }}>
        {scope === "mine" ? "This pin combines logs from the same physical place." : "Friend mode only shows each friend's most recent shared beer location."}
      </Text>
      <View
        onLayout={(event) => {
          onPhotosLayout?.(event.nativeEvent.layout.y);
        }}
        style={{ marginTop: 14 }}
      >
        <Text style={{ color: theme.colors.text, fontWeight: "900", marginBottom: 10 }}>Photos from this place</Text>
        {visiblePhotos.length ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={{ flexDirection: "row", gap: 10 }}>
              {visiblePhotos.map((photo) => (
                <Pressable key={photo.id} onPress={() => setPreviewPhoto(photo)}>
                  <Image
                    source={{ uri: photo.thumbnailUri }}
                    style={{
                      width: 92,
                      height: 116,
                      borderRadius: theme.radius.md,
                      backgroundColor: theme.colors.surface
                    }}
                  />
                  <View
                    style={{
                      position: "absolute",
                      left: 6,
                      bottom: 6,
                      borderRadius: theme.radius.pill,
                      backgroundColor: "rgba(0,0,0,0.72)",
                      paddingHorizontal: 8,
                      paddingVertical: 4
                    }}
                  >
                    <Text style={{ color: theme.colors.neon, fontSize: 11, fontWeight: "900" }}>{photo.beerCount} beers</Text>
                  </View>
                </Pressable>
              ))}
            </View>
          </ScrollView>
        ) : (
          <Text style={{ color: theme.colors.muted, lineHeight: 20 }}>No photos were attached to the logs at this place yet.</Text>
        )}
      </View>
      <Modal visible={Boolean(previewPhoto)} transparent animationType="fade" onRequestClose={() => setPreviewPhoto(null)}>
        <Pressable
          onPress={() => setPreviewPhoto(null)}
          style={{
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.9)",
            alignItems: "center",
            justifyContent: "center",
            padding: 20
          }}
        >
          {previewPhoto ? (
            <Image
              source={{ uri: previewPhoto.fullUri }}
              resizeMode="contain"
              style={{ width: "100%", height: "78%", borderRadius: theme.radius.lg }}
            />
          ) : null}
          <Text style={{ color: theme.colors.text, fontWeight: "900", marginTop: 14 }}>Tap anywhere to close</Text>
        </Pressable>
      </Modal>
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
