# Security Policy

## Supported Use

This project is intended to run locally.

If you use:

- `server/.env.local`
- `.env.local`
- local API keys
- local WirePod endpoints

keep those values private and out of version control.

## Reporting a Security Issue

Please do not open a public issue for suspected secrets exposure, unsafe local behavior, or a serious security problem.

Instead, share:

1. what happened
2. which file or route is affected
3. steps to reproduce
4. whether a secret may have been exposed

If a real secret was exposed:

1. rotate the key first
2. remove it from the affected file
3. then report the issue

## Safe Configuration Rules

- Never commit `server/.env.local`
- Never put API keys in frontend source files
- Never paste secrets into screenshots or README examples
- Review launcher scripts before sharing the repo
- Treat local logs as potentially sensitive if they include robot/IP details

## Scope Notes

This project is local-first and is meant to keep most robot activity on the local machine.

Optional external API usage currently includes:

- OpenAI-backed features, only when a user configures their own key

## Disclosure Expectation

Good-faith, private disclosure is appreciated. Please give reasonable time to review and fix an issue before public discussion.
