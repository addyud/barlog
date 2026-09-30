# Bar.Log

A browser-local calisthenics log. Static files are hosted on GitHub Pages; training records stay in the browser under `barlog.v1`. Repository files contain no personal workout backups.

## Calendar and recovery

- Calendar weeks are seven-day windows from one saved `calendar.startDate`. They advance with local calendar dates and continue beyond week 8. UTC date-only arithmetic avoids daylight-saving shifts.
- Existing installations start from the earliest valid, non-future saved workout date. This is an inference stored once, without a calendar-start adjustment control. New installations start today. Once set, the date stays fixed even when older workouts are added or deleted.
- Routine updates, adoption and archive restoration never reset the calendar. Restoring an entire backup restores its calendar too.
- History labels are calculated from workout dates. Legacy `history[].week` values remain untouched and appear as original labels in expanded details. New entries have `weekSource: "calendar"`; their stored `week` is an export snapshot. UI labels always derive from dates.
- The root `week` is retained for compatibility, not scheduling. Exports refresh it from the calendar.
- `targetMode` is an explicit Normal/Reduced choice, independent of calendar weeks. Reduced targets keep the former reduction formula. An old installation already using reduced week-four targets retains Reduced; otherwise it starts Normal. Switching modes never changes logged values. Backfill has its own target choice.
- Optional benchmarks are available at any time and take actual measured reps or seconds in blank result fields, with no preset result. Result entry does not automatically start a rest timer; ordinary set chips retain their timers. The old manual week picker, automatic week-four reduction and week-eight gate are removed.

## Rotation and dates

Train leads with a prominent current-workout card. A–D and benchmarks are selected through a collapsed Change workout control with a named confirmation. Switching is blocked while any sets are logged, so a draft cannot be mixed with another workout. An empty legacy selection defaults to the next rotation entry; a confirmed override persists across reloads and rest days.

A–D is independent of elapsed weeks. Finish selects the successor of the session actually completed; benchmarks do not advance it. Empty sessions cannot be finished. Failed saves retain the unfinished workout and do not advance the rotation. Backdated entries leave the rotation alone by default; users can explicitly choose to advance. Rotation adjustments never switch an unfinished draft to a different session.

Unfinished logs keep their original dates over midnight. Empty drafts roll forward. The calendar refreshes on focus, visibility change and a date-change check once per minute; no continuous screen redraw occurs.

## Step ups and milestones

Each exercise's written progression is encoded as a ladder in `LADDERS`, keyed by exercise ID and unit. The app suggests changes; targets change only when the user accepts. Custom exercises, changed units, benchmarks, time budgets and routines older than the current plan version get no ladder. Renaming a default exercise keeps its ladder.

- A "one" ladder adds a rep or second to the first set holding the lowest target (5×1 → 1×2 + 4×1 → … → 5×2). An "all" ladder adds to every set. Stepping back retraces the same rungs. Uneven targets live in the optional `perSet` array; editing sets or reps in Edit replaces them.
- Train hides the "When to progress" text on exercises with an active ladder, since the step card shows the rule in action; exercises without a ladder keep it. Edit still shows every exercise's text.
- Finish offers a Clean / Grindy / Ache check-in. Grindy or Ache can name exercises; naming none applies it to the whole session. History records store `feel`, optional `feelEx`, and each exercise's full `target`.
- A session counts toward a step up only if it was rated Clean for that exercise, used Normal targets, matched the current target and met every set. Records without a rating or target, including all history from before this feature, never count. Each ladder sets how many consecutive counting sessions it needs (1 or 2).
- Ache on a named exercise offers one step back next time. Unnamed ache blocks step ups without suggesting a step back.
- A workout offers one step up at a time, going to the ready exercise that has waited longest since its last change. After a change is accepted, other step ups in that workout wait until it has been trained again, whether live or by a backfill dated on or after the change.
- At the top of a ladder a milestone describes the planned next step. Some offer a reset to a restart dose; all can be acknowledged. Not yet hides a suggestion until that workout's next session.
- Exercises that appear in two workouts share one ladder (`POOLS`): tuck front lever on A and C, band external rotations on B and D. Sessions of either workout count toward the streak, and a step up, step back or reset changes both, each at its own set count. A shared step waits while either workout has another untrained change, and Not yet covers both.
- Next-day soreness: before any set is logged, Train asks once a day how you feel (Fresh / A bit sore / Too sore, or Skip today). The answer is stored as `soreness` on the latest earlier session within three days and can be changed that day. A Too sore session never counts toward a step up, and Too sore after the first session at a new target offers a step back. Unanswered days count as neutral. Ache or Too sore in two sessions within a week suggests Reduced targets.
- Lever, tuck planche and the planche lean use "half" steps, following "add 1s to some holds, then all": from even targets the first half of the sets goes up, then the rest.
- `progress` state (`log`, `pending`, `snooze`, `acks`, `reducedSnooze`, `readyDate`, `readySkip`) belongs to the ongoing log like the calendar: plan switches keep it, and backups include it.

## Workout support

- The screen stays awake (Screen Wake Lock) while the current workout has logged sets, so the rest timer and its alert stay live. The browser drops the lock when the app is hidden; it is requested again on return. Browsers without the API are unaffected.
- Progress lists Grindy and Ache flags per exercise for the last six weeks. Ache in two sessions within seven days suggests Reduced targets; it never switches automatically, and Not now holds until a newer ache.
- Review with AI builds a plain-text summary on the device: current plan, the last six weeks of sessions with check-ins and missed targets, step ups and latest maxes. Share or copy it into an AI assistant; nothing is sent anywhere by the app.

## Backups

`S.backup` records the date and history length of the last completed export, copy or share. A reminder appears in Progress after eight sessions, or after fourteen days with at least one new session, and after five sessions when no backup has been made. Data shows the backup status and, when the app is not installed, an install prompt (the browser's own, where offered).

## Checks

GitHub Actions runs every suite on each push and pull request (`.github/workflows/tests.yml`).

```sh
node tests/regression.cjs
node tests/calendar.cjs
node tests/benchmarks.cjs
node tests/rotation.cjs
node tests/progression.cjs
node tests/tools.cjs
```

The calendar suite uses synthetic records, a controllable clock and local-storage simulation. It covers migration, sparse history, calendar boundaries, DST, leap days, routine changes, backup restoration, drafts across midnight, date correction, backfill, rotation and failed saves.

Before publishing, inspect the exact diff and verify the local browser UI. Publishing requires the user's authorization. The existing service worker fetches new app files online and retains an offline fallback; do not clear site data to update the app.
