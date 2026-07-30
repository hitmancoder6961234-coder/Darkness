// ===============================
// Laptop Market Research
// Dashboard Analytics
// ===============================

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
// Data Collection
// =======================================

function getAllResponses()
{
    const responses = [];

    // Get data from localStorage
    for (let i = 0; i < localStorage.length; i++)
    {
        const key = localStorage.key(i);

        if (key === "surveyData" || key.startsWith("surveyData_"))
        {
            try
            {
                const data = JSON.parse(localStorage.getItem(key));
                responses.push(data);
            }
            catch (e)
            {
                console.error("Error parsing survey data:", e);
            }
        }
    }

    // Also check for requestData
    try
    {
        const requestData = JSON.parse(localStorage.getItem("requestData") || "null");
        if (requestData)
        {
            // This is request form data, not survey data
        }
    }
    catch (e) {}

    return responses;
}

function countOption(responses, questionKey)
{
    const counts = {};

    responses.forEach(function(resp)
    {
        const answer = resp[questionKey];
        if (answer && answer !== "Not Answered")
        {
            counts[answer] = (counts[answer] || 0) + 1;
        }
    });

    return counts;
}

// =======================================
// Render Dashboard
// =======================================

function renderDashboard()
{
    const responses = getAllResponses();

    const noDataMessage = document.getElementById("noDataMessage");
    const chartsGrid = document.querySelector(".charts-grid");
    const statsGrid = document.querySelector(".stats-grid");

    if (responses.length === 0)
    {
        noDataMessage.style.display = "block";
        chartsGrid.style.display = "none";
        statsGrid.style.display = "none";
        return;
    }

    noDataMessage.style.display = "none";
    chartsGrid.style.display = "grid";
    statsGrid.style.display = "grid";

    // Calculate stats
    let ownerCount = 0;
    let buyerCount = 0;

    responses.forEach(function(resp)
    {
        if (resp.Q1 === "Yes") ownerCount++;
        else if (resp.Q1 === "No") buyerCount++;
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

function renderOwnershipChart(responses)
{
    const counts = countOption(responses, "Q1");
    const ctx = document.getElementById("ownershipChart").getContext("2d");

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

function renderUsageChart(responses)
{
    // Q2 for owners: "What do you mainly use your laptop for?"
    // Q2 for buyers: "Why do you want to buy a laptop?"
    const counts = countOption(responses, "Q2");
    const ctx = document.getElementById("usageChart").getContext("2d");

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
                y: {
                    beginAtZero: true,
                    ticks: { stepSize: 1 }
                },
                x: {
                    grid: { display: false }
                }
            }
        }
    });
}

function renderBrandChart(responses)
{
    // Q7 for owners: "Which laptop brand do you currently use?"
    // Q6 for buyers: "Which laptop brand would you prefer?"
    // Try both keys
    let counts = countOption(responses, "Q7");
    if (Object.keys(counts).length === 0)
    {
        counts = countOption(responses, "Q6");
    }
    const ctx = document.getElementById("brandChart").getContext("2d");

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
                x: {
                    beginAtZero: true,
                    ticks: { stepSize: 1 }
                },
                y: {
                    grid: { display: false }
                }
            }
        }
    });
}

function renderFeatureChart(responses)
{
    // Q5 for owners: "Which feature would you like to improve the most?"
    // Q4 for buyers: "Which feature is most important to you?"
    let counts = countOption(responses, "Q5");
    if (Object.keys(counts).length === 0)
    {
        counts = countOption(responses, "Q4");
    }
    const ctx = document.getElementById("featureChart").getContext("2d");

    new Chart(ctx, {
        type: "polarArea",
        data: {
            labels: Object.keys(counts),
            datasets: [{
                data: Object.values(counts),
                backgroundColor: COLORS.slice(0, Object.keys(counts).length).map(function(c)
                {
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

function renderSatisfactionChart(responses)
{
    // Q4 for owners: "How satisfied are you with your current laptop?"
    const counts = countOption(responses, "Q4");
    const ctx = document.getElementById("satisfactionChart").getContext("2d");

    const order = ["Very Satisfied", "Satisfied", "Neutral", "Dissatisfied", "Very Dissatisfied"];
    const labels = order.filter(function(k) { return counts[k]; });
    const data = labels.map(function(k) { return counts[k]; });
    const satColors = ["#16a34a", "#22c55e", "#fbbf24", "#f59e0b", "#ef4444"];

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

function renderBudgetChart(responses)
{
    // Q3 for buyers: "What is your expected budget?"
    const counts = countOption(responses, "Q3");
    const ctx = document.getElementById("budgetChart").getContext("2d");

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
                y: {
                    beginAtZero: true,
                    ticks: { stepSize: 1 }
                },
                x: {
                    grid: { display: false }
                }
            }
        }
    });
}

function renderDecisionChart(responses)
{
    // Q9 for owners: "Would you recommend your current laptop to others?"
    // Q9 for buyers: "What will influence your final buying decision the most?"
    let counts = countOption(responses, "Q9");
    if (Object.keys(counts).length === 0)
    {
        counts = countOption(responses, "Q8");
    }
    const ctx = document.getElementById("decisionChart").getContext("2d");

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

function renderProblemsChart(responses)
{
    // Q3 for owners: "What problem do you face most often?"
    const counts = countOption(responses, "Q3");
    const ctx = document.getElementById("problemsChart").getContext("2d");

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
                y: {
                    beginAtZero: true,
                    ticks: { stepSize: 1 }
                },
                x: {
                    grid: { display: false }
                }
            }
        }
    });
}

// =======================================
// Initialize
// =======================================

renderDashboard();

// Refresh button
document.getElementById("refreshBtn").addEventListener("click", function()
{
    // Destroy existing charts
    Chart.helpers.each(Chart.instances, function(instance)
    {
        instance.destroy();
    });

    renderDashboard();
});
