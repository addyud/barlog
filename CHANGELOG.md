# Bar.Log changelog

What changed and why, newest first. The short hash points to the commit, whose message has the full detail (`git show <hash>`). Where a commit recorded no reason, this says so rather than guessing.

Add an entry with every change that affects how the app behaves, including the reason.

## 2026-11

- **7c8d10c, Nov 13: Next up follows plan order; a workout swapped out for a wrist break is owed once.** Why: since the Oct 6 "longest ago" rule, sessions had settled into A, C, B, D, so A was always followed by C. The rule only continued whatever order was most recent, and wrist days that pushed C ahead of B once kept it that way. Next up is now the workout after the latest one trained (D wraps to A). A workout dropped by a wrist-break swap is owed once, then the cycle resumes after the swap. Found by replaying the Nov 13 backup.

## 2026-10

- **2b162f6, Oct 27: Calendar weeks run Monday to Sunday; quick session note.** No reason recorded in the commit.
- **22705a2, Oct 19: Planche work stays on wrist breaks; one-arm prep offers parallettes or a ring alternative.** Why: you only know on the day whether the wrist tolerates parallettes, so the choice is made on the day instead of being dropped outright.
- **80a7561, Oct 6: Offer another workout when a wrist break drops most of this one.** Why: a wrist break left D with only 2 of 6 exercises, so the app offers the workout trained longest ago that keeps at least half of its own. (Its "comes back next time" promise was reworked on Nov 13.)
- **8f4d228, Oct 6: Remove the missed-session form.** Why: logging after the fact was a one-off need; sessions are logged live.
- **6cbbf13, Oct 6: Next up is the workout trained longest ago.** Why: an out-of-order week (A, C, B) left D waiting while C came round again. Replaced on Nov 13 because the rule kept an A, C, B, D order going by itself.
- **1b11f47, Oct 6: Remove the Edit tab.** Why: targets move through step ups and stage switches, so the manual editor was unused.
- **f0cea3b and cf59e1e, Oct 6: Staged progressions for the front lever, ring support and planche.** Why: the milestones now offer the next named stage (advanced tuck, one-leg, straddle; flat tuck to band-assisted straddle) instead of a plain reset.
- **1d29564, Oct 6: Max tests scheduled automatically, one per workout when due.** Due after six weeks without a result, at most one a week, never on a light session or wrist break.
- **28b08ad, Oct 6: Per-workout wrist break.** Palms-down exercises are dimmed with a bar swap or a skip, and those sessions never count toward their ladders.
- **1f1f87d, Oct 6: Pike push ups offered at the push-up milestone.** Ladders can now list stages in order.
- **2b1e1e7, Oct 6: Alternate grip on C pull ups** (overhand and underhand by session).
- **e1d4e53, Oct 6: Backups share as a .txt file, and fall back to saving in Downloads.** Why: Chrome on Android refused to share .json, so Back up now reported "Share failed".

## 2026-09

- **ce66a3a, Sep 30: Per-workout light session replaces the sticky Reduced toggle.** The same ~60% set reduction, but it ends when you finish or the day ends.
- **b3f04bf, Sep 30: Soreness check targets the latest session, even one after midnight.** Why: A on 30/09 was skipped in favour of D on 28/09. Finished sessions now record `finishedAt`.
- **06f71c3, Sep 30: "When to progress" shows only for exercises without a ladder.** Laddered exercises already show their rule in the step card.
- **309e142, Sep 30: Shared ladders across workouts; step ups gated on next-day soreness.** The tuck front lever (A, C) and band external rotations (B, D) share one ladder each. A once-a-day Fresh, A bit sore or Too sore question gates step ups.
- **ebdf771, Sep 30: Faster lever and planche ladders; keep screen awake during a workout; check-in review; Review with AI; backup reminders; GitHub Actions test run.** Holds go up "some sets, then all" so lever 6s to 8s takes 4 rungs instead of 10.
- **4cfe97a, Sep 30: Suggested step ups, finish check-in (Clean, Grindy, Ache) and milestones.** Nothing changes until you accept a suggestion. Only clean sessions at the current target with every set met count.
- **3048794 and adff0b8, Sep 25: Deliberate workout selection; real benchmark results; calendar weeks derived from dates.** Recovery targets separated from rotation. No reason recorded in the commits. The Sept 25 calendar repair is archived in `~/Documents/BarLog-recovery/`.
- **8380377, Sep 25: Clarified deficit HSPU singles and slow descent.**
- **e894b19, b45afde, a11c960, 2580f75, 178bd3a, Sep 24: Reworked B and D around pressing and one-arm handstand.** D became "OAHS / planche" with straddle shifts first while fresh. B holds the provisional dips. A and C carry 3 minutes of OAHS shift practice. The planche progresses slowly, with holds only after two clean, ache-free sessions. Ring support replaced the dip-bar support hold because rings are less stable. Added fingertip hold and tuck planche as optional benchmarks.
- **2d3e8fc, Sep 24: Removed the hold stopwatch and shortened coaching notes.** Seconds are logged with the chips and corrected with Fix last.
- **671ac80, Sep 24: Offline support, last-results display, stopwatch input fix.** The app opens with no signal; the last two results show per exercise.
- **f602a53 and 721cfc7, Sep 21: Easy A/C handstand practice, optional week-four reductions, and rice-bag wrist work restored** without resetting routines you had adopted.
- **02a4d64, Sep 20: Revised skill routine; compact workout history.**

## 2026-09 and earlier

- **09afc42, 45444dc, 608caae, Sep 3: Stabilized workout volume and tracked band assistance; revised muscle-up, flag and core progressions; fixed the plan-migration assignment.**
- **Aug 21: First upload of the app** (three upload commits).

## Where else the history lives

- Commit messages in this repo (`git log`).
- `README.md` describes how things work now.
- Backups of your log are in Google Drive under `6 Personal/Health and Fitness/Workout App/Records`.
