import { getSpreadsheetId, setCategories, setFlags, getCategories, getFlags } from "../shared/storage.js";
import { getMonthRows } from "../shared/sheetsApi.js";
import { monthSheetName, todayISO } from "../shared/utils.js";
import { DEFAULT_CATEGORIES, DEFAULT_FLAGS } from "../shared/constants.js";

const BADGE_ALARM = "mwt-refresh-badge";

chrome.runtime.onInstalled.addListener(async () => {
  const cats = await getCategories();
  if (!cats || !cats.length) await setCategories(DEFAULT_CATEGORIES.slice());
  const flags = await getFlags();
  if (!flags || !flags.length) await setFlags(DEFAULT_FLAGS.slice());

  chrome.alarms.create(BADGE_ALARM, { periodInMinutes: 30 });
  refreshBadge();
});

chrome.runtime.onStartup?.addListener(() => refreshBadge());

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === BADGE_ALARM) refreshBadge();
});

chrome.runtime.onMessage.addListener((message) => {
  if (message?.type === "mwt:refresh-badge") refreshBadge();
});

async function refreshBadge() {
  try {
    const spreadsheetId = await getSpreadsheetId();
    if (!spreadsheetId) {
      chrome.action.setBadgeText({ text: "" });
      return;
    }
    const month = monthSheetName(todayISO());
    const rows = await getMonthRows(spreadsheetId, month, { interactive: false }).catch(() => []);
    const pending = rows.filter(
      (r) => r.status && r.status !== "Completed" && (r.workType === "Todo" || r.workType === "Follow-up")
    ).length;

    if (pending > 0) {
      chrome.action.setBadgeText({ text: String(Math.min(pending, 99)) });
      chrome.action.setBadgeBackgroundColor({ color: "#16a34a" });
    } else {
      chrome.action.setBadgeText({ text: "" });
    }
  } catch {
    // Silent: badge is a non-critical enhancement (e.g. not yet signed in).
  }
}
