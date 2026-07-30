// ===================================
// Google Apps Script Code
// Laptop Market Research Survey
// ===================================
//
// INSTRUCTIONS:
// 1. Open your Google Sheet
// 2. Go to Extensions > Apps Script
// 3. Paste this entire code (replace everything)
// 4. Save and deploy as Web App
//    - Execute as: Me
//    - Who has access: Anyone
// 5. Copy the Web App URL
// ===================================

// Handle POST requests
function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    var action = data.action;

    if (action === "accessRequest") {
      return handleAccessRequest(data);
    } else if (action === "surveyResponse") {
      return handleSurveyResponse(data);
    } else {
      return sendResponse({ status: "error", message: "Unknown action: " + action });
    }
  } catch (error) {
    return sendResponse({ status: "error", message: error.toString() });
  }
}

// Handle GET requests
function doGet(e) {
  try {
    var action = e.parameter.action;

    if (action === "checkAccess") {
      return checkAccess(e.parameter.email);
    } else if (action === "getSurveyData") {
      return getSurveyData();
    } else if (action === "getAccessRequests") {
      return getAccessRequests();
    } else {
      return sendResponse({ status: "error", message: "Unknown action: " + action });
    }
  } catch (error) {
    return sendResponse({ status: "error", message: error.toString() });
  }
}

// ===================================
// Access Request Functions
// ===================================

function handleAccessRequest(data) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName("Access Request");

  if (!sheet) {
    return sendResponse({ status: "error", message: "Access Request sheet not found" });
  }

  // Check if email already exists
  var emailData = sheet.getRange("B2:B").getValues();
  for (var i = 0; i < emailData.length; i++) {
    if (emailData[i][0] && emailData[i][0].toString().toLowerCase() === data.email.toLowerCase()) {
      // Email already exists, check status
      var statusCell = sheet.getRange(i + 2, 4).getValue(); // Column D = Status
      return sendResponse({ status: "exists", message: "Email already submitted", accessStatus: statusCell });
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

  return sendResponse({ status: "success", message: "Access request submitted", accessStatus: "Pending" });
}

function checkAccess(email) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName("Access Request");

  if (!sheet) {
    return sendResponse({ status: "error", message: "Access Request sheet not found" });
  }

  var data = sheet.getDataRange().getValues();

  for (var i = 1; i < data.length; i++) {
    if (data[i][1] && data[i][1].toString().toLowerCase() === email.toLowerCase()) {
      return sendResponse({
        status: "found",
        accessStatus: data[i][5], // Column F = Status
        name: data[i][0]         // Column A = Name
      });
    }
  }

  return sendResponse({ status: "not_found", accessStatus: "None", message: "Email not found" });
}

function getAccessRequests() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName("Access Request");

  if (!sheet) {
    return sendResponse({ status: "error", message: "Access Request sheet not found" });
  }

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
// Survey Response Functions
// ===================================

function handleSurveyResponse(data) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName("Survey Responses");

  if (!sheet) {
    return sendResponse({ status: "error", message: "Survey Responses sheet not found" });
  }

  // Map data to sheet columns
  // Columns: Name, Email, Laptop Ownership, Usage Purpose, Useful Features,
  // Current Laptop Problems, Satisfaction Level, Improvement Needed,
  // Upgrade Frequency, Preferred Brand, Buying Pattern, Recommended Laptop,
  // Preferred Laptop, Budget, Screen Size, Expected Laptop Life,
  // Buying Place, Final Decision Factor
  var row = [
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
  ];

  sheet.appendRow(row);

  return sendResponse({ status: "success", message: "Survey response saved" });
}

function getSurveyData() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName("Survey Responses");

  if (!sheet) {
    return sendResponse({ status: "error", message: "Survey Responses sheet not found" });
  }

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
// Helper Functions
// ===================================

function sendResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
