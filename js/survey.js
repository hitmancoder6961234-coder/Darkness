// ===============================
// Laptop Market Research Survey
// With Google Sheets Integration
// ===============================

// Google Apps Script Web App URL
const GOOGLE_SHEETS_URL = "https://script.google.com/macros/s/AKfycbwJ5soKVfm0gSxcEN23O1ebaevnlKS7EkOCEPe_z-FQqMU45bvLIdZ46vzCVjDs-AhHng/exec";

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

// =======================================
// Access Check (runs on page load)
// =======================================

(function checkUserAccess() {
    var surveyCard = document.getElementById("surveyCard");

    // Check if already approved (from previous session)
    var savedEmail = localStorage.getItem("approvedEmail");
    var savedName = localStorage.getItem("approvedName");

    if (savedEmail && savedName) {
        userName = savedName;
        userEmail = savedEmail;
        startSurvey();
        return;
    }

    // Check for pending email from request form
    var pendingEmail = localStorage.getItem("pendingEmail") || "";
    var pendingName = localStorage.getItem("pendingName") || "";

    // Show email check screen
    surveyCard.innerHTML = '<h1 style="text-align:center; margin-bottom:15px;">Survey Access</h1>' +
        '<p style="text-align:center; color:#cbd5e1; margin-bottom:25px;">Enter your email to check if you have been approved to take the survey.</p>' +
        '<div style="max-width:400px; margin:0 auto;">' +
        '<input type="email" id="checkEmail" placeholder="Enter your email address" value="' + pendingEmail + '" ' +
        'style="width:100%; padding:14px 18px; border-radius:10px; border:1px solid #334155; background:#1e293b; color:#f1f5f9; font-size:16px; margin-bottom:15px; box-sizing:border-box;">' +
        '<button id="checkAccessBtn" onclick="checkAccessFromSheet()" ' +
        'style="width:100%; padding:14px; background:#2563eb; color:#fff; border:none; border-radius:10px; font-size:16px; font-weight:600; cursor:pointer;">' +
        'Check Access</button>' +
        '<p id="accessMessage" style="text-align:center; margin-top:15px; color:#fbbf24; display:none;"></p>' +
        '<div style="text-align:center; margin-top:20px;">' +
        '<a href="request.html" style="color:#60a5fa; text-decoration:underline;">Don\'t have access? Request here</a>' +
        '</div></div>';

    // Auto-check if there's a pending email from request form
    if (pendingEmail) {
        setTimeout(function() { checkAccessFromSheet(); }, 500);
    }
})();

// Check access from Google Sheets
function checkAccessFromSheet() {
    var email = document.getElementById("checkEmail").value.trim();
    var messageEl = document.getElementById("accessMessage");

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
                messageEl.textContent = "Your request is still pending. Please wait for admin approval.";
                messageEl.style.color = "#fbbf24";
            } else if (data.status === "found" && data.accessStatus === "Rejected") {
                messageEl.textContent = "Your access request has been rejected.";
                messageEl.style.color = "#ef4444";
            } else if (data.status === "exists") {
                messageEl.textContent = "Your request status: " + (data.accessStatus || "Pending") + ". Please wait for admin approval.";
                messageEl.style.color = "#fbbf24";
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

// Make it globally accessible for onclick
window.checkAccessFromSheet = checkAccessFromSheet;

// =======================================
// Start Survey (after access confirmed)
// =======================================

function startSurvey() {
    var surveyCard = document.getElementById("surveyCard");

    // Build the survey UI
    surveyCard.innerHTML =
        '<h1>Laptop Market Research Survey</h1>' +
        '<p>Please answer the following questions honestly.</p>' +
        '<div class="progress"><div class="progress-bar" id="progressBar"></div></div>' +
        '<div id="progressText">Question 1 of 10</div>' +
        '<div class="question-area"><h2 id="question">Loading...</h2><div id="options"></div></div>' +
        '<div class="buttons">' +
        '<button id="previousBtn">Previous</button>' +
        '<button id="nextBtn">Next</button>' +
        '<button id="submitBtn">Submit Survey</button>' +
        '</div>';

    surveyQuestions.push(firstQuestion);
    loadQuestion();

    // Attach event listeners
    document.getElementById("nextBtn").addEventListener("click", handleNext);
    document.getElementById("previousBtn").addEventListener("click", handlePrevious);
    document.getElementById("submitBtn").addEventListener("click", handleSubmit);
}

// =======================================
// Question Loading
// =======================================

function loadQuestion() {
    var questionEl = document.getElementById("question");
    var optionsEl = document.getElementById("options");
    var progressBarEl = document.getElementById("progressBar");
    var progressTextEl = document.getElementById("progressText");

    questionEl.textContent = surveyQuestions[currentQuestion].question;
    optionsEl.innerHTML = "";

    surveyQuestions[currentQuestion].options.forEach(function(option) {
        var label = document.createElement("label");
        label.className = "option";
        label.innerHTML = '<input type="radio" name="answer" value="' + option + '">' + option;

        // Restore previously selected answer
        var col = surveyQuestions[currentQuestion].column;
        if (answers[col] === option) {
            label.querySelector("input").checked = true;
        }

        optionsEl.appendChild(label);
    });

    // Update progress
    var totalQuestions = (currentQuestion === 0 && !questionBranchLoaded) ? 10 : surveyQuestions.length;
    progressTextEl.textContent = "Question " + (currentQuestion + 1) + " of " + totalQuestions;
    progressBarEl.style.width = ((currentQuestion + 1) / totalQuestions) * 100 + "%";

    // Update buttons
    var prevBtn = document.getElementById("previousBtn");
    var nextBtn = document.getElementById("nextBtn");
    var subBtn = document.getElementById("submitBtn");

    prevBtn.style.display = currentQuestion === 0 ? "none" : "inline-block";

    if (currentQuestion === 0) {
        nextBtn.style.display = "inline-block";
        subBtn.style.display = "none";
    } else if (currentQuestion === surveyQuestions.length - 1) {
        nextBtn.style.display = "none";
        subBtn.style.display = "inline-block";
    } else {
        nextBtn.style.display = "inline-block";
        subBtn.style.display = "none";
    }
}

function getSelectedAnswer() {
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

// =======================================
// Button Handlers
// =======================================

function handleNext() {
    var selected = getSelectedAnswer();
    if (!selected) {
        alert("Please select an answer before proceeding.");
        return;
    }

    answers[surveyQuestions[currentQuestion].column] = selected;

    if (currentQuestion === 0) {
        loadQuestionBranch(selected);
    }

    currentQuestion++;
    loadQuestion();
}

function handlePrevious() {
    if (currentQuestion > 0) {
        var selected = getSelectedAnswer();
        if (selected) {
            answers[surveyQuestions[currentQuestion].column] = selected;
        }
        currentQuestion--;
        loadQuestion();
    }
}

function handleSubmit() {
    var selected = getSelectedAnswer();
    if (!selected) {
        alert("Please select an answer before submitting.");
        return;
    }

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
    var surveyCard = document.getElementById("surveyCard");
    surveyCard.innerHTML =
        '<h1 style="text-align:center; margin-bottom:15px;">Thank You!</h1>' +
        '<p style="text-align:center; color:#cbd5e1; margin-bottom:25px;">Your survey responses have been recorded successfully. We appreciate your participation in the Laptop Market Research.</p>' +
        '<div style="text-align:center; display:flex; justify-content:center; gap:12px; flex-wrap:wrap;">' +
        '<a href="dashboard.html" style="display:inline-block; padding:14px 28px; background:#16a34a; color:#fff; border-radius:10px; text-decoration:none; font-weight:600;">View Dashboard</a>' +
        '<a href="index.html" style="display:inline-block; padding:14px 28px; background:#2563eb; color:#fff; border-radius:10px; text-decoration:none; font-weight:600;">Back to Home</a>' +
        '</div>';
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
