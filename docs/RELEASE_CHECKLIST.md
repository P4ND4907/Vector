# Release Checklist

Use this checklist before tagging and publishing a new release. Work through each section in order.

---

## 1. Pre-flight checks

- [ ] All intended changes are merged to the release branch
- [ ] `CHANGELOG` or release notes are drafted (if maintained)
- [ ] Version in `package.json` is updated to the new release version

```bash
# Check current version
node -p "require('./package.json').version"
```

---

## 2. Type check

```bash
npm run typecheck
```

Must pass with zero errors. TypeScript errors are blocking.

---

## 3. Lint

```bash
npm run lint
```

Fix any reported issues before proceeding.

---

## 4. Build

```bash
npm run build
```

The full build must complete without errors. This covers both the frontend (Vite) and backend (TypeScript compilation).

---

## 5. Tests

```bash
npm run test
```

All tests must pass. For targeted coverage:

```bash
npm run test:commands   # command parsing and AI route tests
npm run test:ui         # UI-level tests
npm run test:coverage   # coverage report
```

---

## 6. Engine provider verification

Test each provider manually in the running app:

- [ ] **WirePod provider** — start a local WirePod instance, switch to WirePod in Engine Settings, confirm status shows connected
- [ ] **Mock provider** — switch to Mock, confirm dashboard loads with simulated data and no errors in the console
- [ ] **Embedded provider** — confirm it remains disabled in the UI ("Coming soon"), and that the `/api/engine/providers` response reports it as unavailable with honest `protocolGaps`

---

## 7. License activation

- [ ] `GET /api/license/status` returns `{ tier: "free", features: [...] }` on a fresh install
- [ ] `POST /api/license/activate` with a `PRO-XXXX` key returns `{ tier: "pro" }` and writes `vector-license.local.json`
- [ ] `GET /api/license/status` after activation returns the `pro` tier and pro feature list
- [ ] Activating with a non-`PRO-` key stays on the `free` tier

---

## 8. Onboarding wizard

- [ ] Clear `localStorage.removeItem("vector_onboarding_complete")` and reload — wizard appears
- [ ] Step 1 renders welcome text and feature list
- [ ] Step 2 shows all three engine options; embedded is disabled with "Coming soon"
- [ ] Step 3 runs a connection test; failure does not block progression
- [ ] Step 4 shows confirmation; clicking "Go to dashboard" dismisses the wizard and sets the localStorage flag
- [ ] Reloading after completion skips the wizard

---

## 9. Repair tools

- [ ] Quick repair runs and returns a result card (repaired / partial / failed)
- [ ] Bridge watchdog fetches and renders without console errors
- [ ] Repair history shows the most recent report after a repair run

---

## 10. Embedded provider protocol gaps review

The embedded provider stub documents known protocol gaps in its `protocolGaps` array. Before each release:

- [ ] Review `server/src/engine/embeddedProvider.ts` for any newly noted gaps
- [ ] Confirm the gaps list is accurate and up to date
- [ ] Confirm the UI correctly shows the embedded option as "Coming soon" and non-interactive

---

## 11. Docker smoke test

```bash
npm run docker:up
# Wait for startup, then:
curl http://localhost:4173
curl http://localhost:8787/api/engine/status
npm run docker:down
```

- [ ] App loads at `http://localhost:4173`
- [ ] Engine status API responds
- [ ] No container crashes in `docker compose logs`

---

## 12. Version and tag

- [ ] `package.json` version reflects the release (e.g. `0.1.28`)
- [ ] Commit the version bump: `git commit -m "chore: bump version to 0.1.28"`
- [ ] Tag the release: `git tag v0.1.28`
- [ ] Push branch and tag: `git push && git push --tags`

---

## 13. GitHub Release

- [ ] GitHub Actions build workflow triggered by the tag
- [ ] Windows release artifact attaches to the tagged release
- [ ] Release notes published on the GitHub Releases page
- [ ] `docs/RELEASING.md` followed for any platform-specific steps

---

## References

- [docs/RELEASING.md](./RELEASING.md) — full release process
- [docs/PUBLIC_RELEASE_CHECKLIST.md](./PUBLIC_RELEASE_CHECKLIST.md) — public sharing checklist
- [docs/REGRESSION_CHECKLIST.md](./REGRESSION_CHECKLIST.md) — regression test detail
- [docs/ARCHITECTURE.md](./ARCHITECTURE.md) — system architecture
