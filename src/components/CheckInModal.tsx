import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Alert, Image, Keyboard, Modal, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { checkInLocationEnabled } from "@/config/features";
import { compressBeerPhoto } from "@/services/photoCompression";
import { isPhotoStorageConfigured } from "@/services/photoStorage";
import { enqueuePhotoUpload } from "@/services/photoUploadQueue";
import { searchNearbyVenues } from "@/services/venues";
import { usePassport } from "@/store/passportStore";
import { theme } from "@/theme";
import { CheckInVenueProvider, VenueCandidate, VenueConfirmationStatus, VenueSelectionStatus } from "@/types";

type Props = {
  visible: boolean;
  onClose: () => void;
  defaultGroupIds?: string[];
};

const emptyGroupIds: string[] = [];
const previewHeight = 168;
const locationLookupTimeoutMs = 8000;
const fallbackLocationLookupTimeoutMs = 3500;
const venueLookupTimeoutMs = 9000;
const maxLastKnownLocationAgeMs = 1000 * 60 * 5;
const maxLastKnownLocationAccuracyMeters = 250;
const unresolvedLocationCity = "Current location";

type VenueLookupStatus = "idle" | "loading" | "suggested" | "confirmed" | "skipped" | "unavailable" | "error";
type VenueUnavailableReason = "permission" | "no_venues" | "lookup";
type ResolvedStampLocation = {
  city: string;
  state?: string;
  country?: string;
};

export function CheckInModal({ visible, onClose, defaultGroupIds = emptyGroupIds }: Props) {
  const { checkInBeer, groups, user } = usePassport();
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [country, setCountry] = useState("");
  const [note, setNote] = useState("");
  const [photoUri, setPhotoUri] = useState<string | undefined>();
  const [photoSize, setPhotoSize] = useState<{ width: number; height: number } | undefined>();
  const [coordinates, setCoordinates] = useState<{ latitude: number; longitude: number } | undefined>();
  const [uploadStatus, setUploadStatus] = useState<"idle" | "uploading" | "uploaded" | "local" | "failed">("idle");
  const [cameraOpening, setCameraOpening] = useState(false);
  const [photoMessage, setPhotoMessage] = useState("");
  const [selectedGroups, setSelectedGroups] = useState<string[]>(defaultGroupIds);
  const [venueStatus, setVenueStatus] = useState<VenueLookupStatus>("idle");
  const [venueCandidates, setVenueCandidates] = useState<VenueCandidate[]>([]);
  const [suggestedVenue, setSuggestedVenue] = useState<VenueCandidate | null>(null);
  const [confirmedVenue, setConfirmedVenue] = useState<VenueCandidate | null>(null);
  const [venueSelectionStatus, setVenueSelectionStatus] = useState<VenueSelectionStatus | null>(null);
  const [userExplicitlySkippedVenue, setUserExplicitlySkippedVenue] = useState(false);
  const [venuePickerOpen, setVenuePickerOpen] = useState(false);
  const [venueUnavailableReason, setVenueUnavailableReason] = useState<VenueUnavailableReason | null>(null);
  const cameraLaunchedForSession = useRef(false);
  const submittingRef = useRef(false);
  const venueSearchId = useRef(0);
  const [submitting, setSubmitting] = useState(false);
  const canSubmit = uploadStatus !== "uploading" && !cameraOpening && !submitting && Boolean(photoUri);

  function automaticGroupIds() {
    const memberGroupIds = groups.filter((group) => group.members.some((member) => member.userId === user.id)).map((group) => group.id);
    return Array.from(new Set([...memberGroupIds, ...defaultGroupIds]));
  }

  useEffect(() => {
    if (!visible) {
      cameraLaunchedForSession.current = false;
      return;
    }

    if (visible) {
      reset();
      if (checkInLocationEnabled) void detectNearbyVenue();
      if (!cameraLaunchedForSession.current) {
        cameraLaunchedForSession.current = true;
        const timer = setTimeout(() => {
          void openCamera();
        }, 250);
        return () => clearTimeout(timer);
      }
    }
  }, [visible]);

  function reset() {
    setCity("");
    setState("");
    setCountry("");
    setNote("");
    setPhotoUri(undefined);
    setPhotoSize(undefined);
    setCoordinates(undefined);
    setUploadStatus("idle");
    setCameraOpening(false);
    submittingRef.current = false;
    setSubmitting(false);
    setPhotoMessage("");
    setSelectedGroups(automaticGroupIds());
    resetVenueSelection();
  }

  function closeModal() {
    if (submittingRef.current) return;
    reset();
    onClose();
  }

  async function openCamera() {
    if (cameraOpening || submitting) return;
    try {
      setCameraOpening(true);
      setPhotoMessage("");
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        setPhotoMessage("Camera access is off. Allow camera access or choose a photo from your library.");
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        quality: 0.72,
        exif: false,
        base64: false
      });

      if (!result.canceled && result.assets[0]?.uri) {
        void handleSelectedPhoto(result.assets[0].uri);
      } else if (!photoUri) {
        setPhotoMessage("No photo selected yet.");
      }
    } catch {
      setPhotoMessage("Camera did not finish. Try again or choose a photo from your library.");
    } finally {
      setCameraOpening(false);
    }
  }

  async function openLibrary() {
    if (cameraOpening || submitting) return;
    try {
      setCameraOpening(true);
      setPhotoMessage("");
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        setPhotoMessage("Photo library access is off. Allow photo access to choose an existing picture.");
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        quality: 0.78,
        exif: false,
        base64: false
      });

      if (!result.canceled && result.assets[0]?.uri) {
        void handleSelectedPhoto(result.assets[0].uri);
      } else if (!photoUri) {
        setPhotoMessage("No photo selected yet.");
      }
    } catch {
      setPhotoMessage("Photo picker did not finish. Try again in a moment.");
    } finally {
      setCameraOpening(false);
    }
  }

  async function handleSelectedPhoto(uri: string) {
    setPhotoMessage("Preparing photo...");
    const compressed = await compressBeerPhoto(uri);
    const preparedUri = compressed.uri;
    setPhotoUri(preparedUri);
    setPhotoSize(undefined);
    setUploadStatus("idle");
    setPhotoMessage("");
    Image.getSize(
      preparedUri,
      (width, height) => setPhotoSize({ width, height }),
      () => setPhotoSize(undefined)
    );
  }

  function resetVenueSelection() {
    venueSearchId.current += 1;
    setVenueStatus("idle");
    setVenueCandidates([]);
    setSuggestedVenue(null);
    setConfirmedVenue(null);
    setVenueSelectionStatus(null);
    setUserExplicitlySkippedVenue(false);
    setVenuePickerOpen(false);
    setVenueUnavailableReason(null);
  }

  async function detectNearbyVenue() {
    const searchId = venueSearchId.current + 1;
    venueSearchId.current = searchId;
    setVenueStatus("loading");
    setVenueCandidates([]);
    setSuggestedVenue(null);
    setConfirmedVenue(null);
    setVenueSelectionStatus(null);
    setUserExplicitlySkippedVenue(false);
    setVenueUnavailableReason(null);

    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (!permission.granted) {
        if (venueSearchId.current === searchId) {
          setVenueUnavailableReason("permission");
          setVenueStatus("unavailable");
        }
        return;
      }

      const position = await getBeerLogPosition();
      if (venueSearchId.current !== searchId) return;

      const nextCoordinates = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude
      };
      setCoordinates(nextCoordinates);
      void fillReverseGeocode(nextCoordinates);

      const candidates = await withTimeout(searchNearbyVenues(nextCoordinates), venueLookupTimeoutMs, "Venue lookup timed out.");
      if (venueSearchId.current !== searchId) return;

      const autoSuggestedVenue = autoSuggestedVenueCandidate(candidates);
      setVenueCandidates(candidates);
      setSuggestedVenue(autoSuggestedVenue);
      setVenueUnavailableReason(candidates[0] ? null : "no_venues");
      setVenueStatus(candidates[0] ? "suggested" : "unavailable");
    } catch {
      if (venueSearchId.current === searchId) {
        setVenueUnavailableReason("lookup");
        setVenueStatus("error");
      }
    }
  }

  async function getBeerLogPosition() {
    try {
      return await withTimeout(
        Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Highest
        }),
        locationLookupTimeoutMs,
        "Location lookup timed out."
      );
    } catch (locationError) {
      const lastKnownPosition = await withTimeout(
        Location.getLastKnownPositionAsync({
          maxAge: maxLastKnownLocationAgeMs,
          requiredAccuracy: maxLastKnownLocationAccuracyMeters
        }),
        fallbackLocationLookupTimeoutMs,
        "Fallback location lookup timed out."
      ).catch(() => null);

      if (lastKnownPosition) return lastKnownPosition;
      throw locationError;
    }
  }

  async function fillReverseGeocode(nextCoordinates: { latitude: number; longitude: number }) {
    try {
      const places = await Location.reverseGeocodeAsync(nextCoordinates);
      const place = places[0];
      const resolvedCity = cityFromGeocodePlace(place);
      if (resolvedCity) setCity((current) => current || resolvedCity);
      if (place?.region) setState((current) => current || place.region || "");
      if (place?.country) setCountry((current) => current || place.country || "");
    } catch {
      // Coordinates are still useful even when reverse geocoding is unavailable.
    }
  }

  async function resolveStampLocation(venue?: VenueCandidate): Promise<ResolvedStampLocation> {
    const venueCity = cleanPlacePart(venue?.city);
    const currentCity = cleanPlacePart(city);
    const venueState = cleanPlacePart(venue?.state);
    const currentState = cleanPlacePart(state);
    const venueCountry = cleanPlacePart(venue?.country);
    const currentCountry = cleanPlacePart(country);

    if (venueCity) {
      return {
        city: venueCity,
        state: venueState ?? currentState,
        country: venueCountry ?? currentCountry
      };
    }

    if (currentCity) {
      return {
        city: currentCity,
        state: currentState ?? venueState,
        country: currentCountry ?? venueCountry
      };
    }

    if (coordinates) {
      const reverseGeocodedLocation = await reverseGeocodeStampLocation(coordinates);
      if (reverseGeocodedLocation?.city) {
        setCity((existing) => existing || reverseGeocodedLocation.city);
        if (reverseGeocodedLocation.state) setState((existing) => existing || reverseGeocodedLocation.state || "");
        if (reverseGeocodedLocation.country) setCountry((existing) => existing || reverseGeocodedLocation.country || "");
        return {
          city: reverseGeocodedLocation.city,
          state: reverseGeocodedLocation.state ?? venueState ?? currentState,
          country: reverseGeocodedLocation.country ?? venueCountry ?? currentCountry
        };
      }
    }

    return {
      city: venueState ?? currentState ?? venueCountry ?? currentCountry ?? unresolvedLocationCity,
      state: venueState ?? currentState,
      country: venueCountry ?? currentCountry
    };
  }

  async function reverseGeocodeStampLocation(nextCoordinates: { latitude: number; longitude: number }): Promise<ResolvedStampLocation | null> {
    try {
      const places = await Location.reverseGeocodeAsync(nextCoordinates);
      const place = places[0];
      const resolvedCity = cityFromGeocodePlace(place);
      if (!resolvedCity) return null;
      return {
        city: resolvedCity,
        state: cleanPlacePart(place?.region),
        country: cleanPlacePart(place?.country)
      };
    } catch {
      return null;
    }
  }

  function selectChangedVenue(venue: VenueCandidate) {
    setConfirmedVenue(venue);
    setSuggestedVenue((current) => current ?? venue);
    setVenueSelectionStatus(!suggestedVenue || sameVenue(venue, suggestedVenue) ? "confirmed" : "changed");
    setUserExplicitlySkippedVenue(false);
    setVenueUnavailableReason(null);
    setVenueStatus("confirmed");
    setVenuePickerOpen(false);
  }

  function skipVenue() {
    setConfirmedVenue(null);
    setVenueSelectionStatus("skipped");
    setUserExplicitlySkippedVenue(true);
    setVenueUnavailableReason(null);
    setVenueStatus("skipped");
    setVenuePickerOpen(false);
  }

  async function submit() {
    if (submittingRef.current) return;
    if (!photoUri) {
      Alert.alert("Photo required", "Take a photo first so this stamp has an image attached.");
      return;
    }

    if (!isPhotoStorageConfigured()) {
      Alert.alert("Photo storage unavailable", "Cloudflare Images is not configured, so Pintly cannot save this photo stamp yet.");
      return;
    }

    submittingRef.current = true;
    setSubmitting(true);
    const localPhotoUri = photoUri;
    try {
      const finalVenue = finalVenueSelection({
        confirmedVenue,
        venueSelectionStatus,
        venueStatus,
        userExplicitlySkippedVenue,
        venueUnavailableReason
      });
      const stampLocation = checkInLocationEnabled ? await resolveStampLocation(finalVenue.venue) : { city: "" };
      const stampCity = stampLocation.city;
      const result = checkInBeer({
        beerName: "Beer log",
        quantity: 1,
        brewery: checkInLocationEnabled ? finalVenue.venue?.name ?? `Pintly log - ${stampCity}` : "Beer log",
        city: stampCity,
        state: stampLocation.state,
        country: stampLocation.country,
        note,
        groupIds: selectedGroups,
        photoUri: localPhotoUri,
        photoImageWidth: photoSize?.width,
        photoImageHeight: photoSize?.height,
        photoSyncStatus: "queued",
        countSource: "manual",
        latitude: checkInLocationEnabled ? coordinates?.latitude : undefined,
        longitude: checkInLocationEnabled ? coordinates?.longitude : undefined,
        venue: checkInLocationEnabled ? finalVenue.venue : undefined,
        venueProvider: finalVenue.provider,
        venueConfirmed: finalVenue.confirmed,
        venueConfirmationStatus: finalVenue.confirmationStatus,
        venueSelectionStatus: finalVenue.selectionStatus
      });
      void enqueuePhotoUpload({
        checkInId: result.checkIn.id,
        localUri: localPhotoUri,
        userId: user.id,
        width: photoSize?.width,
        height: photoSize?.height,
        groupIds: selectedGroups
      });
      if (result.completedChallenges.length) {
        const challengeNames = result.completedChallenges.map((challenge) => challenge.title).join(", ");
        const badgeNames = result.unlockedBadges.map((badge) => badge.title).join(", ");
        Alert.alert(
          "Challenge completed",
          `${challengeNames}${badgeNames ? `\n\nBadge unlocked: ${badgeNames}` : ""}`
        );
      } else {
        Alert.alert("Stamped", "1 beer added to Pintly. The photo will finish syncing in the background.");
      }
      submittingRef.current = false;
      setSubmitting(false);
      closeModal();
    } catch {
      submittingRef.current = false;
      setSubmitting(false);
      Alert.alert("Could not stamp beer", "Try again in a moment.");
    }
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={closeModal}>
      <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12 }}>
          <View>
            <Text style={{ color: theme.colors.primary, fontSize: 12, fontWeight: "900", letterSpacing: 2 }}>QUICK STAMP</Text>
            <Text style={{ color: theme.colors.textPrimary, fontSize: 28, fontWeight: "900", fontFamily: "Georgia" }}>Log a Beer</Text>
          </View>
          <Pressable onPress={closeModal} disabled={submitting} accessibilityRole="button" accessibilityLabel="Close beer log" style={{ padding: 8, opacity: submitting ? 0.45 : 1 }}>
            <Ionicons name="close" color={theme.colors.textPrimary} size={28} />
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 0, paddingBottom: 18, gap: 10 }} keyboardDismissMode="on-drag" keyboardShouldPersistTaps="handled">
          <Pressable
            onPress={() => void openCamera()}
            disabled={cameraOpening}
            style={{
              minHeight: 132,
              borderRadius: theme.radius.lg,
              overflow: "hidden",
              borderWidth: 1,
              borderColor: photoUri ? theme.colors.primary : theme.colors.cardBorder,
              backgroundColor: theme.colors.surface,
              alignItems: "center",
              justifyContent: "center"
            }}
          >
            {photoUri ? (
              <View style={{ width: "100%", height: previewHeight, backgroundColor: theme.colors.mediaBackdrop }}>
                <Image source={{ uri: photoUri }} style={{ width: "100%", height: "100%" }} resizeMode="contain" />
                <View
                  style={{
                    position: "absolute",
                    left: 12,
                    bottom: 12,
                    paddingHorizontal: 10,
                    paddingVertical: 6,
                    borderRadius: theme.radius.pill,
                    backgroundColor: theme.colors.mediaBackdropSoft,
                    borderWidth: 1,
                    borderColor: theme.colors.primary
                  }}
                >
                  <Text style={{ color: theme.colors.primary, fontWeight: "900", fontSize: 12 }}>{photoStatusCopy(uploadStatus, cameraOpening).toUpperCase()}</Text>
                </View>
              </View>
            ) : (
              <View style={{ alignItems: "center", padding: 16 }}>
                <View
                  style={{
                    width: 52,
                    height: 52,
                    borderRadius: 26,
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: theme.colors.primarySoft,
                    borderWidth: 1,
                    borderColor: theme.colors.primary
                  }}
                >
                  <Ionicons name="camera-outline" color={theme.colors.primary} size={26} />
                </View>
                <Text style={{ color: theme.colors.textPrimary, fontWeight: "900", marginTop: 8 }}>Beer photo</Text>
                <Text style={{ color: theme.colors.textSecondary, marginTop: 3, textAlign: "center", fontSize: 12 }}>{cameraOpening ? "Opening camera..." : "Take or choose a photo"}</Text>
              </View>
            )}
          </Pressable>
          {photoMessage ? (
            <View style={{ backgroundColor: theme.colors.card, borderRadius: theme.radius.md, borderWidth: 1, borderColor: theme.colors.cardBorder, padding: 12 }}>
              <Text style={{ color: theme.colors.textSecondary, lineHeight: 18 }}>{photoMessage}</Text>
            </View>
          ) : null}
          {checkInLocationEnabled ? (
            <NearbyVenueCard
              status={venueStatus}
              suggestedVenue={suggestedVenue}
              confirmedVenue={confirmedVenue}
              candidates={venueCandidates}
              candidateCount={venueCandidates.length}
              unavailableReason={venueUnavailableReason}
              onSelect={selectChangedVenue}
              onChooseAnother={() => setVenuePickerOpen(true)}
              onSkip={skipVenue}
              onAddVenue={() => {
                if (venueCandidates.length) setVenuePickerOpen(true);
                else void detectNearbyVenue();
              }}
            />
          ) : null}
          <Field label="Note" value={note} onChangeText={setNote} placeholder="Optional note" compact />
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 8,
              backgroundColor: theme.colors.card,
              borderRadius: theme.radius.md,
              borderWidth: 1,
              borderColor: theme.colors.cardBorder,
              paddingHorizontal: 11,
              paddingVertical: 9
            }}
          >
            <Ionicons name="people-outline" color={theme.colors.primary} size={18} />
            <Text numberOfLines={2} style={{ color: theme.colors.textSecondary, flex: 1, lineHeight: 16, fontSize: 12 }}>
              {selectedGroups.length
                ? `Automatically posts to ${selectedGroups.length} group${selectedGroups.length === 1 ? "" : "s"} you belong to.`
                : "Create or join a group to share stamps with your crew automatically."}
            </Text>
          </View>
          <View style={{ flexDirection: "row", gap: 10 }}>
            <Pressable
              onPress={() => void openCamera()}
              disabled={cameraOpening || submitting}
              style={{
                flex: 1,
                alignItems: "center",
                paddingVertical: 10,
                borderRadius: theme.radius.pill,
                backgroundColor: theme.colors.primarySoft,
                borderWidth: 1,
                borderColor: theme.colors.primary
              }}
            >
              <Text style={{ color: theme.colors.primary, fontWeight: "900" }}>{photoUri ? "Retake" : "Camera"}</Text>
            </Pressable>
            <Pressable
              onPress={() => void openLibrary()}
              disabled={cameraOpening || submitting}
              style={{
                flex: 1,
                alignItems: "center",
                paddingVertical: 10,
                borderRadius: theme.radius.pill,
                backgroundColor: theme.colors.card,
                borderWidth: 1,
                borderColor: theme.colors.cardBorder
              }}
            >
              <Text style={{ color: theme.colors.textPrimary, fontWeight: "900" }}>Choose Photo</Text>
            </Pressable>
          </View>
          <Pressable
            onPress={() => void submit()}
            disabled={!canSubmit}
            style={{
              backgroundColor: canSubmit ? theme.colors.primary : theme.colors.surfaceAlt,
              borderRadius: theme.radius.pill,
              paddingVertical: 13,
              alignItems: "center",
              marginTop: 2,
              marginBottom: 0
            }}
          >
            <Text style={{ color: canSubmit ? theme.colors.textOnPrimary : theme.colors.textMuted, fontWeight: "900", fontSize: 16 }}>
              {submitting ? "Stamping..." : uploadStatus === "uploading" ? "Uploading Photo..." : "Log Beer"}
            </Text>
          </Pressable>
        </ScrollView>
        {checkInLocationEnabled ? (
          <VenuePickerModal
            visible={venuePickerOpen}
            venues={venueCandidates.slice(0, 5)}
            coordinates={coordinates}
            onSelect={selectChangedVenue}
            onSkip={skipVenue}
            onClose={() => setVenuePickerOpen(false)}
          />
        ) : null}
      </View>
    </Modal>
  );
}

type FieldProps = {
  label: string;
  value: string;
  placeholder: string;
  onChangeText: (value: string) => void;
  keyboardType?: "default" | "decimal-pad";
  multiline?: boolean;
  compact?: boolean;
};

function photoStatusCopy(status: "idle" | "uploading" | "uploaded" | "local" | "failed", cameraOpening = false) {
  if (cameraOpening) return "Opening camera";
  if (status === "uploading") return "Uploading to Pintly storage";
  if (status === "uploaded") return "Photo uploaded to Pintly storage";
  if (status === "failed") return "Photo kept locally after upload failed";
  if (status === "local") return "Photo captured locally";
  return "Photo captured";
}

function NearbyVenueCard({
  status,
  suggestedVenue,
  confirmedVenue,
  candidates,
  candidateCount,
  unavailableReason,
  onSelect,
  onChooseAnother,
  onSkip,
  onAddVenue
}: {
  status: VenueLookupStatus;
  suggestedVenue: VenueCandidate | null;
  confirmedVenue: VenueCandidate | null;
  candidates: VenueCandidate[];
  candidateCount: number;
  unavailableReason: VenueUnavailableReason | null;
  onSelect: (venue: VenueCandidate) => void;
  onChooseAnother: () => void;
  onSkip: () => void;
  onAddVenue: () => void;
}) {
  const venue = confirmedVenue ?? suggestedVenue;
  const isLoading = status === "loading";
  const isConfirmed = status === "confirmed" && confirmedVenue;
  const isSkipped = status === "skipped";
  const isUnavailable = status === "unavailable" || status === "error";
  const recommendedVenues = status === "suggested" ? candidates.slice(0, 3) : [];

  return (
    <View
      style={{
        backgroundColor: theme.colors.card,
        borderRadius: theme.radius.lg,
        borderWidth: 1,
        borderColor: theme.colors.cardBorder,
        padding: 11,
        gap: 9
      }}
    >
      <View style={{ flexDirection: "row", gap: 10, alignItems: "flex-start" }}>
        <View
          style={{
            width: 30,
            height: 30,
            borderRadius: 15,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: theme.colors.primarySoft
          }}
        >
          {isConfirmed ? (
            <Ionicons name="checkmark" color={theme.colors.primary} size={18} />
          ) : isLoading ? (
            <ActivityIndicator color={theme.colors.primary} size="small" />
          ) : (
            <Ionicons name="location" color={theme.colors.primary} size={17} />
          )}
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ color: theme.colors.textPrimary, fontWeight: "900", fontSize: 15 }}>Nearby venue</Text>
          <Text numberOfLines={2} style={{ color: theme.colors.textSecondary, lineHeight: 17, marginTop: 3, fontSize: 13 }}>
            {venueCardBody(status, venue, unavailableReason)}
          </Text>
          {venue && (status === "suggested" || status === "confirmed") ? (
            <Text numberOfLines={1} style={{ color: theme.colors.textMuted, marginTop: 2, fontSize: 12 }}>{venueMeta(venue)}</Text>
          ) : null}
        </View>
      </View>

      {recommendedVenues.length ? (
        <View style={{ gap: 6 }}>
          {recommendedVenues.map((candidate, index) => {
            const highlighted = suggestedVenue ? sameVenue(candidate, suggestedVenue) : index === 0;
            return (
              <Pressable
                key={`${candidate.provider}:${candidate.providerPlaceId}`}
                onPress={() => onSelect(candidate)}
                style={({ pressed }) => ({
                  minHeight: 46,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 9,
                  borderRadius: theme.radius.md,
                  borderWidth: 1,
                  borderColor: highlighted ? theme.colors.primary : theme.colors.cardBorder,
                  backgroundColor: highlighted ? theme.colors.primarySoft : theme.colors.surfaceAlt,
                  paddingHorizontal: 10,
                  paddingVertical: 8,
                  opacity: pressed ? 0.78 : 1
                })}
              >
                <Ionicons name={highlighted ? "location" : "location-outline"} color={highlighted ? theme.colors.primary : theme.colors.iconSecondary} size={17} />
                <View style={{ flex: 1 }}>
                  <Text numberOfLines={1} style={{ color: theme.colors.textPrimary, fontWeight: "900", fontSize: 14 }}>{candidate.name}</Text>
                  <Text numberOfLines={1} style={{ color: theme.colors.textSecondary, marginTop: 2, fontSize: 12 }}>{venueMeta(candidate)}</Text>
                </View>
              </Pressable>
            );
          })}
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 12, paddingTop: 1 }}>
            <Pressable onPress={onChooseAnother} hitSlop={8} style={{ paddingVertical: 5 }}>
              <Text style={{ color: theme.colors.primary, fontWeight: "900" }}>{candidateCount > 3 ? `See all ${candidateCount}` : "Search"}</Text>
            </Pressable>
            <Pressable onPress={onSkip} hitSlop={8} style={{ paddingVertical: 5 }}>
              <Text style={{ color: theme.colors.textSecondary, fontWeight: "900" }}>Skip</Text>
            </Pressable>
          </View>
        </View>
      ) : null}

      {isConfirmed ? (
        <Pressable onPress={onChooseAnother} hitSlop={8} style={{ alignSelf: "flex-start", paddingVertical: 2 }}>
          <Text style={{ color: theme.colors.primary, fontWeight: "900" }}>Change</Text>
        </Pressable>
      ) : null}

      {isSkipped ? (
        <Pressable onPress={onAddVenue} hitSlop={8} style={{ alignSelf: "flex-start", paddingVertical: 2 }}>
          <Text style={{ color: theme.colors.primary, fontWeight: "900" }}>Add venue</Text>
        </Pressable>
      ) : null}

      {isUnavailable ? (
        <Pressable onPress={onAddVenue} hitSlop={8} style={{ alignSelf: "flex-start", paddingVertical: 2 }}>
          <Text style={{ color: theme.colors.primary, fontWeight: "900" }}>Try again</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function VenuePickerModal({
  visible,
  venues,
  coordinates,
  onSelect,
  onSkip,
  onClose
}: {
  visible: boolean;
  venues: VenueCandidate[];
  coordinates?: { latitude: number; longitude: number };
  onSelect: (venue: VenueCandidate) => void;
  onSkip: () => void;
  onClose: () => void;
}) {
  const [searchText, setSearchText] = useState("");
  const [searched, setSearched] = useState(false);
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<VenueCandidate[]>([]);
  const searchValue = searchText.trim();
  const displayedVenues = searched ? searchResults : venues;

  useEffect(() => {
    if (!visible) {
      setSearchText("");
      setSearched(false);
      setSearching(false);
      setSearchResults([]);
    }
  }, [visible]);

  async function searchVenueByName() {
    if (searchValue.length < 2) return;
    setSearching(true);
    setSearched(true);
    try {
      if (coordinates) {
        const results = await searchNearbyVenues({
          ...coordinates,
          query: searchValue,
          radiusMeters: 1200
        });
        setSearchResults(results.slice(0, 8));
      } else {
        setSearchResults(filterVenuesByQuery(venues, searchValue));
      }
    } finally {
      setSearching(false);
    }
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable onPress={onClose} style={{ flex: 1, justifyContent: "flex-end", backgroundColor: theme.colors.modalBackdrop }}>
        <Pressable
          onPress={(event) => event.stopPropagation()}
          style={{
            backgroundColor: theme.colors.card,
            borderTopLeftRadius: theme.radius.xl,
            borderTopRightRadius: theme.radius.xl,
            padding: 20,
            paddingBottom: 34,
            borderWidth: 1,
            borderColor: theme.colors.cardBorder,
            maxHeight: "78%"
          }}
        >
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
            <Text style={{ color: theme.colors.textPrimary, fontWeight: "900", fontSize: 22 }}>Choose venue</Text>
            <Pressable onPress={onClose} hitSlop={8} style={{ padding: 6 }}>
              <Ionicons name="close" color={theme.colors.textPrimary} size={24} />
            </Pressable>
          </View>

          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 8,
              marginTop: 12,
              borderWidth: 1,
              borderColor: theme.colors.cardBorder,
              borderRadius: theme.radius.pill,
              backgroundColor: theme.colors.surfaceAlt,
              paddingLeft: 12,
              paddingRight: 6,
              paddingVertical: 5
            }}
          >
            <Ionicons name="search" color={theme.colors.iconSecondary} size={18} />
            <TextInput
              value={searchText}
              onChangeText={(value) => {
                setSearchText(value);
                if (!value.trim()) {
                  setSearched(false);
                  setSearchResults([]);
                }
              }}
              placeholder="Search place name"
              placeholderTextColor={theme.colors.textMuted}
              autoCapitalize="words"
              returnKeyType="search"
              onSubmitEditing={() => void searchVenueByName()}
              style={{ flex: 1, color: theme.colors.textPrimary, paddingVertical: 7 }}
            />
            <Pressable
              onPress={() => void searchVenueByName()}
              disabled={searchValue.length < 2 || searching}
              style={{
                minWidth: 42,
                minHeight: 34,
                borderRadius: theme.radius.pill,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: searchValue.length >= 2 ? theme.colors.primary : theme.colors.card
              }}
            >
              {searching ? (
                <ActivityIndicator color={theme.colors.textOnPrimary} size="small" />
              ) : (
                <Text style={{ color: searchValue.length >= 2 ? theme.colors.textOnPrimary : theme.colors.textMuted, fontWeight: "900", fontSize: 12 }}>Go</Text>
              )}
            </Pressable>
          </View>

          <ScrollView style={{ marginTop: 12 }} contentContainerStyle={{ gap: 4, paddingBottom: 4 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator>
            {displayedVenues.length ? (
              displayedVenues.map((venue) => (
                <Pressable
                  key={`${venue.provider}:${venue.providerPlaceId}`}
                  onPress={() => onSelect(venue)}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 12,
                    paddingVertical: 13,
                    borderBottomWidth: 1,
                    borderBottomColor: theme.colors.cardBorder
                  }}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: theme.colors.textPrimary, fontWeight: "900", fontSize: 16 }}>{venue.name}</Text>
                    <Text style={{ color: theme.colors.textSecondary, marginTop: 4 }}>{venueMeta(venue)}</Text>
                    {venue.address ? <Text style={{ color: theme.colors.textMuted, marginTop: 3 }}>{venue.address}</Text> : null}
                  </View>
                  <Ionicons name="chevron-forward" color={theme.colors.iconSecondary} size={18} />
                </Pressable>
              ))
            ) : (
              <Text style={{ color: theme.colors.textSecondary, lineHeight: 20, paddingVertical: 14 }}>
                {searched ? "No matching places found nearby. Try another name or skip this venue." : "No nearby venues found. You can still log your beer."}
              </Text>
            )}
          </ScrollView>

          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 16, paddingTop: 16 }}>
            <Pressable onPress={onSkip} hitSlop={8} style={{ paddingVertical: 8 }}>
              <Text style={{ color: theme.colors.primary, fontWeight: "900" }}>Skip venue</Text>
            </Pressable>
            <Pressable onPress={onClose} hitSlop={8} style={{ paddingVertical: 8 }}>
              <Text style={{ color: theme.colors.textSecondary, fontWeight: "900" }}>Close</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message = "Request timed out."): Promise<T> {
  let timeout: ReturnType<typeof setTimeout>;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeout = setTimeout(() => reject(new Error(message)), timeoutMs);
  });
  return Promise.race([promise, timeoutPromise]).finally(() => clearTimeout(timeout));
}

function sameVenue(a: VenueCandidate, b: VenueCandidate) {
  return a.provider === b.provider && a.providerPlaceId === b.providerPlaceId;
}

function autoSuggestedVenueCandidate(candidates: VenueCandidate[]) {
  const [candidate, runnerUp] = candidates;
  if (!candidate) return null;

  const confidence = candidate.confidence ?? 0;
  const distanceMeters = candidate.distanceMeters ?? Number.MAX_SAFE_INTEGER;
  const runnerUpConfidence = runnerUp?.confidence ?? 0;
  const clearWinner = !runnerUp || confidence - runnerUpConfidence >= 0.08 || distanceMeters <= 75;
  const strongMatch = confidence >= 0.72 || (distanceMeters <= 120 && confidence >= 0.58) || (distanceMeters <= 45 && confidence >= 0.45);

  return strongMatch && clearWinner ? candidate : null;
}

function finalVenueSelection({
  confirmedVenue,
  venueSelectionStatus,
  venueStatus,
  userExplicitlySkippedVenue,
  venueUnavailableReason
}: {
  confirmedVenue: VenueCandidate | null;
  venueSelectionStatus: VenueSelectionStatus | null;
  venueStatus: VenueLookupStatus;
  userExplicitlySkippedVenue: boolean;
  venueUnavailableReason: VenueUnavailableReason | null;
}): {
  venue?: VenueCandidate;
  provider: CheckInVenueProvider;
  confirmed: boolean;
  confirmationStatus: VenueConfirmationStatus;
  selectionStatus: VenueSelectionStatus;
} {
  if (confirmedVenue) {
    return {
      venue: confirmedVenue,
      provider: confirmedVenue.provider,
      confirmed: true,
      confirmationStatus: "confirmed",
      selectionStatus: venueSelectionStatus === "changed" ? "changed" : "confirmed"
    };
  }

  if (
    userExplicitlySkippedVenue ||
    venueStatus === "idle" ||
    venueStatus === "loading" ||
    venueStatus === "suggested" ||
    venueStatus === "skipped" ||
    (venueStatus === "unavailable" && venueUnavailableReason === "no_venues")
  ) {
    return {
      provider: "skipped",
      confirmed: false,
      confirmationStatus: "skipped",
      selectionStatus: "skipped"
    };
  }

  return {
    provider: "unavailable",
    confirmed: false,
    confirmationStatus: "unavailable",
    selectionStatus: "unavailable"
  };
}

function venueCardBody(status: VenueLookupStatus, venue: VenueCandidate | null, unavailableReason: VenueUnavailableReason | null) {
  if (status === "loading" || status === "idle") return "Finding nearby places...";
  if (status === "confirmed" && venue) return `Venue confirmed: ${venue.name}`;
  if (status === "skipped") return "Venue skipped for this log.";
  if (status === "suggested") return "Pick the matching place below or search.";
  if (status === "error") return "Nearby venue lookup is unavailable. You can still log your beer.";
  if (unavailableReason === "no_venues") return "No nearby venues found. You can still log your beer.";
  return "Location permission is off. You can still log your beer.";
}

function venueMeta(venue: VenueCandidate) {
  const distance = typeof venue.distanceMeters === "number" ? `${Math.round(venue.distanceMeters)} m away` : undefined;
  return [distance, venue.category, venue.address].filter(Boolean).join(" · ") || "Nearby place";
}

function cleanPlacePart(value?: string | null) {
  const trimmed = value?.trim();
  if (!trimmed || trimmed.toLowerCase() === "unknown") return undefined;
  return trimmed;
}

function cityFromGeocodePlace(place?: { city?: string | null; district?: string | null; subregion?: string | null } | null) {
  return cleanPlacePart(place?.city) ?? cleanPlacePart(place?.district) ?? cleanPlacePart(place?.subregion);
}

function filterVenuesByQuery(venues: VenueCandidate[], query: string) {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return venues;
  return venues.filter((venue) =>
    [venue.name, venue.category, venue.address].some((value) => value?.toLowerCase().includes(normalizedQuery))
  );
}

function Field({ label, value, placeholder, onChangeText, keyboardType = "default", multiline, compact }: FieldProps) {
  return (
    <View style={{ flex: 1 }}>
      <Text style={{ color: theme.colors.textSecondary, fontWeight: "800", marginBottom: compact ? 5 : 7, fontSize: compact ? 12 : undefined }}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={theme.colors.textMuted}
        keyboardType={keyboardType}
        multiline={multiline && !compact}
        returnKeyType={multiline ? "done" : "default"}
        blurOnSubmit={multiline}
        onSubmitEditing={multiline ? Keyboard.dismiss : undefined}
        style={{
          minHeight: compact ? 42 : multiline ? 92 : 48,
          color: theme.colors.textPrimary,
          backgroundColor: theme.colors.card,
          borderWidth: 1,
          borderColor: theme.colors.cardBorder,
          borderRadius: theme.radius.md,
          paddingHorizontal: 12,
          paddingVertical: compact ? 9 : 12,
          textAlignVertical: multiline ? "top" : "center"
        }}
      />
    </View>
  );
}
