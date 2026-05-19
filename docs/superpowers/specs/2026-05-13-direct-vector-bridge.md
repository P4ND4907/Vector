# Direct Vector Bridge Spec

## Goal

Make Vector Control Hub able to talk directly to a Vector robot over the SDK gRPC interface, without requiring WirePod as the command bridge.

## Current State

- The Electron app bundles the React UI and the Node backend.
- The backend `hybridRobotController` currently sends live robot status and commands through the WirePod-compatible local bridge.
- The local profile already stores Vector serial and alias information, but the SDK credentials needed for direct gRPC are separate: robot name, IP/host, SDK GUID/token, and the robot certificate.

## Direct Bridge Requirements

- Add a first-class `direct` bridge/provider type beside `wirepod` and `mock`.
- Load direct credentials from environment variables first, then the standard SDK config file at `%USERPROFILE%\.anki_vector\sdk_config.ini`.
- Never log or expose the SDK GUID/token or certificate contents.
- Use modern Node gRPC packages (`@grpc/grpc-js` and `@grpc/proto-loader`) rather than the deprecated native `grpc` package.
- Vendor the Vector SDK protobufs into the server package so the Electron app works offline.
- Support direct status, discovery, connect, disconnect, drive, stop, head, lift, speak, dock, and wake command paths.
- Keep WirePod as a fallback/provider option while making direct mode selectable through `bridgeProviderPreference`.

## Credential Inputs

Supported environment variables:

- `VECTOR_DIRECT_NAME`
- `VECTOR_DIRECT_SERIAL`
- `VECTOR_DIRECT_HOST` or `VECTOR_DIRECT_IP`
- `VECTOR_DIRECT_TOKEN` or `VECTOR_DIRECT_GUID`
- `VECTOR_DIRECT_CERT_PATH`

Supported SDK config fields:

- `name`
- `serial`
- `ip`
- `guid`
- `cert`

## Acceptance

- Typecheck passes for app and server.
- Server direct-provider tests cover credential loading and command mapping.
- `npm run verify:ci` passes.
- If SDK credentials are present, setting `bridgeProviderPreference` to `direct` makes the backend use direct gRPC for robot status and supported commands.
