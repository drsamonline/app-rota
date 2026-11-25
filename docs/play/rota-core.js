/* rota-core — the engine behind Rota.
 * SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
 * (c) 2026 Dr Sohil Momin
 *
 * ONE JOB: build a duty rota, catch the clashes, show the load, print it. Both absorbed specs
 * forbid the same thing — no pay is calculated anywhere in this file, and no money field exists.
 *
 * The rules it checks are the ones that actually hurt a small team:
 *   clash       two people on the same slot on the same day, and it cannot be saved
 *   rest        one person on more consecutive days than the rule allows, naming them and the day
 *   gap         a slot nobody is on — accepted, but listed, never hidden
 *   swap        a swap request for a shift the requester is not on, refused with both shifts shown
 *
 * Pure functions: no DOM, no network, no storage. The page does the wiring.
 */
(function (root, factory) {
  var api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.RotaCore = api;
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  var VERSION = "1.0.0";
  var DEFAULT_RULES = { maxConsecutiveDays: 6, slots: ["Morning", "Evening", "Night"] };

  function clean(s) { return String(s == null ? "" : s).replace(/\s+/g, " ").trim(); }

  /* ---------------------------------------------------------------- team */

  function makeTeam(names) {
    var list = (names || []).map(function (n) { return clean(n); }).filter(Boolean);
    return list.map(function (name, i) { return { id: "p" + (i + 1), name: name }; });
  }

  /* ---------------------------------------------------------------- rota */

  function emptyRota(rules) {
    return { days: [], shifts: [], rules: { maxConsecutiveDays: (rules && rules.maxConsecutiveDays) || DEFAULT_RULES.maxConsecutiveDays, slots: (rules && rules.slots) || DEFAULT_RULES.slots.slice() } };
  }

  function addDay(rota, label) {
    var r = clone(rota);
    var day = clean(label);
    if (!day) return { ok: false, field: "day", reason: "a day with no name was refused" };
    if (r.days.indexOf(day) >= 0) return { ok: false, field: "day", reason: "\u201c" + day + "\u201d is already on the rota" };
    r.days.push(day);
    return { ok: true, rota: r, says: "Added " + day + "." };
  }

  /* Assigning: a slot on a day gets a person. Assigning the same slot to a second person is how a
   * clash happens, and it is kept in the model so it can be SHOWN rather than silently dropped. */
  function assign(rota, opts) {
    var r = clone(rota);
    var day = clean(opts && opts.day);
    var slot = clean(opts && opts.slot);
    var personId = clean(opts && opts.personId);
    if (!day || r.days.indexOf(day) < 0) return { ok: false, field: "day", reason: "that day is not on the rota" };
    if (!slot || r.rules.slots.indexOf(slot) < 0) return { ok: false, field: "slot", reason: "there is no slot called \u201c" + slot + "\u201d" };
    if (!personId) return { ok: false, field: "person", reason: "a shift with nobody on it is a gap: pick a person, or leave the slot empty" };
    r.shifts.push({ id: "s" + (r.shifts.length + 1) + "-" + day + "-" + slot, day: day, slot: slot, personId: personId });
    return { ok: true, rota: r, says: "Assigned." };
  }

  function removeShift(rota, shiftId) {
    var r = clone(rota);
    var before = r.shifts.length;
    r.shifts = r.shifts.filter(function (s) { return s.id !== shiftId; });
    if (r.shifts.length === before) return { ok: false, reason: "there is no shift with that id" };
    return { ok: true, rota: r };
  }

  /* -------------------------------------------------------------- checks */

  function onShift(rota, day, slot) {
    return (rota.shifts || []).filter(function (s) { return s.day === day && s.slot === slot; });
  }

  /* The clashes: more than one person on the same slot on the same day. Both are named. */
  function clashes(rota) {
    var out = [];
    (rota.days || []).forEach(function (day) {
      (rota.rules.slots || []).forEach(function (slot) {
        var here = onShift(rota, day, slot);
        if (here.length > 1) {
          out.push({
            kind: "clash", day: day, slot: slot,
            people: here.map(function (s) { return s.personId; }),
            shiftIds: here.map(function (s) { return s.id; }),
            says: day + " " + slot + " has " + here.length + " people on it, and a slot can hold one."
          });
        }
      });
    });
    return out;
  }

  /* Consecutive days: the run is counted across the rota's own day order, so "seven days in a row"
   * means seven adjacent entries. The violation names the person AND the day the run broke the rule. */
  function restViolations(rota, people) {
    var max = (rota.rules && rota.rules.maxConsecutiveDays) || DEFAULT_RULES.maxConsecutiveDays;
    var days = rota.days || [];
    var byPerson = {};
    (rota.shifts || []).forEach(function (s) {
      byPerson[s.personId] = byPerson[s.personId] || {};
      byPerson[s.personId][s.day] = true;
    });
    var out = [];
    Object.keys(byPerson).forEach(function (pid) {
      var run = 0;
      for (var i = 0; i < days.length; i++) {
        if (byPerson[pid][days[i]]) {
          run++;
          if (run > max) {
            var who = (people || []).filter(function (p) { return p.id === pid; })[0];
            out.push({
              kind: "rest", personId: pid,
              person: who ? who.name : pid,
              day: days[i], run: run, max: max,
              says: (who ? who.name : pid) + " is on " + run + " consecutive days, and the rule allows " + max + " \u2014 the run breaks the rule on " + days[i] + "."
            });
            break;
          }
        } else {
          run = 0;
        }
      }
    });
    return out;
  }

  /* A gap is a slot nobody is on. Accepted, and listed — never hidden. */
  function gaps(rota) {
    var out = [];
    (rota.days || []).forEach(function (day) {
      (rota.rules.slots || []).forEach(function (slot) {
        if (onShift(rota, day, slot).length === 0) out.push({ kind: "gap", day: day, slot: slot, says: day + " " + slot + " has nobody on it." });
      });
    });
    return out;
  }

  /* The whole check, in one call. A clash blocks saving; a rest violation is flagged and does not. */
  function check(rota, people) {
    var c = clashes(rota);
    var r = restViolations(rota, people);
    var g = gaps(rota);
    return {
      clashes: c,
      rest: r,
      gaps: g,
      canSave: c.length === 0,
      blockedBy: c.length ? "a clash cannot be saved: two people on one slot is not a rota, it is a mistake" : "",
      says: (c.length ? c.length + " clash(es). " : "No clashes. ") +
        (r.length ? r.length + " rest-day violation(s). " : "No rest-day violations. ") +
        (g.length ? g.length + " gap(s), listed and not hidden." : "No gaps.")
    };
  }

  /* ---------------------------------------------------------------- load */

  /* Fairness, visible: the number of shifts each person carries. NO pay, NO money. */
  function load(rota, people) {
    var counts = {};
    (rota.shifts || []).forEach(function (s) { counts[s.personId] = (counts[s.personId] || 0) + 1; });
    var rows = (people || []).map(function (p) {
      return { personId: p.id, name: p.name, shifts: counts[p.id] || 0 };
    });
    var total = rows.reduce(function (a, r) { return a + r.shifts; }, 0);
    var max = rows.reduce(function (a, r) { return Math.max(a, r.shifts); }, 0);
    var min = rows.length ? rows.reduce(function (a, r) { return Math.min(a, r.shifts); }, Infinity) : 0;
    return {
      rows: rows, total: total, max: max, min: rows.length ? min : 0,
      spread: rows.length ? max - min : 0,
      says: rows.length ? total + " shift(s) across " + rows.length + " people; the spread is " + (max - (rows.length ? min : 0)) + " shift(s)." : "No people yet."
    };
  }

  /* ---------------------------------------------------------------- swap */

  /* A swap request for a shift the requester is not on is refused, and BOTH shifts are shown so the
   * mistake is visible rather than mysterious. */
  function requestSwap(rota, opts) {
    var fromId = clean(opts && opts.fromPersonId);
    var shiftId = clean(opts && opts.shiftId);
    var toId = clean(opts && opts.toPersonId);
    var shift = (rota.shifts || []).filter(function (s) { return s.id === shiftId; })[0];
    if (!shift) return { ok: false, reason: "there is no shift with that id, so there is nothing to swap" };
    if (shift.personId !== fromId) {
      var mine = (rota.shifts || []).filter(function (s) { return s.personId === fromId; });
      return {
        ok: false,
        reason: "that shift is not yours to swap: it is on " + shift.day + " " + shift.slot + ", held by " + shift.personId + ".",
        requested: { day: shift.day, slot: shift.slot, heldBy: shift.personId },
        yours: mine.map(function (s) { return { day: s.day, slot: s.slot, id: s.id }; }),
        says: "Refused, and both shifts shown: the one you asked about is " + shift.day + " " + shift.slot +
          " (held by " + shift.personId + "), and you are on " + (mine.length ? mine.map(function (s) { return s.day + " " + s.slot; }).join(", ") : "nothing yet") + "."
      };
    }
    if (!toId) return { ok: false, field: "person", reason: "a swap needs someone to swap with" };
    if (toId === fromId) return { ok: false, reason: "a swap with yourself changes nothing" };
    var r = clone(rota);
    r.shifts = r.shifts.map(function (s) { return s.id === shiftId ? { id: s.id, day: s.day, slot: s.slot, personId: toId } : s; });
    r.pending = true;
    return { ok: true, rota: r, says: "Swapped on this device. It is pending: the others have not seen the change yet." };
  }

  /* --------------------------------------------------------------- print */

  /* One row per person per day. The count the export states is the count on screen, and the test
   * compares them. */
  function printRows(rota, people) {
    var rows = [];
    (rota.days || []).forEach(function (day) {
      (people || []).forEach(function (p) {
        var mine = (rota.shifts || []).filter(function (s) { return s.day === day && s.personId === p.id; });
        if (!mine.length) return;
        rows.push({ day: day, personId: p.id, name: p.name, slots: mine.map(function (s) { return s.slot; }).join(", ") });
      });
    });
    return rows;
  }

  function markdown(rota, people, meta) {
    var rows = printRows(rota, people);
    var l = load(rota, people);
    var chk = check(rota, people);
    var lines = ["# Duty rota", ""];
    if (meta && meta.when) lines.push("Printed " + meta.when + ".");
    lines.push("");
    lines.push("| Day | Person | Shift |");
    lines.push("|---|---|---|");
    rows.forEach(function (r) {
      lines.push("| " + r.day + " | " + r.name + " | " + r.slots + " |");
    });
    lines.push("");
    lines.push("**" + rows.length + " row(s), one per person per day.**");
    lines.push("");
    lines.push("## Load");
    lines.push("");
    lines.push("| Person | Shifts |");
    lines.push("|---|---|");
    l.rows.forEach(function (r) { lines.push("| " + r.name + " | " + r.shifts + " |"); });
    lines.push("");
    lines.push("## Checks");
    lines.push("");
    lines.push("- " + chk.says);
    chk.clashes.forEach(function (c) { lines.push("- CLASH: " + c.says); });
    chk.rest.forEach(function (r) { lines.push("- REST: " + r.says); });
    chk.gaps.forEach(function (g) { lines.push("- GAP: " + g.says); });
    lines.push("");
    lines.push("No pay is calculated anywhere in this rota: it counts shifts, not money.");
    return lines.join("\n");
  }

  /* --------------------------------------------------------------- storage */

  function clone(r) {
    var src = r || emptyRota();
    return {
      days: (src.days || []).slice(),
      shifts: (src.shifts || []).map(function (s) { return { id: s.id, day: s.day, slot: s.slot, personId: s.personId }; }),
      rules: { maxConsecutiveDays: src.rules.maxConsecutiveDays, slots: (src.rules.slots || []).slice() },
      pending: !!src.pending
    };
  }

  function serialize(state) {
    return JSON.stringify({
      version: VERSION,
      savedOn: (state && state.savedOn) || 0,
      people: (state && state.people) || [],
      rota: clone(state && state.rota)
    }, null, 2);
  }

  /* An unreadable rota is QUARANTINED: reported, offered for export, and never merged into a live
   * one — merging would move shifts people have already planned around. */
  function parseState(text) {
    var raw = String(text == null ? "" : text);
    if (!raw.trim()) return { ok: false, empty: true, reason: "there is no saved rota yet", raw: raw };
    var data;
    try { data = JSON.parse(raw); }
    catch (e) {
      return { ok: false, quarantined: true, reason: "The saved rota cannot be read, so it has been quarantined: it was not merged into a live rota, because that would move shifts people have already planned around. Export it to keep it.", raw: raw };
    }
    if (!data || !data.rota || !Array.isArray(data.rota.days)) {
      return { ok: false, quarantined: true, reason: "The saved file holds no rota. It was quarantined rather than rebuilt from the team list, which would invent shifts nobody agreed to.", raw: raw };
    }
    var r = data.rota;
    return {
      ok: true,
      state: {
        version: data.version || VERSION,
        savedOn: Number(data.savedOn) || 0,
        people: Array.isArray(data.people) ? data.people : [],
        rota: {
          days: r.days.map(String),
          shifts: (Array.isArray(r.shifts) ? r.shifts : []).filter(function (s) { return s && s.day && s.slot && s.personId; })
            .map(function (s, i) { return { id: String(s.id || "s" + i), day: String(s.day), slot: String(s.slot), personId: String(s.personId) }; }),
          rules: { maxConsecutiveDays: Number(r.rules && r.rules.maxConsecutiveDays) || DEFAULT_RULES.maxConsecutiveDays, slots: (r.rules && Array.isArray(r.rules.slots) ? r.rules.slots : DEFAULT_RULES.slots).slice() },
          pending: !!r.pending
        }
      },
      raw: raw
    };
  }

  function stamp(when) {
    var m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(String(when || ""));
    return m ? m[3] + "-" + m[2] + "-" + m[1] : "undated";
  }

  function exportFile(what, payload, meta, writer) {
    meta = meta || {};
    if (typeof writer !== "function") return { ok: false, reason: "the file was not written: no writer is available in this browser" };
    var name, body, mime = "text/markdown;charset=utf-8";
    if (what === "rota") { name = "rota-" + stamp(meta.when) + ".md"; body = markdown(payload.rota, payload.people, meta); }
    else if (what === "raw") { name = "rota-quarantined-" + stamp(meta.when) + ".txt"; body = String(payload.raw || ""); mime = "text/plain;charset=utf-8"; }
    else return { ok: false, reason: "nothing was written: unknown export \u201c" + what + "\u201d" };
    try {
      var wrote = writer(name, body, mime);
      if (wrote === false) return { ok: false, filename: name, reason: "the file was not written: the browser refused the save" };
      return { ok: true, filename: name, bytes: body.length };
    } catch (e) {
      var why = e && e.name === "QuotaExceededError" ? "storage is full" : (e && e.message ? e.message : "storage is unavailable");
      return { ok: false, filename: name, reason: "the file was not written: " + why };
    }
  }

  return {
    version: VERSION,
    DEFAULT_RULES: DEFAULT_RULES,
    makeTeam: makeTeam,
    emptyRota: emptyRota,
    addDay: addDay,
    assign: assign,
    removeShift: removeShift,
    clashes: clashes,
    restViolations: restViolations,
    gaps: gaps,
    check: check,
    load: load,
    requestSwap: requestSwap,
    printRows: printRows,
    markdown: markdown,
    serialize: serialize,
    parseState: parseState,
    exportFile: exportFile
  };
});
