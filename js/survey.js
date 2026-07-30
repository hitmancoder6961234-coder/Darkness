// ===============================
// Laptop Market Research
// Unified Sign-In Flow + Survey
// ===============================

const GOOGLE_SHEETS_URL = "https://script.google.com/macros/s/AKfycbxaSHCsuBMp1XiUL0Gnu2iZo4Ab6ITHTLRUNTFaEW94fQ__A9CdfXsOqztCAd6eMabADA/exec";

// =======================================
// Screen Navigation
// =======================================

function hideAllScreens() {
    var screens = ["signInChoice", "signInNew", "signInAlready", "surveyArea", "thankYou"];
    screens.forEach(function(id) {
        document.getElementById(id).style.display = "none";
    });
}

function showScreen(id) {
    hideAllScreens();
    document.getElementById(id).style.display = "block";
}

function showSignInChoice() {
    showScreen("signInChoice");
}

function showSignInNew() {
    showScreen("signInNew");
    document.getElementById("newRequestMsg").style.display = "none";
}

function showSignInAlready() {
    showScreen("signInAlready");
    document.getElementById("existingStatusMsg").style.display = "none";
}

// =======================================
// SIGN IN AS NEW - Submit Access Request
// =======================================

function submitNewRequest() {
    var name = document.getElementById("newName").value.trim();
    var email = document.getElementById("newEmail").value.trim();
    var mobile = document.getElementById("newMobile").value.trim();
    var purpose = document.getElementById("newPurpose").value.trim();
    var msgEl = document.getElementById("newRequestMsg");

    // Validation
    if (!name) {
        showStatus(msgEl, "error", "Please enter your name.");
        return;
    }
    if (!email || !isValidEmail(email)) {
        showStatus(msgEl, "error", "Please enter a valid email address.");
        return;
    }
    if (!mobile) {
        showStatus(msgEl, "error", "Please enter your mobile number.");
        return;
    }

    // Save to localStorage for later use
    localStorage.setItem("pendingEmail", email);
    localStorage.setItem("pendingName", name);
    localStorage.setItem("pendingMobile", mobile);

    showStatus(msgEl, "info", "Submitting your request...");

    var data = {
        action: "accessRequest",
        name: name,
        email: email,
        mobile: mobile,
        purpose: purpose
    };

    sendToGoogleSheets(data, function() {
        showStatus(msgEl, "success",
            "Your request has been submitted! Status: <strong>Pending</strong>.<br>" +
            "You will receive an email once your request is approved.<br>" +
            "You can come back anytime and use <strong>\"Sign in Already\"</strong> to check your status."
        );
    }, function() {
        showStatus(msgEl, "error",
            "There was an error submitting your request. Please try again."
        );
    });
}

// =======================================
// SIGN IN ALREADY - Check Access Status
// =======================================

function checkExistingAccess() {
    var email = document.getElementById("existingEmail").value.trim();
    var msgEl = document.getElementById("existingStatusMsg");

    if (!email || !isValidEmail(email)) {
        showStatus(msgEl, "error", "Please enter a valid email address.");
        return;
    }

    showStatus(msgEl, "info", "Checking your access status...");

    checkAccessFromSheet(email, function(status) {
        if (status === "Accepted") {
            // Save approved email
            localStorage.setItem("approvedEmail", email);
            showStatus(msgEl, "success",
                "Your access has been <strong>Approved</strong>! Starting survey..."
            );
            setTimeout(function() {
                startSurvey(email);
            }, 1200);
        } else if (status === "Pending") {
            showStatus(msgEl, "warning",
                "Your request is currently <strong>Pending</strong>.<br>" +
                "Please wait for admin approval. You will receive an email once approved."
            );
        } else {
            showStatus(msgEl, "error",
                "No request found for this email.<br>" +
                "Please <strong>\"Sign in as New\"</strong> to submit an access request first."
            );
        }
    }, function() {
        showStatus(msgEl, "error", "Could not check your status. Please try again.");
    });
}

// =======================================
// Access Check from Google Sheets
// =======================================

function checkAccessFromSheet(email, onSuccess, onError) {
    var url = GOOGLE_SHEETS_URL + "?action=checkAccess&email=" + encodeURIComponent(email);

    fetch(url)
        .then(function(response) { return response.json(); })
        .then(function(data) {
            console.log("checkAccess response:", data);
            if (!data) {
                onSuccess("Not Found");
                return;
            }

            // Handle multiple response formats from different Apps Script versions:
            // Format 1: {"status": "Accepted"} or {"status": "Pending"} or {"status": "Not Found"}
            // Format 2: {"status": "found", "accessStatus": "Accepted"} or {"status": "not found"}
            // Format 3: {"status": "exists", "currentStatus": "Accepted"}

            var accessStatus = "";

            if (data.accessStatus) {
                // Format 2: status="found", accessStatus="Accepted"/"Pending"/"Rejected"
                accessStatus = data.accessStatus;
            } else if (data.currentStatus) {
                // Format 3: status="exists", currentStatus="Accepted"/"Pending"
                accessStatus = data.currentStatus;
            } else if (data.status === "found" || data.status === "exists") {
                // If status is "found" but no accessStatus field, try to get it
                accessStatus = "Unknown";
            } else if (data.status === "Not Found" || data.status === "not found") {
                accessStatus = "Not Found";
            } else {
                // Format 1: status directly contains the access status
                accessStatus = data.status;
            }

            // Also save the name if provided
            if (data.name) {
                localStorage.setItem("approvedName", data.name);
            }

            onSuccess(accessStatus);
        })
        .catch(function(error) {
            console.error("Access check error:", error);
            onError(error);
        });
}

// =======================================
// Auto-Check from URL Parameter
// =======================================

(function autoCheckFromURL() {
    var params = new URLSearchParams(window.location.search);
    var emailParam = params.get("email");

    if (emailParam && isValidEmail(emailParam)) {
        // Auto-fill the existing email field
        document.getElementById("existingEmail").value = emailParam;

        // Show "Sign in Already" screen and auto-check
        showSignInAlready();
        showStatus(document.getElementById("existingStatusMsg"), "info",
            "Checking your access for <strong>" + emailParam + "</strong>..."
        );

        checkAccessFromSheet(emailParam, function(status) {
            var msgEl = document.getElementById("existingStatusMsg");
            if (status === "Accepted") {
                localStorage.setItem("approvedEmail", emailParam);
                showStatus(msgEl, "success",
                    "Your access has been <strong>Approved</strong>! Starting survey..."
                );
                setTimeout(function() {
                    startSurvey(emailParam);
                }, 800);
            } else if (status === "Pending") {
                showStatus(msgEl, "warning",
                    "Your request is currently <strong>Pending</strong>.<br>" +
                    "Please wait for admin approval. You will receive an email once approved."
                );
            } else {
                showStatus(msgEl, "error",
                    "No approved request found for this email.<br>" +
                    "Please <strong>\"Sign in as New\"</strong> to submit an access request."
                );
                // Show the choice screen after a moment
                setTimeout(function() {
                    showSignInChoice();
                }, 2000);
            }
        }, function() {
            showStatus(document.getElementById("existingStatusMsg"), "error",
                "Could not verify your access. Please try again."
            );
        });
    } else {
        // Check localStorage for previously approved email
        var savedEmail = localStorage.getItem("approvedEmail");
        if (savedEmail) {
            // Auto-fill and show the sign-in already screen
            document.getElementById("existingEmail").value = savedEmail;
        }
        showSignInChoice();
    }
})();

// =======================================
// Survey Data & Logic
// =======================================

var currentQuestion = 0;
var answers = {};
var userEmail = "";
var questions = [];

function buildQuestions() {
    return [
        {
            id: "ownership",
            text: "Do you currently own a laptop?",
            column: "Laptop Ownership",
            options: ["Yes", "No"],
            type: "radio"
        },
        // ===== OWNER BRANCH (Q2-Q6) =====
        {
            id: "usage",
            text: "What is your primary usage purpose?",
            column: "Usage Purpose",
            options: ["Study", "Work", "Gaming", "Content Creation", "General Use"],
            type: "radio",
            showIf: { ownership: "Yes" }
        },
        {
            id: "brand",
            text: "Which brand is your current laptop?",
            column: "Preferred Brand",
            options: ["HP", "Dell", "Lenovo", "Asus", "Acer", "Apple", "Other"],
            type: "radio",
            showIf: { ownership: "Yes" }
        },
        {
            id: "satisfaction",
            text: "How satisfied are you with your current laptop?",
            column: "Satisfaction Level",
            options: ["Very Satisfied", "Satisfied", "Neutral", "Dissatisfied", "Very Dissatisfied"],
            type: "radio",
            showIf: { ownership: "Yes" }
        },
        {
            id: "problems",
            text: "What problems do you face with your current laptop?",
            column: "Current Laptop Problems",
            options: ["Battery Life", "Heating Problem", "Slow Performance", "Display Issues", "None"],
            type: "radio",
            showIf: { ownership: "Yes" }
        },
        {
            id: "feature",
            text: "Which feature do you find most useful in your laptop?",
            column: "Useful Features",
            options: ["Battery Life", "Display Quality", "Keyboard Comfort", "Performance", "Portability"],
            type: "radio",
            showIf: { ownership: "Yes" }
        },
        // ===== BUYER BRANCH (Q2-Q6) =====
        {
            id: "budget",
            text: "What is your budget for a new laptop?",
            column: "Budget",
            options: ["Under \u20B930,000", "\u20B930,000 \u2013 \u20B950,000", "\u20B950,000 \u2013 \u20B980,000", "Above \u20B980,000"],
            type: "radio",
            showIf: { ownership: "No" }
        },
        {
            id: "brandBuyer",
            text: "Which brand would you prefer?",
            column: "Preferred Brand",
            options: ["HP", "Dell", "Lenovo", "Asus", "Acer", "Apple", "Other"],
            type: "radio",
            showIf: { ownership: "No" }
        },
        {
            id: "decision",
            text: "What is your final decision factor when buying a laptop?",
            column: "Final Decision Factor",
            options: ["Price", "Brand", "Specifications", "Reviews", "Design"],
            type: "radio",
            showIf: { ownership: "No" }
        },
        {
            id: "featureBuyer",
            text: "Which feature matters most to you?",
            column: "Useful Features",
            options: ["Battery Life", "Display Quality", "Keyboard Comfort", "Performance", "Portability"],
            type: "radio",
            showIf: { ownership: "No" }
        },
        {
            id: "usageBuyer",
            text: "What will be your primary usage purpose?",
            column: "Usage Purpose",
            options: ["Study", "Work", "Gaming", "Content Creation", "General Use"],
            type: "radio",
            showIf: { ownership: "No" }
        }
    ];
}

function getVisibleQuestions() {
    return questions.filter(function(q) {
        if (!q.showIf) return true;
        for (var key in q.showIf) {
            if (answers[key] !== q.showIf[key]) return false;
        }
        return true;
    });
}

function startSurvey(email) {
    userEmail = email;
    questions = buildQuestions();
    answers = {};
    currentQuestion = 0;

    showScreen("surveyArea");
    renderQuestion();
}

function renderQuestion() {
    var visible = getVisibleQuestions();
    var total = visible.length;

    if (currentQuestion >= total) {
        handleSubmit();
        return;
    }

    var q = visible[currentQuestion];

    // Update progress
    var pct = ((currentQuestion + 1) / total) * 100;
    document.getElementById("progressBar").style.width = pct + "%";
    document.getElementById("progressText").textContent = "Question " + (currentQuestion + 1) + " of " + total;

    // Question text
    document.getElementById("questionText").textContent = q.text;

    // Options
    var optionsDiv = document.getElementById("options");
    optionsDiv.innerHTML = "";

    q.options.forEach(function(opt) {
        var div = document.createElement("div");
        div.className = "option";
        if (answers[q.id] === opt) div.classList.add("selected");

        var radio = document.createElement("input");
        radio.type = "radio";
        radio.name = q.id;
        radio.value = opt;
        radio.checked = (answers[q.id] === opt);

        var label = document.createElement("span");
        label.textContent = opt;

        div.appendChild(radio);
        div.appendChild(label);

        div.addEventListener("click", function() {
            answers[q.id] = opt;
            radio.checked = true;
            // Update visual selection
            var allOptions = optionsDiv.querySelectorAll(".option");
            allOptions.forEach(function(o) { o.classList.remove("selected"); });
            div.classList.add("selected");
        });

        optionsDiv.appendChild(div);
    });

    // Button visibility
    var prevBtn = document.getElementById("prevBtn");
    var nextBtn = document.getElementById("nextBtn");
    var submitBtn = document.getElementById("submitBtn");

    prevBtn.style.display = (currentQuestion > 0) ? "block" : "none";
    nextBtn.style.display = (currentQuestion < total - 1) ? "block" : "none";
    submitBtn.style.display = (currentQuestion === total - 1) ? "block" : "none";
}

function nextQuestion() {
    var visible = getVisibleQuestions();
    var q = visible[currentQuestion];
    if (!answers[q.id]) {
        alert("Please select an option before proceeding.");
        return;
    }
    currentQuestion++;
    renderQuestion();
}

function prevQuestion() {
    if (currentQuestion > 0) {
        currentQuestion--;
        renderQuestion();
    }
}

// =======================================
// Submit Survey
// =======================================

function handleSubmit() {
    var visible = getVisibleQuestions();
    var q = visible[currentQuestion];
    if (q && !answers[q.id]) {
        alert("Please select an option before submitting.");
        return;
    }

    // Build response data with column names
    var data = {
        action: "surveyResponse",
        email: userEmail
    };

    questions.forEach(function(q) {
        if (answers[q.id]) {
            data[q.column] = answers[q.id];
        }
    });

    // Send to Google Sheets
    sendToGoogleSheets(data, function() {
        showScreen("thankYou");
        // Clear stored email
        localStorage.removeItem("approvedEmail");
    }, function() {
        alert("There was an error submitting your survey. Please try again.");
    });
}

// =======================================
// Google Sheets Communication
// =======================================

function sendToGoogleSheets(data, onSuccess, onError) {
    fetch(GOOGLE_SHEETS_URL, {
        method: "POST",
        mode: "no-cors",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data)
    })
    .then(function() {
        // no-cors mode doesn't return readable response
        if (onSuccess) onSuccess();
    })
    .catch(function(error) {
        console.error("Google Sheets error:", error);
        if (onError) onError(error);
    });
}

// =======================================
// Utility Functions
// =======================================

function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function showStatus(el, type, message) {
    el.style.display = "block";
    el.className = "status-msg";

    if (type === "success") {
        el.classList.add("status-success");
    } else if (type === "error") {
        el.classList.add("status-error");
    } else if (type === "warning") {
        el.classList.add("status-warning");
    } else {
        el.classList.add("status-info");
    }

    el.innerHTML = message;
}
