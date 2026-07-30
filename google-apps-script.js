// ===============================
// Laptop Market Research
// Google Apps Script (Backend)
// ===============================
// Deploy as Web App with access: "Anyone"
// Set up the installable trigger by running setupEmailTrigger() once from the script editor

// IMPORTANT: Replace with your actual spreadsheet ID
var SHEET_ID = "YOUR_SPREADSHEET_ID";

var SURVEY_LINK = "https://hitmancoder6961234-coder.github.io/Darkness/survey.html";

// =======================================
// Sheet Names
// =======================================
var REQUESTS_SHEET = "Requests";
var SURVEY_SHEET = "Survey Responses";
var STATS_SHEET = "Statistics";
var DASHBOARD_SHEET = "Dashboard";

// =======================================
// Menu on Open
// =======================================
function onOpen() {
  var ui = SpreadsheetApp.getUi();
  ui.createMenu("Admin Tools")
    .addItem("Approve Selected & Send Email", "approveSelectedAndSendEmail")
    .addItem("Reject Selected", "rejectSelected")
    .addSeparator()
    .addItem("Setup Email Trigger", "setupEmailTrigger")
    .addSeparator()
    .addItem("Setup Sheets", "setupSheets")
    .addToUi();
}

// =======================================
// Helper: Find column index by header name (0-based)
// =======================================
function getColumnIndex(sheet, headerName) {
  var lastCol = sheet.getLastColumn();
  if (lastCol === 0) return -1;
  var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  for (var i = 0; i < headers.length; i++) {
    if (headers[i].toString().trim().toLowerCase() === headerName.toLowerCase()) {
      return i;
    }
  }
  return -1;
}

// =======================================
// Helper: Get or create a sheet by name
// =======================================
function getOrCreateSheet(ss, name) {
  var sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
  }
  return sheet;
}

// =======================================
// Helper: Generate Request ID
// =======================================
function generateRequestId() {
  var now = new Date();
  var year = now.getFullYear().toString().slice(-2);
  var month = ("0" + (now.getMonth() + 1)).slice(-2);
  var day = ("0" + now.getDate()).slice(-2);
  var random = Math.floor(Math.random() * 9000 + 1000);
  return "REQ-" + year + month + day + "-" + random;
}

// =======================================
// Helper: Send approval email
// =======================================
function sendApprovalEmail(email, name) {
  if (!email) return;
  var encodedEmail = encodeURIComponent(email);
  var surveyUrl = SURVEY_LINK + "?email=" + encodedEmail;

  var subject = "Your Laptop Survey Access Has Been Approved!";
  var body = "Hello" + (name ? " " + name : "") + ",\n\n" +
    "Great news! Your request to participate in the Laptop Market Research Survey has been approved.\n\n" +
    "Click the link below to start the survey:\n" +
    surveyUrl + "\n\n" +
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

// =======================================
// Setup: Create all 4 sheets with headers and formulas
// =======================================
function setupSheets() {
  var ss = SpreadsheetApp.openById(SHEET_ID);

  // ---- Sheet 1: Requests ----
  var reqSheet = getOrCreateSheet(ss, REQUESTS_SHEET);
  var reqHeaders = ["Request ID", "Name", "Email", "Request Date & Time", "Status", "Approved By"];
  reqSheet.getRange(1, 1, 1, reqHeaders.length).setValues([reqHeaders]);
  reqSheet.getRange(1, 1, 1, reqHeaders.length).setFontWeight("bold");
  reqSheet.setFrozenRows(1);
  reqSheet.setColumnWidth(1, 150);
  reqSheet.setColumnWidth(2, 150);
  reqSheet.setColumnWidth(3, 220);
  reqSheet.setColumnWidth(4, 180);
  reqSheet.setColumnWidth(5, 120);
  reqSheet.setColumnWidth(6, 150);

  // ---- Sheet 2: Survey Responses ----
  var surSheet = getOrCreateSheet(ss, SURVEY_SHEET);
  var surHeaders = [
    "Timestamp", "Name", "Email",
    "Laptop Ownership", "Usage Purpose", "Useful Features",
    "Current Laptop Problems", "Satisfaction Level", "Improvement Needed",
    "Upgrade Frequency", "Preferred Brand", "Buying Factor",
    "Recommended Laptop", "Expected Laptop Life", "Budget",
    "Screen Size", "Preferred Laptop", "Buying Place",
    "Final Decision Factor", "Completion Time"
  ];
  surSheet.getRange(1, 1, 1, surHeaders.length).setValues([surHeaders]);
  surSheet.getRange(1, 1, 1, surHeaders.length).setFontWeight("bold");
  surSheet.setFrozenRows(1);

  // ---- Sheet 3: Statistics ----
  var statSheet = getOrCreateSheet(ss, STATS_SHEET);
  setupStatisticsSheet(statSheet);

  // ---- Sheet 4: Dashboard ----
  var dashSheet = getOrCreateSheet(ss, DASHBOARD_SHEET);
  setupDashboardSheet(dashSheet);

  Logger.log("All sheets set up successfully!");
  SpreadsheetApp.getUi().alert("All 4 sheets have been set up with headers and formulas!");
}

// =======================================
// Setup: Statistics sheet with COUNTIF formulas
// =======================================
function setupStatisticsSheet(statSheet) {
  statSheet.clear();

  // Define the questions and their possible options
  // Each entry: [Question Name, [Option1, Option2, ...]]
  var questions = [
    ["Laptop Ownership", ["Yes", "No"]],
    ["Usage Purpose", ["Education", "Work/Business", "Gaming", "Programming/Development", "Content Creation", "General Use", "Other"]],
    ["Useful Features", ["Performance/Speed", "Battery Life", "Display Quality", "Portability", "Build Quality", "Storage Capacity", "Keyboard/Trackpad", "Other"]],
    ["Current Laptop Problems", ["Slow Performance", "Poor Battery", "Overheating", "Screen Issues", "Storage Full", "Keyboard/Trackpad Issues", "Outdated Hardware", "No Problems"]],
    ["Satisfaction Level", ["Very Satisfied", "Satisfied", "Neutral", "Dissatisfied", "Very Dissatisfied"]],
    ["Improvement Needed", ["Better Performance", "Longer Battery Life", "Better Display", "More Storage", "Lighter Weight", "Better Build Quality", "Lower Price", "Other"]],
    ["Upgrade Frequency", ["Every Year", "Every 2 Years", "Every 3 Years", "Every 4-5 Years", "Never / Only When Broken"]],
    ["Preferred Brand", ["Apple", "Dell", "HP", "Lenovo", "Asus", "Acer", "Microsoft", "MSI", "Other"]],
    ["Buying Factor", ["Price", "Brand Reputation", "Performance", "Design/Aesthetics", "Battery Life", "Reviews", "Recommendation", "Other"]],
    ["Recommended Laptop", ["MacBook Air", "MacBook Pro", "Dell XPS", "HP Spectre", "Lenovo ThinkPad", "Asus ZenBook", "Other"]],
    ["Expected Laptop Life", ["1-2 Years", "2-3 Years", "3-4 Years", "4-5 Years", "5+ Years"]],
    ["Budget", ["Under 30,000", "30,000-50,000", "50,000-80,000", "80,000-1,00,000", "Above 1,00,000"]],
    ["Screen Size", ["11-12 inches", "13-14 inches", "15-16 inches", "17+ inches"]],
    ["Preferred Laptop", ["MacBook Air", "MacBook Pro", "Dell XPS", "HP Spectre", "Lenovo ThinkPad", "Asus ZenBook", "Acer Swift", "Other"]],
    ["Buying Place", ["Online (Amazon/Flipkart)", "Official Brand Store", "Local Retail Store", "Second-hand Market", "Other"]],
    ["Final Decision Factor", ["Budget", "Performance", "Brand", "Design", "Reviews", "Recommendation", "Warranty/Support", "Other"]]
  ];

  var currentRow = 1;

  for (var q = 0; q < questions.length; q++) {
    var questionName = questions[q][0];
    var options = questions[q][1];

    // Section header row
    statSheet.getRange(currentRow, 1, 1, 3).setValues([[questionName, "", ""]]);
    statSheet.getRange(currentRow, 1, 1, 3).setFontWeight("bold").setBackground("#4472C4").setFontColor("#FFFFFF");
    currentRow++;

    // Column headers
    statSheet.getRange(currentRow, 1, 1, 3).setValues([["Option Name", "Total Count", "Percentage"]]);
    statSheet.getRange(currentRow, 1, 1, 3).setFontWeight("bold").setBackground("#D9E2F3");
    currentRow++;

    // Data rows with COUNTIF formulas
    for (var o = 0; o < options.length; o++) {
      var option = options[o];
      // COUNTIF formula references the Survey Responses sheet
      // Find the column in Survey Responses that matches this question
      var countifFormula = '=COUNTIF(\'' + SURVEY_SHEET + '\'!' + questionName + ',"' + option + '")';
      var countifFormulaAlt = '=COUNTIF(\'' + SURVEY_SHEET + '\'!E:E,"' + option + '")';

      // We use INDIRECT approach or direct column reference
      // Since column positions may vary, we use a helper approach:
      // Get the column letter for the question in Survey Responses
      var colLetter = getQuestionColumnLetter(questionName);
      if (colLetter) {
        countifFormula = '=COUNTIF(\'' + SURVEY_SHEET + '\'!' + colLetter + ':' + colLetter + ',"' + option + '")';
      } else {
        countifFormula = '=COUNTIF(\'' + SURVEY_SHEET + '\'!E:E,"' + option + '")';
      }

      var totalResponsesCell = "COUNTA(\'" + SURVEY_SHEET + "\'!A:A)-1";
      var percentFormula = '=IF(COUNTA(\'' + SURVEY_SHEET + '\'!A:A)-1>0,B' + currentRow + '/(COUNTA(\'' + SURVEY_SHEET + '\'!A:A)-1),0)';

      statSheet.getRange(currentRow, 1).setValue(option);
      statSheet.getRange(currentRow, 2).setFormula(countifFormula);
      statSheet.getRange(currentRow, 3).setFormula(percentFormula);
      statSheet.getRange(currentRow, 3).setNumberFormat("0.0%");
      currentRow++;
    }

    // Empty separator row
    currentRow++;
  }

  statSheet.setColumnWidth(1, 300);
  statSheet.setColumnWidth(2, 120);
  statSheet.setColumnWidth(3, 120);
  statSheet.setFrozenRows(0);
}

// =======================================
// Helper: Get column letter for a question in Survey Responses
// =======================================
function getQuestionColumnLetter(questionName) {
  var ss = SpreadsheetApp.openById(SHEET_ID);
  var surSheet = ss.getSheetByName(SURVEY_SHEET);
  if (!surSheet) return null;
  if (surSheet.getLastColumn() === 0) return null;

  var headers = surSheet.getRange(1, 1, 1, surSheet.getLastColumn()).getValues()[0];
  for (var i = 0; i < headers.length; i++) {
    if (headers[i].toString().trim().toLowerCase() === questionName.toLowerCase()) {
      // Convert 0-based index to column letter (A=0, B=1, etc.)
      var colNum = i + 1;
      var letter = "";
      while (colNum > 0) {
        var mod = (colNum - 1) % 26;
        letter = String.fromCharCode(65 + mod) + letter;
        colNum = Math.floor((colNum - mod) / 26);
      }
      return letter;
    }
  }
  return null;
}

// =======================================
// Setup: Dashboard sheet with summary stats and charts
// =======================================
function setupDashboardSheet(dashSheet) {
  dashSheet.clear();

  // Section: Request Summary
  dashSheet.getRange("A1").setValue("Request Summary");
  dashSheet.getRange("A1").setFontWeight("bold").setFontSize(14).setBackground("#4472C4").setFontColor("#FFFFFF");
  dashSheet.getRange("A1:B1").merge().setBackground("#4472C4").setFontColor("#FFFFFF");

  var labels = ["Total Requests", "Pending", "Approved", "Rejected", "Total Responses", "Completion Rate"];
  var formulas = [
    '=COUNTA(\'' + REQUESTS_SHEET + '\'!A:A)-1',
    '=COUNTIF(\'' + REQUESTS_SHEET + '\'!E:E,"Pending")',
    '=COUNTIF(\'' + REQUESTS_SHEET + '\'!E:E,"Approved")',
    '=COUNTIF(\'' + REQUESTS_SHEET + '\'!E:E,"Rejected")',
    '=COUNTA(\'' + SURVEY_SHEET + '\'!A:A)-1',
    '=IF(COUNTA(\'' + REQUESTS_SHEET + '\'!A:A)-1>0,COUNTA(\'' + SURVEY_SHEET + '\'!A:A)-1,COUNTA(\'' + REQUESTS_SHEET + '\'!A:A)-1)'
  ];

  for (var i = 0; i < labels.length; i++) {
    var row = i + 2;
    dashSheet.getRange("A" + row).setValue(labels[i]).setFontWeight("bold");
    dashSheet.getRange("B" + row).setFormula(formulas[i]);
  }

  // Completion Rate formatting
  dashSheet.getRange("B7").setNumberFormat("0.0%");

  // Section: Survey Breakdown
  dashSheet.getRange("A9").setValue("Survey Breakdown");
  dashSheet.getRange("A9").setFontWeight("bold").setFontSize(14).setBackground("#4472C4").setFontColor("#FFFFFF");
  dashSheet.getRange("A9:B9").merge().setBackground("#4472C4").setFontColor("#FFFFFF");

  dashSheet.getRange("A10").setValue("Laptop Owners").setFontWeight("bold");
  dashSheet.getRange("B10").setFormula('=COUNTIF(\'' + SURVEY_SHEET + '\'!D:D,"Yes")');
  dashSheet.getRange("A11").setValue("Laptop Buyers").setFontWeight("bold");
  dashSheet.getRange("B11").setFormula('=COUNTIF(\'' + SURVEY_SHEET + '\'!D:D,"No")');
  dashSheet.getRange("A12").setValue("Owner Percentage").setFontWeight("bold");
  dashSheet.getRange("B12").setFormula('=IF(COUNTA(\'' + SURVEY_SHEET + '\'!A:A)-1>0,COUNTIF(\'' + SURVEY_SHEET + '\'!D:D,"Yes")/(COUNTA(\'' + SURVEY_SHEET + '\'!A:A)-1),0)');
  dashSheet.getRange("B12").setNumberFormat("0.0%");

  // Column widths
  dashSheet.setColumnWidth(1, 200);
  dashSheet.setColumnWidth(2, 150);

  // Create Pie Chart for Request Status
  var statusDataRange = dashSheet.getRange("A3:B5");
  var statusChart = dashSheet.newChart()
    .setChartType(Charts.ChartType.PIE)
    .addRange(statusDataRange)
    .setPosition("D1")
    .setOption("title", "Request Status Distribution")
    .setOption("width", 400)
    .setOption("height", 300)
    .build();
  dashSheet.insertChart(statusChart);

  // Create Bar Chart for Ownership
  var ownerDataRange = dashSheet.getRange("A10:B11");
  var ownerChart = dashSheet.newChart()
    .setChartType(Charts.ChartType.COLUMN)
    .addRange(ownerDataRange)
    .setPosition("D17")
    .setOption("title", "Laptop Ownership")
    .setOption("width", 400)
    .setOption("height", 300)
    .setOption("legend", { position: "none" })
    .build();
  dashSheet.insertChart(ownerChart);
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
  SpreadsheetApp.getUi().alert("Email trigger has been installed! Status changes to 'Approved' will trigger an email.");
}

function onStatusChange(e) {
  var sheet = e.source.getActiveSheet();
  var sheetName = sheet.getName();

  // Only monitor the Requests sheet
  if (sheetName !== REQUESTS_SHEET) return;

  var range = e.range;
  var row = range.getRow();
  var col = range.getColumn();

  if (row < 2) return; // Skip header row

  // Find the Status column dynamically
  var statusColIdx = getColumnIndex(sheet, "Status");
  if (statusColIdx === -1) return;
  var statusCol = statusColIdx + 1; // 1-based

  // Only proceed if the edited cell is the Status column
  if (col !== statusCol) return;

  var newStatus = range.getValue().toString().trim();

  // Only send email when status changes to "Approved"
  if (newStatus === "Approved") {
    var emailColIdx = getColumnIndex(sheet, "Email");
    var nameColIdx = getColumnIndex(sheet, "Name");
    var approvedByColIdx = getColumnIndex(sheet, "Approved By");

    var email = emailColIdx >= 0 ? sheet.getRange(row, emailColIdx + 1).getValue().toString().trim() : "";
    var name = nameColIdx >= 0 ? sheet.getRange(row, nameColIdx + 1).getValue().toString().trim() : "";

    // Set "Approved By" to current user
    if (approvedByColIdx >= 0) {
      sheet.getRange(row, approvedByColIdx + 1).setValue(Session.getActiveUser().getEmail());
    }

    if (email) {
      sendApprovalEmail(email, name);
    }
  }
}

// =======================================
// Web App Entry Points
// =======================================
function doGet(e) {
  var action = e.parameter.action;

  if (action === "checkAccess") {
    return checkAccess(e.parameter.email);
  } else if (action === "getSurveyData") {
    return getSurveyData();
  } else if (action === "getRequestData") {
    return getRequestData();
  } else if (action === "getDashboardStats") {
    return getDashboardStats();
  } else if (action === "debug") {
    return debugSheetInfo();
  }

  return ContentService.createTextOutput(JSON.stringify({ status: "error", message: "Unknown action" }))
    .setMimeType(ContentService.MimeType.JSON);
}

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
    var rowCount = data.length - 1;

    var sheetInfo = {
      name: name,
      headers: headers.map(function(h) { return h.toString(); }),
      totalRows: rowCount,
      sampleRows: []
    };

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
  var sheet = ss.getSheetByName(REQUESTS_SHEET);

  if (!sheet) {
    return ContentService.createTextOutput(JSON.stringify({
      status: "error",
      message: "Requests sheet not found. Please run Setup Sheets first."
    })).setMimeType(ContentService.MimeType.JSON);
  }

  var email = (data.email || "").toString().trim();
  var name = (data.name || "").toString().trim();
  var mobile = (data.mobile || "").toString().trim();
  var purpose = (data.purpose || "").toString().trim();

  if (!email) {
    return ContentService.createTextOutput(JSON.stringify({
      status: "error",
      message: "Email is required"
    })).setMimeType(ContentService.MimeType.JSON);
  }

  // Find column indices dynamically
  var emailColIdx = getColumnIndex(sheet, "Email");
  var statusColIdx = getColumnIndex(sheet, "Status");
  var nameColIdx = getColumnIndex(sheet, "Name");

  // Check if email already exists
  var allData = sheet.getDataRange().getValues();
  for (var i = 1; i < allData.length; i++) {
    if (emailColIdx >= 0 && allData[i][emailColIdx].toString().trim().toLowerCase() === email.toLowerCase()) {
      var existingStatus = statusColIdx >= 0 ? allData[i][statusColIdx].toString().trim() : "Unknown";
      var existingName = nameColIdx >= 0 ? allData[i][nameColIdx].toString().trim() : "";
      return ContentService.createTextOutput(JSON.stringify({
        status: "exists",
        currentStatus: existingStatus,
        message: "Email already exists with status: " + existingStatus
      })).setMimeType(ContentService.MimeType.JSON);
    }
  }

  // Generate Request ID
  var requestId = generateRequestId();

  // Build new row based on existing headers
  var headers = allData[0];
  var newRow = [];
  for (var h = 0; h < headers.length; h++) {
    var header = headers[h].toString().trim().toLowerCase();
    if (header === "request id") {
      newRow.push(requestId);
    } else if (header === "name") {
      newRow.push(name);
    } else if (header === "email") {
      newRow.push(email);
    } else if (header === "request date & time" || header === "request date" || header === "timestamp") {
      newRow.push(new Date());
    } else if (header === "status") {
      newRow.push("Pending");
    } else if (header === "approved by") {
      newRow.push("");
    } else if (header === "mobile" || header === "mobile number") {
      newRow.push(mobile);
    } else if (header === "purpose" || header === "comment") {
      newRow.push(purpose);
    } else {
      newRow.push("");
    }
  }

  sheet.appendRow(newRow);

  return ContentService.createTextOutput(JSON.stringify({
    status: "success",
    requestId: requestId,
    message: "Access request submitted. Status: Pending"
  })).setMimeType(ContentService.MimeType.JSON);
}

// =======================================
// Check Access Status
// =======================================
function checkAccess(email) {
  var ss = SpreadsheetApp.openById(SHEET_ID);
  var sheet = ss.getSheetByName(REQUESTS_SHEET);

  if (!sheet) {
    return ContentService.createTextOutput(JSON.stringify({
      status: "not_found",
      accessStatus: "None"
    })).setMimeType(ContentService.MimeType.JSON);
  }

  if (!email) {
    return ContentService.createTextOutput(JSON.stringify({
      status: "not_found",
      accessStatus: "None"
    })).setMimeType(ContentService.MimeType.JSON);
  }

  var allData = sheet.getDataRange().getValues();

  if (allData.length <= 1) {
    return ContentService.createTextOutput(JSON.stringify({
      status: "not_found",
      accessStatus: "None"
    })).setMimeType(ContentService.MimeType.JSON);
  }

  // Find column indices dynamically by header name
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

  // Search for the email
  for (var i = 1; i < allData.length; i++) {
    var cellValue = allData[i][emailColIdx].toString().trim().toLowerCase();
    if (cellValue === email.toLowerCase()) {
      var statusValue = statusColIdx >= 0 ? allData[i][statusColIdx].toString().trim() : "Unknown";
      var nameValue = nameColIdx >= 0 ? allData[i][nameColIdx].toString().trim() : "";

      // Map status values to the expected accessStatus format
      var accessStatus = "None";
      if (statusValue === "Approved" || statusValue === "Accepted") {
        accessStatus = "Accepted";
      } else if (statusValue === "Rejected") {
        accessStatus = "Rejected";
      } else if (statusValue === "Pending") {
        accessStatus = "Pending";
      }

      return ContentService.createTextOutput(JSON.stringify({
        status: "found",
        accessStatus: accessStatus,
        name: nameValue
      })).setMimeType(ContentService.MimeType.JSON);
    }
  }

  return ContentService.createTextOutput(JSON.stringify({
    status: "not_found",
    accessStatus: "None"
  })).setMimeType(ContentService.MimeType.JSON);
}

// =======================================
// Survey Response Handler
// =======================================
function handleSurveyResponse(data) {
  var ss = SpreadsheetApp.openById(SHEET_ID);
  var sheet = ss.getSheetByName(SURVEY_SHEET);

  if (!sheet) {
    return ContentService.createTextOutput(JSON.stringify({
      status: "error",
      message: "Survey Responses sheet not found. Please run Setup Sheets first."
    })).setMimeType(ContentService.MimeType.JSON);
  }

  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  var row = [];

  for (var h = 0; h < headers.length; h++) {
    var header = headers[h].toString().trim();
    var headerLower = header.toLowerCase();

    if (headerLower === "timestamp") {
      row.push(new Date());
    } else if (headerLower === "email") {
      row.push(data.email || "");
    } else if (headerLower === "name") {
      row.push(data.name || "");
    } else if (headerLower === "completion time") {
      row.push(data.completionTime || data["Completion Time"] || "");
    } else {
      // Try exact match first, then case-insensitive match
      var value = data[header];
      if (value === undefined || value === null) {
        // Try case-insensitive search in data keys
        var keys = Object.keys(data);
        for (var k = 0; k < keys.length; k++) {
          if (keys[k].toLowerCase() === headerLower) {
            value = data[keys[k]];
            break;
          }
        }
      }
      row.push(value !== undefined && value !== null ? value : "");
    }
  }

  sheet.appendRow(row);

  // Update Statistics sheet (recalculate by touching it)
  updateStatistics(ss);

  return ContentService.createTextOutput(JSON.stringify({
    status: "success",
    message: "Survey response recorded"
  })).setMimeType(ContentService.MimeType.JSON);
}

// =======================================
// Update Statistics (refresh formulas)
// =======================================
function updateStatistics(ss) {
  var statSheet = ss.getSheetByName(STATS_SHEET);
  if (!statSheet) return;

  // The COUNTIF formulas in Statistics auto-update when new data is added.
  // However, we can force a refresh by re-calculating.
  // SpreadsheetApp.flush() ensures all pending writes are committed.
  SpreadsheetApp.flush();
}

// =======================================
// Get Survey Data (for Dashboard)
// =======================================
function getSurveyData() {
  var ss = SpreadsheetApp.openById(SHEET_ID);
  var sheet = ss.getSheetByName(SURVEY_SHEET);

  if (!sheet) {
    return ContentService.createTextOutput(JSON.stringify([]))
      .setMimeType(ContentService.MimeType.JSON);
  }

  var data = sheet.getDataRange().getValues();
  if (data.length <= 1) {
    return ContentService.createTextOutput(JSON.stringify([]))
      .setMimeType(ContentService.MimeType.JSON);
  }

  var headers = data[0];
  var result = [];

  for (var i = 1; i < data.length; i++) {
    var row = {};
    for (var j = 0; j < headers.length; j++) {
      var key = headers[j].toString().trim();
      var val = data[i][j];
      if (val instanceof Date) {
        val = val.toISOString();
      }
      row[key] = val;
    }
    result.push(row);
  }

  return ContentService.createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}

// =======================================
// Get Request Data (for Dashboard)
// =======================================
function getRequestData() {
  var ss = SpreadsheetApp.openById(SHEET_ID);
  var sheet = ss.getSheetByName(REQUESTS_SHEET);

  if (!sheet) {
    return ContentService.createTextOutput(JSON.stringify([]))
      .setMimeType(ContentService.MimeType.JSON);
  }

  var data = sheet.getDataRange().getValues();
  if (data.length <= 1) {
    return ContentService.createTextOutput(JSON.stringify([]))
      .setMimeType(ContentService.MimeType.JSON);
  }

  var headers = data[0];
  var result = [];

  for (var i = 1; i < data.length; i++) {
    var row = {};
    for (var j = 0; j < headers.length; j++) {
      var key = headers[j].toString().trim();
      var val = data[i][j];
      if (val instanceof Date) {
        val = val.toISOString();
      }
      row[key] = val;
    }
    result.push(row);
  }

  return ContentService.createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}

// =======================================
// Get Dashboard Stats
// =======================================
function getDashboardStats() {
  var ss = SpreadsheetApp.openById(SHEET_ID);

  var totalRequests = 0;
  var pending = 0;
  var approved = 0;
  var rejected = 0;
  var totalResponses = 0;
  var ownerCount = 0;
  var buyerCount = 0;

  // Get request stats
  var reqSheet = ss.getSheetByName(REQUESTS_SHEET);
  if (reqSheet) {
    var reqData = reqSheet.getDataRange().getValues();
    if (reqData.length > 1) {
      var reqHeaders = reqData[0];
      var statusColIdx = -1;
      for (var h = 0; h < reqHeaders.length; h++) {
        if (reqHeaders[h].toString().trim().toLowerCase() === "status") {
          statusColIdx = h;
          break;
        }
      }
      totalRequests = reqData.length - 1;
      for (var i = 1; i < reqData.length; i++) {
        if (statusColIdx >= 0) {
          var status = reqData[i][statusColIdx].toString().trim();
          if (status === "Pending") pending++;
          else if (status === "Approved" || status === "Accepted") approved++;
          else if (status === "Rejected") rejected++;
        }
      }
    }
  }

  // Get survey stats
  var surSheet = ss.getSheetByName(SURVEY_SHEET);
  if (surSheet) {
    var surData = surSheet.getDataRange().getValues();
    if (surData.length > 1) {
      var surHeaders = surData[0];
      var ownershipColIdx = -1;
      for (var h = 0; h < surHeaders.length; h++) {
        if (surHeaders[h].toString().trim().toLowerCase() === "laptop ownership") {
          ownershipColIdx = h;
          break;
        }
      }
      totalResponses = surData.length - 1;
      for (var i = 1; i < surData.length; i++) {
        if (ownershipColIdx >= 0) {
          var ownership = surData[i][ownershipColIdx].toString().trim();
          if (ownership === "Yes") ownerCount++;
          else if (ownership === "No") buyerCount++;
        }
      }
    }
  }

  var ownerPercent = totalResponses > 0 ? (ownerCount / totalResponses) : 0;
  var completionRate = approved > 0 ? (totalResponses / approved) : 0;

  var result = {
    totalRequests: totalRequests,
    pending: pending,
    approved: approved,
    rejected: rejected,
    totalResponses: totalResponses,
    ownerCount: ownerCount,
    buyerCount: buyerCount,
    ownerPercent: ownerPercent,
    completionRate: completionRate
  };

  return ContentService.createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}

// =======================================
// Admin Tools: Approve Selected & Send Email
// =======================================
function approveSelectedAndSendEmail() {
  var ss = SpreadsheetApp.openById(SHEET_ID);
  var sheet = ss.getSheetByName(REQUESTS_SHEET);

  if (!sheet) {
    SpreadsheetApp.getUi().alert("Requests sheet not found!");
    return;
  }

  var allData = sheet.getDataRange().getValues();

  // Find column indices dynamically
  var headers = allData[0];
  var emailColIdx = -1;
  var statusColIdx = -1;
  var nameColIdx = -1;
  var approvedByColIdx = -1;

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
    if (header === "approved by") {
      approvedByColIdx = h;
    }
  }

  var approvedCount = 0;
  var currentUser = Session.getActiveUser().getEmail();

  for (var i = 1; i < allData.length; i++) {
    var status = allData[i][statusColIdx].toString().trim();

    if (status === "Pending") {
      var email = allData[i][emailColIdx].toString().trim();
      var name = nameColIdx >= 0 ? allData[i][nameColIdx].toString().trim() : "";

      // Update status to Approved (1-based row, 1-based column)
      sheet.getRange(i + 1, statusColIdx + 1).setValue("Approved");

      // Set Approved By
      if (approvedByColIdx >= 0) {
        sheet.getRange(i + 1, approvedByColIdx + 1).setValue(currentUser);
      }

      // Send approval email
      if (email) {
        sendApprovalEmail(email, name);
      }

      approvedCount++;
    }
  }

  Logger.log("Approved " + approvedCount + " request(s) and sent emails.");
  SpreadsheetApp.getUi().alert("Approved " + approvedCount + " request(s) and sent emails.");
}

// =======================================
// Admin Tools: Reject Selected
// =======================================
function rejectSelected() {
  var ss = SpreadsheetApp.openById(SHEET_ID);
  var sheet = ss.getSheetByName(REQUESTS_SHEET);

  if (!sheet) {
    SpreadsheetApp.getUi().alert("Requests sheet not found!");
    return;
  }

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
  SpreadsheetApp.getUi().alert("Rejected " + rejectedCount + " request(s).");
}
