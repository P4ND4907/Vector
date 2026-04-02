# Contributing

Thanks for helping improve Vector Control Hub.

## Before You Open a PR

Please make sure:

1. the app still builds
2. typecheck passes
3. your change does not introduce hardcoded secrets
4. any new setup behavior is reflected in the README
5. the change keeps the app understandable for normal users

## Local Setup

```bash
npm install
npm run typecheck
npm run build
```

Windows local launcher:

- `start-app.bat`

## Contribution Guidelines

- Prefer small, focused changes
- Preserve working behavior unless a change is clearly intentional
- Keep WirePod-specific assumptions centralized in the backend service layer
- Avoid adding frontend code that talks directly to local robot endpoints when the backend can own that logic
- Keep trust and clarity in mind: calm wording, obvious setup, honest status messages

## Secrets and Config

- Do not commit `.env.local`
- Do not paste real API keys into source files
- Use example env files for documentation

## Good Issues to Work On

- setup clarity
- safer error handling
- UI polish
- backend validation
- better diagnostics
- documentation improvements

## Pull Request Notes

Please include:

1. what changed
2. why it changed
3. how you tested it
4. any known limitations or follow-up work
