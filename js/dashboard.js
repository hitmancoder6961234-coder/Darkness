// ===============================
// Laptop Market Research
// Dashboard Analytics
// ===============================

const GOOGLE_SHEETS_URL = "https://script.google.com/macros/s/AKfycbx-kggNIXc9XqSjtXkLOaY5-WbMNlmnA_6HnzFoCjqsS58pZdHqs-_n2GiUUmTVuLas1g/exec";

// Chart.js global defaults
Chart.defaults.color = "#cbd5e1";
Chart.defaults.borderColor = "rgba(255,255,255,0.08)";
Chart.defaults.font.family = "Poppins, sans-serif";

// Color palette for charts
const COLORS = [
    "#3b82f6", "#4ea3ff", "#60a5fa", "#93c5fd", "#bfdbfe",
    "#16a34a", "#22c55e", "#4ade80", "#86efac",
    "#f59e0b", "#fbbf24", "#fcd34d",
    "#ef4444", "#f87171", "#fca5a5",
    "#8b5cf6", "#a78bfa", "#c4b5fd",
    "#ec4899", "#f472b6"
];

// =======================================
// Data Collection from Google Sheets
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

function countOption(responses, column) {
    var counts = {};

    responses.forEach(function(resp) {
        var answer = resp[column];
        if (answer && answer.toString().trim() !== "") {
            counts[answer] = (counts[answer] || 0) + 1;
        }
    });

    return counts;
}

// =======================================
// Render Dashboard
// =======================================

function renderDashboard(responses) {
    var noDataMessage = document.getElementById("noDataMessage");
    var chartsGrid = document.querySelector(".charts-grid");
    var statsGrid = document.querySelector(".stats-grid");
    var loadingMessage = document.getElementById("loadingMessage");

    if (loadingMessage) loadingMessage.style.display = "none";

    if (!responses || responses.length === 0) {
        noDataMessage.style.display = "block";
        chartsGrid.style.display = "none";
        statsGrid.style.display = "none";
        return;
    }

    noDataMessage.style.display = "none";
    chartsGrid.style.display = "grid";
    statsGrid.style.display = "grid";

    // Calculate stats
    var ownerCount = 0;
    var buyerCount = 0;

    responses.forEach(function(resp) {
        if (resp["Laptop Ownership"] === "Yes") ownerCount++;
        else if (resp["Laptop Ownership"] === "No") buyerCount++;
    });

    document.getElementById("totalResponses").textContent = responses.length;
    document.getElementById("ownerCount").textContent = ownerCount;
    document.getElementById("buyerCount").textContent = buyerCount;
    document.getElementById("ownerPercent").textContent =
        responses.length > 0
            ? Math.round((ownerCount / responses.length) * 100) + "%"
            : "0%";

    // Render all charts
    renderOwnershipChart(responses);
    renderUsageChart(responses);
    renderBrandChart(responses);
    renderFeatureChart(responses);
    renderSatisfactionChart(responses);
    renderBudgetChart(responses);
    renderDecisionChart(responses);
    renderProblemsChart(responses);
}

// =======================================
// Chart Renderers
// =======================================

function renderOwnershipChart(responses) {
    var counts = countOption(responses, "Laptop Ownership");
    var ctx = document.getElementById("ownershipChart").getContext("2d");

    new Chart(ctx, {
        type: "doughnut",
        data: {
            labels: Object.keys(counts),
            datasets: [{
                data: Object.values(counts),
                backgroundColor: ["#3b82f6", "#16a34a"],
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
                    labels: { padding: 16, usePointStyle: true }
                }
            }
        }
    });
}

function renderUsageChart(responses) {
    var counts = countOption(responses, "Usage Purpose");
    var ctx = document.getElementById("usageChart").getContext("2d");

    new Chart(ctx, {
        type: "bar",
        data: {
            labels: Object.keys(counts),
            datasets: [{
                label: "Responses",
                data: Object.values(counts),
                backgroundColor: COLORS.slice(0, Object.keys(counts).length),
                borderRadius: 8,
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                y: { beginAtZero: true, ticks: { stepSize: 1 } },
                x: { grid: { display: false } }
            }
        }
    });
}

function renderBrandChart(responses) {
    var counts = countOption(responses, "Preferred Brand");
    var ctx = document.getElementById("brandChart").getContext("2d");

    new Chart(ctx, {
        type: "bar",
        data: {
            labels: Object.keys(counts),
            datasets: [{
                label: "Responses",
                data: Object.values(counts),
                backgroundColor: COLORS.slice(0, Object.keys(counts).length),
                borderRadius: 8,
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            indexAxis: "y",
            plugins: { legend: { display: false } },
            scales: {
                x: { beginAtZero: true, ticks: { stepSize: 1 } },
                y: { grid: { display: false } }
            }
        }
    });
}

function renderFeatureChart(responses) {
    var counts = countOption(responses, "Useful Features");
    var ctx = document.getElementById("featureChart").getContext("2d");

    new Chart(ctx, {
        type: "polarArea",
        data: {
            labels: Object.keys(counts),
            datasets: [{
                data: Object.values(counts),
                backgroundColor: COLORS.slice(0, Object.keys(counts).length).map(function(c) {
                    return c + "99";
                }),
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: "bottom",
                    labels: { padding: 12, usePointStyle: true }
                }
            }
        }
    });
}

function renderSatisfactionChart(responses) {
    var counts = countOption(responses, "Satisfaction Level");
    var ctx = document.getElementById("satisfactionChart").getContext("2d");

    var order = ["Very Satisfied", "Satisfied", "Neutral", "Dissatisfied", "Very Dissatisfied"];
    var labels = order.filter(function(k) { return counts[k]; });
    var data = labels.map(function(k) { return counts[k]; });
    var satColors = ["#16a34a", "#22c55e", "#fbbf24", "#f59e0b", "#ef4444"];

    new Chart(ctx, {
        type: "doughnut",
        data: {
            labels: labels,
            datasets: [{
                data: data,
                backgroundColor: satColors.slice(0, labels.length),
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
                    labels: { padding: 12, usePointStyle: true }
                }
            }
        }
    });
}

function renderBudgetChart(responses) {
    var counts = countOption(responses, "Budget");
    var ctx = document.getElementById("budgetChart").getContext("2d");

    new Chart(ctx, {
        type: "bar",
        data: {
            labels: Object.keys(counts),
            datasets: [{
                label: "Responses",
                data: Object.values(counts),
                backgroundColor: ["#3b82f6", "#60a5fa", "#93c5fd", "#bfdbfe"],
                borderRadius: 8,
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                y: { beginAtZero: true, ticks: { stepSize: 1 } },
                x: { grid: { display: false } }
            }
        }
    });
}

function renderDecisionChart(responses) {
    var counts = countOption(responses, "Final Decision Factor");
    var ctx = document.getElementById("decisionChart").getContext("2d");

    new Chart(ctx, {
        type: "doughnut",
        data: {
            labels: Object.keys(counts),
            datasets: [{
                data: Object.values(counts),
                backgroundColor: COLORS.slice(0, Object.keys(counts).length),
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
                    labels: { padding: 12, usePointStyle: true }
                }
            }
        }
    });
}

function renderProblemsChart(responses) {
    var counts = countOption(responses, "Current Laptop Problems");
    var ctx = document.getElementById("problemsChart").getContext("2d");

    new Chart(ctx, {
        type: "bar",
        data: {
            labels: Object.keys(counts),
            datasets: [{
                label: "Responses",
                data: Object.values(counts),
                backgroundColor: ["#ef4444", "#f59e0b", "#fbbf24", "#60a5fa", "#16a34a"],
                borderRadius: 8,
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                y: { beginAtZero: true, ticks: { stepSize: 1 } },
                x: { grid: { display: false } }
            }
        }
    });
}

// =======================================
// Initialize - Fetch data from Google Sheets
// =======================================

// Show loading message
var loadingDiv = document.createElement("div");
loadingDiv.id = "loadingMessage";
loadingDiv.innerHTML = '<h2 style="text-align:center; color:#60a5fa;">Loading data from Google Sheets...</h2>';
document.querySelector(".dashboard-container").appendChild(loadingDiv);

fetchSurveyData().then(function(responses) {
    renderDashboard(responses);
});

// Refresh button
document.getElementById("refreshBtn").addEventListener("click", function() {
    // Destroy existing charts
    Chart.helpers.each(Chart.instances, function(instance) {
        instance.destroy();
    });

    // Show loading
    var loadingEl = document.getElementById("loadingMessage");
    if (loadingEl) loadingEl.style.display = "block";

    fetchSurveyData().then(function(responses) {
        renderDashboard(responses);
    });
});
