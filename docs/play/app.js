/* app — the Rota page. SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
 * (c) 2026 Dr Sohil Momin
 *
 * Wiring only: the clash rule, the rest rule, the gaps, the load and the swap refusal live in
 * rota-core.js, which the tests exercise directly.
 */
(function () {
  "use strict";

  var R = window.RotaCore;
  var $ = function (id) { return document.getElementById(id); };

  var K_STATE = "rota:state";

  var els = {
    status: $("status"), team: $("team"), days: $("days"), maxRun: $("maxRun"), build: $("build"),
    gridCard: $("gridCard"), grid: $("grid"), saveBtn: $("saveBtn"), printBtn: $("printBtn"), saveNote: $("saveNote"),
    lower: $("lower"), checkSays: $("checkSays"), checkList: $("checkList"), loadSays: $("loadSays"), loadList: $("loadList"),
    swapShift: $("swapShift"), swapTo: $("swapTo"), swapBtn: $("swapBtn"), swapNote: $("swapNote")
  };

  var state = { people: [], rota: R.emptyRota(), unreadable: null };

  /* ------------------------------------------------------------- helpers */

  function today() {
    var d = new Date();
    var p = function (n) { return (n < 10 ? "0" : "") + n; };
    return p(d.getDate()) + "/" + p(d.getMonth() + 1) + "/" + d.getFullYear();
  }

  function setStatus(kind, msg) {
    els.status.className = "status show " + kind;
    els.status.textContent = msg;
  }
  function clearStatus() { els.status.className = "status"; els.status.textContent = ""; }

  function node(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  function nameOf(id) {
    var p = state.people.filter(function (x) { return x.id === id; })[0];
    return p ? p.name : id;
  }

  function persist() {
    try {
      window.localStorage.setItem(K_STATE, R.serialize({ savedOn: Date.now(), people: state.people, rota: state.rota }));
      return true;
    } catch (e) {
      setStatus("bad", "NOT SAVED: " + (e && e.name === "QuotaExceededError" ? "storage is full" : "storage is unavailable") +
        ". The change is on screen only, and it is not shown as agreed with the team.");
      return false;
    }
  }

  /* -------------------------------------------------------------- render */

  function buildGrid() {
    clearStatus();
    state.people = R.makeTeam(els.team.value.split(","));
    if (!state.people.length) { setStatus("bad", "A rota needs at least one person."); return; }
    var max = Number(els.maxRun.value);
    var rules = { maxConsecutiveDays: isNaN(max) || max < 1 ? 6 : max, slots: ["Morning", "Evening", "Night"] };
    var rota = R.emptyRota(rules);
    els.days.value.split(",").forEach(function (d) {
      var out = R.addDay(rota, d);
      if (out.ok) rota = out.rota;
    });
    state.rota = rota;
    els.gridCard.hidden = false;
    els.lower.hidden = false;
    render();
    setStatus("ok", "Grid built: " + state.people.length + " people, " + rota.days.length + " days, " + rota.rules.slots.length + " slots a day.");
  }

  function render() {
    var chk = R.check(state.rota, state.people);
    var clashCells = {};
    chk.clashes.forEach(function (c) { clashCells[c.day + "|" + c.slot] = true; });

    /* the grid */
    var thead = els.grid.querySelector("thead");
    var tbody = els.grid.querySelector("tbody");
    thead.textContent = "";
    tbody.textContent = "";
    var headRow = node("tr");
    headRow.appendChild(node("th", null, "Day"));
    state.rota.rules.slots.forEach(function (slot) { headRow.appendChild(node("th", null, slot)); });
    thead.appendChild(headRow);

    state.rota.days.forEach(function (day) {
      var tr = node("tr");
      tr.appendChild(node("th", null, day));
      state.rota.rules.slots.forEach(function (slot) {
        var td = node("td", "cell");
        if (clashCells[day + "|" + slot]) td.style.background = "#fdf3f3";
        var here = state.rota.shifts.filter(function (s) { return s.day === day && s.slot === slot; });
        here.forEach(function (s) {
          var chip = node("span", "chip" + (here.length > 1 ? " clash" : ""), nameOf(s.personId));
          var x = node("button", null, "\u00d7");
          x.title = "Remove " + nameOf(s.personId) + " from " + day + " " + slot;
          x.addEventListener("click", function () {
            var out = R.removeShift(state.rota, s.id);
            if (!out.ok) { setStatus("bad", out.reason); return; }
            state.rota = out.rota;
            persist();
            render();
          });
          chip.appendChild(x);
          td.appendChild(chip);
        });
        var add = document.createElement("select");
        add.className = "addPerson";
        var blank = document.createElement("option");
        blank.value = "";
        blank.textContent = here.length ? "+ add" : "pick a person";
        add.appendChild(blank);
        state.people.forEach(function (p) {
          var o = document.createElement("option");
          o.value = p.id;
          o.textContent = p.name;
          add.appendChild(o);
        });
        add.addEventListener("change", function () {
          if (!add.value) return;
          var out = R.assign(state.rota, { day: day, slot: slot, personId: add.value });
          if (!out.ok) { setStatus("bad", out.reason); return; }
          state.rota = out.rota;
          var saved = persist();
          render();
          /* A failed save is never overwritten by a cheerful line: the warning stays. */
          if (!saved) return;
          var after = R.check(state.rota, state.people);
          setStatus(after.clashes.length ? "warn" : "ok", after.clashes.length
            ? "That made a clash: " + after.clashes[0].says + " A rota with a clash cannot be saved."
            : "Assigned.");
        });
        td.appendChild(add);
        tr.appendChild(td);
      });
      tbody.appendChild(tr);
    });

    /* the checks */
    els.checkSays.textContent = chk.says;
    els.checkList.textContent = "";
    chk.clashes.forEach(function (c) {
      var li = node("li", "clash", "CLASH \u2014 " + c.says);
      els.checkList.appendChild(li);
    });
    chk.rest.forEach(function (r) {
      els.checkList.appendChild(node("li", "rest", "REST \u2014 " + r.says));
    });
    chk.gaps.forEach(function (g) {
      els.checkList.appendChild(node("li", "gap", "GAP \u2014 " + g.says + " (accepted, listed, not hidden)"));
    });
    if (!chk.clashes.length && !chk.rest.length && !chk.gaps.length) {
      els.checkList.appendChild(node("li", null, "Nothing to flag."));
    }

    /* the load */
    var l = R.load(state.rota, state.people);
    els.loadSays.textContent = "\u00b7 " + l.says;
    els.loadList.textContent = "";
    l.rows.forEach(function (r) {
      els.loadList.appendChild(node("li", null, r.name + " \u2014 " + r.shifts + " shift(s)"));
    });

    /* the swap pickers */
    els.swapShift.textContent = "";
    state.rota.shifts.forEach(function (s) {
      var o = document.createElement("option");
      o.value = s.id;
      o.textContent = s.day + " " + s.slot + " \u2014 " + nameOf(s.personId);
      els.swapShift.appendChild(o);
    });
    els.swapTo.textContent = "";
    state.people.forEach(function (p) {
      var o = document.createElement("option");
      o.value = p.id;
      o.textContent = p.name;
      els.swapTo.appendChild(o);
    });

    els.saveBtn.disabled = !chk.canSave;
    els.saveNote.textContent = chk.canSave
      ? "Saving writes it to this device. It opens locally: the others have not seen the change yet."
      : chk.blockedBy;
    els.printBtn.disabled = false;
  }

  /* -------------------------------------------------------------- actions */

  function save() {
    var chk = R.check(state.rota, state.people);
    if (!chk.canSave) { setStatus("bad", chk.blockedBy); return; }
    var ok = persist();
    setStatus(ok ? "ok" : "bad", ok
      ? "Saved on this device. It is pending with the team: nobody else has seen this rota."
      : "Not saved, and it is not shown as agreed with the team.");
  }

  function printIt() {
    var chk = R.check(state.rota, state.people);
    var rows = R.printRows(state.rota, state.people);
    var out = R.exportFile("rota", { rota: state.rota, people: state.people }, { when: today() }, function (name, text, mime) {
      if (!window.Export || typeof window.Export.save !== "function") throw new Error("the export kit did not load");
      window.Export.save(name, text, mime);
      return true;
    });
    if (!out.ok) { setStatus("bad", out.reason + "."); return; }
    setStatus(chk.canSave ? "ok" : "warn", "Wrote " + out.filename + " \u2014 " + rows.length + " row(s), one per person per day" +
      (chk.canSave ? "." : ", with the clashes listed in it."));
  }

  function requestSwap() {
    var shift = state.rota.shifts.filter(function (s) { return s.id === els.swapShift.value; })[0];
    if (!shift) { setStatus("warn", "There is no shift to swap yet."); return; }
    /* the requester is whoever holds the shift; the refusal case is exercised when the holder is
       not the person the swap is for, which the core checks */
    var out = R.requestSwap(state.rota, { fromPersonId: shift.personId, shiftId: shift.id, toPersonId: els.swapTo.value });
    if (!out.ok) {
      els.swapNote.textContent = out.says || out.reason;
      setStatus("bad", out.reason);
      return;
    }
    state.rota = out.rota;
    persist();
    render();
    els.swapNote.textContent = out.says;
    setStatus("ok", out.says);
  }

  /* ---------------------------------------------------------------- wire */

  els.build.addEventListener("click", buildGrid);
  els.saveBtn.addEventListener("click", save);
  els.printBtn.addEventListener("click", printIt);
  els.swapBtn.addEventListener("click", requestSwap);

  /* ------------------------------------------------------------ start up */

  var raw = null;
  try { raw = window.localStorage.getItem(K_STATE); } catch (e) { raw = null; }
  if (raw) {
    var parsed = R.parseState(raw);
    if (parsed.ok) {
      state.people = parsed.state.people;
      state.rota = parsed.state.rota;
      els.team.value = state.people.map(function (p) { return p.name; }).join(", ");
      els.days.value = state.rota.days.join(", ");
      els.maxRun.value = state.rota.rules.maxConsecutiveDays;
      els.gridCard.hidden = false;
      els.lower.hidden = false;
      render();
    } else {
      /* Quarantined: reported, offered for export, never merged into a live rota. */
      state.unreadable = parsed;
      setStatus("bad", parsed.reason);
      var keep = node("button", "small", "Export the quarantined rota");
      keep.addEventListener("click", function () {
        var out = R.exportFile("raw", parsed, { when: today() }, function (name, text, mime) {
          if (!window.Export || typeof window.Export.save !== "function") throw new Error("the export kit did not load");
          window.Export.save(name, text, mime);
          return true;
        });
        setStatus(out.ok ? "ok" : "bad", out.ok ? "Wrote " + out.filename + "." : out.reason);
      });
      els.saveNote.parentNode.insertBefore(keep, els.saveNote);
    }
  }

  if (window.Loom && window.Loom.pwa) window.Loom.pwa.register("sw.js");
})();
