# Lyfr — working state

Volatile. Update this as work progresses. Longer-lived decisions belong in
`CLAUDE.md` — which is itself provisional; see the living-document note at the
top of it.

Everything in both files is subject to change. The ordering below is a plan, not
a commitment. If the work suggests a better sequence, say so rather than
following this list past the point where it stops making sense.

**Last updated:** 2026-09-17
**Phase:** scaffolded — Expo dev build running on the Samsung tablet

---

## Next up

1. [x] Scaffold the Expo project with a development build and confirm
   `expo run:android` installs to the Samsung tablet. Done — see decision log
   and environment notes below for what it took to get there.
2. [x] Get the Android version off the tablet — done, see Open questions.
3. Drizzle schema and first migration, per the data model in `CLAUDE.md`.
   Schema written (`src/db/schema.ts`), migration not yet generated/run.
4. [x] Occurrence generator as a pure function, with Vitest tests. Fixed daily
   times, specific weekdays, every N days. Done —
   `src/domain/regimen.ts` + `src/domain/occurrenceGenerator.ts`, 9 tests
   passing. Two judgment calls worth a second look once real regimens are
   known (see Open questions):
   - Regimen `startDate`/`endDate` are local calendar-date strings
     (`YYYY-MM-DD`), not epoch ms — CLAUDE.md §5 doesn't specify a type for
     these columns. Chosen to keep "start on this calendar day" unambiguous
     across timezones.
   - `every_n_days` anchors the interval to the regimen's own `startDate`,
     not the generation window's start. So a window that starts mid-cycle
     still lands on the correct days (confirmed by test). This is the only
     sane reading, but it means editing a regimen's start date reshuffles
     every future occurrence date for that rule type — worth surfacing in
     the UI if edits to an active every-N-days regimen become common.
5. `Scheduler` interface plus `AndroidScheduler` on Notifee. Prove one exact
   alarm fires through Doze on the unplugged tablet before building anything on
   top of it.
6. Heartbeat logging, then the Samsung battery walkthrough.
7. Medication library UI, then Today view, then history.

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
- [ ] Exact alarms fire through Doze on the unplugged tablet with the screen off.
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
