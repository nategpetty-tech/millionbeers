import AsyncStorage from "@react-native-async-storage/async-storage";
import { AppState } from "react-native";
import { uploadCheckInPhoto } from "@/services/photoStorage";

type QueuedUpload = {
  checkInId: string;
  localUri: string;
  userId: string;
  width?: number;
  height?: number;
  groupIds?: string[];
  attempts: number;
  nextAttemptAt: number;
  createdAt: number;
};

type UploadSuccess = {
  checkInId: string;
  photoUrl: string;
  photoStoragePath: string;
  photoThumbnailUrl?: string;
  photoThumbnailStoragePath?: string;
  photoCloudflareImageId?: string;
  photoImageWidth?: number;
  photoImageHeight?: number;
};

type UploadFailure = {
  checkInId: string;
  recoverable: boolean;
};

const STORAGE_KEY = "pintly.photoUploadQueue.v1";
const maxAttempts = 8;
const baseBackoffMs = 15_000;
let processing = false;
let queueTimer: ReturnType<typeof setTimeout> | undefined;
let onStartHandler: ((result: { checkInId: string }) => void) | undefined;
let onSuccessHandler: ((result: UploadSuccess) => void | Promise<void>) | undefined;
let onFailureHandler: ((result: UploadFailure) => void) | undefined;

export function configurePhotoUploadQueue(handlers: {
  onStart: (result: { checkInId: string }) => void;
  onSuccess: (result: UploadSuccess) => void | Promise<void>;
  onFailure: (result: UploadFailure) => void;
}) {
  onStartHandler = handlers.onStart;
  onSuccessHandler = handlers.onSuccess;
  onFailureHandler = handlers.onFailure;
  void processPhotoUploadQueue();
}

export function startPhotoUploadQueueLifecycle() {
  const subscription = AppState.addEventListener("change", (state) => {
    if (state === "active") {
      void processPhotoUploadQueue();
    }
  });
  void processPhotoUploadQueue();
  return () => {
    subscription.remove();
    if (queueTimer) clearTimeout(queueTimer);
  };
}

export async function enqueuePhotoUpload(input: { checkInId: string; localUri: string; userId: string; width?: number; height?: number; groupIds?: string[] }) {
  const queue = await readQueue();
  const existing = queue.find((item) => item.checkInId === input.checkInId);
  const now = Date.now();
  const nextQueue = existing
    ? queue.map((item) =>
        item.checkInId === input.checkInId
          ? {
              ...item,
              localUri: input.localUri,
              userId: input.userId,
              width: input.width,
              height: input.height,
              groupIds: input.groupIds,
              nextAttemptAt: now
            }
          : item
      )
    : [
        ...queue,
        {
          checkInId: input.checkInId,
          localUri: input.localUri,
          userId: input.userId,
          width: input.width,
          height: input.height,
          groupIds: input.groupIds,
          attempts: 0,
          nextAttemptAt: now,
          createdAt: now
        }
      ];
  await writeQueue(nextQueue);
  void processPhotoUploadQueue();
}

export async function processPhotoUploadQueue() {
  if (processing) return;
  processing = true;
  try {
    let queue = await readQueue();
    const now = Date.now();
    const ready = queue.filter((item) => item.nextAttemptAt <= now).sort((a, b) => a.createdAt - b.createdAt);
    if (!ready.length) {
      scheduleNext(queue);
      return;
    }

    for (const item of ready) {
      try {
        onStartHandler?.({ checkInId: item.checkInId });
        const uploaded = await uploadCheckInPhoto(item.localUri, item.userId, item.checkInId, { width: item.width, height: item.height }, item.groupIds);
        await onSuccessHandler?.({
          checkInId: item.checkInId,
          photoUrl: uploaded.signedUrl,
          photoStoragePath: uploaded.storagePath,
          photoThumbnailUrl: uploaded.thumbnailSignedUrl,
          photoThumbnailStoragePath: uploaded.thumbnailStoragePath,
          photoCloudflareImageId: uploaded.cloudflareImageId,
          photoImageWidth: uploaded.width,
          photoImageHeight: uploaded.height
        });
        queue = queue.filter((queued) => queued.checkInId !== item.checkInId);
        await writeQueue(queue);
      } catch {
        const attempts = item.attempts + 1;
        const recoverable = attempts < maxAttempts;
        queue = queue.map((queued) =>
          queued.checkInId === item.checkInId
            ? {
                ...queued,
                attempts,
                nextAttemptAt: Date.now() + retryDelay(attempts)
              }
            : queued
        );
        await writeQueue(queue);
        onFailureHandler?.({ checkInId: item.checkInId, recoverable });
      }
    }
    scheduleNext(queue);
  } finally {
    processing = false;
  }
}

async function readQueue() {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as QueuedUpload[]) : [];
  } catch {
    return [];
  }
}

async function writeQueue(queue: QueuedUpload[]) {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
}

function retryDelay(attempts: number) {
  return Math.min(30 * 60_000, baseBackoffMs * 2 ** Math.max(0, attempts - 1));
}

function scheduleNext(queue: QueuedUpload[]) {
  if (queueTimer) clearTimeout(queueTimer);
  const nextAt = queue.reduce<number | undefined>((next, item) => {
    if (typeof next === "undefined") return item.nextAttemptAt;
    return Math.min(next, item.nextAttemptAt);
  }, undefined);
  if (typeof nextAt === "undefined") return;
  queueTimer = setTimeout(() => {
    void processPhotoUploadQueue();
  }, Math.max(1000, nextAt - Date.now()));
}
