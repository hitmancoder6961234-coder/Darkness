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

---

# Admin Console (`admin.html`)

A management console for access requests and survey responses: KPIs and charts, search/sort/filter, bulk approve/reject, data-quality checks, CSV export and a local audit log.

Reading data works immediately (it uses the same endpoint as the dashboard). **Approving/rejecting needs a one-time setup**, because the web app is deployed with access "Anyone" and write actions must be protected by a secret:

1. Paste the updated `google-apps-script.js` into your Apps Script project (it now contains `adminPing` and `adminSetStatus`).
2. In the Apps Script editor open **Project Settings (gear icon) > Script properties > Add script property**:
   - Name: `ADMIN_KEY`
   - Value: a long random passphrase (only you should know it)
3. **Deploy > Manage deployments > Edit (pencil) > Version: New version > Deploy.** The `/exec` URL stays the same.
4. Open `admin.html`, click **Locked**, enter your name and the key. The key is kept only in that browser tab (sessionStorage) and sent only in POST bodies.

If `ADMIN_KEY` is not set, every admin action is refused by the server.

> Note: the public `getDashboardData` endpoint returns all request rows (names, emails, mobile numbers) to anyone who has the URL. Locking the admin page does not change that. If this data is sensitive, protect the read endpoints with the same `ADMIN_KEY` check (this would also require the public dashboard to send the key).

# Clarity AI Lab (`ai.html`)

Ask several AI models the same question at once (Compare), let them race (first complete answer wins), or merge their answers (Synthesize). Supported: Google Gemini, Anthropic, OpenAI, OpenRouter, Groq, Mistral, Together, Z.ai, Azure OpenAI, local Ollama, and any OpenAI-compatible server.

- Bring your own API keys via **Models**. Keys go straight from the browser to the provider you pick. By default they are kept for the tab session only; "Remember keys" stores them unencrypted in this browser (and other pages on the same site domain could read them).
- Use **Fetch models** in the model form to list the exact model IDs your key can use.
- "Use survey data" sends only aggregated counts from the survey (no names, emails or phone numbers) to the models you selected.
- Ollama needs `OLLAMA_ORIGINS` set to allow your site; some providers may block direct browser (CORS) calls.

# Lighting effects (`css/effects.css`, `js/effects.js`)

Included on every page. Use the ✨ button (bottom-left) to set the glow level: Off / Subtle / Normal / Vivid. The setting is saved in the browser and the effects respect the system "reduce motion" setting.
