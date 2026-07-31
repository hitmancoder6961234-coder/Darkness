// ================================
// Laptop Market Research
// Request Access Script (Legacy)
// ================================
// NOTE: The main form is now in survey.js (unified sign-in flow)
// This file is kept for backward compatibility only

const GOOGLE_SHEETS_URL = "https://script.google.com/macros/s/AKfycbxNezU-FZQzKrBSEB8dj0MC8-30a1E7_gw7cK68hHWXrZHofW9gwVglDwlW4e5vkpEw6Q/exec";

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
}

// Make functions globally accessible
window.showStep1 = showStep1;
window.showNewSignIn = showNewSignIn;
window.showReturningSignIn = showReturningSignIn;

// =======================================
// New User Form Submission
// =======================================

var newUserForm = document.getElementById("newUserForm");

if (newUserForm) {
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
        sendRequestToGoogleSheets(userData, function() {
            // Clear form fields after successful submission
            document.getElementById("newName").value = "";
            document.getElementById("newEmail").value = "";
            document.getElementById("newPhone").value = "";
            document.getElementById("newPurpose").value = "";

            // Show success message
            document.getElementById("step2New").style.display = "none";
            document.getElementById("successMessage").style.display = "block";
        });
    });
}

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
                resultDiv.style.background = "rgba(22,163,74,0.15)";
                resultDiv.style.border = "1px solid #16a34a";
                resultDiv.innerHTML =
                    '<div style="font-size:2rem; margin-bottom:10px;">\u2705</div>' +
                    '<strong style="color:#16a34a; font-size:1.1rem;">Access Approved!</strong>' +
                    '<p style="color:#cbd5e1; margin-top:8px;">Welcome back, ' + (data.name || "User") + '!</p>' +
                    '<a href="survey.html" style="display:inline-block; margin-top:15px; padding:14px 28px; background:#16a34a; color:#fff; border-radius:10px; text-decoration:none; font-weight:600;">Start Survey \u2192</a>';

            } else if (data.status === "found" && data.accessStatus === "Pending") {
                resultDiv.style.background = "rgba(251,191,36,0.15)";
                resultDiv.style.border = "1px solid #fbbf24";
                resultDiv.innerHTML =
                    '<div style="font-size:2rem; margin-bottom:10px;">\u23F3</div>' +
                    '<strong style="color:#fbbf24; font-size:1.1rem;">Request Pending</strong>' +
                    '<p style="color:#cbd5e1; margin-top:8px;">Your request is still waiting for admin approval. You\'ll receive an email once approved.</p>';

            } else if (data.status === "found" && data.accessStatus === "Rejected") {
                resultDiv.style.background = "rgba(239,68,68,0.15)";
                resultDiv.style.border = "1px solid #ef4444";
                resultDiv.innerHTML =
                    '<div style="font-size:2rem; margin-bottom:10px;">\u274C</div>' +
                    '<strong style="color:#ef4444; font-size:1.1rem;">Request Rejected</strong>' +
                    '<p style="color:#cbd5e1; margin-top:8px;">Your access request has been rejected.</p>';

            } else {
                resultDiv.style.background = "rgba(239,68,68,0.15)";
                resultDiv.style.border = "1px solid #ef4444";
                resultDiv.innerHTML =
                    '<div style="font-size:2rem; margin-bottom:10px;">\uD83D\uDEAB</div>' +
                    '<strong style="color:#ef4444; font-size:1.1rem;">Email Not Found</strong>' +
                    '<p style="color:#cbd5e1; margin-top:8px;">No request found with this email. Please sign in as a new user first.</p>' +
                    '<a href="#" onclick="showNewSignIn(); return false;" style="display:inline-block; margin-top:15px; color:#60a5fa; text-decoration:underline;">Sign In as New User \u2192</a>';
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
// FIXED: Uses URL-encoded form data + mode: "no-cors"
// This is the ONLY reliable method for Google Apps Script Web Apps
// =======================================

function sendRequestToGoogleSheets(data, onSuccess) {
    var params = new URLSearchParams();
    var keys = Object.keys(data);
    for (var i = 0; i < keys.length; i++) {
        params.append(keys[i], data[keys[i]]);
    }

    fetch(GOOGLE_SHEETS_URL, {
        method: "POST",
        mode: "no-cors",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: params.toString()
    })
    .then(function() {
        console.log("Access request sent to Google Sheets.");
        if (onSuccess) onSuccess();
    })
    .catch(function(error) {
        console.error("Error sending request:", error);
    });
}
