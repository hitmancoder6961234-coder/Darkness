// ===================================
// Google Apps Script Code
// Laptop Market Research Survey
// ===================================
//
// INSTRUCTIONS:
// 1. Open your Google Sheet
// 2. Go to Extensions > Apps Script
// 3. Paste this entire code (replace everything)
// 4. Save
// 5. Run the "createCustomMenu" function once
// 6. Deploy as Web App:
//    - Execute as: Me
//    - Who has access: Anyone
// ===================================

// ===================================
// Custom Menu (adds buttons to your sheet)
// ===================================

function onOpen() {
  var ui = SpreadsheetApp.getUi();
  ui.createMenu('🔧 Admin Tools')
    .addItem('✅ Approve & Send Email', 'approveSelectedAndSendEmail')
    .addItem('❌ Reject Selected', 'rejectSelected')
    .addToUi();
}

// ===================================
// Handle POST requests (from website)
// ===================================

function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    var action = data.action;

    if (action === "accessRequest") {
      return handleAccessRequest(data);
    } else if (action === "surveyResponse") {
      return handleSurveyResponse(data);
    } else {
      return sendResponse({ status: "error", message: "Unknown action" });
    }
  } catch (error) {
    return sendResponse({ status: "error", message: error.toString() });
  }
}

// ===================================
// Handle GET requests (from website)
// ===================================

function doGet(e) {
  try {
    var action = e.parameter.action;

    if (action === "checkAccess") {
      return checkAccess(e.parameter.email);
    } else if (action === "getSurveyData") {
      return getSurveyData();
    } else {
      return sendResponse({ status: "error", message: "Unknown action" });
    }
  } catch (error) {
    return sendResponse({ status: "error", message: error.toString() });
  }
}

// ===================================
// Access Request Functions
// ===================================

function handleAccessRequest(data) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Access Request");
  if (!sheet) return sendResponse({ status: "error", message: "Access Request sheet not found" });

  // Check if email already exists
  var emailData = sheet.getRange("B2:B").getValues();
  for (var i = 0; i < emailData.length; i++) {
    if (emailData[i][0] && emailData[i][0].toString().toLowerCase() === data.email.toLowerCase()) {
      var statusCell = sheet.getRange(i + 2, 6).getValue();
      return sendResponse({ status: "exists", accessStatus: statusCell });
    }
  }

  // Add new request
  sheet.appendRow([
    data.name || "",
    data.email || "",
    data.phone || "",
    data.occupation || "",
    data.purpose || "",
    "Pending",
    new Date().toISOString()
  ]);

  return sendResponse({ status: "success", accessStatus: "Pending" });
}

function checkAccess(email) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Access Request");
  if (!sheet) return sendResponse({ status: "error", message: "Access Request sheet not found" });

  var data = sheet.getDataRange().getValues();

  for (var i = 1; i < data.length; i++) {
    if (data[i][1] && data[i][1].toString().toLowerCase() === email.toLowerCase()) {
      return sendResponse({
        status: "found",
        accessStatus: data[i][5],
        name: data[i][0]
      });
    }
  }

  return sendResponse({ status: "not_found", accessStatus: "None" });
}

// ===================================
// Survey Response Functions
// ===================================

function handleSurveyResponse(data) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Survey Responses");
  if (!sheet) return sendResponse({ status: "error", message: "Survey Responses sheet not found" });

  sheet.appendRow([
    data.name || "",
    data.email || "",
    data["Laptop Ownership"] || "",
    data["Usage Purpose"] || "",
    data["Useful Features"] || "",
    data["Current Laptop Problems"] || "",
    data["Satisfaction Level"] || "",
    data["Improvement Needed"] || "",
    data["Upgrade Frequency"] || "",
    data["Preferred Brand"] || "",
    data["Buying Pattern"] || "",
    data["Recommended Laptop"] || "",
    data["Preferred Laptop"] || "",
    data["Budget"] || "",
    data["Screen Size"] || "",
    data["Expected Laptop Life"] || "",
    data["Buying Place"] || "",
    data["Final Decision Factor"] || ""
  ]);

  return sendResponse({ status: "success", message: "Survey response saved" });
}

function getSurveyData() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Survey Responses");
  if (!sheet) return sendResponse({ status: "error", message: "Survey Responses sheet not found" });

  var data = sheet.getDataRange().getValues();
  var headers = data[0];
  var rows = [];

  for (var i = 1; i < data.length; i++) {
    var row = {};
    for (var j = 0; j < headers.length; j++) {
      row[headers[j]] = data[i][j];
    }
    rows.push(row);
  }

  return sendResponse(rows);
}

// ===================================
// Admin: Approve & Send Email
// (Select a row in "Access Request" sheet, then click menu)
// ===================================

function approveSelectedAndSendEmail() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Access Request");
  if (!sheet) {
    SpreadsheetApp.getUi().alert("Access Request sheet not found!");
    return;
  }

  var row = SpreadsheetApp.getActiveSpreadsheet().getActiveCell().getRow();

  if (row < 2) {
    SpreadsheetApp.getUi().alert("Please select a data row (not the header).");
    return;
  }

  var name = sheet.getRange(row, 1).getValue();
  var email = sheet.getRange(row, 2).getValue();
  var currentStatus = sheet.getRange(row, 6).getValue();

  if (!email) {
    SpreadsheetApp.getUi().alert("No email found in this row.");
    return;
  }

  if (currentStatus === "Accepted") {
    SpreadsheetApp.getUi().alert("This request is already approved!");
    return;
  }

  // Update status to Accepted
  sheet.getRange(row, 6).setValue("Accepted");

  // Send approval email
  var subject = "Laptop Market Research - Access Approved!";
  var body = "Hello " + name + ",\n\n" +
    "Great news! Your request to participate in the Laptop Market Research Survey has been approved.\n\n" +
    "You can now take the survey at:\n" +
    "https://hitmancoder6961234-coder.github.io/Darkness/survey.html\n\n" +
    "Just enter your email (" + email + ") on the survey page and you'll be able to start immediately.\n\n" +
    "Thank you for your interest!\n" +
    "Laptop Market Research Team";

  try {
    MailApp.sendEmail({
      to: email,
      subject: subject,
      body: body
    });
    SpreadsheetApp.getUi().alert("Approved & email sent to " + email + "!");
  } catch (error) {
    SpreadsheetApp.getUi().alert("Approved, but email failed: " + error.toString());
  }
}

// ===================================
// Admin: Reject Selected
// ===================================

function rejectSelected() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Access Request");
  if (!sheet) {
    SpreadsheetApp.getUi().alert("Access Request sheet not found!");
    return;
  }

  var row = SpreadsheetApp.getActiveSpreadsheet().getActiveCell().getRow();

  if (row < 2) {
    SpreadsheetApp.getUi().alert("Please select a data row (not the header).");
    return;
  }

  sheet.getRange(row, 6).setValue("Rejected");
  SpreadsheetApp.getUi().alert("Request rejected.");
}

// ===================================
// Auto-send email on status change (onEdit trigger)
// ===================================

function onEdit(e) {
  var sheet = e.source.getActiveSheet();
  var sheetName = sheet.getName();

  // Only trigger on "Access Request" sheet
  if (sheetName !== "Access Request") return;

  var range = e.range;
  var row = range.getRow();
  var col = range.getColumn();

  // Only trigger when Status column (F = column 6) is edited
  if (col !== 6 || row < 2) return;

  var newValue = range.getValue();
  if (newValue !== "Accepted") return;

  // Get the email and name
  var name = sheet.getRange(row, 1).getValue();
  var email = sheet.getRange(row, 2).getValue();

  if (!email) return;

  // Send approval email
  var subject = "Laptop Market Research - Access Approved!";
  var body = "Hello " + name + ",\n\n" +
    "Great news! Your request to participate in the Laptop Market Research Survey has been approved.\n\n" +
    "You can now take the survey at:\n" +
    "https://hitmancoder6961234-coder.github.io/Darkness/survey.html\n\n" +
    "Just enter your email (" + email + ") on the survey page and you'll be able to start immediately.\n\n" +
    "Thank you for your interest!\n" +
    "Laptop Market Research Team";

  try {
    MailApp.sendEmail({
      to: email,
      subject: subject,
      body: body
    });
    Logger.log("Approval email sent to " + email);
  } catch (error) {
    Logger.log("Failed to send email: " + error.toString());
  }
}

// ===================================
// Helper
// ===================================

function sendResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
