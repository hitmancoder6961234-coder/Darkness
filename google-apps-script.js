// ===============================
// Laptop Market Research
// Google Apps Script (Backend)
// 4-Sheet Structure: Requests, Survey Responses, Statistics, Dashboard
// ===============================
// Deploy as Web App with access: "Anyone"
// Set up the installable trigger by running setupEmailTrigger() once from the script editor

// IMPORTANT: Replace with your actual spreadsheet ID
var SHEET_ID = "1EMN7aNgwx9cy02tlMqnWeVAFnfh4quGbW_DPboLPuqM";

// =======================================
// Safe Alert Helper (works in ALL contexts)
// =======================================
function showAlert(msg) {
  try {
    SpreadsheetApp.getUi().alert(msg);
  } catch (e) {
    Logger.log("ALERT: " + msg);
  }
}

var SURVEY_LINK = "https://hitmancoder6961234-coder.github.io/Darkness/survey.html";

// =======================================
// Survey Headers Definition (used in setup & statistics)
// =======================================
var SURVEY_HEADERS = [
  "Timestamp", "Name", "Email",
  "Laptop Ownership", "Usage Purpose", "Useful Features",
  "Current Laptop Problems", "Satisfaction Level", "Improvement Needed",
  "Upgrade Frequency", "Preferred Brand", "Buying Factor",
  "Recommended Laptop", "Expected Laptop Life", "Budget",
  "Screen Size", "Preferred Laptop", "Buying Place",
  "Final Decision Factor", "Final Recommendation", "Completion Time"
];

// =======================================
// Helper: Column number to letter (A, B, C, ... Z, AA, AB, etc.)
// =======================================
function columnToLetter(column) {
  var temp, letter = "";
  while (column > 0) {
    temp = (column - 1) % 26;
    letter = String.fromCharCode(temp + 65) + letter;
    column = Math.floor((column - temp) / 26);
  }
  return letter;
}

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
    .addItem("Rebuild Statistics", "rebuildStatistics")
    .addItem("Rebuild Dashboard Charts", "rebuildDashboardCharts")
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
// Generate unique Request ID
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
// Setup: Create all 4 sheets with headers and formulas
// =======================================
function setupSheets() {
  var ss = SpreadsheetApp.openById(SHEET_ID);

  // ---- Sheet 1: Requests ----
  var reqSheet = getOrCreateSheet(ss, REQUESTS_SHEET);
  if (!reqSheet) {
    showAlert("Error: Could not create Requests sheet. Check your SHEET_ID.");
    return;
  }
  var reqHeaders = ["CPRN Number", "Name", "Email", "Mobile", "Purpose", "Request Date & Time", "Status", "Approved By"];
  if (reqSheet.getLastRow() === 0) {
    reqSheet.getRange(1, 1, 1, reqHeaders.length).setValues([reqHeaders]);
    reqSheet.getRange(1, 1, 1, reqHeaders.length).setFontWeight("bold").setBackground("#4472C4").setFontColor("#FFFFFF");
    reqSheet.setFrozenRows(1);
  }
  reqSheet.setColumnWidth(1, 150);
  reqSheet.setColumnWidth(2, 150);
  reqSheet.setColumnWidth(3, 220);
  reqSheet.setColumnWidth(4, 140);
  reqSheet.setColumnWidth(5, 200);
  reqSheet.setColumnWidth(6, 180);
  reqSheet.setColumnWidth(7, 100);
  reqSheet.setColumnWidth(8, 150);

  // ---- Sheet 2: Survey Responses ----
  var surSheet = getOrCreateSheet(ss, SURVEY_SHEET);
  if (surSheet.getLastRow() === 0) {
    surSheet.getRange(1, 1, 1, SURVEY_HEADERS.length).setValues([SURVEY_HEADERS]);
    surSheet.getRange(1, 1, 1, SURVEY_HEADERS.length).setFontWeight("bold").setBackground("#548235").setFontColor("#FFFFFF");
    surSheet.setFrozenRows(1);
  }
  SpreadsheetApp.flush();

  // ---- Sheet 3: Statistics ----
  setupStatisticsSheet(ss);

  // ---- Sheet 4: Dashboard ----
  setupDashboardSheet(ss);

  showAlert("All 4 sheets are set up and ready!");
}

// =======================================
// Setup: Statistics Sheet
// =======================================
function setupStatisticsSheet(ss) {
  var statsSheet = getOrCreateSheet(ss, STATS_SHEET);
  if (!statsSheet) return;

  // Direct column map from SURVEY_HEADERS (avoids calling getQuestionColumnLetter on a fresh sheet)
  var questionColMap = {};
  for (var i = 0; i < SURVEY_HEADERS.length; i++) {
    var header = SURVEY_HEADERS[i].trim();
    var skipList = ["Timestamp", "Name", "Email", "Completion Time"];
    if (skipList.indexOf(header) === -1) {
      questionColMap[header] = columnToLetter(i + 1);
    }
  }

  // Overview section
  var row = 1;
  statsSheet.getRange(row, 1).setValue("Laptop Market Research - Statistics Overview");
  statsSheet.getRange(row, 1, 1, 3).setFontWeight("bold").setFontSize(14).setBackground("#4472C4").setFontColor("#FFFFFF");
  row++;

  statsSheet.getRange(row, 1).setValue("Metric");
  statsSheet.getRange(row, 2).setValue("Value");
  statsSheet.getRange(row, 1, 1, 2).setFontWeight("bold");
  row++;

  var metrics = [
    ["Total Requests", '=COUNTA(\'' + REQUESTS_SHEET + '\'!A:A)-1'],
    ["Pending Requests", '=COUNTIF(\'' + REQUESTS_SHEET + '\'!G:G,"Pending")'],
    ["Approved Requests", '=COUNTIF(\'' + REQUESTS_SHEET + '\'!G:G,"Approved")'],
    ["Rejected Requests", '=COUNTIF(\'' + REQUESTS_SHEET + '\'!G:G,"Rejected")'],
    ["Survey Completion Rate", '=IF(COUNTA(\'' + REQUESTS_SHEET + '\'!A:A)-1>0,(COUNTA(\'' + SURVEY_SHEET + '\'!A:A)-1)/(COUNTA(\'' + REQUESTS_SHEET + '\'!A:A)-1),0)'],
    ["Total Survey Responses", '=COUNTA(\'' + SURVEY_SHEET + '\'!A:A)-1']
  ];

  for (var m = 0; m < metrics.length; m++) {
    statsSheet.getRange(row + m, 1).setValue(metrics[m][0]);
    statsSheet.getRange(row + m, 2).setValue(metrics[m][1]);
  }
  row += metrics.length + 1;

  // Per-question breakdown
  statsSheet.getRange(row, 1).setValue("Question Breakdown");
  statsSheet.getRange(row, 1, 1, 3).setFontWeight("bold").setFontSize(12).setBackground("#548235").setFontColor("#FFFFFF");
  row++;

  var questionNames = Object.keys(questionColMap);
  for (var q = 0; q < questionNames.length; q++) {
    var qName = questionNames[q];
    var colLetter = questionColMap[qName];
    var totalFormula = '=COUNTA(\'' + SURVEY_SHEET + '\'!' + colLetter + ':' + colLetter + ')-1';

    statsSheet.getRange(row, 1).setValue(qName);
    statsSheet.getRange(row, 1).setFontWeight("bold");
    statsSheet.getRange(row, 2).setValue("Total Responses");
    statsSheet.getRange(row, 3).setValue(totalFormula);
    row++;

    // Get unique values for this question
    var surSheet = ss.getSheetByName(SURVEY_SHEET);
    if (surSheet && surSheet.getLastRow() > 1) {
      var colIdx = -1;
      var surHeaders = surSheet.getRange(1, 1, 1, surSheet.getLastColumn()).getValues()[0];
      for (var h = 0; h < surHeaders.length; h++) {
        if (surHeaders[h].toString().trim() === qName) {
          colIdx = h;
          break;
        }
      }

      if (colIdx >= 0) {
        var surData = surSheet.getRange(2, colIdx + 1, surSheet.getLastRow() - 1, 1).getValues();
        var uniqueValues = {};
        for (var d = 0; d < surData.length; d++) {
          var val = surData[d][0].toString().trim();
          if (val !== "") {
            uniqueValues[val] = (uniqueValues[val] || 0) + 1;
          }
        }

        var valueKeys = Object.keys(uniqueValues);
        for (var v = 0; v < valueKeys.length; v++) {
          statsSheet.getRange(row, 1).setValue("  " + valueKeys[v]);
          statsSheet.getRange(row, 2).setValue(uniqueValues[valueKeys[v]]);
          statsSheet.getRange(row, 3).setValue('=COUNTIF(\'' + SURVEY_SHEET + '\'!' + colLetter + ':' + colLetter + ',"' + valueKeys[v] + '")');
          row++;
        }
      }
    }
    row++;
  }

  statsSheet.setColumnWidth(1, 300);
  statsSheet.setColumnWidth(2, 200);
  statsSheet.setColumnWidth(3, 200);
}

// =======================================
// Setup: Dashboard Sheet with Charts
// =======================================
function setupDashboardSheet(ss) {
  var dashSheet = getOrCreateSheet(ss, DASHBOARD_SHEET);
  if (!dashSheet) return;

  // Clear existing content
  dashSheet.clear();

  // Title
  dashSheet.getRange(1, 1).setValue("Laptop Market Research - Dashboard");
  dashSheet.getRange(1, 1, 1, 4).setFontWeight("bold").setFontSize(16).setBackground("#4472C4").setFontColor("#FFFFFF");

  // Summary stats
  dashSheet.getRange(3, 1).setValue("Total Requests");
  dashSheet.getRange(3, 2).setValue('=COUNTA(\'' + REQUESTS_SHEET + '\'!A:A)-1');
  dashSheet.getRange(4, 1).setValue("Pending");
  dashSheet.getRange(4, 2).setValue('=COUNTIF(\'' + REQUESTS_SHEET + '\'!G:G,"Pending")');
  dashSheet.getRange(5, 1).setValue("Approved");
  dashSheet.getRange(5, 2).setValue('=COUNTIF(\'' + REQUESTS_SHEET + '\'!G:G,"Approved")');
  dashSheet.getRange(6, 1).setValue("Rejected");
  dashSheet.getRange(6, 2).setValue('=COUNTIF(\'' + REQUESTS_SHEET + '\'!G:G,"Rejected")');
  dashSheet.getRange(7, 1).setValue("Survey Responses");
  dashSheet.getRange(7, 2).setValue('=COUNTA(\'' + SURVEY_SHEET + '\'!A:A)-1');

  dashSheet.setColumnWidth(1, 200);
  dashSheet.setColumnWidth(2, 150);

  // Create charts
  createDashboardCharts(ss, dashSheet);
}

// =======================================
// Create Dashboard Charts
// =======================================
function createDashboardCharts(ss, dashSheet) {
  // Remove existing charts
  var charts = dashSheet.getCharts();
  for (var c = 0; c < charts.length; c++) {
    dashSheet.removeChart(charts[c]);
  }

  // ---- Request Status Pie Chart ----
  var reqSheet = ss.getSheetByName(REQUESTS_SHEET);
  if (reqSheet && reqSheet.getLastRow() > 1) {
    var statusData = reqSheet.getDataRange().getValues();
    var statusColIdx = getColumnIndex(reqSheet, "Status");

    if (statusColIdx >= 0) {
      var statusCounts = {};
      for (var i = 1; i < statusData.length; i++) {
        var status = statusData[i][statusColIdx].toString().trim();
        if (status) statusCounts[status] = (statusCounts[status] || 0) + 1;
      }

      // Write chart data to hidden area
      var chartStartRow = 20;
      dashSheet.getRange(chartStartRow, 1).setValue("Status");
      dashSheet.getRange(chartStartRow, 2).setValue("Count");
      var keys = Object.keys(statusCounts);
      for (var k = 0; k < keys.length; k++) {
        dashSheet.getRange(chartStartRow + 1 + k, 1).setValue(keys[k]);
        dashSheet.getRange(chartStartRow + 1 + k, 2).setValue(statusCounts[keys[k]]);
      }

      var chartRange = dashSheet.getRange(chartStartRow, 1, keys.length + 1, 2);
      var chart = dashSheet.newChart()
        .setChartType(Charts.ChartType.PIE)
        .addRange(chartRange)
        .setOption("title", "Request Status")
        .setOption("width", 400)
        .setOption("height", 300)
        .setPosition(1, 4, 0, 0)
        .build();
      dashSheet.insertChart(chart);
    }
  }

  // ---- Laptop Ownership Pie Chart ----
  var surSheet = ss.getSheetByName(SURVEY_SHEET);
  if (surSheet && surSheet.getLastRow() > 1) {
    var ownershipColIdx = getColumnIndex(surSheet, "Laptop Ownership");
    if (ownershipColIdx >= 0) {
      var surData = surSheet.getDataRange().getValues();
      var ownershipCounts = {};
      for (var i = 1; i < surData.length; i++) {
        var val = surData[i][ownershipColIdx].toString().trim();
        if (val) ownershipCounts[val] = (ownershipCounts[val] || 0) + 1;
      }

      var chartStartRow2 = 30;
      dashSheet.getRange(chartStartRow2, 1).setValue("Ownership");
      dashSheet.getRange(chartStartRow2, 2).setValue("Count");
      var oKeys = Object.keys(ownershipCounts);
      for (var k = 0; k < oKeys.length; k++) {
        dashSheet.getRange(chartStartRow2 + 1 + k, 1).setValue(oKeys[k]);
        dashSheet.getRange(chartStartRow2 + 1 + k, 2).setValue(ownershipCounts[oKeys[k]]);
      }

      var chartRange2 = dashSheet.getRange(chartStartRow2, 1, oKeys.length + 1, 2);
      var chart2 = dashSheet.newChart()
        .setChartType(Charts.ChartType.PIE)
        .addRange(chartRange2)
        .setOption("title", "Laptop Ownership")
        .setOption("width", 400)
        .setOption("height", 300)
        .setPosition(1, 8, 0, 0)
        .build();
      dashSheet.insertChart(chart2);
    }

    // ---- Brand Preference Bar Chart ----
    var brandColIdx = getColumnIndex(surSheet, "Preferred Brand");
    if (brandColIdx >= 0) {
      var surData2 = surSheet.getDataRange().getValues();
      var brandCounts = {};
      for (var i = 1; i < surData2.length; i++) {
        var val = surData2[i][brandColIdx].toString().trim();
        if (val) brandCounts[val] = (brandCounts[val] || 0) + 1;
      }

      var chartStartRow3 = 40;
      dashSheet.getRange(chartStartRow3, 1).setValue("Brand");
      dashSheet.getRange(chartStartRow3, 2).setValue("Count");
      var bKeys = Object.keys(brandCounts);
      for (var k = 0; k < bKeys.length; k++) {
        dashSheet.getRange(chartStartRow3 + 1 + k, 1).setValue(bKeys[k]);
        dashSheet.getRange(chartStartRow3 + 1 + k, 2).setValue(brandCounts[bKeys[k]]);
      }

      var chartRange3 = dashSheet.getRange(chartStartRow3, 1, bKeys.length + 1, 2);
      var chart3 = dashSheet.newChart()
        .setChartType(Charts.ChartType.BAR)
        .addRange(chartRange3)
        .setOption("title", "Preferred Brand")
        .setOption("width", 400)
        .setOption("height", 300)
        .setPosition(16, 4, 0, 0)
        .build();
      dashSheet.insertChart(chart3);
    }
  }
}

// =======================================
// Rebuild Statistics (admin tool)
// =======================================
function rebuildStatistics() {
  var ss = SpreadsheetApp.openById(SHEET_ID);
  var statsSheet = ss.getSheetByName(STATS_SHEET);
  if (statsSheet) {
    statsSheet.clear();
  }
  setupStatisticsSheet(ss);
  showAlert("Statistics sheet rebuilt!");
}

// =======================================
// Rebuild Dashboard Charts (admin tool)
// =======================================
function rebuildDashboardCharts() {
  var ss = SpreadsheetApp.openById(SHEET_ID);
  var dashSheet = ss.getSheetByName(DASHBOARD_SHEET);
  if (dashSheet) {
    createDashboardCharts(ss, dashSheet);
    showAlert("Dashboard charts rebuilt!");
  } else {
    showAlert("Dashboard sheet not found. Run Setup Sheets first.");
  }
}

// =======================================
// Installable Trigger: Auto-email on approval
// =======================================
function setupEmailTrigger() {
  // Remove existing triggers
  var triggers = ScriptApp.getProjectTriggers();
  for (var t = 0; t < triggers.length; t++) {
    ScriptApp.deleteTrigger(triggers[t]);
  }

  ScriptApp.newTrigger("onEditApproval")
    .forSpreadsheet(SpreadsheetApp.openById(SHEET_ID))
    .onEdit()
    .create();

  showAlert("Email trigger set up! Approving requests will auto-send emails.");
}

function onEditApproval(e) {
  var sheetName = e.source.getActiveSheet().getName();
  if (sheetName !== REQUESTS_SHEET) return;

  var range = e.range;
  var column = range.getColumn();
  var row = range.getRow();

  // Check if Status column (column 7 = G) was edited
  if (column !== 7) return;
  if (row <= 1) return; // Skip header

  var newValue = range.getValue().toString().trim();
  if (newValue !== "Approved") return;

  var sheet = e.source.getActiveSheet();
  var email = sheet.getRange(row, 3).getValue().toString().trim(); // Column C = Email
  var name = sheet.getRange(row, 2).getValue().toString().trim(); // Column B = Name

  if (email) {
    sendApprovalEmail(email, name);
  }
}

// =======================================
// GET Handler
// =======================================
function doGet(e) {
  var action = e.parameter.action;

  if (action === "checkAccess") {
    // Public by design: the survey sign-in screen asks "is this email approved?"
    return checkAccess(e.parameter.email);
  } else if (
    action === "getSurveyData" || action === "getRequestData" || action === "getDashboardStats" ||
    action === "getDashboardData" || action === "debug" || action === "testPost"
  ) {
    // These used to be public and returned every respondent's name / email / mobile (and "testPost"
    // wrote to the sheet). They now require an admin login: use the POST action "adminData".
    return adminJson({ status: "error", code: "auth", message: "Login required. Sign in at admin.html." });
  }

  return ContentService.createTextOutput(JSON.stringify({ status: "error", message: "Unknown action" }))
    .setMimeType(ContentService.MimeType.JSON);
}

// =======================================
// POST Handler
// Accepts URL-encoded form data (e.parameter) AND JSON body (e.postData)
// Frontend sends application/x-www-form-urlencoded with mode: "no-cors"
// This is the ONLY reliable method for Google Apps Script Web Apps:
// - application/x-www-form-urlencoded is a "simple request" (no CORS preflight)
// - mode: "no-cors" handles the Apps Script redirect (response is opaque but data IS sent)
// - Google Apps Script parses URL-encoded data into e.parameter automatically
// =======================================
function doPost(e) {
  var data = {};

  // Log what we received for debugging
  Logger.log("doPost called");
  Logger.log("e.parameter: " + JSON.stringify(e.parameter));
  if (e.postData) {
    Logger.log("e.postData.type: " + e.postData.type);
    Logger.log("e.postData.contents: " + e.postData.contents);
  }

  // Try to read from e.parameter (URL-encoded form data)
  if (e.parameter && Object.keys(e.parameter).length > 0) {
    var keys = Object.keys(e.parameter);
    for (var i = 0; i < keys.length; i++) {
      data[keys[i]] = e.parameter[keys[i]];
    }
    Logger.log("Data from e.parameter: " + JSON.stringify(data));
  } else if (e.postData && e.postData.contents) {
    // Fallback: try JSON body
    try {
      data = JSON.parse(e.postData.contents);
      Logger.log("Data from e.postData: " + JSON.stringify(data));
    } catch (err) {
      Logger.log("Parse error: " + err.message);
      return ContentService.createTextOutput(JSON.stringify({
        status: "error",
        message: "Could not parse request data: " + err.message
      })).setMimeType(ContentService.MimeType.JSON);
    }
  } else {
    Logger.log("No data received in doPost");
    return ContentService.createTextOutput(JSON.stringify({
      status: "error",
      message: "No data received"
    })).setMimeType(ContentService.MimeType.JSON);
  }

  var action = data.action;
  Logger.log("Action: " + action);

  if (action === "accessRequest") {
    return handleAccessRequest(data);
  } else if (action === "surveyResponse") {
    return handleSurveyResponse(data);
  } else if (action === "adminLogin") {
    return handleAdminLogin(data);
  } else if (action === "adminSession") {
    return handleAdminSession(data);
  } else if (action === "adminData") {
    return handleAdminData(data);
  } else if (action === "adminSetStatus") {
    return handleAdminSetStatus(data);
  }

  return ContentService.createTextOutput(JSON.stringify({ status: "error", message: "Unknown action: " + action }))
    .setMimeType(ContentService.MimeType.JSON);
}

// =======================================
// Test POST Handler (via GET for easy browser testing)
// Open this URL in your browser to test if data gets written to the sheet
// =======================================
function testPostHandler(params) {
  var testData = {
    action: "accessRequest",
    cprn: "TEST-001",
    name: "Test User",
    email: "test@example.com",
    mobile: "1234567890",
    purpose: "This is a test from the testPost endpoint"
  };
  var result = handleAccessRequest(testData);
  return ContentService.createTextOutput(
    "<h2>Test Post Result</h2>" +
    "<p>Sent test data to handleAccessRequest:</p>" +
    "<pre>" + JSON.stringify(testData, null, 2) + "</pre>" +
    "<p>Result:</p>" +
    "<pre>" + result.getContent() + "</pre>" +
    '<p><a href="https://docs.google.com/spreadsheets/d/' + SHEET_ID + '">Open Spreadsheet</a></p>'
  ).setMimeType(ContentService.MimeType.HTML);
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
  var cprn = (data.cprn || data["CPRN Number"] || data.cprnNumber || "").toString().trim();

  if (!email) {
    return ContentService.createTextOutput(JSON.stringify({
      status: "error",
      message: "Email is required"
    })).setMimeType(ContentService.MimeType.JSON);
  }

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

  var requestId = generateRequestId();

  var headers = allData[0];
  var newRow = [];
  for (var h = 0; h < headers.length; h++) {
    var header = headers[h].toString().trim().toLowerCase();
    if (header === "cprn number" || header === "cprn" || header === "request id") {
      newRow.push(cprn || requestId);
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

  for (var i = 1; i < allData.length; i++) {
    var cellValue = allData[i][emailColIdx].toString().trim().toLowerCase();
    if (cellValue === email.toLowerCase()) {
      var statusValue = statusColIdx >= 0 ? allData[i][statusColIdx].toString().trim() : "Unknown";
      var nameValue = nameColIdx >= 0 ? allData[i][nameColIdx].toString().trim() : "";

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
      row.push(data.completionTime || data["Completion Time"] || data.completiontime || "");
    } else if (headerLower === "final recommendation") {
      row.push(data.finalRecommendation || data["Final Recommendation"] || data.finalrecommendation || "");
    } else {
      var value = data[header];
      if (value === undefined || value === null) {
        // Try case-insensitive match
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

  // Update Statistics sheet
  SpreadsheetApp.flush();

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
// Get Dashboard Stats (existing endpoint)
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
  var totalCompletionTime = 0;
  var completionTimeCount = 0;

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
      var completionTimeColIdx = -1;
      for (var h = 0; h < surHeaders.length; h++) {
        if (surHeaders[h].toString().trim().toLowerCase() === "laptop ownership") {
          ownershipColIdx = h;
        }
        if (surHeaders[h].toString().trim().toLowerCase() === "completion time") {
          completionTimeColIdx = h;
        }
      }
      totalResponses = surData.length - 1;
      for (var i = 1; i < surData.length; i++) {
        if (ownershipColIdx >= 0) {
          var ownership = surData[i][ownershipColIdx].toString().trim();
          if (ownership === "Yes") ownerCount++;
          else if (ownership === "No") buyerCount++;
        }
        if (completionTimeColIdx >= 0) {
          var ct = parseFloat(surData[i][completionTimeColIdx]);
          if (!isNaN(ct) && ct > 0) {
            totalCompletionTime += ct;
            completionTimeCount++;
          }
        }
      }
    }
  }

  var ownerPercent = totalResponses > 0 ? (ownerCount / totalResponses) : 0;
  var completionRate = approved > 0 ? (totalResponses / approved) : 0;
  var avgCompletionTime = completionTimeCount > 0 ? Math.round(totalCompletionTime / completionTimeCount) : 0;

  var result = {
    totalRequests: totalRequests,
    pending: pending,
    approved: approved,
    rejected: rejected,
    totalResponses: totalResponses,
    ownerCount: ownerCount,
    buyerCount: buyerCount,
    ownerPercent: ownerPercent,
    completionRate: completionRate,
    avgCompletionTime: avgCompletionTime
  };

  return ContentService.createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}

// =======================================
// Get Dashboard Data (full data for website dashboard)
// Returns: stats + survey responses + request data + per-question breakdowns
// =======================================
function getDashboardData() {
  var ss = SpreadsheetApp.openById(SHEET_ID);

  var result = {
    stats: {},
    requests: [],
    responses: [],
    questionBreakdown: {}
  };

  // ---- Stats ----
  var statsResult = getDashboardStats();
  var statsJson = JSON.parse(statsResult.getContent());
  result.stats = statsJson;

  // ---- Requests ----
  var reqSheet = ss.getSheetByName(REQUESTS_SHEET);
  if (reqSheet) {
    var reqData = reqSheet.getDataRange().getValues();
    if (reqData.length > 1) {
      var reqHeaders = reqData[0];
      for (var i = 1; i < reqData.length; i++) {
        var row = {};
        for (var j = 0; j < reqHeaders.length; j++) {
          var val = reqData[i][j];
          if (val instanceof Date) val = val.toISOString();
          row[reqHeaders[j].toString().trim()] = val;
        }
        result.requests.push(row);
      }
    }
  }

  // ---- Survey Responses ----
  var surSheet = ss.getSheetByName(SURVEY_SHEET);
  if (surSheet) {
    var surData = surSheet.getDataRange().getValues();
    if (surData.length > 1) {
      var surHeaders = surData[0];
      for (var i = 1; i < surData.length; i++) {
        var row = {};
        for (var j = 0; j < surHeaders.length; j++) {
          var val = surData[i][j];
          if (val instanceof Date) val = val.toISOString();
          row[surHeaders[j].toString().trim()] = val;
        }
        result.responses.push(row);
      }
    }
  }

  // ---- Per-Question Breakdown ----
  if (surSheet && surData && surData.length > 1) {
    var surHeaders = surData[0];
    // Skip Timestamp(0), Name(1), Email(2), Completion Time(last)
    var skipColumns = ["timestamp", "name", "email", "completion time"];
    for (var h = 0; h < surHeaders.length; h++) {
      var headerName = surHeaders[h].toString().trim();
      var headerLower = headerName.toLowerCase();
      if (skipColumns.indexOf(headerLower) !== -1) continue;

      var counts = {};
      for (var i = 1; i < surData.length; i++) {
        var val = surData[i][h];
        if (val && val.toString().trim() !== "") {
          var key = val.toString().trim();
          counts[key] = (counts[key] || 0) + 1;
        }
      }
      result.questionBreakdown[headerName] = counts;
    }
  }

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
    showAlert("Requests sheet not found!");
    return;
  }

  var allData = sheet.getDataRange().getValues();
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

      sheet.getRange(i + 1, statusColIdx + 1).setValue("Approved");

      if (approvedByColIdx >= 0) {
        sheet.getRange(i + 1, approvedByColIdx + 1).setValue(currentUser);
      }

      if (email) {
        sendApprovalEmail(email, name);
      }

      approvedCount++;
    }
  }

  Logger.log("Approved " + approvedCount + " request(s) and sent emails.");
  showAlert("Approved " + approvedCount + " request(s) and sent emails.");
}

// =======================================
// Admin Tools: Reject Selected
// =======================================
function rejectSelected() {
  var ss = SpreadsheetApp.openById(SHEET_ID);
  var sheet = ss.getSheetByName(REQUESTS_SHEET);

  if (!sheet) {
    showAlert("Requests sheet not found!");
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
  showAlert("Rejected " + rejectedCount + " request(s).");
}

// =======================================
// Admin login + Admin API (admin.html, dashboard.html, ai.html)
//
// SECURITY MODEL
//  - The web app is public ("Anyone"), so the password is checked HERE, on the server.
//  - The username, salt, password hash and signing secret live in Script properties
//    (Project Settings > Script properties). They are private to the script owner and are NEVER
//    in this file or on GitHub. Generate them with tools/New-AdminHash.ps1.
//  - A correct login returns a signed session token (8 hours). Every admin read/write must send it.
//  - 5 wrong attempts lock logins for ~15 minutes. Passwords are never logged.
//
// Required Script properties:
//   ADMIN_USER       admin email / username (lower case)
//   ADMIN_SALT       base64 salt
//   ADMIN_PASS_HASH  base64 PBKDF2-HMAC-SHA256 key
//   ADMIN_ITER       PBKDF2 iterations (e.g. 1000)
//   SESSION_SECRET   random base64 string used to sign session tokens (rotate it to sign everyone out)
// After pasting this file: Deploy > Manage deployments > Edit > Version: New version > Deploy.
// =======================================
var SESSION_TTL_MS = 8 * 60 * 60 * 1000;
var MAX_LOGIN_FAILS = 5;
var LOGIN_LOCK_SECONDS = 15 * 60;

function adminJson(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function adminError(code, message, extra) {
  var o = { status: "error", code: code, message: message };
  if (extra) { for (var k in extra) o[k] = extra[k]; }
  return adminJson(o);
}

function authProps() {
  var p = PropertiesService.getScriptProperties();
  return {
    user: String(p.getProperty("ADMIN_USER") || "").trim().toLowerCase(),
    salt: p.getProperty("ADMIN_SALT"),
    hash: p.getProperty("ADMIN_PASS_HASH"),
    iter: parseInt(p.getProperty("ADMIN_ITER") || "1000", 10),
    secret: p.getProperty("SESSION_SECRET")
  };
}

function authConfigured(a) {
  return !!(a.user && a.salt && a.hash && a.secret && a.iter > 0);
}

// constant-time string comparison (does not leak how many leading characters matched)
function safeEqual(a, b) {
  a = String(a); b = String(b);
  var diff = a.length ^ b.length;
  var len = Math.max(a.length, b.length);
  for (var i = 0; i < len; i++) {
    diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  }
  return diff === 0;
}

// PBKDF2-HMAC-SHA256, single 32-byte block. Same algorithm as tools/New-AdminHash.ps1.
function pbkdf2Sha256(password, saltBytes, iterations) {
  var pw = Utilities.newBlob(String(password)).getBytes();
  var u = Utilities.computeHmacSha256Signature(saltBytes.concat([0, 0, 0, 1]), pw);
  var t = u.slice();
  for (var i = 1; i < iterations; i++) {
    u = Utilities.computeHmacSha256Signature(u, pw);
    for (var j = 0; j < 32; j++) t[j] = t[j] ^ u[j];
  }
  return t;
}

function stripPad(s) { return String(s).replace(/=+$/, ""); }
function addPad(s) { s = String(s); var n = (4 - (s.length % 4)) % 4; return s + "====".slice(0, n); }

function signToken(payload, secret) {
  var body = stripPad(Utilities.base64EncodeWebSafe(JSON.stringify(payload)));
  var sig = stripPad(Utilities.base64EncodeWebSafe(Utilities.computeHmacSha256Signature(body, secret)));
  return body + "." + sig;
}

// returns { ok:true, user } or { ok:false, code, message }
function verifyToken(token) {
  var a = authProps();
  if (!authConfigured(a)) {
    return { ok: false, code: "not_configured", message: "Admin login is not configured on the server yet (Script properties are missing)." };
  }
  var parts = String(token || "").split(".");
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    return { ok: false, code: "auth", message: "Please sign in." };
  }
  var expected = stripPad(Utilities.base64EncodeWebSafe(Utilities.computeHmacSha256Signature(parts[0], a.secret)));
  if (!safeEqual(expected, parts[1])) {
    return { ok: false, code: "auth", message: "Please sign in again." };
  }
  var payload;
  try {
    payload = JSON.parse(Utilities.newBlob(Utilities.base64DecodeWebSafe(addPad(parts[0]))).getDataAsString());
  } catch (err) {
    return { ok: false, code: "auth", message: "Please sign in again." };
  }
  if (!payload || !payload.exp || payload.exp < Date.now() || !safeEqual(payload.u, a.user)) {
    return { ok: false, code: "auth", message: "Your session expired. Please sign in again." };
  }
  return { ok: true, user: payload.u };
}

function requireAdmin(data) {
  var v = verifyToken(data && data.token);
  return v.ok ? { ok: true, user: v.user } : { ok: false, response: adminError(v.code, v.message) };
}

function handleAdminLogin(data) {
  var a = authProps();
  if (!authConfigured(a)) {
    return adminError("not_configured", "Admin login is not configured on the server yet (Script properties are missing).");
  }
  var cache = CacheService.getScriptCache();
  var fails = parseInt(cache.get("adm_fails") || "0", 10);
  if (fails >= MAX_LOGIN_FAILS) {
    return adminError("locked", "Too many failed attempts. Try again in about 15 minutes.");
  }

  var user = String((data && data.user) || "").trim().toLowerCase().slice(0, 200);
  var pass = String((data && data.pass) || "").slice(0, 200);

  // always run the full key derivation so timing does not reveal whether the username was right
  var derived = Utilities.base64Encode(pbkdf2Sha256(pass, Utilities.base64Decode(a.salt), a.iter));
  var userOk = safeEqual(user, a.user);
  var passOk = safeEqual(derived, a.hash);

  if (!(userOk && passOk)) {
    cache.put("adm_fails", String(fails + 1), LOGIN_LOCK_SECONDS);
    Utilities.sleep(700);
    var left = MAX_LOGIN_FAILS - (fails + 1);
    return adminError("invalid", "Incorrect email or password." + (left > 0 ? " " + left + " attempt" + (left === 1 ? "" : "s") + " left." : " Login is now locked for about 15 minutes."));
  }

  cache.remove("adm_fails");
  var now = Date.now();
  var exp = now + SESSION_TTL_MS;
  return adminJson({ status: "success", token: signToken({ u: a.user, iat: now, exp: exp }, a.secret), expiresAt: exp });
}

// lets the browser check that a stored token is still valid
function handleAdminSession(data) {
  var g = requireAdmin(data);
  if (!g.ok) return g.response;
  return adminJson({ status: "success" });
}

// dashboard / admin data: stats + requests + responses + per-question counts
function handleAdminData(data) {
  var g = requireAdmin(data);
  if (!g.ok) return g.response;
  return getDashboardData();
}

// data: { token, newStatus: "Approved"|"Rejected"|"Pending", emails: [..] or "a@x.com,b@y.com",
//         by: "display name (optional)", sendEmail: "true"|"false" }
function handleAdminSetStatus(data) {
  var g = requireAdmin(data);
  if (!g.ok) return g.response;

  var newStatus = String(data.newStatus || "").trim();
  if (["Approved", "Rejected", "Pending"].indexOf(newStatus) === -1) {
    return adminError("bad_request", "newStatus must be Approved, Rejected or Pending.");
  }

  var emails = Array.isArray(data.emails) ? data.emails : String(data.emails || "").split(/[\n,;]+/);
  var wanted = {};
  var count = 0;
  for (var e = 0; e < emails.length; e++) {
    var clean = String(emails[e]).trim().toLowerCase();
    if (clean && !wanted[clean]) { wanted[clean] = true; count++; }
  }
  if (count === 0) return adminError("bad_request", "No emails supplied.");
  if (count > 200) return adminError("bad_request", "Too many emails in one request (max 200).");

  var by = String(data.by || g.user || "Admin console").replace(/[\r\n]+/g, " ").slice(0, 80);
  var sendEmail = String(data.sendEmail) !== "false";

  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var ss = SpreadsheetApp.openById(SHEET_ID);
    var sheet = ss.getSheetByName(REQUESTS_SHEET);
    if (!sheet) return adminError("server", "Requests sheet not found.");

    var all = sheet.getDataRange().getValues();
    var emailCol = getColumnIndex(sheet, "Email");
    var statusCol = getColumnIndex(sheet, "Status");
    var nameCol = getColumnIndex(sheet, "Name");
    var byCol = getColumnIndex(sheet, "Approved By");
    if (emailCol < 0 || statusCol < 0) return adminError("server", "Email/Status columns not found.");

    var updated = 0, unchanged = 0, emailed = 0;
    var found = {};
    for (var i = 1; i < all.length; i++) {
      var rowEmail = String(all[i][emailCol]).trim().toLowerCase();
      if (!wanted[rowEmail]) continue;
      found[rowEmail] = true;
      var current = String(all[i][statusCol]).trim();
      if (current === newStatus || (newStatus === "Approved" && current === "Accepted")) { unchanged++; continue; }

      sheet.getRange(i + 1, statusCol + 1).setValue(newStatus);
      if (byCol >= 0) sheet.getRange(i + 1, byCol + 1).setValue(newStatus === "Pending" ? "" : by);
      updated++;

      // Script edits do not fire the onEdit trigger, so send the approval email explicitly.
      if (newStatus === "Approved" && sendEmail) {
        sendApprovalEmail(String(all[i][emailCol]).trim(), nameCol >= 0 ? String(all[i][nameCol]).trim() : "");
        emailed++;
      }
    }
    SpreadsheetApp.flush();

    var notFound = [];
    Object.keys(wanted).forEach(function (k) { if (!found[k]) notFound.push(k); });

    Logger.log("adminSetStatus -> " + newStatus + ": updated=" + updated + " unchanged=" + unchanged + " notFound=" + notFound.length);
    return adminJson({ status: "success", updated: updated, unchanged: unchanged, emailed: emailed, notFound: notFound });
  } finally {
    lock.releaseLock();
  }
}