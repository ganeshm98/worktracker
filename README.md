# MyWorkTracking

A browser extension (Manifest V3) for tracking daily work, todos, and follow-ups — with **Google Sheets as the backend**. One spreadsheet, a tab per month, created automatically as you go. Works in Chrome, Edge, and Firefox.

No build step is required — it's plain HTML/CSS/JS (ES modules), so you can load it as an unpacked/temporary extension as-is. No third-party libraries are bundled: charts are drawn with the Canvas API and PDF export uses the browser's native "Print to PDF", so nothing is fetched from a CDN and nothing runs that isn't in this folder.

## 1. One-time Google Cloud setup (required)

The extension needs its own OAuth client so the browser can ask **you** to sign in and grant access to **your own** Google Sheets. Sign-in goes through [`launchWebAuthFlow`](shared/auth.js) — the one identity API Chrome, Edge, and Firefox all implement the same way (unlike `chrome.identity.getAuthToken`, which is Chrome-only and doesn't work in Firefox or Edge). This means the OAuth client must be a **Web application** type, not the "Chrome Extension" type. It's still just a public identifier, not a secret — safe to have in source.

1. **Create a Google Cloud project** (or reuse one) at [console.cloud.google.com](https://console.cloud.google.com).

2. **Enable the Google Sheets API**: *APIs & Services → Library* → search "Google Sheets API" → **Enable**.

3. **Configure the OAuth consent screen**: *APIs & Services → OAuth consent screen*.
   - User type: **External** is fine for personal use (add yourself under **Test users** so you don't need Google's app-review process).
   - Scopes: `https://www.googleapis.com/auth/spreadsheets`, `.../auth/userinfo.email`, `.../auth/userinfo.profile` (also declared in `shared/constants.js`).

4. **Create the OAuth Client ID**: *APIs & Services → Credentials → Create Credentials → OAuth client ID*.
   - Application type: **Web application** (not "Chrome Extension" — that type only supports the Chrome-only `getAuthToken` flow).
   - Leave **Authorized redirect URIs** empty for now — you'll add the real ones in step 6, since each browser reports its own.

5. **Paste the Client ID into `shared/constants.js`**: replace
   ```js
   export const OAUTH_CLIENT_ID = "REPLACE_WITH_YOUR_WEB_APP_OAUTH_CLIENT_ID.apps.googleusercontent.com";
   ```
   with the real Client ID (ends in `.apps.googleusercontent.com`).

6. **Register each browser's redirect URI.** Load the extension, open its background page/service-worker console, and run the matching line:
   - Chrome/Edge: `chrome://extensions` (or `edge://extensions`) → enable **Developer mode** → **Load unpacked** → select this folder → click **service worker** under the card to open its console.
   - Firefox: `about:debugging#/runtime/this-firefox` → **Load Temporary Add-on** → select `manifest.json` → click **Inspect** on the loaded extension to open its console.
   
   ```js
   chrome.identity.getRedirectURL()   // Chrome and Edge
   browser.identity.getRedirectURL()  // Firefox
   ```
   Copy the exact string each browser prints (they'll differ per browser, and Chrome/Edge's depends on the extension's ID — see the note on `key` below) and paste all of them into the OAuth client's **Authorized redirect URIs** list in Cloud Console, then **Save**.

7. Reload the extension in each browser after saving.

> **Chrome/Edge extension ID stability:** unpacked/sideloaded copies get a different extension ID per install context (a different one on each machine you `Load unpacked` on), which changes the `chromiumapp.org` redirect URI and breaks sign-in for that copy. **Do not** "fix" this by adding a `"key"` field to `manifest.json` if this extension is already published on the Chrome Web Store (or Edge Add-ons) — once an item exists in the dashboard, its ID is permanently locked to whatever was assigned on first upload, and pushing an update with a different/mismatched `"key"` gets rejected with "key field value in the manifest doesn't match the current item." For a **published** extension, every user who installs it from the store gets the exact same store-assigned ID, forever — so you only need to register that one already-fixed ID's redirect URI once, and it covers every install past and future. Find your published ID on the item's Chrome Web Store Developer Dashboard page (or from `chrome://extensions` on a machine that installed it from the store) and register `https://<that-id>.chromiumapp.org/`. A `"key"` is only worth pinning if you're deliberately keeping this extension **unpublished** and distributing unpacked copies to multiple machines/testers — in that case only, generate a key pair, add its public half as `"key"` in `manifest.json`, and never include that manifest in a Web Store upload for an item that already has a different assigned ID.

## 2. Using the extension

- Click the toolbar icon → **Settings** (gear icon) → **Connect Google Account**, then either:
  - **Create New Spreadsheet** — creates a fresh "MyWorkTracking" spreadsheet in your Drive, or
  - **Link Existing Spreadsheet** — paste the URL or ID of a spreadsheet you already own.
- Monthly tabs (e.g. `August 2026`) are created automatically the first time you log something for that month.
- Use **Add Work** for daily entries, **Todo & Follow-up** to manage open items, **Work History** to filter/search/edit past records, and **Reports** to preview and export a branded PDF (via the browser's Print dialog → Save as PDF).
- The toolbar icon's badge shows your pending todo/follow-up count for today.

## 3. Project structure

```
manifest.json              Manifest V3 config (permissions, cross-browser identity)
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

- No API keys or secrets are embedded in the code. Authentication is delegated entirely to `chrome.identity`/`browser.identity` (`launchWebAuthFlow`) and your Google account; the access token is cached locally in `chrome.storage.local`, never synced or sent anywhere but Google.
- The extension only ever talks to `sheets.googleapis.com` (your data) and `accounts.google.com` (sign-in/sign-out) — nothing is sent to any third-party server.
- All Sheets API errors (expired session, no access, spreadsheet not found, rate limiting) are caught and shown as a clear, actionable toast message rather than a raw error.
