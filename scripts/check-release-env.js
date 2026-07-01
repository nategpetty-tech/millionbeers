if (process.env.EXPO_PUBLIC_SCREENSHOT_DEMO === "true") {
  console.error("EXPO_PUBLIC_SCREENSHOT_DEMO is enabled. Disable it before release builds.");
  process.exit(1);
}
