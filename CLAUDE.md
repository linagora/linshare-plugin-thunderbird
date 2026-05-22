# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A Thunderbird WebExtension (`linshare@linagora`) that adds a "Send via LinShare" button to the compose window. On click, attachments are uploaded to a LinShare server, the recipients are granted a share, then the original mail is sent without the attachments (a templated card/link block is appended to the body instead). Target: **Thunderbird 115+ / LinShare API v5 only** (legacy v1/v2/v4 routes were removed in 3.x).

## Build

The build packages the extension into an XPI. There is no JS bundler/linter/test runner.

- `./build.sh` — produces `./linshare.xpi` in the repo root (uses `config_build.sh` for which files/dirs go into the XPI).
- `./build.for.maven.sh` — same packaging but writes to `./target/linshare.xpi`. Invoked by Maven via `exec-maven-plugin`.
- `mvn clean package` — full CI build (matches `.gitlab-ci.yml`); runs the maven build which calls `build.for.maven.sh` and assembles `target/linshare-plugin-thunderbird.tar.bz2` containing the XPI.
- `mvn validate -Pprepare-release` — syncs `manifest.json` `version` from `pom.xml` `${project.version}`. The `maven-release-plugin` calls this on `release:prepare` / `release:perform`, so **`manifest.json` version is owned by `pom.xml`** — do not bump it by hand if you're also touching the pom version, and never let the two drift.

To install the built XPI in Thunderbird for manual testing: Tools → Add-ons → gear icon → "Install Add-on From File…" → pick `linshare.xpi`. Then reload after each rebuild.

If `build.sh` is changed, mirror the change in `build.for.maven.sh` (and vice versa) — they're two near-duplicates of the same MozillaZine build script differing only in output path and `set -x`.

## What goes into the XPI

The XPI is a zip of the files in `$ROOT_FILES` + `$ROOT_DIRS` from `config_build.sh`:

- root files: `COPYING manifest.json background.js linshare.js schema.json`
- root dirs: `assets modules content _locales skin`

Anything **not** listed there (e.g. `pom.xml`, `src/`, `README.md`, `*.sh`) is excluded.

## Architecture: two execution contexts

This is the single most important thing to understand before changing anything. The extension straddles **two JavaScript realms** with very different capabilities, and bugs almost always come from confusing them.

### 1. WebExtension context — `background.js` + `content/views/options/`
- Manifest v2 background script, runs in the standard WebExtension sandbox.
- Has `browser.compose.*`, `browser.storage.local`, `browser.notifications`, `browser.tabs`, `browser.i18n` — but **cannot** touch `Services.*`, XPCOM, files on disk, or Thunderbird chrome windows directly.
- `background.js` orchestrates the user flow: listens to `composeAction.onClicked`, gathers attachments+recipients via `browser.compose.*`, reads saved config from `browser.storage.local` (keys `linshareUserInfos`, `linshareUserPrefs`), then calls into the experiment API to do the upload, and finally rewrites the compose body and triggers send.
- The options page (`content/views/options/options.{html,js,css}`) is a normal WebExtension options page (`options_ui` in the manifest). It persists settings to `browser.storage.local` — **not** to Thunderbird prefs directly.

### 2. Experiment API context — `linshare.js` + `modules/*.sys.mjs`
- A Thunderbird **Experiment API** (`experiment_apis.linshareExtAPI` in `manifest.json`, schema in `schema.json`, parent script `linshare.js`).
- Runs in the parent/system process with full `ChromeUtils`/`Services.*` access. Schema-listed functions become callable from background.js as `browser.linshareExtAPI.<fn>(...)`.
- `linshare.js` is the class `linshareExtAPI extends ExtensionCommon.ExtensionAPI`. In `onStartup()`/`getAPI()` it registers a resource alias `resource://linshare-modules/` → `<extension-root>/modules/`, then dynamically imports the `modules/*.sys.mjs` files through that alias and injects `Services` + the localization function into each one via their exported `setServices` / `setI18n` hooks.
- The modules under `modules/` are plain ES system modules (`.sys.mjs`) that depend on injected `Services` and `_i18n` — they will silently fall back to defaults / no-ops if you import them outside `linshare.js`'s setup path. Two startup hooks (`onStartup` and `getAPI`) both do the loading because `onStartup` isn't reliably called in current Thunderbird — keep both code paths working.
- The schema in `schema.json` is the **contract** between the two contexts. Adding a function callable from `background.js` means: (a) add it to `schema.json`, (b) implement it in the `getAPI()` return object in `linshare.js`. Missing either side fails silently with `undefined`.

### Data flow on "Send via LinShare" click

1. `background.js` `composeAction.onClicked` → `sendToLinshare(tab)`.
2. Gathers attachments (`browser.compose.listAttachments` + `getAttachmentFile`) and recipients (to/cc/bcc, deduped, email-extracted from `Name <addr>` form).
3. Reads `linshareUserInfos` + `linshareUserPrefs` from `browser.storage.local`, merges them into a `settings` object.
4. Calls `browser.linshareExtAPI.sendAndShare(files, recipients, settings)` — crosses into the experiment context.
5. `linshare.js` injects the settings as `userProfile._runtimeConfig` (see `profileStorage.sys.mjs` — all profile getters check `_runtimeConfig` before falling back to `Services.prefs`), then uses `LinshareAPI` (`modules/linshareAPI.sys.mjs`) to: check version/credentials, upload each file (`POST /webservice/rest/user/v5/documents`), share the resulting UUIDs (`POST /webservice/rest/user/v5/shares`). A progress overlay is injected into the compose window's DOM directly via `context.extension.windowManager`.
6. On success, `sendToLinshare` returns `{ success: true, files: [...] }`. `background.js` `notify()` removes the attachments, appends the LinShare card (HTML or plaintext branch depending on `composeDetails.isPlainText`), sets a default subject if empty, and calls `browser.linshareExtAPI.sendMail()` to dispatch.

### Auth modes

Two auth types, selectable on the options page: `basic` (email+password, `Basic base64(email:pass)`) and `jwt` (long-lived bearer token, `Bearer <JWT>`). Branching lives in `LinshareUtils.getRequestContext` in `modules/linshareUtils.sys.mjs`. The password is stored via `browser.storage.local` (the README's reference to the "native Thunderbird Password Manager" describes intent; the actual implementation persists to `storage.local`, and `TBUIHandlers.savePassInCurrentWin` is a stubbed no-op).

### Routes

All LinShare HTTP routes are centralised in `modules/routes.sys.mjs` and reference a `#base#` placeholder for the API version (only `v5` is supported). When adding an endpoint, add it here rather than hand-rolling URLs in callers.

## i18n

- Messages are in `_locales/{en,fr}/messages.json`. Default locale is `fr` (set in `manifest.json`).
- WebExtension side: `browser.i18n.getMessage("key")`. The options page uses `data-i18n` / `data-i18n-placeholder` attributes that `localizeUI()` in `options.js` walks at render time.
- Experiment-API side: `browser.i18n` is not available; each module has a local `i18n(key, fallback)` helper that uses the function injected via `setI18n(extension.localeData.getMessage.bind(extension.localeData))`. **Always pass a sensible fallback string** — if i18n isn't set up yet (module loaded before injection, fallback path, etc.) you'll get the fallback, not the key.
- Any new user-facing string needs entries in **both** `_locales/en/messages.json` and `_locales/fr/messages.json`.

## Things to know before editing

- The two `getAPI()`/`onStartup()` module-loading code paths in `linshare.js` are largely duplicated on purpose (defensive against TB not calling `onStartup`). Changes to module wiring need to be made in both.
- `manifest.json` `version` is replaced by the maven release plugin via regex. Keep the line shape `"version": "..."` intact, single quote-delimited, on one line.
- `manifest.json` currently has trailing-comma-then-key shape near the `version`/`experiment_apis` boundary — be careful when editing that the file still parses as JSON.
- The compose-window button comes from `compose_action` in `manifest.json` (icon at `assets/share-send.svg`, title via `__MSG_shareButton__`). The wiring lives in `background.js` `composeAction.onClicked`. Don't add a XUL toolbar button.
- `linshare.js`'s `resolveServices()` is what makes the experiment work on TB 115 → 140. It tries the ambient `Services` global, then `importESModule("Services.sys.mjs")` (removed in some 14x builds), then a Components-built stub with just `io`. `getAPI` calls `setServices(svc)` and `setI18n(i18nFn)` on every module — without that injection, modules silently fall back to defaults and uploads land in `fallbackAPI`, returning fake `"uuid-" + Date.now()` strings instead of real LinShare UUIDs.
- `makeI18nFn(extension)` tries `extension.localeData.getMessage` (removed in TB 140), then `localizeMessage`, then no-op. Each module's `i18n(key, fallback)` returns the fallback if the wrapper returns null — so internal strings stay in English when the modern API isn't available.
- CI runs on `maven:3.9.9-eclipse-temurin-11` (Java 11). The build itself only needs `zip` + bash; Java/Maven are only there to drive `build.for.maven.sh`.
