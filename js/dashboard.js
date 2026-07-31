// ===============================
// Laptop Market Research
// Dashboard Analytics - Full JS
// Professional Live Analytics Dashboard
// ===============================

var GOOGLE_SHEETS_URL = "https://script.google.com/macros/s/AKfycbxNezU-FZQzKrBSEB8dj0MC8-30a1E7_gw7cK68hHWXrZHofW9gwVglDwlW4e5vkpEw6Q/exec";

// Chart.js global defaults - dark theme
Chart.defaults.color = "#cbd5e1";
Chart.defaults.borderColor = "rgba(255,255,255,0.08)";
Chart.defaults.font.family = "Poppins, sans-serif";

// Color palette for charts
var COLORS = [
    "#3b82f6", "#4ea3ff", "#60a5fa", "#93c5fd", "#bfdbfe",
    "#16a34a", "#22c55e", "#4ade80", "#86efac",
    "#f59e0b", "#fbbf24", "#fcd34d",
    "#ef4444", "#f87171", "#fca5a5",
    "#8b5cf6", "#a78bfa", "#c4b5fd",
    "#ec4899", "#f472b6"
];

// Chart type assignment for each question
var CHART_TYPES = {
    "Laptop Ownership": "doughnut",
    "Usage Purpose": "bar",
    "Useful Features": "polarArea",
    "Current Laptop Problems": "horizontalBar",
    "Satisfaction Level": "doughnut",
    "Improvement Needed": "bar",
    "Upgrade Frequency": "bar",
    "Preferred Brand": "horizontalBar",
    "Buying Factor": "doughnut",
    "Recommended Laptop": "pie",
    "Expected Laptop Life": "bar",
    "Budget": "bar",
    "Screen Size": "doughnut",
    "Preferred Laptop": "pie",
    "Buying Place": "doughnut",
    "Final Decision Factor": "bar"
};

// Chart instances tracking
var chartInstances = {};

// Table state
var surveyTableData = [];
var surveyFilteredData = [];
var surveyCurrentPage = 1;
var surveyRowsPerPage = 10;
var surveySortColumn = "";
var surveySortDirection = "asc";

var requestTableData = [];
var requestFilteredData = [];
var requestCurrentPage = 1;
var requestRowsPerPage = 10;
var requestSortColumn = "";
var requestSortDirection = "asc";

// Auto-refresh
var autoRefreshInterval = null;

// =======================================
// Data Functions
// =======================================

function fetchDashboardData() {
    return fetch(GOOGLE_SHEETS_URL + "?action=getDashboardData")
        .then(function(response) { return response.json(); })
        .then(function(data) {
            if (data && typeof data === "object") {
                return data;
            }
            return { stats: {}, requests: [], responses: [], questionBreakdown: {} };
        })
        .catch(function(error) {
            console.error("Error fetching dashboard data:", error);
            return { stats: {}, requests: [], responses: [], questionBreakdown: {} };
        });
}

function fetchSurveyData() {
    return fetch(GOOGLE_SHEETS_URL + "?action=getSurveyData")
        .then(function(response) { return response.json(); })
        .then(function(data) {
            if (Array.isArray(data)) return data;
            return [];
        })
        .catch(function(error) {
            console.error("Error fetching survey data:", error);
            return [];
        });
}

function fetchRequestData() {
    return fetch(GOOGLE_SHEETS_URL + "?action=getRequestData")
        .then(function(response) { return response.json(); })
        .then(function(data) {
            if (Array.isArray(data)) return data;
            return [];
        })
        .catch(function(error) {
            console.error("Error fetching request data:", error);
            return [];
        });
}

function fetchDashboardStats() {
    return fetch(GOOGLE_SHEETS_URL + "?action=getDashboardStats")
        .then(function(response) { return response.json(); })
        .then(function(data) {
            if (data && typeof data === "object") return data;
            return {};
        })
        .catch(function(error) {
            console.error("Error fetching dashboard stats:", error);
            return {};
        });
}

function countOption(responses, column) {
    var counts = {};
    for (var i = 0; i < responses.length; i++) {
        var answer = responses[i][column];
        if (answer && answer.toString().trim() !== "") {
            var key = answer.toString().trim();
            counts[key] = (counts[key] || 0) + 1;
        }
    }
    return counts;
}

// =======================================
// Destroy All Charts
// =======================================

function destroyAllCharts() {
    var keys = Object.keys(chartInstances);
    for (var i = 0; i < keys.length; i++) {
        if (chartInstances[keys[i]]) {
            chartInstances[keys[i]].destroy();
            delete chartInstances[keys[i]];
        }
    }
}

// =======================================
// Create Chart Helper
// =======================================

function createChart(canvasId, config) {
    var canvas = document.getElementById(canvasId);
    if (!canvas) return null;

    if (chartInstances[canvasId]) {
        chartInstances[canvasId].destroy();
        delete chartInstances[canvasId];
    }

    var ctx = canvas.getContext("2d");
    var chart = new Chart(ctx, config);
    chartInstances[canvasId] = chart;
    return chart;
}

// =======================================
// Tooltip Callbacks
// =======================================

function getPercentageTooltipCallback() {
    return {
        label: function(context) {
            var label = context.label || "";
            var value = context.parsed.y !== undefined ? context.parsed.y : context.parsed;
            if (context.dataset.data) {
                var total = 0;
                for (var i = 0; i < context.dataset.data.length; i++) {
                    total += context.dataset.data[i];
                }
                var percent = total > 0 ? ((value / total) * 100).toFixed(1) : 0;
                return label + ": " + value + " (" + percent + "%)";
            }
            return label + ": " + value;
        }
    };
}

function getBarPercentageTooltipCallback() {
    return {
        label: function(context) {
            var label = context.label || "";
            var value = context.parsed.y !== undefined ? context.parsed.y : context.parsed.x;
            var total = 0;
            var dataset = context.dataset.data;
            for (var i = 0; i < dataset.length; i++) {
                total += dataset[i];
            }
            var percent = total > 0 ? ((value / total) * 100).toFixed(1) : 0;
            return label + ": " + value + " (" + percent + "%)";
        }
    };
}

function getHorizontalBarPercentageTooltipCallback() {
    return {
        label: function(context) {
            var label = context.label || "";
            var value = context.parsed.x !== undefined ? context.parsed.x : context.parsed.y;
            var total = 0;
            var dataset = context.dataset.data;
            for (var i = 0; i < dataset.length; i++) {
                total += dataset[i];
            }
            var percent = total > 0 ? ((value / total) * 100).toFixed(1) : 0;
            return label + ": " + value + " (" + percent + "%)";
        }
    };
}

// =======================================
// Update Dashboard Cards
// =======================================

function updateDashboardCards(stats) {
    var totalRequests = stats.totalRequests || 0;
    var approved = stats.approved || 0;
    var pending = stats.pending || 0;
    var rejected = stats.rejected || 0;
    var totalResponses = stats.totalResponses || 0;
    var completionRate = stats.completionRate || 0;
    var avgCompletionTime = stats.avgCompletionTime || 0;

    document.getElementById("totalRequests").textContent = totalRequests;
    document.getElementById("approvedUsers").textContent = approved;
    document.getElementById("pendingRequests").textContent = pending;
    document.getElementById("rejectedRequests").textContent = rejected;
    document.getElementById("totalResponses").textContent = totalResponses;

    // Completion Rate
    if (completionRate > 0) {
        var rate = Math.round(completionRate * 100);
        if (rate > 100) rate = 100;
        document.getElementById("completionRate").textContent = rate + "%";
    } else {
        document.getElementById("completionRate").textContent = "0%";
    }

    // Avg Completion Time
    if (avgCompletionTime > 0) {
        var avgSec = Math.round(avgCompletionTime);
        if (avgSec >= 60) {
            var minutes = Math.floor(avgSec / 60);
            var seconds = avgSec % 60;
            document.getElementById("avgCompletionTime").textContent = minutes + "m " + seconds + "s";
        } else {
            document.getElementById("avgCompletionTime").textContent = avgSec + "s";
        }
    } else {
        document.getElementById("avgCompletionTime").textContent = "--";
    }

    // Update progress bars
    updateProgressBars(totalRequests, approved, pending, rejected);
}

// =======================================
// Update Progress Bars
// =======================================

function updateProgressBars(total, approved, pending, rejected) {
    if (total === 0) {
        document.getElementById("approvedBar").style.width = "0%";
        document.getElementById("pendingBar").style.width = "0%";
        document.getElementById("rejectedBar").style.width = "0%";
        document.getElementById("approvedPercent").textContent = "0%";
        document.getElementById("pendingPercent").textContent = "0%";
        document.getElementById("rejectedPercent").textContent = "0%";
        return;
    }

    var ap = Math.round((approved / total) * 100);
    var pp = Math.round((pending / total) * 100);
    var rp = Math.round((rejected / total) * 100);

    document.getElementById("approvedBar").style.width = ap + "%";
    document.getElementById("pendingBar").style.width = pp + "%";
    document.getElementById("rejectedBar").style.width = rp + "%";
    document.getElementById("approvedPercent").textContent = ap + "%";
    document.getElementById("pendingPercent").textContent = pp + "%";
    document.getElementById("rejectedPercent").textContent = rp + "%";
}

// =======================================
// Calculate Average Completion Time
// =======================================

function calculateAvgCompletionTime(responses) {
    var totalSeconds = 0;
    var count = 0;
    for (var i = 0; i < responses.length; i++) {
        var ct = responses[i]["Completion Time"];
        if (ct && ct.toString().trim() !== "") {
            var parsed = parseFloat(ct);
            if (!isNaN(parsed) && parsed > 0) {
                totalSeconds += parsed;
                count++;
            }
        }
    }
    if (count === 0) return "--";
    var avg = Math.round(totalSeconds / count);
    if (avg >= 60) {
        var minutes = Math.floor(avg / 60);
        var seconds = avg % 60;
        return minutes + "m " + seconds + "s";
    }
    return avg + "s";
}

// =======================================
// Chart Renderers
// =======================================

function renderDoughnutChart(canvasId, responses, column, customColors) {
    var counts = countOption(responses, column);
    var labels = Object.keys(counts);
    var data = Object.values(counts);
    if (labels.length === 0) return;
    var colors = customColors || COLORS.slice(0, labels.length);

    createChart(canvasId, {
        type: "doughnut",
        data: {
            labels: labels,
            datasets: [{ data: data, backgroundColor: colors, borderWidth: 0, hoverOffset: 8 }]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: {
                legend: { position: "bottom", labels: { padding: 14, usePointStyle: true, font: { size: 11 } } },
                tooltip: { callbacks: getPercentageTooltipCallback() }
            }
        }
    });
}

function renderPieChart(canvasId, responses, column, customColors) {
    var counts = countOption(responses, column);
    var labels = Object.keys(counts);
    var data = Object.values(counts);
    if (labels.length === 0) return;
    var colors = customColors || COLORS.slice(0, labels.length);

    createChart(canvasId, {
        type: "pie",
        data: {
            labels: labels,
            datasets: [{ data: data, backgroundColor: colors, borderWidth: 0, hoverOffset: 8 }]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: {
                legend: { position: "bottom", labels: { padding: 14, usePointStyle: true, font: { size: 11 } } },
                tooltip: { callbacks: getPercentageTooltipCallback() }
            }
        }
    });
}

function renderBarChart(canvasId, responses, column, customColors) {
    var counts = countOption(responses, column);
    var labels = Object.keys(counts);
    var data = Object.values(counts);
    if (labels.length === 0) return;
    var colors = customColors || COLORS.slice(0, labels.length);

    createChart(canvasId, {
        type: "bar",
        data: {
            labels: labels,
            datasets: [{ label: "Responses", data: data, backgroundColor: colors, borderRadius: 8, borderWidth: 0 }]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: { callbacks: getBarPercentageTooltipCallback() }
            },
            scales: {
                y: { beginAtZero: true, ticks: { stepSize: 1, font: { size: 11 } }, grid: { color: "rgba(255,255,255,0.06)" } },
                x: { grid: { display: false }, ticks: { font: { size: 10 }, maxRotation: 45, minRotation: 0 } }
            }
        }
    });
}

function renderHorizontalBarChart(canvasId, responses, column, customColors) {
    var counts = countOption(responses, column);
    var labels = Object.keys(counts);
    var data = Object.values(counts);
    if (labels.length === 0) return;
    var colors = customColors || COLORS.slice(0, labels.length);

    createChart(canvasId, {
        type: "bar",
        data: {
            labels: labels,
            datasets: [{ label: "Responses", data: data, backgroundColor: colors, borderRadius: 8, borderWidth: 0 }]
        },
        options: {
            responsive: true, maintainAspectRatio: false, indexAxis: "y",
            plugins: {
                legend: { display: false },
                tooltip: { callbacks: getHorizontalBarPercentageTooltipCallback() }
            },
            scales: {
                x: { beginAtZero: true, ticks: { stepSize: 1, font: { size: 11 } }, grid: { color: "rgba(255,255,255,0.06)" } },
                y: { grid: { display: false }, ticks: { font: { size: 11 } } }
            }
        }
    });
}

function renderPolarAreaChart(canvasId, responses, column) {
    var counts = countOption(responses, column);
    var labels = Object.keys(counts);
    var data = Object.values(counts);
    if (labels.length === 0) return;

    var bgColors = [];
    for (var i = 0; i < labels.length; i++) {
        bgColors.push(COLORS[i % COLORS.length] + "BB");
    }

    createChart(canvasId, {
        type: "polarArea",
        data: {
            labels: labels,
            datasets: [{ data: data, backgroundColor: bgColors, borderWidth: 0 }]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: {
                legend: { position: "bottom", labels: { padding: 12, usePointStyle: true, font: { size: 11 } } },
                tooltip: { callbacks: getPercentageTooltipCallback() }
            },
            scales: { r: { grid: { color: "rgba(255,255,255,0.08)" }, ticks: { display: false } } }
        }
    });
}

function renderLineChart(canvasId, labels, data, label) {
    if (labels.length === 0) return;

    createChart(canvasId, {
        type: "line",
        data: {
            labels: labels,
            datasets: [{
                label: label || "Count",
                data: data,
                borderColor: "#4ea3ff",
                backgroundColor: "rgba(78, 163, 255, 0.1)",
                fill: true,
                tension: 0.4,
                pointBackgroundColor: "#4ea3ff",
                pointBorderColor: "#ffffff",
                pointBorderWidth: 2,
                pointRadius: 5
            }]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: { mode: "index", intersect: false }
            },
            scales: {
                y: { beginAtZero: true, ticks: { stepSize: 1, font: { size: 11 } }, grid: { color: "rgba(255,255,255,0.06)" } },
                x: { grid: { display: false }, ticks: { font: { size: 10 }, maxRotation: 45, minRotation: 0 } }
            }
        }
    });
}

// =======================================
// Render Request Status Charts
// =======================================

function renderRequestCharts(stats) {
    var pending = stats.pending || 0;
    var approved = stats.approved || 0;
    var rejected = stats.rejected || 0;
    var statusLabels = [];
    var statusData = [];
    var statusColors = [];

    if (approved > 0) { statusLabels.push("Approved"); statusData.push(approved); statusColors.push("#16a34a"); }
    if (pending > 0) { statusLabels.push("Pending"); statusData.push(pending); statusColors.push("#f59e0b"); }
    if (rejected > 0) { statusLabels.push("Rejected"); statusData.push(rejected); statusColors.push("#ef4444"); }

    if (statusLabels.length === 0) {
        statusLabels = ["No Data"];
        statusData = [1];
        statusColors = ["#64748b"];
    }

    // Pie Chart
    createChart("requestPieChart", {
        type: "pie",
        data: {
            labels: statusLabels,
            datasets: [{ data: statusData, backgroundColor: statusColors, borderWidth: 0, hoverOffset: 8 }]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: {
                legend: { position: "bottom", labels: { padding: 14, usePointStyle: true, font: { size: 11 } } },
                tooltip: { callbacks: getPercentageTooltipCallback() }
            }
        }
    });

    // Doughnut Chart
    createChart("requestDoughnutChart", {
        type: "doughnut",
        data: {
            labels: statusLabels,
            datasets: [{ data: statusData, backgroundColor: statusColors, borderWidth: 0, hoverOffset: 8 }]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: {
                legend: { position: "bottom", labels: { padding: 14, usePointStyle: true, font: { size: 11 } } },
                tooltip: { callbacks: getPercentageTooltipCallback() }
            }
        }
    });

    // Bar Chart
    createChart("requestBarChart", {
        type: "bar",
        data: {
            labels: statusLabels,
            datasets: [{ label: "Requests", data: statusData, backgroundColor: statusColors, borderRadius: 8, borderWidth: 0 }]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: { callbacks: getBarPercentageTooltipCallback() }
            },
            scales: {
                y: { beginAtZero: true, ticks: { stepSize: 1, font: { size: 11 } }, grid: { color: "rgba(255,255,255,0.06)" } },
                x: { grid: { display: false } }
            }
        }
    });

    // Ownership Doughnut
    var ownerCount = stats.ownerCount || 0;
    var buyerCount = stats.buyerCount || 0;
    if (ownerCount > 0 || buyerCount > 0) {
        createChart("ownershipChart", {
            type: "doughnut",
            data: {
                labels: ["Laptop Owners", "Laptop Buyers"],
                datasets: [{ data: [ownerCount, buyerCount], backgroundColor: ["#3b82f6", "#16a34a"], borderWidth: 0, hoverOffset: 8 }]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                plugins: {
                    legend: { position: "bottom", labels: { padding: 14, usePointStyle: true, font: { size: 11 } } },
                    tooltip: { callbacks: getPercentageTooltipCallback() }
                }
            }
        });
    }
}

// =======================================
// Render All Survey Charts
// =======================================

function renderAllCharts(responses) {
    // 1. Laptop Ownership - Doughnut
    renderDoughnutChart("ownershipChart", responses, "Laptop Ownership", ["#3b82f6", "#16a34a"]);

    // 2. Usage Purpose - Bar
    renderBarChart("usageChart", responses, "Usage Purpose");

    // 3. Useful Features - Polar Area
    renderPolarAreaChart("featuresChart", responses, "Useful Features");

    // 4. Current Laptop Problems - Horizontal Bar
    renderHorizontalBarChart("problemsChart", responses, "Current Laptop Problems", ["#ef4444", "#f59e0b", "#fbbf24", "#60a5fa", "#16a34a", "#8b5cf6", "#ec4899", "#4ea3ff"]);

    // 5. Satisfaction Level - Doughnut (special ordering)
    renderSatisfactionChart(responses);

    // 6. Improvement Needed - Bar
    renderBarChart("improvementChart", responses, "Improvement Needed");

    // 7. Upgrade Frequency - Bar
    renderBarChart("upgradeChart", responses, "Upgrade Frequency");

    // 8. Preferred Brand - Horizontal Bar
    renderHorizontalBarChart("brandChart", responses, "Preferred Brand");

    // 9. Buying Factor - Doughnut
    renderDoughnutChart("buyingFactorChart", responses, "Buying Factor");

    // 10. Recommended Laptop - Pie
    renderPieChart("recommendedChart", responses, "Recommended Laptop");

    // 11. Expected Laptop Life - Bar
    renderBarChart("expectedLifeChart", responses, "Expected Laptop Life");

    // 12. Budget - Bar
    renderBarChart("budgetChart", responses, "Budget", ["#3b82f6", "#60a5fa", "#93c5fd", "#bfdbfe", "#dbeafe"]);

    // 13. Screen Size - Doughnut
    renderDoughnutChart("screenSizeChart", responses, "Screen Size");

    // 14. Preferred Laptop - Pie
    renderPieChart("preferredLaptopChart", responses, "Preferred Laptop");

    // 15. Buying Place - Doughnut
    renderDoughnutChart("buyingPlaceChart", responses, "Buying Place");

    // 16. Final Decision Factor - Bar
    renderBarChart("decisionChart", responses, "Final Decision Factor");

    // 17. Submission Timeline - Line Chart
    renderTimelineChart(responses);
}

// =======================================
// Satisfaction Chart (special ordering)
// =======================================

function renderSatisfactionChart(responses) {
    var counts = countOption(responses, "Satisfaction Level");
    var order = ["Very Satisfied", "Satisfied", "Neutral", "Dissatisfied", "Very Dissatisfied"];
    var labels = [];
    var data = [];
    var satColors = ["#16a34a", "#22c55e", "#fbbf24", "#f59e0b", "#ef4444"];
    var usedColors = [];

    for (var i = 0; i < order.length; i++) {
        if (counts[order[i]]) {
            labels.push(order[i]);
            data.push(counts[order[i]]);
            usedColors.push(satColors[i]);
        }
    }

    if (labels.length === 0) return;

    createChart("satisfactionChart", {
        type: "doughnut",
        data: {
            labels: labels,
            datasets: [{ data: data, backgroundColor: usedColors, borderWidth: 0, hoverOffset: 8 }]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: {
                legend: { position: "bottom", labels: { padding: 14, usePointStyle: true, font: { size: 11 } } },
                tooltip: { callbacks: getPercentageTooltipCallback() }
            }
        }
    });
}

// =======================================
// Timeline Chart (Line Chart)
// =======================================

function renderTimelineChart(responses) {
    var dateCounts = {};
    for (var i = 0; i < responses.length; i++) {
        var ts = responses[i]["Timestamp"];
        if (ts && ts.toString().trim() !== "") {
            try {
                var d = new Date(ts);
                if (!isNaN(d.getTime())) {
                    var dateKey = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
                    dateCounts[dateKey] = (dateCounts[dateKey] || 0) + 1;
                }
            } catch (e) { /* skip invalid date */ }
        }
    }

    var labels = Object.keys(dateCounts);
    var data = Object.values(dateCounts);

    // Sort by date
    if (labels.length > 1) {
        var combined = [];
        for (var i = 0; i < labels.length; i++) {
            combined.push({ label: labels[i], value: data[i] });
        }
        combined.sort(function(a, b) {
            return new Date(a.label) - new Date(b.label);
        });
        labels = combined.map(function(c) { return c.label; });
        data = combined.map(function(c) { return c.value; });
    }

    renderLineChart("timelineChart", labels, data, "Submissions");
}

// =======================================
// Requests Table
// =======================================

function renderRequestTable(requests) {
    requestTableData = requests;
    requestFilteredData = requests.slice();
    requestCurrentPage = 1;
    requestSortColumn = "";
    requestSortDirection = "asc";
    updateRequestTable();
}

function updateRequestTable() {
    var tbody = document.getElementById("requestTableBody");
    var start = (requestCurrentPage - 1) * requestRowsPerPage;
    var end = Math.min(start + requestRowsPerPage, requestFilteredData.length);

    var html = "";
    for (var i = start; i < end; i++) {
        var row = requestFilteredData[i];
        var requestId = row["Request ID"] || "--";
        var name = row["Name"] || "--";
        var email = row["Email"] || "--";
        var dateVal = row["Request Date & Time"] || "--";
        var status = row["Status"] || "--";
        var approvedBy = row["Approved By"] || "--";

        var dateStr = "--";
        if (dateVal && dateVal.toString().trim() !== "") {
            try {
                var d = new Date(dateVal);
                if (!isNaN(d.getTime())) {
                    dateStr = d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
                } else {
                    dateStr = dateVal.toString();
                }
            } catch (e) { dateStr = dateVal.toString(); }
        }

        var statusClass = "status-pending";
        if (status === "Approved" || status === "Accepted") statusClass = "status-approved";
        else if (status === "Rejected") statusClass = "status-rejected";

        html += '<tr>';
        html += '<td title="' + escapeHtml(requestId) + '">' + escapeHtml(requestId) + '</td>';
        html += '<td title="' + escapeHtml(name) + '">' + escapeHtml(name) + '</td>';
        html += '<td title="' + escapeHtml(email) + '">' + escapeHtml(email) + '</td>';
        html += '<td>' + escapeHtml(dateStr) + '</td>';
        html += '<td><span class="status-badge ' + statusClass + '">' + escapeHtml(status) + '</span></td>';
        html += '<td title="' + escapeHtml(approvedBy) + '">' + escapeHtml(approvedBy) + '</td>';
        html += '</tr>';
    }

    tbody.innerHTML = html;

    var totalPages = Math.ceil(requestFilteredData.length / requestRowsPerPage);
    if (totalPages === 0) totalPages = 1;
    document.getElementById("reqPageInfo").textContent = "Page " + requestCurrentPage + " of " + totalPages;
    document.getElementById("reqPrevBtn").disabled = (requestCurrentPage <= 1);
    document.getElementById("reqNextBtn").disabled = (requestCurrentPage >= totalPages);
}

function handleRequestSearch() {
    var query = document.getElementById("requestSearchInput").value.toLowerCase().trim();
    var statusFilter = document.getElementById("requestStatusFilter").value;

    requestFilteredData = [];
    for (var i = 0; i < requestTableData.length; i++) {
        var row = requestTableData[i];
        var name = (row["Name"] || "").toString().toLowerCase();
        var email = (row["Email"] || "").toString().toLowerCase();
        var status = (row["Status"] || "").toString().trim();

        var matchesSearch = query === "" || name.indexOf(query) !== -1 || email.indexOf(query) !== -1;
        var matchesStatus = statusFilter === "all" || status === statusFilter;

        if (matchesSearch && matchesStatus) {
            requestFilteredData.push(row);
        }
    }
    requestCurrentPage = 1;
    updateRequestTable();
}

function handleRequestSort(column) {
    if (requestSortColumn === column) {
        requestSortDirection = (requestSortDirection === "asc") ? "desc" : "asc";
    } else {
        requestSortColumn = column;
        requestSortDirection = "asc";
    }

    requestFilteredData.sort(function(a, b) {
        var valA = (a[column] || "").toString().toLowerCase();
        var valB = (b[column] || "").toString().toLowerCase();

        if (column === "Request Date & Time") {
            var dateA = new Date(a[column]);
            var dateB = new Date(b[column]);
            if (!isNaN(dateA.getTime()) && !isNaN(dateB.getTime())) {
                return requestSortDirection === "asc" ? dateA - dateB : dateB - dateA;
            }
        }

        if (valA < valB) return requestSortDirection === "asc" ? -1 : 1;
        if (valA > valB) return requestSortDirection === "asc" ? 1 : -1;
        return 0;
    });

    requestCurrentPage = 1;
    updateRequestTable();
}

// =======================================
// Survey Responses Table
// =======================================

function renderSurveyTable(responses) {
    surveyTableData = responses;
    surveyFilteredData = responses.slice();
    surveyCurrentPage = 1;
    surveySortColumn = "";
    surveySortDirection = "asc";
    updateSurveyTable();
}

function updateSurveyTable() {
    var tbody = document.getElementById("tableBody");
    var start = (surveyCurrentPage - 1) * surveyRowsPerPage;
    var end = Math.min(start + surveyRowsPerPage, surveyFilteredData.length);

    var html = "";
    for (var i = start; i < end; i++) {
        var row = surveyFilteredData[i];
        var name = row["Name"] || "--";
        var email = row["Email"] || "--";
        var ownership = row["Laptop Ownership"] || "--";
        var usage = row["Usage Purpose"] || "--";
        var brand = row["Preferred Brand"] || "--";
        var timestamp = row["Timestamp"] || "--";
        var completionTime = row["Completion Time"] || "--";

        var dateStr = "--";
        if (timestamp && timestamp.toString().trim() !== "") {
            try {
                var d = new Date(timestamp);
                if (!isNaN(d.getTime())) {
                    dateStr = d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
                } else {
                    dateStr = timestamp.toString();
                }
            } catch (e) { dateStr = timestamp.toString(); }
        }

        // Format completion time
        var ctStr = "--";
        if (completionTime && completionTime.toString().trim() !== "") {
            var ctParsed = parseFloat(completionTime);
            if (!isNaN(ctParsed) && ctParsed > 0) {
                var ctSec = Math.round(ctParsed);
                if (ctSec >= 60) {
                    ctStr = Math.floor(ctSec / 60) + "m " + (ctSec % 60) + "s";
                } else {
                    ctStr = ctSec + "s";
                }
            } else {
                ctStr = completionTime.toString();
            }
        }

        var ownershipClass = "";
        if (ownership === "Yes") ownershipClass = " ownership-yes";
        else if (ownership === "No") ownershipClass = " ownership-no";

        html += '<tr>';
        html += '<td title="' + escapeHtml(name) + '">' + escapeHtml(name) + '</td>';
        html += '<td title="' + escapeHtml(email) + '">' + escapeHtml(email) + '</td>';
        html += '<td class="' + ownershipClass + '">' + escapeHtml(ownership) + '</td>';
        html += '<td>' + escapeHtml(usage) + '</td>';
        html += '<td>' + escapeHtml(brand) + '</td>';
        html += '<td>' + escapeHtml(dateStr) + '</td>';
        html += '<td>' + escapeHtml(ctStr) + '</td>';
        html += '</tr>';
    }

    tbody.innerHTML = html;

    var totalPages = Math.ceil(surveyFilteredData.length / surveyRowsPerPage);
    if (totalPages === 0) totalPages = 1;
    document.getElementById("pageInfo").textContent = "Page " + surveyCurrentPage + " of " + totalPages;
    document.getElementById("prevBtn").disabled = (surveyCurrentPage <= 1);
    document.getElementById("nextBtn").disabled = (surveyCurrentPage >= totalPages);
}

function handleSurveySearch() {
    var query = document.getElementById("searchInput").value.toLowerCase().trim();
    var ownershipFilter = document.getElementById("ownershipFilter").value;

    surveyFilteredData = [];
    for (var i = 0; i < surveyTableData.length; i++) {
        var row = surveyTableData[i];
        var name = (row["Name"] || "").toString().toLowerCase();
        var email = (row["Email"] || "").toString().toLowerCase();
        var ownership = (row["Laptop Ownership"] || "").toString().trim();

        var matchesSearch = query === "" || name.indexOf(query) !== -1 || email.indexOf(query) !== -1;
        var matchesOwnership = ownershipFilter === "all" || ownership === ownershipFilter;

        if (matchesSearch && matchesOwnership) {
            surveyFilteredData.push(row);
        }
    }
    surveyCurrentPage = 1;
    updateSurveyTable();
}

function handleSurveySort(column) {
    if (surveySortColumn === column) {
        surveySortDirection = (surveySortDirection === "asc") ? "desc" : "asc";
    } else {
        surveySortColumn = column;
        surveySortDirection = "asc";
    }

    surveyFilteredData.sort(function(a, b) {
        var valA = (a[column] || "").toString().toLowerCase();
        var valB = (b[column] || "").toString().toLowerCase();

        if (column === "Timestamp") {
            var dateA = new Date(a[column]);
            var dateB = new Date(b[column]);
            if (!isNaN(dateA.getTime()) && !isNaN(dateB.getTime())) {
                return surveySortDirection === "asc" ? dateA - dateB : dateB - dateA;
            }
        }

        if (column === "Completion Time") {
            var numA = parseFloat(a[column]) || 0;
            var numB = parseFloat(b[column]) || 0;
            return surveySortDirection === "asc" ? numA - numB : numB - numA;
        }

        if (valA < valB) return surveySortDirection === "asc" ? -1 : 1;
        if (valA > valB) return surveySortDirection === "asc" ? 1 : -1;
        return 0;
    });

    surveyCurrentPage = 1;
    updateSurveyTable();
}

function escapeHtml(str) {
    if (!str) return "";
    var div = document.createElement("div");
    div.appendChild(document.createTextNode(str.toString()));
    return div.innerHTML;
}

// =======================================
// Last Updated Timestamp
// =======================================

function updateLastUpdated() {
    var now = new Date();
    var timeStr = now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    var dateStr = now.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    document.getElementById("lastUpdated").textContent = "Last updated: " + dateStr + " " + timeStr;
}

// =======================================
// Main Render Dashboard
// =======================================

function renderDashboard(stats, responses, requests) {
    var noDataMessage = document.getElementById("noDataMessage");
    var chartsGrid = document.getElementById("chartsGrid");
    var statsGrid = document.getElementById("statsGrid");
    var tableSection = document.getElementById("tableSection");
    var requestTableSection = document.getElementById("requestTableSection");
    var progressSection = document.getElementById("progressSection");
    var requestChartsGrid = document.getElementById("requestChartsGrid");
    var loadingMessage = document.getElementById("loadingMessage");

    if (loadingMessage) loadingMessage.style.display = "none";

    // Update dashboard cards
    updateDashboardCards(stats);

    // Always show request-related sections if we have requests
    if (requests && requests.length > 0) {
        progressSection.style.display = "block";
        requestChartsGrid.style.display = "grid";
        requestTableSection.style.display = "block";
        renderRequestCharts(stats);
        renderRequestTable(requests);
    } else {
        progressSection.style.display = "none";
        requestChartsGrid.style.display = "none";
        requestTableSection.style.display = "none";
    }

    // Check if we have survey data
    if (!responses || responses.length === 0) {
        noDataMessage.style.display = "block";
        chartsGrid.style.display = "none";
        statsGrid.style.display = "grid";
        tableSection.style.display = "none";
        return;
    }

    noDataMessage.style.display = "none";
    chartsGrid.style.display = "grid";
    statsGrid.style.display = "grid";
    tableSection.style.display = "block";

    // Render all survey charts
    renderAllCharts(responses);

    // Render survey table
    renderSurveyTable(responses);

    // Update timestamp
    updateLastUpdated();
}

// =======================================
// Load All Data
// =======================================

function loadAllData() {
    var loadingMessage = document.getElementById("loadingMessage");
    if (loadingMessage) loadingMessage.style.display = "flex";

    var noDataMessage = document.getElementById("noDataMessage");
    noDataMessage.style.display = "none";

    // Try the combined endpoint first
    fetchDashboardData()
        .then(function(dashboardData) {
            if (dashboardData.stats && dashboardData.stats.totalRequests !== undefined) {
                // Got full data from getDashboardData
                destroyAllCharts();
                renderDashboard(
                    dashboardData.stats,
                    dashboardData.responses || [],
                    dashboardData.requests || []
                );
            } else {
                // Fallback to separate endpoints
                return Promise.all([fetchDashboardStats(), fetchSurveyData(), fetchRequestData()])
                    .then(function(results) {
                        destroyAllCharts();
                        renderDashboard(results[0] || {}, results[1] || [], results[2] || []);
                    });
            }
        })
        .catch(function(error) {
            console.error("Error loading dashboard data:", error);
            // Fallback to separate endpoints
            return Promise.all([fetchDashboardStats(), fetchSurveyData(), fetchRequestData()])
                .then(function(results) {
                    destroyAllCharts();
                    renderDashboard(results[0] || {}, results[1] || [], results[2] || []);
                })
                .catch(function(err) {
                    console.error("Fallback also failed:", err);
                    if (loadingMessage) loadingMessage.style.display = "none";
                    var noDataMessage = document.getElementById("noDataMessage");
                    noDataMessage.style.display = "block";
                });
        });
}

// =======================================
// Auto-Refresh
// =======================================

function startAutoRefresh() {
    if (autoRefreshInterval) clearInterval(autoRefreshInterval);
    autoRefreshInterval = setInterval(function() {
        loadAllData();
    }, 30000);
}

function stopAutoRefresh() {
    if (autoRefreshInterval) {
        clearInterval(autoRefreshInterval);
        autoRefreshInterval = null;
    }
}

// =======================================
// Event Listeners
// =======================================

// Refresh button
document.getElementById("refreshBtn").addEventListener("click", function() {
    loadAllData();
});

// Auto-refresh toggle
document.getElementById("autoRefreshToggle").addEventListener("change", function() {
    if (this.checked) startAutoRefresh();
    else stopAutoRefresh();
});

// Survey search input
document.getElementById("searchInput").addEventListener("input", function() {
    handleSurveySearch();
});

// Ownership filter
document.getElementById("ownershipFilter").addEventListener("change", function() {
    handleSurveySearch();
});

// Request search input
document.getElementById("requestSearchInput").addEventListener("input", function() {
    handleRequestSearch();
});

// Request status filter
document.getElementById("requestStatusFilter").addEventListener("change", function() {
    handleRequestSearch();
});

// Survey pagination
document.getElementById("prevBtn").addEventListener("click", function() {
    if (surveyCurrentPage > 1) { surveyCurrentPage--; updateSurveyTable(); }
});
document.getElementById("nextBtn").addEventListener("click", function() {
    var totalPages = Math.ceil(surveyFilteredData.length / surveyRowsPerPage);
    if (surveyCurrentPage < totalPages) { surveyCurrentPage++; updateSurveyTable(); }
});

// Request pagination
document.getElementById("reqPrevBtn").addEventListener("click", function() {
    if (requestCurrentPage > 1) { requestCurrentPage--; updateRequestTable(); }
});
document.getElementById("reqNextBtn").addEventListener("click", function() {
    var totalPages = Math.ceil(requestFilteredData.length / requestRowsPerPage);
    if (requestCurrentPage < totalPages) { requestCurrentPage++; updateRequestTable(); }
});

// Sortable table headers
var sortableHeaders = document.querySelectorAll(".sortable");
for (var i = 0; i < sortableHeaders.length; i++) {
    sortableHeaders[i].addEventListener("click", function() {
        var column = this.getAttribute("data-column");
        var table = this.getAttribute("data-table");

        if (table === "requests") {
            handleRequestSort(column);
        } else {
            handleSurveySort(column);
        }

        // Update sort indicators
        var allHeaders = document.querySelectorAll(".sortable[data-table='" + table + "']");
        for (var j = 0; j < allHeaders.length; j++) {
            allHeaders[j].classList.remove("sort-asc", "sort-desc");
        }
        var dir = table === "requests" ? requestSortDirection : surveySortDirection;
        this.classList.add(dir === "asc" ? "sort-asc" : "sort-desc");
    });
}

// =======================================
// Initialize Dashboard
// =======================================

loadAllData();
