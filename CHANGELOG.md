# Changelog

All notable changes to Rota are recorded here.
Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). Dates: dd/mm/yyyy.

## [Unreleased]

## [1.0.0] — 25/11/2026

### Added
- A grid of days × slots (Morning, Evening, Night) for a small team, with add and remove per slot.
- **Clashes**: two people on one slot on one day are flagged, and the rota **cannot be saved** while
  a clash stands. The mistake is shown rather than swallowed.
- **Rest-day violations**: one person on more consecutive days than the rule allows is flagged with
  their name, the day the run broke the rule, the run length and the limit.
- **Gaps**: an unfilled slot is accepted and listed, never hidden.
- **Load** per person, so fairness is visible. Shifts are counted; no money is calculated anywhere.
- **Swap requests**: a swap for a shift the requester is not on is refused, with both the requested
  shift and the requester's own shifts shown. A valid swap is marked pending — the others have not
  seen it.
- A Markdown print with one row per person per day, stating the row count so it can be checked
  against the screen.
- Corruption handling: an unreadable rota is **quarantined**, reported and offered for export, never
  merged into a live rota and never rebuilt from the team list.
- A failed save says **NOT SAVED** at once, and the change is never shown as agreed with the team.
- PWA shell, CI (70 engine assertions + 27 in jsdom + page smoke), and the app-builder pipeline
  pinned to the canonical SHA for the EXE/APK/Linux release.

### Not built
- LAN sharing: the app opens locally and says the others have not seen the change yet.
