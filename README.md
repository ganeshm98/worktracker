# MyWorkTracking

A Chrome extension (Manifest V3) for tracking daily work, todos, and follow-ups — with **Google Sheets as the backend**. One spreadsheet, a tab per month, created automatically as you go.

No build step is required — it's plain HTML/CSS/JS (ES modules), so you can load it as an unpacked extension as-is. No third-party libraries are bundled: charts are drawn with the Canvas API and PDF export uses Chrome's native "Print to PDF", so nothing is fetched from a CDN and nothing runs that isn't in this folder.

## 1. One-time Google Cloud setup (required)

The extension needs its own OAuth client so Chrome can ask **you** to sign in and grant access to **your own** Google Sheets. This is not an API key or secret — a Chrome extension OAuth client ID is public by design (it identifies the app, not a user), so it's safe to have inside `manifest.json`. Nothing else is embedded: no service-account keys, no secrets.

1. **Load the extension once (unpacked) to get its ID.**
   - Go to `chrome://extensions`, enable **Developer mode** (top right).
   - Click **Load unpacked** and select this `worktracker` folder.
   - Copy the **ID** shown on the extension's card (a 32-character string). This ID stays stable as long as the folder doesn't move.

2. **Create a Google Cloud project** (or reuse one) at [console.cloud.google.com](https://console.cloud.google.com).

3. **Enable the Google Sheets API**: *APIs & Services → Library* → search "Google Sheets API" → **Enable**.

4. **Configure the OAuth consent screen**: *APIs & Services → OAuth consent screen*.
   - User type: **External** is fine for personal use (add yourself under **Test users** so you don't need Google's app-review process).
   - Scopes: you can add `https://www.googleapis.com/auth/spreadsheets` (also declared in `manifest.json`).

5. **Create the OAuth Client ID**: *APIs & Services → Credentials → Create Credentials → OAuth client ID*.
   - Application type: **Chrome Extension**.
   - Item ID: paste the extension ID you copied in step 1.
   - Click **Create** and copy the generated Client ID (ends in `.apps.googleusercontent.com`).

6. **Paste it into `manifest.json`**: open [manifest.json](manifest.json) and replace:
   ```json
   "client_id": "REPLACE_WITH_YOUR_OAUTH_CLIENT_ID.apps.googleusercontent.com",
   ```
   with your real client ID.

7. Go back to `chrome://extensions` and click the **reload** icon on the MyWorkTracking card.

## 2. Using the extension

- Click the toolbar icon → **Settings** (gear icon) → **Connect Google Account**, then either:
  - **Create New Spreadsheet** — creates a fresh "MyWorkTracking" spreadsheet in your Drive, or
  - **Link Existing Spreadsheet** — paste the URL or ID of a spreadsheet you already own.
- Monthly tabs (e.g. `August 2026`) are created automatically the first time you log something for that month.
- Use **Add Work** for daily entries, **Todo & Follow-up** to manage open items, **Work History** to filter/search/edit past records, and **Reports** to preview and export a branded PDF (via the browser's Print dialog → Save as PDF).
- The toolbar icon's badge shows your pending todo/follow-up count for today.

## 3. Project structure

```
manifest.json              Manifest V3 config (permissions, OAuth scopes)
background/service-worker.js   Badge updates (no data mutation)
shared/                    Reusable modules: Sheets API client, auth, storage,
                            charts (canvas), badges, UI helpers (toast/modal), theme.css
popup/                     Quick-add popup (click the toolbar icon)
app/                       Main app: sidebar nav + views (Dashboard, Add Work,
                            Todo & Follow-up, Work History, Reports, Settings)
report/                    Standalone print-ready report page (Save as PDF)
icons/                     Toolbar/extension icons
```

## 4. Data model

Every monthly sheet tab shares the same columns:

`ID | Date | Work Description | Work Type | Category | Priority | Flag | Status | Follow-up Date | Notes | Created Time | Updated Time`

`Work Type` is one of `Work / Todo / Follow-up`, which is how the same schema powers both the daily work log and the todo/follow-up tracker.

## 5. Notes on security

- No API keys or secrets are embedded in the code. Authentication is delegated entirely to `chrome.identity` and your Google account.
- The extension only ever talks to `sheets.googleapis.com` (your data) and `accounts.google.com` (sign-in/sign-out) — nothing is sent to any third-party server.
- All Sheets API errors (expired session, no access, spreadsheet not found, rate limiting) are caught and shown as a clear, actionable toast message rather than a raw error.
