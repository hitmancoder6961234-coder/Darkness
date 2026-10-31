// ===============================
// Clarity AI Lab - Safe, streaming-tolerant markdown renderer
// Escape-first: all model output is HTML-escaped before any formatting is applied,
// so raw HTML / <script> / onerror payloads in an answer can never execute.
// Handles unclosed code fences and half-written syntax while streaming.
// ===============================
(function (root) {
    "use strict";

    function esc(s) {
        return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
    }

    function inline(text) {
        var codes = [];
        var t = String(text).replace(/`([^`\n]+)`/g, function (m, c) { codes.push(c); return "\u0000" + (codes.length - 1) + "\u0000"; });
        t = esc(t);
        t = t.replace(/\*\*\*([^*\n]+)\*\*\*/g, "<strong><em>$1</em></strong>")
            .replace(/\*\*([^*\n]+)\*\*/g, "<strong>$1</strong>")
            .replace(/(^|[^*\w])\*([^*\s][^*\n]*?)\*(?![\w*])/g, "$1<em>$2</em>")
            .replace(/~~([^~\n]+)~~/g, "<del>$1</del>")
            .replace(/\[([^\]\n]+)\]\((https?:\/\/[^\s)]+|mailto:[^\s)]+)\)/g, function (m, label, url) {
                return '<a href="' + url + '" target="_blank" rel="noopener noreferrer">' + label + "</a>";
            });
        // Half-written bold at the very end of a streaming chunk: drop the dangling marker.
        t = t.replace(/\*\*(?=[^*]*$)/, "");
        return t.replace(/\u0000(\d+)\u0000/g, function (m, i) { return "<code>" + esc(codes[+i]) + "</code>"; });
    }

    var CALLOUTS = [
        { re: /^(💡)\s*/, cls: "tip" }, { re: /^(⚠️|⚠)\s*/, cls: "warning" }, { re: /^(📌)\s*/, cls: "remember" },
        { re: /^(🎯)\s*/, cls: "takeaway" }, { re: /^(✅)\s*/, cls: "success" }, { re: /^(📝)\s*/, cls: "example" },
        { re: /^(🧮)\s*/, cls: "calc" }
    ];

    function calloutClass(line) {
        for (var i = 0; i < CALLOUTS.length; i++) {
            if (CALLOUTS[i].re.test(line) && /^\S+\s*\*\*/.test(line)) return CALLOUTS[i].cls;
        }
        return "";
    }

    var LIST_RE = /^(\s*)([-*+]|\d+[.)])\s+(.*)$/;
    var TABLE_SEP = /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/;

    function splitRow(line) {
        var s = line.trim().replace(/^\|/, "").replace(/\|$/, "");
        return s.split("|").map(function (c) { return c.trim(); });
    }

    function renderList(lines) {
        // lines: array of {indent, ordered, text}
        var html = "", stack = [];
        lines.forEach(function (ln) {
            var tag = ln.ordered ? "ol" : "ul";
            while (stack.length && ln.indent < stack[stack.length - 1].indent) {
                html += "</li></" + stack.pop().tag + ">";
            }
            if (!stack.length || ln.indent > stack[stack.length - 1].indent) {
                html += "<" + tag + ">";
                stack.push({ indent: ln.indent, tag: tag });
            } else {
                html += "</li>";
            }
            var task = /^\[( |x|X)\]\s+(.*)$/.exec(ln.text);
            if (task) {
                html += '<li class="task"><input type="checkbox" disabled' + (task[1] !== " " ? " checked" : "") + "> " + inline(task[2]);
            } else {
                html += "<li>" + inline(ln.text);
            }
        });
        while (stack.length) html += "</li></" + stack.pop().tag + ">";
        return html;
    }

    function codeBlock(lang, body, streaming) {
        return '<div class="md-code"' + (streaming ? ' data-streaming="1"' : "") + '><div class="md-code__head"><span>' +
            esc(lang || "text") + '</span><button type="button" class="md-code__copy" data-copy-code>Copy</button></div><pre><code>' +
            esc(body) + "</code></pre></div>";
    }

    function render(md) {
        var lines = String(md == null ? "" : md).replace(/\r\n?/g, "\n").split("\n");
        var out = [];
        var i = 0;

        while (i < lines.length) {
            var line = lines[i];

            // fenced code (supports an unclosed fence while streaming)
            var fence = /^\s*(```|~~~)\s*([\w+#.-]*)\s*$/.exec(line);
            if (fence) {
                var mark = fence[1], lang = fence[2], body = [], closed = false;
                i++;
                while (i < lines.length) {
                    if (lines[i].trim().indexOf(mark) === 0 && /^\s*(```|~~~)\s*$/.test(lines[i])) { closed = true; i++; break; }
                    body.push(lines[i]); i++;
                }
                out.push(codeBlock(lang, body.join("\n"), !closed));
                continue;
            }

            if (!line.trim()) { i++; continue; }

            var h = /^(#{1,6})\s+(.*?)\s*#*\s*$/.exec(line);
            if (h) {
                if (h[2]) out.push("<h" + h[1].length + ">" + inline(h[2]) + "</h" + h[1].length + ">");
                i++; continue;
            }

            if (/^\s*([-*_])(\s*\1){2,}\s*$/.test(line)) { out.push("<hr>"); i++; continue; }

            if (/^\s*>/.test(line)) {
                var q = [];
                while (i < lines.length && /^\s*>/.test(lines[i])) { q.push(lines[i].replace(/^\s*>\s?/, "")); i++; }
                out.push("<blockquote>" + render(q.join("\n")) + "</blockquote>");
                continue;
            }

            // table: header row + separator row
            if (line.indexOf("|") !== -1 && i + 1 < lines.length && TABLE_SEP.test(lines[i + 1]) && lines[i + 1].indexOf("-") !== -1) {
                var head = splitRow(line);
                i += 2;
                var rows = [];
                while (i < lines.length && lines[i].indexOf("|") !== -1 && lines[i].trim()) { rows.push(splitRow(lines[i])); i++; }
                var t = '<div class="md-table"><table><thead><tr>' + head.map(function (c) { return "<th>" + inline(c) + "</th>"; }).join("") + "</tr></thead><tbody>";
                rows.forEach(function (r) {
                    t += "<tr>" + head.map(function (_, ci) { return "<td>" + inline(r[ci] || "") + "</td>"; }).join("") + "</tr>";
                });
                out.push(t + "</tbody></table></div>");
                continue;
            }

            if (LIST_RE.test(line)) {
                var items = [];
                while (i < lines.length) {
                    var m = LIST_RE.exec(lines[i]);
                    if (!m) break;
                    items.push({ indent: m[1].replace(/\t/g, "    ").length, ordered: /\d/.test(m[2]), text: m[3] });
                    i++;
                    // lazy continuation lines (indented, non-list)
                    while (i < lines.length && lines[i].trim() && !LIST_RE.test(lines[i]) && /^\s{2,}\S/.test(lines[i])) {
                        items[items.length - 1].text += " " + lines[i].trim(); i++;
                    }
                }
                out.push(renderList(items));
                continue;
            }

            // paragraph: gather until blank line or a new block starts
            var para = [line];
            i++;
            while (i < lines.length && lines[i].trim() && !/^\s*(```|~~~|#{1,6}\s|>)/.test(lines[i]) && !LIST_RE.test(lines[i]) &&
                !(lines[i].indexOf("|") !== -1 && i + 1 < lines.length && TABLE_SEP.test(lines[i + 1]))) {
                para.push(lines[i]); i++;
            }
            var ptxt = para.join("\n");
            var cls = calloutClass(ptxt);
            var rendered = inline(ptxt).replace(/\n/g, "<br>");
            out.push(cls ? '<div class="md-callout md-callout--' + cls + '">' + rendered + "</div>" : "<p>" + rendered + "</p>");
        }
        return out.join("");
    }

    var api = { render: render, escape: esc };
    root.DarkAI = root.DarkAI || {};
    root.DarkAI.markdown = api;
    if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
