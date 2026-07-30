// ===================================
// Google Apps Script Code
// Laptop Market Research Survey
// ===================================
//
// INSTRUCTIONS:
// 1. Open your Google Sheet
// 2. Go to Extensions > Apps Script
// 3. Paste this entire code
// 4. Save and deploy as Web App
//    - Execute as: Me
//    - Who has access: Anyone
// 5. Copy the Web App URL and paste it in js/survey.js
// ===================================

function doPost(e)
{
  try
  {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();

    var data = JSON.parse(e.postData.contents);

    // Append the data as a new row
    var row = [
      data.timestamp || new Date().toISOString(),
      data.Q1 || "",
      data.Q2 || "",
      data.Q3 || "",
      data.Q4 || "",
      data.Q5 || "",
      data.Q6 || "",
      data.Q7 || "",
      data.Q8 || "",
      data.Q9 || "",
      data.Q10 || ""
    ];

    sheet.appendRow(row);

    return ContentService
      .createTextOutput(JSON.stringify({ status: "success", message: "Data saved" }))
      .setMimeType(ContentService.MimeType.JSON);
  }
  catch (error)
  {
    return ContentService
      .createTextOutput(JSON.stringify({ status: "error", message: error.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function doGet(e)
{
  try
  {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    var data = sheet.getDataRange().getValues();

    var headers = data[0];
    var rows = [];

    for (var i = 1; i < data.length; i++)
    {
      var row = {};
      for (var j = 0; j < headers.length; j++)
      {
        row[headers[j]] = data[i][j];
      }
      rows.push(row);
    }

    return ContentService
      .createTextOutput(JSON.stringify(rows))
      .setMimeType(ContentService.MimeType.JSON);
  }
  catch (error)
  {
    return ContentService
      .createTextOutput(JSON.stringify({ status: "error", message: error.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// Setup function: run this once to create headers
function setupHeaders()
{
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();

  var headers = [
    "Timestamp", "Q1", "Q2", "Q3", "Q4",
    "Q5", "Q6", "Q7", "Q8", "Q9", "Q10"
  ];

  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);

  // Format header row
  sheet.getRange(1, 1, 1, headers.length)
    .setFontWeight("bold")
    .setBackground("#1a73e8")
    .setFontColor("#ffffff");

  SpreadsheetApp.getUi().alert("Headers created successfully!");
}
