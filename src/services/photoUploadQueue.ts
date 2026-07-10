import AsyncStorage from "@react-native-async-storage/async-storage";
import { AppState } from "react-native";
import { uploadCheckInPhoto } from "@/services/photoStorage";

type UploadStage = "uploading_file" | "attaching_to_check_in";

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
  stage?: UploadStage;
  uploaded?: UploadSuccess;
  lastError?: string;
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
  stage: UploadStage;
  error: string;
};

const STORAGE_KEY = "pintly.photoUploadQueue.v1";
const maxAttempts = 8;
const baseBackoffMs = 15_000;
let processing = false;
let queueTimer: ReturnType<typeof setTimeout> | undefined;
let onStartHandler: ((result: { checkInId: string; stage: UploadStage }) => void) | undefined;
let onSuccessHandler: ((result: UploadSuccess) => void | Promise<void>) | undefined;
let onFailureHandler: ((result: UploadFailure) => void) | undefined;

export function configurePhotoUploadQueue(handlers: {
  onStart: (result: { checkInId: string; stage: UploadStage }) => void;
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
  if (existing && matchesUploadInput(existing, input)) {
    void processPhotoUploadQueue();
    return;
  }
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
              attempts: 0,
              stage: "uploading_file" as const,
              uploaded: undefined,
              lastError: undefined,
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
          createdAt: now,
          stage: "uploading_file" as const
        }
      ];
  await writeQueue(nextQueue);
  void processPhotoUploadQueue();
}

export async function cancelPhotoUpload(checkInId: string) {
  await removeQueueItem(checkInId);
}

export async function processPhotoUploadQueue() {
  if (processing) return;
  processing = true;
  try {
    const queue = await readQueue();
    const now = Date.now();
    const ready = queue.filter((item) => item.nextAttemptAt <= now).sort((a, b) => a.createdAt - b.createdAt);
    if (!ready.length) {
      scheduleNext(queue);
      return;
    }

    for (const item of ready) {
      const currentItem = await readQueueItem(item.checkInId);
      if (!currentItem || currentItem.nextAttemptAt > Date.now()) continue;
      const stage = currentItem.stage ?? "uploading_file";
      let failureStage = stage;
      try {
        onStartHandler?.({ checkInId: currentItem.checkInId, stage });
        const uploaded = stage === "attaching_to_check_in" && currentItem.uploaded ? currentItem.uploaded : await uploadAndPersist(currentItem);
        failureStage = "attaching_to_check_in";
        await onSuccessHandler?.(uploaded);
        await removeQueueItem(currentItem.checkInId);
      } catch (error) {
        const latestItem = (await readQueueItem(currentItem.checkInId)) ?? currentItem;
        await handleQueueFailure(latestItem, failureStage, error);
      }
    }
    scheduleNext(await readQueue());
  } finally {
    processing = false;
  }
}

async function uploadAndPersist(item: QueuedUpload): Promise<UploadSuccess> {
  const uploaded = await uploadCheckInPhoto(item.localUri, item.userId, item.checkInId, { width: item.width, height: item.height }, item.groupIds);
  const uploadResult = {
    checkInId: item.checkInId,
    photoUrl: uploaded.signedUrl,
    photoStoragePath: uploaded.storagePath,
    photoThumbnailUrl: uploaded.thumbnailSignedUrl,
    photoThumbnailStoragePath: uploaded.thumbnailStoragePath,
    photoCloudflareImageId: uploaded.cloudflareImageId,
    photoImageWidth: uploaded.width,
    photoImageHeight: uploaded.height
  };
  await updateQueueItem(item.checkInId, (queued) => ({
    ...queued,
    attempts: 0,
    stage: "attaching_to_check_in",
    uploaded: uploadResult,
    lastError: undefined,
    nextAttemptAt: Date.now()
  }));
  return uploadResult;
}

async function handleQueueFailure(item: QueuedUpload, stage: UploadStage, error: unknown) {
  const attempts = item.attempts + 1;
  const recoverable = attempts < maxAttempts;
  const message = errorMessage(error);
  if (recoverable) {
    await updateQueueItem(item.checkInId, (queued) => ({
      ...queued,
      attempts,
      stage,
      lastError: message,
      nextAttemptAt: Date.now() + retryDelay(attempts)
    }));
  } else {
    await removeQueueItem(item.checkInId);
  }
  onFailureHandler?.({ checkInId: item.checkInId, recoverable, stage, error: recoverable ? message : `Upload stopped after ${maxAttempts} tries: ${message}` });
}

async function readQueueItem(checkInId: string) {
  const queue = await readQueue();
  return queue.find((item) => item.checkInId === checkInId);
}

async function updateQueueItem(checkInId: string, updater: (item: QueuedUpload) => QueuedUpload) {
  const queue = await readQueue();
  const nextQueue = queue.map((item) => (item.checkInId === checkInId ? updater(item) : item));
  await writeQueue(nextQueue);
}

async function removeQueueItem(checkInId: string) {
  const queue = await readQueue();
  await writeQueue(queue.filter((item) => item.checkInId !== checkInId));
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

function errorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (typeof error === "object" && error && "message" in error && typeof error.message === "string") return error.message;
  return "Photo upload failed";
}

function matchesUploadInput(
  queued: QueuedUpload,
  input: { localUri: string; userId: string; width?: number; height?: number; groupIds?: string[] }
) {
  return (
    queued.localUri === input.localUri &&
    queued.userId === input.userId &&
    queued.width === input.width &&
    queued.height === input.height &&
    sameIds(queued.groupIds, input.groupIds)
  );
}

function sameIds(left?: string[], right?: string[]) {
  const leftIds = Array.from(new Set(left ?? [])).sort();
  const rightIds = Array.from(new Set(right ?? [])).sort();
  return leftIds.length === rightIds.length && leftIds.every((id, index) => id === rightIds[index]);
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
