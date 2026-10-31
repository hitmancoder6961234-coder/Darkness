// ===============================
// Clarity AI Lab - Streaming + resilience layer
// One shared streaming client for every provider:
//   - native adapters (Gemini, Anthropic), OpenAI-compatible, Azure
//   - AbortController everywhere (Stop button), first-token + idle timeouts
//   - retry (max 3) on 429 / 5xx / timeout / network errors, never after the first token
//   - per-provider circuit breaker, friendly + redacted error messages
// ===============================
(function (root) {
    "use strict";

    var P = root.DarkAI.providers;

    var MAX_ATTEMPTS = 3;
    var FIRST_TOKEN_TIMEOUT_MS = 60000;
    var IDLE_TIMEOUT_MS = 45000;
    var BREAKER_THRESHOLD = 3;
    var BREAKER_OPEN_MS = 30000;

    // ---------- errors ----------

    function redact(text) {
        return String(text == null ? "" : text)
            .replace(/Bearer\s+[A-Za-z0-9._\-]+/gi, "Bearer ***")
            .replace(/([?&](?:key|api_key|apikey)=)[^&\s"']+/gi, "$1***")
            .replace(/sk-[A-Za-z0-9_\-]{10,}/g, "sk-***")
            .replace(/AIza[0-9A-Za-z_\-]{20,}/g, "AIza***")
            .replace(/gsk_[A-Za-z0-9]{10,}/g, "gsk_***");
    }

    function AIError(type, message, status, retryable) {
        var e = new Error(redact(message));
        e.name = "AIError";
        e.type = type;
        e.status = status || 0;
        e.retryable = !!retryable;
        e.streamed = false;
        return e;
    }

    function pickMessage(data, fallback) {
        if (!data) return fallback;
        if (typeof data === "string") return data;
        var err = data.error;
        for (var depth = 0; depth < 4 && err; depth++) {
            if (typeof err === "string") return err;
            if (err.message) {
                if (typeof err.message === "string") {
                    try {
                        var inner = JSON.parse(err.message);
                        if (inner && inner.error) { err = inner.error; continue; }
                    } catch (e) { /* plain text */ }
                    return err.message;
                }
                err = err.message;
            } else break;
        }
        return data.message || fallback;
    }

    function classifyHttp(status, detail) {
        var d = String(detail || "").toLowerCase();
        if (/context|too long|maximum.*tokens|token limit|exceeds/.test(d) && status === 400) {
            return AIError("context", "The conversation is too long for this model. Start a new chat or shorten the prompt.", status, false);
        }
        if (status === 401 || status === 403) return AIError("auth", "Authentication failed (HTTP " + status + "). Check the API key and that it has access to this model. " + detail, status, false);
        if (status === 404) return AIError("not_found", "Model or endpoint not found (HTTP 404). Check the model ID and base URL. " + detail, status, false);
        if (status === 429) return AIError("rate_limit", "Rate limit or quota reached (HTTP 429). " + detail, status, true);
        if (status === 408 || status === 504) return AIError("timeout", "The provider timed out (HTTP " + status + "). " + detail, status, true);
        if (status >= 500) return AIError("server", "The provider had a server error (HTTP " + status + "). " + detail, status, true);
        return AIError("bad_request", "The provider rejected the request (HTTP " + status + "). " + detail, status, false);
    }

    function hostOf(url) {
        try { return new URL(url).host; } catch (e) { return String(url); }
    }

    function networkError(err, url) {
        var host = hostOf(url);
        var local = /localhost|127\.0\.0\.1/.test(host);
        var hint = local
            ? "Is the local server running? For Ollama, start it with OLLAMA_ORIGINS set to this site."
            : "Check your connection, the base URL, and that this provider allows direct browser (CORS) requests.";
        return AIError("network", "Could not reach " + host + ". " + hint, 0, true);
    }

    // ---------- circuit breaker ----------

    var breakers = {};

    function breakerKey(model) { return model.provider + "|" + P.effectiveBase(model); }

    function breakerCheck(model) {
        var b = breakers[breakerKey(model)];
        if (b && b.openUntil > Date.now()) {
            var secs = Math.ceil((b.openUntil - Date.now()) / 1000);
            throw AIError("circuit", "Paused after repeated failures from " + (P.getProvider(model.provider) || {}).label + ". Retry in " + secs + "s.", 0, false);
        }
    }

    function breakerRecord(model, ok, err) {
        var k = breakerKey(model);
        var b = breakers[k] || (breakers[k] = { fails: 0, openUntil: 0 });
        if (ok) { b.fails = 0; b.openUntil = 0; return; }
        if (err && err.retryable) {
            b.fails++;
            if (b.fails >= BREAKER_THRESHOLD) { b.openUntil = Date.now() + BREAKER_OPEN_MS; b.fails = 0; }
        }
    }

    function breakerReset(model) { delete breakers[breakerKey(model)]; }

    // ---------- request building ----------

    function buildRequest(model, opts) {
        var p = P.getProvider(model.provider) || P.getProvider("custom");
        var base = P.effectiveBase(model);
        if (!base) throw AIError("config", "No base URL set for this model.", 0, false);
        if (!model.modelName) throw AIError("config", "No model ID set for this model.", 0, false);
        if (p.needsKey && !model.apiKey) throw AIError("auth", "No API key set for " + p.label + ".", 0, false);

        var system = opts.system || "";
        var msgs = normaliseHistory(opts.messages || []);
        var temp = isFinite(parseFloat(model.temperature)) ? parseFloat(model.temperature) : null;
        var maxTok = parseInt(model.maxTokens, 10);
        if (!(maxTok > 0)) maxTok = null;

        if (p.adapter === "gemini") {
            var gen = {};
            if (temp !== null) gen.temperature = temp;
            if (maxTok) gen.maxOutputTokens = maxTok;
            var body = {
                contents: msgs.map(function (m) { return { role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] }; })
            };
            if (system) body.systemInstruction = { parts: [{ text: system }] };
            if (Object.keys(gen).length) body.generationConfig = gen;
            return {
                url: base + "/models/" + encodeURIComponent(model.modelName.replace(/^models\//, "")) + ":streamGenerateContent?alt=sse",
                headers: { "Content-Type": "application/json", "x-goog-api-key": model.apiKey },
                body: body, parse: parseGemini
            };
        }

        if (p.adapter === "anthropic") {
            var ab = {
                model: model.modelName,
                max_tokens: maxTok || 4096,
                stream: true,
                messages: msgs.map(function (m) { return { role: m.role, content: m.content }; })
            };
            if (system) ab.system = system;
            if (temp !== null) ab.temperature = temp;
            return {
                url: base + "/messages",
                headers: {
                    "Content-Type": "application/json",
                    "x-api-key": model.apiKey,
                    "anthropic-version": "2023-06-01",
                    "anthropic-dangerous-direct-browser-access": "true"
                },
                body: ab, parse: parseAnthropic
            };
        }

        // OpenAI-compatible and Azure share the chat-completions wire format.
        var oa = {
            model: model.modelName,
            stream: true,
            messages: (system ? [{ role: "system", content: system }] : []).concat(
                msgs.map(function (m) { return { role: m.role, content: m.content }; }))
        };
        // Only send optional params when the user set them: newer models reject some of them.
        if (temp !== null) oa.temperature = temp;
        if (maxTok) oa.max_tokens = maxTok;

        if (p.adapter === "azure") {
            var ver = model.apiVersion || "2024-10-21";
            return {
                url: base + "/openai/deployments/" + encodeURIComponent(model.modelName) + "/chat/completions?api-version=" + encodeURIComponent(ver),
                headers: { "Content-Type": "application/json", "api-key": model.apiKey },
                body: (delete oa.model, oa), parse: parseOpenAI
            };
        }

        var headers = { "Content-Type": "application/json" };
        if (model.apiKey) headers["Authorization"] = "Bearer " + model.apiKey;
        return { url: base + "/chat/completions", headers: headers, body: oa, parse: parseOpenAI };
    }

    // Merge consecutive same-role turns, drop empties, make sure it starts with "user".
    function normaliseHistory(messages) {
        var out = [];
        messages.forEach(function (m) {
            var role = m.role === "assistant" || m.role === "model" ? "assistant" : "user";
            var text = String(m.content == null ? "" : m.content);
            if (!text.trim()) return;
            var last = out[out.length - 1];
            if (last && last.role === role) last.content += "\n\n" + text;
            else out.push({ role: role, content: text });
        });
        while (out.length && out[0].role !== "user") out.shift();
        return out;
    }

    // ---------- SSE parsers: each returns {text, done, error} for one data payload ----------

    function parseOpenAI(payload) {
        if (payload === "[DONE]") return { done: true };
        var j = JSON.parse(payload);
        if (j.error) return { error: pickMessage(j, "Provider error") };
        var c = j.choices && j.choices[0];
        if (!c) return {};
        var t = (c.delta && c.delta.content) || c.text || "";
        return { text: typeof t === "string" ? t : "" };
    }

    function parseGemini(payload) {
        var j = JSON.parse(payload);
        if (j.error) return { error: pickMessage(j, "Provider error") };
        var cand = j.candidates && j.candidates[0];
        if (!cand) {
            if (j.promptFeedback && j.promptFeedback.blockReason) return { error: "Blocked by the provider's safety filter (" + j.promptFeedback.blockReason + ")." };
            return {};
        }
        var parts = (cand.content && cand.content.parts) || [];
        var t = parts.map(function (p) { return p.thought ? "" : (p.text || ""); }).join("");
        return { text: t };
    }

    function parseAnthropic(payload) {
        var j = JSON.parse(payload);
        if (j.type === "error") return { error: pickMessage(j, "Provider error") };
        if (j.type === "content_block_delta" && j.delta && j.delta.type === "text_delta") return { text: j.delta.text || "" };
        if (j.type === "message_stop") return { done: true };
        return {};
    }

    // ---------- one attempt ----------

    async function attemptOnce(model, opts) {
        var req = buildRequest(model, opts);
        var ctl = new AbortController();
        var timedOut = false;
        var userAborted = false;
        var timer = null;

        function arm(ms) {
            clearTimeout(timer);
            timer = setTimeout(function () { timedOut = true; ctl.abort(); }, ms);
        }
        function onUserAbort() { userAborted = true; ctl.abort(); }
        if (opts.signal) {
            if (opts.signal.aborted) throw AIError("aborted", "Stopped.", 0, false);
            opts.signal.addEventListener("abort", onUserAbort, { once: true });
        }

        var text = "";
        var gotToken = false;
        var started = Date.now();
        var firstTokenMs = null;

        try {
            arm(FIRST_TOKEN_TIMEOUT_MS);
            var resp;
            try {
                resp = await fetch(req.url, { method: "POST", headers: req.headers, body: JSON.stringify(req.body), signal: ctl.signal });
            } catch (e) {
                if (userAborted) throw AIError("aborted", "Stopped.", 0, false);
                if (timedOut) throw AIError("timeout", "No response from the provider within " + (FIRST_TOKEN_TIMEOUT_MS / 1000) + "s.", 0, true);
                throw networkError(e, req.url);
            }

            if (!resp.ok) {
                var raw = "";
                try { raw = await resp.text(); } catch (e) { /* ignore */ }
                var data = null;
                try { data = JSON.parse(raw); } catch (e) { /* not json */ }
                throw classifyHttp(resp.status, redact(pickMessage(data, raw.slice(0, 300))));
            }
            if (!resp.body || !resp.body.getReader) throw AIError("network", "This browser cannot stream responses.", 0, false);

            var reader = resp.body.getReader();
            var decoder = new TextDecoder("utf-8");
            var buf = "";
            var finished = false;

            function handleLine(line) {
                line = line.replace(/\r$/, "");
                if (line.indexOf("data:") !== 0) return;
                var payload = line.slice(5).trim();
                if (!payload) return;
                var r;
                try { r = req.parse(payload); } catch (e) { return; }
                if (r.error) {
                    var err = AIError("provider", r.error, 0, !gotToken);
                    err.streamed = gotToken;
                    throw err;
                }
                if (r.text) {
                    if (!gotToken) {
                        gotToken = true;
                        firstTokenMs = Date.now() - started;
                        if (opts.onFirstToken) opts.onFirstToken(firstTokenMs);
                    }
                    text += r.text;
                    if (opts.onToken) opts.onToken(r.text, text);
                    if (opts.stopAfterFirstToken) finished = true;
                }
                if (r.done) finished = true;
            }

            while (!finished) {
                var step;
                try {
                    arm(gotToken ? IDLE_TIMEOUT_MS : FIRST_TOKEN_TIMEOUT_MS);
                    step = await reader.read();
                } catch (e) {
                    if (userAborted) throw AIError("aborted", "Stopped.", 0, false);
                    if (timedOut) {
                        var te = AIError("timeout", "The stream stalled for " + ((gotToken ? IDLE_TIMEOUT_MS : FIRST_TOKEN_TIMEOUT_MS) / 1000) + "s.", 0, !gotToken);
                        te.streamed = gotToken;
                        throw te;
                    }
                    var ne = networkError(e, req.url);
                    ne.streamed = gotToken;
                    ne.retryable = !gotToken;
                    throw ne;
                }
                if (step.done) break;
                buf += decoder.decode(step.value, { stream: true });
                var nl;
                while ((nl = buf.indexOf("\n")) !== -1) {
                    handleLine(buf.slice(0, nl));
                    buf = buf.slice(nl + 1);
                    if (finished) break;
                }
            }
            if (buf && !finished) handleLine(buf);
            try { ctl.abort(); } catch (e) { /* stop the connection if the server keeps it open */ }

            if (!gotToken && !opts.allowEmpty) {
                throw AIError("empty", "The model returned an empty response.", 0, false);
            }
            return { text: text, firstTokenMs: firstTokenMs, totalMs: Date.now() - started };
        } finally {
            clearTimeout(timer);
            if (opts.signal) opts.signal.removeEventListener("abort", onUserAbort);
        }
    }

    // ---------- public: streamChat with retry ----------

    function sleep(ms, signal) {
        return new Promise(function (resolve, reject) {
            var t = setTimeout(resolve, ms);
            if (signal) signal.addEventListener("abort", function () { clearTimeout(t); reject(AIError("aborted", "Stopped.", 0, false)); }, { once: true });
        });
    }

    async function streamChat(model, opts) {
        opts = opts || {};
        var lastErr = null;
        for (var attempt = 1; attempt <= (opts.maxAttempts || MAX_ATTEMPTS); attempt++) {
            try {
                breakerCheck(model);
                var out = await attemptOnce(model, opts);
                breakerRecord(model, true);
                out.attempts = attempt;
                return out;
            } catch (e) {
                if (!e || e.name !== "AIError") e = AIError("unknown", (e && e.message) || "Unexpected error", 0, false);
                lastErr = e;
                if (e.type === "aborted" || e.type === "circuit") throw e;
                breakerRecord(model, false, e);
                var last = attempt >= (opts.maxAttempts || MAX_ATTEMPTS);
                if (!e.retryable || e.streamed || last) throw e;
                var slow = e.type === "rate_limit" || e.status === 503 || e.status === 429;
                var wait = slow ? 600 * attempt : Math.round(350 * Math.pow(1.4, attempt));
                wait += Math.round(Math.random() * 120); // jitter
                if (opts.onRetry) opts.onRetry(attempt, e, wait);
                await sleep(wait, opts.signal);
            }
        }
        throw lastErr;
    }

    // ---------- model list + connection test ----------

    async function listModels(model, signal) {
        var p = P.getProvider(model.provider) || P.getProvider("custom");
        var base = P.effectiveBase(model);
        if (!base) throw AIError("config", "Enter a base URL first.", 0, false);
        var url = base, headers = {};
        if (p.adapter === "gemini") {
            url += "/models?pageSize=200";
            headers["x-goog-api-key"] = model.apiKey || "";
        } else if (p.adapter === "anthropic") {
            url += "/models?limit=100";
            headers["x-api-key"] = model.apiKey || "";
            headers["anthropic-version"] = "2023-06-01";
            headers["anthropic-dangerous-direct-browser-access"] = "true";
        } else if (p.adapter === "azure") {
            throw AIError("config", "Azure deployments can't be listed from the browser - type your deployment name.", 0, false);
        } else {
            url += "/models";
            if (model.apiKey) headers["Authorization"] = "Bearer " + model.apiKey;
        }
        if (p.needsKey && !model.apiKey) throw AIError("auth", "Enter the API key first.", 0, false);
        var resp;
        try { resp = await fetch(url, { headers: headers, signal: signal }); }
        catch (e) { throw networkError(e, url); }
        var raw = await resp.text();
        var data = null;
        try { data = JSON.parse(raw); } catch (e) { /* not json */ }
        if (!resp.ok) throw classifyHttp(resp.status, redact(pickMessage(data, raw.slice(0, 300))));
        var ids = [];
        if (data && Array.isArray(data.models)) {
            data.models.forEach(function (m) {
                var methods = m.supportedGenerationMethods;
                if (methods && methods.indexOf("generateContent") === -1) return;
                ids.push(String(m.name || m.id || "").replace(/^models\//, ""));
            });
        } else if (data && Array.isArray(data.data)) {
            data.data.forEach(function (m) { ids.push(String(m.id || m.name || "")); });
        }
        return ids.filter(Boolean).sort();
    }

    // Sends a tiny prompt and stops at the first token.
    async function testModel(model) {
        var t0 = Date.now();
        var out = await streamChat(model, {
            system: "",
            messages: [{ role: "user", content: "Reply with the single word: ok" }],
            stopAfterFirstToken: true,
            maxAttempts: 1
        });
        return { ok: true, latencyMs: out.firstTokenMs != null ? out.firstTokenMs : Date.now() - t0 };
    }

    var api = {
        streamChat: streamChat, listModels: listModels, testModel: testModel,
        normaliseHistory: normaliseHistory, redact: redact, breakerReset: breakerReset,
        _buildRequest: buildRequest, _classifyHttp: classifyHttp
    };
    root.DarkAI.stream = api;
    if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
