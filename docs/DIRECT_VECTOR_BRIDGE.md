# Direct Vector Bridge

Vector Control Hub can now use a direct SDK bridge instead of routing live commands through WirePod.

## Credential Lookup

The backend checks environment variables first:

- `VECTOR_DIRECT_NAME`
- `VECTOR_DIRECT_SERIAL`
- `VECTOR_DIRECT_HOST` or `VECTOR_DIRECT_IP`
- `VECTOR_DIRECT_TOKEN` or `VECTOR_DIRECT_GUID`
- `VECTOR_DIRECT_CERT_PATH`

If those are not complete, it reads the standard SDK config:

```text
%USERPROFILE%\.anki_vector\sdk_config.ini
```

Expected config fields are `name`, `ip`, `guid`, and `cert`. The section name or `serial` field can provide the robot serial.

## Provider Selection

Set `bridgeProviderPreference` in local settings to:

- `direct` to require the direct SDK bridge.
- `wirepod` to keep the WirePod-compatible bridge.
- `auto` to use direct mode when SDK credentials are available, otherwise keep the existing bridge path.

For quick local testing, `VECTOR_DIRECT_ENABLED=true` also forces direct mode.

## Supported Direct Commands

- status/connect/disconnect
- discover saved SDK robot
- drive and stop
- head and lift
- speak
- animations
- dock and wake
- saved photo list, download, and delete
- direct-mode diagnostics

Still in progress:

- direct "take photo now" capture
- live camera stream
- full in-app pairing and Wi-Fi provisioning without a handoff

The direct bridge must stay honest: if a robot protocol call is not implemented yet, the app should say so instead of pretending the command worked.
