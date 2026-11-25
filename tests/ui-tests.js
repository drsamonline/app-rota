#!/usr/bin/env node
/* ui-tests — the Rota page in a real DOM (jsdom).
 * SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
 * (c) 2026 Dr Sohil Momin
 *
 * The engine has its own suite, including the countable done-means. This one proves the page is
 * wired to it: the grid builds, assigning fills a cell, a second person on the same slot shows a
 * clash AND disables saving, a rest violation is listed, the load is shown, a swap is refused with
 * both shifts, printing states the row count, and a quarantined rota is reported.
 *
 *   npm install --no-save jsdom && node tests/ui-tests.js
 */
"use strict";

var fs = require("fs");
var path = require("path");
var { JSDOM } = require("jsdom");

var ROOT = path.join(__dirname, "..");
var PLAY = path.join(ROOT, "docs", "play");
var PAGE = path.join(PLAY, "index.html");

var passed = 0;
var failed = [];
function ok(name, cond, detail) { if (cond) { passed++; return; } failed.push(name + (detail ? " — " + detail : "")); }
function eq(name, a, b) { ok(name, a === b, "expected " + JSON.stringify(b) + ", got " + JSON.stringify(a)); }

function build(seed) {
  var html = fs.readFileSync(PAGE, "utf8");
  var dom = new JSDOM(html, { url: "https://example.test/play/index.html", runScripts: "outside-only", pretendToBeVisual: true });
  var w = dom.window;
  if (seed) Object.keys(seed).forEach(function (k) { w.localStorage.setItem(k, seed[k]); });
  w.URL.createObjectURL = function () { return "blob:x"; };
  w.URL.revokeObjectURL = function () {};
  w.HTMLAnchorElement.prototype.click = function () {};
  ["web-kit.js", "export-kit.js", "rota-core.js", "app.js"].forEach(function (f) {
    w.eval(fs.readFileSync(path.join(PLAY, f), "utf8"));
  });
  return dom;
}

function pick(select, value) {
  select.value = value;
  select.dispatchEvent(new (select.ownerDocument.defaultView.Event)("change"));
}

var dom = build(null);
var w = dom.window;
var d = w.document;
var $ = function (id) { return d.getElementById(id); };

ok("the engine loaded into the page", !!w.RotaCore);
eq("no grid before building", $("gridCard").hidden, true);

/* --------------------------------------------------------------- the grid */

$("build").click();
eq("the grid appears", $("gridCard").hidden, false);
eq("seven day rows", d.querySelectorAll("#grid tbody tr").length, 7);
eq("three slot columns plus the day header", d.querySelectorAll("#grid thead th").length, 4);

/* assign Asha to Mon Morning */
var firstSelect = d.querySelector("#grid tbody tr td .addPerson");
pick(firstSelect, "p1");
ok("the assignment lands in the cell", /Asha/.test(d.querySelector("#grid tbody tr td").textContent),
  d.querySelector("#grid tbody tr td").textContent);
eq("the load counts it", /Asha — 1 shift/.test($("loadList").textContent), true, $("loadList").textContent);

/* a second person on the same slot is a clash, and saving is blocked */
var cellSelect = d.querySelector("#grid tbody tr td .addPerson");
pick(cellSelect, "p2");
ok("the clash is listed", /CLASH/.test($("checkList").textContent), $("checkList").textContent);
ok("the clash names the day and slot", /Mon Morning has 2 people/.test($("checkList").textContent));
eq("saving is disabled", $("saveBtn").disabled, true);
ok("the page says why", /cannot be saved/.test($("saveNote").textContent), $("saveNote").textContent);

/* remove the second person, and saving is allowed again */
var chips = d.querySelectorAll("#grid tbody tr td .chip");
chips[chips.length - 1].querySelector("button").click();
eq("saving is enabled once the clash is gone", $("saveBtn").disabled, false);
ok("no clash is listed", !/CLASH/.test($("checkList").textContent), $("checkList").textContent);

$("saveBtn").click();
ok("saving says it is pending with the team", /pending with the team/.test($("status").textContent), $("status").textContent);
ok("the rota was written to the device", !!w.localStorage.getItem("rota:state"));

/* ------------------------------------------------------------------ print */

$("printBtn").click();
ok("the print states the row count", /row\(s\), one per person per day/.test($("status").textContent), $("status").textContent);

/* ------------------------------------------------------- the rest rule */

var sevenDay = { "rota:state": JSON.stringify({
  version: "1.0.0", savedOn: 1,
  people: [{ id: "p1", name: "Asha" }, { id: "p2", name: "Ravi" }],
  rota: { days: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
    shifts: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map(function (day, i) { return { id: "s" + i, day: day, slot: "Morning", personId: "p1" }; }),
    rules: { maxConsecutiveDays: 6, slots: ["Morning", "Evening", "Night"] } }
}) };
var dom2 = build(sevenDay);
var d2 = dom2.window.document;
ok("the rest violation is listed", /REST/.test(d2.getElementById("checkList").textContent), d2.getElementById("checkList").textContent);
ok("it names the person and the day", /Asha is on 7 consecutive days/.test(d2.getElementById("checkList").textContent) &&
  /Sun/.test(d2.getElementById("checkList").textContent));
eq("a rest violation does not block saving", d2.getElementById("saveBtn").disabled, false);

/* ------------------------------------------------------------- the swap */

var swapTo = d2.getElementById("swapTo");
var swapShift = d2.getElementById("swapShift");
swapShift.value = d2.querySelector("#swapShift option").value;
swapTo.value = "p1";
d2.getElementById("swapBtn").click();
ok("a swap with yourself is refused", /changes nothing/.test(d2.getElementById("status").textContent), d2.getElementById("status").textContent);

/* ------------------------------------------- a quarantined rota on reload */

var dom3 = build({ "rota:state": "{ broken rota" });
var d3 = dom3.window.document;
ok("a quarantined rota is reported", /quarantined/.test(d3.getElementById("status").textContent), d3.getElementById("status").textContent);
ok("it says it was not merged into a live rota", /not merged into a live rota/.test(d3.getElementById("status").textContent));
ok("it offers an export of the quarantined rota",
  Array.prototype.some.call(d3.querySelectorAll("button"), function (b) { return /Export the quarantined rota/.test(b.textContent); }));
ok("the quarantined file is not overwritten", /broken rota/.test(dom3.window.localStorage.getItem("rota:state")));
eq("no grid is shown from a quarantined rota", d3.getElementById("gridCard").hidden, true);

/* --------------------------------------------- a failed save says so */

var dom4 = build(null);
var w4 = dom4.window;
var d4 = dom4.window.document;
Object.defineProperty(w4, "localStorage", {
  configurable: true,
  get: function () {
    return {
      getItem: function () { return null; },
      setItem: function () { var e = new Error("quota"); e.name = "QuotaExceededError"; throw e; },
      removeItem: function () {}, clear: function () {}
    };
  }
});
d4.getElementById("build").click();
var sel4 = d4.querySelector("#grid tbody tr td .addPerson");
sel4.value = "p1";
sel4.dispatchEvent(new w4.Event("change"));
ok("a failed save says NOT SAVED", /NOT SAVED:/.test(d4.getElementById("status").textContent), d4.getElementById("status").textContent);
ok("and it is not shown as agreed with the team", /not shown as agreed with the team/.test(d4.getElementById("status").textContent));

var total = passed + failed.length;
if (!total) { console.error("ui-tests: 0 assertions ran. That is a failure, not a pass."); process.exit(1); }
if (failed.length) {
  console.error("ui-tests: " + passed + "/" + total + " passed, " + failed.length + " FAILED");
  failed.forEach(function (f) { console.error("  FAIL " + f); });
  process.exit(1);
}
console.log("ui-tests: " + passed + "/" + total + " assertions passed");
dom.window.close(); dom2.window.close(); dom3.window.close(); dom4.window.close();
