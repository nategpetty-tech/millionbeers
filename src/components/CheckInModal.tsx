import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import { useEffect, useRef, useState } from "react";
import { Alert, Image, Modal, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { ScanBoxesOverlay } from "@/components/ScanBoxesOverlay";
import { BeerScanResult, BeerScanStatus, isBeerPhotoScannerConfigured, scanBeerPhoto } from "@/services/beerPhotoScanner";
import { compressBeerPhoto } from "@/services/photoCompression";
import { isPhotoStorageConfigured, uploadCheckInPhoto } from "@/services/photoStorage";
import { usePassport } from "@/store/passportStore";
import { theme } from "@/theme";

type Props = {
  visible: boolean;
  onClose: () => void;
  defaultGroupIds?: string[];
};

const emptyGroupIds: string[] = [];
const previewHeight = 210;

export function CheckInModal({ visible, onClose, defaultGroupIds = emptyGroupIds }: Props) {
  const { checkInBeer, groups, user } = usePassport();
  const [quantity, setQuantity] = useState(1);
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [country, setCountry] = useState("");
  const [note, setNote] = useState("");
  const [photoUri, setPhotoUri] = useState<string | undefined>();
  const [photoSize, setPhotoSize] = useState<{ width: number; height: number } | undefined>();
  const [previewSize, setPreviewSize] = useState<{ width: number; height: number }>({ width: 0, height: previewHeight });
  const [coordinates, setCoordinates] = useState<{ latitude: number; longitude: number } | undefined>();
  const [uploadStatus, setUploadStatus] = useState<"idle" | "uploading" | "uploaded" | "local" | "failed">("idle");
  const [scanStatus, setScanStatus] = useState<"idle" | "scanning" | "scanned" | "failed" | "unavailable">("idle");
  const [beerScan, setBeerScan] = useState<BeerScanResult | undefined>();
  const [cameraOpening, setCameraOpening] = useState(false);
  const [photoMessage, setPhotoMessage] = useState("");
  const [selectedGroups, setSelectedGroups] = useState<string[]>(defaultGroupIds);
  const cameraLaunchedForSession = useRef(false);
  const canSubmit = uploadStatus !== "uploading" && scanStatus !== "scanning" && !cameraOpening && Boolean(photoUri);
  const resolvedScanStatus = beerScan ? scanStatusForQuantity(beerScan, quantity) : undefined;

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
      void captureLocation();
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
    setQuantity(1);
    setCity("");
    setState("");
    setCountry("");
    setNote("");
    setPhotoUri(undefined);
    setPhotoSize(undefined);
    setCoordinates(undefined);
    setUploadStatus("idle");
    setScanStatus("idle");
    setBeerScan(undefined);
    setCameraOpening(false);
    setPhotoMessage("");
    setSelectedGroups(automaticGroupIds());
  }

  function closeModal() {
    reset();
    onClose();
  }

  async function captureLocation() {
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (!permission.granted) {
        return;
      }
      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced
      });
      setCoordinates({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude
      });
      try {
        const places = await Location.reverseGeocodeAsync({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude
        });
        const place = places[0];
        if (place?.city) setCity((current) => current || place.city || "");
        if (place?.region) setState((current) => current || place.region || "");
        if (place?.country) setCountry((current) => current || place.country || "");
      } catch {
        // Coordinates are still useful even when reverse geocoding is unavailable.
      }
    } catch {
      // Check-ins still work without location.
    }
  }

  async function openCamera() {
    if (cameraOpening) return;
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
    if (cameraOpening) return;
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
    setBeerScan(undefined);
    setScanStatus(isBeerPhotoScannerConfigured() ? "scanning" : "unavailable");
    setPhotoMessage(isBeerPhotoScannerConfigured() ? "Scanning photo for beers..." : "Photo scanner is unavailable until Supabase is configured.");
    Image.getSize(
      preparedUri,
      (width, height) => setPhotoSize({ width, height }),
      () => setPhotoSize(undefined)
    );

    if (!isBeerPhotoScannerConfigured()) {
      return;
    }

    try {
      const scan = await scanBeerPhoto(preparedUri, quantity);
      setBeerScan(scan);
      setScanStatus(scan.status === "unavailable" ? "unavailable" : "scanned");
      if (scan.detectedCount > 0 && scan.confidence >= 0.5) {
        setQuantity(scan.detectedCount);
      }
      setPhotoMessage("");
    } catch {
      setScanStatus("failed");
      setPhotoMessage("Scanner could not inspect this photo. You can still set the count manually.");
    }
  }

  async function submit() {
    if (!photoUri) {
      Alert.alert("Photo required", "Take a photo first so this stamp has an image attached.");
      return;
    }

    let uploadedPhoto: { signedUrl: string; storagePath: string } | undefined;
    if (isPhotoStorageConfigured()) {
      try {
        setUploadStatus("uploading");
        uploadedPhoto = await uploadCheckInPhoto(photoUri, user.id);
        setUploadStatus("uploaded");
      } catch {
        setUploadStatus("failed");
        Alert.alert(
          "Photo upload failed",
          "The stamp was not logged because the photo could not upload. Try again so the photo appears in Pintly."
        );
        return;
      }
    } else {
      Alert.alert("Photo storage unavailable", "Supabase Storage is not configured, so Pintly cannot save this photo stamp yet.");
      return;
    }

    const stampCity = city.trim() || "Unknown";
    const result = checkInBeer({
      beerName: "Beer log",
      quantity,
      brewery: stampCity === "Unknown" ? "Pintly log" : `Pintly log - ${stampCity}`,
      city: stampCity,
      state,
      country,
      note,
      groupIds: selectedGroups,
      photoUri,
      photoUrl: uploadedPhoto?.signedUrl,
      photoStoragePath: uploadedPhoto?.storagePath,
      scannedBeerCount: beerScan?.detectedCount,
      scanConfidence: beerScan?.confidence,
      scanStatus: resolvedScanStatus,
      scanBoxes: beerScan?.boxes,
      countSource: resolvedScanStatus === "confirmed" ? "scanner" : "manual",
      latitude: coordinates?.latitude,
      longitude: coordinates?.longitude
    });
    if (result.completedChallenges.length) {
      const challengeNames = result.completedChallenges.map((challenge) => challenge.title).join(", ");
      const badgeNames = result.unlockedBadges.map((badge) => badge.title).join(", ");
      Alert.alert(
        "Challenge completed",
        `${challengeNames}${badgeNames ? `\n\nBadge unlocked: ${badgeNames}` : ""}`
      );
    } else {
      Alert.alert("Stamped", `${quantity} beer${quantity === 1 ? "" : "s"} added to Pintly.`);
    }
    closeModal();
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={closeModal}>
      <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 20 }}>
          <View>
            <Text style={{ color: theme.colors.gold, fontSize: 12, fontWeight: "900", letterSpacing: 2 }}>QUICK STAMP</Text>
            <Text style={{ color: theme.colors.text, fontSize: 28, fontWeight: "900", fontFamily: "Georgia" }}>Log a Beer</Text>
          </View>
          <Pressable onPress={closeModal} style={{ padding: 8 }}>
            <Ionicons name="close" color={theme.colors.text} size={28} />
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={{ padding: 20, paddingTop: 0, gap: 14 }}>
          <Pressable
            onPress={() => void openCamera()}
            disabled={cameraOpening}
            style={{
              minHeight: 168,
              borderRadius: theme.radius.lg,
              overflow: "hidden",
              borderWidth: 1,
              borderColor: photoUri ? theme.colors.neon : theme.colors.border,
              backgroundColor: theme.colors.surface,
              alignItems: "center",
              justifyContent: "center"
            }}
          >
            {photoUri ? (
              <View
                onLayout={(event) => {
                  const { width, height } = event.nativeEvent.layout;
                  setPreviewSize({ width, height });
                }}
                style={{ width: "100%", height: previewHeight, backgroundColor: "#050806" }}
              >
                <Image source={{ uri: photoUri }} style={{ width: "100%", height: "100%" }} resizeMode="contain" />
                <ScanBoxesOverlay boxes={beerScan?.boxes} photoSize={photoSize} previewSize={previewSize} />
                <View
                  style={{
                    position: "absolute",
                    left: 12,
                    bottom: 12,
                    paddingHorizontal: 10,
                    paddingVertical: 6,
                    borderRadius: theme.radius.pill,
                    backgroundColor: "rgba(0, 0, 0, 0.68)",
                    borderWidth: 1,
                    borderColor: theme.colors.neon
                  }}
                >
                  <Text style={{ color: theme.colors.neon, fontWeight: "900", fontSize: 12 }}>{photoStatusCopy(uploadStatus, cameraOpening).toUpperCase()}</Text>
                </View>
              </View>
            ) : (
              <View style={{ alignItems: "center", padding: 22 }}>
                <View
                  style={{
                    width: 62,
                    height: 62,
                    borderRadius: 31,
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: theme.colors.neonSoft,
                    borderWidth: 1,
                    borderColor: theme.colors.neon
                  }}
                >
                  <Ionicons name="camera-outline" color={theme.colors.neon} size={30} />
                </View>
                <Text style={{ color: theme.colors.text, fontWeight: "900", marginTop: 12 }}>Beer photo</Text>
                <Text style={{ color: theme.colors.muted, marginTop: 4, textAlign: "center" }}>{cameraOpening ? "Opening camera..." : "Take or choose a photo"}</Text>
              </View>
            )}
          </Pressable>
          {photoMessage ? (
            <View style={{ backgroundColor: theme.colors.card, borderRadius: theme.radius.md, borderWidth: 1, borderColor: theme.colors.border, padding: 12 }}>
              <Text style={{ color: theme.colors.muted, lineHeight: 18 }}>{photoMessage}</Text>
            </View>
          ) : null}
          <View
            style={{
              backgroundColor: theme.colors.card,
              borderRadius: theme.radius.lg,
              borderWidth: 1,
              borderColor: theme.colors.border,
              padding: 14,
              gap: 12
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: theme.colors.text, fontWeight: "900", fontSize: 16 }}>Beers in photo</Text>
                <Text style={{ color: theme.colors.muted, marginTop: 3 }}>Scanner suggests a count; adjust it if the photo is ambiguous.</Text>
              </View>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                <QuantityButton icon="remove" disabled={quantity <= 1} onPress={() => setQuantity((current) => Math.max(1, current - 1))} />
                <Text style={{ color: theme.colors.neon, fontWeight: "900", fontSize: 24, minWidth: 34, textAlign: "center" }}>{quantity}</Text>
                <QuantityButton icon="add" disabled={quantity >= 24} onPress={() => setQuantity((current) => Math.min(24, current + 1))} />
              </View>
            </View>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 10,
                backgroundColor: theme.colors.surface,
                borderRadius: theme.radius.md,
                borderWidth: 1,
                borderColor: theme.colors.border,
                padding: 12
              }}
            >
              <Ionicons name="scan-outline" color={theme.colors.gold} size={20} />
              <View style={{ flex: 1 }}>
                <Text style={{ color: theme.colors.text, fontWeight: "900" }}>{scanTitle(scanStatus, resolvedScanStatus)}</Text>
                <Text style={{ color: theme.colors.muted, marginTop: 2, lineHeight: 18 }}>{scanCopy(scanStatus, beerScan, quantity, resolvedScanStatus)}</Text>
              </View>
              <Text style={{ color: scanPillColor(scanStatus, resolvedScanStatus), fontWeight: "900", fontSize: 12 }}>
                {scanPill(scanStatus, resolvedScanStatus)}
              </Text>
            </View>
          </View>
          <Field label="Note" value={note} onChangeText={setNote} placeholder="Optional note" multiline />
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 10,
              backgroundColor: theme.colors.card,
              borderRadius: theme.radius.md,
              borderWidth: 1,
              borderColor: theme.colors.border,
              padding: 12
            }}
          >
            <Ionicons name="people-outline" color={theme.colors.neon} size={20} />
            <Text style={{ color: theme.colors.muted, flex: 1, lineHeight: 18 }}>
              {selectedGroups.length
                ? `Automatically posts to ${selectedGroups.length} group${selectedGroups.length === 1 ? "" : "s"} you belong to.`
                : "Create or join a group to share stamps with friends automatically."}
            </Text>
          </View>
          <View style={{ flexDirection: "row", gap: 10 }}>
            <Pressable
              onPress={() => void openCamera()}
              disabled={cameraOpening}
              style={{
                flex: 1,
                alignItems: "center",
                paddingVertical: 12,
                borderRadius: theme.radius.pill,
                backgroundColor: theme.colors.neonSoft,
                borderWidth: 1,
                borderColor: theme.colors.neon
              }}
            >
              <Text style={{ color: theme.colors.neon, fontWeight: "900" }}>{photoUri ? "Retake" : "Camera"}</Text>
            </Pressable>
            <Pressable
              onPress={() => void openLibrary()}
              disabled={cameraOpening}
              style={{
                flex: 1,
                alignItems: "center",
                paddingVertical: 12,
                borderRadius: theme.radius.pill,
                backgroundColor: theme.colors.card,
                borderWidth: 1,
                borderColor: theme.colors.border
              }}
            >
              <Text style={{ color: theme.colors.text, fontWeight: "900" }}>Choose Photo</Text>
            </Pressable>
          </View>
          <Pressable
            onPress={() => void submit()}
            disabled={!canSubmit}
            style={{
              backgroundColor: canSubmit ? theme.colors.neon : theme.colors.cardSoft,
              borderRadius: theme.radius.pill,
              paddingVertical: 16,
              alignItems: "center",
              marginTop: 8,
              marginBottom: 30
            }}
          >
            <Text style={{ color: canSubmit ? theme.colors.ink : theme.colors.dim, fontWeight: "900", fontSize: 16 }}>
              {uploadStatus === "uploading" ? "Uploading Photo..." : "Log Beer"}
            </Text>
          </Pressable>
        </ScrollView>
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
};

function QuantityButton({ icon, disabled, onPress }: { icon: "add" | "remove"; disabled: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={{
        width: 38,
        height: 38,
        borderRadius: 19,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: disabled ? theme.colors.cardSoft : theme.colors.neonSoft,
        borderWidth: 1,
        borderColor: disabled ? theme.colors.border : theme.colors.neon
      }}
    >
      <Ionicons name={icon} color={disabled ? theme.colors.dim : theme.colors.neon} size={22} />
    </Pressable>
  );
}

function photoStatusCopy(status: "idle" | "uploading" | "uploaded" | "local" | "failed", cameraOpening = false) {
  if (cameraOpening) return "Opening camera";
  if (status === "uploading") return "Uploading to Pintly storage";
  if (status === "uploaded") return "Photo uploaded to Pintly storage";
  if (status === "failed") return "Photo kept locally after upload failed";
  if (status === "local") return "Photo captured locally";
  return "Photo captured";
}

function scanStatusForQuantity(scan: BeerScanResult, quantity: number): BeerScanStatus {
  if (scan.status === "unavailable") return "unavailable";
  if (scan.confidence < 0.45 || scan.detectedCount < 1) return "uncertain";
  return scan.detectedCount === quantity ? "confirmed" : "mismatch";
}

function scanTitle(status: "idle" | "scanning" | "scanned" | "failed" | "unavailable", resolvedStatus?: BeerScanStatus) {
  if (status === "scanning") return "Scanning photo";
  if (status === "failed") return "Scanner needs review";
  if (status === "unavailable" || resolvedStatus === "unavailable") return "Scanner unavailable";
  if (resolvedStatus === "confirmed") return "Count confirmed";
  if (resolvedStatus === "mismatch") return "Count needs a look";
  if (resolvedStatus === "uncertain") return "Scanner is unsure";
  return "Photo scanner";
}

function scanCopy(
  status: "idle" | "scanning" | "scanned" | "failed" | "unavailable",
  scan: BeerScanResult | undefined,
  quantity: number,
  resolvedStatus?: BeerScanStatus
) {
  if (status === "idle") return "Choose or take a photo and Pintly will estimate how many beers are visible.";
  if (status === "scanning") return "Counting visible cans, bottles, and pours...";
  if (status === "failed") return "Scanner could not inspect this photo. Set the count manually before logging.";
  if (status === "unavailable" || resolvedStatus === "unavailable") {
    return scan?.explanation || "Scanner is unavailable right now. You can still set the count manually.";
  }
  if (!scan) return "Scanner result is not available.";
  const confidence = `${Math.round(scan.confidence * 100)}%`;
  if (resolvedStatus === "confirmed") return `Scanner sees ${quantity} beer${quantity === 1 ? "" : "s"} with ${confidence} confidence.`;
  if (resolvedStatus === "mismatch") {
    return `Scanner sees about ${scan.detectedCount} beer${scan.detectedCount === 1 ? "" : "s"} with ${confidence} confidence. Your manual count is ${quantity}.`;
  }
  return scan.explanation || "Scanner could not confidently count the beers in this photo.";
}

function scanPill(status: "idle" | "scanning" | "scanned" | "failed" | "unavailable", resolvedStatus?: BeerScanStatus) {
  if (status === "scanning") return "SCAN";
  if (status === "failed") return "REVIEW";
  if (status === "unavailable" || resolvedStatus === "unavailable") return "OFF";
  if (resolvedStatus === "confirmed") return "OK";
  if (resolvedStatus === "mismatch") return "CHECK";
  if (resolvedStatus === "uncertain") return "LOW";
  return "READY";
}

function scanPillColor(status: "idle" | "scanning" | "scanned" | "failed" | "unavailable", resolvedStatus?: BeerScanStatus) {
  if (status === "failed" || status === "unavailable" || resolvedStatus === "mismatch" || resolvedStatus === "unavailable") return theme.colors.gold;
  if (resolvedStatus === "confirmed") return theme.colors.neon;
  return theme.colors.dim;
}

function Field({ label, value, placeholder, onChangeText, keyboardType = "default", multiline }: FieldProps) {
  return (
    <View style={{ flex: 1 }}>
      <Text style={{ color: theme.colors.muted, fontWeight: "800", marginBottom: 7 }}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={theme.colors.dim}
        keyboardType={keyboardType}
        multiline={multiline}
        style={{
          minHeight: multiline ? 92 : 48,
          color: theme.colors.text,
          backgroundColor: theme.colors.card,
          borderWidth: 1,
          borderColor: theme.colors.border,
          borderRadius: theme.radius.md,
          paddingHorizontal: 14,
          paddingVertical: 12,
          textAlignVertical: multiline ? "top" : "center"
        }}
      />
    </View>
  );
}
