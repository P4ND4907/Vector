# Play Console Notes

Recommended first-pass answers for the current Android app build:

## Privacy Policy

Use the public GitHub URL for:

- `https://github.com/P4ND4907/Vector/blob/main/PRIVACY.md`

## App Access

- No special login, account, or access code is required.
- Core functionality depends on the user's own local backend, WirePod setup, and Vector robot.
- Reviewer note:
  - "This app does not use an app-specific login. It connects to the user's own local Vector / WirePod setup on their device or local network."

## Ads

- Answer `No` for the Android app right now.
- The Android build does not currently use AdMob or the Android advertising ID.

## Content Rating

- Use the content rating questionnaire honestly.
- For the current app, expect a low rating because it is a utility/control app and not a mature-content app.

## Target Audience

- Recommended: older teens and adults, or adults only, depending on your intended audience.
- If you want the simplest compliance path, do not position it as a children's app.

## Data Safety

Recommended conservative summary for the current build:

- no account creation
- no analytics SDK
- no crash-reporting SDK
- no mobile ad ID usage
- app connects to the user's own local backend and robot stack
- optional third-party AI/weather requests only happen if the user configures them in their own setup

Review the final data-safety answers carefully so they match your exact enabled features.

## Government Apps

- `No`

## Financial Features

- `No`

## Health

- `No`

## Category / Contact

- Category:
  - likely `Tools` or `Productivity`
- Contact email:
  - use an email you actively monitor

## Store Listing

You will still need:

- short description
- full description
- phone screenshots
- app icon
- feature graphic if Play requests it later
