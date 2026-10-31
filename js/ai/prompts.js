// ===============================
// Clarity AI Lab - Shared prompts + survey-data context
// The SAME system prompt goes to every model so side-by-side answers are comparable.
// Adapted from Clarity's answer-style rules (no filler, short paragraphs, adaptive structure,
// fixed callout vocabulary, depth matches the question, reply in the user's language).
// ===============================
(function (root) {
    "use strict";

    var BASE_SYSTEM = [
        "You are an assistant inside the Laptop Market Research platform (Clarity AI Lab).",
        "If asked which model you are, say which model you actually are, if you know.",
        "",
        "ANSWER STYLE",
        "- Start answering immediately. No greeting filler, no restating the question.",
        "- Match depth to the request: a small question gets a short answer; a request for detail gets a thorough, structured one. Never pad.",
        "- Keep paragraphs to 1-3 sentences. Use bullet lists for parallel points and numbered lists for sequential steps. Use bold sparingly.",
        "- Use Markdown tables for genuine comparisons. Never output empty headings.",
        "- Write formulas in plain text or Unicode (for example: share = count / total x 100). Do not use LaTeX.",
        "- When useful, highlight with these exact callout labels at the start of a line: 💡 **Tip:**, ⚠️ **Common Mistake:**, 📌 **Remember:**, 🎯 **Key Takeaway:**, ✅ **Final Answer:**, 📝 **Example:**.",
        "- Reply in the user's language (English, Hindi or Hinglish).",
        "- If you are unsure, say so. Do not invent facts, numbers or sources."
    ].join("\n");

    var SURVEY_RULES = [
        "",
        "SURVEY DATA RULES",
        "- The block below is aggregated, anonymised survey data (counts only). Ground every statistic in it.",
        "- Quote counts and compute percentages from them. If something is not in the data, say \"Not in the dataset\".",
        "- Do not guess individual respondents; there is no personal data."
    ].join("\n");

    function buildSystem(opts) {
        opts = opts || {};
        var s = BASE_SYSTEM;
        if (opts.surveyContext) s += SURVEY_RULES + "\n\n=== SURVEY DATA (aggregated) ===\n" + opts.surveyContext + "\n=== END SURVEY DATA ===";
        if (opts.instructions && opts.instructions.trim()) s += "\n\nUSER INSTRUCTIONS\n" + opts.instructions.trim();
        return s;
    }

    // Build the compact, anonymised evidence block from the dashboard endpoint.
    // Only stats + per-question counts are used: names, emails and mobile numbers are never read.
    function summariseSurvey(data) {
        if (!data || typeof data !== "object") return "";
        var stats = data.stats || {};
        var out = {
            totals: {
                access_requests: stats.totalRequests || 0,
                approved: stats.approved || 0,
                pending: stats.pending || 0,
                rejected: stats.rejected || 0,
                survey_responses: stats.totalResponses || 0,
                laptop_owners: stats.ownerCount || 0,
                laptop_buyers: stats.buyerCount || 0,
                avg_completion_seconds: stats.avgCompletionTime || 0
            },
            questions: {}
        };
        var qb = data.questionBreakdown || {};
        Object.keys(qb).forEach(function (q) {
            if (q === "Final Recommendation" || Object.keys(qb[q]).length) out.questions[q] = qb[q];
        });
        return JSON.stringify(out, null, 1);
    }

    // The survey data is now behind the admin login: DarkAuth shows the sign-in form if needed and attaches
    // the session token. Only the aggregated summary below is ever sent to an AI provider.
    async function fetchSurveyContext() {
        if (!root.DarkAuth) throw new Error("Sign-in module not loaded");
        var data = await root.DarkAuth.call("adminData");
        var text = summariseSurvey(data);
        if (!text) throw new Error("No survey data returned");
        return text;
    }

    function buildSynthesisPrompt(question, answers) {
        var body = answers.map(function (a, i) {
            return "--- ANSWER " + (i + 1) + " (from " + a.name + ") ---\n" + a.text;
        }).join("\n\n");
        return "Several AI models answered the same question. Write ONE best answer.\n\n" +
            "QUESTION:\n" + question + "\n\n" + body + "\n\n" +
            "INSTRUCTIONS:\n" +
            "- Start with the combined answer, then a short section 'Where the models agree' and 'Where they differ' (name the models).\n" +
            "- Prefer claims that are supported by data in the question or by more than one model. Flag anything that looks unsupported or contradictory.\n" +
            "- Do not invent new facts. Keep it concise.";
    }

    var QUICK_PROMPTS = [
        "Summarize the key insights from the survey in 5 bullets",
        "Compare laptop owners vs buyers: what differs most?",
        "Which brands lead, and what does that suggest?",
        "Write a short executive summary for a product manager",
        "Suggest 5 product recommendations backed by the data",
        "What surprising patterns or risks do you see?"
    ];

    var FOLLOW_UPS = [
        { label: "Give an example", text: "Give a clear, practical example of your last point." },
        { label: "Explain simpler", text: "Explain that again in simpler words, as if to a beginner." },
        { label: "Summarize in 3 bullets", text: "Summarize your last answer in exactly 3 bullets." },
        { label: "What are the risks?", text: "What are the main risks or caveats of this?" }
    ];

    var api = {
        buildSystem: buildSystem, summariseSurvey: summariseSurvey, fetchSurveyContext: fetchSurveyContext,
        buildSynthesisPrompt: buildSynthesisPrompt, QUICK_PROMPTS: QUICK_PROMPTS, FOLLOW_UPS: FOLLOW_UPS
    };
    root.DarkAI = root.DarkAI || {};
    root.DarkAI.prompts = api;
    if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
