# Google Sheets Integration Setup

Follow these steps to connect your survey to Google Sheets:

## Step 1: Create a Google Sheet

1. Go to [Google Sheets](https://sheets.google.com) and create a new spreadsheet
2. Name it "Laptop Market Research Survey"
3. In Row 1, add these column headers:
   - A1: `Timestamp`
   - B1: `Q1`
   - C1: `Q2`
   - D1: `Q3`
   - E1: `Q4`
   - F1: `Q5`
   - G1: `Q6`
   - H1: `Q7`
   - I1: `Q8`
   - J1: `Q9`
   - K1: `Q10`

## Step 2: Create Google Apps Script

1. In your Google Sheet, click **Extensions > Apps Script**
2. Delete any existing code and paste the code from `google-apps-script.js` in this repo
3. Click **Save** (floppy disk icon)

## Step 3: Deploy as Web App

1. Click **Deploy > New deployment**
2. Click the gear icon next to "Select type" and choose **Web app**
3. Set:
   - Description: `Laptop Survey API`
   - Execute as: **Me**
   - Who has access: **Anyone**
4. Click **Deploy**
5. **Authorize** the script when prompted (click Advanced > Go to script)
6. Copy the **Web app URL** that appears

## Step 4: Update Your Website

1. Open `js/survey.js`
2. Find this line near the top:
   ```javascript
   const GOOGLE_SHEETS_URL = "YOUR_GOOGLE_APPS_SCRIPT_URL_HERE";
   ```
3. Replace `YOUR_GOOGLE_APPS_SCRIPT_URL_HERE` with the URL you copied
4. Commit and push the change

## Step 5: Test

1. Go to your survey page
2. Complete the survey
3. Check your Google Sheet - a new row should appear with the responses

## How It Works

- When a user submits the survey, the data is sent to Google Sheets via a POST request
- The Apps Script receives the data and appends it as a new row in your spreadsheet
- Data is also stored in `localStorage` as a backup
- The dashboard page reads from `localStorage` to display charts
- For a production setup with multiple users, you would connect the dashboard to read from Google Sheets directly using the Sheets API

## Dashboard with Google Sheets Data

For the dashboard to show ALL responses (not just the current user's), you need to:

1. Create another Apps Script function that reads all data from the sheet
2. Deploy it as a separate web app endpoint
3. Update `dashboard.js` to fetch data from that endpoint

The current dashboard works with localStorage for demo purposes. For multi-user analytics, the Google Sheets integration provides the shared data source.
