# Privacy Policy

Last updated: April 5, 2026

Vector Control Hub is a local-first app for controlling an Anki / DDL Vector robot through WirePod.

## Summary

- The app is designed to run against the user's own local backend and WirePod setup.
- The app does not require a cloud account to use core robot controls.
- The Android app does not currently use mobile advertising IDs.
- We do not sell personal data.

## What The App Does

Vector Control Hub can:

- connect to a local backend on your device or local network
- send robot commands to your own WirePod / Vector setup
- show status, diagnostics, command history, and photos
- optionally use third-party AI or weather services if you configure them in your own local setup

## Data We Handle

Depending on the features you use, the app may handle:

- local backend connection settings such as your saved backend URL
- robot status and diagnostics
- command text you send to your robot
- robot-generated photos that you choose to sync
- optional support or feedback reports saved locally

## How Data Is Used

This data is used to:

- connect the app to your local robot stack
- send commands you request
- show robot state, logs, and synced photos
- help you troubleshoot your own setup

## Where Data Goes

Vector Control Hub is intended to keep normal app traffic on your own device or local network.

Core robot control traffic normally flows like this:

`App -> your local backend -> your local WirePod -> your Vector robot`

We do not run a required central cloud service for basic robot control.

## Third-Party Services

Some optional features may send data to third-party services only if you configure and enable them yourself in your own setup. For example:

- AI features may send prompts to OpenAI through your own local backend configuration
- weather features may send weather lookups through your configured provider

Those requests are controlled by your local setup and are subject to the privacy terms of the provider you choose.

## Ads

- The Android app does not currently use mobile advertising IDs.
- The hosted web/PWA version may optionally show web ads in the future if configured by the publisher.

## Data Sharing

We do not sell your personal data.

We do not share user data with third parties for advertising or analytics as part of the current Android app experience.

If you enable optional third-party integrations in your own local setup, the data needed for those requests may be sent to those providers by your own backend.

## Data Retention

Most app data is stored locally in your own environment and remains under your control.

You can remove local app data by clearing the app's stored settings, logs, photos, or backend data on your own devices.

## Security

This project is local-first and tries to minimize unnecessary remote services, but no software can guarantee perfect security.

You should:

- keep WirePod and your backend on trusted networks
- avoid exposing your local backend directly to the public internet
- keep API keys in backend environment files, not in frontend code

## Children

This app is not designed specifically for children.

## Contact

For privacy questions about this project, use the repository issue tracker:

[https://github.com/P4ND4907/Vector/issues](https://github.com/P4ND4907/Vector/issues)
