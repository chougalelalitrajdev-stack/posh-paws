---
name: run-app
description: Launch the PoshPaws Angular dev server and verify a UI change by actually driving it in a headless browser (screenshot + console check), not just by running `ng build` or `npm test`. Use this whenever asked to run, start, preview, or verify the customer app, or to confirm a frontend/UI change works in the real app. Covers why `ng build`/`npm test` don't prove the app runs, how to start and stop the dev server, and how to drive it with a disposable Playwright script since no `chromium-cli` is installed in this environment.
---

# Running & verifying the PoshPaws app

This is an Angular 21 standalone-components app (no NgModules). `npm test`
runs Vitest unit tests and `ng build` only proves the code compiles —
**neither proves the UI actually renders or behaves correctly**. To verify
a UI change, actually launch the dev server and drive a real browser
against it.

## 1. Start the dev server

```bash
lsof -ti:4200 -sTCP:LISTEN | xargs -r kill   # free the port if a stale server is running
cd customer   # the Angular app lives in customer/ of the monorepo
npm start > /tmp/ng-serve.log 2>&1 &
disown
```

Poll for readiness instead of sleeping a fixed amount — Angular's first
compile can take a few seconds:

```bash
i=0; until curl -sf http://localhost:4200 >/dev/null 2>&1 || [ $i -ge 40 ]; do sleep 1; i=$((i+1)); done
curl -sf http://localhost:4200 >/dev/null 2>&1 && echo "SERVER UP" || { echo "SERVER FAILED"; tail -60 /tmp/ng-serve.log; }
```

Stop it the same way when done: `lsof -ti:4200 -sTCP:LISTEN | xargs -r kill`.

## 2. Drive it with a browser

`chromium-cli` is not installed in this environment, so use a disposable
Playwright script instead — never add Playwright to this project's
`package.json`, it's a verification tool, not a dependency of the app.

**Set up once per machine** (safe — downloads only, no system packages):

```bash
mkdir -p /tmp/pw-check && cd /tmp/pw-check && npm init -y >/dev/null 2>&1
npm install playwright@1.49.1
npx playwright install chromium
```

That last command (without `--with-deps`) only downloads a Chromium
binary into the Playwright cache — no `sudo`/`apt-get` involved, so it
doesn't need confirmation. **Never add `--with-deps`** — that shells out
to the system package manager under sudo, which is an invasive,
confirmation-worthy action. If the bare `chromium` download itself fails
because some OS-level shared library is genuinely missing, stop and ask
the user before trying `--with-deps` or any sudo/apt command — don't
reach for it automatically.

**Run a script** with `node scripts/browser-check.mjs` from this skill
directory (copy/adapt it — it's a template, not meant to be run in place
against your actual verification target). It:
1. Launches headless Chromium at a mobile viewport (390×844 — this app
   is mobile-first, see `customer/CLAUDE.md`).
2. Navigates to `http://localhost:4200`.
3. Clicks the navbar's "Book now" button and waits for the `/book`
   slot-booking page ("What would you like to book?") — a good single
   smoke check that the app shell, lazy routing, and a signal-driven
   page all work together. The mock login code is `123456`.
4. Screenshots the result and prints any console errors.

Adapt step 3 to whatever you're actually verifying — the point of the
script is the launch → navigate → interact → screenshot → check-console
loop, not this specific click path.

## What "verified" looks like

- The screenshot shows the expected UI state (open the PNG and look at
  it — a blank or unstyled page is a failure to launch, not a pass).
- `console --errors`-equivalent output (the script's error listener) is
  empty, or any errors are ones you understand and expect.
- Re-check at a couple of widths if the change is responsive-sensitive:
  this app targets small/standard/large mobile, tablet, and desktop
  (see `customer/CLAUDE.md` and any mobile-first requirements in the active
  plan).
