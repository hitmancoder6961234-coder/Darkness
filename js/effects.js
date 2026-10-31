// ===============================
// Darkness - Light effects layer
// Purely decorative and opt-in: this script tags existing elements with fx-* classes,
// and css/effects.css only styles those classes. If this file fails to load, the page
// looks exactly like it did before. Respects prefers-reduced-motion and touch devices.
//
// Dynamic glow:
//   - scroll-driven: aurora orbs parallax + hue-shift, a glowing comet on the right-hand rail,
//     and cards whose neon border brightens as they cross the middle of the screen
//   - click-driven: shockwave ring + sparks at the pointer, pulse on the pressed button
//   - pointer-driven: cursor halo and per-card spotlight
//   - a small dock lets visitors pick the glow level (Off / Subtle / Normal / Vivid)
// ===============================
(function () {
    "use strict";
    if (window.__fxLoaded) return;
    window.__fxLoaded = true;

    var reduce = false, fine = true;
    try {
        reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        fine = window.matchMedia("(pointer: fine)").matches;
    } catch (e) { /* older browsers: keep defaults */ }

    var root = document.documentElement;
    var LEVEL_KEY = "darkness.fx.level";
    var LEVELS = [{ v: 0, label: "Off" }, { v: 1, label: "Subtle" }, { v: 2, label: "Normal" }, { v: 3, label: "Vivid" }];
    var level = 2;
    try {
        var saved = parseInt(window.localStorage.getItem(LEVEL_KEY), 10);
        if (saved >= 0 && saved <= 3) level = saved;
    } catch (e) { /* storage blocked: default level */ }
    if (reduce) level = Math.min(level, 1);

    var MAP = {
        "fx-card": ".card, .stat-card, .trend-card, .why-card, .chart-card, .table-section, .survey-card, .progress-section, .choice-btn, .screen, .composer-card, .lab-bar, .onboard, .ans, .modal, .mrow, .container > .form-box, .adm-card, .adm-kpi, .adm-panel",
        "fx-lit": ".stat-card, .chart-card, .trend-card, .why-card, .table-section, .card, .adm-card, .adm-kpi, .adm-panel",
        "fx-btn": "button:not(.modal__x):not(.md-code__copy):not(.segmented__opt):not(.mini):not(.fx-dock__btn):not(.fx-level), a.btn, a.primary, a.secondary, a.btn-secondary, a.btn-primary, a.back-link, a.survey-link, .qchip",
        "fx-gradient-text": ".hero h1, .logo, .header-text h1, .survey-card > h1, .cta h2, .empty h2, .adm-brand strong",
        "fx-glow-num": ".stat-number, .why-number, .adm-kpi__num",
        "fx-reveal": ".stat-card, .chart-card, .table-section, .section-title, .trend-card, .why-card, .card, .progress-section"
    };

    var hostSelector = ".hero, .cta, .market-section, .why-section";

    var revealIO = null, litIO = null;
    var litVisible = [];

    if ("IntersectionObserver" in window) {
        if (!reduce) {
            revealIO = new IntersectionObserver(function (entries) {
                entries.forEach(function (en) {
                    if (en.isIntersecting) { en.target.classList.add("fx-in"); revealIO.unobserve(en.target); }
                });
            }, { threshold: 0.08 });
        }
        litIO = new IntersectionObserver(function (entries) {
            entries.forEach(function (en) {
                var i = litVisible.indexOf(en.target);
                if (en.isIntersecting) { if (i === -1) litVisible.push(en.target); }
                else if (i !== -1) litVisible.splice(i, 1);
            });
            scheduleScroll();
        }, { rootMargin: "10% 0px" });
    }

    function decorate(scope) {
        scope = scope || document;
        Object.keys(MAP).forEach(function (cls) {
            var list = scope.querySelectorAll(MAP[cls]);
            for (var i = 0; i < list.length; i++) {
                var el = list[i];
                if (el.classList.contains(cls)) continue;
                if (cls === "fx-reveal") {
                    // elements inside the AI Lab / admin console animate on their own
                    if (el.closest && el.closest(".lab, .modal-root, .adm")) continue;
                    el.classList.add(cls);
                    if (revealIO) revealIO.observe(el); else el.classList.add("fx-in");
                } else if (cls === "fx-lit") {
                    if (el.closest && el.closest(".lab, .modal-root")) continue;
                    el.classList.add(cls);
                    if (litIO) litIO.observe(el);
                } else {
                    el.classList.add(cls);
                }
            }
        });
        var hosts = scope.querySelectorAll(hostSelector);
        for (var h = 0; h < hosts.length; h++) {
            var host = hosts[h];
            if (host.__fxHost) continue;
            host.__fxHost = true;
            host.classList.add("fx-host");
            host.insertAdjacentHTML("afterbegin", '<i class="fx-orb fx-orb--a" aria-hidden="true"></i><i class="fx-orb fx-orb--b" aria-hidden="true"></i>');
        }
    }

    // ---------- global layer ----------

    var layerEl = null, railEl = null, barEl = null, haloEl = null;

    function buildLayer() {
        layerEl = document.createElement("div");
        layerEl.className = "fx-layer";
        layerEl.setAttribute("aria-hidden", "true");
        layerEl.innerHTML = '<i class="fx-orb fx-orb--a"></i><i class="fx-orb fx-orb--b"></i><i class="fx-orb fx-orb--c"></i><i class="fx-grid"></i><canvas class="fx-stars"></canvas>';
        document.body.insertBefore(layerEl, document.body.firstChild);

        barEl = document.createElement("div");
        barEl.className = "fx-progress";
        barEl.setAttribute("aria-hidden", "true");
        document.body.appendChild(barEl);

        railEl = document.createElement("div");
        railEl.className = "fx-rail";
        railEl.setAttribute("aria-hidden", "true");
        document.body.appendChild(railEl);

        if (fine && !reduce) {
            haloEl = document.createElement("div");
            haloEl.className = "fx-halo";
            haloEl.setAttribute("aria-hidden", "true");
            document.body.appendChild(haloEl);
        }
    }

    var mouse = { x: window.innerWidth / 2, y: window.innerHeight / 3, hx: 0, hy: 0, moved: false };
    var starsApi = null;

    function startStars(canvas) {
        var ctx = canvas.getContext && canvas.getContext("2d");
        if (!ctx) return null;
        var dpr = Math.min(window.devicePixelRatio || 1, 1.5);
        var w = 0, h = 0, stars = [], raf = 0, running = false;

        function resize() {
            w = window.innerWidth; h = window.innerHeight;
            canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
            canvas.style.width = w + "px"; canvas.style.height = h + "px";
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            var n = Math.max(24, Math.min(80, Math.round(w * h / 22000)));
            stars = [];
            for (var i = 0; i < n; i++) {
                stars.push({
                    x: Math.random() * w, y: Math.random() * h, r: Math.random() * 1.4 + 0.3,
                    vx: (Math.random() - 0.5) * 0.08, vy: -Math.random() * 0.12 - 0.02,
                    ph: Math.random() * Math.PI * 2, sp: Math.random() * 0.02 + 0.006, d: Math.random() * 0.8 + 0.2,
                    hue: [210, 265, 190][i % 3]
                });
            }
            draw();
        }

        function draw() {
            ctx.clearRect(0, 0, w, h);
            if (level === 0) return;
            var px = (mouse.x / w - 0.5), py = (mouse.y / h - 0.5);
            var boost = 0.6 + level * 0.25;
            for (var i = 0; i < stars.length; i++) {
                var s = stars[i];
                if (!reduce) {
                    s.x += s.vx; s.y += s.vy; s.ph += s.sp;
                    if (s.y < -4) { s.y = h + 4; s.x = Math.random() * w; }
                    if (s.x < -4) s.x = w + 4; else if (s.x > w + 4) s.x = -4;
                }
                var a = Math.min(1, (0.25 + 0.55 * (0.5 + 0.5 * Math.sin(s.ph))) * boost);
                // scroll parallax: stars drift upward as you scroll, deeper stars move less
                var sy = ((s.y - scrollY * 0.10 * s.d) % h + h) % h;
                var x = s.x + px * 18 * s.d, y = sy + py * 18 * s.d;
                ctx.beginPath();
                ctx.fillStyle = "hsla(" + s.hue + ",90%,78%," + a.toFixed(3) + ")";
                ctx.shadowColor = "hsla(" + s.hue + ",95%,70%,0.9)";
                ctx.shadowBlur = 6;
                ctx.arc(x, y, s.r * (0.8 + level * 0.15), 0, 6.2832);
                ctx.fill();
            }
        }

        function loop() {
            if (!running) return;
            draw();
            raf = requestAnimationFrame(loop);
        }
        function start() { if (running || reduce || level === 0) return; running = true; raf = requestAnimationFrame(loop); }
        function stop() { running = false; cancelAnimationFrame(raf); }

        window.addEventListener("resize", resize);
        document.addEventListener("visibilitychange", function () { if (document.hidden) stop(); else start(); });
        resize();
        start();
        return { start: start, stop: stop, redraw: draw };
    }

    // ---------- scroll-driven glow ----------

    var scrollY = window.scrollY || 0;
    var scrollPending = false;

    function scheduleScroll() {
        if (scrollPending) return;
        scrollPending = true;
        requestAnimationFrame(updateScroll);
    }

    function updateScroll() {
        scrollPending = false;
        scrollY = window.scrollY || window.pageYOffset || 0;
        var vh = window.innerHeight;
        var max = Math.max(1, document.documentElement.scrollHeight - vh);
        var p = Math.min(1, Math.max(0, scrollY / max));

        if (barEl) barEl.style.transform = "scaleX(" + p.toFixed(4) + ")";
        if (railEl) railEl.style.setProperty("--fx-p", p.toFixed(4));
        if (layerEl) {
            layerEl.style.setProperty("--fx-sy", scrollY.toFixed(0));
            layerEl.style.setProperty("--fx-h", (212 + p * 70).toFixed(1)); // blue -> violet as you go down
        }

        // read all geometry first, then write (avoids layout thrash)
        var mid = vh * 0.5, reach = vh * 0.62, vals = [];
        for (var i = 0; i < litVisible.length; i++) {
            var r = litVisible[i].getBoundingClientRect();
            var d = Math.abs(r.top + r.height / 2 - mid) / reach;
            vals.push(Math.max(0, 1 - d));
        }
        for (var j = 0; j < litVisible.length; j++) {
            litVisible[j].style.setProperty("--lit", vals[j].toFixed(2));
            litVisible[j].style.setProperty("--litp", p.toFixed(3));
        }
        if (starsApi && level > 0 && reduce) starsApi.redraw();
    }

    // ---------- pointer glow ----------

    function startPointer() {
        var ticking = false;
        document.addEventListener("pointermove", function (e) {
            mouse.x = e.clientX; mouse.y = e.clientY; mouse.moved = true;
            if (ticking) return;
            ticking = true;
            requestAnimationFrame(function () {
                ticking = false;
                var card = e.target && e.target.closest && e.target.closest(".fx-card");
                if (card) {
                    var r = card.getBoundingClientRect();
                    card.style.setProperty("--mx", (e.clientX - r.left) + "px");
                    card.style.setProperty("--my", (e.clientY - r.top) + "px");
                }
            });
        }, { passive: true });

        if (haloEl) {
            (function follow() {
                mouse.hx += (mouse.x - mouse.hx) * 0.12;
                mouse.hy += (mouse.y - mouse.hy) * 0.12;
                haloEl.style.transform = "translate3d(" + (mouse.hx - 300) + "px," + (mouse.hy - 300) + "px,0)";
                haloEl.style.opacity = mouse.moved && level > 0 ? "1" : "0";
                requestAnimationFrame(follow);
            })();
        }
    }

    // ---------- click glow ----------

    function startClickGlow() {
        if (reduce) return;
        document.addEventListener("pointerdown", function (e) {
            if (level === 0 || e.button > 0) return;
            var btn = e.target.closest && e.target.closest(".fx-btn");
            burst(e.clientX, e.clientY, !!btn);
            if (btn && !btn.disabled) {
                btn.classList.remove("fx-pulse");
                void btn.offsetWidth; // restart the animation
                btn.classList.add("fx-pulse");
                setTimeout(function () { btn.classList.remove("fx-pulse"); }, 750);
            }
        }, true);

        document.addEventListener("click", function (e) {
            var b = e.target.closest && e.target.closest(".fx-btn");
            if (!b || b.disabled) return;
            var r = b.getBoundingClientRect();
            var size = Math.max(r.width, r.height) * 1.6;
            var s = document.createElement("span");
            s.className = "fx-ripple";
            s.style.width = s.style.height = size + "px";
            s.style.left = (e.clientX - r.left - size / 2) + "px";
            s.style.top = (e.clientY - r.top - size / 2) + "px";
            b.appendChild(s);
            s.addEventListener("animationend", function () { s.remove(); });
            setTimeout(function () { if (s.parentNode) s.remove(); }, 900);
        });
    }

    function burst(x, y, sparks) {
        var el = document.createElement("div");
        el.className = "fx-burst";
        el.style.left = x + "px";
        el.style.top = y + "px";
        var html = '<i class="fx-burst__flash"></i><i class="fx-burst__ring"></i><i class="fx-burst__ring fx-burst__ring--2"></i>';
        if (sparks) {
            var n = 6 + level * 2;
            for (var i = 0; i < n; i++) {
                var ang = (Math.PI * 2 * i) / n + Math.random() * 0.5;
                var dist = 26 + Math.random() * 38;
                html += '<i class="fx-burst__spark" style="--dx:' + (Math.cos(ang) * dist).toFixed(1) + 'px;--dy:' + (Math.sin(ang) * dist).toFixed(1) + 'px;--sd:' + (Math.random() * 0.12).toFixed(2) + 's"></i>';
            }
        }
        el.innerHTML = html;
        document.body.appendChild(el);
        setTimeout(function () { el.remove(); }, 900);
    }

    // Confetti when the quiz finishes (Quiz.html shows #end with inline display style).
    function watchQuizEnd() {
        var end = document.getElementById("end");
        if (!end || reduce) return;
        var fired = false;
        new MutationObserver(function () {
            if (!fired && getComputedStyle(end).display !== "none") { fired = true; confetti(); }
        }).observe(end, { attributes: true, attributeFilter: ["style", "class"] });
    }

    function confetti() {
        var c = document.createElement("canvas");
        c.className = "fx-confetti";
        c.width = window.innerWidth; c.height = window.innerHeight;
        document.body.appendChild(c);
        var ctx = c.getContext("2d");
        var colors = ["#ffd700", "#4ea3ff", "#a78bfa", "#22d3ee", "#4ade80", "#f472b6"];
        var bits = [];
        for (var i = 0; i < 140; i++) {
            bits.push({
                x: c.width / 2, y: c.height * 0.4, vx: (Math.random() - 0.5) * 16, vy: -Math.random() * 14 - 4,
                w: Math.random() * 8 + 4, h: Math.random() * 5 + 3, rot: Math.random() * 6, vr: (Math.random() - 0.5) * 0.4,
                col: colors[i % colors.length]
            });
        }
        var start = Date.now();
        (function frame() {
            var age = Date.now() - start;
            ctx.clearRect(0, 0, c.width, c.height);
            bits.forEach(function (b) {
                b.vy += 0.35; b.vx *= 0.99; b.x += b.vx; b.y += b.vy; b.rot += b.vr;
                ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(b.rot);
                ctx.globalAlpha = Math.max(0, 1 - age / 3200);
                ctx.fillStyle = b.col; ctx.shadowColor = b.col; ctx.shadowBlur = 8;
                ctx.fillRect(-b.w / 2, -b.h / 2, b.w, b.h);
                ctx.restore();
            });
            if (age < 3200) requestAnimationFrame(frame); else c.remove();
        })();
    }

    // ---------- glow-level dock ----------

    function setLevel(n, persist) {
        level = n;
        root.setAttribute("data-fx-level", String(n));
        if (persist) { try { window.localStorage.setItem(LEVEL_KEY, String(n)); } catch (e) { /* ignore */ } }
        if (starsApi) { if (n === 0) { starsApi.stop(); starsApi.redraw(); } else starsApi.start(); }
        // make sure nothing stays hidden when the effects are switched off
        if (n === 0) {
            var list = document.querySelectorAll(".fx-reveal:not(.fx-in)");
            for (var i = 0; i < list.length; i++) list[i].classList.add("fx-in");
        }
        var radios = document.querySelectorAll(".fx-level");
        for (var k = 0; k < radios.length; k++) {
            radios[k].setAttribute("aria-checked", String(parseInt(radios[k].getAttribute("data-level"), 10) === n));
        }
        scheduleScroll();
    }

    function buildDock() {
        var dock = document.createElement("div");
        dock.className = "fx-dock";
        var opts = LEVELS.map(function (l) {
            return '<button type="button" class="fx-level" role="radio" data-level="' + l.v + '" aria-checked="false">' + l.label + "</button>";
        }).join("");
        dock.innerHTML = '<button type="button" class="fx-dock__btn" aria-label="Glow settings" aria-expanded="false" aria-haspopup="true" title="Glow settings">✨</button>' +
            '<div class="fx-dock__panel" role="radiogroup" aria-label="Glow level" hidden><span class="fx-dock__title">Glow level</span><div class="fx-dock__opts">' + opts + "</div></div>";
        document.body.appendChild(dock);
        var btn = dock.querySelector(".fx-dock__btn"), panel = dock.querySelector(".fx-dock__panel");
        function toggle(open) {
            panel.hidden = !open;
            btn.setAttribute("aria-expanded", String(open));
        }
        btn.addEventListener("click", function (e) { e.stopPropagation(); toggle(panel.hidden); });
        document.addEventListener("click", function (e) { if (!dock.contains(e.target)) toggle(false); });
        document.addEventListener("keydown", function (e) { if (e.key === "Escape" && !panel.hidden) { toggle(false); btn.focus(); } });
        Array.prototype.forEach.call(dock.querySelectorAll(".fx-level"), function (b) {
            b.addEventListener("click", function () { setLevel(parseInt(b.getAttribute("data-level"), 10), true); });
        });
    }

    function init() {
        root.classList.add("fx-on");
        root.setAttribute("data-fx-level", String(level));
        buildLayer();
        decorate(document);
        starsApi = startStars(layerEl.querySelector("canvas"));
        startPointer();
        startClickGlow();
        watchQuizEnd();
        buildDock();
        setLevel(level, false);

        window.addEventListener("scroll", scheduleScroll, { passive: true });
        window.addEventListener("resize", scheduleScroll);
        updateScroll();

        // pick up elements created later (dashboard tables, AI answer cards, modals)
        var pending = false;
        new MutationObserver(function () {
            if (pending) return;
            pending = true;
            requestAnimationFrame(function () { pending = false; decorate(document); });
        }).observe(document.body, { childList: true, subtree: true });

        // safety net: never leave a reveal element hidden
        setTimeout(function () {
            var list = document.querySelectorAll(".fx-reveal:not(.fx-in)");
            for (var i = 0; i < list.length; i++) {
                var r = list[i].getBoundingClientRect();
                if (r.top < window.innerHeight * 1.2) list[i].classList.add("fx-in");
            }
        }, 2500);
    }

    window.DarkFX = { confetti: confetti, burst: burst, setLevel: function (n) { setLevel(n, true); } };

    try {
        if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
    } catch (e) {
        // effects are optional: fail silently and leave the page untouched
        root.classList.remove("fx-on");
    }
})();
