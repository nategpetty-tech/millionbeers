import { buildCloudflareImageUrl } from "@/services/photoStorage";
import { BeerCheckIn } from "@/types";

export type CheckInPhotoVariant = "thumbnail" | "feed" | "full";

export function checkInPhotoUrl(checkIn: BeerCheckIn, variant: CheckInPhotoVariant = "feed") {
  return checkInPhotoUrlCandidates(checkIn, variant)[0];
}

export function checkInPhotoUrlCandidates(checkIn: BeerCheckIn, variant: CheckInPhotoVariant = "feed") {
  const cloudflarePreferred = buildCloudflareImageUrl(checkIn.photoCloudflareImageId, variant);
  const cloudflareFeed = buildCloudflareImageUrl(checkIn.photoCloudflareImageId, "feed");
  const cloudflareThumbnail = buildCloudflareImageUrl(checkIn.photoCloudflareImageId, "thumbnail");
  return uniqueUrls([
    cloudflarePreferred,
    variant === "full" ? cloudflareFeed : undefined,
    checkIn.photoUrl,
    checkIn.photoUri,
    checkIn.photoThumbnailUrl,
    cloudflareThumbnail
  ]);
}

function uniqueUrls(urls: Array<string | undefined>) {
  const seen = new Set<string>();
  return urls.filter((url): url is string => {
    if (!url || seen.has(url)) return false;
    seen.add(url);
    return true;
  });
}
