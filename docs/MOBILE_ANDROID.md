# Android Shell Setup

Vector Control Hub now includes a real Android shell foundation through Capacitor.

## What This Mobile Build Is

The current mobile path is:

`Android app UI -> desktop or LAN backend -> local WirePod -> Vector`

That means:

- the phone runs the interface
- your desktop or another local machine still runs the backend and WirePod
- this is the safest first mobile version because it preserves the working robot stack

## What You Need

- Node.js 20+
- Android Studio
- a working Java JDK
- Android SDK configured through Android Studio
- the desktop backend running on the same Wi-Fi network as your phone

## Helpful Commands

From the repo root:

```bash
npm run mobile:android:doctor
npm run mobile:android:prepare
npm run mobile:android:open
npm run mobile:android:debug
npm run mobile:android:release
npm run mobile:android:bundle
npm run mobile:android:smoke
```

What they do:

- `mobile:android:doctor`
  - checks for Java and Android SDK basics
- `mobile:android:prepare`
  - builds the web app and syncs it into the Android project
- `mobile:android:open`
  - opens the Android project in Android Studio
- `mobile:android:debug`
  - builds a debug APK
- `mobile:android:release`
  - builds a release APK
- `mobile:android:bundle`
  - builds the Android App Bundle for Play uploads
- `mobile:android:smoke`
  - installs the debug APK on the running emulator or device, launches the app, captures screenshot and logs, and fails if the app crashes on boot

For a Play-ready publish, use:

```bash
npm run mobile:android:bundle-release
```

That command now does three things automatically:

- bumps Android `versionCode`
- bumps Android `versionName`
- rebuilds and syncs the latest app files before creating the bundle
- creates a version-stamped `.aab` copy so it is easier to upload the newest file

## Build Outputs

After a successful build, the Android artifacts land here:

- Debug APK
  - `app/android/app/build/outputs/apk/debug/app-debug.apk`
- Release APK
  - `app/android/app/build/outputs/apk/release/app-release-unsigned.apk`
- Release bundle
  - `app/android/app/build/outputs/bundle/release/app-release.aab`
- Version-stamped release bundle
  - `app/android/app/build/outputs/bundle/release/Vector-Companion-0.1.39-260971915.aab`

The debug APK is the easiest artifact for local device testing.

For a quick live test on a running emulator:

```bash
npm run mobile:android:debug
npm run mobile:android:smoke
```

Smoke-test artifacts are written to:

- `artifacts/android-smoke/`

That folder includes:

- `screenshot.png`
- `ui-dump.xml`
- `logcat.txt`
- `summary.json`

The repo also now includes a scheduled GitHub Actions workflow named `Daily Android Smoke`.
It runs every day and uploads the same debug APK plus smoke-test artifacts so testers can grab a fresh build without waiting for a manual Play upload.

For the tester download flow, see:

- `docs/DAILY_TESTING.md`

By default, release outputs stay unsigned until you add your own upload keystore.

If you use `npm run mobile:android:bundle-release`, the repo now increments both values for you automatically before the Play bundle is built.

If you ever edit them by hand, the values still live in `app/android/app/build.gradle`:

- `versionCode` (must be strictly greater than last upload)
- `versionName` (human-readable release label)

Current Android release values in this repo:

- `versionCode 260971915`
- `versionName "0.1.39"`

If Play shows `Version code X has already been used`, only `versionCode` is too low; `versionName` can stay the same while testing, but we recommend bumping both together.

The repo now uses a safer automatic Play versioning strategy:

- Android `versionCode` uses a time-based floor in `YYDDDHHMM` format
- the bump script applies `max(current + 1, time-based floor)`
- that means release builds can auto-jump past already-used Play codes instead of only adding `+1`

## Release Signing For Play Console

1. Copy:
   - `app/android/keystore.properties.example`
   - to `app/android/keystore.properties`
2. Create or use an Android upload keystore.
3. Put the keystore file inside `app/android/`
4. Fill in:
   - `storeFile`
   - `storePassword`
   - `keyAlias`
   - `keyPassword`
5. Re-run:
   - `npm run mobile:android:release`
   - `npm run mobile:android:bundle`

The real `keystore.properties` file and `.jks` files are ignored by git on purpose.

## Internal Play Testing

Once the release bundle is signed, use this file for Google Play internal testing:

- `app/android/app/build/outputs/bundle/release/app-release.aab`
- or the version-stamped copy:
  - `app/android/app/build/outputs/bundle/release/Vector-Companion-0.1.39-260971915.aab`

Basic Play Console flow:

1. Open your app in Play Console.
2. Go to `Testing -> Internal testing`.
3. Create a release.
4. Upload the signed `.aab` file.
5. Add your tester emails or test group.
6. Roll out the internal test release.

For direct sideload testing on your own Android device, use:

- `app/android/app/build/outputs/apk/debug/app-debug.apk`
- or the signed `app/android/app/build/outputs/apk/release/app-release.apk`

## First Real Mobile Test

1. Start the desktop backend on your PC.
2. Keep your phone and PC on the same Wi-Fi.
3. Open the Android build of Vector Control Hub.
4. Let the app try backend auto-detection first.
5. If auto-detection does not lock in the right backend, open `Settings -> Mobile foundation`.
6. Save the desktop or LAN backend URL manually.
7. Return to the startup flow and connect to Vector.

## What Is New In 0.1.39

- added clearer trust-first health states across startup, dashboard, and diagnostics: bridge down, sdk flapping, robot asleep, or ready
- made quick repair more watchdog-aware so bridge recovery follows the detected failure pattern instead of one generic path
- reduced button clutter on key mobile screens so there is one more obvious primary action during reconnect and setup
- added a visible daily-use loop with recent wins, taught phrases, fun-command usage, and streak signals
- added ambient moment prompts and clearer premium personality-pack framing so Free feels complete and Pro feels more magical
- hardened Android prepare and Play bundle scripts by clearing stale Capacitor-generated folders automatically

Examples:

- `learn that movie time means play blackjack`
- `learn that sleepy buddy means snore`
- `list learned commands`
- `forget sleepy buddy`

## Honest Limits Right Now

- This is not a full phone-only Vector stack yet.
- WirePod still runs outside the phone.
- Bluetooth/Wi-Fi robot pairing still happens through the existing local stack.
- iOS is not wired up yet in the same practical way.

## Why Cleartext HTTP Is Enabled

The Android shell currently allows cleartext HTTP traffic because the desktop backend often lives at a local LAN address like:

`http://192.168.x.x:8787`

That is intentional for local-network control during this phase.
