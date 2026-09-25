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

## Checks

```sh
node tests/regression.cjs
node tests/calendar.cjs
node tests/benchmarks.cjs
node tests/rotation.cjs
```

The calendar suite uses synthetic records, a controllable clock and local-storage simulation. It covers migration, sparse history, calendar boundaries, DST, leap days, routine changes, backup restoration, drafts across midnight, date correction, backfill, rotation and failed saves.

Before publishing, inspect the exact diff and verify the local browser UI. Publishing requires the user's authorization. The existing service worker fetches new app files online and retains an offline fallback; do not clear site data to update the app.
