import {
  SHEETS_API,
  COLUMN_HEADERS,
  COLUMN_KEYS,
  SHEET_STATUS_COLORS,
  SHEET_PRIORITY_COLORS,
  SHEET_FLAG_COLORS
} from "./constants.js";
import { getAuthToken, removeCachedToken } from "./auth.js";
import { rowArrayToObject, rowObjectToArray, monthsInRange, isBetween } from "./utils.js";

export class SheetsApiError extends Error {
  constructor(message, status) {
    super(message);
    this.name = "SheetsApiError";
    this.status = status;
  }
}

// --- in-memory (session) caches -------------------------------------------
const sheetIdCache = new Map(); // spreadsheetId -> { "Month Year": numericSheetId }
const rowsCache = new Map(); // `${spreadsheetId}::${monthName}` -> rows[]

function invalidateMonth(spreadsheetId, monthName) {
  rowsCache.delete(`${spreadsheetId}::${monthName}`);
}

function friendlyError(status, body) {
  if (status === 401) return "Your Google session expired. Please reconnect in Settings.";
  if (status === 403) return "Access denied. Make sure the Google Sheets API is enabled and you approved the requested permissions.";
  if (status === 404) return "Spreadsheet not found. It may have been deleted, or the linked ID is wrong.";
  if (status === 429) return "Google Sheets rate limit reached. Please wait a moment and try again.";
  return body?.error?.message || `Google Sheets request failed (${status}).`;
}

async function apiFetch(path, options = {}, { retryOn401 = true, interactive = true } = {}) {
  let token;
  try {
    token = await getAuthToken(interactive);
  } catch (err) {
    throw new SheetsApiError(
      "Could not connect to your Google account. Please connect it in Settings.",
      0
    );
  }

  const res = await fetch(`${SHEETS_API}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(options.headers || {})
    }
  });

  if (res.status === 401 && retryOn401) {
    await removeCachedToken(token);
    return apiFetch(path, options, { retryOn401: false, interactive });
  }

  if (!res.ok) {
    let body = null;
    try { body = await res.json(); } catch { /* ignore */ }
    throw new SheetsApiError(friendlyError(res.status, body), res.status);
  }

  if (res.status === 204) return null;
  return res.json();
}

// --- spreadsheet lifecycle --------------------------------------------------

export async function createSpreadsheet(title = "MyWorkTracking") {
  const data = await apiFetch("", {
    method: "POST",
    body: JSON.stringify({
      properties: { title },
      sheets: []
    })
  });
  return data.spreadsheetId;
}

export async function getSpreadsheetMeta(spreadsheetId, { force = false, interactive = true } = {}) {
  if (!force && sheetIdCache.has(spreadsheetId)) return sheetIdCache.get(spreadsheetId);
  const data = await apiFetch(`/${spreadsheetId}?fields=properties.title,sheets.properties`, {}, { interactive });
  const map = {};
  for (const s of data.sheets || []) {
    map[s.properties.title] = s.properties.sheetId;
  }
  map.__title = data.properties?.title;
  sheetIdCache.set(spreadsheetId, map);
  return map;
}

export async function verifySpreadsheet(spreadsheetId, { interactive = true } = {}) {
  try {
    const meta = await getSpreadsheetMeta(spreadsheetId, { force: true, interactive });
    return { ok: true, title: meta.__title };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

/** Ensures a monthly tab exists (creating it with a header row if needed). */
export async function ensureMonthSheet(spreadsheetId, monthName) {
  const meta = await getSpreadsheetMeta(spreadsheetId);
  if (meta[monthName] !== undefined) return meta[monthName];

  const createRes = await apiFetch(`/${spreadsheetId}:batchUpdate`, {
    method: "POST",
    body: JSON.stringify({
      requests: [
        {
          addSheet: {
            properties: { title: monthName }
          }
        }
      ]
    })
  });

  const newSheetId = createRes.replies[0].addSheet.properties.sheetId;

  await apiFetch(
    `/${spreadsheetId}/values/${encodeURIComponent(monthName)}!A1:${colLetter(COLUMN_HEADERS.length)}1?valueInputOption=RAW`,
    {
      method: "PUT",
      body: JSON.stringify({ values: [COLUMN_HEADERS] })
    }
  );

  await applyStandardFormatting(spreadsheetId, newSheetId).catch(() => {
    /* cosmetic formatting is best-effort — the sheet still works without it */
  });

  // refresh meta cache
  await getSpreadsheetMeta(spreadsheetId, { force: true });
  return newSheetId;
}

function hexToRgb(hex) {
  const n = parseInt(hex.replace("#", ""), 16);
  return { red: ((n >> 16) & 255) / 255, green: ((n >> 8) & 255) / 255, blue: (n & 255) / 255 };
}

function colorRules(colIndex, colorMap) {
  const entries = Object.entries(colorMap);
  return entries.map(([value, { bg, fg }], i) => ({
    addConditionalFormatRule: {
      rule: {
        ranges: [{ startRowIndex: 1, endRowIndex: 20000, startColumnIndex: colIndex, endColumnIndex: colIndex + 1 }],
        booleanRule: {
          condition: { type: "TEXT_EQ", values: [{ userEnteredValue: value }] },
          format: {
            backgroundColor: hexToRgb(bg),
            textFormat: { foregroundColor: hexToRgb(fg), bold: true }
          }
        }
      },
      index: i
    }
  }));
}

/** Builds the header + frozen-row + Status/Priority/Flag color-coding requests for one sheet. */
function buildFormattingRequests(sheetId) {
  const statusCol = COLUMN_KEYS.indexOf("status");
  const priorityCol = COLUMN_KEYS.indexOf("priority");
  const flagCol = COLUMN_KEYS.indexOf("flag");

  const withSheetId = (requests) =>
    requests.map((r) => {
      const rule = r.addConditionalFormatRule?.rule;
      if (rule) rule.ranges.forEach((range) => { range.sheetId = sheetId; });
      return r;
    });

  return [
    {
      repeatCell: {
        range: { sheetId, startRowIndex: 0, endRowIndex: 1 },
        cell: {
          userEnteredFormat: {
            textFormat: { bold: true, foregroundColor: { red: 0.06, green: 0.09, blue: 0.16 } },
            backgroundColor: { red: 1, green: 1, blue: 1 }
          }
        },
        fields: "userEnteredFormat(textFormat,backgroundColor)"
      }
    },
    {
      updateSheetProperties: {
        properties: { sheetId, gridProperties: { frozenRowCount: 1 } },
        fields: "gridProperties.frozenRowCount"
      }
    },
    ...withSheetId(colorRules(statusCol, SHEET_STATUS_COLORS)),
    ...withSheetId(colorRules(priorityCol, SHEET_PRIORITY_COLORS)),
    ...withSheetId(colorRules(flagCol, SHEET_FLAG_COLORS))
  ];
}

async function getConditionalFormatCount(spreadsheetId, sheetId) {
  const data = await apiFetch(`/${spreadsheetId}?fields=sheets(properties(sheetId),conditionalFormats)`);
  const sheet = (data.sheets || []).find((s) => s.properties.sheetId === sheetId);
  return sheet?.conditionalFormats?.length || 0;
}

/**
 * Applies header styling + Status/Priority/Flag color-coding to one existing sheet tab.
 * Clears any conditional format rules already on the sheet first, so calling this
 * more than once (e.g. via "re-apply formatting") replaces rather than duplicates them.
 */
export async function applyStandardFormatting(spreadsheetId, sheetId) {
  const existingCount = await getConditionalFormatCount(spreadsheetId, sheetId).catch(() => 0);
  const deleteRequests = Array.from({ length: existingCount }, () => ({
    deleteConditionalFormatRule: { sheetId, index: 0 }
  }));

  await apiFetch(`/${spreadsheetId}:batchUpdate`, {
    method: "POST",
    body: JSON.stringify({ requests: [...deleteRequests, ...buildFormattingRequests(sheetId)] })
  });
}

/** Re-applies standard formatting to every existing monthly tab (e.g. sheets created before this feature). */
export async function applyStandardFormattingToAllSheets(spreadsheetId) {
  const meta = await getSpreadsheetMeta(spreadsheetId, { force: true });
  const titles = Object.keys(meta).filter((k) => k !== "__title");
  const results = await Promise.allSettled(titles.map((title) => applyStandardFormatting(spreadsheetId, meta[title])));
  const failedTitles = titles.filter((_, i) => results[i].status === "rejected");
  return { total: titles.length, succeeded: titles.length - failedTitles.length, failedTitles };
}

function colLetter(n) {
  let s = "";
  while (n > 0) {
    const rem = (n - 1) % 26;
    s = String.fromCharCode(65 + rem) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

// --- row operations ----------------------------------------------------------

export async function appendRow(spreadsheetId, monthName, rowObject) {
  await ensureMonthSheet(spreadsheetId, monthName);
  const values = rowObjectToArray(rowObject);
  await apiFetch(
    `/${spreadsheetId}/values/${encodeURIComponent(monthName)}!A:A:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
    {
      method: "POST",
      body: JSON.stringify({ values: [values] })
    }
  );
  invalidateMonth(spreadsheetId, monthName);
}

/** Returns row objects (with .sheetRow = 1-based row number) for a month tab. */
export async function getMonthRows(spreadsheetId, monthName, { force = false, interactive = true } = {}) {
  const cacheKey = `${spreadsheetId}::${monthName}`;
  if (!force && rowsCache.has(cacheKey)) return rowsCache.get(cacheKey);

  const meta = await getSpreadsheetMeta(spreadsheetId, { interactive });
  if (meta[monthName] === undefined) {
    rowsCache.set(cacheKey, []);
    return [];
  }

  const lastCol = colLetter(COLUMN_HEADERS.length);
  const data = await apiFetch(
    `/${spreadsheetId}/values/${encodeURIComponent(monthName)}!A2:${lastCol}100000`,
    {},
    { interactive }
  );
  const rows = (data.values || []).map((arr, i) => ({ ...rowArrayToObject(arr, i + 2), monthName }));
  rowsCache.set(cacheKey, rows);
  return rows;
}

export async function updateRowByRowNumber(spreadsheetId, monthName, sheetRow, rowObject) {
  const lastCol = colLetter(COLUMN_HEADERS.length);
  const values = rowObjectToArray(rowObject);
  await apiFetch(
    `/${spreadsheetId}/values/${encodeURIComponent(monthName)}!A${sheetRow}:${lastCol}${sheetRow}?valueInputOption=USER_ENTERED`,
    {
      method: "PUT",
      body: JSON.stringify({ values: [values] })
    }
  );
  invalidateMonth(spreadsheetId, monthName);
}

export async function deleteRowByRowNumber(spreadsheetId, monthName, sheetRow) {
  const meta = await getSpreadsheetMeta(spreadsheetId);
  const sheetId = meta[monthName];
  if (sheetId === undefined) return;
  await apiFetch(`/${spreadsheetId}:batchUpdate`, {
    method: "POST",
    body: JSON.stringify({
      requests: [
        {
          deleteDimension: {
            range: {
              sheetId,
              dimension: "ROWS",
              startIndex: sheetRow - 1,
              endIndex: sheetRow
            }
          }
        }
      ]
    })
  });
  invalidateMonth(spreadsheetId, monthName);
}

/** Fetches & merges rows across every month tab overlapping [startIso, endIso]. */
export async function getRowsForDateRange(spreadsheetId, startIso, endIso, { force = false } = {}) {
  const months = monthsInRange(startIso, endIso);
  const results = await Promise.all(
    months.map((m) => getMonthRows(spreadsheetId, m, { force }).catch(() => []))
  );
  const merged = [];
  months.forEach((monthName, i) => {
    for (const row of results[i]) {
      merged.push({ ...row, monthName });
    }
  });
  return merged
    .filter((r) => r.date && isBetween(r.date, startIso, endIso))
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

export function clearSessionCache() {
  sheetIdCache.clear();
  rowsCache.clear();
}
