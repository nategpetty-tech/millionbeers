import * as FileSystem from "expo-file-system/legacy";
import { supabase } from "@/services/supabase";
import type { BeerScanBox } from "@/types";

export type { BeerScanBox };

export type BeerScanStatus = "confirmed" | "mismatch" | "uncertain" | "unavailable";

export type BeerScanResult = {
  detectedCount: number;
  confidence: number;
  claimedCount: number;
  status: BeerScanStatus;
  explanation: string;
  boxes: BeerScanBox[];
};

const defaultUnavailableScan: BeerScanResult = {
  detectedCount: 0,
  confidence: 0,
  claimedCount: 1,
  status: "unavailable",
  explanation: "Photo scanner is not configured yet.",
  boxes: []
};

export function isBeerPhotoScannerConfigured() {
  return Boolean(supabase);
}

export async function scanBeerPhoto(localUri: string, claimedCount: number): Promise<BeerScanResult> {
  if (!supabase) {
    return { ...defaultUnavailableScan, claimedCount };
  }

  const imageBase64 = await uriToBase64(localUri);
  const mimeType = contentTypeForUri(localUri);
  const { data, error } = await supabase.functions.invoke("scan-beer-photo", {
    body: {
      imageBase64,
      mimeType,
      claimedCount
    }
  });

  if (error) {
    throw error;
  }

  return normalizeScanResult(data, claimedCount);
}

function normalizeScanResult(data: unknown, claimedCount: number): BeerScanResult {
  const scan = data as Partial<BeerScanResult> | null;
  const detectedCount = clampCount(scan?.detectedCount);
  const confidence = clampConfidence(scan?.confidence);
  const status = normalizeStatus(scan?.status, detectedCount, claimedCount, confidence);
  return {
    detectedCount,
    confidence,
    claimedCount,
    status,
    explanation: typeof scan?.explanation === "string" && scan.explanation.trim() ? scan.explanation.trim() : explanationFor(status, detectedCount),
    boxes: normalizeBoxes((scan as { boxes?: unknown })?.boxes)
  };
}

function normalizeStatus(status: unknown, detectedCount: number, claimedCount: number, confidence: number): BeerScanStatus {
  if (status === "confirmed" || status === "mismatch" || status === "uncertain" || status === "unavailable") return status;
  if (confidence < 0.45 || detectedCount < 1) return "uncertain";
  return detectedCount === claimedCount ? "confirmed" : "mismatch";
}

function explanationFor(status: BeerScanStatus, detectedCount: number) {
  if (status === "confirmed") return "Scanner count matches your claimed beer count.";
  if (status === "mismatch") return `Scanner sees about ${detectedCount} beer${detectedCount === 1 ? "" : "s"} in the photo.`;
  if (status === "unavailable") return defaultUnavailableScan.explanation;
  return "Scanner could not confidently count the beers in this photo.";
}

async function uriToBase64(uri: string) {
  if (uri.startsWith("file://")) {
    return FileSystem.readAsStringAsync(uri, {
      encoding: FileSystem.EncodingType.Base64
    });
  }

  const response = await fetch(uri);
  if (!response.ok) {
    throw new Error("Could not read the selected photo.");
  }
  return arrayBufferToBase64(await response.arrayBuffer());
}

function arrayBufferToBase64(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary);
}

function contentTypeForUri(uri: string) {
  const extension = uri.split("?")[0]?.split(".").pop()?.toLowerCase();
  if (extension === "png") return "image/png";
  if (extension === "webp") return "image/webp";
  if (extension === "heic") return "image/heic";
  return "image/jpeg";
}

function clampCount(value: unknown) {
  const count = typeof value === "number" && Number.isFinite(value) ? Math.round(value) : 0;
  return Math.max(0, Math.min(24, count));
}

function clampConfidence(value: unknown) {
  const confidence = typeof value === "number" && Number.isFinite(value) ? value : 0;
  return Math.max(0, Math.min(1, confidence));
}

function normalizeBoxes(value: unknown): BeerScanBox[] {
  if (!Array.isArray(value)) return [];
  return value
    .slice(0, 24)
    .map((item) => {
      const box = item as Partial<BeerScanBox> | null;
      return {
        x: clampUnit(box?.x),
        y: clampUnit(box?.y),
        width: clampUnit(box?.width),
        height: clampUnit(box?.height),
        confidence: clampConfidence(box?.confidence),
        label: typeof box?.label === "string" && box.label.trim() ? box.label.trim() : "beer"
      };
    })
    .filter((box) => box.width > 0.02 && box.height > 0.02)
    .filter((box) => box.confidence >= 0.88)
    .filter((box) => isReasonableBeerShape(box));
}

function clampUnit(value: unknown) {
  const numeric = typeof value === "number" && Number.isFinite(value) ? value : 0;
  return Math.max(0, Math.min(1, numeric));
}

function isReasonableBeerShape(box: BeerScanBox) {
  const area = box.width * box.height;
  const aspectRatio = box.width > 0 ? box.height / box.width : 0;
  if (area > 0.22) return false;
  if (area < 0.0015) return false;
  if (aspectRatio < 0.45 || aspectRatio > 5.5) return false;
  return true;
}
