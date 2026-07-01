import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import { useCallback, useMemo, useRef, useState } from "react";
import { Image, Modal, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { BeerMap, BeerMapPin } from "@/components/BeerMap";
import { CheckInModal } from "@/components/CheckInModal";
import { ZoomablePhotoModal } from "@/components/ZoomablePhotoModal";
import { buildCloudflareImageUrl } from "@/services/photoStorage";
import { usePassport } from "@/store/passportStore";
import { AppTheme, useAppTheme } from "@/theme";
import { BeerCheckIn } from "@/types";
import { broadPlaceLabel, formatNumber } from "@/utils/format";

const SAME_PLACE_METERS = 70;
const mapPromptMascot = require("../../assets/map/select-place-mascot.png");

type PlacePhoto = {
  id: string;
  uri: string;
};

type VisitGroup = {
  dateKey: string;
  date: Date;
  logs: BeerCheckIn[];
};

type PlacePin = {
  id: string;
  title: string;
  city: string;
  state?: string;
  country?: string;
  latitude?: number;
  longitude?: number;
  hasCoordinates: boolean;
  hasNamedPlace: boolean;
  visitCount: number;
  beerCount: number;
  firstVisit: string;
  lastVisit: string;
  photos: PlacePhoto[];
  logs: BeerCheckIn[];
  visits: VisitGroup[];
};

export default function MapScreen() {
  const theme = useAppTheme();
  const { checkIns, user } = usePassport();
  const [checkInOpen, setCheckInOpen] = useState(false);
  const [historyPin, setHistoryPin] = useState<PlacePin | null>(null);
  const [previewPhoto, setPreviewPhoto] = useState<string | null>(null);
  const scrollRef = useRef<ScrollView | null>(null);
  const selectedCardY = useRef(0);
  const personalLogs = useMemo(() => checkIns.filter((item) => item.userId === user.id), [checkIns, user.id]);
  const pins = useMemo(() => buildPlacePins(personalLogs), [personalLogs]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selectedPin = pins.find((pin) => pin.id === selectedId) ?? null;
  const stats = useMemo(
    () => ({
      places: pins.length,
      stamps: personalLogs.length,
      beers: personalLogs.reduce((total, log) => total + (log.quantity ?? 1), 0)
    }),
    [personalLogs, pins]
  );
  const mostVisited = useMemo(() => [...pins].sort((a, b) => b.beerCount - a.beerCount || b.visitCount - a.visitCount).slice(0, 6), [pins]);
  const mapPins: BeerMapPin[] = pins.map((pin) => ({
    id: pin.id,
    title: pin.title,
    subtitle: `${pin.visitCount} ${pin.visitCount === 1 ? "visit" : "visits"} • ${pin.beerCount} ${pin.beerCount === 1 ? "beer" : "beers"}`,
    latitude: pin.latitude,
    longitude: pin.longitude,
    beerCount: pin.beerCount
  }));

  function selectPin(id: string) {
    setSelectedId(id);
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ y: Math.max(0, selectedCardY.current - 10), animated: true });
    });
  }

  useFocusEffect(
    useCallback(() => {
      return () => {
        setSelectedId(null);
        setHistoryPin(null);
        setPreviewPhoto(null);
      };
    }, [])
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <ScrollView ref={scrollRef} contentContainerStyle={{ paddingBottom: 120 }}>
        <View style={{ paddingHorizontal: 22, paddingTop: 14, paddingBottom: 8 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 16 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: theme.colors.accent, fontSize: 12, fontWeight: "900", letterSpacing: 2 }}>PINTLY</Text>
              <Text style={{ color: theme.colors.textPrimary, fontSize: 38, fontWeight: "900", marginTop: 6 }}>Map</Text>
              <Text style={{ color: theme.colors.textSecondary, lineHeight: 21, marginTop: 6 }}>Your beer passport. Everywhere you've logged a beer.</Text>
            </View>
          </View>
        </View>

        <View style={{ paddingHorizontal: 20, gap: 24 }}>
          <View style={{ flexDirection: "row", gap: 10 }}>
            <PassportStat label="Places" value={stats.places} theme={theme} />
            <PassportStat label="Stamps" value={stats.stamps} theme={theme} />
            <PassportStat label="Beers" value={stats.beers} theme={theme} />
          </View>

          <View style={{ borderRadius: 28, overflow: "hidden", ...theme.shadow.card }}>
            <BeerMap pins={mapPins} selectedId={selectedPin?.id} onSelect={selectPin} />
          </View>

          <View
            onLayout={(event) => {
              selectedCardY.current = event.nativeEvent.layout.y;
            }}
          >
            <SelectedLocationCard
              pin={selectedPin}
              hasPlaces={pins.length > 0}
              onLogBeer={() => setCheckInOpen(true)}
              onViewHistory={() => selectedPin && setHistoryPin(selectedPin)}
              onPhotoPress={setPreviewPhoto}
              theme={theme}
            />
          </View>

          <View style={{ gap: 12 }}>
            <SectionHeader title="Most Visited Places" detail="Your top locations by beers logged." theme={theme} />
            {mostVisited.length ? (
              <View style={{ gap: 10 }}>
                {mostVisited.map((pin) => (
                  <PlaceRow
                    key={pin.id}
                    pin={pin}
                    active={selectedPin?.id === pin.id}
                    onPress={() => {
                      setSelectedId(pin.id);
                      requestAnimationFrame(() => {
                        scrollRef.current?.scrollTo({ y: Math.max(0, selectedCardY.current - 10), animated: true });
                      });
                    }}
                    theme={theme}
                  />
                ))}
              </View>
            ) : (
              <EmptyPassportCard title="No places stamped yet." body="Log a beer to start building your beer passport." actionLabel="Log Beer" onAction={() => setCheckInOpen(true)} theme={theme} />
            )}
          </View>

        </View>
      </ScrollView>
      <CheckInModal visible={checkInOpen} onClose={() => setCheckInOpen(false)} />
      <LocationHistoryModal pin={historyPin} onClose={() => setHistoryPin(null)} theme={theme} />
      <PhotoPreviewModal uri={previewPhoto} onClose={() => setPreviewPhoto(null)} theme={theme} />
    </SafeAreaView>
  );
}

function buildPlacePins(logs: BeerCheckIn[]): PlacePin[] {
  const pins: PlacePin[] = [];

  logs
    .slice()
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
    .forEach((log) => {
      const fallbackKey = placeKey(log);
      const namedPin = pins.find((item) => item.id === fallbackKey);
      const gpsPin = !hasNamedPlace(log) && hasCoordinates(log)
        ? pins.find(
            (pin) =>
              !pin.hasNamedPlace &&
              pin.hasCoordinates &&
              typeof pin.latitude === "number" &&
              typeof pin.longitude === "number" &&
              distanceMeters(pin.latitude, pin.longitude, log.location.latitude as number, log.location.longitude as number) <= SAME_PLACE_METERS
          )
        : undefined;
      const pin = namedPin ?? gpsPin;

      if (pin) {
        addLogToPin(pin, log);
        return;
      }

      const nextPin: PlacePin = {
        id: placeIdentity(log, fallbackKey, pins.length),
        title: placeTitle(log),
        city: log.location.city,
        state: log.location.state,
        country: log.location.country,
        latitude: placeLatitude(log),
        longitude: placeLongitude(log),
        hasCoordinates: hasCoordinates(log),
        hasNamedPlace: hasNamedPlace(log),
        visitCount: 0,
        beerCount: 0,
        firstVisit: log.createdAt,
        lastVisit: log.createdAt,
        photos: [],
        logs: [],
        visits: []
      };
      addLogToPin(nextPin, log);
      pins.push(nextPin);
    });

  return pins.sort((a, b) => new Date(b.lastVisit).getTime() - new Date(a.lastVisit).getTime());
}

function addLogToPin(pin: PlacePin, log: BeerCheckIn) {
  const previousCount = pin.logs.length;
  pin.logs.push(log);
  pin.beerCount += log.quantity ?? 1;
  pin.firstVisit = new Date(log.createdAt).getTime() < new Date(pin.firstVisit).getTime() ? log.createdAt : pin.firstVisit;
  pin.lastVisit = new Date(log.createdAt).getTime() > new Date(pin.lastVisit).getTime() ? log.createdAt : pin.lastVisit;

  if (pin.hasCoordinates && hasCoordinates(log) && typeof pin.latitude === "number" && typeof pin.longitude === "number") {
    pin.latitude = (pin.latitude * previousCount + (log.location.latitude as number)) / Math.max(1, previousCount + 1);
    pin.longitude = (pin.longitude * previousCount + (log.location.longitude as number)) / Math.max(1, previousCount + 1);
  }

  const dateKey = localDateKey(log.createdAt);
  const visit = pin.visits.find((item) => item.dateKey === dateKey);
  if (visit) {
    visit.logs.push(log);
  } else {
    pin.visits.push({ dateKey, date: new Date(`${dateKey}T12:00:00`), logs: [log] });
  }
  pin.visits.sort((a, b) => b.date.getTime() - a.date.getTime());
  pin.visitCount = pin.visits.length;

  const uri = photoFor(log);
  if (uri) {
    pin.photos.unshift({
      id: log.id,
      uri
    });
  }
}

function SelectedLocationCard({
  pin,
  hasPlaces,
  onLogBeer,
  onViewHistory,
  onPhotoPress,
  theme
}: {
  pin: PlacePin | null;
  hasPlaces: boolean;
  onLogBeer: () => void;
  onViewHistory: () => void;
  onPhotoPress: (uri: string) => void;
  theme: AppTheme;
}) {
  if (!pin) {
    return (
      <View style={cardStyle(theme, 18, 24)}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
          <Image source={mapPromptMascot} style={{ width: 66, height: 66 }} resizeMode="contain" />
          <View style={{ flex: 1 }}>
            <Text style={{ color: theme.colors.textPrimary, fontWeight: "900", fontSize: 19 }}>{hasPlaces ? "Select a place" : "No places stamped yet."}</Text>
            <Text numberOfLines={2} style={{ color: theme.colors.textSecondary, lineHeight: 17, marginTop: 5, fontSize: 13 }}>
              {hasPlaces ? "Tap a map marker or a place below to view its passport history." : "Log a beer to start building your beer passport."}
            </Text>
            {!hasPlaces ? (
              <Pressable onPress={onLogBeer} style={primaryPill(theme)}>
                <Ionicons name="camera-outline" color={theme.colors.textOnPrimary} size={18} />
                <Text style={{ color: theme.colors.textOnPrimary, fontWeight: "900" }}>Log Beer</Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={cardStyle(theme, 18, 24)}>
      <Text style={{ color: theme.colors.accent, fontSize: 11, fontWeight: "900", letterSpacing: 1.6 }}>SELECTED PLACE</Text>
      <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 12, marginTop: 7 }}>
        <View style={{ flex: 1 }}>
          <Text style={{ color: theme.colors.textPrimary, fontWeight: "900", fontSize: 24 }}>{pin.title}</Text>
          <Text style={{ color: theme.colors.textSecondary, marginTop: 4 }}>{placeSubtitle(pin)}</Text>
        </View>
        <View style={{ width: 48, height: 48, borderRadius: 18, backgroundColor: theme.colors.accentSoft, alignItems: "center", justifyContent: "center" }}>
          <Ionicons name="location-outline" color={theme.colors.accent} size={23} />
        </View>
      </View>

      <View style={{ flexDirection: "row", gap: 10, marginTop: 16 }}>
        <MiniMetric label="Visits" value={pin.visitCount} theme={theme} />
        <MiniMetric label="Beers Logged" value={pin.beerCount} theme={theme} />
      </View>

      <View style={{ flexDirection: "row", gap: 10, marginTop: 10 }}>
        <DateMetric label="First visit" value={formatVisitDate(pin.firstVisit)} theme={theme} />
        <DateMetric label="Last visit" value={formatVisitDate(pin.lastVisit)} theme={theme} />
      </View>

      <PhotoStrip photos={pin.photos.slice(0, 5)} onPhotoPress={onPhotoPress} theme={theme} />

      <Pressable onPress={onViewHistory} style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 16, borderTopWidth: 1, borderTopColor: theme.colors.cardBorder, paddingTop: 15 }}>
        <Text style={{ color: theme.colors.accent, fontWeight: "900" }}>View History</Text>
        <Ionicons name="chevron-forward" color={theme.colors.accent} size={18} />
      </Pressable>
    </View>
  );
}

function LocationHistoryModal({ pin, onClose, theme }: { pin: PlacePin | null; onClose: () => void; theme: AppTheme }) {
  const [previewPhoto, setPreviewPhoto] = useState<string | null>(null);
  if (!pin) return null;
  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }}>
        <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 48 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 16 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: theme.colors.accent, fontSize: 12, fontWeight: "900", letterSpacing: 1.7 }}>PLACE HISTORY</Text>
              <Text style={{ color: theme.colors.textPrimary, fontWeight: "900", fontSize: 31, marginTop: 5 }}>{pin.title}</Text>
              <Text style={{ color: theme.colors.textSecondary, marginTop: 6 }}>{placeSubtitle(pin)}</Text>
            </View>
            <Pressable onPress={onClose} hitSlop={8} style={{ padding: 8 }}>
              <Ionicons name="close" color={theme.colors.textPrimary} size={28} />
            </Pressable>
          </View>

          <View style={{ flexDirection: "row", gap: 10, marginTop: 22 }}>
            <MiniMetric label="Visits" value={pin.visitCount} theme={theme} />
            <MiniMetric label="Beers Logged" value={pin.beerCount} theme={theme} />
          </View>
          <View style={{ flexDirection: "row", gap: 10, marginTop: 10 }}>
            <DateMetric label="First visit" value={formatVisitDate(pin.firstVisit)} theme={theme} />
            <DateMetric label="Last visit" value={formatVisitDate(pin.lastVisit)} theme={theme} />
          </View>

          <View style={{ gap: 10, marginTop: 18 }}>
            <SectionHeader title="Visits" theme={theme} />
            {pin.visits.map((visit) => {
              const beers = visit.logs.reduce((total, log) => total + (log.quantity ?? 1), 0);
              return (
                <View key={visit.dateKey} style={cardStyle(theme, 14, theme.radius.md)}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 12 }}>
                    <Text style={{ color: theme.colors.textPrimary, fontWeight: "900", fontSize: 16 }}>{visit.date.toLocaleDateString([], { month: "long", day: "numeric", year: "numeric" })}</Text>
                    <Text style={{ color: theme.colors.accent, fontWeight: "900" }}>{beers} {beers === 1 ? "beer" : "beers"}</Text>
                  </View>
                  {visit.logs.map((log) => (
                    <VisitLogRow key={log.id} log={log} onPhotoPress={setPreviewPhoto} theme={theme} />
                  ))}
                </View>
              );
            })}
          </View>
        </ScrollView>
        {previewPhoto ? <InlinePhotoPreview uri={previewPhoto} onClose={() => setPreviewPhoto(null)} theme={theme} /> : null}
      </SafeAreaView>
    </Modal>
  );
}

function VisitLogRow({ log, onPhotoPress, theme }: { log: BeerCheckIn; onPhotoPress: (uri: string) => void; theme: AppTheme }) {
  const photo = photoFor(log);
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginTop: 10 }}>
      {photo ? (
        <Pressable onPress={() => onPhotoPress(photo)} hitSlop={6}>
          <Image source={{ uri: photo }} style={{ width: 52, height: 52, borderRadius: 13, backgroundColor: theme.colors.surfaceAlt }} resizeMode="cover" />
        </Pressable>
      ) : (
        <View style={{ width: 52, height: 52, borderRadius: 13, backgroundColor: theme.colors.surfaceAlt, alignItems: "center", justifyContent: "center" }}>
          <Ionicons name="beer-outline" color={theme.colors.accent} size={20} />
        </View>
      )}
      <View style={{ flex: 1 }}>
        <Text style={{ color: theme.colors.textPrimary, fontWeight: "900" }}>{cleanBeerName(log)}</Text>
        <Text style={{ color: theme.colors.textSecondary, marginTop: 3, fontSize: 12 }}>{new Date(log.createdAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</Text>
      </View>
    </View>
  );
}

function PlaceRow({ pin, active, onPress, theme }: { pin: PlacePin; active: boolean; onPress: () => void; theme: AppTheme }) {
  const thumb = pin.photos[0]?.uri;
  return (
    <Pressable onPress={onPress} style={{ ...cardStyle(theme, 12, theme.radius.lg), borderColor: active ? theme.colors.accent : theme.colors.cardBorder, backgroundColor: active ? theme.colors.accentSoft : theme.colors.card }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        {thumb ? (
          <Image source={{ uri: thumb }} style={{ width: 54, height: 54, borderRadius: 16, backgroundColor: theme.colors.surfaceAlt }} resizeMode="cover" />
        ) : (
          <View style={{ width: 54, height: 54, borderRadius: 16, backgroundColor: theme.colors.surfaceAlt, alignItems: "center", justifyContent: "center" }}>
            <Ionicons name="location-outline" color={theme.colors.accent} size={22} />
          </View>
        )}
        <View style={{ flex: 1 }}>
          <Text style={{ color: theme.colors.textPrimary, fontWeight: "900", fontSize: 16 }}>{pin.title}</Text>
          <Text style={{ color: theme.colors.textSecondary, marginTop: 3 }}>{placeSubtitle(pin)}</Text>
        </View>
        <View style={{ alignItems: "flex-end" }}>
          <Text style={{ color: theme.colors.accent, fontWeight: "900" }}>{formatNumber(pin.beerCount)}</Text>
          <Text style={{ color: theme.colors.textMuted, fontWeight: "800", fontSize: 11 }}>beers</Text>
        </View>
        <Ionicons name="chevron-forward" color={theme.colors.iconSecondary} size={18} />
      </View>
    </Pressable>
  );
}

function PhotoStrip({ photos, onPhotoPress, theme }: { photos: PlacePhoto[]; onPhotoPress: (uri: string) => void; theme: AppTheme }) {
  return (
    <View style={{ marginTop: 16 }}>
      {photos.length ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={{ flexDirection: "row", gap: 8 }}>
            {photos.map((photo) => (
              <Pressable key={photo.id} onPress={() => onPhotoPress(photo.uri)} hitSlop={6}>
                <Image source={{ uri: photo.uri }} style={{ width: 72, height: 84, borderRadius: 14, backgroundColor: theme.colors.surfaceAlt }} resizeMode="cover" />
              </Pressable>
            ))}
          </View>
        </ScrollView>
      ) : (
        <View style={{ minHeight: 74, borderRadius: theme.radius.md, backgroundColor: theme.colors.surfaceAlt, borderWidth: 1, borderColor: theme.colors.cardBorder, alignItems: "center", justifyContent: "center", gap: 6 }}>
          <Ionicons name="images-outline" color={theme.colors.accent} size={21} />
          <Text style={{ color: theme.colors.textSecondary, fontWeight: "800", fontSize: 12 }}>No thumbnails yet</Text>
        </View>
      )}
    </View>
  );
}

function PassportStat({ label, value, theme }: { label: string; value: number; theme: AppTheme }) {
  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.card, borderWidth: 1, borderColor: theme.colors.cardBorder, borderRadius: theme.radius.lg, padding: 14, ...theme.shadow.card }}>
      <Text style={{ color: theme.colors.textPrimary, fontWeight: "900", fontSize: 23 }}>{formatNumber(value)}</Text>
      <Text style={{ color: theme.colors.textSecondary, fontWeight: "800", fontSize: 11, marginTop: 4 }}>{label}</Text>
    </View>
  );
}

function MiniMetric({ label, value, theme }: { label: string; value: number; theme: AppTheme }) {
  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.surfaceAlt, borderRadius: theme.radius.md, borderWidth: 1, borderColor: theme.colors.cardBorder, padding: 12 }}>
      <Text style={{ color: theme.colors.textPrimary, fontWeight: "900", fontSize: 21 }}>{formatNumber(value)}</Text>
      <Text style={{ color: theme.colors.textSecondary, fontWeight: "800", fontSize: 11, marginTop: 3 }}>{label}</Text>
    </View>
  );
}

function DateMetric({ label, value, theme }: { label: string; value: string; theme: AppTheme }) {
  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.surfaceAlt, borderRadius: theme.radius.md, borderWidth: 1, borderColor: theme.colors.cardBorder, padding: 12 }}>
      <Text style={{ color: theme.colors.textMuted, fontWeight: "800", fontSize: 11 }}>{label}</Text>
      <Text style={{ color: theme.colors.textPrimary, fontWeight: "900", marginTop: 4 }}>{value}</Text>
    </View>
  );
}

function SectionHeader({ title, detail, theme }: { title: string; detail?: string; theme: AppTheme }) {
  return (
    <View>
      <Text style={{ color: theme.colors.textPrimary, fontSize: 21, fontWeight: "900" }}>{title}</Text>
      {detail ? <Text style={{ color: theme.colors.textSecondary, marginTop: 4, lineHeight: 19 }}>{detail}</Text> : null}
    </View>
  );
}

function EmptyPassportCard({ title, body, actionLabel, onAction, theme }: { title: string; body: string; actionLabel: string; onAction: () => void; theme: AppTheme }) {
  return (
    <View style={cardStyle(theme, 18, theme.radius.lg)}>
      <Text style={{ color: theme.colors.textPrimary, fontWeight: "900", fontSize: 17 }}>{title}</Text>
      <Text style={{ color: theme.colors.textSecondary, lineHeight: 20, marginTop: 6 }}>{body}</Text>
      <Pressable onPress={onAction} style={primaryPill(theme)}>
        <Ionicons name="camera-outline" color={theme.colors.textOnPrimary} size={18} />
        <Text style={{ color: theme.colors.textOnPrimary, fontWeight: "900" }}>{actionLabel}</Text>
      </Pressable>
    </View>
  );
}

function cardStyle(theme: AppTheme, padding = 16, radius = theme.radius.lg) {
  return {
    backgroundColor: theme.colors.card,
    borderRadius: radius,
    borderWidth: 1,
    borderColor: theme.colors.cardBorder,
    padding,
    ...theme.shadow.card
  };
}

function primaryPill(theme: AppTheme) {
  return {
    alignSelf: "flex-start" as const,
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 8,
    backgroundColor: theme.colors.accent,
    borderRadius: theme.radius.pill,
    paddingHorizontal: 15,
    paddingVertical: 11,
    marginTop: 15
  };
}

function placeTitle(log: BeerCheckIn) {
  if (log.venueConfirmationStatus === "confirmed" && log.venueName?.trim()) return log.venueName.trim();
  const brewery = log.brewery?.trim();
  if (brewery && !["photo stamp", "beer log", "pintly log", "check-in"].some((value) => brewery.toLowerCase().includes(value))) return brewery;
  return broadPlaceLabel(log.location);
}

function hasNamedPlace(log: BeerCheckIn) {
  if (log.venueConfirmationStatus === "confirmed" && log.venueName?.trim()) return true;
  const brewery = log.brewery?.trim();
  return Boolean(brewery && !["photo stamp", "beer log", "pintly log", "check-in"].some((value) => brewery.toLowerCase().includes(value)));
}

function placeSubtitle(pin: PlacePin) {
  const cityState = [pin.city, pin.state].filter(Boolean).join(", ");
  if (cityState) return cityState;
  return pin.country || "Unknown location";
}

function cleanBeerName(log: BeerCheckIn) {
  const normalized = log.beerName.trim().toLowerCase();
  return ["photo stamp", "beer log"].includes(normalized) ? "Beer log" : log.beerName;
}

function placeKey(log: BeerCheckIn) {
  if (log.venueConfirmationStatus === "confirmed" && log.venueProvider && log.venueProviderPlaceId) {
    return `${log.venueProvider}-${log.venueProviderPlaceId}`;
  }
  return [placeTitle(log), log.location.city, log.location.state, log.location.country]
    .map((part) => part?.trim().toLowerCase().replace(/\s+/g, "-") || "unknown")
    .join("-");
}

function placeIdentity(log: BeerCheckIn, fallbackKey: string, index: number) {
  if (log.venueConfirmationStatus === "confirmed" && log.venueProvider && log.venueProviderPlaceId) return fallbackKey;
  return hasCoordinates(log) ? `gps-${fallbackKey}-${index}` : fallbackKey;
}

function placeLatitude(log: BeerCheckIn) {
  return log.venueConfirmationStatus === "confirmed" ? log.venueLatitude ?? log.location.latitude : log.location.latitude;
}

function placeLongitude(log: BeerCheckIn) {
  return log.venueConfirmationStatus === "confirmed" ? log.venueLongitude ?? log.location.longitude : log.location.longitude;
}

function photoFor(log: BeerCheckIn) {
  return buildCloudflareImageUrl(log.photoCloudflareImageId, "feed") ?? log.photoUrl ?? log.photoUri ?? log.photoThumbnailUrl ?? buildCloudflareImageUrl(log.photoCloudflareImageId, "thumbnail");
}

function PhotoPreviewModal({ uri, onClose, theme }: { uri: string | null; onClose: () => void; theme: AppTheme }) {
  return <ZoomablePhotoModal visible={Boolean(uri)} uri={uri} onClose={onClose} theme={theme} />;
}

function InlinePhotoPreview({ uri, onClose, theme }: { uri: string; onClose: () => void; theme: AppTheme }) {
  return <ZoomablePhotoModal visible uri={uri} onClose={onClose} theme={theme} />;
}

function formatVisitDate(iso: string) {
  return new Date(iso).toLocaleDateString([], { month: "short", year: "numeric" });
}

function localDateKey(iso: string) {
  const date = new Date(iso);
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function hasCoordinates(log: BeerCheckIn) {
  return typeof log.location.latitude === "number" && typeof log.location.longitude === "number";
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
