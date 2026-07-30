// ================================
// Laptop Market Research
// Request Access Script
// ================================

const form = document.getElementById("requestForm");
const successMessage = document.getElementById("successMessage");

form.addEventListener("submit", function (event)
{
    event.preventDefault();

    // Get Form Values
    const userData =
    {
        name: document.getElementById("name").value.trim(),

        email: document.getElementById("email").value.trim(),

        phone: document.getElementById("phone").value.trim(),

        occupation: document.getElementById("occupation").value,

        purpose: document.getElementById("purpose").value.trim(),

        status: "Pending",

        requestDate: new Date().toLocaleString()
    };

    // Display Data in Console
    console.log("Request Submitted");
    console.table(userData);

    // Hide Form
    form.style.display = "none";

    // Show Success Message
    successMessage.style.display = "block";

    // Store Request Locally
    localStorage.setItem("requestData", JSON.stringify(userData));

    // Google Sheets Integration
    // Will be added later using Google Apps Script.
});