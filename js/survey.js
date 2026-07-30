// ===============================
// Laptop Market Research Survey
// With Google Sheets Integration
// ===============================

// Google Apps Script Web App URL
const GOOGLE_SHEETS_URL = "https://script.google.com/macros/s/AKfycbzyOxvR2YzfOMxc5PKJXHtwunslbu7W77CfPNL2zibI_LjX5GcCxi4u_s40wlHTLbMqKQ/exec";

// =======================================
// Question Data
// (Options match the "List" sheet dropdowns)
// =======================================

// Question 1
const firstQuestion = {
    question: "Do you have a laptop?",
    column: "Laptop Ownership",
    options: [
        "Yes",
        "No"
    ]
};

// Questions for Laptop Owners (If Answer = Yes)
const ownerQuestions = [
    {
        question: "What do you mainly use your laptop for?",
        column: "Usage Purpose",
        options: ["Study", "Gaming", "Office Work", "Video Editing/Streaming", "Coding/Software Development"]
    },
    {
        question: "What do you find most useful in your current laptop?",
        column: "Useful Features",
        options: ["Performance", "Battery Life", "Storage", "Build Quality", "Portability"]
    },
    {
        question: "What problem do you face most often with your current laptop?",
        column: "Current Laptop Problems",
        options: ["Slow Performance", "Battery Issue", "Heating Problem", "Storage Shortage", "No Major Problem"]
    },
    {
        question: "How satisfied are you with your current laptop?",
        column: "Satisfaction Level",
        options: ["Very Satisfied", "Satisfied", "Neutral", "Dissatisfied", "Very Dissatisfied"]
    },
    {
        question: "Which feature would you like to improve the most?",
        column: "Improvement Needed",
        options: ["Processor", "RAM", "Graphics", "Battery", "Display"]
    },
    {
        question: "How often do you upgrade or replace your laptop?",
        column: "Upgrade Frequency",
        options: ["Every 1\u20132 Years", "Every 3\u20134 Years", "Every 4+ Years", "Only When Necessary"]
    },
    {
        question: "Which laptop brand do you currently use?",
        column: "Preferred Brand",
        options: ["HP", "Dell", "Lenovo", "ASUS", "Apple", "Acer"]
    },
    {
        question: "What is the most important factor when buying a laptop?",
        column: "Buying Pattern",
        options: ["Price", "Performance", "Battery Life", "Brand", "Design"]
    },
    {
        question: "Would you recommend your current laptop to others?",
        column: "Recommended Laptop",
        options: ["Yes", "Maybe", "No"]
    }
];

// Questions for Non-Owners (If Answer = No)
const buyerQuestions = [
    {
        question: "Why do you want to buy a laptop?",
        column: "Usage Purpose",
        options: ["Study", "Gaming", "Office Work", "Video Editing/Streaming", "Coding/Software Development"]
    },
    {
        question: "Which type of laptop would you prefer?",
        column: "Preferred Laptop",
        options: ["Student Laptop", "Gaming Laptop", "Business Laptop", "Budget Laptop", "Premium Laptop"]
    },
    {
        question: "What is your expected budget?",
        column: "Budget",
        options: ["Below \u20b930,000", "\u20b930,000\u2013\u20b950,000", "\u20b950,000\u2013\u20b980,000", "Above \u20b980,000"]
    },
    {
        question: "Which feature is most important to you?",
        column: "Useful Features",
        options: ["Performance", "Battery Life", "Storage", "Build Quality", "Portability"]
    },
    {
        question: "Which screen size do you prefer?",
        column: "Screen Size",
        options: ["13\u201314 Inch", "15\u201316 Inch", "17 Inch or Larger"]
    },
    {
        question: "Which laptop brand would you prefer?",
        column: "Preferred Brand",
        options: ["HP", "Dell", "Lenovo", "ASUS", "Apple", "Acer"]
    },
    {
        question: "How long do you expect your laptop to last?",
        column: "Expected Laptop Life",
        options: ["1\u20132 Years", "3\u20135 Years", "More Than 5 Years"]
    },
    {
        question: "Where would you prefer to buy a laptop?",
        column: "Buying Place",
        options: ["Online", "Offline Store", "Brand Store", "Secondhand Market"]
    },
    {
        question: "What will influence your final buying decision the most?",
        column: "Final Decision Factor",
        options: ["Price", "Reviews", "Specifications", "Brand Reputation", "User Recommendations"]
    }
];

// =======================================
// Survey Variables
// =======================================

let currentQuestion = 0;
let surveyQuestions = [];
let answers = {};
let questionBranchLoaded = false;
let userName = "";
let userEmail = "";

const questionElement = document.getElementById("question");
const optionsElement = document.getElementById("options");
const progressBar = document.getElementById("progressBar");
const progressText = document.getElementById("progressText");
const previousButton = document.getElementById("previousBtn");
const nextButton = document.getElementById("nextBtn");
const submitButton = document.getElementById("submitBtn");

// =======================================
// Access Check
// =======================================

// Check if user is approved before showing survey
(function checkUserAccess() {
    const savedEmail = localStorage.getItem("approvedEmail");
    const savedName = localStorage.getItem("approvedName");

    if (savedEmail && savedName) {
        userName = savedName;
        userEmail = savedEmail;
        startSurvey();
        return;
    }

    // Show email check screen
    const surveyCard = document.querySelector(".survey-card");
    surveyCard.innerHTML = `
        <h1 style="text-align:center; margin-bottom:15px;">Survey Access</h1>
        <p style="text-align:center; color:#cbd5e1; margin-bottom:25px;">
            Enter your email to check if you have been approved to take the survey.
        </p>
        <div style="max-width:400px; margin:0 auto;">
            <input type="email" id="checkEmail" placeholder="Enter your email address"
                style="width:100%; padding:14px 18px; border-radius:10px; border:1px solid #334155; background:#1e293b; color:#f1f5f9; font-size:16px; margin-bottom:15px; box-sizing:border-box;">
            <button id="checkAccessBtn" onclick="checkAccessFromSheet()"
                style="width:100%; padding:14px; background:#2563eb; color:#fff; border:none; border-radius:10px; font-size:16px; font-weight:600; cursor:pointer;">
                Check Access
            </button>
            <p id="accessMessage" style="text-align:center; margin-top:15px; color:#fbbf24; display:none;"></p>
            <div style="text-align:center; margin-top:20px;">
                <a href="request.html" style="color:#60a5fa; text-decoration:underline;">Don't have access? Request here</a>
            </div>
        </div>
    `;
})();

// Check access from Google Sheets
function checkAccessFromSheet() {
    const email = document.getElementById("checkEmail").value.trim();
    const messageEl = document.getElementById("accessMessage");

    if (!email) {
        messageEl.textContent = "Please enter your email address.";
        messageEl.style.display = "block";
        messageEl.style.color = "#ef4444";
        return;
    }

    messageEl.textContent = "Checking access...";
    messageEl.style.display = "block";
    messageEl.style.color = "#60a5fa";

    fetch(GOOGLE_SHEETS_URL + "?action=checkAccess&email=" + encodeURIComponent(email))
        .then(function(response) { return response.json(); })
        .then(function(data) {
            if (data.status === "found" && data.accessStatus === "Accepted") {
                userName = data.name || "";
                userEmail = email;
                localStorage.setItem("approvedEmail", email);
                localStorage.setItem("approvedName", userName);
                messageEl.textContent = "Access granted! Starting survey...";
                messageEl.style.color = "#16a34a";
                setTimeout(function() { startSurvey(); }, 1000);
            } else if (data.status === "found" && data.accessStatus === "Pending") {
                messageEl.textContent = "Your request is still pending. Please wait for approval.";
                messageEl.style.color = "#fbbf24";
            } else if (data.status === "found" && data.accessStatus === "Rejected") {
                messageEl.textContent = "Your access request has been rejected.";
                messageEl.style.color = "#ef4444";
            } else {
                messageEl.textContent = "Email not found. Please request access first.";
                messageEl.style.color = "#ef4444";
            }
        })
        .catch(function(error) {
            console.error("Error checking access:", error);
            messageEl.textContent = "Error checking access. Please try again.";
            messageEl.style.color = "#ef4444";
        });
}

// Make checkAccessFromSheet available globally
window.checkAccessFromSheet = checkAccessFromSheet;

// =======================================
// Start Survey
// =======================================

function startSurvey() {
    const surveyCard = document.querySelector(".survey-card");

    // Rebuild the survey UI
    surveyCard.innerHTML = `
        <h1>Laptop Market Research Survey</h1>
        <p>Please answer the following questions honestly.</p>
        <div class="progress">
            <div class="progress-bar" id="progressBar"></div>
        </div>
        <div id="progressText">Question 1 of 10</div>
        <div class="question-area">
            <h2 id="question">Loading...</h2>
            <div id="options"></div>
        </div>
        <div class="buttons">
            <button id="previousBtn">Previous</button>
            <button id="nextBtn">Next</button>
            <button id="submitBtn">Submit Survey</button>
        </div>
    `;

    // Re-grab DOM elements
    var q = document.getElementById("question");
    var o = document.getElementById("options");
    var pb = document.getElementById("progressBar");
    var pt = document.getElementById("progressText");
    var prev = document.getElementById("previousBtn");
    var next = document.getElementById("nextBtn");
    var sub = document.getElementById("submitBtn");

    // Update global references
    window._surveyEls = { q, o, pb, pt, prev, next, sub };

    surveyQuestions.push(firstQuestion);
    loadQuestionDynamic();

    // Re-attach event listeners
    next.addEventListener("click", handleNext);
    prev.addEventListener("click", handlePrevious);
    sub.addEventListener("click", handleSubmit);
}

// =======================================
// Dynamic Question Loading (after access check)
// =======================================

function getSurveyElements() {
    if (window._surveyEls) return window._surveyEls;
    return {
        q: document.getElementById("question"),
        o: document.getElementById("options"),
        pb: document.getElementById("progressBar"),
        pt: document.getElementById("progressText"),
        prev: document.getElementById("previousBtn"),
        next: document.getElementById("nextBtn"),
        sub: document.getElementById("submitBtn")
    };
}

function loadQuestionDynamic() {
    var els = getSurveyElements();
    els.q.textContent = surveyQuestions[currentQuestion].question;
    els.o.innerHTML = "";

    surveyQuestions[currentQuestion].options.forEach(function(option) {
        const label = document.createElement("label");
        label.className = "option";
        label.innerHTML = `
            <input type="radio" name="answer" value="${option}">
            ${option}
        `;

        // Restore previously selected answer
        var col = surveyQuestions[currentQuestion].column;
        if (answers[col] === option) {
            label.querySelector("input").checked = true;
        }

        els.o.appendChild(label);
    });

    updateProgressDynamic();
    updateButtonsDynamic();
}

function updateProgressDynamic() {
    var els = getSurveyElements();
    var totalQuestions = (currentQuestion === 0 && !questionBranchLoaded)
        ? 10
        : surveyQuestions.length;

    els.pt.textContent = "Question " + (currentQuestion + 1) + " of " + totalQuestions;
    els.pb.style.width = ((currentQuestion + 1) / totalQuestions) * 100 + "%";
}

function updateButtonsDynamic() {
    var els = getSurveyElements();
    els.prev.style.display = currentQuestion === 0 ? "none" : "inline-block";

    if (currentQuestion === 0) {
        els.next.style.display = "inline-block";
        els.sub.style.display = "none";
    } else if (currentQuestion === surveyQuestions.length - 1) {
        els.next.style.display = "none";
        els.sub.style.display = "inline-block";
    } else {
        els.next.style.display = "inline-block";
        els.sub.style.display = "none";
    }
}

function getSelectedAnswerDynamic() {
    var selected = document.querySelector('input[name="answer"]:checked');
    return selected ? selected.value : null;
}

function loadQuestionBranch(answer) {
    if (questionBranchLoaded) return;
    questionBranchLoaded = true;

    if (answer === "Yes") {
        ownerQuestions.forEach(function(q) { surveyQuestions.push(q); });
    } else if (answer === "No") {
        buyerQuestions.forEach(function(q) { surveyQuestions.push(q); });
    }
}

function handleNext() {
    var selected = getSelectedAnswerDynamic();
    if (!selected) {
        alert("Please select an answer before proceeding.");
        return;
    }

    // Save answer with column name as key
    answers[surveyQuestions[currentQuestion].column] = selected;

    // If on the first question, load branch questions
    if (currentQuestion === 0) {
        loadQuestionBranch(selected);
    }

    currentQuestion++;
    loadQuestionDynamic();
}

function handlePrevious() {
    if (currentQuestion > 0) {
        var selected = getSelectedAnswerDynamic();
        if (selected) {
            answers[surveyQuestions[currentQuestion].column] = selected;
        }
        currentQuestion--;
        loadQuestionDynamic();
    }
}

function handleSubmit() {
    var selected = getSelectedAnswerDynamic();
    if (!selected) {
        alert("Please select an answer before submitting.");
        return;
    }

    // Save last answer
    answers[surveyQuestions[currentQuestion].column] = selected;

    // Build response data with column names
    var responseData = {
        action: "surveyResponse",
        name: userName,
        email: userEmail
    };

    // Add all answers using column names
    surveyQuestions.forEach(function(q) {
        responseData[q.column] = answers[q.column] || "";
    });

    // Fill empty columns for the other branch
    var allColumns = [
        "Laptop Ownership", "Usage Purpose", "Useful Features",
        "Current Laptop Problems", "Satisfaction Level", "Improvement Needed",
        "Upgrade Frequency", "Preferred Brand", "Buying Pattern",
        "Recommended Laptop", "Preferred Laptop", "Budget",
        "Screen Size", "Expected Laptop Life", "Buying Place", "Final Decision Factor"
    ];

    allColumns.forEach(function(col) {
        if (!responseData[col]) {
            responseData[col] = "";
        }
    });

    console.log("Survey Submitted");
    console.table(responseData);

    // Store locally
    localStorage.setItem("surveyData", JSON.stringify(responseData));

    // Send to Google Sheets
    sendToGoogleSheets(responseData);

    // Show thank you message
    var surveyCard = document.querySelector(".survey-card");
    surveyCard.innerHTML = `
        <h1 style="text-align:center; margin-bottom:15px;">Thank You!</h1>
        <p style="text-align:center; color:#cbd5e1; margin-bottom:25px;">
            Your survey responses have been recorded successfully.
            We appreciate your participation in the Laptop Market Research.
        </p>
        <div style="text-align:center; display:flex; justify-content:center; gap:12px; flex-wrap:wrap;">
            <a href="dashboard.html" style="display:inline-block; padding:14px 28px; background:#16a34a; color:#fff; border-radius:10px; text-decoration:none; font-weight:600;">
                View Dashboard
            </a>
            <a href="index.html" style="display:inline-block; padding:14px 28px; background:#2563eb; color:#fff; border-radius:10px; text-decoration:none; font-weight:600;">
                Back to Home
            </a>
        </div>
    `;
}

// =======================================
// Google Sheets Integration
// =======================================

function sendToGoogleSheets(data) {
    if (GOOGLE_SHEETS_URL === "YOUR_GOOGLE_APPS_SCRIPT_URL_HERE") {
        console.log("Google Sheets URL not configured. Data saved locally only.");
        return;
    }

    fetch(GOOGLE_SHEETS_URL, {
        method: "POST",
        mode: "no-cors",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify(data)
    })
    .then(function() {
        console.log("Survey data sent to Google Sheets successfully.");
    })
    .catch(function(error) {
        console.error("Error sending data to Google Sheets:", error);
        console.log("Data is saved locally and can be synced later.");
    });
}
