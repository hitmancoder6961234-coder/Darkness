// ===============================
// Clarity AI Lab - UI controller
// Multi-AI chat: one prompt -> N models in parallel, each in its own streaming card.
// Modes: Compare (all answer) / Race (first complete answer wins). Synthesize merges answers.
// ===============================
(function () {
    "use strict";

    var D = window.DarkAI, P = D.providers, ST = D.stream, MD = D.markdown, PR = D.prompts, S = D.store;

    function $(id) { return document.getElementById(id); }
    function esc(s) { return MD.escape(s); }

    var models = S.getModels();
    var prefs = S.getPrefs();
    var turns = [];
    var surveyCache = { text: null, at: 0 };
    var attachments = [];
    var busy = 0;
    var sending = false;
    var turnSeq = 0;

    // ---------- tiny helpers ----------

    function toast(msg, type) {
        var box = $("toasts");
        var t = document.createElement("div");
        t.className = "toast toast--" + (type || "info");
        t.textContent = msg;
        box.appendChild(t);
        setTimeout(function () { t.remove(); }, 3600);
    }

    function announce(msg) {
        var el = $("liveStatus");
        el.textContent = "";
        setTimeout(function () { el.textContent = msg; }, 30);
    }

    function providerOf(m) { return P.getProvider(m.provider) || P.getProvider("custom"); }
    function hueOf(m) { return providerOf(m).hue; }
    function labelOf(m) { return m.name || m.modelName || "Model"; }

    function copyText(text) {
        function fallback() {
            var ta = document.createElement("textarea");
            ta.value = text; ta.style.position = "fixed"; ta.style.opacity = "0";
            document.body.appendChild(ta); ta.select();
            try { document.execCommand("copy"); toast("Copied", "success"); } catch (e) { toast("Copy failed", "danger"); }
            ta.remove();
        }
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(text).then(function () { toast("Copied", "success"); }, fallback);
        } else fallback();
    }

    function nearBottom() {
        return document.documentElement.scrollHeight - (window.scrollY + window.innerHeight) < 160;
    }
    function scrollDown() { window.scrollTo({ top: document.documentElement.scrollHeight, behavior: "auto" }); }

    function fmtSecs(ms) { return (ms / 1000).toFixed(ms < 10000 ? 1 : 0) + "s"; }
    function tokens(text) { return Math.max(1, Math.round(String(text).length / 4)); }

    // ---------- model chips ----------

    function isSelected(id) { return prefs.selected.indexOf(id) !== -1; }

    function selectedModels() { return models.filter(function (m) { return isSelected(m.id); }); }

    function toggleModel(id) {
        var sel = prefs.selected.slice();
        var i = sel.indexOf(id);
        if (i === -1) sel.push(id); else sel.splice(i, 1);
        prefs = S.setPrefs({ selected: sel });
        renderChips();
    }

    function renderChips() {
        var box = $("modelChips");
        box.innerHTML = "";
        models.forEach(function (m) {
            var p = providerOf(m);
            var needsKey = p.needsKey && !m.apiKey;
            var b = document.createElement("button");
            b.type = "button";
            b.className = "chip" + (needsKey ? " chip--warn" : "");
            b.style.setProperty("--hue", p.hue);
            b.setAttribute("aria-pressed", String(isSelected(m.id)));
            var dot = needsKey ? "dot--warn" : m.status === "ok" ? "dot--ok" : m.status === "error" ? "dot--err" : "";
            b.innerHTML = '<span class="dot ' + dot + '"></span><span>' + esc(labelOf(m)) + '</span><span class="chip__sub">' + esc(p.label) + "</span>";
            b.title = needsKey ? "API key needed - click to add it" : (isSelected(m.id) ? "Selected - click to remove" : "Click to include in the next question");
            b.addEventListener("click", function () { if (needsKey) openEditor(m.id); else toggleModel(m.id); });
            box.appendChild(b);
        });
        var add = document.createElement("button");
        add.type = "button"; add.className = "chip chip--add"; add.textContent = "+ Add model";
        add.addEventListener("click", function () { openEditor(null); });
        box.appendChild(add);

        var n = selectedModels().length;
        $("composerHint").textContent = (n ? "Asking " + n + " model" + (n === 1 ? "" : "s") + " · " : "") + "AI answers can be wrong — check important facts.";
        $("onboard").hidden = models.length > 0;
        updateBusy();
    }

    function markModel(m, status) {
        for (var i = 0; i < models.length; i++) {
            if (models[i].id === m.id) {
                if (models[i].status === status) return;
                models[i].status = status;
                models[i].lastTestedAt = Date.now();
                S.upsertModel(models[i]);
                break;
            }
        }
        renderChips();
    }

    // ---------- survey context ----------

    function setSurveyState(text) { $("surveyState").textContent = text; }

    async function ensureSurvey() {
        if (!prefs.useSurvey) return null;
        if (surveyCache.text && Date.now() - surveyCache.at < 300000) return surveyCache.text;
        setSurveyState("Loading survey data…");
        var ctl = new AbortController();
        var timer = setTimeout(function () { ctl.abort(); }, 15000);
        try {
            var text = await PR.fetchSurveyContext(ctl.signal);
            surveyCache = { text: text, at: Date.now() };
            setSurveyState("Survey data loaded - only aggregated counts are sent.");
            return text;
        } catch (e) {
            setSurveyState("Survey data unavailable - answering without it.");
            toast("Could not load survey data; continuing without it.", "warning");
            return null;
        } finally { clearTimeout(timer); }
    }

    // ---------- cards ----------

    var STATUS_DOT = { queued: "dot--live", connecting: "dot--live", streaming: "dot--live", done: "dot--ok", error: "dot--err", stopped: "dot--warn", cancelled: "dot--warn" };
    var ERR_LABEL = { auth: "Auth error", rate_limit: "Rate limited", not_found: "Not found", network: "Network", timeout: "Timed out", server: "Provider error", provider: "Provider error", bad_request: "Rejected", context: "Too long", circuit: "Paused", config: "Setup needed", empty: "Empty" };

    function createCard(turn, model, kind, build) {
        var el = document.createElement("section");
        el.className = "ans" + (kind === "synth" ? " ans--synth" : "");
        el.style.setProperty("--hue", hueOf(model));
        el.dataset.status = "queued";
        var title = kind === "synth" ? "Consensus · " + labelOf(model) : labelOf(model);
        el.innerHTML =
            '<header class="ans__head"><span class="dot"></span><strong>' + esc(title) + '</strong><span class="tag">' + esc(providerOf(model).label) + '</span><span class="ans__meta"></span></header>' +
            '<div class="ans__body" aria-busy="true"></div>' +
            '<footer class="ans__foot">' +
            '<button type="button" class="mini" data-act="copy">Copy</button>' +
            '<button type="button" class="mini mini--danger" data-act="stop">Stop</button>' +
            '<button type="button" class="mini" data-act="retry">Retry</button>' +
            (kind === "answer" ? '<button type="button" class="mini" data-act="best" aria-pressed="false">☆ Best</button>' : "") +
            "</footer>";
        var card = { el: el, model: model, kind: kind, turn: turn, build: build, status: "queued", text: "", error: null, errType: "", note: "", meta: {}, ctl: null, scheduled: false, best: false, winner: false, cancelReason: "" };
        el.__card = card;
        return card;
    }

    function renderCard(card) {
        card.scheduled = false;
        var el = card.el, st = card.status;
        el.dataset.status = st;
        el.classList.toggle("is-winner", !!card.winner);
        el.classList.toggle("is-best", !!card.best);
        el.querySelector(".dot").className = "dot " + (STATUS_DOT[st] || "");

        var live = st === "connecting" || st === "streaming" || st === "queued";
        var meta = "";
        if (st === "queued" || st === "connecting") meta = "Connecting…";
        else if (st === "streaming") meta = "~" + tokens(card.text) + " tok";
        else if (st === "done") meta = (card.meta.first != null ? "first token " + fmtSecs(card.meta.first) + " · " : "") + fmtSecs(card.meta.total || 0) + " · ~" + tokens(card.text) + " tok";
        else if (st === "error") meta = ERR_LABEL[card.errType] || "Error";
        else if (st === "stopped") meta = "Stopped";
        else if (st === "cancelled") meta = "Stopped (race over)";
        if (card.winner) meta = "🏁 Winner · " + meta;
        el.querySelector(".ans__meta").textContent = meta;

        var html = "";
        if (card.text) html += MD.render(card.text);
        if (live && card.text) html += '<span class="cursor"></span>';
        if (!card.text && live) html += '<div class="skeleton" aria-hidden="true"><i></i><i></i><i></i></div>';
        if (card.note && live) html += '<div class="note">' + esc(card.note) + "</div>";
        if (st === "error") html += '<div class="errbox"><strong>' + esc(ERR_LABEL[card.errType] || "Error") + "</strong>" + esc(card.error || "") + "</div>";
        if ((st === "stopped" || st === "cancelled") && !card.text) html += '<div class="note">' + (st === "cancelled" ? "Stopped because another model finished first." : "Stopped.") + "</div>";
        el.querySelector(".ans__body").innerHTML = html;
        el.querySelector(".ans__body").setAttribute("aria-busy", String(live));

        function show(act, on) { var b = el.querySelector('[data-act="' + act + '"]'); if (b) b.hidden = !on; }
        show("copy", !!card.text);
        show("stop", live);
        show("retry", st === "error" || st === "stopped" || st === "cancelled" || (st === "done" && card.kind === "synth"));
        show("best", st === "done");
        var best = el.querySelector('[data-act="best"]');
        if (best) { best.setAttribute("aria-pressed", String(card.best)); best.textContent = card.best ? "★ Best" : "☆ Best"; }
    }

    function schedule(card) {
        if (card.scheduled) return;
        card.scheduled = true;
        requestAnimationFrame(function () {
            var stick = nearBottom();
            renderCard(card);
            if (stick) scrollDown();
        });
    }

    async function startStream(card) {
        var built = card.build();
        var m = card.model;
        card.status = "connecting"; card.text = ""; card.error = null; card.errType = ""; card.note = ""; card.meta = {}; card.winner = false; card.cancelReason = "";
        var ctl = new AbortController();
        card.ctl = ctl;
        busy++; updateBusy();
        if (card.kind === "answer") { card.turn.done = false; renderTools(card.turn); }
        schedule(card);
        try {
            var res = await ST.streamChat(m, {
                system: built.system, messages: built.messages, signal: ctl.signal,
                onFirstToken: function (ms) { card.status = "streaming"; card.note = ""; card.meta.first = ms; },
                onToken: function (d, full) { card.text = full; schedule(card); },
                onRetry: function (n, e) { card.status = "connecting"; card.note = "Retrying (" + n + ") — " + e.message.split(". ")[0]; schedule(card); }
            });
            card.status = "done"; card.meta.total = res.totalMs;
            markModel(m, "ok");
            if (card.kind === "answer") onAnswerDone(card);
        } catch (e) {
            if (e && e.type === "aborted") {
                card.status = card.cancelReason ? "cancelled" : "stopped";
            } else {
                card.status = "error"; card.error = (e && e.message) || "Unexpected error"; card.errType = (e && e.type) || "unknown";
                if (card.errType === "auth" || card.errType === "not_found") markModel(m, "error");
            }
        } finally {
            busy--; card.ctl = null;
            renderCard(card);
            updateBusy();
            checkTurnDone(card.turn);
        }
    }

    function onAnswerDone(card) {
        var turn = card.turn;
        if (turn.mode === "race" && !turn.winner) {
            turn.winner = card; card.winner = true;
            turn.cards.forEach(function (c) { if (c !== card && c.ctl) { c.cancelReason = "race"; c.ctl.abort(); } });
        }
    }

    // ---------- turns ----------

    function historyFor(modelId, uptoTurn) {
        var msgs = [];
        for (var i = 0; i < turns.length; i++) {
            var t = turns[i];
            if (t === uptoTurn) break;
            for (var j = 0; j < t.cards.length; j++) {
                var c = t.cards[j];
                if (c.model.id === modelId && c.status === "done" && c.text) {
                    msgs.push({ role: "user", content: t.userContent }, { role: "assistant", content: c.text });
                }
            }
        }
        return msgs;
    }

    function buildTurnEl(turn) {
        var el = document.createElement("article");
        el.className = "turn";
        var files = turn.files.length ? '<span class="bubble__files">📎 ' + esc(turn.files.join(", ")) + "</span>" : "";
        var badge = turn.surveyUsed ? '<span class="bubble__badge">📊 survey data attached (aggregated counts)</span>' : "";
        el.innerHTML = '<div class="turn__user"><div class="bubble--user">' + esc(turn.prompt) + files + badge + "</div></div>" +
            '<div class="turn__grid" data-n="' + turn.cards.length + '"></div><div class="turn__tools"></div><div class="turn__synth"></div>';
        var grid = el.querySelector(".turn__grid");
        turn.cards.forEach(function (c) { grid.appendChild(c.el); });
        turn.el = el;
        turn.toolsEl = el.querySelector(".turn__tools");
        turn.synthEl = el.querySelector(".turn__synth");
        return el;
    }

    function checkTurnDone(turn) {
        var pending = turn.cards.some(function (c) { return c.status === "queued" || c.status === "connecting" || c.status === "streaming"; });
        if (pending) return;
        var wasDone = turn.done;
        turn.done = true;
        renderTools(turn);
        if (!wasDone) {
            var ok = turn.cards.filter(function (c) { return c.status === "done"; }).length;
            var bad = turn.cards.filter(function (c) { return c.status === "error"; }).length;
            announce(ok + " answer" + (ok === 1 ? "" : "s") + " ready" + (bad ? ", " + bad + " failed" : "") + ".");
        }
    }

    function renderTools(turn) {
        var box = turn.toolsEl;
        box.innerHTML = "";
        if (!turn.done) return;
        var good = turn.cards.filter(function (c) { return c.status === "done"; });
        if (good.length >= 2) {
            var sel = document.createElement("select");
            sel.setAttribute("aria-label", "Model that writes the merged answer");
            var judgeId = prefs.judge && models.some(function (m) { return m.id === prefs.judge; }) ? prefs.judge : good[0].model.id;
            models.forEach(function (m) {
                var o = document.createElement("option");
                o.value = m.id; o.textContent = "Merge with " + labelOf(m); o.selected = m.id === judgeId;
                sel.appendChild(o);
            });
            sel.addEventListener("change", function () { prefs = S.setPrefs({ judge: sel.value }); });
            var btn = document.createElement("button");
            btn.type = "button"; btn.className = "lab-btn lab-btn--primary"; btn.textContent = "✨ Synthesize";
            btn.addEventListener("click", function () { synthesize(turn, sel.value); });
            box.appendChild(btn); box.appendChild(sel);
        }
        if (good.length && turns[turns.length - 1] === turn) {
            var fu = document.createElement("div");
            fu.className = "followups";
            PR.FOLLOW_UPS.forEach(function (f) {
                var b = document.createElement("button");
                b.type = "button"; b.className = "qchip"; b.textContent = f.label;
                b.addEventListener("click", function () { send(f.text); });
                fu.appendChild(b);
            });
            box.appendChild(fu);
        }
    }

    function synthesize(turn, modelId) {
        var judge = models.filter(function (m) { return m.id === modelId; })[0];
        if (!judge) return;
        var good = turn.cards.filter(function (c) { return c.status === "done" && c.text; });
        if (good.length < 2) return;
        var answers = good.map(function (c) { return { name: labelOf(c.model), text: c.text }; });
        var question = turn.prompt;
        var system = PR.buildSystem({ instructions: prefs.instructions });
        var card = createCard(turn, judge, "synth", function () {
            return { system: system, messages: [{ role: "user", content: PR.buildSynthesisPrompt(question, answers) }] };
        });
        turn.synthEl.innerHTML = "";
        var grid = document.createElement("div");
        grid.className = "turn__grid"; grid.dataset.n = "1"; grid.style.maxWidth = "none";
        grid.appendChild(card.el);
        turn.synthEl.appendChild(grid);
        turn.synthCard = card;
        startStream(card);
        card.el.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }

    async function send(text) {
        text = String(text == null ? "" : text).trim();
        if ((!text && !attachments.length) || busy || sending) return;
        var sel = selectedModels();
        if (!sel.length) {
            toast(models.length ? "Pick at least one model above." : "Add a model first.", "warning");
            if (!models.length) openEditor(null);
            return;
        }
        sending = true; updateBusy();
        try {
            var survey = await ensureSurvey();
            var system = PR.buildSystem({ surveyContext: survey, instructions: prefs.instructions });
            var userContent = text || "Please review the attached file(s).";
            var fileNames = attachments.map(function (a) { return a.name; });
            attachments.forEach(function (a) { userContent += "\n\n=== ATTACHED FILE: " + a.name + " ===\n" + a.text + "\n=== END FILE ==="; });

            var turn = { id: ++turnSeq, prompt: text || "(attached files)", userContent: userContent, files: fileNames, mode: prefs.mode, surveyUsed: !!survey, cards: [], done: false, winner: null };
            sel.forEach(function (m) {
                var card = createCard(turn, m, "answer", function () {
                    return { system: system, messages: historyFor(m.id, turn).concat([{ role: "user", content: userContent }]) };
                });
                turn.cards.push(card);
            });
            turns.push(turn);
            $("emptyState").hidden = true;
            // the previous turn no longer offers follow-up chips
            if (turns.length > 1) renderTools(turns[turns.length - 2]);
            $("conversation").appendChild(buildTurnEl(turn));

            $("composerInput").value = ""; autosize();
            attachments = []; renderFiles();
            announce("Asking " + sel.length + " model" + (sel.length === 1 ? "" : "s") + ".");
            turn.el.scrollIntoView({ behavior: "smooth", block: "start" });
            turn.cards.forEach(function (c) { startStream(c); });
        } finally {
            sending = false; updateBusy();
        }
    }

    function stopAll() {
        turns.forEach(function (t) {
            t.cards.concat(t.synthCard ? [t.synthCard] : []).forEach(function (c) { if (c.ctl) c.ctl.abort(); });
        });
    }

    function newChat() {
        stopAll();
        turns = [];
        var conv = $("conversation");
        Array.prototype.slice.call(conv.querySelectorAll(".turn")).forEach(function (n) { n.remove(); });
        $("emptyState").hidden = false;
        announce("New chat started.");
    }

    function exportMarkdown() {
        if (!turns.length) { toast("Nothing to export yet.", "warning"); return; }
        var md = "# Clarity AI Lab conversation\n\n";
        turns.forEach(function (t, i) {
            md += "## Question " + (i + 1) + "\n\n" + t.prompt + "\n\n";
            t.cards.forEach(function (c) {
                md += "### " + labelOf(c.model) + " (" + providerOf(c.model).label + ")\n\n" + (c.text || "_" + (c.error || c.status) + "_") + "\n\n";
            });
            if (t.synthCard && t.synthCard.text) md += "### Consensus (" + labelOf(t.synthCard.model) + ")\n\n" + t.synthCard.text + "\n\n";
        });
        var blob = new Blob([md], { type: "text/markdown" });
        var a = document.createElement("a");
        var d = new Date(), pad = function (n) { return ("0" + n).slice(-2); };
        a.href = URL.createObjectURL(blob);
        a.download = "clarity-ai-lab-" + d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate()) + "-" + pad(d.getHours()) + pad(d.getMinutes()) + ".md";
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000);
    }

    // ---------- composer ----------

    function hasContent() { return !!($("composerInput").value.trim() || attachments.length); }

    function updateBusy() {
        var b = $("sendBtn");
        if (!b) return;
        if (busy > 0) {
            b.classList.add("is-stop"); b.disabled = false;
            b.setAttribute("aria-label", "Stop all"); b.title = "Stop all";
        } else {
            b.classList.remove("is-stop");
            b.disabled = sending || !hasContent();
            b.setAttribute("aria-label", "Send message"); b.title = "Send";
        }
        $("conversation").setAttribute("aria-busy", String(busy > 0));
    }

    function autosize() {
        var t = $("composerInput");
        t.style.height = "auto";
        t.style.height = Math.min(Math.max(t.scrollHeight, 40), 200) + "px";
    }

    function renderFiles() {
        var box = $("fileChips");
        box.innerHTML = "";
        attachments.forEach(function (a, i) {
            var c = document.createElement("span");
            c.className = "fchip";
            c.innerHTML = "<span>" + esc(a.name) + " · " + Math.max(1, Math.round(a.size / 1024)) + " KB</span>";
            var x = document.createElement("button");
            x.type = "button"; x.textContent = "×"; x.setAttribute("aria-label", "Remove " + a.name);
            x.addEventListener("click", function () { attachments.splice(i, 1); renderFiles(); updateBusy(); });
            c.appendChild(x);
            box.appendChild(c);
        });
    }

    function addFiles(list) {
        Array.prototype.slice.call(list).forEach(function (f) {
            if (!/\.(txt|md|csv|tsv|json|log)$/i.test(f.name) && !/^text\//.test(f.type)) { toast(f.name + ": only text files (txt, md, csv, json) are supported.", "warning"); return; }
            if (f.size > 100 * 1024) { toast(f.name + " is larger than 100 KB - skipped.", "warning"); return; }
            var total = attachments.reduce(function (s, a) { return s + a.size; }, 0) + f.size;
            if (total > 200 * 1024) { toast("Attachments are limited to 200 KB in total.", "warning"); return; }
            if (attachments.some(function (a) { return a.name === f.name && a.size === f.size; })) return;
            var r = new FileReader();
            r.onload = function () { attachments.push({ name: f.name, size: f.size, text: String(r.result) }); renderFiles(); updateBusy(); };
            r.readAsText(f);
        });
    }

    // ---------- modal ----------

    var modalLast = null, modalOpen = false;

    function focusables(root) {
        return Array.prototype.slice.call(root.querySelectorAll('button:not([disabled]):not([hidden]), input:not([disabled]), select:not([disabled]), summary, a[href], textarea:not([disabled])'))
            .filter(function (n) { return n.offsetParent !== null; });
    }

    function modalKey(e) {
        var root = $("modalRoot");
        if (e.key === "Escape") { e.preventDefault(); closeModal(); }
        else if (e.key === "Tab") {
            var f = focusables(root);
            if (!f.length) return;
            var first = f[0], last = f[f.length - 1];
            if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
            else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
            else if (!root.contains(document.activeElement)) { e.preventDefault(); first.focus(); }
        }
    }

    function showModal(title, bodyHtml, onMount) {
        var root = $("modalRoot");
        if (!modalOpen) {
            modalLast = document.activeElement;
            modalOpen = true;
            root.classList.add("is-open");
            document.addEventListener("keydown", modalKey, true);
            root.onclick = function (e) { if (e.target === root || e.target.closest("[data-close]")) closeModal(); };
        }
        root.innerHTML = '<div class="modal" role="dialog" aria-modal="true" aria-labelledby="modalTitle"><div class="modal__head"><h2 id="modalTitle">' + esc(title) +
            '</h2><button type="button" class="modal__x" data-close aria-label="Close">×</button></div><div class="modal__body">' + bodyHtml + "</div></div>";
        var body = root.querySelector(".modal__body");
        if (onMount) onMount(body);
        var f = focusables(body);
        (f[0] || root.querySelector(".modal__x")).focus();
    }

    function closeModal() {
        if (!modalOpen) return;
        modalOpen = false;
        var root = $("modalRoot");
        root.classList.remove("is-open");
        root.innerHTML = "";
        document.removeEventListener("keydown", modalKey, true);
        if (modalLast && modalLast.focus) modalLast.focus();
    }

    // ---------- model manager ----------

    function openManager() {
        var rows = models.map(function (m) {
            var p = providerOf(m);
            var needsKey = p.needsKey && !m.apiKey;
            var dot = needsKey ? "dot--warn" : m.status === "ok" ? "dot--ok" : m.status === "error" ? "dot--err" : "";
            return '<div class="mrow"><span class="dot ' + dot + '"></span><div class="mrow__main"><strong>' + esc(labelOf(m)) + "</strong><span>" + esc(p.label) + " · " + esc(m.modelName) +
                (needsKey ? " · key needed" : "") + '</span></div><div class="mrow__btns">' +
                '<button type="button" class="mini" data-test="' + esc(m.id) + '">Test</button>' +
                '<button type="button" class="mini" data-edit="' + esc(m.id) + '">Edit</button>' +
                '<button type="button" class="mini mini--danger" data-del="' + esc(m.id) + '">Delete</button></div></div>';
        }).join("");
        var html = (rows || '<p class="hint">No models yet.</p>') +
            '<button type="button" class="lab-btn lab-btn--primary" data-add>+ Add model</button>' +
            '<label class="check"><input type="checkbox" id="rememberKeys"' + (prefs.rememberKeys ? " checked" : "") + '><span><strong>Remember API keys on this device.</strong> Off by default: keys then live only until you close the tab. When on, keys are stored unencrypted in this browser, and other pages on the same site domain could read them.</span></label>' +
            '<div class="warnbox">Keys are sent only to the provider you pick, directly from your browser. Never use a key you can\'t revoke, and avoid shared computers.</div>' +
            '<div id="mgrMsg"></div>';
        showModal("Your AI models", html, function (body) {
            body.querySelector("[data-add]").addEventListener("click", function () { openEditor(null); });
            body.querySelector("#rememberKeys").addEventListener("change", function (e) { S.setRemember(e.target.checked); prefs = S.getPrefs(); toast(e.target.checked ? "Keys will be remembered on this device." : "Keys are now session-only.", "success"); });
            Array.prototype.forEach.call(body.querySelectorAll("[data-edit]"), function (b) { b.addEventListener("click", function () { openEditor(b.getAttribute("data-edit")); }); });
            Array.prototype.forEach.call(body.querySelectorAll("[data-del]"), function (b) {
                b.addEventListener("click", function () {
                    var id = b.getAttribute("data-del");
                    if (!window.confirm("Remove this model?")) return;
                    S.deleteModel(id); models = S.getModels(); prefs = S.getPrefs(); renderChips(); openManager();
                });
            });
            Array.prototype.forEach.call(body.querySelectorAll("[data-test]"), function (b) {
                b.addEventListener("click", async function () {
                    var m = models.filter(function (x) { return x.id === b.getAttribute("data-test"); })[0];
                    var msg = body.querySelector("#mgrMsg");
                    msg.innerHTML = '<div class="testres testres--info">Testing ' + esc(labelOf(m)) + "…</div>";
                    b.disabled = true;
                    try {
                        var r = await ST.testModel(m);
                        msg.innerHTML = '<div class="testres testres--ok">✓ ' + esc(labelOf(m)) + " responded in " + fmtSecs(r.latencyMs) + ".</div>";
                        markModel(m, "ok");
                    } catch (e) {
                        msg.innerHTML = '<div class="testres testres--err">✗ ' + esc(e.message) + "</div>";
                        markModel(m, "error");
                    }
                    b.disabled = false;
                });
            });
        });
    }

    var PROVIDER_NOTES = {
        anthropic: "Calls go straight from your browser using Anthropic's browser-access header.",
        ollama: "Start Ollama with OLLAMA_ORIGINS set to allow this site, or the browser will block the request.",
        azure: "Base URL is your resource endpoint (https://NAME.openai.azure.com). Model ID is your deployment name.",
        openrouter: "Use model IDs in vendor/name form.",
        custom: "Any server that speaks the OpenAI chat-completions API (it must allow browser CORS)."
    };

    function openEditor(id, presetProvider) {
        var existing = id ? models.filter(function (m) { return m.id === id; })[0] : null;
        var cur = existing || { provider: presetProvider || "gemini", baseUrl: "", modelName: "", name: "", apiKey: "", temperature: "", maxTokens: "", apiVersion: "" };
        var provOpts = P.PROVIDERS.map(function (p) { return '<option value="' + p.id + '"' + (p.id === cur.provider ? " selected" : "") + ">" + esc(p.label) + "</option>"; }).join("");
        var html =
            '<div class="field"><label for="fProv">Provider</label><select id="fProv">' + provOpts + '</select><small id="fProvNote"></small></div>' +
            '<div class="field"><label for="fModel">Model ID</label><div class="row"><input type="text" id="fModel" list="modelIds" autocomplete="off" spellcheck="false" value="' + esc(cur.modelName) + '"><button type="button" class="lab-btn" id="fFetch">Fetch models</button></div><datalist id="modelIds"></datalist><small>Type any model ID, or use Fetch models to list what your key can access.</small></div>' +
            '<div class="two"><div class="field"><label for="fName">Display name <small>(optional)</small></label><input type="text" id="fName" value="' + esc(cur.name) + '"></div>' +
            '<div class="field"><label for="fKey">API key</label><div class="row"><input type="password" id="fKey" autocomplete="off" spellcheck="false" value="' + esc(cur.apiKey) + '"><button type="button" class="lab-btn" id="fShow" aria-pressed="false">Show</button></div></div></div>' +
            '<div class="field"><label for="fBase">Base URL</label><input type="text" id="fBase" spellcheck="false" value="' + esc(cur.baseUrl) + '"><button type="button" class="link" id="fReset">Reset to default</button><small id="fBaseHint"></small></div>' +
            '<details class="adv"><summary>Advanced</summary><div class="two"><div class="field"><label for="fTemp">Temperature</label><input type="number" id="fTemp" step="0.1" min="0" max="2" placeholder="provider default" value="' + esc(cur.temperature) + '"></div>' +
            '<div class="field"><label for="fMax">Max output tokens</label><input type="number" id="fMax" step="1" min="1" placeholder="provider default" value="' + esc(cur.maxTokens) + '"></div></div>' +
            '<div class="field" id="fVerWrap"><label for="fVer">API version (Azure)</label><input type="text" id="fVer" placeholder="2024-10-21" value="' + esc(cur.apiVersion) + '"></div></details>' +
            '<div id="fResult" aria-live="polite"></div>' +
            '<div class="modal__foot"><button type="button" class="lab-btn lab-btn--ghost" id="fBack">Back</button><button type="button" class="lab-btn" id="fTest">Test connection</button><button type="button" class="lab-btn lab-btn--primary" id="fSave">Save</button></div>';

        showModal(existing ? "Edit model" : "Add model", html, function (b) {
            var prevDefault = (P.getProvider(cur.provider) || {}).defaultBase || "";
            var testedStatus = existing ? existing.status : "";
            function q(sel) { return b.querySelector(sel); }
            function provider() { return P.getProvider(q("#fProv").value) || P.getProvider("custom"); }

            function syncProvider(initial) {
                var p = provider();
                var base = q("#fBase");
                if (!initial && (!base.value.trim() || base.value.trim() === prevDefault)) base.value = p.defaultBase;
                if (initial && !base.value.trim()) base.value = p.defaultBase;
                prevDefault = p.defaultBase;
                base.placeholder = p.defaultBase || "https://your-endpoint/v1";
                q("#fKey").placeholder = p.keyPlaceholder;
                q("#fModel").placeholder = p.modelPlaceholder;
                q("#fProvNote").textContent = PROVIDER_NOTES[p.id] || "";
                q("#fVerWrap").hidden = p.adapter !== "azure";
                q("#fFetch").disabled = p.adapter === "azure";
                updateBaseHint();
            }
            function updateBaseHint() {
                var p = provider(), v = q("#fBase").value.trim();
                q("#fBaseHint").textContent = !v ? "Required for this provider." : v === p.defaultBase ? "Standard endpoint for " + p.label + "." : "Custom endpoint.";
            }
            function read() {
                var p = provider();
                return {
                    id: existing ? existing.id : S.newId(), provider: p.id,
                    name: q("#fName").value.trim(), modelName: q("#fModel").value.trim(), apiKey: q("#fKey").value.trim(),
                    baseUrl: q("#fBase").value.trim(), temperature: q("#fTemp").value.trim(), maxTokens: q("#fMax").value.trim(),
                    apiVersion: q("#fVer").value.trim(), status: testedStatus, lastTestedAt: existing ? existing.lastTestedAt : 0
                };
            }
            function result(kind, text) { q("#fResult").innerHTML = '<div class="testres testres--' + kind + '">' + esc(text) + "</div>"; }

            q("#fProv").addEventListener("change", function () { syncProvider(false); });
            q("#fBase").addEventListener("input", updateBaseHint);
            q("#fReset").addEventListener("click", function () { q("#fBase").value = provider().defaultBase; updateBaseHint(); });
            q("#fShow").addEventListener("click", function () {
                var k = q("#fKey"), show = k.type === "password";
                k.type = show ? "text" : "password"; this.textContent = show ? "Hide" : "Show"; this.setAttribute("aria-pressed", String(show));
            });
            q("#fBack").addEventListener("click", function () { openManager(); });
            q("#fFetch").addEventListener("click", async function () {
                var btn = this, m = read();
                btn.disabled = true; result("info", "Fetching models…");
                try {
                    var ids = await ST.listModels(m);
                    q("#modelIds").innerHTML = ids.map(function (x) { return '<option value="' + esc(x) + '"></option>'; }).join("");
                    result("ok", ids.length + " model" + (ids.length === 1 ? "" : "s") + " available. Click the Model ID field and pick one.");
                } catch (e) { result("err", e.message); }
                btn.disabled = false;
            });
            q("#fTest").addEventListener("click", async function () {
                var btn = this, m = read();
                if (!m.modelName) { result("err", "Enter a model ID first."); return; }
                btn.disabled = true; result("info", "Testing connection…");
                try {
                    var r = await ST.testModel(m);
                    testedStatus = "ok";
                    result("ok", "Connected. First token in " + fmtSecs(r.latencyMs) + ".");
                } catch (e) {
                    testedStatus = "error";
                    result("err", e.message);
                }
                btn.disabled = false;
            });
            q("#fSave").addEventListener("click", function () {
                var m = read(), p = provider();
                if (!m.modelName) { result("err", "Model ID is required."); q("#fModel").focus(); return; }
                if (p.needsKey && !m.apiKey) { result("err", "An API key is required for " + p.label + "."); q("#fKey").focus(); return; }
                if (!m.baseUrl) { result("err", "Base URL is required for this provider."); q("#fBase").focus(); return; }
                if (!/^https?:\/\//i.test(m.baseUrl)) { result("err", "Base URL must start with http:// or https://"); q("#fBase").focus(); return; }
                if (!m.name) m.name = m.modelName;
                m.baseUrl = P.trimSlash(m.baseUrl);
                if (m.baseUrl === P.trimSlash(p.defaultBase)) m.baseUrl = "";
                S.upsertModel(m);
                models = S.getModels();
                var sel = prefs.selected.slice();
                if (!existing && sel.indexOf(m.id) === -1) sel.push(m.id);
                prefs = S.setPrefs({ selected: sel });
                ST.breakerReset(m);
                renderChips();
                toast("Saved " + labelOf(m), "success");
                openManager();
            });
            syncProvider(true);
        });
    }

    // ---------- wiring ----------

    function init() {
        // quick prompts
        var qp = $("quickPrompts");
        PR.QUICK_PROMPTS.forEach(function (t) {
            var b = document.createElement("button");
            b.type = "button"; b.className = "qchip"; b.textContent = t;
            b.addEventListener("click", function () {
                if (!prefs.useSurvey) { prefs = S.setPrefs({ useSurvey: true }); $("useSurvey").checked = true; }
                send(t);
            });
            qp.appendChild(b);
        });

        // onboarding quick-add
        var ob = $("onboardBtns");
        ["gemini", "openai", "anthropic", "groq", "openrouter", "ollama"].forEach(function (id) {
            var p = P.getProvider(id);
            var b = document.createElement("button");
            b.type = "button"; b.className = "chip"; b.style.setProperty("--hue", p.hue); b.textContent = "+ " + p.label;
            b.addEventListener("click", function () { openEditor(null, id); });
            ob.appendChild(b);
        });

        // mode
        Array.prototype.forEach.call(document.querySelectorAll(".segmented__opt"), function (b) {
            b.setAttribute("aria-checked", String(b.getAttribute("data-mode") === prefs.mode));
            b.addEventListener("click", function () {
                prefs = S.setPrefs({ mode: b.getAttribute("data-mode") });
                Array.prototype.forEach.call(document.querySelectorAll(".segmented__opt"), function (o) { o.setAttribute("aria-checked", String(o === b)); });
            });
        });

        // survey toggle
        var us = $("useSurvey");
        us.checked = !!prefs.useSurvey;
        us.addEventListener("change", function () {
            prefs = S.setPrefs({ useSurvey: us.checked });
            if (us.checked) ensureSurvey(); else setSurveyState("Sends only aggregated counts (no names or emails).");
        });

        // instructions
        var ins = $("instructions");
        ins.value = prefs.instructions;
        ins.addEventListener("input", function () { prefs = S.setPrefs({ instructions: ins.value }); });
        $("instrBtn").addEventListener("click", function () {
            var wrap = $("instrWrap"), open = wrap.hidden;
            wrap.hidden = !open;
            this.setAttribute("aria-expanded", String(open));
            if (open) ins.focus();
        });
        if (prefs.instructions) { $("instrWrap").hidden = false; $("instrBtn").setAttribute("aria-expanded", "true"); }

        $("manageBtn").addEventListener("click", openManager);
        $("newChatBtn").addEventListener("click", newChat);
        $("exportBtn").addEventListener("click", exportMarkdown);

        // composer
        var input = $("composerInput");
        input.addEventListener("input", function () { autosize(); updateBusy(); });
        input.addEventListener("keydown", function (e) {
            if (e.key === "Enter" && !e.shiftKey && !e.isComposing) { e.preventDefault(); if (!busy) send(input.value); }
        });
        $("sendBtn").addEventListener("click", function () { if (busy > 0) stopAll(); else send(input.value); });
        $("attachBtn").addEventListener("click", function () { $("fileInput").click(); });
        $("fileInput").addEventListener("change", function (e) { addFiles(e.target.files); e.target.value = ""; });
        var card = $("composerCard");
        ["dragenter", "dragover"].forEach(function (ev) { card.addEventListener(ev, function (e) { e.preventDefault(); card.classList.add("is-dragover"); }); });
        ["dragleave", "drop"].forEach(function (ev) { card.addEventListener(ev, function (e) { e.preventDefault(); card.classList.remove("is-dragover"); }); });
        card.addEventListener("drop", function (e) { if (e.dataTransfer && e.dataTransfer.files) addFiles(e.dataTransfer.files); });

        // delegated card actions
        $("conversation").addEventListener("click", function (e) {
            var copyCode = e.target.closest("[data-copy-code]");
            if (copyCode) { var code = copyCode.closest(".md-code").querySelector("code"); copyText(code.textContent); return; }
            var btn = e.target.closest("[data-act]");
            if (!btn) return;
            var el = btn.closest(".ans");
            var c = el && el.__card;
            if (!c) return;
            var act = btn.getAttribute("data-act");
            if (act === "copy") copyText(c.text);
            else if (act === "stop") { if (c.ctl) c.ctl.abort(); }
            else if (act === "retry") { ST.breakerReset(c.model); startStream(c); }
            else if (act === "best") {
                var on = !c.best;
                c.turn.cards.forEach(function (x) { x.best = false; renderCard(x); });
                c.best = on; renderCard(c);
            }
        });

        document.addEventListener("keydown", function (e) {
            if (e.key === "/" && !/^(INPUT|TEXTAREA|SELECT)$/.test((e.target.tagName || "")) && !modalOpen) { e.preventDefault(); input.focus(); }
        });

        renderChips();
        renderFiles();
        autosize();
        updateBusy();
        if (prefs.useSurvey) setSurveyState("Sends only aggregated counts (no names or emails).");
    }

    D.app = { send: send, getTurns: function () { return turns; }, getModels: function () { return models; }, openManager: openManager, openEditor: openEditor };

    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})();
