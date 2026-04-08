# Vector Companion Regression Checklist

Run this before a public Windows release, Play upload, or any pairing/recovery-heavy beta.

## Pairing

1. Fresh install opens the guided setup flow cleanly.
2. `Set up a different robot` stays respected and does not snap back to the saved robot.
3. `Manual pairing tools` keeps the user on the new-robot path.
4. Returning from the pairing portal lands back in the app without losing context.

## Reconnect

1. Already-paired robot reconnects on startup without pairing mode.
2. Saved serial stays real and never falls back to mock while mock mode is off.
3. `Use Scout now` or the saved robot path does not redirect into pairing when pairing is already complete.

## Dock

1. `Go dock` works from typed commands, voice commands, and the dashboard button.
2. Robot stays docked when charging protection is active.
3. Low-battery auto-return does not leave the robot wandering off the charger.

## Diagnostics and Recovery

1. `Run diagnostics` returns a readable report instead of a generic failure.
2. Watchdog shows the right health state: bridge down, robot asleep/quiet, sdk flapping, or ready.
3. `Auto-recover bridge` / quick repair produces clear next-step messaging.
4. Support bundle export includes diagnostics, voice info, command gaps, and watchdog status.

## Typed Speech

1. Text commands speak through Vector, not just voice-transcribed commands.
2. Charging protection blocks speech only when expected and still shows the result in the app.
3. Dice, coin flip, weather, and joke replies use the current personality copy cleanly.

## AI Commands

1. Preview works for core commands and fun commands.
2. Execute works for weather, battery, dock, flip a coin, roll a die, joke, laugh, sing, and snore.
3. Teach mode can save, preview, list, and forget learned phrases.
4. Missed phrases appear in the inbox with usable teach suggestions.
