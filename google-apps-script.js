// ===============================
// Laptop Market Research
// Google Apps Script (Backend)
// ===============================
// Deploy as Web App with access: "Anyone"
// Set up the installable trigger by running setupEmailTrigger() once from the script editor

var SHEET_ID = "YOUR_SPREADSHEET_ID"; // Replace with your actual spreadsheet ID

function onOpen() {
  var ui = SpreadsheetApp.getUi();
  ui.createMenu("Admin Tools")
    .addItem("Approve Selected & Send Email", "approveSelectedAndSendEmail")
    .addItem("Reject Selected", "rejectSelected")
    .addSeparator()
    .addItem("Setup Email Trigger", "setupEmailTrigger")
    .addToUi();
}

// =======================================
// Installable Trigger for Auto-Email on Status Change
// =======================================

function setupEmailTrigger() {
  // Delete existing triggers for this function
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === "onStatusChange") {
      ScriptApp.deleteTrigger(triggers[i]);
    }
  }

  // Create new installable onEdit trigger
  ScriptApp.newTrigger("onStatusChange")
    .forSpreadsheet(SpreadsheetApp.getActive())
    .onEdit()
    .create();

  Logger.log("Email trigger setup complete! Trigger will fire when status changes.");
}

function onStatusChange(e) {
  var sheet = e.source.getActiveSheet();
  var sheetName = sheet.getName();

  // Only monitor the "Access Request" sheet
  if (sheetName !== "Access Request") return;

  var range = e.range;
  var row = range.getRow();
  var col = range.getColumn();

  // Status column is column 5 (E)
  if (col !== 5) return;
  if (row < 2) return; // Skip header row

  var newStatus = range.getValue();
  var previousStatus = e.oldValue;

  // Only send email when status changes to "Accepted"
  if (newStatus === "Accepted" && previousStatus !== "Accepted") {
    var email = sheet.getRange(row, 2).getValue(); // Column B = Email
    var name = sheet.getRange(row, 3).getValue();  // Column C = Name (or empty)

    if (email) {
      var surveyLink = "https://hitmancoder6961234-coder.github.io/Darkness/survey.html?email=" + encodeURIComponent(email);

      var subject = "Your Laptop Survey Access Has Been Approved!";
      var body = "Hello" + (name ? " " + name : "") + ",\n\n" +
        "Great news! Your request to participate in the Laptop Market Research Survey has been approved.\n\n" +
        "Click the link below to start the survey:\n" +
        surveyLink + "\n\n" +
        "This link will automatically sign you in and take you directly to the survey.\n\n" +
        "Thank you for your interest!\n" +
        "Darkness Research Team";

      try {
        MailApp.sendEmail(email, subject, body);
        Logger.log("Approval email sent to: " + email);
      } catch (err) {
        Logger.log("Failed to send email to " + email + ": " + err.message);
      }
    }
  }
}

// =======================================
// Web App Entry Points
// =======================================

function doPost(e) {
  var data = JSON.parse(e.postData.contents);
  var action = data.action;

  if (action === "accessRequest") {
    return handleAccessRequest(data);
  } else if (action === "surveyResponse") {
    return handleSurveyResponse(data);
  }

  return ContentService.createTextOutput(JSON.stringify({ status: "error", message: "Unknown action" }))
    .setMimeType(ContentService.MimeType.JSON);
}

function doGet(e) {
  var action = e.parameter.action;

  if (action === "checkAccess") {
    return checkAccess(e.parameter.email);
  } else if (action === "getSurveyData") {
    return getSurveyData();
  }

  return ContentService.createTextOutput(JSON.stringify({ status: "error", message: "Unknown action" }))
    .setMimeType(ContentService.MimeType.JSON);
}

// =======================================
// Access Request Handler
// =======================================

function handleAccessRequest(data) {
  var ss = SpreadsheetApp.openById(SHEET_ID);
  var sheet = ss.getSheetByName("Access Request");

  var email = data.email;
  var name = data.name || "";
  var mobile = data.mobile || "";
  var purpose = data.purpose || "";

  // Check if email already exists
  var data2 = sheet.getDataRange().getValues();
  for (var i = 1; i < data2.length; i++) {
    if (data2[i][1] === email) { // Column B = Email
      var existingStatus = data2[i][4]; // Column E = Status
      return ContentService.createTextOutput(JSON.stringify({
        status: "exists",
        currentStatus: existingStatus,
        message: "Email already exists with status: " + existingStatus
      })).setMimeType(ContentService.MimeType.JSON);
    }
  }

  // Add new row: Timestamp | Email | Name | Mobile | Status | Purpose
  sheet.appendRow([new Date(), email, name, mobile, "Pending", purpose]);

  return ContentService.createTextOutput(JSON.stringify({
    status: "success",
    message: "Access request submitted. Status: Pending"
  })).setMimeType(ContentService.MimeType.JSON);
}

// =======================================
// Check Access Status
// =======================================

function checkAccess(email) {
  var ss = SpreadsheetApp.openById(SHEET_ID);
  var sheet = ss.getSheetByName("Access Request");

  var data = sheet.getDataRange().getValues();

  for (var i = 1; i < data.length; i++) {
    if (data[i][1] === email) { // Column B = Email
      return ContentService.createTextOutput(JSON.stringify({
        status: data[i][4] // Column E = Status
      })).setMimeType(ContentService.MimeType.JSON);
    }
  }

  return ContentService.createTextOutput(JSON.stringify({
    status: "Not Found"
  })).setMimeType(ContentService.MimeType.JSON);
}

// =======================================
// Survey Response Handler
// =======================================

function handleSurveyResponse(data) {
  var ss = SpreadsheetApp.openById(SHEET_ID);
  var sheet = ss.getSheetByName("Survey Responses");

  // Build row with all columns matching the sheet headers
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  var row = [];

  for (var h = 0; h < headers.length; h++) {
    var header = headers[h];
    if (header === "Timestamp") {
      row.push(new Date());
    } else if (header === "Email") {
      row.push(data.email || "");
    } else {
      row.push(data[header] || "");
    }
  }

  sheet.appendRow(row);

  return ContentService.createTextOutput(JSON.stringify({
    status: "success",
    message: "Survey response recorded"
  })).setMimeType(ContentService.MimeType.JSON);
}

// =======================================
// Get Survey Data (for Dashboard)
// =======================================

function getSurveyData() {
  var ss = SpreadsheetApp.openById(SHEET_ID);
  var sheet = ss.getSheetByName("Survey Responses");

  var data = sheet.getDataRange().getValues();
  var headers = data[0];
  var result = [];

  for (var i = 1; i < data.length; i++) {
    var row = {};
    for (var j = 0; j < headers.length; j++) {
      row[headers[j]] = data[i][j];
    }
    result.push(row);
  }

  return ContentService.createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}

// =======================================
// Admin Tools: Approve Selected & Send Email
// =======================================

function approveSelectedAndSendEmail() {
  var ss = SpreadsheetApp.openById(SHEET_ID);
  var sheet = ss.getSheetByName("Access Request");
  var data = sheet.getDataRange().getValues();
  var approvedCount = 0;

  for (var i = 1; i < data.length; i++) {
    // Check if row is selected (checkbox in column A or manually selected)
    // We check if the current status is "Pending" and the row is highlighted/selected
    var status = data[i][4]; // Column E = Status

    if (status === "Pending") {
      var email = data[i][1]; // Column B = Email
      var name = data[i][2];  // Column C = Name

      // Update status to Accepted
      sheet.getRange(i + 1, 5).setValue("Accepted");

      // Send approval email
      if (email) {
        var surveyLink = "https://hitmancoder6961234-coder.github.io/Darkness/survey.html?email=" + encodeURIComponent(email);

        var subject = "Your Laptop Survey Access Has Been Approved!";
        var body = "Hello" + (name ? " " + name : "") + ",\n\n" +
          "Great news! Your request to participate in the Laptop Market Research Survey has been approved.\n\n" +
          "Click the link below to start the survey:\n" +
          surveyLink + "\n\n" +
          "This link will automatically sign you in and take you directly to the survey.\n\n" +
          "Thank you for your interest!\n" +
          "Darkness Research Team";

        try {
          MailApp.sendEmail(email, subject, body);
          Logger.log("Approval email sent to: " + email);
        } catch (err) {
          Logger.log("Failed to send email to " + email + ": " + err.message);
        }
      }

      approvedCount++;
    }
  }

  Logger.log("Approved " + approvedCount + " request(s) and sent emails.");
}

// =======================================
// Admin Tools: Reject Selected
// =======================================

function rejectSelected() {
  var ss = SpreadsheetApp.openById(SHEET_ID);
  var sheet = ss.getSheetByName("Access Request");
  var data = sheet.getDataRange().getValues();
  var rejectedCount = 0;

  for (var i = 1; i < data.length; i++) {
    var status = data[i][4]; // Column E = Status

    if (status === "Pending") {
      sheet.getRange(i + 1, 5).setValue("Rejected");
      rejectedCount++;
    }
  }

  Logger.log("Rejected " + rejectedCount + " request(s).");
}
