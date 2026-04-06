# Public Release Checklist

Use this checklist before changing the GitHub repository from private to public.

## Safety

- Confirm `server/.env.local` is still local-only and not committed.
- Confirm no API keys or private tokens appear in screenshots, issue templates, or docs.
- Confirm local IP addresses shown in screenshots are ones you are comfortable sharing.
- Confirm `node_modules/`, `dist-electron/`, `.runtime/`, and local logs are not included in the commit.

## Repo Presentation

- Add real screenshots to the README using the filenames listed there.
- Make sure the README matches the current app flow:
  - startup connection screen
  - finish local setup automatically
  - open robot pairing portal only for the one-time robot handshake
- Check the repo description on GitHub.
- Check the repo topics on GitHub.

## App Validation

- Run `start-app.bat` on the main machine and confirm the app opens cleanly.
- If possible, test the launcher once on a second clean Windows machine.
- Confirm Mock Mode is off in any real-robot screenshots.
- Confirm the startup screen shows honest state when WirePod or the robot is unavailable.

## Release Files

- If you want non-technical testers, build or upload a Windows release artifact.
- Keep source-download instructions in the README for advanced users.
- Keep the known limitations section honest.

## Final GitHub Steps

- Push the latest repo changes.
- Review the GitHub file list one last time.
- Change repository visibility to public.
- Create or update a GitHub Release if you want testers to download an installer instead of the source.
