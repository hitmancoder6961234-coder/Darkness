// ===============================
// Clarity AI Lab - Provider registry
// Single source of truth for supported AI providers.
// Adapters: "openai" (OpenAI-compatible), "gemini" (native), "anthropic" (native), "azure".
// ===============================
(function (root) {
    "use strict";

    var PROVIDERS = [
        { id: "gemini",     label: "Google Gemini",   adapter: "gemini",    defaultBase: "https://generativelanguage.googleapis.com/v1beta", needsKey: true,  keyPlaceholder: "AIza...",        modelPlaceholder: "model id (use Fetch models)", hue: 217 },
        { id: "anthropic",  label: "Anthropic",       adapter: "anthropic", defaultBase: "https://api.anthropic.com/v1",                     needsKey: true,  keyPlaceholder: "sk-ant-...",     modelPlaceholder: "model id (use Fetch models)", hue: 22 },
        { id: "openai",     label: "OpenAI",          adapter: "openai",    defaultBase: "https://api.openai.com/v1",                        needsKey: true,  keyPlaceholder: "sk-proj-...",    modelPlaceholder: "model id (use Fetch models)", hue: 160 },
        { id: "openrouter", label: "OpenRouter",      adapter: "openai",    defaultBase: "https://openrouter.ai/api/v1",                     needsKey: true,  keyPlaceholder: "sk-or-v1-...",   modelPlaceholder: "vendor/model-name",           hue: 275 },
        { id: "groq",       label: "Groq",            adapter: "openai",    defaultBase: "https://api.groq.com/openai/v1",                   needsKey: true,  keyPlaceholder: "gsk_...",        modelPlaceholder: "model id (use Fetch models)", hue: 12 },
        { id: "mistral",    label: "Mistral AI",      adapter: "openai",    defaultBase: "https://api.mistral.ai/v1",                        needsKey: true,  keyPlaceholder: "Mistral API key", modelPlaceholder: "model id (use Fetch models)", hue: 35 },
        { id: "together",   label: "Together AI",     adapter: "openai",    defaultBase: "https://api.together.xyz/v1",                      needsKey: true,  keyPlaceholder: "Together API key", modelPlaceholder: "org/model-name",             hue: 195 },
        { id: "z.ai",       label: "Z.ai (GLM)",      adapter: "openai",    defaultBase: "https://api.z.ai/api/paas/v4",                     needsKey: true,  keyPlaceholder: "Z.ai API key",   modelPlaceholder: "glm model id",                hue: 250 },
        { id: "ollama",     label: "Ollama (local)",  adapter: "openai",    defaultBase: "http://localhost:11434/v1",                        needsKey: false, keyPlaceholder: "(no key needed for local Ollama)", modelPlaceholder: "e.g. a pulled model name", hue: 140 },
        { id: "azure",      label: "Azure OpenAI",    adapter: "azure",     defaultBase: "",                                                 needsKey: true,  keyPlaceholder: "Azure API key",  modelPlaceholder: "your deployment name",        hue: 205 },
        { id: "custom",     label: "Custom (OpenAI-compatible)", adapter: "openai", defaultBase: "",                                          needsKey: false, keyPlaceholder: "API key (if required)", modelPlaceholder: "model id",             hue: 300 }
    ];

    function getProvider(id) {
        var clean = String(id || "").toLowerCase().trim();
        for (var i = 0; i < PROVIDERS.length; i++) {
            if (PROVIDERS[i].id === clean) return PROVIDERS[i];
        }
        return null;
    }

    function trimSlash(s) { return String(s || "").replace(/\/+$/, ""); }

    function effectiveBase(model) {
        var p = getProvider(model.provider);
        return trimSlash(model.baseUrl || (p ? p.defaultBase : ""));
    }

    var api = { PROVIDERS: PROVIDERS, getProvider: getProvider, effectiveBase: effectiveBase, trimSlash: trimSlash };
    root.DarkAI = root.DarkAI || {};
    root.DarkAI.providers = api;
    if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
