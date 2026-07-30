// ===============================
// Laptop Market Research
// Dashboard Analytics - Full JS
// ===============================

var GOOGLE_SHEETS_URL = "https://script.google.com/macros/s/AKfycbxaSHCsuBMp1XiUL0Gnu2iZo4Ab6ITHTLRUNTFaEW94fQ__A9CdfXsOqztCAd6eMabADA/exec";

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

// Chart instances tracking
var chartInstances = {};

// Table state
var tableData = [];
var filteredData = [];
var currentPage = 1;
var rowsPerPage = 10;
var sortColumn = "";
var sortDirection = "asc";

// Auto-refresh
var autoRefreshInterval = null;

// =======================================
// Data Functions
// =======================================

function fetchSurveyData() {
    return fetch(GOOGLE_SHEETS_URL + "?action=getSurveyData")
        .then(function(response) { return response.json(); })
        .then(function(data) {
            if (Array.isArray(data)) {
                return data;
            }
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
            if (Array.isArray(data)) {
                return data;
            }
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
            if (data && typeof data === "object") {
                return data;
            }
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

    // Destroy existing chart for this canvas
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
// Tooltip with Count and Percentage
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

    document.getElementById("totalRequests").textContent = totalRequests;
    document.getElementById("approvedUsers").textContent = approved;
    document.getElementById("pendingRequests").textContent = pending;
    document.getElementById("rejectedRequests").textContent = rejected;
    document.getElementById("totalResponses").textContent = totalResponses;

    // Completion Rate: percentage of approved users who completed the survey
    if (completionRate > 0) {
        var rate = Math.round(completionRate * 100);
        if (rate > 100) rate = 100;
        document.getElementById("completionRate").textContent = rate + "%";
    } else {
        document.getElementById("completionRate").textContent = "0%";
    }
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
            datasets: [{
                data: data,
                backgroundColor: colors,
                borderWidth: 0,
                hoverOffset: 8
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: "bottom",
                    labels: { padding: 14, usePointStyle: true, font: { size: 11 } }
                },
                tooltip: {
                    callbacks: getPercentageTooltipCallback()
                }
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
            datasets: [{
                data: data,
                backgroundColor: colors,
                borderWidth: 0,
                hoverOffset: 8
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: "bottom",
                    labels: { padding: 14, usePointStyle: true, font: { size: 11 } }
                },
                tooltip: {
                    callbacks: getPercentageTooltipCallback()
                }
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
            datasets: [{
                label: "Responses",
                data: data,
                backgroundColor: colors,
                borderRadius: 8,
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: getBarPercentageTooltipCallback()
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: { stepSize: 1, font: { size: 11 } },
                    grid: { color: "rgba(255,255,255,0.06)" }
                },
                x: {
                    grid: { display: false },
                    ticks: { font: { size: 10 }, maxRotation: 45, minRotation: 0 }
                }
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
            datasets: [{
                label: "Responses",
                data: data,
                backgroundColor: colors,
                borderRadius: 8,
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            indexAxis: "y",
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: getHorizontalBarPercentageTooltipCallback()
                }
            },
            scales: {
                x: {
                    beginAtZero: true,
                    ticks: { stepSize: 1, font: { size: 11 } },
                    grid: { color: "rgba(255,255,255,0.06)" }
                },
                y: {
                    grid: { display: false },
                    ticks: { font: { size: 11 } }
                }
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
            datasets: [{
                data: data,
                backgroundColor: bgColors,
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: "bottom",
                    labels: { padding: 12, usePointStyle: true, font: { size: 11 } }
                },
                tooltip: {
                    callbacks: getPercentageTooltipCallback()
                }
            },
            scales: {
                r: {
                    grid: { color: "rgba(255,255,255,0.08)" },
                    ticks: { display: false }
                }
            }
        }
    });
}

// =======================================
// Render All Charts
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

    // 5. Satisfaction Level - Doughnut
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
            datasets: [{
                data: data,
                backgroundColor: usedColors,
                borderWidth: 0,
                hoverOffset: 8
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: "bottom",
                    labels: { padding: 14, usePointStyle: true, font: { size: 11 } }
                },
                tooltip: {
                    callbacks: getPercentageTooltipCallback()
                }
            }
        }
    });
}

// =======================================
// Recent Responses Table
// =======================================

function renderTable(responses) {
    tableData = responses;
    filteredData = responses.slice();
    currentPage = 1;
    sortColumn = "";
    sortDirection = "asc";
    updateTable();
}

function updateTable() {
    var tbody = document.getElementById("tableBody");
    var start = (currentPage - 1) * rowsPerPage;
    var end = Math.min(start + rowsPerPage, filteredData.length);

    var html = "";
    for (var i = start; i < end; i++) {
        var row = filteredData[i];
        var name = row["Name"] || "--";
        var email = row["Email"] || "--";
        var ownership = row["Laptop Ownership"] || "--";
        var timestamp = row["Timestamp"] || "--";

        // Format timestamp
        var dateStr = "--";
        if (timestamp && timestamp.toString().trim() !== "") {
            try {
                var d = new Date(timestamp);
                if (!isNaN(d.getTime())) {
                    dateStr = d.toLocaleDateString("en-US", {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit"
                    });
                } else {
                    dateStr = timestamp.toString();
                }
            } catch (e) {
                dateStr = timestamp.toString();
            }
        }

        var ownershipClass = "";
        if (ownership === "Yes") {
            ownershipClass = " ownership-yes";
        } else if (ownership === "No") {
            ownershipClass = " ownership-no";
        }

        html += '<tr>';
        html += '<td title="' + escapeHtml(name) + '">' + escapeHtml(name) + '</td>';
        html += '<td title="' + escapeHtml(email) + '">' + escapeHtml(email) + '</td>';
        html += '<td class="' + ownershipClass + '">' + escapeHtml(ownership) + '</td>';
        html += '<td>' + escapeHtml(dateStr) + '</td>';
        html += '</tr>';
    }

    tbody.innerHTML = html;

    // Update pagination
    var totalPages = Math.ceil(filteredData.length / rowsPerPage);
    if (totalPages === 0) totalPages = 1;

    document.getElementById("pageInfo").textContent = "Page " + currentPage + " of " + totalPages;
    document.getElementById("prevBtn").disabled = (currentPage <= 1);
    document.getElementById("nextBtn").disabled = (currentPage >= totalPages);
}

function escapeHtml(str) {
    if (!str) return "";
    var div = document.createElement("div");
    div.appendChild(document.createTextNode(str.toString()));
    return div.innerHTML;
}

// =======================================
// Table Search
// =======================================

function handleSearch() {
    var query = document.getElementById("searchInput").value.toLowerCase().trim();
    if (query === "") {
        filteredData = tableData.slice();
    } else {
        filteredData = [];
        for (var i = 0; i < tableData.length; i++) {
            var name = (tableData[i]["Name"] || "").toString().toLowerCase();
            var email = (tableData[i]["Email"] || "").toString().toLowerCase();
            if (name.indexOf(query) !== -1 || email.indexOf(query) !== -1) {
                filteredData.push(tableData[i]);
            }
        }
    }
    currentPage = 1;
    updateTable();
}

// =======================================
// Table Sorting
// =======================================

function handleSort(column) {
    if (sortColumn === column) {
        sortDirection = (sortDirection === "asc") ? "desc" : "asc";
    } else {
        sortColumn = column;
        sortDirection = "asc";
    }

    filteredData.sort(function(a, b) {
        var valA = (a[column] || "").toString().toLowerCase();
        var valB = (b[column] || "").toString().toLowerCase();

        // For timestamp, try to parse dates
        if (column === "Timestamp") {
            var dateA = new Date(a[column]);
            var dateB = new Date(b[column]);
            if (!isNaN(dateA.getTime()) && !isNaN(dateB.getTime())) {
                valA = dateA.getTime();
                valB = dateB.getTime();
                if (sortDirection === "asc") {
                    return valA - valB;
                } else {
                    return valB - valA;
                }
            }
        }

        if (valA < valB) {
            return sortDirection === "asc" ? -1 : 1;
        }
        if (valA > valB) {
            return sortDirection === "asc" ? 1 : -1;
        }
        return 0;
    });

    currentPage = 1;
    updateTable();
}

// =======================================
// Last Updated Timestamp
// =======================================

function updateLastUpdated() {
    var now = new Date();
    var timeStr = now.toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit"
    });
    var dateStr = now.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric"
    });
    document.getElementById("lastUpdated").textContent = "Last updated: " + dateStr + " " + timeStr;
}

// =======================================
// Main Render Dashboard
// =======================================

function renderDashboard(stats, responses) {
    var noDataMessage = document.getElementById("noDataMessage");
    var chartsGrid = document.getElementById("chartsGrid");
    var statsGrid = document.getElementById("statsGrid");
    var tableSection = document.getElementById("tableSection");
    var loadingMessage = document.getElementById("loadingMessage");

    if (loadingMessage) loadingMessage.style.display = "none";

    // Update dashboard cards from stats
    updateDashboardCards(stats);

    // Update avg completion time from responses
    var avgTime = calculateAvgCompletionTime(responses);
    document.getElementById("avgCompletionTime").textContent = avgTime;

    // Check if we have survey data
    if (!responses || responses.length === 0) {
        noDataMessage.style.display = "block";
        chartsGrid.style.display = "none";
        statsGrid.style.display = "none";
        tableSection.style.display = "none";
        return;
    }

    noDataMessage.style.display = "none";
    chartsGrid.style.display = "grid";
    statsGrid.style.display = "grid";
    tableSection.style.display = "block";

    // Render all charts
    renderAllCharts(responses);

    // Render table
    renderTable(responses);

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

    // Fetch all data in parallel
    var statsPromise = fetchDashboardStats();
    var surveyPromise = fetchSurveyData();

    Promise.all([statsPromise, surveyPromise])
        .then(function(results) {
            var stats = results[0] || {};
            var responses = results[1] || [];

            // Destroy existing charts before re-rendering
            destroyAllCharts();

            renderDashboard(stats, responses);
        })
        .catch(function(error) {
            console.error("Error loading dashboard data:", error);
            if (loadingMessage) loadingMessage.style.display = "none";
            var noDataMessage = document.getElementById("noDataMessage");
            noDataMessage.style.display = "block";
        });
}

// =======================================
// Auto-Refresh
// =======================================

function startAutoRefresh() {
    if (autoRefreshInterval) {
        clearInterval(autoRefreshInterval);
    }
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
    if (this.checked) {
        startAutoRefresh();
    } else {
        stopAutoRefresh();
    }
});

// Search input
document.getElementById("searchInput").addEventListener("input", function() {
    handleSearch();
});

// Pagination buttons
document.getElementById("prevBtn").addEventListener("click", function() {
    if (currentPage > 1) {
        currentPage--;
        updateTable();
    }
});

document.getElementById("nextBtn").addEventListener("click", function() {
    var totalPages = Math.ceil(filteredData.length / rowsPerPage);
    if (currentPage < totalPages) {
        currentPage++;
        updateTable();
    }
});

// Sortable table headers
var sortableHeaders = document.querySelectorAll(".sortable");
for (var i = 0; i < sortableHeaders.length; i++) {
    sortableHeaders[i].addEventListener("click", function() {
        var column = this.getAttribute("data-column");
        handleSort(column);

        // Update sort indicators
        var allHeaders = document.querySelectorAll(".sortable");
        for (var j = 0; j < allHeaders.length; j++) {
            allHeaders[j].classList.remove("sort-asc", "sort-desc");
        }
        this.classList.add(sortDirection === "asc" ? "sort-asc" : "sort-desc");
    });
}

// =======================================
// Initialize Dashboard
// =======================================

loadAllData();
