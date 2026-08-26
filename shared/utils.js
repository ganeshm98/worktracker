import { MONTH_NAMES, COLUMN_KEYS } from "./constants.js";

export function uid() {
  if (crypto.randomUUID) return crypto.randomUUID();
  return "id-" + Date.now() + "-" + Math.random().toString(16).slice(2);
}

/** Parse a "YYYY-MM-DD" string as a local date (avoids UTC off-by-one). */
export function parseISODate(iso) {
  if (!iso) return null;
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

export function toISODate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function todayISO() {
  return toISODate(new Date());
}

export function formatDisplayDate(iso) {
  const d = parseISODate(iso);
  if (!d) return "";
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

export function formatDisplayDateTime(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d)) return iso;
  return d.toLocaleString(undefined, {
    year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit"
  });
}

export function monthSheetName(iso) {
  const d = parseISODate(iso);
  if (!d) return null;
  return `${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`;
}

/** Returns an ordered list of unique month-sheet names covering [startIso, endIso]. */
export function monthsInRange(startIso, endIso) {
  const start = parseISODate(startIso);
  const end = parseISODate(endIso);
  if (!start || !end) return [];
  const months = [];
  const cursor = new Date(start.getFullYear(), start.getMonth(), 1);
  const last = new Date(end.getFullYear(), end.getMonth(), 1);
  while (cursor <= last) {
    months.push(`${MONTH_NAMES[cursor.getMonth()]} ${cursor.getFullYear()}`);
    cursor.setMonth(cursor.getMonth() + 1);
  }
  return months;
}

export function isBetween(iso, startIso, endIso) {
  return iso >= startIso && iso <= endIso;
}

export function debounce(fn, wait = 250) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), wait);
  };
}

export function escapeHtml(str) {
  if (str === null || str === undefined) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function rowArrayToObject(rowArray, sheetRowNumber) {
  const obj = { sheetRow: sheetRowNumber };
  COLUMN_KEYS.forEach((key, i) => {
    obj[key] = rowArray[i] ?? "";
  });
  return obj;
}

export function rowObjectToArray(obj) {
  return COLUMN_KEYS.map((key) => obj[key] ?? "");
}

export function nowISOTime() {
  return new Date().toISOString();
}

/** Returns a Date offset from today by `n` days (negative for the past). */
export function addDays(n) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d;
}
