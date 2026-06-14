import * as FileSystem from "expo-file-system/legacy";
import { compressBeerThumbnail } from "@/services/photoCompression";
import { supabase } from "@/services/supabase";

const beerPhotoBucketName = process.env.EXPO_PUBLIC_SUPABASE_PHOTO_BUCKET ?? "beer-photos";
const profilePhotoBucketName = process.env.EXPO_PUBLIC_SUPABASE_PROFILE_PHOTO_BUCKET ?? "profile-photos";
const groupBackdropBucketName = process.env.EXPO_PUBLIC_SUPABASE_GROUP_BACKDROP_BUCKET ?? "group-backdrops";

export type UploadedPhoto = {
  localUri: string;
  signedUrl: string;
  storagePath: string;
  thumbnailSignedUrl?: string;
  thumbnailStoragePath?: string;
};

export function isPhotoStorageConfigured() {
  return Boolean(supabase && beerPhotoBucketName);
}

export function isProfilePhotoStorageConfigured() {
  return Boolean(supabase && profilePhotoBucketName);
}

export function isGroupBackdropStorageConfigured() {
  return Boolean(supabase && groupBackdropBucketName);
}

export async function uploadCheckInPhoto(localUri: string, userId: string): Promise<UploadedPhoto> {
  const datePath = new Date().toISOString().slice(0, 10);
  const uploaded = await uploadPhoto(localUri, beerPhotoBucketName, `${userId}/${datePath}`);
  try {
    const thumbnail = await compressBeerThumbnail(localUri);
    const uploadedThumbnail = await uploadPhoto(thumbnail.uri, beerPhotoBucketName, `${userId}/${datePath}/thumbs`);
    return {
      ...uploaded,
      thumbnailSignedUrl: uploadedThumbnail.signedUrl,
      thumbnailStoragePath: uploadedThumbnail.storagePath
    };
  } catch {
    return uploaded;
  }
}

export async function uploadProfilePhoto(localUri: string, userId: string): Promise<UploadedPhoto> {
  return uploadPhoto(localUri, profilePhotoBucketName, userId);
}

export async function uploadGroupBackdrop(localUri: string, ownerId: string): Promise<UploadedPhoto> {
  return uploadPhoto(localUri, groupBackdropBucketName, ownerId);
}

export async function createSignedGroupBackdropUrl(storagePath: string) {
  return createSignedPhotoUrl(storagePath, groupBackdropBucketName);
}

export async function createSignedProfilePhotoUrl(storagePath: string) {
  return createSignedPhotoUrl(storagePath, profilePhotoBucketName);
}

async function uploadPhoto(localUri: string, bucketName: string, directory: string): Promise<UploadedPhoto> {
  if (!supabase) {
    throw new Error("Supabase Storage is not configured.");
  }

  const { data: sessionData } = await supabase.auth.getSession();
  if (!sessionData.session) {
    throw new Error("Sign in before uploading photos.");
  }

  const photoBytes = await uriToArrayBuffer(localUri);
  const extension = extensionForUri(localUri);
  const contentType = contentTypeForExtension(extension);
  const storagePath = `${directory}/${Date.now()}-${randomSuffix()}.${extension}`;

  const { error } = await supabase.storage.from(bucketName).upload(storagePath, photoBytes, {
    contentType,
    upsert: false
  });

  if (error) {
    throw error;
  }

  return {
    localUri,
    signedUrl: await createSignedPhotoUrl(storagePath, bucketName),
    storagePath
  };
}

export async function createSignedPhotoUrl(storagePath: string, bucketName = beerPhotoBucketName) {
  if (!supabase) return storagePath;
  const { data, error } = await supabase.storage.from(bucketName).createSignedUrl(storagePath, 60 * 60 * 24 * 7);
  if (error || !data?.signedUrl) {
    throw error ?? new Error("Could not create a signed photo URL.");
  }
  return data.signedUrl;
}

async function uriToArrayBuffer(uri: string) {
  if (uri.startsWith("file://")) {
    const base64 = await FileSystem.readAsStringAsync(uri, {
      encoding: FileSystem.EncodingType.Base64
    });
    return base64ToArrayBuffer(base64);
  }

  const response = await fetch(uri);
  if (!response.ok) {
    throw new Error("Could not read the captured photo.");
  }
  return response.arrayBuffer();
}

function base64ToArrayBuffer(base64: string) {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  const clean = base64.replace(/\s/g, "").replace(/=+$/, "");
  const bytes: number[] = [];

  for (let index = 0; index < clean.length; index += 4) {
    const encoded =
      (chars.indexOf(clean[index] ?? "A") << 18) |
      (chars.indexOf(clean[index + 1] ?? "A") << 12) |
      ((chars.indexOf(clean[index + 2] ?? "A") & 63) << 6) |
      (chars.indexOf(clean[index + 3] ?? "A") & 63);

    bytes.push((encoded >> 16) & 255);
    if (index + 2 < clean.length) bytes.push((encoded >> 8) & 255);
    if (index + 3 < clean.length) bytes.push(encoded & 255);
  }

  return new Uint8Array(bytes).buffer;
}

function extensionForUri(uri: string) {
  const extension = uri.split("?")[0]?.split(".").pop()?.toLowerCase();
  if (extension === "png" || extension === "webp" || extension === "heic") return extension;
  return "jpg";
}

function contentTypeForExtension(extension: string) {
  if (extension === "png") return "image/png";
  if (extension === "webp") return "image/webp";
  if (extension === "heic") return "image/heic";
  return "image/jpeg";
}

function randomSuffix() {
  return Math.random().toString(36).slice(2, 8);
}
