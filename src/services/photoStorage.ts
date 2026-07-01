import { buildCloudflareImageUrl, deleteCloudflareImage, isCloudflareImagesConfigured, uploadImageToCloudflare } from "@/services/cloudflareImages";
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
  cloudflareImageId?: string;
  width?: number;
  height?: number;
};

export function isPhotoStorageConfigured() {
  return isCloudflareImagesConfigured();
}

export function isProfilePhotoStorageConfigured() {
  return isCloudflareImagesConfigured();
}

export function isGroupBackdropStorageConfigured() {
  return isCloudflareImagesConfigured();
}

export async function uploadCheckInPhoto(
  localUri: string,
  userId: string,
  checkInId?: string,
  size?: { width?: number; height?: number },
  groupIds?: string[]
): Promise<UploadedPhoto> {
  const uploaded = await uploadImageToCloudflare({
    localUri,
    imageType: "beer_photo",
    ownerUserId: userId,
    relatedCheckInId: checkInId,
    relatedGroupIds: groupIds,
    width: size?.width,
    height: size?.height
  });
  return {
    localUri,
    signedUrl: uploaded.imageUrl,
    storagePath: uploaded.cloudflareImageId,
    thumbnailSignedUrl: buildCloudflareImageUrl(uploaded.cloudflareImageId, "thumbnail"),
    thumbnailStoragePath: uploaded.cloudflareImageId,
    cloudflareImageId: uploaded.cloudflareImageId,
    width: uploaded.width,
    height: uploaded.height
  };
}

export async function uploadProfilePhoto(localUri: string, userId: string, size?: { width?: number; height?: number }): Promise<UploadedPhoto> {
  const uploaded = await uploadImageToCloudflare({
    localUri,
    imageType: "profile_avatar",
    ownerUserId: userId,
    width: size?.width,
    height: size?.height
  });
  return {
    localUri,
    signedUrl: uploaded.imageUrl,
    storagePath: uploaded.cloudflareImageId,
    cloudflareImageId: uploaded.cloudflareImageId,
    width: uploaded.width,
    height: uploaded.height
  };
}

export async function uploadGroupBackdrop(localUri: string, ownerId: string, groupId?: string, size?: { width?: number; height?: number }): Promise<UploadedPhoto> {
  const uploaded = await uploadImageToCloudflare({
    localUri,
    imageType: "group_image",
    ownerUserId: ownerId,
    relatedGroupId: groupId,
    width: size?.width,
    height: size?.height
  });
  return {
    localUri,
    signedUrl: uploaded.imageUrl,
    storagePath: uploaded.cloudflareImageId,
    cloudflareImageId: uploaded.cloudflareImageId,
    width: uploaded.width,
    height: uploaded.height
  };
}

export { buildCloudflareImageUrl, deleteCloudflareImage };

export async function createSignedGroupBackdropUrl(storagePath: string) {
  return createSignedPhotoUrl(storagePath, groupBackdropBucketName);
}

export async function createSignedProfilePhotoUrl(storagePath: string) {
  return createSignedPhotoUrl(storagePath, profilePhotoBucketName);
}

export async function createSignedPhotoUrl(storagePath: string, bucketName = beerPhotoBucketName) {
  if (!supabase) return storagePath;
  const { data, error } = await supabase.storage.from(bucketName).createSignedUrl(storagePath, 60 * 60 * 24 * 7);
  if (error || !data?.signedUrl) {
    throw error ?? new Error("Could not create a signed photo URL.");
  }
  return data.signedUrl;
}
