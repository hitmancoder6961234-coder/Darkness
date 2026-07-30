// ================================
// Laptop Market Research
// Request Access Script
// ================================

const GOOGLE_SHEETS_URL = "https://script.google.com/macros/s/AKfycbx-kggNIXc9XqSjtXkLOaY5-WbMNlmnA_6HnzFoCjqsS58pZdHqs-_n2GiUUmTVuLas1g/exec";

// =======================================
// Navigation Functions
// =======================================

function showStep1() {
    document.getElementById("step1").style.display = "block";
    document.getElementById("step2New").style.display = "none";
    document.getElementById("step2Return").style.display = "none";
    document.getElementById("successMessage").style.display = "none";
}

function showNewSignIn() {
    document.getElementById("step1").style.display = "none";
    document.getElementById("step2New").style.display = "block";
}

function showReturningSignIn() {
    document.getElementById("step1").style.display = "none";
    document.getElementById("step2Return").style.display = "block";

    // Pre-fill email if saved from earlier
    var savedEmail = localStorage.getItem("pendingEmail") || "";
    if (savedEmail) {
        document.getElementById("returnEmail").value = savedEmail;
    }
}

// Make functions globally accessible
window.showStep1 = showStep1;
window.showNewSignIn = showNewSignIn;
window.showReturningSignIn = showReturningSignIn;

// =======================================
// New User Form Submission
// =======================================

var newUserForm = document.getElementById("newUserForm");

newUserForm.addEventListener("submit", function(event) {
    event.preventDefault();

    var userData = {
        action: "accessRequest",
        name: document.getElementById("newName").value.trim(),
        email: document.getElementById("newEmail").value.trim(),
        phone: document.getElementById("newPhone").value.trim(),
        purpose: document.getElementById("newPurpose").value.trim()
    };

    if (!userData.name || !userData.email || !userData.phone) {
        alert("Please fill in all required fields.");
        return;
    }

    console.log("New Request Submitted");
    console.table(userData);

    // Send to Google Sheets
    sendRequestToGoogleSheets(userData);

    // Save email for survey page
    localStorage.setItem("pendingEmail", userData.email);
    localStorage.setItem("pendingName", userData.name);

    // Show success message
    document.getElementById("step2New").style.display = "none";
    document.getElementById("successMessage").style.display = "block";
});

// =======================================
// Returning User - Check Status
// =======================================

function checkMyStatus() {
    var email = document.getElementById("returnEmail").value.trim();
    var resultDiv = document.getElementById("statusResult");

    if (!email) {
        resultDiv.innerHTML = '<strong style="color:#ef4444;">Please enter your email address.</strong>';
        resultDiv.style.display = "block";
        resultDiv.style.background = "rgba(239,68,68,0.1)";
        resultDiv.style.border = "1px solid #ef4444";
        return;
    }

    resultDiv.innerHTML = '<strong style="color:#60a5fa;">Checking status...</strong>';
    resultDiv.style.display = "block";
    resultDiv.style.background = "rgba(59,130,246,0.1)";
    resultDiv.style.border = "1px solid #3b82f6";

    fetch(GOOGLE_SHEETS_URL + "?action=checkAccess&email=" + encodeURIComponent(email))
        .then(function(response) { return response.json(); })
        .then(function(data) {
            if (data.status === "found" && data.accessStatus === "Accepted") {
                // Approved - save and show survey link
                localStorage.setItem("approvedEmail", email);
                localStorage.setItem("approvedName", data.name || "");
                localStorage.setItem("pendingEmail", email);
                localStorage.setItem("pendingName", data.name || "");

                resultDiv.style.background = "rgba(22,163,74,0.15)";
                resultDiv.style.border = "1px solid #16a34a";
                resultDiv.innerHTML =
                    '<div style="font-size:2rem; margin-bottom:10px;">✅</div>' +
                    '<strong style="color:#16a34a; font-size:1.1rem;">Access Approved!</strong>' +
                    '<p style="color:#cbd5e1; margin-top:8px;">Welcome back, ' + (data.name || "User") + '!</p>' +
                    '<a href="survey.html" style="display:inline-block; margin-top:15px; padding:14px 28px; background:#16a34a; color:#fff; border-radius:10px; text-decoration:none; font-weight:600;">Start Survey →</a>';

            } else if (data.status === "found" && data.accessStatus === "Pending") {
                resultDiv.style.background = "rgba(251,191,36,0.15)";
                resultDiv.style.border = "1px solid #fbbf24";
                resultDiv.innerHTML =
                    '<div style="font-size:2rem; margin-bottom:10px;">⏳</div>' +
                    '<strong style="color:#fbbf24; font-size:1.1rem;">Request Pending</strong>' +
                    '<p style="color:#cbd5e1; margin-top:8px;">Your request is still waiting for admin approval. You\'ll receive an email once approved.</p>';

            } else if (data.status === "found" && data.accessStatus === "Rejected") {
                resultDiv.style.background = "rgba(239,68,68,0.15)";
                resultDiv.style.border = "1px solid #ef4444";
                resultDiv.innerHTML =
                    '<div style="font-size:2rem; margin-bottom:10px;">❌</div>' +
                    '<strong style="color:#ef4444; font-size:1.1rem;">Request Rejected</strong>' +
                    '<p style="color:#cbd5e1; margin-top:8px;">Your access request has been rejected.</p>';

            } else {
                // Email not found
                resultDiv.style.background = "rgba(239,68,68,0.15)";
                resultDiv.style.border = "1px solid #ef4444";
                resultDiv.innerHTML =
                    '<div style="font-size:2rem; margin-bottom:10px;">🚫</div>' +
                    '<strong style="color:#ef4444; font-size:1.1rem;">Email Not Found</strong>' +
                    '<p style="color:#cbd5e1; margin-top:8px;">No request found with this email. Please sign in as a new user first.</p>' +
                    '<a href="#" onclick="showNewSignIn(); return false;" style="display:inline-block; margin-top:15px; color:#60a5fa; text-decoration:underline;">Sign In as New User →</a>';
            }
        })
        .catch(function(error) {
            console.error("Error checking status:", error);
            resultDiv.innerHTML = '<strong style="color:#ef4444;">Error checking status. Please try again.</strong>';
            resultDiv.style.background = "rgba(239,68,68,0.1)";
            resultDiv.style.border = "1px solid #ef4444";
        });
}

window.checkMyStatus = checkMyStatus;

// =======================================
// Google Sheets Integration
// =======================================

function sendRequestToGoogleSheets(data) {
    fetch(GOOGLE_SHEETS_URL, {
        method: "POST",
        mode: "no-cors",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data)
    })
    .then(function() {
        console.log("Access request sent to Google Sheets.");
    })
    .catch(function(error) {
        console.error("Error sending request:", error);
    });
}
