import { supabase } from "@/services/supabase";
import { VenueCandidate } from "@/types";

type SearchNearbyVenuesInput = {
  latitude: number;
  longitude: number;
  radiusMeters?: number;
  query?: string;
};

type SearchNearbyVenuesResponse = {
  venues?: VenueCandidate[];
};

export async function searchNearbyVenues(input: SearchNearbyVenuesInput): Promise<VenueCandidate[]> {
  if (supabase) {
    try {
      const { data, error } = await supabase.functions.invoke<SearchNearbyVenuesResponse>("search-nearby-venues", {
        body: input
      });
      if (error) throw error;

      const venues = normalizeCandidates(data?.venues ?? []);
      return venues;
    } catch (error) {
      console.warn("Nearby venue lookup failed", error);
    }
  }

  return [];
}

function normalizeCandidates(candidates: VenueCandidate[]) {
  return candidates
    .filter((candidate) => candidate.name?.trim() && candidate.provider && candidate.providerPlaceId)
    .map((candidate) => ({
      ...candidate,
      name: candidate.name.trim(),
      category: candidate.category?.trim() || undefined,
      address: candidate.address?.trim() || undefined,
      distanceMeters: typeof candidate.distanceMeters === "number" ? Math.round(candidate.distanceMeters) : undefined
    }))
    .sort((a, b) => (b.confidence ?? 0) - (a.confidence ?? 0) || (a.distanceMeters ?? Number.MAX_SAFE_INTEGER) - (b.distanceMeters ?? Number.MAX_SAFE_INTEGER));
}
