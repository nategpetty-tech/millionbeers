import * as FileSystem from "expo-file-system/legacy";
import { supabase } from "@/services/supabase";

export type CloudflareImageVariant = "avatar" | "thumbnail" | "feed" | "full";

export type CloudflareImageType = "beer_photo" | "profile_avatar" | "group_image";

export type CloudflareImageMetadata = {
  cloudflareImageId: string;
  imageUrl: string;
  width?: number;
  height?: number;
  blurhash?: string;
};

type DirectUploadResponse = {
  id: string;
  uploadURL: string;
};

const accountHash = process.env.EXPO_PUBLIC_CLOUDFLARE_IMAGES_ACCOUNT_HASH;
const deliveryBaseUrl = process.env.EXPO_PUBLIC_CLOUDFLARE_IMAGES_DELIVERY_BASE_URL;
const maxUploadBytes = 10 * 1024 * 1024;

export function isCloudflareImagesConfigured() {
  return Boolean(supabase && (accountHash || deliveryBaseUrl));
}

export function buildCloudflareImageUrl(imageId: string | undefined, variant: CloudflareImageVariant = "feed") {
  if (!imageId) return undefined;
  const trimmedBase = deliveryBaseUrl?.replace(/\/+$/, "");
  if (trimmedBase) return `${trimmedBase}/${imageId}/${variant}`;
  if (!accountHash) return undefined;
  return `https://imagedelivery.net/${accountHash}/${imageId}/${variant}`;
}

export async function uploadImageToCloudflare(input: {
  localUri: string;
  imageType: CloudflareImageType;
  ownerUserId: string;
  relatedCheckInId?: string;
  relatedGroupId?: string;
  relatedGroupIds?: string[];
  width?: number;
  height?: number;
}): Promise<CloudflareImageMetadata> {
  if (!supabase) throw new Error("Supabase is not configured.");
  if (!isCloudflareImagesConfigured()) throw new Error("Cloudflare Images is not configured.");

  const fileInfo = await FileSystem.getInfoAsync(input.localUri);
  if (fileInfo.exists && typeof fileInfo.size === "number" && fileInfo.size > maxUploadBytes) {
    throw new Error("Image is too large.");
  }

  const contentType = contentTypeForUri(input.localUri);
  if (!contentType.startsWith("image/")) throw new Error("Only image uploads are supported.");

  const directUpload = await createDirectUpload({
    imageType: input.imageType,
    ownerUserId: input.ownerUserId,
    relatedCheckInId: input.relatedCheckInId,
    relatedGroupId: input.relatedGroupId,
    relatedGroupIds: input.relatedGroupIds,
    contentType,
    fileSize: fileInfo.exists && typeof fileInfo.size === "number" ? fileInfo.size : undefined,
    width: input.width,
    height: input.height
  });

  await uploadLocalFile(directUpload.uploadURL, input.localUri, contentType);

  const imageUrl = buildCloudflareImageUrl(directUpload.id, variantForType(input.imageType)) ?? directUpload.id;
  await recordImageMetadata({
    cloudflareImageId: directUpload.id,
    imageUrl,
    imageType: input.imageType,
    ownerUserId: input.ownerUserId,
    relatedCheckInId: input.relatedCheckInId,
    relatedGroupId: input.relatedGroupId,
    width: input.width,
    height: input.height
  });

  return {
    cloudflareImageId: directUpload.id,
    imageUrl,
    width: input.width,
    height: input.height
  };
}

export async function deleteCloudflareImage(imageId: string | undefined) {
  if (!imageId || !supabase) return;
  const { error } = await supabase.functions.invoke("delete-cloudflare-image", {
    body: { imageId }
  });
  if (error) throw error;
}

async function createDirectUpload(input: {
  imageType: CloudflareImageType;
  ownerUserId: string;
  relatedCheckInId?: string;
  relatedGroupId?: string;
  relatedGroupIds?: string[];
  contentType: string;
  fileSize?: number;
  width?: number;
  height?: number;
}) {
  const { data, error } = await supabase!.functions.invoke("create-cloudflare-image-upload", {
    body: input
  });
  if (error) throw error;
  const response = data as Partial<DirectUploadResponse> | null;
  if (!response?.id || !response.uploadURL) throw new Error("Cloudflare upload URL was not returned.");
  return { id: response.id, uploadURL: response.uploadURL };
}

async function uploadLocalFile(uploadURL: string, localUri: string, contentType: string) {
  const formData = new FormData();
  formData.append("file", {
    uri: localUri,
    name: `pintly-${Date.now()}.${extensionForContentType(contentType)}`,
    type: contentType
  } as unknown as Blob);

  const response = await fetch(uploadURL, {
    method: "POST",
    body: formData
  });
  if (!response.ok) {
    throw new Error(`Cloudflare image upload failed with ${response.status}.`);
  }
}

async function recordImageMetadata(input: {
  cloudflareImageId: string;
  imageUrl: string;
  imageType: CloudflareImageType;
  ownerUserId: string;
  relatedCheckInId?: string;
  relatedGroupId?: string;
  width?: number;
  height?: number;
}) {
  if (!supabase) return;
  await supabase.from("image_uploads").upsert(
    {
      cloudflare_image_id: input.cloudflareImageId,
      image_type: input.imageType,
      owner_user_id: input.ownerUserId,
      check_in_id: input.relatedCheckInId ?? null,
      group_id: input.relatedGroupId ?? null,
      width: input.width ?? null,
      height: input.height ?? null,
      delivery_url: input.imageUrl
    },
    { onConflict: "cloudflare_image_id" }
  );
}

function contentTypeForUri(uri: string) {
  const extension = uri.split("?")[0]?.split(".").pop()?.toLowerCase();
  if (extension === "png") return "image/png";
  if (extension === "webp") return "image/webp";
  if (extension === "heic") return "image/heic";
  if (extension === "heif") return "image/heif";
  return "image/jpeg";
}

function extensionForContentType(contentType: string) {
  if (contentType === "image/png") return "png";
  if (contentType === "image/webp") return "webp";
  if (contentType === "image/heic") return "heic";
  if (contentType === "image/heif") return "heif";
  return "jpg";
}

function variantForType(imageType: CloudflareImageType): CloudflareImageVariant {
  if (imageType === "profile_avatar") return "avatar";
  if (imageType === "group_image") return "feed";
  return "feed";
}
