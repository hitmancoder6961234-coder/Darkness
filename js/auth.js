// ===============================
// Darkness - Admin sign-in (client side)
// The password is checked ON THE SERVER (google-apps-script.js). This file only:
//   - shows the sign-in screen,
//   - sends credentials over HTTPS to the Apps Script web app,
//   - keeps the returned session token in sessionStorage (cleared when the tab closes),
//   - attaches the token to every admin request.
// Hiding the page here is only a convenience: the real protection is that the server refuses to return
// any data without a valid token.
//
// Pages that must be signed in set <html data-auth="required">. Other pages (AI Lab) sign in on demand.
// ===============================
(function (root) {
    "use strict";

    var API_URL = "https://script.google.com/macros/s/AKfycbxtyW_apQ44D0Tv_VSbzxdm5taPcCjHB-0-0zF5UY6NWHWCyXsDz9wxEKnoDuAX5I2c/exec";
    var TOKEN_KEY = "darkness.auth.token";
    var EXP_KEY = "darkness.auth.exp";

    var doc = document;
    var html = doc.documentElement;

    function ssGet(k) { try { return root.sessionStorage.getItem(k) || ""; } catch (e) { return ""; } }
    function ssSet(k, v) { try { if (v) root.sessionStorage.setItem(k, v); else root.sessionStorage.removeItem(k); } catch (e) { /* storage blocked */ } }

    var state = { token: ssGet(TOKEN_KEY), exp: parseInt(ssGet(EXP_KEY), 10) || 0, overlay: null, pending: null };

    function signedIn() { return !!state.token && state.exp > Date.now(); }
    function setSession(token, exp) { state.token = token || ""; state.exp = exp || 0; ssSet(TOKEN_KEY, state.token); ssSet(EXP_KEY, state.exp ? String(state.exp) : ""); }
    function clearSession() { setSession("", 0); }

    var required = html.getAttribute("data-auth") === "required";
    if (required && !signedIn()) html.classList.add("auth-locked");

    // ---------- network ----------
    async function rawPost(payload) {
        var ctl = new AbortController();
        var timer = setTimeout(function () { ctl.abort(); }, 45000);
        try {
            var resp = await fetch(API_URL, {
                method: "POST",
                headers: { "Content-Type": "text/plain;charset=utf-8" }, // "simple" request: no CORS preflight
                body: JSON.stringify(payload),
                signal: ctl.signal
            });
            var text = await resp.text();
            try { return JSON.parse(text); }
            catch (e) { throw makeError("server", "The server returned an unexpected response."); }
        } catch (e) {
            if (e && e.code) throw e;
            if (e && e.name === "AbortError") throw makeError("network", "The server took too long to answer. Please try again.");
            throw makeError("network", "Could not reach the server. Check your connection and try again.");
        } finally { clearTimeout(timer); }
    }

    function makeError(code, message) { var e = new Error(message); e.code = code; return e; }

    function fromServer(json) {
        var msg = (json && json.message) || "Request failed.";
        // an Apps Script that has not been updated yet does not know the new actions
        if (/unknown action/i.test(msg)) return makeError("not_configured", "The Apps Script backend has not been updated yet. Paste the new google-apps-script.js, add the Script properties and deploy a new version (see SETUP.md).");
        return makeError((json && json.code) || "server", msg);
    }

    // call(action, payload) -> parsed JSON. Re-prompts for sign-in once if the session is missing/expired.
    async function call(action, payload, retried) {
        if (!signedIn()) {
            await promptLogin();
        }
        var json = await rawPost(Object.assign({ action: action, token: state.token }, payload || {}));
        if (json && json.status === "error") {
            if (json.code === "auth" && !retried) {
                clearSession();
                return call(action, payload, true);
            }
            throw fromServer(json);
        }
        return json;
    }

    async function login(user, pass) {
        var json = await rawPost({ action: "adminLogin", user: user, pass: pass });
        if (!json || json.status !== "success" || !json.token) throw fromServer(json);
        setSession(json.token, json.expiresAt);
        return true;
    }

    // ---------- UI ----------
    function esc(s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }

    function buildOverlay(dismissible) {
        var el = doc.createElement("div");
        el.className = "auth-overlay";
        el.innerHTML =
            '<form class="auth-card" role="dialog" aria-modal="true" aria-labelledby="authTitle" novalidate>' +
            '<img class="auth-logo" src="assets/icon-96.png" alt="" width="64" height="64">' +
            '<h2 id="authTitle">Admin sign in</h2>' +
            '<p class="auth-sub">Sign in to view the admin dashboard.</p>' +
            '<label for="authUser">Email or username</label>' +
            '<input id="authUser" name="username" type="text" autocomplete="username" autocapitalize="none" spellcheck="false" required>' +
            '<label for="authPass">Password</label>' +
            '<div class="auth-passrow"><input id="authPass" name="password" type="password" autocomplete="current-password" required>' +
            '<button type="button" class="auth-eye" aria-label="Show password" aria-pressed="false">Show</button></div>' +
            '<div class="auth-msg" role="alert" aria-live="assertive"></div>' +
            '<button class="auth-submit" type="submit">Sign in</button>' +
            (dismissible
                ? '<button type="button" class="auth-cancel">Cancel</button>'
                : '<a class="auth-back" href="index.html">&larr; Back to home</a>') +
            '<p class="auth-foot">The password is verified on the server and never stored in this page. Your session ends when you close the tab.</p>' +
            "</form>";
        return el;
    }

    function promptLogin(opts) {
        if (state.pending) return state.pending;
        var dismissible = !!(opts && opts.dismissible) || !required;
        var el = buildOverlay(dismissible);
        state.overlay = el;
        var lastFocus = doc.activeElement;

        state.pending = new Promise(function (resolve, reject) {
            function finish(ok, err) {
                doc.removeEventListener("keydown", onKey, true);
                el.remove(); state.overlay = null; state.pending = null;
                html.classList.remove("auth-locked");
                if (lastFocus && lastFocus.focus && doc.body.contains(lastFocus)) { try { lastFocus.focus(); } catch (e) { /* ignore */ } }
                if (ok) resolve(true); else reject(err || makeError("cancelled", "Sign-in was cancelled."));
            }
            function onKey(e) {
                if (e.key === "Escape" && dismissible) { e.preventDefault(); finish(false); return; }
                if (e.key !== "Tab") return;
                var f = el.querySelectorAll("input, button, a[href]");
                var list = Array.prototype.filter.call(f, function (n) { return !n.disabled && n.offsetParent !== null; });
                if (!list.length) return;
                var first = list[0], last = list[list.length - 1];
                if (e.shiftKey && doc.activeElement === first) { e.preventDefault(); last.focus(); }
                else if (!e.shiftKey && doc.activeElement === last) { e.preventDefault(); first.focus(); }
            }

            var form = el.querySelector("form"), msg = el.querySelector(".auth-msg");
            var user = el.querySelector("#authUser"), pass = el.querySelector("#authPass"), submit = el.querySelector(".auth-submit");
            var eye = el.querySelector(".auth-eye"), cancel = el.querySelector(".auth-cancel");

            eye.addEventListener("click", function () {
                var show = pass.type === "password";
                pass.type = show ? "text" : "password";
                eye.textContent = show ? "Hide" : "Show";
                eye.setAttribute("aria-pressed", String(show));
                eye.setAttribute("aria-label", show ? "Hide password" : "Show password");
            });
            if (cancel) cancel.addEventListener("click", function () { finish(false); });

            form.addEventListener("submit", async function (e) {
                e.preventDefault();
                msg.textContent = "";
                if (!user.value.trim() || !pass.value) { msg.textContent = "Enter your email and password."; (user.value.trim() ? pass : user).focus(); return; }
                submit.disabled = true; submit.classList.add("is-busy"); submit.textContent = "Checking…";
                try {
                    await login(user.value, pass.value);
                    pass.value = "";
                    finish(true);
                } catch (err) {
                    msg.textContent = err.message;
                    pass.value = "";
                    submit.disabled = false; submit.classList.remove("is-busy"); submit.textContent = "Sign in";
                    form.classList.remove("auth-shake"); void form.offsetWidth; form.classList.add("auth-shake");
                    if (err.code !== "not_configured" && err.code !== "network") pass.focus();
                }
            });

            doc.addEventListener("keydown", onKey, true);
            doc.body.appendChild(el);
            setTimeout(function () { user.focus(); }, 30);
        });
        // callers that do not handle a cancelled prompt must not trigger "unhandled rejection" noise
        state.pending.catch(function () { /* handled by callers */ });
        return state.pending;
    }

    function ready(opts) { return signedIn() ? Promise.resolve(true) : promptLogin(opts); }

    function logout() {
        clearSession();
        html.classList.add("auth-locked");
        if (required) { root.location.reload(); } else { html.classList.remove("auth-locked"); }
    }

    // pages that require sign-in show the form straight away (without waiting for page scripts)
    function autoPrompt() { if (required && !signedIn()) promptLogin().catch(function () { /* cannot be cancelled on required pages */ }); }
    if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", autoPrompt); else autoPrompt();

    root.DarkAuth = {
        call: call, login: login, ready: ready, logout: logout, promptLogin: promptLogin,
        isSignedIn: signedIn, API_URL: API_URL
    };
})(window);
