# Daily Testing

Vector Control Hub now includes a scheduled GitHub Actions workflow named `Daily Android Smoke`.

It is meant to answer one simple question every day:

`Does the current Android app still install, launch, stay alive, and capture useful debug evidence?`

## What The Workflow Does

Every scheduled run:

1. installs repo dependencies
2. runs core verification:
   - typecheck
   - command-engine test
   - full app/server build
3. prepares the Android project
4. builds a fresh debug APK
5. boots an Android emulator
6. installs the APK
7. launches the app
8. captures smoke-test artifacts

## Schedule

The workflow runs daily at:

- `18:00 UTC`
- `10:00 AM America/Anchorage` during daylight-saving time

It can also be started manually from the GitHub Actions tab with `Run workflow`.

## Where Testers Get The Build

Open the latest run for `Daily Android Smoke` and download the artifact:

- `vector-daily-android-smoke`

That artifact includes:

- `app-debug.apk`
- `screenshot.png`
- `ui-dump.xml`
- `logcat.txt`
- `summary.json`

`summary.json` is the fastest truth check. If it says `"passed": true`, the app launched cleanly in the smoke test.

## Local Smoke Command

To run the same basic Android smoke path locally:

```bash
npm run mobile:android:debug
npm run mobile:android:smoke
```

Local artifacts are written to:

- `artifacts/android-smoke/`

## What This Proves

The smoke test is useful because it proves:

- the debug APK still builds
- the app installs on Android
- the app launches without an immediate crash
- the app process stays alive long enough for a first-run check

## What It Does Not Prove

This workflow does not fully replace real-device QA.

You still need real-phone testing for:

- Bluetooth pairing with a real Vector
- return-from-portal behavior
- live robot actions
- final on-face animation feel
