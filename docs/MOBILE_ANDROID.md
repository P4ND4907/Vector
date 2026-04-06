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

## Build Outputs

After a successful build, the Android artifacts land here:

- Debug APK
  - `app/android/app/build/outputs/apk/debug/app-debug.apk`
- Release APK
  - `app/android/app/build/outputs/apk/release/app-release-unsigned.apk`
- Release bundle
  - `app/android/app/build/outputs/bundle/release/app-release.aab`

The debug APK is the easiest artifact for local device testing.

By default, release outputs stay unsigned until you add your own upload keystore.

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
3. Open the desktop app and go to `Settings -> Mobile foundation`.
4. Copy one of the suggested LAN backend URLs.
5. Open the Android build of Vector Control Hub.
6. In the mobile app, open `Settings -> Mobile foundation`.
7. Save the LAN backend URL.
8. Return to the startup screen and connect to Vector.

## Honest Limits Right Now

- This is not a full phone-only Vector stack yet.
- WirePod still runs outside the phone.
- Bluetooth/Wi-Fi robot pairing still happens through the existing local stack.
- iOS is not wired up yet in the same practical way.

## Why Cleartext HTTP Is Enabled

The Android shell currently allows cleartext HTTP traffic because the desktop backend often lives at a local LAN address like:

`http://192.168.x.x:8787`

That is intentional for local-network control during this phase.
