// ================================
// Laptop Market Research
// Request Access Script
// ================================

const GOOGLE_SHEETS_URL = "https://script.google.com/macros/s/AKfycbx-kggNIXc9XqSjtXkLOaY5-WbMNlmnA_6HnzFoCjqsS58pZdHqs-_n2GiUUmTVuLas1g/exec";

const form = document.getElementById("requestForm");
const successMessage = document.getElementById("successMessage");

form.addEventListener("submit", function (event) {
    event.preventDefault();

    // Get Form Values
    var userData = {
        action: "accessRequest",
        name: document.getElementById("name").value.trim(),
        email: document.getElementById("email").value.trim(),
        phone: document.getElementById("phone").value.trim(),
        occupation: document.getElementById("occupation").value,
        purpose: document.getElementById("purpose").value.trim()
    };

    // Display Data in Console
    console.log("Request Submitted");
    console.table(userData);

    // Send to Google Sheets
    sendRequestToGoogleSheets(userData);

    // Hide Form
    form.style.display = "none";

    // Show Pending Message
    successMessage.innerHTML = `
        <h2>Request Submitted Successfully!</h2>
        <p>
            Your access request has been submitted and is currently <strong style="color:#fbbf24;">Pending</strong>.
            You will be able to take the survey once the admin approves your request.
        </p>
        <p style="color:#94a3b8; font-size:14px; margin-top:10px;">
            Come back to the <a href="survey.html" style="color:#60a5fa; text-decoration:underline;">survey page</a> later and enter your email to check if you've been approved.
        </p>
        <div style="margin-top:18px; text-align:center;">
            <a href="index.html" style="display:inline-block; padding:14px 28px; background:#2563eb; color:#fff; border-radius:10px; text-decoration:none; font-weight:600;">
                Back to Home
            </a>
        </div>
    `;
    successMessage.style.display = "block";

    // Store Request Locally
    localStorage.setItem("requestData", JSON.stringify(userData));

    // Save email for survey page to auto-check
    localStorage.setItem("pendingEmail", userData.email);
    localStorage.setItem("pendingName", userData.name);
});

// =======================================
// Google Sheets Integration
// =======================================

function sendRequestToGoogleSheets(data) {
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
        console.log("Access request sent to Google Sheets successfully.");
    })
    .catch(function(error) {
        console.error("Error sending access request to Google Sheets:", error);
        console.log("Data is saved locally and can be synced later.");
    });
}
