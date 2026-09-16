# Lyfr

A medication reminder app for elderly users. React Native (Expo), TypeScript.

Read this file before doing anything. Current task state and open questions live
in `STATE.md`.

## This is a living document

Everything here is provisional and subject to change. It is a starting position
worked out before any code existed, not a contract.

Expect the schedule types, the V1 scope line, and specific library choices to
move once real regimens and real device behaviour are known. When something in
this file turns out to be wrong or unworkable, **say so and ask** — do not
silently work around a stale decision, and do not treat a section as settled
just because it is written down. Log reversals in the decision table in
`STATE.md` with the reason.

Three things should be treated as firm unless the developer explicitly changes
them, because they are what stop the app from either becoming a rewrite or
failing silently:

- the permanently out-of-scope list (§2)
- the iOS-constraint rule for the domain layer (§3)
- the heartbeat (§3)

Everything else is open.

---

## 1. What this is and who it is for

Lyfr helps people who take many medications remember **what** to take and
**when**, and lets a family member see whether doses were actually taken.

The primary users are the developer's parents. Both take a large number of
medications daily and struggle to remember the drug names, which are unfamiliar
generic terms. The mother uses a Samsung Android phone. The father uses an
iPhone.

The name is from Old Norse *lyf*, meaning medicine or healing herb. It survives
in modern Icelandic as the everyday word for medicine.

### Design consequences of the user base

These are not style preferences. They follow from who is using the app.

- **A reminder that silently stops firing is worse than no app at all.** The
  hardest problem in this codebase is not the UI; it is guaranteeing that
  notifications actually fire on hostile Android OEM builds. Reliability work is
  never "polish to do later."
- **Recognition beats reading.** Users cannot reliably read or recall generic
  drug names. Every medication carries three redundant identifiers: a form icon,
  a colour tag, and a photograph of the actual packaging.
- **The app is a backup, not a replacement.** Users keep their pill organiser
  and whatever system they already have. Copy and UX must never imply the app is
  the sole source of truth. If the app fails, nothing catastrophic happens.

---

## 2. Non-negotiables

### Permanently out of scope

Do not build these. Do not propose them. If asked, refer back to this section.

- **Drug interaction checking.** Data sources are expensive or unreliable and a
  bug here could cause real harm.
- **Dose recommendations, or any guidance on whether to take something.** The
  app's job is exactly three verbs: remind, identify, log.
- **Anything positioning the app as a replacement** for the user's existing
  system or for medical advice.

### Always true

- No account, no server, no network dependency in V1. Reminders must fire with
  the device fully offline. Never use push notifications for reminders.
- Medications are archived, never hard deleted. Adherence history depends on
  them existing.
- Dose log edits are appended, never destructive. Keep the original value and an
  edit timestamp.
- Every status is communicated by **colour plus icon plus text label**. Never
  colour alone — some Samsung power saving modes desaturate the display, and
  red/green colour deficiency is common in the target demographic.
- All text respects OS font scaling. Never disable `allowFontScaling`. Test at
  the largest OS font setting.
- Supply counts are **estimates** and must be labelled as such in the UI. They
  are always manually correctable.

---

## 3. Architecture

### The central rule: design the domain layer to the iOS constraint

Android can run arbitrary code when an alarm fires. iOS cannot — a notification
fires and none of our code executes until the app is next opened. If the domain
layer assumes Android's capability, the iOS port becomes a rewrite.

Therefore:

- The scheduler computes a **batch of concrete `DoseOccurrence` rows ahead of
  time** from a regimen. Everything downstream consumes that batch.
- **Reconciliation happens on app launch**, not at fire time. Figuring out what
  was missed while the app was closed is a pure function over stored
  occurrences.
- Android's extra power (immediate snooze rescheduling, background self-healing)
  is an **enhancement layered on top**, never a foundation.

### Layout

```
src/
  domain/         regimens, occurrence generation, adherence — pure TS, zero platform code
  scheduling/
    Scheduler.ts        the interface
    AndroidScheduler.ts
    IosScheduler.ts
    reconcile.ts        shared — what was missed while we were away
  db/             drizzle schema, migrations, queries
  ui/             screens and components (shared across platforms)
  theme/          design tokens
```

### The Scheduler interface

Keep it narrow. Platform-specific code lives behind it and nowhere else.

```ts
interface Scheduler {
  syncRegimen(regimen: Regimen): Promise<void>;  // idempotent
  cancelRegimen(id: string): Promise<void>;
  refillWindow(): Promise<void>;                 // top up pending notifications
  pendingCount(): Promise<number>;               // health check
}
```

`refillWindow()` exists because **iOS caps pending local notifications at 64**.
With eight daily doses that is only eight days of runway before reminders
silently stop. Schedule roughly seven days ahead and top up on every app
foreground and every background wake.

`pendingCount()` is how we detect that iOS has quietly run dry.

**Do not scatter `Platform.OS` checks through components.** If platform
branching is creeping into the UI layer, the abstraction is in the wrong place.

### The heartbeat

The app does not assume the OS honoured its alarms. It verifies.

- Every scheduled notification logs its **expected fire time** to
  `notification_log`.
- When a notification is delivered or the app launches, log the **observed fire
  time**.
- On launch, and via a periodic background task on Android, compare expected
  against observed.
- If fires are being missed, show a persistent banner: reminders may not be
  working on this device, with a button back into the battery settings
  walkthrough.

This is the single most important subsystem in the app. It is also the best
thing in the codebase to explain in a technical writeup.

---

## 4. Tech stack

Pin to the current Expo SDK and verify New Architecture support for every native
library before committing to a version.

| Concern | Choice | Notes |
|---|---|---|
| Framework | React Native via **Expo**, development build | `expo prebuild` + `expo run:android`. **Not Expo Go** — it cannot load the required config plugins. |
| Language | **TypeScript**, strict | |
| Navigation | **expo-router** | Navigation is at most two levels deep. |
| UI state | **Zustand** | No server in V1, so no TanStack Query, no Redux. |
| Database | **expo-sqlite** + **Drizzle ORM** | drizzle-kit for migrations. The schema *will* change once real regimens are known and user data cannot be wiped. |
| Reactive queries | Drizzle **`useLiveQuery`** | Today view updates when a dose is acknowledged from a notification. |
| Small flags | **react-native-mmkv** | Onboarding complete, last reconcile timestamp, walkthrough verified. Synchronous. |
| Notifications | **Notifee** | See below. Not `expo-notifications`. |
| Background checks | **expo-background-task** | Periodic heartbeat self-check on Android. |
| Photos | **expo-image-picker** (system camera), **expo-image-manipulator**, **expo-file-system**, **expo-image** | |
| Dates | **date-fns** | |
| Tests | **Vitest** | |
| Lint/format | **Biome** | |
| Crash reporting | **@sentry/react-native** | From day one. The app runs on phones the developer cannot physically access. |
| Styling | Plain `StyleSheet` + tokens file | No UI kit. Font scaling and contrast are easier to control when we own the components. |
| iOS builds | **EAS Build** | Developer is on Windows with no Mac. This is the only route to an iOS build. |

### Why Notifee rather than expo-notifications

`expo-notifications` does not expose what alarm-grade Android scheduling needs.
Notifee gives us:

- `AlarmType.SET_EXACT_AND_ALLOW_WHILE_IDLE` — exact alarms that fire through
  Doze. This is the core requirement.
- `getPowerManagerInfo()` — returns the OEM-specific battery settings intent for
  the current device, including Samsung. Purpose-built for the whitelisting
  problem; saves hand-maintaining a manufacturer intent table.
- `openBatteryOptimizationSettings()` and `openAlarmPermissionSettings()` for
  the onboarding walkthrough.
- Full channel, importance, category and action-button control, with actions
  handled in a background event handler so Taken and Snooze work without opening
  the app.
- A `TimestampTrigger` API that also works on iOS, keeping the `Scheduler`
  interface clean.

**Verify, do not assume:** Notifee is documented to reschedule trigger
notifications after reboot, but reboot behaviour varies by OEM. Actually reboot
the test device and confirm alarms return before relying on it.

### Explicitly rejected

- Expo Go — cannot load the required config plugins.
- AsyncStorage as the primary store — the adherence log needs real queries.
- JS `setTimeout` for scheduling — does not survive app suspension.
- FCM or any push-based reminder — requires network; reminders must work offline.
- Bare React Native CLI — on Windows the native build tooling cost is days.
- `rrule` / RFC 5545 — does not model tapers, cycles or PRN intervals well. The
  occurrence generator is hand-rolled as a pure function.

### Time zone handling

The Philippines has no daylight saving time, which removes the classic source of
medication reminder bugs (doses firing twice or not at all on a DST switchover).

Even so: **store occurrences as UTC epoch milliseconds, keep the rule in local
wall-clock terms.** A trip abroad must not shift the whole schedule.

---

## 5. Data model

```
medications        id (uuid), name, generic_name, form, description,
                   color_tag, photo_path, dose_amount, dose_unit,
                   notes, supply_remaining, supply_threshold,
                   archived_at, created_at, updated_at

regimens           id (uuid), medication_id, rule_type, rule_config (json),
                   start_date, end_date, active, created_at, updated_at

dose_occurrences   id (uuid), regimen_id, scheduled_at (utc ms), status,
                   acknowledged_at, actual_notification_id, created_at

dose_edits         id (uuid), occurrence_id, previous_status, new_status,
                   previous_time, new_time, edited_at

notification_log   id (uuid), occurrence_id, expected_fire_at,
                   observed_fire_at, channel, platform
```

### Deliberate choices

- **UUIDs generated on device**, not autoincrement integers. Every row also
  carries `updated_at`. This makes the eventual caregiver sync additive rather
  than a migration.
- **`rule_config` as JSON** gives room for the harder schedule types (cycles,
  tapers, PRN intervals) without a migration per rule type. Queryable fields stay
  as real columns.
- **`dose_occurrences` are materialised rows**, not computed on the fly. The
  scheduler needs concrete rows to map onto notification IDs, and adherence
  history needs a record that a dose was *expected* even if nothing happened.
- **`dose_edits` is an audit trail.** When reading the log remotely it matters
  whether a dose was taken or whether a mistake was corrected.

### Photos

Store the file via `expo-file-system` in the app document directory. Store only
the **relative path** in SQLite — absolute paths break, because the app
container path changes between installs and OS updates. Always resolve at read
time from `FileSystem.documentDirectory` plus the stored relative path.

Downscale on capture to roughly 800px on the long edge.

### Medication form drives everything

`form` is a first-class field, not cosmetic. It determines the dose unit picker,
the supply unit, the icon, and whether to prompt for a side.

| Form | Dose unit | Supply unit | Laterality |
|---|---|---|---|
| Tablet / capsule | count (0.5, 1, 2) | tablets | — |
| Liquid | ml or tsp | ml in bottle | — |
| Injection | units/IU or mg | pens/vials | site rotation |
| Drops | number of drops | poorly countable | left / right / both |
| Inhaler | puffs | puffs | — |
| Patch | one patch | patches | site rotation |
| Topical | application | tubes | site |

Drops and inhalers cannot be tracked accurately. Drop size varies and users
re-drop when they miss; inhalers usually have a better counter on the device
itself. The UI must label supply as estimated and allow manual correction.

---

## 6. Scope

### V1

**Medication library**
- Add medication: photo, name, generic name, form, form-driven dose unit
- Physical description field, colour tag, form icon
- Notes field
- Edit and archive

**Scheduling**
- Fixed daily times
- Specific weekdays
- Every N days
- Start date, optional end date

**Reminders**
- Lock screen notification, photo large, name secondary
- Actions: Taken, Snooze, Skip — handled without opening the app
- Grouped when several medications share a time
- High-importance channel, alarm-category sound
- Re-notify if unacknowledged after N minutes
- Rolling re-schedule so pending notifications never run dry
- Reschedule on reboot

**Logging**
- Taken / skipped / missed with timestamps
- Editable after the fact, with audit trail

**History tab**
- Week view
- Estimated supply remaining, manually correctable, low-supply warning

**Reliability layer**
- Heartbeat log, expected vs observed
- Missed-fire warning banner
- Samsung battery settings walkthrough with deep links
- Post-walkthrough verification with re-prompt

**Elderly UX baseline**
- Body text 18sp minimum, medication names 22sp minimum, nothing below 16sp
- Tabular numerals for times
- WCAG AAA (7:1) for body text
- Oversized touch targets
- No swipe gestures, no hidden menus, maximum two levels of navigation
- Confirmations resistant to accidental taps

**Backup**
- Export database plus photos to a shareable file

### V1.5

Lands without rework if the data model anticipates it.

- Cycles (21 on, 7 off), tapering doses, PRN with minimum interval
- Relative timing ("about 12 hours apart" rather than fixed clock times)
- Laterality for drops, site rotation for injections and patches
- Doctor-visit export (formatted history)
- Localised labels

### Later

- Widget showing the next dose — **Android first**. This is the most expensive
  "small" feature in the project. There is no cross-platform path: Android needs
  `react-native-android-widget` with its own layout system, iOS needs a WidgetKit
  extension in Swift plus App Groups. Budget a week, not an afternoon. Do it last.
- Caregiver view: read-only adherence, alert on missed doses. The local database
  stays the source of truth; push an append-only log of acknowledgements upward.
  Likely Supabase. Read up on health data handling before dose logs go on a
  server.
- Appointment and prescription renewal reminders

---

## 7. Design tokens

### Brand — Nordic blue

| Token | Hex | Use |
|---|---|---|
| Rime | `#EDF1F5` | Lightest surface |
| Frost | `#CBD9E5` | Light fills, borders |
| Fjord | `#7FA0BC` | Dark mode accent, icons |
| Sea | `#34688F` | Icons, large text, borders (6:1 on white) |
| Deep | `#1B4767` | **Any surface carrying white text** (9.9:1 on white) |
| Woad | `#0D2839` | Deepest ink |

Sea does not pass AAA for small text. Deep is the workhorse.

### Dose status

| Status | Treatment |
|---|---|
| Taken | Solid fill `#1B4767` + check icon |
| Upcoming | **Outline only**, `#5B6B78` + clock icon |
| Missed | Solid `#9A4E06` + exclamation icon |
| Skipped | Solid `#5B6B78` + minus icon |

Taken and Upcoming are distinguished by **fill versus outline**, not hue, since
the brand is blue. Solid means done. This survives colour vision deficiency and
greyscale rendering.

Missed is amber, never red. It is information, not an emergency. Red on a
medication app reads as "you did something dangerous."

### Medication tags

Okabe-Ito derived, colourblind-safe. Eight is the cap — beyond that they stop
being distinguishable and the colour coding stops working.

`#D55E00` vermillion · `#009E73` green · `#CC79A7` rose · `#E69F00` amber
`#7A3E9D` purple · `#56B4E9` sky · `#8C6D3F` brass · `#3F4A45` slate

No blue tag — brand blue owns that hue, and a blue tag would read as "this
medication is special."

### Dark mode

Build from day one. Users take doses at 10pm and 6am with the lights off.

Background `#0B1620` · Surface `#14212C` · Border `#263644` ·
Text `#E6EDF4` · Accent Fjord `#7FA0BC`

### Typography

System fonts only — San Francisco on iOS, Roboto on Android. They are the most
legible faces on each platform and they honour OS font scaling, which is the
single most important accessibility feature here.

The wordmark ("lyfr", lowercase) may use a geometric sans — Inter, Manrope or
Plus Jakarta Sans — on the splash and about screens only.

### Identity

This is a household object, not a medical device. Calm, not urgent. Avoid the
clinical vocabulary entirely: no red crosses, no sterile white-and-blue, no
alarm red, no syringe iconography.

**Logo:** an L monogram whose base curves into a cradle holding a dose dot. Deep
blue ground, white letterform, Fjord dot.

- **Android adaptive icons** are 108×108dp with only the inner 72dp guaranteed
  visible. One UI masks to a squircle. Keep the monogram inside that safe zone.
- **Android notification icons** must be a flat white silhouette on transparent.
  The system discards colour. Export a separate asset.

---

## 8. Devices and testing

| Device | Role |
|---|---|
| Samsung tablet (older, version TBC) | Primary test device. Real One UI, same battery management family as the target phone. |
| Android emulator (Pixel, API 34/35) | UI iteration only. **Has no Samsung battery management — it cannot validate reliability.** |
| Mother's Samsung phone | Target. Borrow for a session to verify the battery walkthrough. |
| Father's iPhone | Target. Requires a paid Apple Developer account. |

Dev machine is **Windows**. There is no iOS simulator available. There is also
no free path to installing on the iPhone — ad hoc distribution needs a
provisioning profile, which needs the $99/year Apple Developer account. Defer
that spend until the domain layer has stopped changing.

### Samsung One UI settings the walkthrough must cover

- **Settings → Battery → Background usage limits** → add to *Never sleeping
  apps*. If the app lands in Sleeping or Deep sleeping apps, alarms stop. This is
  the one that catches people.
- **"Put unused apps to sleep"** is on by default and will catch this app
  specifically, since the whole point is that the user interacts via
  notifications rather than opening it.
- **Adaptive Battery** — set the app to Unrestricted.
- **Settings → Apps → Lyfr → Auto-disable unused app** — turn off.

Deep-link into these screens rather than describing them in prose. Then
**verify**: check `pendingCount()` and whether recent alarms actually fired, and
re-prompt if they did not.

### Android permissions required

- `POST_NOTIFICATIONS` (runtime, Android 13+)
- `SCHEDULE_EXACT_ALARM` / `USE_EXACT_ALARM` (Android 12+)
- `RECEIVE_BOOT_COMPLETED`
- Battery optimisation exemption via `ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS`

### Testing strategy

**Doze does not engage while a device is charging.** A tablet parked on a desk
is almost always plugged in, and in that state the app will behave perfectly,
prove nothing, and give false confidence. For any reliability test: unplug,
screen off, do not touch it.

Two test tracks in parallel:

1. **Compressed** — a debug-only mode generating doses every 10–15 minutes, plus
   a log screen showing expected versus actual fire times. Finds logic bugs,
   drift, and grouping errors quickly.
2. **Soak** — a realistic schedule, unplugged, untouched for a week. Only this
   finds the OS killing the app. Deliberately exercise: reboot, low battery
   triggering Battery Saver, Do Not Disturb overnight, and several days without
   opening the app so unused-app sleep can trigger.

Useful adb commands:

```
adb shell dumpsys deviceidle force-idle     # force Doze
adb shell dumpsys deviceidle unforce
adb shell am set-inactive <package> true    # app standby bucket
adb shell getprop ro.build.version.release  # check Android version
```

**Do not design layouts against the tablet.** Font scaling, touch target
spacing and notification rendering differ on a phone. Check visuals against a
phone emulator profile.

---

## 9. Windows development environment

- Node LTS via fnm or nvm-windows
- Android Studio for the SDK and emulator
- Enable **Windows Hypervisor Platform** in Windows Features, and virtualisation
  in BIOS. Without hardware acceleration the emulator is unusable.
- `ANDROID_HOME` = `%LOCALAPPDATA%\Android\Sdk`, with `platform-tools` on PATH
- Add the project folder and `node_modules` to **Windows Defender exclusions** —
  Metro bundling is dramatically faster
- Enable long paths: `git config --system core.longpaths true` plus the Windows
  registry setting. Deep `node_modules` nesting will otherwise fail installs.
- **Do not develop inside WSL2.** USB access and emulator networking become a
  side quest.
- Prefer **wireless debugging** (`adb pair` then `adb connect`) — the test device
  should sit untethered for days.

---

## 10. Conventions

- The occurrence generator is a **pure function** and is the highest-risk logic
  in the codebase. It gets real unit tests with Vitest. This is also the first
  thing a reviewer will look at.
- Copy follows sentence case. No exclamation marks in system copy. Errors say
  what happened and what to do, in one sentence.
- Never write `Platform.OS` branches outside `src/scheduling/`.
- When adding a schedule type, extend `rule_config` and the generator. Do not add
  a column.
- Commit the Drizzle migration with the schema change that caused it.
