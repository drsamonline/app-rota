#!/usr/bin/env node
/* self-tests — Rota. No framework, no dependencies.
 * SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
 * (c) 2026 Dr Sohil Momin
 *
 * The Shift spec's "done means" is countable, so it is counted:
 *
 *   "A rota putting one person on 7 consecutive days flags a rest-day violation naming that person
 *    and the day; the same rota with a rest day inserted flags nothing. 2 people on the same shift
 *    on the same day is flagged as a clash and cannot be saved. A clean rota prints with 1 row per
 *    person per day, and the printed count equals the on-screen count."
 *
 * Rota Planner and Shift Ledger's rules are here too: no pay is calculated anywhere, a swap for a
 * shift the requester is not on is refused with both shifts shown, and an unreadable rota is
 * quarantined rather than merged.
 *
 *   node tests/self-tests.js
 */
"use strict";

var fs = require("fs");
var path = require("path");

var ROOT = path.join(__dirname, "..");
var R = require(path.join(ROOT, "docs", "play", "rota-core.js"));

var passed = 0;
var failed = [];
var group = "";
function section(n) { group = n; }
function ok(name, cond, detail) { if (cond) { passed++; return; } failed.push(group + " :: " + name + (detail ? " — " + detail : "")); }
function eq(name, a, b) { ok(name, a === b, "expected " + JSON.stringify(b) + ", got " + JSON.stringify(a)); }
function read(f) { return fs.readFileSync(path.join(ROOT, f), "utf8"); }

var DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
var people = R.makeTeam(["Asha", "Ravi", "Meera"]);

function weekRota(skipDay) {
  var rota = R.emptyRota();
  DAYS.forEach(function (d) { rota = R.addDay(rota, d).rota; });
  DAYS.forEach(function (d) {
    if (d === skipDay) return;
    rota = R.assign(rota, { day: d, slot: "Morning", personId: "p1" }).rota;
  });
  return rota;
}

/* ================================================ the spec's own "done means" */

section("done means — seven consecutive days flags a rest violation, naming person and day");
var seven = weekRota(null);
var chk = R.check(seven, people);
eq("one rest violation", chk.rest.length, 1, JSON.stringify(chk.rest));
var rest0 = chk.rest[0];
ok("a rest violation exists to inspect", !!rest0);
eq("it names the person", rest0 && rest0.person, "Asha");
eq("it names the day the run broke the rule", rest0 && rest0.day, "Sun");
ok("the message carries both", !!rest0 && /Asha/.test(rest0.says) && /Sun/.test(rest0.says), rest0 && rest0.says);
eq("the run is seven", rest0 && rest0.run, 7);
eq("the rule allowed six", rest0 && rest0.max, 6);
eq("there are no clashes in it", chk.clashes.length, 0);

section("done means — the same rota with a rest day inserted flags nothing");
var withRest = weekRota("Thu");
var chk2 = R.check(withRest, people);
eq("no rest violations", chk2.rest.length, 0, JSON.stringify(chk2.rest));
eq("no clashes either", chk2.clashes.length, 0);
eq("and it can be saved", chk2.canSave, true);
eq("it holds six shifts", withRest.shifts.length, 6);

section("done means — two people on one shift is a clash and cannot be saved");
var clashed = R.assign(withRest, { day: "Mon", slot: "Morning", personId: "p2" }).rota;
var chk3 = R.check(clashed, people);
eq("one clash", chk3.clashes.length, 1);
eq("it names the day", chk3.clashes[0].day, "Mon");
eq("it names the slot", chk3.clashes[0].slot, "Morning");
eq("it holds both people", chk3.clashes[0].people.length, 2);
eq("it cannot be saved", chk3.canSave, false);
ok("and says why", /cannot be saved/.test(chk3.blockedBy), chk3.blockedBy);
ok("the clash message names the slot and the count", /Mon Morning has 2 people/.test(chk3.clashes[0].says), chk3.clashes[0].says);

section("done means — a clean rota prints one row per person per day, and the counts match");
var rows = R.printRows(withRest, people);
eq("one row per person per day", rows.length, 6);
eq("no day appears twice for the same person", new Set(rows.map(function (r) { return r.day + "|" + r.personId; })).size, rows.length);
var md = R.markdown(withRest, people, { when: "25/11/2026" });
var printed = (md.match(/^\| [^|]+ \| [^|]+ \| [^|]+ \|$/gm) || []).filter(function (l) { return !/^\| Day \|/.test(l); }).length;
eq("the printed count equals the on-screen count", printed, rows.length);
ok("the export states the count itself", new RegExp("\\*\\*" + rows.length + " row\\(s\\), one per person per day").test(md), md.slice(0, 200));
ok("the export says no pay is calculated", /No pay is calculated/.test(md));

/* ============================================================ must-nots */

section("must-not — it must not calculate pay");
var core = read("docs/play/rota-core.js");
ok("no money field or function anywhere",
  !/\b(pay|salary|wage|wages|rate|rupee|rupees|money|cost)\s*[:=(]/i.test(core));
ok("no currency symbol", !/[\u20b9$]/.test(core.replace(/\$/g, "")));
ok("the export says it counts shifts, not money", /counts shifts, not money/.test(core));
eq("the load counts shifts only", Object.keys(R.load(withRest, people).rows[0]).sort().join(","), "name,personId,shifts");

section("must-not — a swap for a shift you are not on is refused, both shifts shown");
var mine = withRest.shifts[0];
var sw = R.requestSwap(withRest, { fromPersonId: "p2", shiftId: mine.id, toPersonId: "p3" });
eq("the swap is refused", sw.ok, false);
ok("the refusal names the shift asked about", /not yours to swap/.test(sw.reason), sw.reason);
eq("both shifts are shown — the requested one", sw.requested && sw.requested.day, mine.day);
eq("and its holder", sw.requested && sw.requested.heldBy, "p1");
ok("and the requester's own shifts are listed", Array.isArray(sw.yours));
ok("the message shows both", /held by p1/.test(sw.says) && /you are on/.test(sw.says), sw.says);
var good = R.requestSwap(withRest, { fromPersonId: "p1", shiftId: mine.id, toPersonId: "p2" });
eq("a swap you are entitled to works", good.ok, true);
ok("and it is marked pending with the team", /have not seen the change yet/.test(good.says), good.says);
eq("the shift moved", good.rota.shifts.filter(function (s) { return s.id === mine.id; })[0].personId, "p2");
eq("a swap with yourself is refused", R.requestSwap(withRest, { fromPersonId: "p1", shiftId: mine.id, toPersonId: "p1" }).ok, false);
eq("a swap for a shift that does not exist is refused", R.requestSwap(withRest, { fromPersonId: "p1", shiftId: "nope", toPersonId: "p2" }).ok, false);

section("must-not — an unfilled slot is accepted, and the gaps are listed");
var gappy = R.emptyRota();
gappy = R.addDay(gappy, "Mon").rota;
var gchk = R.check(gappy, people);
eq("an empty rota is accepted", gchk.canSave, true);
eq("every slot is a gap", gchk.gaps.length, 3);
ok("the gaps are named with day and slot", !!(gchk.gaps[0] && /Mon Morning/.test(gchk.gaps[0].says)), gchk.gaps[0] && gchk.gaps[0].says);
ok("and the summary says they are listed not hidden", /listed and not hidden/.test(gchk.says), gchk.says);

section("must-not — an unreadable rota is quarantined, never merged");
var bad = R.parseState("{ broken rota");
eq("it is reported", bad.ok, false);
eq("it is quarantined", bad.quarantined, true);
ok("it says it was not merged into a live rota", /not merged into a live rota/.test(bad.reason), bad.reason);
eq("the raw text is kept for export", bad.raw, "{ broken rota");
var noRota = R.parseState('{"people":[]}');
eq("a file with no rota is quarantined too", noRota.quarantined, true);
ok("and it says it was not rebuilt from the team list", /rather than rebuilt from the team list/.test(noRota.reason), noRota.reason);
eq("no rota saved yet is distinguished from a broken one", R.parseState("").empty, true);

section("must-not — it must not grow a second job");
ok("no second store, no tags, no sync", !/\b(tags|labels|folders)\s*[:=]/i.test(core) && !/\bsync\s*[:(]/i.test(core));
ok("no model, key or endpoint", !/\b(apiKey|endpoint|openai|gpt)\s*[:=]/i.test(core) && !/https?:\/\//.test(core));
ok("no network call", !/\bfetch\s*\(|XMLHttpRequest|WebSocket|sendBeacon/.test(core + read("docs/play/app.js")));
ok("the page forbids connections", /connect-src 'none'/.test(read("docs/play/index.html")));
ok("the page says it opens locally and the others have not seen it", /have not seen the change yet/.test(read("docs/play/app.js")));

section("failure case — storage full or unavailable");
var thrown = R.exportFile("rota", { rota: withRest, people: people }, { when: "25/11/2026" }, function () {
  var e = new Error("quota"); e.name = "QuotaExceededError"; throw e;
});
eq("a failed write is reported as failed", thrown.ok, false);
ok("a failed write says the file was not written", /not written/.test(thrown.reason), thrown.reason);
ok("a failed write names the cause", /storage is full/.test(thrown.reason));
eq("no writer means no file", R.exportFile("rota", { rota: withRest, people: people }, {}, null).ok, false);
ok("the page says it is not shown as agreed with the team", /not shown as agreed with the team/.test(read("docs/play/app.js")));

section("mechanic — the load shows fairness without money");
var l = R.load(withRest, people);
eq("one person carries the shifts", l.rows[0].shifts, 6);
eq("the others carry none", l.rows[1].shifts + l.rows[2].shifts, 0);
eq("the spread is visible", l.spread, 6);
ok("the summary names the spread", /the spread is 6/.test(l.says), l.says);

section("shape — every script the page loads exists beside it");
var page = read("docs/play/index.html");
var srcs = (page.match(/<script[^>]+src="([^"]+)"/g) || []).map(function (t) { return t.replace(/.*src="([^"]+)"/, "$1"); });
srcs.forEach(function (s) {
  ok("script src resolves: " + s, fs.existsSync(path.join(ROOT, "docs", "play", s.replace(/^\.\//, ""))));
});
ok("the landing page exists", fs.existsSync(path.join(ROOT, "docs", "index.html")));
ok("the page manifest exists", fs.existsSync(path.join(ROOT, "PAGES.json")));

var total = passed + failed.length;
if (!total) { console.error("self-tests: 0 assertions ran. That is a failure, not a pass."); process.exit(1); }
if (failed.length) {
  console.error("self-tests: " + passed + "/" + total + " passed, " + failed.length + " FAILED");
  failed.slice(0, 12).forEach(function (f) { console.error("  FAIL " + f); });
  process.exit(1);
}
console.log("self-tests: " + passed + "/" + total + " assertions passed");
