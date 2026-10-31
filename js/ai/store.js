// ===============================
// Clarity AI Lab - Model + settings store
// Model metadata lives in localStorage. API keys are kept SEPARATELY:
//   - default: sessionStorage (cleared when the tab closes)
//   - opt-in "Remember keys": localStorage (stored unencrypted in this browser)
// Every storage access is wrapped: private windows / blocked storage must never break the page.
// ===============================
(function (root) {
    "use strict";

    var K_MODELS = "darkai.models.v1";
    var K_KEYS = "darkai.keys.v1";
    var K_PREFS = "darkai.prefs.v1";

    function read(storage, key, fallback) {
        try {
            var raw = storage.getItem(key);
            return raw ? JSON.parse(raw) : fallback;
        } catch (e) { return fallback; }
    }
    function write(storage, key, value) {
        try { storage.setItem(key, JSON.stringify(value)); return true; } catch (e) { return false; }
    }
    function remove(storage, key) { try { storage.removeItem(key); } catch (e) { /* ignore */ } }

    function ls() { try { return window.localStorage; } catch (e) { return null; } }
    function ss() { try { return window.sessionStorage; } catch (e) { return null; } }

    var memory = { models: null, keys: {}, prefs: null };

    function getPrefs() {
        if (memory.prefs) return memory.prefs;
        var s = ls();
        var p = (s && read(s, K_PREFS, null)) || {};
        memory.prefs = {
            rememberKeys: !!p.rememberKeys,
            selected: Array.isArray(p.selected) ? p.selected : [],
            mode: p.mode === "race" ? "race" : "compare",
            useSurvey: p.useSurvey === true,
            instructions: typeof p.instructions === "string" ? p.instructions : "",
            judge: p.judge || ""
        };
        return memory.prefs;
    }

    function setPrefs(patch) {
        var p = getPrefs();
        Object.keys(patch).forEach(function (k) { p[k] = patch[k]; });
        var s = ls();
        if (s) write(s, K_PREFS, p);
        return p;
    }

    function loadKeys() {
        var l = ls(), s = ss();
        var keys = {};
        if (s) { var a = read(s, K_KEYS, {}); Object.keys(a).forEach(function (k) { keys[k] = a[k]; }); }
        if (l) { var b = read(l, K_KEYS, {}); Object.keys(b).forEach(function (k) { keys[k] = b[k]; }); }
        Object.keys(memory.keys).forEach(function (k) { keys[k] = memory.keys[k]; });
        return keys;
    }

    function persistKeys(keys) {
        memory.keys = keys;
        var l = ls(), s = ss();
        var remember = getPrefs().rememberKeys;
        if (remember) {
            if (l) write(l, K_KEYS, keys);
            if (s) remove(s, K_KEYS);
        } else {
            if (s) write(s, K_KEYS, keys);
            if (l) remove(l, K_KEYS);
        }
    }

    function getModels() {
        var l = ls();
        var list = (l && read(l, K_MODELS, [])) || memory.models || [];
        var keys = loadKeys();
        return list.map(function (m) {
            var copy = {};
            Object.keys(m).forEach(function (k) { copy[k] = m[k]; });
            copy.apiKey = keys[m.id] || "";
            return copy;
        });
    }

    function saveModels(list) {
        var keys = loadKeys();
        var meta = list.map(function (m) {
            if (m.apiKey) keys[m.id] = m.apiKey; else delete keys[m.id];
            var copy = {};
            Object.keys(m).forEach(function (k) { if (k !== "apiKey") copy[k] = m[k]; });
            return copy;
        });
        var live = {};
        list.forEach(function (m) { live[m.id] = true; });
        Object.keys(keys).forEach(function (id) { if (!live[id]) delete keys[id]; });
        memory.models = meta;
        var l = ls();
        if (l) write(l, K_MODELS, meta);
        persistKeys(keys);
    }

    function upsertModel(model) {
        var list = getModels();
        var idx = -1;
        list.forEach(function (m, i) { if (m.id === model.id) idx = i; });
        if (idx === -1) list.push(model); else list[idx] = model;
        saveModels(list);
    }

    function deleteModel(id) {
        saveModels(getModels().filter(function (m) { return m.id !== id; }));
        var sel = getPrefs().selected.filter(function (x) { return x !== id; });
        setPrefs({ selected: sel });
    }

    function setRemember(flag) {
        var keys = loadKeys();
        setPrefs({ rememberKeys: !!flag });
        persistKeys(keys);
    }

    function newId() { return "m_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

    var api = {
        getModels: getModels, saveModels: saveModels, upsertModel: upsertModel, deleteModel: deleteModel,
        getPrefs: getPrefs, setPrefs: setPrefs, setRemember: setRemember, newId: newId
    };
    root.DarkAI = root.DarkAI || {};
    root.DarkAI.store = api;
    if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
