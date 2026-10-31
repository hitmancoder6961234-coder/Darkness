// ===============================
// Darkness - Admin Console
// Manage access requests + survey responses.
// READ: uses the same public Apps Script endpoint as the dashboard.
// WRITE (approve / reject / pending): requires the owner's ADMIN_KEY, verified server-side
// by google-apps-script.js. The key is kept in sessionStorage only and sent only in POST bodies.
// ===============================
(function () {
    "use strict";

    var API_URL = "https://script.google.com/macros/s/AKfycbxNezU-FZQzKrBSEB8dj0MC8-30a1E7_gw7cK68hHWXrZHofW9gwVglDwlW4e5vkpEw6Q/exec";
    var AUDIT_KEY = "darkness.admin.audit";
    var PREF_KEY = "darkness.admin.prefs";
    var SESSION_KEY = "darkness.admin.key";
    var STALE_DAYS = 3;

    function $(id) { return document.getElementById(id); }
    function esc(s) { return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;"); }

    // ---------- storage (always wrapped) ----------
    function lsGet(k, d) { try { var v = window.localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } }
    function lsSet(k, v) { try { window.localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* ignore */ } }
    function ssGet(k) { try { return window.sessionStorage.getItem(k) || ""; } catch (e) { return ""; } }
    function ssSet(k, v) { try { if (v) window.sessionStorage.setItem(k, v); else window.sessionStorage.removeItem(k); } catch (e) { /* ignore */ } }

    var prefs = lsGet(PREF_KEY, {});
    prefs.adminName = typeof prefs.adminName === "string" ? prefs.adminName : "";
    prefs.size = [10, 25, 50, 100].indexOf(prefs.size) !== -1 ? prefs.size : 10;

    var state = {
        data: null, loading: false, error: "", view: "overview", autoTimer: null,
        key: ssGet(SESSION_KEY), charts: {}, loadedAt: 0,
        req: { q: "", status: "all", sort: { col: "date", dir: "desc" }, page: 1, size: prefs.size, sel: {} },
        res: { q: "", own: "all", brand: "all", sort: { col: "ts", dir: "desc" }, page: 1, size: prefs.size },
        quality: {}
    };
    state.unlocked = !!state.key;

    var VIEWS = {
        overview: { title: "Overview", sub: "Live management view of access requests and survey responses.", ico: "📊" },
        requests: { title: "Access requests", sub: "Review, approve and reject participant access.", ico: "✉️" },
        responses: { title: "Survey responses", sub: "Explore and export submitted responses.", ico: "🗂️" },
        quality: { title: "Data quality", sub: "Automatic checks that need a human decision.", ico: "🛡️" },
        audit: { title: "Audit log", sub: "Admin actions taken from this browser.", ico: "🧾" },
        settings: { title: "Settings", sub: "Admin access, display and data tools.", ico: "⚙️" }
    };

    // ---------- tiny helpers ----------
    function toast(msg, type) {
        var t = document.createElement("div");
        t.className = "adm-toast adm-toast--" + (type || "info");
        t.textContent = msg;
        $("toasts").appendChild(t);
        setTimeout(function () { t.remove(); }, 4200);
    }
    function announce(msg) { var el = $("liveStatus"); el.textContent = ""; setTimeout(function () { el.textContent = msg; }, 30); }
    function pad(n) { return ("0" + n).slice(-2); }
    function fmtDate(ts) {
        if (!ts) return "—";
        var d = new Date(ts);
        return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()) + " " + pad(d.getHours()) + ":" + pad(d.getMinutes());
    }
    function ageDays(ts) { return ts ? (Date.now() - ts) / 86400000 : 0; }
    function ageLabel(ts) {
        if (!ts) return "";
        var d = ageDays(ts);
        if (d < 1) { var h = Math.floor(d * 24); return h < 1 ? "just now" : h + "h ago"; }
        return Math.floor(d) + "d ago";
    }
    function fmtSecs(s) { s = Math.round(s); return s >= 60 ? Math.floor(s / 60) + "m " + (s % 60) + "s" : s + "s"; }
    function validEmail(e) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e); }
    function reduceMotion() { try { return window.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (e) { return false; } }

    // ---------- data ----------
    function normStatus(s) {
        s = String(s || "").trim();
        if (s === "Accepted" || s === "Approved") return "Approved";
        if (s === "Rejected") return "Rejected";
        return "Pending";
    }

    function normalise(raw) {
        var reqs = (raw.requests || []).map(function (r, i) {
            var ts = Date.parse(r["Request Date & Time"] || "") || 0;
            return {
                _i: i, id: String(r["CPRN Number"] || r["Request ID"] || ""), name: String(r["Name"] || ""), email: String(r["Email"] || "").trim(),
                mobile: String(r["Mobile"] || ""), purpose: String(r["Purpose"] || ""), ts: ts, status: normStatus(r["Status"]),
                by: String(r["Approved By"] || ""), raw: r
            };
        });
        var resps = (raw.responses || []).map(function (r, i) {
            var ct = parseFloat(r["Completion Time"]);
            return {
                _i: i, ts: Date.parse(r["Timestamp"] || "") || 0, name: String(r["Name"] || ""), email: String(r["Email"] || "").trim(),
                own: String(r["Laptop Ownership"] || ""), brand: String(r["Preferred Brand"] || ""), usage: String(r["Usage Purpose"] || ""),
                rec: String(r["Final Recommendation"] || ""), time: isFinite(ct) ? ct : 0, raw: r
            };
        });
        return { requests: reqs, responses: resps };
    }

    async function fetchJson(url, ms) {
        var ctl = new AbortController();
        var timer = setTimeout(function () { ctl.abort(); }, ms || 25000);
        try {
            var resp = await fetch(url, { signal: ctl.signal });
            if (!resp.ok) throw new Error("HTTP " + resp.status);
            return await resp.json();
        } finally { clearTimeout(timer); }
    }

    async function loadData(silent) {
        if (state.loading) return;
        state.loading = true;
        if (!silent) { state.error = ""; if (!state.data) render(); }
        $("admRefresh").disabled = true;
        try {
            var raw;
            try {
                raw = await fetchJson(API_URL + "?action=getDashboardData");
                if (!raw || !Array.isArray(raw.requests)) throw new Error("Unexpected data");
            } catch (e) {
                var parts = await Promise.all([fetchJson(API_URL + "?action=getRequestData"), fetchJson(API_URL + "?action=getSurveyData")]);
                raw = { requests: Array.isArray(parts[0]) ? parts[0] : [], responses: Array.isArray(parts[1]) ? parts[1] : [] };
            }
            state.data = normalise(raw);
            state.loadedAt = Date.now();
            state.error = "";
            $("admUpdated").textContent = "Updated " + pad(new Date().getHours()) + ":" + pad(new Date().getMinutes()) + ":" + pad(new Date().getSeconds());
            computeQuality();
        } catch (e) {
            state.error = "Could not load data (" + ((e && e.message) || "network error") + "). Check your connection or the Apps Script deployment.";
            if (silent) toast(state.error, "danger");
        } finally {
            state.loading = false;
            $("admRefresh").disabled = false;
            render();
        }
    }

    // ---------- admin API (write) ----------
    async function adminCall(action, payload) {
        var body = JSON.stringify(Object.assign({ action: action, key: state.key }, payload || {}));
        var headers = { "Content-Type": "text/plain;charset=utf-8" }; // simple request: no CORS preflight
        var ctl = new AbortController();
        var timer = setTimeout(function () { ctl.abort(); }, 30000);
        try {
            var resp = await fetch(API_URL, { method: "POST", headers: headers, body: body, signal: ctl.signal });
            var text = await resp.text();
            var json = null;
            try { json = JSON.parse(text); } catch (e) { throw new Error("The server returned an unexpected response."); }
            return { json: json, verified: true };
        } catch (e) {
            if (e && e.name === "AbortError") throw new Error("The request timed out.");
            if (e instanceof TypeError) {
                // The browser may have blocked READING the response (CORS). Re-send once in no-cors mode
                // (status changes are idempotent server-side, so this cannot double-apply or double-email).
                try {
                    await fetch(API_URL, { method: "POST", mode: "no-cors", headers: headers, body: body });
                    return { json: null, verified: false };
                } catch (e2) { throw new Error("Network error: could not reach the server."); }
            }
            throw e;
        } finally { clearTimeout(timer); }
    }

    function actorName() { return prefs.adminName.trim() || "Admin console"; }

    // ---------- audit ----------
    function audit(entry) {
        var list = lsGet(AUDIT_KEY, []);
        entry.t = Date.now();
        list.unshift(entry);
        lsSet(AUDIT_KEY, list.slice(0, 300));
    }

    // ---------- derived data ----------
    function counts() {
        var r = state.data.requests, c = { total: r.length, Approved: 0, Pending: 0, Rejected: 0, stale: 0 };
        r.forEach(function (x) { c[x.status]++; if (x.status === "Pending" && ageDays(x.ts) > STALE_DAYS) c.stale++; });
        return c;
    }

    function computeQuality() {
        var d = state.data, q = {};
        var seen = {}, dup = [];
        d.requests.forEach(function (r) {
            var k = r.email.toLowerCase();
            if (!k) return;
            if (seen[k]) { if (dup.indexOf(r.email) === -1) dup.push(r.email); } else seen[k] = true;
        });
        var respEmails = {};
        d.responses.forEach(function (r) { if (r.email) respEmails[r.email.toLowerCase()] = true; });
        var approvedEmails = {};
        d.requests.forEach(function (r) { if (r.status === "Approved") approvedEmails[r.email.toLowerCase()] = true; });

        q.stale = d.requests.filter(function (r) { return r.status === "Pending" && ageDays(r.ts) > STALE_DAYS; }).map(function (r) { return r.email; });
        q.dup = dup;
        q.waiting = d.requests.filter(function (r) { return r.status === "Approved" && !respEmails[r.email.toLowerCase()]; }).map(function (r) { return r.email; });
        q.unapproved = d.responses.filter(function (r) { return r.email && !approvedEmails[r.email.toLowerCase()]; }).map(function (r) { return r.email; });
        q.badEmail = d.requests.filter(function (r) { return !validEmail(r.email); }).map(function (r) { return r.email || "(blank) " + (r.name || r.id); });
        q.noMobile = d.requests.filter(function (r) { return !r.mobile.trim(); }).map(function (r) { return r.email; });
        q.fast = d.responses.filter(function (r) { return r.time > 0 && r.time < 20; }).map(function (r) { return (r.email || "(no email)") + " — " + fmtSecs(r.time); });
        q.slow = d.responses.filter(function (r) { return r.time > 3600; }).map(function (r) { return (r.email || "(no email)") + " — " + fmtSecs(r.time); });
        state.quality = q;
    }

    function qualityIssueCount() {
        var q = state.quality;
        return ["stale", "dup", "unapproved", "badEmail", "fast", "slow"].reduce(function (s, k) { return s + (q[k] ? q[k].length : 0); }, 0);
    }

    // ---------- rendering: shell ----------
    function renderNav() {
        var nav = $("admNav");
        nav.innerHTML = "";
        Object.keys(VIEWS).forEach(function (id) {
            var b = document.createElement("button");
            b.type = "button";
            b.setAttribute("data-view", id);
            if (id === state.view) b.setAttribute("aria-current", "page");
            var badge = "";
            if (state.data) {
                if (id === "requests") { var p = counts().Pending; badge = '<span class="adm-nav__badge"' + (p ? "" : " hidden") + ">" + p + "</span>"; }
                if (id === "quality") { var n = qualityIssueCount(); badge = '<span class="adm-nav__badge"' + (n ? "" : " hidden") + ">" + n + "</span>"; }
            }
            b.innerHTML = '<span class="adm-nav__ico" aria-hidden="true">' + VIEWS[id].ico + "</span><span>" + esc(VIEWS[id].title) + "</span>" + badge;
            b.addEventListener("click", function () { go(id); });
            nav.appendChild(b);
        });
    }

    function renderKeyBtn() {
        var b = $("admKeyBtn");
        b.setAttribute("data-state", state.unlocked ? "open" : "locked");
        b.innerHTML = state.unlocked ? "🔓 Unlocked" : "🔒 Locked";
        b.title = state.unlocked ? "Admin actions enabled for this tab. Click to lock." : "Click to enter the admin key and enable approvals.";
    }

    function go(view) {
        state.view = view;
        closeDrawer();
        render();
        $("admMain").scrollIntoView({ block: "start" });
        var h = location.hash.replace("#", "");
        if (h !== view) { try { history.replaceState(null, "", "#" + view); } catch (e) { /* ignore */ } }
    }

    function render() {
        var v = VIEWS[state.view];
        $("admTitle").textContent = v.title;
        $("admSub").textContent = v.sub;
        document.title = v.title + " | Admin Console";
        renderNav();
        renderKeyBtn();
        var main = $("admMain");
        destroyCharts();

        if (state.view === "audit") { main.innerHTML = auditHtml(); bindAudit(); return; }
        if (state.view === "settings") { main.innerHTML = settingsHtml(); bindSettings(); return; }

        if (!state.data) {
            if (state.error) {
                main.innerHTML = '<div class="adm-panel"><div class="adm-empty">' + esc(state.error) + '<br><br><button type="button" class="adm-btn adm-btn--primary" id="admRetry">Try again</button></div></div>';
                $("admRetry").addEventListener("click", function () { loadData(false); });
            } else {
                main.innerHTML = '<div class="adm-kpis"><div class="adm-skel"></div><div class="adm-skel"></div><div class="adm-skel"></div><div class="adm-skel"></div></div><div class="adm-skel" style="height:260px"></div>';
            }
            return;
        }
        if (state.view === "overview") { main.innerHTML = overviewHtml(); bindOverview(); }
        else if (state.view === "requests") { main.innerHTML = requestsHtml(); bindRequests(); }
        else if (state.view === "responses") { main.innerHTML = responsesHtml(); bindResponses(); }
        else if (state.view === "quality") { main.innerHTML = qualityHtml(); bindQuality(); }
    }

    // ---------- Overview ----------
    function kpi(label, num, cls, raw) {
        return '<div class="adm-kpi' + (cls ? " adm-kpi--" + cls : "") + '"><span class="adm-kpi__num" data-count="' + esc(raw == null ? "" : raw) + '">' + esc(num) + '</span><span class="adm-kpi__label">' + esc(label) + "</span></div>";
    }

    function overviewHtml() {
        var c = counts(), d = state.data;
        var resp = d.responses.length;
        var rate = c.Approved ? Math.min(100, Math.round(resp / c.Approved * 100)) : 0;
        var times = d.responses.filter(function (r) { return r.time > 0; }).map(function (r) { return r.time; });
        var avg = times.length ? times.reduce(function (a, b) { return a + b; }, 0) / times.length : 0;

        var html = "";
        if (c.stale) {
            html += '<div class="adm-alert">⏳ <span><strong>' + c.stale + "</strong> pending request" + (c.stale === 1 ? " has" : "s have") + " been waiting more than " + STALE_DAYS + ' days.</span><button type="button" class="adm-btn adm-btn--warn adm-btn--sm" id="goStale">Review now</button></div>';
        } else if (c.Pending) {
            html += '<div class="adm-alert">✉️ <span><strong>' + c.Pending + "</strong> request" + (c.Pending === 1 ? " is" : "s are") + ' waiting for a decision.</span><button type="button" class="adm-btn adm-btn--warn adm-btn--sm" id="goPending">Review</button></div>';
        } else {
            html += '<div class="adm-alert adm-alert--good">✅ Inbox zero — no requests are waiting.</div>';
        }
        html += '<div class="adm-kpis">' +
            kpi("Total requests", c.total, "", c.total) + kpi("Approved", c.Approved, "green", c.Approved) + kpi("Pending", c.Pending, "amber", c.Pending) +
            kpi("Rejected", c.Rejected, "red", c.Rejected) + kpi("Survey responses", resp, "violet", resp) +
            kpi("Completion rate", rate + "%", "cyan", rate) + kpi("Avg completion", avg ? fmtSecs(avg) : "—", "", "") + "</div>";
        html += '<div class="adm-grid">' +
            '<div class="adm-card"><h2>Request status</h2><div class="adm-chart"><canvas id="chStatus" aria-label="Request status chart" role="img"></canvas></div></div>' +
            '<div class="adm-card"><h2>Requests per day</h2><div class="adm-chart"><canvas id="chReqDay" aria-label="Requests per day chart" role="img"></canvas></div></div>' +
            '<div class="adm-card"><h2>Responses per day</h2><div class="adm-chart"><canvas id="chRespDay" aria-label="Responses per day chart" role="img"></canvas></div></div>' +
            '<div class="adm-card"><h2>Owners vs buyers</h2><div class="adm-chart"><canvas id="chOwn" aria-label="Owners versus buyers chart" role="img"></canvas></div></div>' +
            '<div class="adm-card"><h2>Preferred brand</h2><div class="adm-chart"><canvas id="chBrand" aria-label="Preferred brand chart" role="img"></canvas></div></div>' +
            "</div>";

        var recent = d.requests.slice().sort(function (a, b) { return b.ts - a.ts; }).slice(0, 6);
        html += '<div class="adm-panel"><div class="adm-panel__head"><h2>Latest requests</h2><button type="button" class="adm-btn adm-btn--sm" id="goReq">View all</button></div>';
        html += recent.length ? '<div class="adm-table-wrap"><table class="adm-table"><thead><tr><th>Name</th><th>Email</th><th>When</th><th>Status</th></tr></thead><tbody>' +
            recent.map(function (r) { return "<tr data-open-req=\"" + r._i + "\"><td>" + esc(r.name || "—") + "</td><td>" + esc(r.email) + "</td><td>" + esc(fmtDate(r.ts)) + ' <span class="age">' + esc(ageLabel(r.ts)) + "</span></td><td>" + badge(r.status) + "</td></tr>"; }).join("") +
            "</tbody></table></div>" : '<div class="adm-empty">No requests yet.</div>';
        html += "</div>";
        return html;
    }

    function badge(status) { return '<span class="adm-badge adm-badge--' + status.toLowerCase() + '">' + esc(status) + "</span>"; }

    function countUp() {
        var els = document.querySelectorAll(".adm-kpi__num[data-count]");
        Array.prototype.forEach.call(els, function (el) {
            var raw = el.getAttribute("data-count");
            if (raw === "" || reduceMotion()) return;
            var target = parseFloat(raw), suffix = /%$/.test(el.textContent) ? "%" : "";
            if (!isFinite(target)) return;
            var t0 = performance.now();
            (function tick(now) {
                var p = Math.min(1, (now - t0) / 700), eased = 1 - Math.pow(1 - p, 3);
                el.textContent = Math.round(target * eased) + suffix;
                if (p < 1) requestAnimationFrame(tick);
            })(t0);
        });
    }

    function destroyCharts() {
        Object.keys(state.charts).forEach(function (k) { try { state.charts[k].destroy(); } catch (e) { /* ignore */ } });
        state.charts = {};
    }

    function mkChart(id, cfg) {
        var cv = $(id);
        if (!cv) return;
        if (typeof Chart === "undefined") { cv.parentNode.innerHTML = '<div class="adm-empty">Charts unavailable (Chart.js could not load).</div>'; return; }
        state.charts[id] = new Chart(cv.getContext("2d"), cfg);
    }

    function tally(rows, fn) {
        var m = {};
        rows.forEach(function (r) { var k = fn(r); if (k) m[k] = (m[k] || 0) + 1; });
        return m;
    }

    function perDay(rows) {
        var m = {};
        rows.forEach(function (r) { if (r.ts) { var d = new Date(r.ts); var k = d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); m[k] = (m[k] || 0) + 1; } });
        var keys = Object.keys(m).sort();
        return { labels: keys, data: keys.map(function (k) { return m[k]; }) };
    }

    function drawCharts() {
        if (typeof Chart !== "undefined") {
            Chart.defaults.color = "#cbd5e1";
            Chart.defaults.borderColor = "rgba(255,255,255,0.08)";
            Chart.defaults.font.family = "Poppins, sans-serif";
        }
        var c = counts(), d = state.data;
        var base = { responsive: true, maintainAspectRatio: false };
        var legend = { position: "bottom", labels: { usePointStyle: true, padding: 14, font: { size: 11 } } };
        var statusLabels = ["Approved", "Pending", "Rejected"].filter(function (s) { return c[s] > 0; });
        mkChart("chStatus", {
            type: "doughnut",
            data: { labels: statusLabels.length ? statusLabels : ["No data"], datasets: [{ data: statusLabels.length ? statusLabels.map(function (s) { return c[s]; }) : [1], backgroundColor: statusLabels.length ? statusLabels.map(function (s) { return { Approved: "#16a34a", Pending: "#f59e0b", Rejected: "#ef4444" }[s]; }) : ["#64748b"], borderWidth: 0, hoverOffset: 8 }] },
            options: Object.assign({}, base, { plugins: { legend: legend } })
        });
        function line(id, series, color) {
            mkChart(id, {
                type: "line",
                data: { labels: series.labels, datasets: [{ data: series.data, borderColor: color, backgroundColor: color + "22", fill: true, tension: 0.4, pointRadius: 4, pointBackgroundColor: color, pointBorderColor: "#fff", pointBorderWidth: 1.5 }] },
                options: Object.assign({}, base, { plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } }, x: { grid: { display: false } } } })
            });
        }
        line("chReqDay", perDay(d.requests), "#4ea3ff");
        line("chRespDay", perDay(d.responses), "#a78bfa");
        var own = tally(d.responses, function (r) { return r.own === "Yes" ? "Owners" : r.own === "No" ? "Buyers" : ""; });
        mkChart("chOwn", {
            type: "doughnut",
            data: { labels: Object.keys(own).length ? Object.keys(own) : ["No data"], datasets: [{ data: Object.keys(own).length ? Object.keys(own).map(function (k) { return own[k]; }) : [1], backgroundColor: Object.keys(own).length ? ["#3b82f6", "#22d3ee"] : ["#64748b"], borderWidth: 0, hoverOffset: 8 }] },
            options: Object.assign({}, base, { plugins: { legend: legend } })
        });
        var br = tally(d.responses, function (r) { return r.brand; });
        var bk = Object.keys(br).sort(function (a, b) { return br[b] - br[a]; });
        mkChart("chBrand", {
            type: "bar",
            data: { labels: bk, datasets: [{ data: bk.map(function (k) { return br[k]; }), backgroundColor: "#7c3aed", borderRadius: 8, borderWidth: 0 }] },
            options: Object.assign({}, base, { indexAxis: "y", plugins: { legend: { display: false } }, scales: { x: { beginAtZero: true, ticks: { stepSize: 1 } }, y: { grid: { display: false } } } })
        });
    }

    function bindOverview() {
        drawCharts();
        countUp();
        var s = $("goStale"), p = $("goPending"), a = $("goReq");
        if (s) s.addEventListener("click", function () { state.req.status = "Pending"; state.req.sort = { col: "date", dir: "asc" }; state.req.page = 1; go("requests"); });
        if (p) p.addEventListener("click", function () { state.req.status = "Pending"; state.req.page = 1; go("requests"); });
        if (a) a.addEventListener("click", function () { go("requests"); });
        Array.prototype.forEach.call(document.querySelectorAll("[data-open-req]"), function (tr) {
            tr.addEventListener("click", function () { openRequestDrawer(parseInt(tr.getAttribute("data-open-req"), 10)); });
        });
    }

    // ---------- shared table helpers ----------
    function cmp(a, b, dir) { var r = a < b ? -1 : a > b ? 1 : 0; return dir === "asc" ? r : -r; }

    function pagerHtml(total, page, size, prefix) {
        var pages = Math.max(1, Math.ceil(total / size));
        var from = total ? (page - 1) * size + 1 : 0, to = Math.min(total, page * size);
        return '<div class="adm-pager"><span>' + from + "–" + to + " of " + total + '</span><div class="adm-pager__btns">' +
            '<label class="sr-only" for="' + prefix + 'Size">Rows per page</label><select id="' + prefix + 'Size" class="adm-btn adm-btn--sm">' +
            [10, 25, 50, 100].map(function (n) { return '<option value="' + n + '"' + (n === size ? " selected" : "") + ">" + n + " / page</option>"; }).join("") + "</select>" +
            '<button type="button" class="adm-btn adm-btn--sm" id="' + prefix + 'Prev"' + (page <= 1 ? " disabled" : "") + '>Previous</button>' +
            "<span>Page " + page + " of " + pages + '</span><button type="button" class="adm-btn adm-btn--sm" id="' + prefix + 'Next"' + (page >= pages ? " disabled" : "") + ">Next</button></div></div>";
    }

    function thHtml(col, label, sort) {
        var active = sort.col === col;
        return '<th class="is-sortable" tabindex="0" data-col="' + col + '"' + (active ? ' aria-sort="' + (sort.dir === "asc" ? "ascending" : "descending") + '"' : "") + ">" + esc(label) + (active ? (sort.dir === "asc" ? " ▲" : " ▼") : "") + "</th>";
    }

    function bindSort(container, sortObj, rerender) {
        Array.prototype.forEach.call(container.querySelectorAll("th.is-sortable"), function (th) {
            function act() {
                var col = th.getAttribute("data-col");
                if (sortObj.col === col) sortObj.dir = sortObj.dir === "asc" ? "desc" : "asc"; else { sortObj.col = col; sortObj.dir = "asc"; }
                rerender();
            }
            th.addEventListener("click", act);
            th.addEventListener("keydown", function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); act(); } });
        });
    }

    function csvEscape(v) {
        var s = String(v == null ? "" : v);
        if (/^[=+\-@\t\r]/.test(s)) s = "'" + s; // neutralise spreadsheet formula injection
        return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
    }

    function downloadCsv(name, rows) {
        if (!rows.length) { toast("Nothing to export.", "warning"); return; }
        var cols = [];
        rows.forEach(function (r) { Object.keys(r).forEach(function (k) { if (cols.indexOf(k) === -1) cols.push(k); }); });
        var out = [cols.map(csvEscape).join(",")].concat(rows.map(function (r) { return cols.map(function (c) { return csvEscape(r[c]); }).join(","); }));
        var blob = new Blob(["﻿" + out.join("\r\n")], { type: "text/csv;charset=utf-8" });
        var a = document.createElement("a");
        var d = new Date();
        a.href = URL.createObjectURL(blob);
        a.download = name + "-" + d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate()) + ".csv";
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000);
        toast("Exported " + rows.length + " row" + (rows.length === 1 ? "" : "s") + ".", "success");
    }

    // ---------- Access requests ----------
    function filteredRequests() {
        var s = state.req, q = s.q.trim().toLowerCase();
        var list = state.data.requests.filter(function (r) {
            if (s.status !== "all" && r.status !== s.status) return false;
            if (!q) return true;
            return (r.name + " " + r.email + " " + r.id + " " + r.mobile + " " + r.purpose).toLowerCase().indexOf(q) !== -1;
        });
        list.sort(function (a, b) {
            var col = s.sort.col, x, y;
            if (col === "date") { x = a.ts; y = b.ts; }
            else if (col === "id") { x = a.id.toLowerCase(); y = b.id.toLowerCase(); }
            else if (col === "name") { x = a.name.toLowerCase(); y = b.name.toLowerCase(); }
            else if (col === "email") { x = a.email.toLowerCase(); y = b.email.toLowerCase(); }
            else if (col === "mobile") { x = a.mobile; y = b.mobile; }
            else if (col === "status") { x = a.status; y = b.status; }
            else { x = a.by.toLowerCase(); y = b.by.toLowerCase(); }
            return cmp(x, y, s.sort.dir);
        });
        return list;
    }

    function selectedEmails() { return Object.keys(state.req.sel).filter(function (k) { return state.req.sel[k]; }); }

    function requestsHtml() {
        var s = state.req;
        return '<div class="adm-panel">' +
            '<div class="adm-tools"><label class="sr-only" for="reqQ">Search requests</label><input type="search" id="reqQ" placeholder="Search name, email, CPRN, mobile…" value="' + esc(s.q) + '">' +
            '<label class="sr-only" for="reqStatus">Status filter</label><select id="reqStatus">' +
            ["all", "Pending", "Approved", "Rejected"].map(function (o) { return '<option value="' + o + '"' + (o === s.status ? " selected" : "") + ">" + (o === "all" ? "All statuses" : o) + "</option>"; }).join("") +
            '</select><span class="spacer"></span><button type="button" class="adm-btn" id="reqExport">⬇ Export CSV</button></div>' +
            '<div class="adm-bulk" id="reqBulk" role="region" aria-label="Bulk actions"></div>' +
            '<div id="reqTable"></div></div>';
    }

    function renderReqTable() {
        var s = state.req, list = filteredRequests();
        var pages = Math.max(1, Math.ceil(list.length / s.size));
        if (s.page > pages) s.page = pages;
        var pageRows = list.slice((s.page - 1) * s.size, s.page * s.size);
        var allOnPage = pageRows.length && pageRows.every(function (r) { return s.sel[r.email.toLowerCase()]; });

        var html;
        if (!list.length) {
            html = '<div class="adm-empty">' + (state.data.requests.length ? "No requests match these filters." : "No access requests yet.") + "</div>";
        } else {
            html = '<div class="adm-table-wrap"><table class="adm-table adm-table--sticky"><thead><tr><th style="width:36px"><input type="checkbox" id="reqAll" aria-label="Select all on this page"' + (allOnPage ? " checked" : "") + "></th>" +
                thHtml("id", "CPRN", s.sort) + thHtml("name", "Name", s.sort) + thHtml("email", "Email", s.sort) + thHtml("mobile", "Mobile", s.sort) +
                thHtml("date", "Requested", s.sort) + thHtml("status", "Status", s.sort) + thHtml("by", "Decided by", s.sort) + "<th>Actions</th></tr></thead><tbody>" +
                pageRows.map(function (r) {
                    var key = r.email.toLowerCase(), old = r.status === "Pending" && ageDays(r.ts) > STALE_DAYS;
                    var quick = r.status === "Pending"
                        ? '<button type="button" class="adm-btn adm-btn--good adm-btn--sm" data-q-approve="' + r._i + '" aria-label="Approve ' + esc(r.email) + '">Approve</button><button type="button" class="adm-btn adm-btn--bad adm-btn--sm" data-q-reject="' + r._i + '" aria-label="Reject ' + esc(r.email) + '">Reject</button>'
                        : '<button type="button" class="adm-btn adm-btn--sm" data-q-view="' + r._i + '">View</button>';
                    return '<tr data-row="' + r._i + '" class="' + (s.sel[key] ? "is-selected" : "") + '"><td><input type="checkbox" data-sel="' + esc(key) + '" aria-label="Select ' + esc(r.email) + '"' + (s.sel[key] ? " checked" : "") + "></td>" +
                        "<td>" + esc(r.id || "—") + "</td><td>" + esc(r.name || "—") + "</td><td>" + esc(r.email) + "</td><td>" + esc(r.mobile || "—") + "</td>" +
                        "<td>" + esc(fmtDate(r.ts)) + ' <span class="age' + (old ? " is-old" : "") + '">' + esc(ageLabel(r.ts)) + "</span></td><td>" + badge(r.status) + "</td><td>" + esc(r.by || "—") + '</td><td><div class="adm-actions">' + quick + "</div></td></tr>";
                }).join("") + "</tbody></table></div>" + pagerHtml(list.length, s.page, s.size, "req");
        }
        var host = $("reqTable");
        host.innerHTML = html;
        renderBulk(list);
        if (!list.length) return;

        bindSort(host, s.sort, renderReqTable);
        $("reqAll").addEventListener("change", function (e) {
            pageRows.forEach(function (r) { s.sel[r.email.toLowerCase()] = e.target.checked; });
            renderReqTable();
        });
        Array.prototype.forEach.call(host.querySelectorAll("[data-sel]"), function (cb) {
            cb.addEventListener("click", function (e) { e.stopPropagation(); });
            cb.addEventListener("change", function () { s.sel[cb.getAttribute("data-sel")] = cb.checked; renderReqTable(); });
        });
        Array.prototype.forEach.call(host.querySelectorAll("[data-row]"), function (tr) {
            tr.addEventListener("click", function () { openRequestDrawer(parseInt(tr.getAttribute("data-row"), 10)); });
        });
        function quickBtn(attr, status) {
            Array.prototype.forEach.call(host.querySelectorAll("[" + attr + "]"), function (b) {
                b.addEventListener("click", function (e) {
                    e.stopPropagation();
                    var r = state.data.requests[parseInt(b.getAttribute(attr), 10)];
                    if (status) confirmStatus([r.email], status); else openRequestDrawer(r._i);
                });
            });
        }
        quickBtn("data-q-approve", "Approved"); quickBtn("data-q-reject", "Rejected"); quickBtn("data-q-view", null);
        $("reqSize").addEventListener("change", function (e) { s.size = parseInt(e.target.value, 10); s.page = 1; prefs.size = s.size; lsSet(PREF_KEY, prefs); renderReqTable(); });
        $("reqPrev").addEventListener("click", function () { s.page--; renderReqTable(); });
        $("reqNext").addEventListener("click", function () { s.page++; renderReqTable(); });
    }

    function renderBulk(list) {
        var bar = $("reqBulk");
        if (!bar) return;
        var sel = selectedEmails();
        bar.classList.toggle("is-on", sel.length > 0);
        if (!sel.length) { bar.innerHTML = ""; return; }
        var more = list.length > sel.length ? '<button type="button" class="adm-btn adm-btn--sm" id="bulkAll">Select all ' + list.length + " matching</button>" : "";
        bar.innerHTML = "<strong>" + sel.length + " selected</strong>" +
            '<button type="button" class="adm-btn adm-btn--good adm-btn--sm" data-bulk="Approved">Approve</button>' +
            '<button type="button" class="adm-btn adm-btn--bad adm-btn--sm" data-bulk="Rejected">Reject</button>' +
            '<button type="button" class="adm-btn adm-btn--warn adm-btn--sm" data-bulk="Pending">Set to pending</button>' + more +
            '<button type="button" class="adm-btn adm-btn--sm" id="bulkCopy">Copy emails</button><button type="button" class="adm-btn adm-btn--sm" id="bulkClear">Clear</button>';
        Array.prototype.forEach.call(bar.querySelectorAll("[data-bulk]"), function (b) {
            b.addEventListener("click", function () { confirmStatus(sel.map(function (k) { return emailByKey(k); }), b.getAttribute("data-bulk")); });
        });
        $("bulkClear").addEventListener("click", function () { state.req.sel = {}; renderReqTable(); });
        $("bulkCopy").addEventListener("click", function () { copyText(sel.map(emailByKey).join("\n")); });
        var all = $("bulkAll");
        if (all) all.addEventListener("click", function () { list.forEach(function (r) { state.req.sel[r.email.toLowerCase()] = true; }); renderReqTable(); });
    }

    function emailByKey(k) {
        var r = state.data.requests.filter(function (x) { return x.email.toLowerCase() === k; })[0];
        return r ? r.email : k;
    }

    function bindRequests() {
        var s = state.req, t;
        $("reqQ").addEventListener("input", function (e) {
            clearTimeout(t);
            var v = e.target.value;
            t = setTimeout(function () { s.q = v; s.page = 1; renderReqTable(); }, 160);
        });
        $("reqStatus").addEventListener("change", function (e) { s.status = e.target.value; s.page = 1; renderReqTable(); });
        $("reqExport").addEventListener("click", function () {
            downloadCsv("access-requests", filteredRequests().map(function (r) {
                return { "CPRN": r.id, "Name": r.name, "Email": r.email, "Mobile": r.mobile, "Purpose": r.purpose, "Requested": r.ts ? new Date(r.ts).toISOString() : "", "Status": r.status, "Decided by": r.by };
            }));
        });
        renderReqTable();
    }

    // ---------- status change (secure) ----------
    function confirmStatus(emails, status) {
        emails = emails.filter(Boolean);
        if (!emails.length) return;
        if (!state.unlocked) { openUnlock(function () { confirmStatus(emails, status); }); return; }
        var verb = { Approved: "Approve", Rejected: "Reject", Pending: "Move to pending" }[status];
        var list = emails.slice(0, 8).map(esc).join("<br>") + (emails.length > 8 ? "<br>…and " + (emails.length - 8) + " more" : "");
        var mail = status === "Approved"
            ? '<label class="adm-check-row"><input type="checkbox" id="mSend" checked><span>Send each participant the approval email with their survey link. (Google limits free accounts to about 100 emails per day.)</span></label>' : "";
        showModal(verb + " " + emails.length + " request" + (emails.length === 1 ? "" : "s") + "?",
            '<p>This changes the live Google Sheet and cannot be undone from here (you can set the status again).</p><div class="adm-list">' + list + "</div>" + mail + '<div id="mRes" aria-live="polite"></div>' +
            '<div class="adm-modal__foot"><button type="button" class="adm-btn" data-close>Cancel</button><button type="button" class="adm-btn ' + (status === "Approved" ? "adm-btn--good" : status === "Rejected" ? "adm-btn--bad" : "adm-btn--warn") + '" id="mGo">' + esc(verb) + "</button></div>",
            function (m) {
                m.querySelector("#mGo").addEventListener("click", async function () {
                    var btn = this, res = m.querySelector("#mRes");
                    var send = m.querySelector("#mSend") ? m.querySelector("#mSend").checked : false;
                    btn.disabled = true;
                    res.innerHTML = '<div class="adm-res adm-res--info">Applying…</div>';
                    try {
                        var out = await adminCall("adminSetStatus", { newStatus: status, emails: emails, by: actorName(), sendEmail: send ? "true" : "false" });
                        if (out.json && out.json.status !== "success") {
                            var msg = out.json.message || "The server refused the request.";
                            if (/invalid admin key/i.test(msg)) lock(true);
                            res.innerHTML = '<div class="adm-res adm-res--err">' + esc(msg) + "</div>";
                            audit({ action: verb, status: "failed", count: emails.length, emails: emails.slice(0, 5), note: msg });
                            btn.disabled = false;
                            return;
                        }
                        applyLocal(emails, status);
                        var note = out.json ? "updated " + out.json.updated + ", unchanged " + out.json.unchanged + (out.json.emailed ? ", emailed " + out.json.emailed : "") + (out.json.notFound && out.json.notFound.length ? ", not found " + out.json.notFound.length : "") : "sent (unconfirmed)";
                        audit({ action: verb, status: out.json ? "ok" : "unconfirmed", count: emails.length, emails: emails.slice(0, 5), note: note });
                        state.req.sel = {};
                        closeModal();
                        closeDrawer();
                        computeQuality();
                        render();
                        toast(out.json ? verb + " done: " + note + "." : "Sent. Checking the sheet to confirm…", out.json ? "success" : "warning");
                        announce(verb + " complete.");
                        setTimeout(function () { verify(emails, status); }, out.json ? 1500 : 2800);
                    } catch (e) {
                        res.innerHTML = '<div class="adm-res adm-res--err">' + esc(e.message) + "</div>";
                        audit({ action: verb, status: "failed", count: emails.length, emails: emails.slice(0, 5), note: e.message });
                        btn.disabled = false;
                    }
                });
            });
    }

    function applyLocal(emails, status) {
        var set = {};
        emails.forEach(function (e) { set[e.toLowerCase()] = true; });
        state.data.requests.forEach(function (r) {
            if (set[r.email.toLowerCase()]) { r.status = status; r.by = status === "Pending" ? "" : actorName(); }
        });
    }

    async function verify(emails, status) {
        await loadData(true);
        if (!state.data) return;
        var set = {};
        emails.forEach(function (e) { set[e.toLowerCase()] = true; });
        var bad = state.data.requests.filter(function (r) { return set[r.email.toLowerCase()] && r.status !== status; }).length;
        if (bad) toast(bad + " request" + (bad === 1 ? "" : "s") + " did not change in the sheet. Check the admin key and the Apps Script deployment.", "danger");
    }

    // ---------- unlock ----------
    function lock(silent) {
        state.key = ""; state.unlocked = false; ssSet(SESSION_KEY, "");
        renderKeyBtn();
        if (!silent) toast("Admin actions locked.", "success");
    }

    function openUnlock(then) {
        showModal("Unlock admin actions",
            "<p>Enter the <strong>ADMIN_KEY</strong> you saved in the Apps Script project's Script properties. It is checked on the server, kept only in this tab, and cleared when the tab closes.</p>" +
            '<div class="adm-field"><label for="uName">Your name <small>(recorded as &ldquo;Decided by&rdquo;)</small></label><input type="text" id="uName" maxlength="60" autocomplete="name" value="' + esc(prefs.adminName) + '"></div>' +
            '<div class="adm-field"><label for="uKey">Admin key</label><input type="password" id="uKey" autocomplete="off" spellcheck="false"></div><div id="uRes" aria-live="polite"></div>' +
            '<div class="adm-modal__foot"><button type="button" class="adm-btn" data-close>Cancel</button><button type="button" class="adm-btn adm-btn--primary" id="uGo">Unlock</button></div>',
            function (m) {
                var keyEl = m.querySelector("#uKey");
                async function go() {
                    var key = keyEl.value.trim(), res = m.querySelector("#uRes"), btn = m.querySelector("#uGo");
                    if (!key) { res.innerHTML = '<div class="adm-res adm-res--err">Enter the admin key.</div>'; return; }
                    prefs.adminName = m.querySelector("#uName").value.trim(); lsSet(PREF_KEY, prefs);
                    btn.disabled = true; res.innerHTML = '<div class="adm-res adm-res--info">Checking…</div>';
                    var prev = state.key; state.key = key;
                    try {
                        var out = await adminCall("adminPing", {});
                        if (out.json && out.json.status !== "success") {
                            state.key = prev;
                            res.innerHTML = '<div class="adm-res adm-res--err">' + esc(out.json.message || "Key rejected.") + "</div>";
                            btn.disabled = false; return;
                        }
                        ssSet(SESSION_KEY, key); state.unlocked = true;
                        closeModal(); renderKeyBtn();
                        toast(out.json ? "Admin actions unlocked." : "Key saved. The browser blocked reading the reply, so the first approval will confirm it.", out.json ? "success" : "warning");
                        if (then) then();
                    } catch (e) {
                        state.key = prev;
                        res.innerHTML = '<div class="adm-res adm-res--err">' + esc(e.message) + "</div>";
                        btn.disabled = false;
                    }
                }
                m.querySelector("#uGo").addEventListener("click", go);
                keyEl.addEventListener("keydown", function (e) { if (e.key === "Enter") go(); });
                m.querySelector("#uName").focus();
            });
    }

    // ---------- drawer ----------
    var drawerOpener = null;

    function openDrawer(title, bodyHtml, onMount) {
        var root = $("admDrawerRoot");
        drawerOpener = document.activeElement;
        root.hidden = false;
        root.innerHTML = '<aside class="adm-drawer" role="dialog" aria-modal="true" aria-labelledby="drTitle"><div class="adm-drawer__head"><h2 id="drTitle">' + esc(title) + '</h2><button type="button" class="adm-x" data-close-drawer aria-label="Close details">×</button></div>' + bodyHtml + "</aside>";
        root.onclick = function (e) { if (e.target === root || e.target.closest("[data-close-drawer]")) closeDrawer(); };
        document.addEventListener("keydown", drawerKey);
        if (onMount) onMount(root.querySelector(".adm-drawer"));
        var x = root.querySelector("[data-close-drawer]"); if (x) x.focus();
    }
    function drawerKey(e) { if (e.key === "Escape" && !$("modalRoot").classList.contains("is-open")) closeDrawer(); }
    function closeDrawer() {
        var root = $("admDrawerRoot");
        if (root.hidden) return;
        root.hidden = true; root.innerHTML = "";
        document.removeEventListener("keydown", drawerKey);
        if (drawerOpener && drawerOpener.focus && document.body.contains(drawerOpener)) drawerOpener.focus();
    }

    function dl(pairs) {
        return '<dl class="adm-dl">' + pairs.map(function (p) { return "<div><dt>" + esc(p[0]) + "</dt><dd>" + (p[2] ? p[1] : esc(p[1] === "" || p[1] == null ? "—" : p[1])) + "</dd></div>"; }).join("") + "</dl>";
    }

    function openRequestDrawer(i) {
        var r = state.data.requests[i];
        if (!r) return;
        var email = r.email ? '<a href="mailto:' + esc(r.email) + '" style="color:#7cc4ff">' + esc(r.email) + "</a>" : "";
        var acts = "";
        if (r.status !== "Approved") acts += '<button type="button" class="adm-btn adm-btn--good" data-d="Approved">Approve</button>';
        if (r.status !== "Rejected") acts += '<button type="button" class="adm-btn adm-btn--bad" data-d="Rejected">Reject</button>';
        if (r.status !== "Pending") acts += '<button type="button" class="adm-btn adm-btn--warn" data-d="Pending">Set to pending</button>';
        acts += '<button type="button" class="adm-btn" data-d-copy>Copy email</button>';
        var has = state.data.responses.some(function (x) { return x.email.toLowerCase() === r.email.toLowerCase(); });
        openDrawer(r.name || r.email || "Request",
            dl([["Status", badge(r.status), true], ["CPRN number", r.id], ["Name", r.name], ["Email", email, true], ["Mobile", r.mobile], ["Purpose", r.purpose],
                ["Requested", r.ts ? fmtDate(r.ts) + " (" + ageLabel(r.ts) + ")" : ""], ["Decided by", r.by], ["Survey", has ? "Responded" : (r.status === "Approved" ? "Not yet submitted" : "—")]]) +
            '<div class="adm-actions" style="flex-wrap:wrap;gap:8px">' + acts + "</div>",
            function (root) {
                Array.prototype.forEach.call(root.querySelectorAll("[data-d]"), function (b) { b.addEventListener("click", function () { confirmStatus([r.email], b.getAttribute("data-d")); }); });
                root.querySelector("[data-d-copy]").addEventListener("click", function () { copyText(r.email); });
            });
    }

    // ---------- Survey responses ----------
    function filteredResponses() {
        var s = state.res, q = s.q.trim().toLowerCase();
        var list = state.data.responses.filter(function (r) {
            if (s.own !== "all" && r.own !== s.own) return false;
            if (s.brand !== "all" && r.brand !== s.brand) return false;
            if (!q) return true;
            return (r.name + " " + r.email + " " + r.brand + " " + r.usage + " " + r.rec).toLowerCase().indexOf(q) !== -1;
        });
        list.sort(function (a, b) {
            var col = s.sort.col, x = a[col], y = b[col];
            if (typeof x === "string") { x = x.toLowerCase(); y = String(y).toLowerCase(); }
            return cmp(x, y, s.sort.dir);
        });
        return list;
    }

    function responsesHtml() {
        var s = state.res;
        var brands = Object.keys(tally(state.data.responses, function (r) { return r.brand; })).sort();
        return '<div class="adm-panel"><div class="adm-tools">' +
            '<label class="sr-only" for="resQ">Search responses</label><input type="search" id="resQ" placeholder="Search email, brand, usage…" value="' + esc(s.q) + '">' +
            '<label class="sr-only" for="resOwn">Ownership</label><select id="resOwn">' + [["all", "Owners & buyers"], ["Yes", "Owners"], ["No", "Buyers"]].map(function (o) { return '<option value="' + o[0] + '"' + (o[0] === s.own ? " selected" : "") + ">" + o[1] + "</option>"; }).join("") + "</select>" +
            '<label class="sr-only" for="resBrand">Brand</label><select id="resBrand"><option value="all">All brands</option>' + brands.map(function (b) { return '<option value="' + esc(b) + '"' + (b === s.brand ? " selected" : "") + ">" + esc(b) + "</option>"; }).join("") + "</select>" +
            '<span class="spacer"></span><button type="button" class="adm-btn" id="resExport">⬇ Export CSV</button></div><div id="resTable"></div></div>';
    }

    function renderResTable() {
        var s = state.res, list = filteredResponses();
        var pages = Math.max(1, Math.ceil(list.length / s.size));
        if (s.page > pages) s.page = pages;
        var rows = list.slice((s.page - 1) * s.size, s.page * s.size);
        var host = $("resTable");
        if (!list.length) { host.innerHTML = '<div class="adm-empty">' + (state.data.responses.length ? "No responses match these filters." : "No survey responses yet.") + "</div>"; return; }
        host.innerHTML = '<div class="adm-table-wrap"><table class="adm-table"><thead><tr>' + thHtml("ts", "Submitted", s.sort) + thHtml("email", "Email", s.sort) + thHtml("own", "Owner?", s.sort) + thHtml("usage", "Usage", s.sort) + thHtml("brand", "Brand", s.sort) + thHtml("rec", "Recommendation", s.sort) + thHtml("time", "Time", s.sort) + "</tr></thead><tbody>" +
            rows.map(function (r) {
                return '<tr data-row="' + r._i + '"><td>' + esc(fmtDate(r.ts)) + "</td><td>" + esc(r.email || "—") + "</td><td>" + esc(r.own === "Yes" ? "Owner" : r.own === "No" ? "Buyer" : "—") + "</td><td>" + esc(r.usage || "—") + "</td><td>" + esc(r.brand || "—") + "</td><td>" + esc(r.rec || "—") + '</td><td class="num">' + (r.time ? esc(fmtSecs(r.time)) : "—") + "</td></tr>";
            }).join("") + "</tbody></table></div>" + pagerHtml(list.length, s.page, s.size, "res");
        bindSort(host, s.sort, renderResTable);
        Array.prototype.forEach.call(host.querySelectorAll("[data-row]"), function (tr) {
            tr.addEventListener("click", function () { openResponseDrawer(parseInt(tr.getAttribute("data-row"), 10)); });
        });
        $("resSize").addEventListener("change", function (e) { s.size = parseInt(e.target.value, 10); s.page = 1; prefs.size = s.size; lsSet(PREF_KEY, prefs); renderResTable(); });
        $("resPrev").addEventListener("click", function () { s.page--; renderResTable(); });
        $("resNext").addEventListener("click", function () { s.page++; renderResTable(); });
    }

    function bindResponses() {
        var s = state.res, t;
        $("resQ").addEventListener("input", function (e) { clearTimeout(t); var v = e.target.value; t = setTimeout(function () { s.q = v; s.page = 1; renderResTable(); }, 160); });
        $("resOwn").addEventListener("change", function (e) { s.own = e.target.value; s.page = 1; renderResTable(); });
        $("resBrand").addEventListener("change", function (e) { s.brand = e.target.value; s.page = 1; renderResTable(); });
        $("resExport").addEventListener("click", function () { downloadCsv("survey-responses", filteredResponses().map(function (r) { return r.raw; })); });
        renderResTable();
    }

    function openResponseDrawer(i) {
        var r = state.data.responses[i];
        if (!r) return;
        var pairs = Object.keys(r.raw).map(function (k) {
            var v = r.raw[k];
            if (k === "Timestamp") v = fmtDate(Date.parse(v) || 0);
            if (k === "Completion Time" && parseFloat(v) > 0) v = fmtSecs(parseFloat(v));
            return [k, v];
        });
        openDrawer(r.email || "Response", dl(pairs) + '<div class="adm-actions"><button type="button" class="adm-btn" id="drAsk">Ask the AI Lab about this data</button></div>', function (root) {
            root.querySelector("#drAsk").addEventListener("click", function () { window.location.href = "ai.html"; });
        });
    }

    // ---------- Data quality ----------
    function checkCard(id, title, desc, items, level, copyable) {
        var cls = items.length === 0 ? "ok" : level;
        return '<div class="adm-check adm-check--' + cls + '"><div class="adm-check__head"><span class="adm-check__count">' + items.length + "</span><h3>" + esc(title) + "</h3></div><p>" + esc(desc) + "</p>" +
            (items.length ? "<ul>" + items.slice(0, 50).map(function (x) { return "<li>" + esc(x) + "</li>"; }).join("") + (items.length > 50 ? "<li>…and " + (items.length - 50) + " more</li>" : "") + "</ul>" : "") +
            (items.length && copyable ? '<button type="button" class="adm-btn adm-btn--sm" data-copy-q="' + id + '">Copy emails</button>' : "") + "</div>";
    }

    function qualityHtml() {
        var q = state.quality;
        return '<div class="adm-checks">' +
            checkCard("stale", "Stale pending requests", "Waiting longer than " + STALE_DAYS + " days for a decision.", q.stale, "warn", true) +
            checkCard("waiting", "Approved, not yet responded", "Approved participants who have not submitted the survey (reminder candidates).", q.waiting, "warn", true) +
            checkCard("dup", "Duplicate requests", "The same email appears more than once in Requests.", q.dup, "warn", true) +
            checkCard("unapproved", "Responses without approval", "Survey responses from emails that are not approved.", q.unapproved, "bad", true) +
            checkCard("badEmail", "Invalid or blank emails", "Requests whose email would not receive the approval link.", q.badEmail, "bad", false) +
            checkCard("noMobile", "Missing mobile number", "Requests with an empty mobile field.", q.noMobile, "warn", true) +
            checkCard("fast", "Suspiciously fast responses", "Completed in under 20 seconds — may be random clicking.", q.fast, "warn", false) +
            checkCard("slow", "Very slow responses", "Completion time over 1 hour (left open).", q.slow, "warn", false) + "</div>";
    }

    function bindQuality() {
        Array.prototype.forEach.call(document.querySelectorAll("[data-copy-q]"), function (b) {
            b.addEventListener("click", function () { copyText((state.quality[b.getAttribute("data-copy-q")] || []).join("\n")); });
        });
    }

    // ---------- Audit ----------
    function auditHtml() {
        var list = lsGet(AUDIT_KEY, []);
        return '<div class="adm-panel"><div class="adm-panel__head"><h2>Recent admin actions</h2><div><button type="button" class="adm-btn adm-btn--sm" id="auExport">⬇ Export CSV</button> <button type="button" class="adm-btn adm-btn--bad adm-btn--sm" id="auClear">Clear log</button></div></div>' +
            '<p class="adm-note" style="margin-bottom:14px">This log lives only in this browser. For a tamper-proof record, use the Google Sheet\'s version history (File &rarr; Version history).</p>' +
            (list.length ? '<div class="adm-table-wrap"><table class="adm-table" style="min-width:560px"><thead><tr><th>When</th><th>Action</th><th>Result</th><th>Count</th><th>Details</th></tr></thead><tbody>' +
                list.map(function (a) { return "<tr><td>" + esc(fmtDate(a.t)) + "</td><td>" + esc(a.action) + "</td><td>" + badgeFor(a.status) + '</td><td class="num">' + esc(a.count) + "</td><td title=\"" + esc((a.emails || []).join(", ")) + "\">" + esc(a.note || "") + "</td></tr>"; }).join("") + "</tbody></table></div>"
                : '<div class="adm-empty">No actions recorded yet.</div>') + "</div>";
    }
    function badgeFor(s) { var m = { ok: "approved", failed: "rejected", unconfirmed: "pending" }; return '<span class="adm-badge adm-badge--' + (m[s] || "info") + '">' + esc(s) + "</span>"; }
    function bindAudit() {
        $("auClear").addEventListener("click", function () { if (window.confirm("Clear the local audit log?")) { lsSet(AUDIT_KEY, []); render(); } });
        $("auExport").addEventListener("click", function () {
            downloadCsv("admin-audit-log", lsGet(AUDIT_KEY, []).map(function (a) { return { When: new Date(a.t).toISOString(), Action: a.action, Result: a.status, Count: a.count, Emails: (a.emails || []).join("; "), Note: a.note || "" }; }));
        });
    }

    // ---------- Settings ----------
    function settingsHtml() {
        var lvl = parseInt(document.documentElement.getAttribute("data-fx-level"), 10);
        if (!(lvl >= 0)) lvl = 2;
        return '<div class="adm-settings">' +
            '<div class="adm-panel"><h2>Admin access</h2>' +
            '<div class="adm-setrow"><div><strong>Admin key</strong><span>' + (state.unlocked ? "Unlocked for this tab. Cleared when the tab closes." : "Locked. Required to approve or reject requests.") + '</span></div><button type="button" class="adm-btn ' + (state.unlocked ? "" : "adm-btn--primary") + '" id="stKey">' + (state.unlocked ? "Lock now" : "Unlock…") + "</button></div>" +
            '<div class="adm-setrow"><div><strong>Your name</strong><span>Recorded as &ldquo;Decided by&rdquo; on every approval or rejection.</span></div><div class="adm-field" style="margin:0"><input type="text" id="stName" maxlength="60" value="' + esc(prefs.adminName) + '" placeholder="Admin console"></div></div>' +
            '<div class="adm-note">Reading data uses the same open endpoint as the public dashboard. <strong>Approving/rejecting is protected only by ADMIN_KEY on the server</strong> (set in the Apps Script project\'s Script properties, then deploy a new version). Locking this page does not hide the data the endpoint already serves.</div></div>' +
            '<div class="adm-panel"><h2>Display</h2><div class="adm-setrow"><div><strong>Glow level</strong><span>Controls the neon lighting effects on every page (saved in this browser).</span></div><div id="stFx" class="adm-actions">' +
            [["Off", 0], ["Subtle", 1], ["Normal", 2], ["Vivid", 3]].map(function (o) { return '<button type="button" class="adm-btn adm-btn--sm' + (o[1] === lvl ? " adm-btn--primary" : "") + '" data-fx="' + o[1] + '">' + o[0] + "</button>"; }).join("") + "</div></div>" +
            '<div class="adm-setrow"><div><strong>Auto-refresh</strong><span>Reload data every 30 seconds (also in the top bar).</span></div><span>' + (state.autoTimer ? "On" : "Off") + "</span></div></div>" +
            '<div class="adm-panel"><h2>Data tools</h2>' +
            '<div class="adm-setrow"><div><strong>Download full snapshot (JSON)</strong><span>All requests and responses currently loaded, for backup.</span></div><button type="button" class="adm-btn" id="stSnap">⬇ Download</button></div>' +
            '<div class="adm-setrow"><div><strong>Open the Google Sheet tools</strong><span>The sheet also has an &ldquo;Admin Tools&rdquo; menu (approve/reject selected, rebuild statistics).</span></div><span>Extensions menu in Sheets</span></div>' +
            '<div class="adm-setrow"><div><strong>Clarity AI Lab</strong><span>Ask several AI models about the survey data at once.</span></div><a class="adm-btn" href="ai.html">Open AI Lab</a></div></div></div>';
    }

    function bindSettings() {
        $("stKey").addEventListener("click", function () { if (state.unlocked) { lock(false); render(); } else openUnlock(render); });
        $("stName").addEventListener("input", function (e) { prefs.adminName = e.target.value; lsSet(PREF_KEY, prefs); });
        Array.prototype.forEach.call(document.querySelectorAll("[data-fx]"), function (b) {
            b.addEventListener("click", function () {
                if (window.DarkFX) window.DarkFX.setLevel(parseInt(b.getAttribute("data-fx"), 10));
                Array.prototype.forEach.call(document.querySelectorAll("[data-fx]"), function (o) { o.classList.toggle("adm-btn--primary", o === b); });
            });
        });
        $("stSnap").addEventListener("click", function () {
            if (!state.data) { toast("Load data first.", "warning"); return; }
            var blob = new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), requests: state.data.requests.map(function (r) { return r.raw; }), responses: state.data.responses.map(function (r) { return r.raw; }) }, null, 2)], { type: "application/json" });
            var a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "darkness-snapshot-" + new Date().toISOString().slice(0, 10) + ".json";
            document.body.appendChild(a); a.click(); a.remove(); setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000);
        });
    }

    // ---------- modal ----------
    var modalLast = null, modalOpen = false;
    function focusables(root) {
        return Array.prototype.slice.call(root.querySelectorAll("button:not([disabled]), input:not([disabled]), select:not([disabled]), a[href], textarea:not([disabled])")).filter(function (n) { return n.offsetParent !== null; });
    }
    function modalKey(e) {
        var root = $("modalRoot");
        if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); closeModal(); }
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
            modalLast = document.activeElement; modalOpen = true;
            root.classList.add("is-open");
            document.addEventListener("keydown", modalKey, true);
            root.onclick = function (e) { if (e.target === root || e.target.closest("[data-close]")) closeModal(); };
        }
        root.innerHTML = '<div class="adm-modal" role="dialog" aria-modal="true" aria-labelledby="mTitle"><h2 id="mTitle">' + esc(title) + "</h2>" + bodyHtml + "</div>";
        var m = root.querySelector(".adm-modal");
        if (onMount) onMount(m);
        var f = focusables(m);
        if (f.length && !m.contains(document.activeElement)) (f[0].matches("[data-close]") && f[1] ? f[1] : f[0]).focus();
    }
    function closeModal() {
        if (!modalOpen) return;
        modalOpen = false;
        var root = $("modalRoot");
        root.classList.remove("is-open"); root.innerHTML = "";
        document.removeEventListener("keydown", modalKey, true);
        if (modalLast && modalLast.focus && document.body.contains(modalLast)) modalLast.focus();
    }

    function copyText(text) {
        function fb() {
            var ta = document.createElement("textarea"); ta.value = text; ta.style.position = "fixed"; ta.style.opacity = "0";
            document.body.appendChild(ta); ta.select();
            try { document.execCommand("copy"); toast("Copied.", "success"); } catch (e) { toast("Copy failed.", "danger"); }
            ta.remove();
        }
        if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(function () { toast("Copied.", "success"); }, fb); else fb();
    }

    // ---------- init ----------
    function init() {
        $("admRefresh").addEventListener("click", function () { loadData(false); });
        $("admAuto").addEventListener("change", function (e) {
            clearInterval(state.autoTimer); state.autoTimer = null;
            if (e.target.checked) state.autoTimer = setInterval(function () { if (!document.hidden) loadData(true); }, 30000);
            if (state.view === "settings") render();
        });
        $("admKeyBtn").addEventListener("click", function () { if (state.unlocked) lock(false); else openUnlock(); });
        window.addEventListener("hashchange", function () { var h = location.hash.replace("#", ""); if (VIEWS[h] && h !== state.view) { state.view = h; render(); } });
        var h = location.hash.replace("#", "");
        if (VIEWS[h]) state.view = h;
        render();
        loadData(false);
    }

    window.DarkAdmin = { _state: state, _normalise: normalise, _csvEscape: csvEscape, _adminCall: adminCall };
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})();
