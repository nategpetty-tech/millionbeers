export function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
}

export function percent(current: number, goal: number) {
  if (goal <= 0) return 0;
  return Math.min(100, Math.round((current / goal) * 100));
}

export function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.max(1, Math.round(diff / 60000));
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

export function broadPlaceLabel(location: { city?: string; state?: string; country?: string }) {
  const city = cleanPlacePart(location.city);
  const state = cleanPlacePart(location.state);
  const country = cleanPlacePart(location.country);
  const isUnitedStates = !country || ["us", "usa", "u.s.", "u.s.a.", "united states", "united states of america"].includes(country.toLowerCase());

  if (city && isUnitedStates && state) return `${city}, ${state}`;
  if (city && !isUnitedStates && country) return `${city}, ${country}`;
  if (city && state) return `${city}, ${state}`;
  if (city && country) return `${city}, ${country}`;
  return city || state || country || "Location hidden";
}

function cleanPlacePart(value?: string) {
  const trimmed = value?.trim();
  if (!trimmed || trimmed.toLowerCase() === "unknown") return undefined;
  return trimmed;
}

export function makeId(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function makeUuid() {
  const globalCrypto = globalThis.crypto as Crypto | undefined;
  if (globalCrypto?.randomUUID) {
    return globalCrypto.randomUUID();
  }

  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (char) => {
    const value = Math.floor(Math.random() * 16);
    const nibble = char === "x" ? value : (value & 0x3) | 0x8;
    return nibble.toString(16);
  });
}
