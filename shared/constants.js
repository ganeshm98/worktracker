// Central constants shared across popup, app and background contexts.

export const SHEETS_API = "https://sheets.googleapis.com/v4/spreadsheets";

export const SCOPES = [
  "https://www.googleapis.com/auth/spreadsheets",
  "https://www.googleapis.com/auth/userinfo.email",
  "https://www.googleapis.com/auth/userinfo.profile"
];

// A "Web application" type OAuth client (not "Chrome Extension" type) — required by
// launchWebAuthFlow, which chrome.identity and browser.identity both implement the
// same way. Register each browser's exact identity.getRedirectURL() value under
// this client's "Authorized redirect URIs" in Google Cloud Console.
export const OAUTH_CLIENT_ID = "966732565112-7d3e5cjkuh3siaakk8fvp32gg9eva051.apps.googleusercontent.com";

// Column order written to / read from every monthly sheet tab.
// Keep this in sync with COLUMN_KEYS below.
export const COLUMN_HEADERS = [
  "ID",
  "Date",
  "Work Description",
  "Work Type",
  "Category",
  "Priority",
  "Flag",
  "Status",
  "Follow-up Date",
  "Notes",
  "Created Time",
  "Updated Time"
];

export const COLUMN_KEYS = [
  "id",
  "date",
  "description",
  "workType",
  "category",
  "priority",
  "flag",
  "status",
  "followUpDate",
  "notes",
  "createdTime",
  "updatedTime"
];

export const WORK_TYPES = ["Work", "Todo", "Follow-up"];

export const PRIORITIES = ["Low", "Medium", "High"];

export const DEFAULT_FLAGS = ["Important", "Urgent", "Follow-up", "Blocked", "None"];

export const DEFAULT_CATEGORIES = [
  "Development",
  "Testing",
  "Meeting",
  "Bug Fix",
  "Documentation",
  "Automation",
  "Security",
  "Support",
  "Other"
];

export const STATUSES = ["Todo", "In Progress", "Completed", "Follow-up Required"];

export const STORAGE_KEYS = {
  spreadsheetId: "mwt_spreadsheet_id",
  categories: "mwt_categories",
  flags: "mwt_flags",
  authToken: "mwt_cached_token"
};

export const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

export const BRAND = {
  name: "MyWorkTracking",
  tagline: "Your work, tracked and organized."
};

// Cell colors applied to the live Google Sheet via conditional formatting,
// matching the badge colors used in shared/theme.css and shared/badges.js
// so the raw spreadsheet looks the same as the extension's UI.
export const SHEET_STATUS_COLORS = {
  Todo: { bg: "#f1f5f9", fg: "#334155" },
  "In Progress": { bg: "#fffbeb", fg: "#d97706" },
  Completed: { bg: "#dcfce7", fg: "#15803d" },
  "Follow-up Required": { bg: "#ede9fe", fg: "#6d28d9" }
};

export const SHEET_PRIORITY_COLORS = {
  Low: { bg: "#f1f5f9", fg: "#64748b" },
  Medium: { bg: "#eff6ff", fg: "#1d4ed8" },
  High: { bg: "#fef2f2", fg: "#dc2626" }
};

// "None" is intentionally excluded — left with the sheet's default appearance.
export const SHEET_FLAG_COLORS = {
  Important: { bg: "#eff6ff", fg: "#1d4ed8" },
  Urgent: { bg: "#fef2f2", fg: "#dc2626" },
  Blocked: { bg: "#1e293b", fg: "#ffffff" },
  "Follow-up": { bg: "#ede9fe", fg: "#6d28d9" }
};
