// ===============================
// Laptop Market Research
// Google Apps Script (Backend)
// ===============================
// Deploy as Web App with access: "Anyone"
// Set up the installable trigger by running setupEmailTrigger() once from the script editor

// IMPORTANT: Replace with your actual spreadsheet ID
var SHEET_ID = "YOUR_SPREADSHEET_ID";

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
// Helper: Find column index by header name
// =======================================

function getColumnIndex(sheet, headerName) {
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  for (var i = 0; i < headers.length; i++) {
    if (headers[i].toString().trim().toLowerCase() === headerName.toLowerCase()) {
      return i;
    }
  }
  return -1;
}

// =======================================
// Installable Trigger for Auto-Email on Status Change
// =======================================

function setupEmailTrigger() {
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === "onStatusChange") {
      ScriptApp.deleteTrigger(triggers[i]);
    }
  }

  ScriptApp.newTrigger("onStatusChange")
    .forSpreadsheet(SpreadsheetApp.getActive())
    .onEdit()
    .create();

  Logger.log("Email trigger setup complete!");
}

function onStatusChange(e) {
  var sheet = e.source.getActiveSheet();
  var sheetName = sheet.getName();

  // Only monitor the "Access Request" sheet
  if (sheetName !== "Access Request") return;

  var range = e.range;
  var row = range.getRow();
  var col = range.getColumn();

  if (row < 2) return; // Skip header row

  // Find the Status column dynamically
  var statusCol = getColumnIndex(sheet, "Status") + 1; // +1 because getColumnIndex is 0-based but getRange is 1-based
  if (statusCol === 0) return; // No Status column found

  // Only proceed if the edited cell is the Status column
  if (col !== statusCol) return;

  var newStatus = range.getValue();

  // Only send email when status changes to "Accepted"
  if (newStatus === "Accepted") {
    var emailCol = getColumnIndex(sheet, "Email") + 1;
    var nameCol = getColumnIndex(sheet, "Name") + 1;

    var email = emailCol > 0 ? sheet.getRange(row, emailCol).getValue() : "";
    var name = nameCol > 0 ? sheet.getRange(row, nameCol).getValue() : "";

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
  } else if (action === "debug") {
    return debugSheetInfo();
  }

  return ContentService.createTextOutput(JSON.stringify({ status: "error", message: "Unknown action" }))
    .setMimeType(ContentService.MimeType.JSON);
}

// =======================================
// Debug: Returns sheet structure info
// =======================================

function debugSheetInfo() {
  var ss = SpreadsheetApp.openById(SHEET_ID);
  var result = {
    sheetId: SHEET_ID,
    sheets: []
  };

  var sheetNames = ss.getSheets();
  for (var s = 0; s < sheetNames.length; s++) {
    var sheet = sheetNames[s];
    var name = sheet.getName();
    var data = sheet.getDataRange().getValues();
    var headers = data.length > 0 ? data[0] : [];
    var rowCount = data.length - 1; // minus header

    var sheetInfo = {
      name: name,
      headers: headers.map(function(h) { return h.toString(); }),
      totalRows: rowCount,
      sampleRows: []
    };

    // Include first 2 data rows for debugging
    for (var i = 1; i < Math.min(data.length, 3); i++) {
      var row = {};
      for (var j = 0; j < headers.length; j++) {
        row[headers[j].toString()] = data[i][j].toString();
      }
      sheetInfo.sampleRows.push(row);
    }

    result.sheets.push(sheetInfo);
  }

  return ContentService.createTextOutput(JSON.stringify(result, null, 2))
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

  // Find column indices dynamically
  var emailColIdx = getColumnIndex(sheet, "Email");
  var statusColIdx = getColumnIndex(sheet, "Status");

  // Check if email already exists
  var allData = sheet.getDataRange().getValues();
  for (var i = 1; i < allData.length; i++) {
    if (emailColIdx >= 0 && allData[i][emailColIdx].toString().trim().toLowerCase() === email.toLowerCase()) {
      var existingStatus = statusColIdx >= 0 ? allData[i][statusColIdx] : "Unknown";
      return ContentService.createTextOutput(JSON.stringify({
        status: "exists",
        currentStatus: existingStatus,
        message: "Email already exists with status: " + existingStatus
      })).setMimeType(ContentService.MimeType.JSON);
    }
  }

  // Build new row based on existing headers
  var headers = allData[0];
  var newRow = [];
  for (var h = 0; h < headers.length; h++) {
    var header = headers[h].toString().trim().toLowerCase();
    if (header === "timestamp") {
      newRow.push(new Date());
    } else if (header === "email") {
      newRow.push(email);
    } else if (header === "name") {
      newRow.push(name);
    } else if (header === "mobile" || header === "mobile number") {
      newRow.push(mobile);
    } else if (header === "status") {
      newRow.push("Pending");
    } else if (header === "purpose" || header === "comment") {
      newRow.push(purpose);
    } else {
      newRow.push("");
    }
  }

  sheet.appendRow(newRow);

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

  var allData = sheet.getDataRange().getValues();

  // Find column indices dynamically by header name
  var headers = allData[0];
  var emailColIdx = -1;
  var statusColIdx = -1;

  for (var h = 0; h < headers.length; h++) {
    var header = headers[h].toString().trim().toLowerCase();
    if (header === "email" || header === "email address") {
      emailColIdx = h;
    }
    if (header === "status") {
      statusColIdx = h;
    }
  }

  // If we can't find the columns, try common positions
  if (emailColIdx === -1) {
    // Try column B (index 1) as fallback
    emailColIdx = 1;
  }
  if (statusColIdx === -1) {
    // Try column E (index 4) as fallback, then column C (index 2)
    if (headers.length > 4) {
      statusColIdx = 4;
    } else if (headers.length > 2) {
      statusColIdx = 2;
    }
  }

  // Search for the email
  for (var i = 1; i < allData.length; i++) {
    var cellValue = allData[i][emailColIdx].toString().trim().toLowerCase();
    if (cellValue === email.toLowerCase()) {
      var status = statusColIdx >= 0 ? allData[i][statusColIdx] : "Unknown";
      return ContentService.createTextOutput(JSON.stringify({
        status: status.toString().trim()
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
  var allData = sheet.getDataRange().getValues();

  // Find column indices dynamically
  var headers = allData[0];
  var emailColIdx = -1;
  var statusColIdx = -1;
  var nameColIdx = -1;

  for (var h = 0; h < headers.length; h++) {
    var header = headers[h].toString().trim().toLowerCase();
    if (header === "email" || header === "email address") {
      emailColIdx = h;
    }
    if (header === "status") {
      statusColIdx = h;
    }
    if (header === "name") {
      nameColIdx = h;
    }
  }

  var approvedCount = 0;

  for (var i = 1; i < allData.length; i++) {
    var status = allData[i][statusColIdx].toString().trim();

    if (status === "Pending") {
      var email = allData[i][emailColIdx].toString().trim();
      var name = nameColIdx >= 0 ? allData[i][nameColIdx].toString().trim() : "";

      // Update status to Accepted (1-based row, 1-based column)
      sheet.getRange(i + 1, statusColIdx + 1).setValue("Accepted");

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
  var allData = sheet.getDataRange().getValues();

  var statusColIdx = getColumnIndex(sheet, "Status");
  var rejectedCount = 0;

  for (var i = 1; i < allData.length; i++) {
    var status = allData[i][statusColIdx].toString().trim();
    if (status === "Pending") {
      sheet.getRange(i + 1, statusColIdx + 1).setValue("Rejected");
      rejectedCount++;
    }
  }

  Logger.log("Rejected " + rejectedCount + " request(s).");
}
