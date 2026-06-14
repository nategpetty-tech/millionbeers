# Pintly Release History

This file is the source of truth for Pintly builds that are prepared for, submitted to, or processed by App Store Connect/TestFlight.

Update this table after every EAS production build and again after Apple/TestFlight processing changes state.

| Date | Commit | Version | iOS Build | EAS Profile | EAS Build | Submitted? | TestFlight Status | External Review | Notes |
| ---- | ------ | ------- | --------- | ----------- | --------- | ---------- | ----------------- | --------------- | ----- |
| 2026-06-06 | Unknown | 1.0.0 | 1 | production | Unknown | Yes, inferred | Processed, inferred | Unknown | Initial TestFlight upload. Known issue: build was missing Supabase public env values and showed the credentials-needed screen. |
| 2026-06-08 | TBD | 1.0.0 | 2 | production | TBD | TBD | TBD | TBD | Current prepared release config. Includes Pintly rename, Supabase public env values in EAS production profile, and New Architecture enabled for Reanimated. Replace `TBD` values after the EAS build/submit. |
| 2026-06-13 | TBD | 1.0.0 | 5 | production | TBD | TBD | TBD | Not submitted | Prepared external tester build with Home tab rename, hidden Challenges tab, and centered add-beer tab action. |
| 2026-06-14 | TBD | 1.0.0 | 6 | production | TBD | TBD | TBD | Not submitted | Prepared external tester build with build 5 UI updates, app icon refresh, onboarding/session stability fixes, profile avatar loading fixes, uncapped XP progress, quieter stamp sync state, and storage thumbnail/egress reductions. |
| 2026-06-14 | TBD | 1.0.0 | 7 | production | TBD | TBD | TBD | Not submitted | Release-candidate fix for auth/passport initialization race that could show onboarding and blank local history before the restored Supabase session was applied. |
| 2026-06-14 | TBD | 1.0.0 | 8 | production | TBD | TBD | TBD | Not submitted | Release-candidate fix so remote account history is not discarded when noncritical social/group snapshot queries fail. |
| 2026-06-14 | TBD | 1.0.0 | 9 | production | TBD | TBD | TBD | Not submitted | Release-candidate fix to always merge owner-scoped check-ins and memberships into the account snapshot so personal history does not depend on shared feed queries. |

## Status Definitions

- `Submitted?`: whether the EAS build was uploaded to App Store Connect with `eas submit`.
- `TestFlight Status`: use App Store Connect wording when possible, such as `Processing`, `Ready to Test`, or `Expired`.
- `External Review`: use `Not submitted`, `Waiting for Review`, `Approved`, or `Rejected`.

## Tag Convention

Use this tag format for the exact commit used by the uploaded EAS build:

```sh
pintly-ios-v1.0.0-build9
```

Do not create tags retroactively unless you are confident the tag points to the exact commit used for that uploaded build.
