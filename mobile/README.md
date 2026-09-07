# Lidl Receipts — mobile app

A standalone **Android + iOS** app (one Expo / React Native codebase) that logs
into Lidl Plus, downloads your receipts, and lets you browse, search, and chart
them — **entirely on the device**. No server: it talks directly to the Lidl Plus
backend and stores everything in local SQLite, mirroring the logic of the
`lidlsearch` Go tool in this repo.

> ⚠️ **Unofficial.** Lidl Plus has no public API. This app mimics the official
> mobile app's login and endpoints (reverse-engineered by the community) and is
> intended for accessing **your own** account data only. Not affiliated with Lidl.

> ℹ️ **Android is the shipping platform.** iOS was verified on the iPhone 16 Pro
> simulator (iOS 18.6) in September 2026 — login, sync, search and the charts
> work there — but that is the extent of it: no device testing, no iOS release
> artefacts, and CI builds the Android APK only.

## Features

- **Sign in** with Lidl Plus (OAuth2 PKCE) via an in-app browser, with live sync.
- **Dashboard** — total/monthly spend, receipt & item counts, monthly bar chart.
- **Search** items accent-insensitively, with date and price filters.
- **Receipts** list + detail (line items, totals).
- **Price history** per product (unit price over time + every purchase).
- **Offline-first** — everything is read from local SQLite; only sync needs network.

## How it works

The reverse-engineered pieces are ported from the Go packages in `../internal`:

| Concern | File |
|---|---|
| OAuth2 PKCE login + token refresh | `src/lidl/auth.ts`, `src/auth/tokens.ts` |
| Authenticated tickets client (header quirks) | `src/lidl/client.ts` |
| `htmlPrintedReceipt` line-item parser | `src/lidl/htmlReceipt.ts` |
| Accent normalization + amount parsing | `src/lidl/normalize.ts` |
| Paging sync loop | `src/lidl/sync.ts` |
| Local store + queries (same schema as Go) | `src/db/*` |

Login intercepts the `com.lidlplus.app://callback?code=...` redirect **inside the
WebView** (rather than via OS deep links), because that scheme belongs to the
official Lidl app and OS routing is ambiguous when it is installed.

## Develop

```sh
cd mobile
npm install

# Type-check and run the parity tests (parser/normalizer match the Go tool):
npm run typecheck
npm test
```

Expo Go **cannot** run this app (it uses custom native modules — SQLite,
SecureStore, WebView — and a custom URL scheme). Use a dev build:

```sh
npx expo run:ios       # or: npx expo run:android   (local native build)
# or a cloud dev build:
npx eas build --profile development
```

## Releases

Pushing a `v*` tag builds a signed Android APK in CI and attaches it to the
GitHub release alongside the `lidlsearch` binaries — see
[`.github/workflows/release.yml`](../.github/workflows/release.yml). Users
install it by downloading the `.apk` and allowing installs from their browser.

### One-time signing setup

Android ties an app's identity to its signing key: an update must be signed with
the **same** key as the install it replaces, and a lost key means users have to
uninstall before they can update. Generate one and keep it somewhere permanent:

```sh
keytool -genkeypair -v -storetype PKCS12 \
  -keystore lidl-receipts-release.keystore \
  -alias lidl-receipts -keyalg RSA -keysize 4096 -validity 10000
```

Then add four repository secrets (Settings → Secrets and variables → Actions):

| Secret | Value |
|---|---|
| `ANDROID_KEYSTORE_BASE64` | `base64 -i lidl-receipts-release.keystore` |
| `ANDROID_KEYSTORE_PASSWORD` | the keystore password |
| `ANDROID_KEY_ALIAS` | `lidl-receipts` |
| `ANDROID_KEY_PASSWORD` | the key password |

The release job fails fast if they are missing, and verifies the finished APK is
not debug-signed, so a misconfigured run cannot publish an unupgradeable build.

`versionCode` is derived from the tag (`v1.2.3` → `10203`), so tags must only
ever increase — Android refuses to install a lower `versionCode` over a higher
one.

### Building an APK locally

```sh
npx expo prebuild --platform android
cd android && ./gradlew assembleRelease \
  -PreactNativeArchitectures=armeabi-v7a,arm64-v8a \
  -PLIDL_UPLOAD_STORE_FILE=/abs/path/lidl-receipts-release.keystore \
  -PLIDL_UPLOAD_STORE_PASSWORD=... \
  -PLIDL_UPLOAD_KEY_ALIAS=lidl-receipts \
  -PLIDL_UPLOAD_KEY_PASSWORD=...
# -> android/app/build/outputs/apk/release/app-release.apk
```

`reactNativeArchitectures` drops the emulator-only x86 libraries, roughly
halving the APK. Without the `LIDL_UPLOAD_*` properties the build falls back to
the debug keystore, which is fine for testing on your own device but not for
anything you hand out.
[`plugins/withAndroidRelease.js`](plugins/withAndroidRelease.js) keeps this
wiring — and the release-only ABI trim — in place across `expo prebuild` runs,
which regenerate `android/` from scratch.

### iOS

Verified on the iPhone 16 Pro simulator (iOS 18.6, Xcode 16.4) in September
2026: a `--configuration Release` build starts, signs in through the WebView,
and syncs — the previously-suspect spots (in-WebView interception of the
`com.lidlplus.app://callback` redirect, the natively embedded icon font,
`expo-secure-store` / `expo-sqlite` under the New Architecture) all behaved.

```sh
xcrun simctl create "Lidl Test" com.apple.CoreSimulator.SimDeviceType.iPhone-16-Pro \
  com.apple.CoreSimulator.SimRuntime.iOS-18-6
npx expo run:ios --device "Lidl Test" --configuration Release
```

Simulator-only though: never run on a real device, and nothing iOS ships.
`eas.json` carries `development`/`preview`/`production` profiles for
`npx eas build`, but iOS distribution needs a paid Apple Developer account and
is not wired into CI.

## Settings & data

- Country (2-letter Lidl code, default `HU`) and language (default `hu-HU`) are
  editable in **Settings**; they drive the API `Accept-Language` and login.
- Only the refresh token is kept in the device keychain (`expo-secure-store`);
  the access token lives in memory and is refreshed on demand.
- **Sign out & wipe** clears the token and the local receipt database.
