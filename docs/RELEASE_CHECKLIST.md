# Pintly Release Checklist

Use this checklist for each future TestFlight or App Store upload. GitHub tracks what was prepared and uploaded; EAS and App Store Connect still handle the build and submission.

## Before Building

1. Confirm the working tree is clean.

   ```sh
   git status --short
   ```

2. Print the current release info.

   ```sh
   npm run release:info
   ```

3. Run local checks.

   ```sh
   npm run release:check
   ```

4. Run Expo Doctor.

   ```sh
   npm run release:doctor
   ```

5. Bump `expo.ios.buildNumber` in `app.json`.

   Keep `expo.version` unchanged for TestFlight-only iteration unless the app version is intentionally changing.

6. Confirm app version and build number again.

   ```sh
   npm run release:info
   ```

7. Commit the release prep changes.

   ```sh
   git add app.json docs/RELEASES.md
   git commit -m "Prepare Pintly iOS build <build-number>"
   ```

8. Document the tag that will be created after the build commit is final.

   Tag format:

   ```sh
   pintly-ios-v1.0.0-build2
   ```

   Do not create the tag until you are sure the commit is the exact one used for the uploaded EAS build.

## Build And Submit

9. Run the EAS production iOS build.

   ```sh
   npm run release:ios-build
   ```

10. Record the EAS build ID or URL in `docs/RELEASES.md`.

11. Submit the latest successful build to Apple.

   ```sh
   npx eas-cli@latest submit --platform ios --profile production
   ```

12. Update `docs/RELEASES.md`:

   - Set `Submitted?`.
   - Set the TestFlight processing status.
   - Add known issues.
   - Add notes about what changed.

13. Confirm TestFlight processing in App Store Connect.

14. Install the TestFlight build and smoke test:

   - Sign up/sign in.
   - Log a beer with photo.
   - Confirm global count updates.
   - Confirm group feed updates.
   - Confirm photos load.

15. If external testing is needed, submit/add the build to the external tester group in App Store Connect and update `docs/RELEASES.md`.

## Optional Git Tag

After the build is uploaded and the commit is confirmed, create a tag:

```sh
git tag pintly-ios-v1.0.0-build2
git push origin pintly-ios-v1.0.0-build2
```

Do not create tags for builds that were not actually uploaded.

## GitHub Actions Recommendation

If GitHub Actions is added later, keep it read-only for release checks unless Apple credentials are intentionally configured and approved.

A safe future workflow could run:

```sh
npm ci
npm run typecheck
npx expo-doctor
```

Do not add workflows that build, deploy, submit to Apple, or access App Store Connect without explicit approval.
