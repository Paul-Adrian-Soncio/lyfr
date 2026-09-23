# Lyfr — working state

Volatile. Update this as work progresses. Longer-lived decisions belong in
`CLAUDE.md` — which is itself provisional; see the living-document note at the
top of it.

Everything in both files is subject to change. The ordering below is a plan, not
a commitment. If the work suggests a better sequence, say so rather than
following this list past the point where it stops making sense.

**Last updated:** 2026-09-23
**Phase:** Scheduling + reliability layer proven end-to-end; medication library UI underway

---

## Next up

1. [x] Scaffold the Expo project with a development build and confirm
   `expo run:android` installs to the Samsung tablet. Done — see decision log
   and environment notes below for what it took to get there.
2. [x] Get the Android version off the tablet — done, see Open questions.
3. [x] Drizzle schema and first migration, per the data model in `CLAUDE.md`.
   Done — `src/db/schema.ts`, migration generated to
   `src/db/migrations/0000_zippy_molecule_man.sql`, DB client at
   `src/db/client.ts`, migrations run automatically on launch via
   `useMigrations` in `app/_layout.tsx`. Confirmed running on the tablet
   2026-09-18 (app boots past the migration gate, `libexpo-sqlite.so` loads,
   no errors in logcat). Took real setup beyond `drizzle-kit generate` — see
   the new gotcha entry below (SQL import resolution needed a Metro resolver
   change, a Babel plugin, and an explicit `babel-preset-expo` dependency
   that turned out not to be hoisted).
4. [x] Occurrence generator as a pure function, with Vitest tests. Fixed daily
   times, specific weekdays, every N days. Done —
   `src/domain/regimen.ts` + `src/domain/occurrenceGenerator.ts`, 9 tests
   passing. Two judgment calls worth a second look once real regimens are
   known (see Open questions):
   - Regimen `startDate`/`endDate` are local calendar-date strings
     (`YYYY-MM-DD`), not epoch ms — CLAUDE.md §5 doesn't specify a type for
     these columns. Chosen to keep "start on this calendar day" unambiguous
     across timezones. `src/db/schema.ts` initially stored these as epoch-ms
     `integer` (an oversight predating this decision, not a deliberate
     choice); fixed 2026-09-18 to `text` so the schema and domain type agree.
   - `every_n_days` anchors the interval to the regimen's own `startDate`,
     not the generation window's start. So a window that starts mid-cycle
     still lands on the correct days (confirmed by test). This is the only
     sane reading, but it means editing a regimen's start date reshuffles
     every future occurrence date for that rule type — worth surfacing in
     the UI if edits to an active every-N-days regimen become common.
5. [x] `Scheduler` interface plus `AndroidScheduler` on Notifee. Done —
   `src/scheduling/Scheduler.ts` + `src/scheduling/AndroidScheduler.ts`.
   Doze/alarm reliability proven via a throwaway spike (`app/doze-spike.tsx`)
   — see "To verify, not assume". `AndroidScheduler` itself verified
   end-to-end on-device 2026-09-18 via another throwaway spike
   (`app/scheduler-spike.tsx`): a real medication + regimen inserted, synced
   through `syncRegimen`, produced exactly one `dose_occurrences` row and one
   real Notifee alarm that fired with sound on schedule. `pendingCount()`
   correctly reported 1. Design notes:
   - Idempotency comes from using the `dose_occurrences` row's own UUID as
     the Notifee notification ID directly, and skipping any generated
     occurrence whose `(regimenId, scheduledAt)` already has a row. Re-
     syncing a regimen is therefore a no-op for occurrences already
     materialised — it does not currently detect or reschedule an occurrence
     whose *time* changed for a reason other than a brand-new row (e.g. a
     regimen edit that shifts a still-pending occurrence). Revisit once
     regimen editing is built.
   - `refillWindow()` re-syncs every active regimen against a rolling
     `WINDOW_DAYS = 7` window. Chosen independently of iOS's 64-pending cap
     (Android has no such cap) — just a sane default so an edited regimen's
     new rule takes effect within a week rather than being blocked by a
     month of stale occurrences. Worth revisiting once real regimens (and
     real re-sync frequency — on app foreground? a background task?) are
     known.
   - Found via the spike, not assumed: `crypto.randomUUID()` is **not**
     globally available in this Expo SDK 57 / RN 0.86 / Hermes setup —
     threw `property 'crypto' doesn't exist`. Fixed by installing
     `expo-crypto` and using `Crypto.randomUUID()` instead. Worth remembering
     since RN release notes have flagged Hermes-global `crypto.randomUUID`
     support before; it evidently isn't enabled/available here, so don't
     assume it without testing on a fresh setup.
6. [x] Heartbeat logging. Done —
   `src/scheduling/heartbeat.ts` (logExpectedFire/logObservedFire/reconcile),
   `src/scheduling/notificationEvents.ts` (Notifee event wiring),
   `src/scheduling/backgroundHeartbeat.ts` (periodic WorkManager-backed
   check via expo-task-manager/expo-background-task), custom `index.js`
   entry point (needed so the Notifee background handler and the
   TaskManager task are both defined before the JS bundle finishes
   initializing), `src/ui/reliabilityStore.ts` +
   `src/ui/ReliabilityBanner.tsx` (the missed-fire banner, wired into
   `app/_layout.tsx`). Verified end-to-end on-device 2026-09-18/19 via the
   scheduler-spike screen's new "Check reconcile()" button. Two real bugs
   found by testing, not assumed away:
   - **POST_NOTIFICATIONS was silently ungranted.** The uninstall/reinstall
     done earlier (to wipe test data) reset the runtime permission grant,
     and `AndroidScheduler.syncRegimen` never re-requests it — only the
     doze-spike screen's `notifee.requestPermission()` call does. Result:
     `createTriggerNotification` succeeded (no thrown error) and a
     `dose_occurrences` row was created, but the OS never actually posted
     anything — `dumpsys notification` showed
     `AppSettings: ph.pauladrian.lyfr importance=NONE` and
     `numEnqueuedByApp=0`. Fixed 2026-09-19: `syncRegimen` now calls
     `notifee.requestPermission()` first and throws
     `NotificationPermissionDeniedError` if denied, rather than silently
     writing occurrence rows for notifications that will never appear.
     **Still open:** no real UI calls `syncRegimen` yet, so nothing catches
     or surfaces this error to a user. Needs a real decision once
     onboarding/medication-library UI exists — this app is useless without
     notification permission, so denial should probably block past
     onboarding with a clear explanation, not just fail silently deep in a
     background sync call.
   - **Notifee foreground and background event listeners are separate
     registrations.** `notifee.onBackgroundEvent` (registered once in
     `index.js`, outside the component tree) only catches events while the
     app is not in the foreground. With the app open, a real, successfully
     delivered notification produced zero `DELIVERED` events — reconcile()
     correctly flagged it as a suspected miss, which is the right behaviour
     for missing data, but the actual gap was a missing
     `notifee.onForegroundEvent` registration. Fixed by adding
     `registerForegroundEventHandler()` in
     `src/scheduling/notificationEvents.ts`, called from a `useEffect` in
     `app/_layout.tsx`. Confirmed fixed: a subsequent in-foreground test
     showed up as "confirmed" rather than a suspected miss.
   - Two stale suspected-miss rows from before these fixes are still sitting
     in the dev database (from tests run while permission was revoked) and
     will keep showing the reliability banner until the dev DB is wiped
     again. This is correct behaviour, not a bug — the log doesn't
     retroactively un-flag a real miss.
7. [x] Samsung battery walkthrough. Done —
   `src/scheduling/batteryWalkthrough.ts` (the checks/actions, mapped onto
   Notifee's `isBatteryOptimizationEnabled`/`openBatteryOptimizationSettings`,
   `openAlarmPermissionSettings`, and `getPowerManagerInfo`/
   `openPowerManagerSettings` for the Samsung-specific OEM screen),
   `app/battery-walkthrough.tsx` (the screen — re-checks step status via
   `AppState` on foreground, so returning from a settings screen updates the
   badges without a manual refresh). Reachable from the home screen's dev
   links and wired as the reliability banner's "Check settings" destination
   (`src/ui/ReliabilityBanner.tsx`, via `router.push`). Restyled to match
   the real mockup (see "Design system" below) rather than ad-hoc styling.
   Verified on-device 2026-09-22, one real UX gap found and fixed:
   - **`openBatteryOptimizationSettings()` opens a filtered app list, not a
     Lyfr-specific screen.** On the Samsung tablet, the destination screen
     defaults to a subset filter that does not include Lyfr — the user has
     to know to switch it to "All apps" before Lyfr even appears in the
     list. Without saying so, a first-time user hits what looks like a dead
     end (their app isn't there) and has no obvious next step. Fixed by
     making the walkthrough's own description say this explicitly, since
     the OS screen doesn't. This is very likely Samsung/One-UI-version-
     specific — re-verify if the target phone runs a different One UI
     version than the test tablet.
   - The other two steps (`exactAlarmStep`, `oemPowerManagerStep`) are not
     programmatically checkable — Notifee has no status API for them, only
     an action to open the screen. Their badges always show "Check
     manually." Not yet separately verified that
     `openPowerManagerSettings()` on this tablet actually lands on
     Samsung's "Background usage limits" screen specifically (vs. a more
     generic battery page) — confirmed reachable and functional per user
     report, but the exact destination screen hasn't been screenshotted/
     logged. Worth a closer look before relying on the walkthrough's
     description text being accurate for that step too.
8. Medication library UI, then Today view, then history. In progress —
   "Add medicine" done (`app/add-medication.tsx`), matching the mockup's
   AddMedication.dc.html extended to 9 forms (added "Vitamin", see decision
   log — the mockup and CLAUDE.md §5's table only show/list 8). Supporting
   pieces: `src/domain/medication.ts` (form → dose unit/supply unit table),
   `src/domain/medicationPhoto.ts` (camera capture → resize to 800px long
   edge → save to document directory, only the relative path stored — per
   CLAUDE.md §5), `src/ui/FormIcon.tsx` (per-form icon set; 6 of 9 traced
   from the mockup exactly, 3 — patch/topical/vitamin — designed to match
   since no mockup reference exists for them, see file comments). Verified
   end-to-end on-device 2026-09-23: photo captured and shown in the
   preview, medication row written correctly (confirmed by pulling and
   querying the live SQLite file — see verification method below), photo
   file present on disk at the stored relative path, correct size for an
   800px-downscaled JPEG (~7KB).
   - [x] Medication list/library screen — done, `app/medications.tsx`
     (reactive via Drizzle `useLiveQuery`, filters out archived rows) and
     `app/edit-medication/[id].tsx` (edit + archive, archive behind a
     native two-step confirmation per CLAUDE.md §6's "resistant to
     accidental taps"). Shared form fields extracted to
     `src/ui/MedicationFormFields.tsx` so add and edit stay in sync.
     **Real bug found and fixed 2026-09-23:** the list row only rendered
     the colour tag as the icon tile's background when no photo existed —
     once a medication had a photo, its colour tag became invisible
     anywhere in the list. This directly breaks CLAUDE.md §1's "recognition
     beats reading" principle: form icon, colour tag and photo are meant to
     be three *redundant* identifiers shown together, not photo-as-fallback
     for the other two. Fixed by adding a small colour dot next to the name
     (matching the mockup's History.dc.html Supply section — a 14px dot,
     independent of icon/photo) so the colour tag is always visible
     regardless of whether a photo exists. Worth checking the Today view
     and any future medication display for the same mistake once those are
     built.
   - No second "set schedule" step yet — CLAUDE.md §6 and the mockup both
     treat scheduling as a distinct step after adding a medication
     ("Step 1 of 2" / "Next: set schedule"). `add-medication.tsx` currently
     saves and returns straight to the previous screen. Needs a real
     decision once regimen-creation UI exists: does saving a medication
     immediately continue into schedule setup, or can a medication exist
     without an active regimen for a while (e.g. PRN, or "add now, schedule
     later")?

### Verifying a real device's SQLite database from this PC

Useful for confirming a write actually landed, not just that no error was
thrown. `run-as` can access the app's private data directory, but two
Windows/Git-Bash-specific gotchas will otherwise waste time:

- Plain `adb shell run-as <pkg> cat <path> > file` can come back
  corrupted/truncated — seen 2026-09-23, `sqlite3` reported "malformed
  database schema" on a pull that used a plain `adb shell ... cat`
  redirect. Use `adb exec-out` instead of `adb shell` for any binary pull
  — `exec-out` doesn't do the CRLF/text-mode translation `shell` can.
- Git Bash on Windows rewrites a leading `/data/...` argument into a
  Windows path (`C:/Program Files/Git/data/...`) before `adb` ever sees
  it, silently turning a valid device-absolute path into a nonexistent
  local one. Prefix the command with `MSYS_NO_PATHCONV=1` to stop that
  rewrite:
  ```
  MSYS_NO_PATHCONV=1 adb exec-out run-as ph.pauladrian.lyfr \
    cat /data/data/ph.pauladrian.lyfr/files/SQLite/lyfr.db > local_copy.db
  sqlite3 local_copy.db "SELECT * FROM medications;"
  ```
  `sqlite3` itself is already on this machine, bundled with the Android
  SDK at `platform-tools/sqlite3`.

### Design system

A real mockup exists — see the "Lyfr app mockup" design canvas (Main,
LockScreen, AddMedication, History artboards), read into this session
2026-09-22 and used as the source of truth for `battery-walkthrough.tsx`
and `ReliabilityBanner.tsx`. `src/theme/tokens.ts` was extended to capture
what CLAUDE.md §7 doesn't spell out but the mockup makes concrete:
`textMuted` colours (`#3D5163` light / `#A9BACB` dark), a distinct dark
card surface (`#1A2A38`) separate from the base dark surface, card/button/
pill border-radius and height conventions (`radii`, `buttonHeights`), and
the wordmark font family. The L-monogram logo (CLAUDE.md §7) is extracted
as `src/ui/LyfrLogo.tsx`, an inline `react-native-svg` component matching
the mockup's exact path data, reused wherever the mark appears rather than
redrawn per screen. New screens should read the mockup's other artboards
(Main/LockScreen/AddMedication/History) before inventing new component
patterns — check `src/theme/tokens.ts`'s component-convention comments
first.

Do not build the UI first. The scheduling layer is where the project succeeds or
fails, and it is better to discover its constraints before screens depend on it.

---

## Open questions

Blocking or near-blocking. Answer as they come up rather than guessing.

- [x] **Tablet Android version.** Samsung Galaxy Tab A8 (SM-X200), Android 14,
      API 34, security patch 2025-02-01. Well above the Android 9 floor — a
      valid proxy for the target phone. Wireless debugging confirmed working.
- [ ] **Real medication regimens for both parents.** Every medication, dose,
      form and timing rule. This decides whether the V1 schedule types are
      sufficient or whether something from V1.5 has to move up. Injections and
      drops in particular often carry timing rules that fixed-daily does not
      cover. Needed before the occurrence generator is finalised. Photographing
      the prescriptions or pill organisers is enough.
- [ ] **Which parent is V1 for.** The mother's Android is the only device with a
      fast iteration loop. If the father is the one struggling more, the $99
      Apple Developer spend becomes urgent rather than deferred.
- [x] **Package identifier.** `ph.pauladrian.lyfr`. Checked Play Store and a
      basic trademark search first: no published app named "Lyfr" (closest
      matches are unrelated "Lyf"/"Lyft"/"LyfPay" products). One overlap worth
      remembering — LYFR (lyfrai.com) is an unrelated digital health platform
      that also touches medication management. Not a conflict for a private,
      unpublished app, but worth another look if this is ever published to a
      store or made public in a portfolio writeup.
- [ ] **Does the mother open her phone regularly, or does it sit idle?** If idle,
      Samsung's unused-app sleep is far more likely to trigger, and
      reconcile-on-launch is a weaker strategy because launches are rare.
- [x] **UI language.** English. Generic drug names stay in English regardless.
- [ ] **Any PRN (as-needed) medications?** If neither parent takes one, drop it
      from scope entirely rather than carrying it in V1.5.
- [ ] **Vision or dexterity constraints** beyond ordinary age — tremor,
      cataracts, reading glasses. Affects touch target sizing and how heavily to
      lean on photographs.
- [ ] **Does the developer live with them or remotely?** If remote, the caregiver
      view is the actual point of the app and should be architected for earlier,
      even if built later.

---

## To verify, not assume

Each of these is a documented behaviour that varies in practice. Confirm on the
real device and record the result here.

- [ ] Notifee reschedules trigger notifications after reboot. Actually reboot the
      tablet and confirm alarms return.
- [x] Exact alarms fire through Doze on the unplugged tablet with the screen off,
      *and* the resulting notification is actually noticeable on a locked
      screen. Confirmed 2026-09-17 via a throwaway spike screen
      (`app/doze-spike.tsx`):
      - `AlarmType.SET_EXACT_AND_ALLOW_WHILE_IDLE` fired on schedule with the
        tablet locked and unplugged from USB for 15 minutes — the OS-level
        alarm mechanism survives Doze.
      - With ringer on and lock-screen notifications enabled, the notification
        played sound and appeared on the lock screen — matches CLAUDE.md §6's
        actual requirement (high-importance channel, alarm-category sound).
      - **Gotcha:** Notifee channel settings (sound, vibration, visibility)
        cannot be changed after the channel is first created — Android
        silently ignores updates. An early test created a channel with no
        sound configured, and every subsequent test on that channel ID stayed
        silent regardless of system-settings toggles, until the code used a
        new channel ID. If a real device's notifications ever seem stuck on
        old behaviour after a channel-config change, this is why — bump the
        channel ID rather than debugging system settings.
      - **Screen-wake was tried and explicitly dropped as out of scope.**
        `SET_ALARM_CLOCK` + `AndroidCategory.ALARM` + `fullScreenAction` +
        the `USE_FULL_SCREEN_INTENT` manifest permission still did not turn
        the screen on on this Samsung tablet. This matches known,
        widely-reported OEM behaviour — Samsung suppresses forced screen-wake
        for third-party apps even with every relevant flag set, generally
        reserving it for the system Clock app. CLAUDE.md §6 does not require
        screen-wake, only sound + high importance, so this was not pursued
        further. Do not re-attempt this without a specific reason.
- [ ] Notification actions (Taken, Snooze, Skip) work from the lock screen
      without unlocking.
- [ ] The app survives several days unopened without Samsung's unused-app sleep
      killing its alarms.
- [ ] Battery Saver mode does not suppress alarms once whitelisted.
- [ ] Do Not Disturb overnight behaviour with an alarm-category channel.
- [ ] Notifee, MMKV and expo-background-task all support the New Architecture in
      the chosen Expo SDK version. Expo defaults to New Arch; a library that does
      not support it fails in confusing ways.
- [ ] Medication photo renders legibly on the lock screen at notification size.

---

## Decision log

Reversals go here with a reason, so the history is visible.

| Date | Decision | Reason |
|---|---|---|
| — | Notifee over expo-notifications | Exact alarms through Doze, and `getPowerManagerInfo()` for OEM battery intents |
| — | Android first, iOS second | Windows dev machine, no Mac, no free path to the iPhone |
| — | Domain layer designed to the iOS constraint | Prevents the iOS port becoming a rewrite |
| — | Hand-rolled occurrence generator, not `rrule` | RFC 5545 does not model tapers, cycles or PRN intervals |
| — | Local-only in V1, no server | Reminders must work offline; health data on a server brings obligations not worth taking on in week one |
| — | Name: Lyfr | Old Norse *lyf*, medicine. Short, fits an icon label, avoids the Lyft collision better than bare "Lyf" |
| — | Nordic blue palette | Steady and reliable over clinical; see `CLAUDE.md` §7 |
| 2026-09-23 | Added "Vitamin" as a 9th medication form, alongside the 8 in `CLAUDE.md` §5's table | Target users (§1) are likely taking supplements alongside prescriptions; a distinct form lets the medicine list visually separate them. Behaves like tablet/capsule (count-based dosing) — see `src/domain/medication.ts`. |

---

## Notes for whoever picks this up

The developer is new to React Native. Expo **is** React Native — same
components, same Metro, same Hermes. The distinction that matters is Expo
tooling versus the bare RN CLI, and that is a build-tooling choice, not a
framework one. `expo prebuild` generates real `android/` and `ios/` directories
that can be opened and edited if native work is ever needed, so nothing is
locked in.

When explaining a choice, explain the constraint behind it rather than just the
API. The reliability work in this project is unusual and the reasoning is worth
carrying forward.

This is also a portfolio project. Where there is a choice between a clever
approach and one that is legible to a reviewer reading the repo cold, prefer the
legible one.

### Windows gotcha: Samsung MirrorService fights adb

If the tablet is plugged into this PC via USB, Samsung's background
`MirrorService.exe` (part of the Samsung PC companion software, launched
automatically on USB connect) starts its own bundled adb server on an older
version. It repeatedly kills and replaces the SDK's adb server, so every `adb`
command fails or behaves inconsistently — version-mismatch churn, dropped
wireless sessions, "no devices found."

Fix: `adb kill-server && adb start-server`, then reconnect. Killing
`MirrorService.exe` directly returns Access is denied (it runs with elevated
privileges) — don't fight it, just restart the adb server after it's done its
damage. It does not reliably prevent itself from interfering again.

### Windows gotcha: wireless adb was too flaky for a full build

Despite the walkthrough in §9 preferring wireless debugging, in practice the
wireless (`adb connect <ip>:<port>`) session repeatedly died mid-build with
`error: closed` / `device offline`, independent of screen state — most likely
Wi-Fi radio power-saving on the tablet or router-side idle-connection handling,
not screen timeout. This killed multiple `expo run:android` attempts before
Gradle even started.

**For now, use USB for anything longer-running (a full native build).**
Wireless is fine for quick one-off `adb shell getprop` checks. Revisit once
soak-testing with the tablet genuinely unplugged is the actual goal — at that
point wireless is required anyway and the flakiness will need a real fix
(check the tablet's per-network Wi-Fi power-saving toggle, not just screen
timeout).

### Windows gotcha: Android Studio's bundled JDK is too new for AGP's native tooling

Android Studio (as of this install) bundles JBR 25 as `java`. Current Android
Gradle Plugin / Prefab tooling misreads a benign JDK 24+ stderr line
(`WARNING: A restricted method in java.lang.System has been called`) as a
fatal build failure during `configureCMakeDebug` for every native module
(Notifee, Reanimated, Screens, Sentry, nitro-modules all failed this way).

Fix: installed a separate JDK 17 (`winget install Microsoft.OpenJDK.17`,
landed at `C:\Program Files\Microsoft\jdk-17.0.20.101-hotspot`) and pointed
`JAVA_HOME` and `PATH` at it instead of Android Studio's `jbr`. Android Studio
keeps using its own bundled JDK for its own UI; this only affects command-line
Gradle builds. If a Gradle daemon was already started under the wrong JDK,
`gradlew --stop` before rebuilding — daemons don't pick up an env var change
retroactively.

### Windows gotcha: Notifee has no Expo config plugin

`@notifee/react-native`'s native Android dependency (`app.notifee:core`)
ships as a local Maven repo bundled inside
`node_modules/@notifee/react-native/android/libs`, not a published remote
artifact. Notifee ships no Expo config plugin to register this repo, so a
plain `expo prebuild` produces a `build.gradle` that fails dependency
resolution (`Could not find any matches for app.notifee:core:+`).

Fix: added a local config plugin, `plugins/withNotifeeAndroidRepo.js`,
registered in `app.json`, which patches `android/build.gradle`'s
`allprojects.repositories` block on every prebuild to add that local Maven
path. Necessary because `android/` is regenerated (and git-ignored) — a
manual edit to `build.gradle` would be silently lost on the next
`expo prebuild --clean`.

### Windows gotcha: app stuck on white splash screen means Metro isn't reachable

`expo run:android` starts its own Metro instance as part of the build, but
that instance dies with the build's background process once the command
finishes — it does not keep running the way a separate `expo start` does. If
the app is later force-stopped and relaunched (e.g. via `adb shell monkey`)
without a live Metro server, it hangs on the native splash screen
indefinitely — no crash, no error, just white.

Two independent things can cause this and both need checking:
1. No Metro process is actually running — start one with `expo start`.
2. `adb reverse tcp:8081 tcp:8081` is missing or was dropped. This forwards
   the device's view of `localhost:8081` to the PC's Metro server over USB,
   and it does not survive an adb server restart (which MirrorService causes
   often — see above). Re-run it after any adb server restart, before
   relaunching the app.

`adb logcat` showed `ActivityTaskManager: Launch timeout has expired, giving
up wake lock!` in this state — a useful signal that the activity launched
natively but React Native never finished mounting, pointing at the JS bundle
never arriving rather than a native crash.

**A third cause, found 2026-09-23:** a previous `expo start`/`expo run:android`
background process can leave an orphaned `node.exe` still bound to port
8081 after being killed (via `TaskStop` or similar), even though it no
longer serves anything useful. A fresh `expo start` then fails outright
(`Port 8081 is being used by another process` — non-interactive mode can't
answer the "use port 8082 instead?" prompt, so it just skips starting the
dev server, silently). Symptom on the PC side beforehand: a plain
`curl localhost:8081/status` hangs indefinitely rather than returning
quickly, which is the tell that something dead is squatting on the port
rather than Metro being merely unreachable from the device. Fix: find and
kill it — `Get-NetTCPConnection -LocalPort 8081` → `Stop-Process` (or
`taskkill /F /PID`) — then start Metro again.

### Windows gotcha: Drizzle's generated migrations.js needs Metro + Babel setup, not just drizzle-kit

`drizzle-kit generate` (config: `driver: "expo"`) produces
`src/db/migrations/migrations.js`, which does `import m0000 from
'./0000_..._man.sql'` — a raw `.sql` file import. Out of the box, Metro
doesn't know what to do with that, and simply adding the extension to
`resolver.sourceExts` in `metro.config.js` makes Metro resolve the file but
then try to parse its contents as JavaScript (`SyntaxError: Missing
semicolon`), since resolving and transforming are separate steps.

Full fix, three parts:
1. `metro.config.js` — add `"sql"` to `config.resolver.sourceExts`, so Metro
   is willing to resolve the import at all.
2. `babel.config.js` — add the `babel-plugin-inline-import` plugin
   (`{ extensions: [".sql"] }`), which is what actually inlines the file's
   raw text as a JS string at build time. Needed devDependency:
   `babel-plugin-inline-import`.
3. Adding a custom `babel.config.js` for the first time (there wasn't one
   before) meant Metro no longer used Expo's implicit default Babel config —
   ours has to include `presets: ["babel-preset-expo"]` explicitly, and that
   package turned out to only exist nested inside
   `node_modules/expo/node_modules/babel-preset-expo`, not hoisted to the
   project root. Metro's Babel transformer resolves presets from the project
   root, so it silently failed to construct a transformer at all
   (`Cannot find module 'babel-preset-expo'`) — surfaced as a confusing,
   unrelated-looking `Bundler.js` crash (`Cannot read properties of
   undefined (reading 'transformFile')`) with the real cause only visible a
   few lines earlier in the log as `Failed to construct transformer:`.
   Fixed by adding `babel-preset-expo` as an explicit devDependency.

Lesson for next time something looks like an unrelated Metro internals crash:
grep the log for `Failed to construct transformer` before chasing the
stack trace that's actually printed last — Metro's Bundler swallows that
construction error into a state that surfaces much later as a confusing
`undefined` crash on the next bundle request.

Also: any change to `metro.config.js` or `babel.config.js` requires a full
Metro restart (`expo start --clear`), not just a JS reload — Metro doesn't
hot-reload its own config, and stale per-file transform caches can mask
whether a fix actually worked.

### Environment setup performed this session (Windows, user-level)

For whoever sets up a new machine — these are the non-default steps this
project's dev environment needed beyond a stock Expo/Android Studio install:

- `ANDROID_HOME` → `%LOCALAPPDATA%\Android\Sdk`, `platform-tools` added to
  user `PATH`.
- `JAVA_HOME` → `C:\Program Files\Microsoft\jdk-17.0.20.101-hotspot` (not
  Android Studio's bundled JBR — see gotcha above), its `bin` added to user
  `PATH`.
- Both are **user-level environment variables** — take effect in new terminal
  sessions only, not ones already open.
