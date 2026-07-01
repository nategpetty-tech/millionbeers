export const usernamePattern = /^[a-z0-9_]{3,20}$/;

export function normalizeUsername(value: string) {
  return value.trim().toLowerCase().replace(/^@+/, "");
}

export function usernameValidationError(value: string) {
  const username = normalizeUsername(value);
  if (!username) return "Choose a username.";
  if (username.length < 3) return "Username must be at least 3 characters.";
  if (username.length > 20) return "Username must be 20 characters or fewer.";
  if (!usernamePattern.test(username)) return "Use only lowercase letters, numbers, and underscores.";
  return undefined;
}

export const passwordRequirements = [
  { id: "length", label: "At least 8 characters", test: (value: string) => value.length >= 8 },
  { id: "lowercase", label: "One lowercase letter", test: (value: string) => /[a-z]/.test(value) },
  { id: "uppercase", label: "One uppercase letter", test: (value: string) => /[A-Z]/.test(value) },
  { id: "number", label: "One number", test: (value: string) => /\d/.test(value) },
  { id: "symbol", label: "One symbol", test: (value: string) => /[^A-Za-z0-9]/.test(value) }
] as const;

export function passwordValidationError(value: string) {
  const missing = passwordRequirements.find((requirement) => !requirement.test(value));
  return missing ? "Password does not meet all requirements." : undefined;
}

export function isStrongPassword(value: string) {
  return !passwordValidationError(value);
}
