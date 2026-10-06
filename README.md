# Bar.Log

A browser-local calisthenics log. Static files are hosted on GitHub Pages; training records stay in the browser under `barlog.v1`. Repository files contain no personal workout backups.

## Tabs

Train, Progress and Data. There is no Edit tab: targets move through step ups and stage switches, exercises change through one-time repairs shipped with the app, and `editField` is the only programmatic hook for changing an exercise. "Use revised routine" still appears in the header when a newer default plan exists.

## Calendar and recovery

- Calendar weeks are seven-day windows from one saved `calendar.startDate`. They advance with local calendar dates and continue beyond week 8. UTC date-only arithmetic avoids daylight-saving shifts.
- Existing installations start from the earliest valid, non-future saved workout date. This is an inference stored once, without a calendar-start adjustment control. New installations start today. Once set, the date stays fixed even when older workouts are added or deleted.
- Routine updates, adoption and archive restoration never reset the calendar. Restoring an entire backup restores its calendar too.
- History labels are calculated from workout dates. Legacy `history[].week` values remain untouched and appear as original labels in expanded details. New entries have `weekSource: "calendar"`; their stored `week` is an export snapshot. UI labels always derive from dates.
- The root `week` is retained for compatibility, not scheduling. Exports refresh it from the calendar.
- `targetMode` is a per-workout choice shown in Train as Light session today, independent of calendar weeks. Light ("reduced") uses the former reduction formula, about 60% of the sets. It turns off when the workout is finished, or on a later day (`lightDate`) if no set was logged; a workout in progress over midnight stays light. An old installation already using reduced week-four targets keeps Reduced until its next finish. Switching never changes logged values. Backfill has its own Full/Light choice.
- Optional benchmarks are available at any time and take actual measured reps or seconds in blank result fields, with no preset result. Result entry does not automatically start a rest timer; ordinary set chips retain their timers. The old manual week picker, automatic week-four reduction and week-eight gate are removed.

## Rotation and dates

Train leads with a prominent current-workout card. A–D and benchmarks are selected through a collapsed Change workout control with a named confirmation. Switching is blocked while any sets are logged, so a draft cannot be mixed with another workout. An empty legacy selection defaults to the next rotation entry; a confirmed override persists across reloads and rest days.

A–D is independent of elapsed weeks. Finish selects the successor of the session actually completed; benchmarks do not advance it. Empty sessions cannot be finished. Failed saves retain the unfinished workout and do not advance the rotation. Backdated entries leave the rotation alone by default; users can explicitly choose to advance. Rotation adjustments never switch an unfinished draft to a different session.

Unfinished logs keep their original dates over midnight. Empty drafts roll forward. The calendar refreshes on focus, visibility change and a date-change check once per minute; no continuous screen redraw occurs.

## Step ups and milestones

Each exercise's written progression is encoded as a ladder in `LADDERS`, keyed by exercise ID and unit. The app suggests changes; targets change only when the user accepts. Custom exercises, changed units, benchmarks, time budgets and routines older than the current plan version get no ladder. Renaming a default exercise keeps its ladder.

- A "one" ladder adds a rep or second to the first set holding the lowest target (5×1 → 1×2 + 4×1 → … → 5×2). An "all" ladder adds to every set. Stepping back retraces the same rungs. Uneven targets live in the optional `perSet` array; a programmatic change to sets or reps (`editField`) replaces them.
- An exercise with an `alt` list (C pull ups: Overhand / Underhand) alternates each session. Train shows which one is next, the finished record stores it as `variant` on the detail item, and Last/Before, history, backfill and the AI summary show it. The next variant follows the last recorded one; a session logged before the list existed counts as the first entry. Both variants count toward the ladder. `gripAlternationVersion` adds the list once to saved plans whose C pull ups are still the default; a renamed exercise or a deliberate removal is left alone.
- Train hides the "When to progress" text on exercises with an active ladder, since the step card shows the rule in action; exercises without a ladder keep it.
- Finish offers a Clean / Grindy / Ache check-in. Grindy or Ache can name exercises; naming none applies it to the whole session. History records store `feel`, optional `feelEx`, and each exercise's full `target`.
- A session counts toward a step up only if it was rated Clean for that exercise, used Normal targets, matched the current target and met every set. Records without a rating or target, including all history from before this feature, never count. Each ladder sets how many consecutive counting sessions it needs (1 or 2).
- Ache on a named exercise offers one step back next time. Unnamed ache blocks step ups without suggesting a step back.
- A workout offers one step up at a time, going to the ready exercise that has waited longest since its last change. After a change is accepted, other step ups in that workout wait until it has been trained again, whether live or by a backfill dated on or after the change.
- A ladder's optional `stages` list the variations in order (push ups → pike push ups → elevated pike push ups; tuck planche → flat tuck → advanced tuck → band-assisted straddle planche; tuck front lever → advanced tuck → one-leg → straddle front lever, applied to A and C together; ring support hold → rings turned out). A stage may set `trackBand`, which adds the band field to Train and records the band on each session. At the top of the ladder the milestone offers the next stage; accepting renames the exercise, sets its note, restarts the climb at the stage's dose and logs a Switched entry. A renamed exercise is not in the chain and gets only Got it.
- At the top of a ladder a milestone describes the planned next step. Some offer a reset to a restart dose; all can be acknowledged. Not yet hides a suggestion until that workout's next session.
- Exercises that appear in two workouts share one ladder (`POOLS`): tuck front lever on A and C, band external rotations on B and D. Sessions of either workout count toward the streak, and a step up, step back or reset changes both, each at its own set count. A shared step waits while either workout has another untrained change, and Not yet covers both.
- Next-day soreness: before any set is logged, Train asks once a day how you feel (Fresh / A bit sore / Too sore, or Skip today). The answer is stored as `soreness` on the most recent session, once it finished at least four hours ago (`finishedAt`, so a session after midnight still counts) and within three days, and can be changed that day. Sessions saved before finish times were recorded qualify by date alone; a backfill dated today counts as just finished. A Too sore session never counts toward a step up, and Too sore after the first session at a new target offers a step back. Unanswered days count as neutral. Ache or Too sore in two sessions within a week suggests a light session.
- Lever, tuck planche and the planche lean use "half" steps, following "add 1s to some holds, then all": from even targets the first half of the sets goes up, then the rest.
- `progress` state (`log`, `pending`, `snooze`, `acks`, `reducedSnooze`, `readyDate`, `readySkip`) belongs to the ongoing log like the calendar: plan switches keep it, and backups include it.

## Workout support

- The screen stays awake (Screen Wake Lock) while the current workout has logged sets, so the rest timer and its alert stay live. The browser drops the lock when the app is hidden; it is requested again on return. Browsers without the API are unaffected.
- Progress lists Grindy and Ache flags per exercise for the last six weeks. Ache in two sessions within seven days suggests making today a light session; it never switches automatically, and Not now holds until a newer ache.
- Review with AI builds a plain-text summary on the device: current plan, the last six weeks of sessions with check-ins and missed targets, step ups and latest maxes. Share or copy it into an AI assistant; nothing is sent anywhere by the app.

## Max tests

Regular exercises carry a `max` key naming their benchmark (`maxKeysVersion` adds it once to saved default exercises): tuck front lever on A and C → lever, HSPU → hspu, C pull ups → pullup, fingertip hold → fingertip, tuck planche → planche. A max is due when no result for that key has been recorded in six weeks, or ever; at most one max is scheduled in any seven days; none on a light session or a wrist break. The first due benchmark of the current workout goes in after the warm-up, that exercise runs at light (60%) sets for the day, and the day never counts toward its ladder nor trains a pending change on it. `today.maxTest` is undefined (automatic), a key (chosen, including a manual choice between two candidates) or `false` (switched off for this workout); it resets with the draft, on clear and on a workout change. The finished record carries `maxTest`, shown in Last/Before ("· max day"), history and the AI summary. The T session remains for a dedicated benchmark day.

## Wrist break

Palms-down exercises carry a `wrist` cue (text, or `true` for "Skip today."), added once to saved default exercises by `wristCuesVersion`. The Wrist break today switch next to Light session dims those exercises in Train and shows the cue (bar swap or skip); they stay loggable for bar versions. It applies to the current workout only: finishing turns it off, an unused switch ends with the day, and a draft over midnight keeps it. The finished record carries `wristBreak`. Such sessions never count toward the ladders of palms-down exercises and do not clear a pending change on one; other exercises count as usual. Last/Before, history, the check-in review and the AI summary mark wrist-break sessions.

## Backups

Share hands the backup to the share sheet as a `.txt` file holding the same JSON, because Chrome only shares files of listed types and refuses `.json`; Restore accepts either. A share that fails for any reason other than cancelling saves the file to Downloads instead, since a failed share cannot be retried without a fresh tap. `S.backup` records the date and history length of the last completed export, copy or share. A reminder appears in Progress after eight sessions, or after fourteen days with at least one new session, and after five sessions when no backup has been made. Data shows the backup status and, when the app is not installed, an install prompt (the browser's own, where offered).

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
