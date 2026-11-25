BUILD PROMPT — Rota   (plan row #14 of 37)

## Inputs

```
APP:        Rota
SPEC:       QUEUE/app-shift.md
REPO:       https://github.com/drsamonline/app-rota   (empty)
            the plan also matches: rota, app-shift, shift
PLAN_ROW:   #14
MERGED:     shift, rota-planner, shift-ledger
```

This build absorbs 3 specs into one app. Their must-nots still bind, and all of them are quoted below.

Needs before it can ship: LAN transport (room-kit)

**Note before starting:** Could be an HMS module instead of a repo. Pick one.

Rule 0 — check these existing repos before writing code, in case one already does the job: `planner-pro`

---

## What you are building

One app, from its spec, into that repo. Nothing else. Not a second app, not a kit unless the
spec needs one, not a refactor of a neighbour.

### The house rules (they are not preferences)

- **Offline-first, always.** No server, no account, no telemetry, no network call at runtime.
  If the app needs a model, it ships in the app or the app says what it cannot do.
- **Single-file where possible.** One `docs/play/index.html` with its kits beside it. The
  build kit (`app-builder`) turns that into a Windows EXE and an Android APK — so the same
  bytes must work as a file:// page, an installed PWA and an APK.
- **The spec's "what it must NOT do" are test assertions, not prose.** Each one becomes a
  named test that fails if the app ever does it.
- **The spec's "what it does when things go wrong" is four cases**, and all four ship:
  bad input, no network, storage full or unavailable, corrupt saved state. An app that
  silently treats "no data" as "no matches" is not done.
- **Nothing is fabricated.** No invented data, no placeholder screenshot presented as a live
  capture, no badge nobody measures, no sample corpus passed off as the real thing. If an
  asset must be supplied by the owner, say so and leave the slot visibly empty.
- **India is the default audience**: ₹, lakh/crore, metric, dd/mm/yyyy, IST, and the local
  examples before the international ones.
- **Licence:** PolyForm Noncommercial 1.0.0 unless the spec says otherwise; SPDX headers on
  every source file; `data/SOURCE.md` recording the source, the licence of the **data**, and
  the fetch date for anything not written by us.

### Step 0 — Preflight (before you claim anything is missing)

1. Read the spec. Read its master-list row. Read its `PLAN.json` row, including `members` —
   a merged build's other specs are in `QUEUE/archive/` and their must-nots still apply.
2. **Rule 0: check the estate first.** Search the org for an app that already does this job.
   If one does, stop and report the collision with the repo name. Building the second version
   of a shipped app is the most expensive mistake available here.
3. Ask which credential you are holding. A `gh` 404 is a wrong credential, never proof of
   absence. Any finding of "impossible" must name the credential it was attempted with.
4. **You cannot create repositories.** If the repo does not exist, that is the owner's step —
   say so and stop. An empty repo that exists is yours to fill.

### Step 1 — Scope it in writing, before code

Produce a short block and keep it for the final report:

- the job, in one sentence;
- the mechanic that makes it not-generic, in one sentence;
- every **must-not**, as a test name;
- the four failure cases, as behaviour;
- the kits it needs (from the spec) and whether each already exists;
- what the app will **not** do in v1, explicitly.

If the app needs a capability no kit has: create the kit first, with its own test, and say so.

### Step 2 — Scaffold, do not hand-roll

`python3 scripts/new-app.py <app-id>` writes the shape:

```
docs/index.html          landing page (what it is, honest status, how to run it)
docs/play/index.html     the app itself
docs/play/*.js           the kits it vendors, next to the page that loads them
tests/self-tests.js      assertions, no framework
PAGES.json               the page manifest
README.md                what it does, how to run, what is not built
```

**Then prove the shape before you fill it:** every `<script src>` in the page must resolve to
a file that exists beside it. A scaffold has shipped here before with the kits in the wrong
folder, and the page 404'd its own runtime while the build stayed green.

If the repo is empty and `scripts/` is not available to you, build the same shape by hand —
the file list above is the contract, not the script.

### Step 3 — Build to the spec

Work the spec top to bottom. Where the spec is silent, choose the smaller behaviour and say
so in the report. Where the spec and the master-list one-liner disagree, **the spec body
wins** and the disagreement goes in the report (five such contradictions are already known).

### Step 4 — Tests that could fail

- `node tests/self-tests.js` — every must-not is an assertion; every failure case is a case.
- Print the count. A suite of 0 assertions is a failure, not a pass.
- **Mutation-test it**: break three things on purpose (remove a guard, make a refused input
  succeed, report a failed save as saved) and confirm the suite goes red each time. Restore.
- If the suite cannot go red, it is documentation, not a test.

### Step 5 — Deliver

- Pages on, demo live at `https://drsamonline.github.io/<repo>/`, and the demo **is** the app
  (no separate build of the page).
- A release with the EXE and APK from `app-builder`, built from the same source.
- Topics set (they are the discovery surface), licence headers, `CHANGELOG.md`, `NOTICE`.
- README states the real status: what works, what does not, what is untested.

### Step 6 — Record it

- Append one line to `PROGRESS.log`: what was built, the test counts, the demo URL, what was
  **not** built and why.
- **Do not edit `QUEUE/PLAN.json`.** `tools/queue-sync.py` flips the row to `built` when the
  repo and its Pages answer. Writing `built` by hand is how a plan starts lying.
- Do not edit `ACTIONS.md` — its build order is generated.

### Step 7 — Report in this shape

```
APP      <name>  (plan row #<order>, <n> specs merged)
REPO     <url>   commit <sha>
DEMO     <url>
TESTS    <n>/<n> assertions, mutation-tested <n> ways
BUILT    <the features that exist>
NOT BUILT <the features the spec asks for that do not, and why>
MUST-NOT <each one, and the test that holds it>
NEEDS    <what only the owner can supply: assets, keys, data, a decision>
NEXT     <the smallest honest next step for this app, or "done">
```

Never write "done" for a feature you did not prove. `unverified` with the reason is a better
line than a green claim.

---

## Definition of done (the owner's, not yours)

> A working app, with a working release, a landing page, and a live demo where the app is a
> web app — and the tests that prove the must-nots, run in CI.

Anything less is `partial`, and the report says which of the three is missing.

---

## When you are blocked

Say which of these it is, in one line, and stop:

- **no spec** → the spec is the next step, not the code;
- **the app already exists** → name the repo and the overlapping features;
- **the repo does not exist** → the owner creates it; you cannot;
- **a capability no kit has** → the kit is the next step;
- **an asset only the owner has** (a photo, a UPI ID, a licensed corpus, a key) → build the
  slot, leave it visibly empty, name what is needed;
- **a credential that cannot see the thing** → name the credential, not a verdict.

---

## The five ways this has gone wrong before

1. **Built the second version of a shipped app** — Rule 0 exists because of it.
2. **Shipped a scaffold whose page could not load its own kits** — prove every `src` resolves.
3. **Claimed a badge or a status nobody measures** — a green shield that lies is worse than none.
4. **Logged "done" from an exit code** — the verdict is the artifact on the branch, not git's
   exit status.
5. **Reported the system blocked on the strength of the wrong credential** — a 404 is a
   credential, not a fact.

---

# THE SPEC — Rota (`app-shift`)

# Shift

- **id:** app-shift
- **category:** Office apps
- **tier:** Rare
- **source:** the app master list, #79
- **status:** READY - spec written

## Pitch

Rota and shift planning for a small team, with swap requests.

## The job

- Build a duty rota for a team, catch the clashes, and print it.

## The mechanic

- It checks the RULES, not just the gaps: consecutive nights, rest days and the same person twice are caught as you build.

## What it must NOT do

- calculate pay. It builds a fair rota and catches the clashes.

## What it does when things go wrong

- **Bad input** — a swap request for a shift the requester is not on is refused and both shifts shown.
  A rota that leaves a slot unfilled is accepted but the gaps are listed, not hidden.
- **No network** — the LAN is the network for sharing the rota: with no peers the app opens locally and
  says the others have not seen the change yet.
- **Storage full or unavailable** — the change is not written and the app says so; it is never shown as
  agreed with the team.
- **Corrupt saved state** — an unreadable rota is reported and quarantined; it is never merged into a
  live one, which would move shifts people have already planned around.

## Kits it will need

- `web-kit` for the shell, storage and the PWA
- web-kit, export-kit

## The data

- the team, the rules and the rota, on the device.

## Done means

- A rota putting one person on **7** consecutive days flags a rest-day violation naming that person and the day; the same rota with a rest day inserted flags nothing. **2** people on the same shift on the same day is flagged as a clash and cannot be saved. A clean rota prints with **1** row per person per day, and the printed count equals the on-screen count.

---

# SPECS THIS BUILD ABSORBS (2)

## `app-rota-planner` — Rota Planner

**Pitch**

Build a duty rota for a team, catch the clashes, print it.

**The job**

- Plan a rota for a small team, and see the clashes.

**The mechanic**

- It shows the LOAD per person, so fairness is visible rather than argued about.

**What it must NOT do**

- calculate pay. It balances the rota and shows the load.

**What it does when things go wrong**

- **Bad input** — a rota with more shifts than people and no rule allowing it is refused with the
  shortfall named. A person assigned two places at one time is refused and both shown.
- **No network** — nothing changes. The rota is on the device.
- **Storage full or unavailable** — the rota is not saved and the app says so; the print still works
  for the session.
- **Corrupt saved state** — an unreadable rota is reported and offered for export; the app does not
  rebuild it from the team list, which would invent shifts nobody agreed to.

**Kits it will need**

- `web-kit` for the shell, storage and the PWA
- web-kit, export-kit

## `app-shift-ledger` — Shift Ledger

**Pitch**

Rotating shift rosters with pay, overtime and rest-day rules.

**The job**

- Lay out a rotating shift roster and compute what it costs — the pay, the overtime and every rest-day breach it produces.

**The mechanic**

- It applies the RULES to the roster you drew; it does not propose one. A rotation is a pattern (four on, two off), so the app expands the pattern across the calendar and then reports every day where the rest rule or the overtime threshold breaks — the breach is an output, not a warning you can dismiss.

**What it must NOT do**

- submit the roster anywhere, decide staffing, or optimise the rota. It tells you what the roster you drew costs and where it breaks, and nothing more.

**What it does when things go wrong**

- **Bad input** — a pay rate that is not a number, or a rest rule that cannot be satisfied by the
  pattern, is refused with the rule named. A shift that overlaps another is refused with both shown.
- **No network** — nothing changes. The roster and rates are on the device.
- **Storage full or unavailable** — the shift is not saved and the app says the totals do not include
  it, rather than showing pay that is quietly short.
- **Corrupt saved state** — an unreadable ledger is reported and offered for export; it is never
  rebuilt from a partial read, because a wrong total is worse than no total.

**Kits it will need**

- `web-kit` for the shell, storage and the PWA
- `export-kit` for the printed roster

---

## After the build

- Append one line to `PROGRESS.log`. Do **not** edit `QUEUE/PLAN.json` — `tools/queue-sync.py` moves row #14 to `built` when the repo and its Pages answer.
- Report in the shape the brief asks for. Anything you did not prove is `unverified`, not done.
