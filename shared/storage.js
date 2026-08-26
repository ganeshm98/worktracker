import { STORAGE_KEYS, DEFAULT_CATEGORIES, DEFAULT_FLAGS } from "./constants.js";

function syncGet(keys) {
  return new Promise((resolve) => chrome.storage.sync.get(keys, resolve));
}
function syncSet(items) {
  return new Promise((resolve) => chrome.storage.sync.set(items, resolve));
}
function localGet(keys) {
  return new Promise((resolve) => chrome.storage.local.get(keys, resolve));
}
function localSet(items) {
  return new Promise((resolve) => chrome.storage.local.set(items, resolve));
}
function localRemove(keys) {
  return new Promise((resolve) => chrome.storage.local.remove(keys, resolve));
}

export async function getSpreadsheetId() {
  const res = await syncGet([STORAGE_KEYS.spreadsheetId]);
  return res[STORAGE_KEYS.spreadsheetId] || null;
}

export async function setSpreadsheetId(id) {
  await syncSet({ [STORAGE_KEYS.spreadsheetId]: id });
}

export async function getCategories() {
  const res = await syncGet([STORAGE_KEYS.categories]);
  return res[STORAGE_KEYS.categories] || DEFAULT_CATEGORIES.slice();
}

export async function setCategories(list) {
  await syncSet({ [STORAGE_KEYS.categories]: list });
}

export async function getFlags() {
  const res = await syncGet([STORAGE_KEYS.flags]);
  return res[STORAGE_KEYS.flags] || DEFAULT_FLAGS.slice();
}

export async function setFlags(list) {
  await syncSet({ [STORAGE_KEYS.flags]: list });
}

// Local (device-only) cache helpers, used by sheetsApi for a short-lived
// session cache of month-sheet rows to avoid refetching on every view switch.
export async function cacheGet(key) {
  const res = await localGet([key]);
  return res[key];
}
export async function cacheSet(key, value) {
  await localSet({ [key]: value });
}
export async function cacheRemove(key) {
  await localRemove([key]);
}

export async function setReportPayload(id, payload) {
  await localSet({ [`mwt_report_${id}`]: payload });
}
export async function getReportPayload(id) {
  const res = await localGet([`mwt_report_${id}`]);
  return res[`mwt_report_${id}`];
}
