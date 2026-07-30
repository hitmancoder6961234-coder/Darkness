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
// 5. Select "setupEmailTrigger" from dropdown → click ▶ Run → Authorize
// 6. Deploy → New deployment → Web app → Execute as: Me → Anyone → Deploy
// ===================================

// ===================================
// Custom Menu (appears when sheet opens)
// ===================================

function onOpen() {
  var ui = SpreadsheetApp.getUi();
  ui.createMenu('🔧 Admin Tools')
    .addItem('✅ Approve & Send Email', 'approveSelectedAndSendEmail')
    .addItem('❌ Reject Selected', 'rejectSelected')
    .addToUi();
}

// ===================================
// SETUP: Run this ONCE to enable auto-email
// ===================================

function setupEmailTrigger() {
  // Delete any existing triggers for this function
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === 'onStatusChange') {
      ScriptApp.deleteTrigger(triggers[i]);
    }
  }

  // Create installable onEdit trigger
  ScriptApp.newTrigger('onStatusChange')
    .forSpreadsheet(SpreadsheetApp.getActive())
    .onEdit()
    .create();

  Logger.log("Email trigger setup complete!");
}

// ===================================
// Installable onEdit (CAN send emails)
// ===================================

function onStatusChange(e) {
  var sheet = e.source.getActiveSheet();
  if (sheet.getName() !== "Access Request") return;

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
    "Great news! Your request to participate in the Laptop Market Research Survey has been approved!\n\n" +
    "Take the survey at:\n" +
    "https://hitmancoder6961234-coder.github.io/Darkness/survey.html\n\n" +
    "Just enter your email (" + email + ") on the survey page and you'll be able to start immediately.\n\n" +
    "Thank you!\n" +
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
// POST requests (from website)
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
// GET requests (from website)
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
// Access Request
// ===================================

function handleAccessRequest(data) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Access Request");
  if (!sheet) return sendResponse({ status: "error", message: "Sheet not found" });
  var emailData = sheet.getRange("B2:B").getValues();
  for (var i = 0; i < emailData.length; i++) {
    if (emailData[i][0] && emailData[i][0].toString().toLowerCase() === data.email.toLowerCase()) {
      var statusCell = sheet.getRange(i + 2, 6).getValue();
      return sendResponse({ status: "exists", accessStatus: statusCell });
    }
  }
  sheet.appendRow([data.name || "", data.email || "", data.phone || "", data.occupation || "", data.purpose || "", "Pending", new Date().toISOString()]);
  return sendResponse({ status: "success", accessStatus: "Pending" });
}

function checkAccess(email) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Access Request");
  if (!sheet) return sendResponse({ status: "error", message: "Sheet not found" });
  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (data[i][1] && data[i][1].toString().toLowerCase() === email.toLowerCase()) {
      return sendResponse({ status: "found", accessStatus: data[i][5], name: data[i][0] });
    }
  }
  return sendResponse({ status: "not_found", accessStatus: "None" });
}

// ===================================
// Survey Response
// ===================================

function handleSurveyResponse(data) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Survey Responses");
  if (!sheet) return sendResponse({ status: "error", message: "Sheet not found" });
  sheet.appendRow([
    data.name || "", data.email || "",
    data["Laptop Ownership"] || "", data["Usage Purpose"] || "", data["Useful Features"] || "",
    data["Current Laptop Problems"] || "", data["Satisfaction Level"] || "", data["Improvement Needed"] || "",
    data["Upgrade Frequency"] || "", data["Preferred Brand"] || "", data["Buying Pattern"] || "",
    data["Recommended Laptop"] || "", data["Preferred Laptop"] || "", data["Budget"] || "",
    data["Screen Size"] || "", data["Expected Laptop Life"] || "", data["Buying Place"] || "",
    data["Final Decision Factor"] || ""
  ]);
  return sendResponse({ status: "success", message: "Saved" });
}

function getSurveyData() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Survey Responses");
  if (!sheet) return sendResponse({ status: "error", message: "Sheet not found" });
  var data = sheet.getDataRange().getValues();
  var headers = data[0];
  var rows = [];
  for (var i = 1; i < data.length; i++) {
    var row = {};
    for (var j = 0; j < headers.length; j++) { row[headers[j]] = data[i][j]; }
    rows.push(row);
  }
  return sendResponse(rows);
}

// ===================================
// Admin: Approve & Send Email (from menu)
// ===================================

function approveSelectedAndSendEmail() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Access Request");
  if (!sheet) { SpreadsheetApp.getUi().alert("Sheet not found!"); return; }
  var row = SpreadsheetApp.getActiveSpreadsheet().getActiveCell().getRow();
  if (row < 2) { SpreadsheetApp.getUi().alert("Select a data row."); return; }
  var name = sheet.getRange(row, 1).getValue();
  var email = sheet.getRange(row, 2).getValue();
  var currentStatus = sheet.getRange(row, 6).getValue();
  if (!email) { SpreadsheetApp.getUi().alert("No email in this row."); return; }
  if (currentStatus === "Accepted") { SpreadsheetApp.getUi().alert("Already approved!"); return; }
  sheet.getRange(row, 6).setValue("Accepted");
  var subject = "Laptop Market Research - Access Approved!";
  var body = "Hello " + name + ",\n\nYour request to participate in the Laptop Market Research Survey has been approved!\n\nTake the survey at:\nhttps://hitmancoder6961234-coder.github.io/Darkness/survey.html\n\nJust enter your email (" + email + ") on the survey page.\n\nThank you!\nLaptop Market Research Team";
  try {
    MailApp.sendEmail({ to: email, subject: subject, body: body });
    SpreadsheetApp.getUi().alert("Approved & email sent to " + email + "!");
  } catch (error) {
    SpreadsheetApp.getUi().alert("Approved, but email failed: " + error.toString());
  }
}

// ===================================
// Admin: Reject Selected (from menu)
// ===================================

function rejectSelected() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Access Request");
  if (!sheet) { SpreadsheetApp.getUi().alert("Sheet not found!"); return; }
  var row = SpreadsheetApp.getActiveSpreadsheet().getActiveCell().getRow();
  if (row < 2) { SpreadsheetApp.getUi().alert("Select a data row."); return; }
  sheet.getRange(row, 6).setValue("Rejected");
  SpreadsheetApp.getUi().alert("Request rejected.");
}

// ===================================
// Helper
// ===================================

function sendResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
}
