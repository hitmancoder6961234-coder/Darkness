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

# Admin login (`admin.html`, `dashboard.html`, AI Lab survey data)

The admin dashboard, the admin console and the AI Lab's "Use survey data" option all require an **email + password login**. The password is checked **on the server** (your Apps Script), never in the browser, and the data is only returned to a signed-in session.

**Why not just hide the page in JavaScript?** GitHub Pages is static and public: anything in the repo (including a password hash) can be read by anyone. A weak password's hash can be cracked in seconds. So the username, salt, hash and signing secret live in Apps Script **Script properties** (private to you, the script owner) and are never committed.

### One-time setup

1. **Create the 5 private properties.** In PowerShell, from the project folder:
   ```powershell
   $env:DARKNESS_ADMIN_USER = "you@example.com"
   $env:DARKNESS_ADMIN_PASSWORD = "a long unique passphrase"      # never reuse your server/SSH password
   .\tools\New-AdminHash.ps1 -OutFile ..\.secrets\apps-script-properties.txt
   Remove-Item Env:\DARKNESS_ADMIN_PASSWORD
   ```
   The tool derives a salted PBKDF2-HMAC-SHA256 key (the plaintext is never written to disk) and prints `ADMIN_USER`, `ADMIN_SALT`, `ADMIN_PASS_HASH`, `ADMIN_ITER`, `SESSION_SECRET`. The `.secrets/` folder is git-ignored; keep it out of GitHub.
2. In Apps Script open **Project Settings (gear icon) > Script properties > Add script property** and add each of the 5 names/values.
3. Paste the updated `google-apps-script.js` into the project, then **Deploy > Manage deployments > Edit (pencil) > Version: New version > Deploy**. The `/exec` URL stays the same.
4. Open `admin.html` (or `dashboard.html`) and sign in.

### How it behaves
- A correct login returns a signed session token valid for **8 hours**. It is kept in `sessionStorage` (cleared when the tab closes) and sent with every admin request.
- **5 wrong attempts lock logins for about 15 minutes.**
- The old public data endpoints (`getDashboardData`, `getSurveyData`, `getRequestData`, `getDashboardStats`, `debug`, `testPost`) now answer "Login required". Previously they returned every respondent's name, email and mobile number to anyone with the URL, and `testPost` wrote to the sheet.
- The survey itself (sign-in as new / already, submit survey) is unchanged and still public.
- To change the password: run the tool again and replace `ADMIN_SALT` and `ADMIN_PASS_HASH` (and `ADMIN_USER` if needed). To sign everyone out immediately: change `SESSION_SECRET`.
- Until step 3 is done the sign-in form shows "backend has not been updated yet" (and the dashboard cannot load data).
# Clarity AI Lab (`ai.html`)

Ask several AI models the same question at once (Compare), let them race (first complete answer wins), or merge their answers (Synthesize). Supported: Google Gemini, Anthropic, OpenAI, OpenRouter, Groq, Mistral, Together, Z.ai, Azure OpenAI, local Ollama, and any OpenAI-compatible server.

- Bring your own API keys via **Models**. Keys go straight from the browser to the provider you pick. By default they are kept for the tab session only; "Remember keys" stores them unencrypted in this browser (and other pages on the same site domain could read them).
- Use **Fetch models** in the model form to list the exact model IDs your key can use.
- "Use survey data" sends only aggregated counts from the survey (no names, emails or phone numbers) to the models you selected.
- Ollama needs `OLLAMA_ORIGINS` set to allow your site; some providers may block direct browser (CORS) calls.

# Lighting effects (`css/effects.css`, `js/effects.js`)

Included on every page. Use the ✨ button (bottom-left) to set the glow level: Off / Subtle / Normal / Vivid. The setting is saved in the browser and the effects respect the system "reduce motion" setting.
