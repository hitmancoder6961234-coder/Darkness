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
    document.getElementById("existingEmail").value = "";
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

    showStatus(msgEl, "info", "Submitting your request...");

    var data = {
        action: "accessRequest",
        name: name,
        email: email,
        mobile: mobile,
        purpose: purpose
    };

    sendToGoogleSheets(data, function() {
        // After submitting, go to "Sign in Already" page with the email pre-filled
        showStatus(msgEl, "info", "Request submitted! Checking your status...");

        setTimeout(function() {
            // Switch to "Sign in Already" screen
            showSignInAlready();
            document.getElementById("existingEmail").value = email;
            var msgEl2 = document.getElementById("existingStatusMsg");

            showStatus(msgEl2, "info", "Checking your access for <strong>" + email + "</strong>...");

            checkAccessFromSheet(email, function(status) {
                if (status === "Accepted") {
                    showStatus(msgEl2, "success",
                        "Your access has been <strong>Approved</strong>! Starting survey..."
                    );
                    setTimeout(function() {
                        startSurvey(email);
                    }, 1200);
                } else if (status === "Pending") {
                    showStatus(msgEl2, "warning",
                        "Your request is currently <strong>Pending</strong>.<br>" +
                        "Please wait for admin approval. You will receive an email once approved."
                    );
                } else {
                    showStatus(msgEl2, "success",
                        "Your request has been submitted! Status: <strong>Pending</strong>.<br>" +
                        "Please wait for admin approval. You will receive an email once approved."
                    );
                }
            }, function() {
                showStatus(msgEl2, "success",
                    "Your request has been submitted! Status: <strong>Pending</strong>.<br>" +
                    "Please wait for admin approval."
                );
            });
        }, 2000);
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
        } else if (status === "Rejected") {
            showStatus(msgEl, "error",
                "Your request has been <strong>Rejected</strong>.<br>" +
                "Please contact the admin for more information."
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

            var accessStatus = "";

            if (data.status === "not_found" || data.status === "Not Found" || data.status === "not found") {
                accessStatus = "Not Found";
            } else if (data.status === "found" || data.status === "exists") {
                if (data.accessStatus && data.accessStatus !== "None") {
                    accessStatus = data.accessStatus;
                } else if (data.currentStatus) {
                    accessStatus = data.currentStatus;
                } else {
                    accessStatus = "Unknown";
                }
            } else {
                accessStatus = data.status;
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
    // Clear old localStorage data
    localStorage.removeItem("approvedEmail");
    localStorage.removeItem("pendingEmail");
    localStorage.removeItem("pendingName");
    localStorage.removeItem("pendingMobile");
    localStorage.removeItem("approvedName");

    var params = new URLSearchParams(window.location.search);
    var emailParam = params.get("email");

    if (emailParam && isValidEmail(emailParam)) {
        document.getElementById("existingEmail").value = emailParam;

        showSignInAlready();
        showStatus(document.getElementById("existingStatusMsg"), "info",
            "Checking your access for <strong>" + emailParam + "</strong>..."
        );

        checkAccessFromSheet(emailParam, function(status) {
            var msgEl = document.getElementById("existingStatusMsg");
            if (status === "Accepted") {
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
        showSignInChoice();
    }
})();

// =======================================
// Survey Logic - Step Based (No Dynamic Filtering)
// =======================================

var surveyStep = 0;
var surveyAnswers = {};
var surveyEmail = "";
var surveyQuestions = []; // The active question list for this user

var ALL_QUESTIONS = [
    {
        id: "ownership",
        text: "Do you currently own a laptop?",
        column: "Laptop Ownership",
        options: ["Yes", "No"]
    },
    // ===== OWNER BRANCH =====
    {
        id: "usage",
        text: "What is your primary usage purpose?",
        column: "Usage Purpose",
        options: ["Study", "Work", "Gaming", "Content Creation", "General Use"],
        branch: "Yes"
    },
    {
        id: "brand",
        text: "Which brand is your current laptop?",
        column: "Preferred Brand",
        options: ["HP", "Dell", "Lenovo", "Asus", "Acer", "Apple", "Other"],
        branch: "Yes"
    },
    {
        id: "satisfaction",
        text: "How satisfied are you with your current laptop?",
        column: "Satisfaction Level",
        options: ["Very Satisfied", "Satisfied", "Neutral", "Dissatisfied", "Very Dissatisfied"],
        branch: "Yes"
    },
    {
        id: "problems",
        text: "What problems do you face with your current laptop?",
        column: "Current Laptop Problems",
        options: ["Battery Life", "Heating Problem", "Slow Performance", "Display Issues", "None"],
        branch: "Yes"
    },
    {
        id: "feature",
        text: "Which feature do you find most useful in your laptop?",
        column: "Useful Features",
        options: ["Battery Life", "Display Quality", "Keyboard Comfort", "Performance", "Portability"],
        branch: "Yes"
    },
    // ===== BUYER BRANCH =====
    {
        id: "budget",
        text: "What is your budget for a new laptop?",
        column: "Budget",
        options: ["Under \u20B930,000", "\u20B930,000 \u2013 \u20B950,000", "\u20B950,000 \u2013 \u20B980,000", "Above \u20B980,000"],
        branch: "No"
    },
    {
        id: "brandBuyer",
        text: "Which brand would you prefer?",
        column: "Preferred Brand",
        options: ["HP", "Dell", "Lenovo", "Asus", "Acer", "Apple", "Other"],
        branch: "No"
    },
    {
        id: "decision",
        text: "What is your final decision factor when buying a laptop?",
        column: "Final Decision Factor",
        options: ["Price", "Brand", "Specifications", "Reviews", "Design"],
        branch: "No"
    },
    {
        id: "featureBuyer",
        text: "Which feature matters most to you?",
        column: "Useful Features",
        options: ["Battery Life", "Display Quality", "Keyboard Comfort", "Performance", "Portability"],
        branch: "No"
    },
    {
        id: "usageBuyer",
        text: "What will be your primary usage purpose?",
        column: "Usage Purpose",
        options: ["Study", "Work", "Gaming", "Content Creation", "General Use"],
        branch: "No"
    }
];

function startSurvey(email) {
    surveyEmail = email;
    surveyAnswers = {};
    surveyStep = 0;
    surveyQuestions = []; // Will be built after Q1 is answered

    showScreen("surveyArea");
    // Show Q1 first (ownership question)
    renderOwnershipQuestion();
}

function renderOwnershipQuestion() {
    var q = ALL_QUESTIONS[0]; // ownership question

    // Update progress
    document.getElementById("progressBar").style.width = "17%";
    document.getElementById("progressText").textContent = "Question 1 of 6";

    // Question text
    document.getElementById("questionText").textContent = q.text;

    // Options
    var optionsDiv = document.getElementById("options");
    optionsDiv.innerHTML = "";

    q.options.forEach(function(opt) {
        var div = document.createElement("div");
        div.className = "option";

        var radio = document.createElement("input");
        radio.type = "radio";
        radio.name = q.id;
        radio.value = opt;

        var label = document.createElement("span");
        label.textContent = opt;

        div.appendChild(radio);
        div.appendChild(label);

        div.addEventListener("click", function() {
            // Clear previous selection
            var allOptions = optionsDiv.querySelectorAll(".option");
            allOptions.forEach(function(o) { o.classList.remove("selected"); });
            div.classList.add("selected");
            radio.checked = true;

            // Save answer
            surveyAnswers.ownership = opt;

            // Build the question list based on this answer
            buildBranchQuestions(opt);

            // Show Next button
            document.getElementById("nextBtn").style.display = "block";
            document.getElementById("submitBtn").style.display = "none";
        });

        optionsDiv.appendChild(div);
    });

    // Buttons: only Next, no Previous, no Submit
    document.getElementById("prevBtn").style.display = "none";
    document.getElementById("nextBtn").style.display = "block";
    document.getElementById("submitBtn").style.display = "none";
}

function buildBranchQuestions(ownershipAnswer) {
    surveyQuestions = [];
    // Add all questions that match the branch
    for (var i = 1; i < ALL_QUESTIONS.length; i++) {
        if (ALL_QUESTIONS[i].branch === ownershipAnswer) {
            surveyQuestions.push(ALL_QUESTIONS[i]);
        }
    }
}

function renderQuestion() {
    // If we're at step 0, show the ownership question
    if (surveyStep === 0) {
        renderOwnershipQuestion();
        return;
    }

    // For steps 1+, use the branch questions
    var qIndex = surveyStep - 1; // index into surveyQuestions
    if (qIndex < 0 || qIndex >= surveyQuestions.length) return;

    var q = surveyQuestions[qIndex];
    var total = surveyQuestions.length + 1; // +1 for ownership question

    // Update progress
    var pct = ((surveyStep + 1) / total) * 100;
    document.getElementById("progressBar").style.width = pct + "%";
    document.getElementById("progressText").textContent = "Question " + (surveyStep + 1) + " of " + total;

    // Question text
    document.getElementById("questionText").textContent = q.text;

    // Options
    var optionsDiv = document.getElementById("options");
    optionsDiv.innerHTML = "";

    q.options.forEach(function(opt) {
        var div = document.createElement("div");
        div.className = "option";
        if (surveyAnswers[q.id] === opt) div.classList.add("selected");

        var radio = document.createElement("input");
        radio.type = "radio";
        radio.name = q.id;
        radio.value = opt;
        radio.checked = (surveyAnswers[q.id] === opt);

        var label = document.createElement("span");
        label.textContent = opt;

        div.appendChild(radio);
        div.appendChild(label);

        div.addEventListener("click", function() {
            var allOptions = optionsDiv.querySelectorAll(".option");
            allOptions.forEach(function(o) { o.classList.remove("selected"); });
            div.classList.add("selected");
            radio.checked = true;
            surveyAnswers[q.id] = opt;
        });

        optionsDiv.appendChild(div);
    });

    // Buttons
    var isLast = (qIndex === surveyQuestions.length - 1);

    document.getElementById("prevBtn").style.display = "block";
    document.getElementById("nextBtn").style.display = isLast ? "none" : "block";
    document.getElementById("submitBtn").style.display = isLast ? "block" : "none";
}

function nextQuestion() {
    // Check if current question is answered
    if (surveyStep === 0) {
        if (!surveyAnswers.ownership) {
            alert("Please select an option before proceeding.");
            return;
        }
    } else {
        var qIndex = surveyStep - 1;
        var q = surveyQuestions[qIndex];
        if (!surveyAnswers[q.id]) {
            alert("Please select an option before proceeding.");
            return;
        }
    }

    surveyStep++;
    renderQuestion();
}

function prevQuestion() {
    if (surveyStep > 0) {
        surveyStep--;
        renderQuestion();
    }
}

// =======================================
// Submit Survey
// =======================================

function handleSubmit() {
    // Check last question is answered
    var qIndex = surveyStep - 1;
    var q = surveyQuestions[qIndex];
    if (!surveyAnswers[q.id]) {
        alert("Please select an option before submitting.");
        return;
    }

    // Build response data with column names
    var data = {
        action: "surveyResponse",
        email: surveyEmail
    };

    // Map answers to column names
    data["Laptop Ownership"] = surveyAnswers.ownership || "";

    surveyQuestions.forEach(function(q) {
        if (surveyAnswers[q.id]) {
            data[q.column] = surveyAnswers[q.id];
        }
    });

    // Send to Google Sheets
    sendToGoogleSheets(data, function() {
        showScreen("thankYou");
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
