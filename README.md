# Rota

Build the rota, catch the clashes, see the load, print it. **No pay is calculated.**

- **Demo (the app itself):** https://drsamonline.github.io/app-rota/play/index.html
- **Landing page:** https://drsamonline.github.io/app-rota/
- **Release:** https://github.com/drsamonline/app-rota/releases/tag/app-latest
- **Plan row:** #14 of 37 in `drsamonline/forge` → `QUEUE/PLAN.json`
- **Specs absorbed:** `app-shift` (lead), `app-rota-planner`, `app-shift-ledger`
- **Licence:** PolyForm Noncommercial 1.0.0
- **Sponsor:** [github.com/sponsors/drsamonline](https://github.com/sponsors/drsamonline) — free, offline, no account

## Status

| | |
|---|---|
| **Built** | Days × slots grid; clashes flagged and blocking the save; rest-day violations naming person and day; gaps listed; load per person; swap refusals with both shifts; Markdown print with a stated row count; quarantine for an unreadable rota. |
| **Release** | Windows EXE, Android APK and Linux binary, built from this source by `app-builder` in CI. |
| **Not built** | **LAN sharing.** The app opens locally and says the others have not seen the change yet — which is true, and better than a sync that fails silently. |
| **Untested** | A real team's rota. The rules are asserted; whether a 7-day run is the right thing to flag for a two-person team is a judgement the app leaves to the `maxConsecutiveDays` setting, which the user controls. |

## The Shift spec's "done means", counted

> "A rota putting one person on 7 consecutive days flags a rest-day violation naming that person and
> the day; the same rota with a rest day inserted flags nothing. 2 people on the same shift on the
> same day is flagged as a clash and cannot be saved. A clean rota prints with 1 row per person per
> day, and the printed count equals the on-screen count."

| The spec says | The test |
|---|---|
| seven consecutive days flags, naming person and day | one violation, `person: "Asha"`, `day: "Sun"`, run 7, limit 6 |
| the same rota with a rest day flags nothing | zero rest violations, zero clashes, and it can be saved |
| two people on one shift is a clash and cannot be saved | one clash naming day, slot and both people; `canSave: false` |
| one row per person per day, printed = on screen | six rows, no duplicate day+person, and the numbered rows in the Markdown counted against `printRows()` |

## Three specs, one job

Shift, Rota Planner and Shift Ledger are the same job — **build a rota that fits, and see the
clashes before the team does** — so one engine. All three forbid pay calculation in the same breath,
and there is no money field anywhere.

## What it will not do

- **Calculate pay.** No rate, no salary, no currency.
- **Hide a gap.** Listed, always.
- **Let you swap a shift you are not on.** Refused, with both shifts shown.
- **Merge an unreadable rota into a live one.** Quarantined, offered for export.
- **Claim the team has seen it.** Every change is pending.
- **Use a key or a network.**

## When things go wrong

| Case | Behaviour |
|---|---|
| **Bad input** | Swap for a shift you are not on → refused, both shown. Empty slot → accepted, listed. Clash → blocks the save. |
| **No network** | Nothing changes; the app says the others have not seen the change. |
| **Storage full or unavailable** | **NOT SAVED** at once; never shown as agreed. |
| **Corrupt saved state** | Quarantined, reported, offered for export; never merged, never rebuilt from the team list. |

## The rules it checks

| Rule | What it means | Blocks saving? |
|---|---|---|
| **Clash** | two people on the same slot on the same day | **yes** |
| **Rest** | one person on more consecutive days than `maxConsecutiveDays` | no — flagged |
| **Gap** | a slot with nobody on it | no — listed |

A rest violation is a warning because a team may deliberately choose it; a clash is a mistake, and
the app refuses to save one.

## Tests

```bash
npm test                      # all three suites
node tests/self-tests.js      # engine — 70 assertions, including the done-means
node tests/ui-tests.js        # the page in jsdom — 27 assertions (needs the dev-only jsdom)
node tests/page-smoke.js      # every local src/href resolves, nothing off-origin
```

Mutation-tested six ways on 25/11/2026, each red: a clash that can be saved (1 failure), consecutive
days not counted (7 after the fixture was guarded), gaps hidden (3), an unentitled swap allowed (6),
a corrupt rota merged (3), and a pay calculation added (1). Three of the six crashed the suite before
the fixtures were guarded — recorded rather than tidied away.

## The bug the UI test caught

Assigning a person set a cheerful "Assigned." status **after** saving — so when the write failed,
`persist()` set **NOT SAVED** and the next line overwrote it. The same bug as row #11, in a different
app: the message a person reads was a lie while the state was correct. Fixed by only showing the
cheerful line when the write succeeded, and the test now simulates a full quota to prove it.

## Layout

```
docs/index.html            landing page
docs/play/index.html       the app — team, grid, checks, load, swap, print
docs/play/app.js           DOM wiring: the grid, assignment, checks, load, swap, save guard
docs/play/rota-core.js     the engine — clashes, rest, gaps, load, swaps, print, storage
docs/play/web-kit.js       vendored kit (unmodified)
docs/play/export-kit.js    vendored kit (unmodified)
tests/self-tests.js        engine suite (70)
tests/ui-tests.js          page suite (27, jsdom)
tests/page-smoke.js        shape on disk
PAGES.json                 landing = docs/index.html, app = docs/play/index.html
```

## Where the spec was silent, and what was chosen

- **A clash blocks the save; a rest violation does not.** A team may choose to run someone seven days; nobody chooses to put two people on one shift.
- **The clash is kept in the model** rather than prevented by the UI, so it can be *shown*. A UI that cannot express the mistake cannot explain it.
- **A swap is pending, not done.** Without sharing, the honest word is "pending".
- **The print states its own row count**, so the reader can check it against the screen.
- **`maxConsecutiveDays` is a setting**, defaulting to 6, because the right number depends on the team.

## What is not built, and why

**LAN sharing.** The spec's own degradation clause says: with no peers the app opens locally and says
the others have not seen the change yet. That is exactly what it does. A sync that half-worked would
be worse than none — a rota is the kind of document where a stale copy gets someone to work on their
day off.
