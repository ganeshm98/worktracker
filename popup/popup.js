import { getSpreadsheetId, getCategories } from "../shared/storage.js";
import { appendRow, getMonthRows } from "../shared/sheetsApi.js";
import { todayISO, monthSheetName, nowISOTime, uid, formatDisplayDate } from "../shared/utils.js";
import { showToast, setLoading } from "../shared/ui.js";
import { initTheme, mountThemeToggle } from "../shared/theme.js";

initTheme();
mountThemeToggle(document.getElementById("theme-toggle"));

const els = {
  loading: document.getElementById("popup-loading"),
  main: document.getElementById("popup-main"),
  setupBanner: document.getElementById("setup-banner"),
  setupBtn: document.getElementById("setup-btn"),
  openSettings: document.getElementById("open-settings"),
  openDashboard: document.getElementById("open-dashboard"),
  brandDate: document.getElementById("brand-date"),
  form: document.getElementById("quick-add-form"),
  date: document.getElementById("qa-date"),
  desc: document.getElementById("qa-desc"),
  category: document.getElementById("qa-category"),
  priority: document.getElementById("qa-priority"),
  submit: document.getElementById("qa-submit"),
  qsCompleted: document.getElementById("qs-completed"),
  qsTodos: document.getElementById("qs-todos"),
  qsFollowups: document.getElementById("qs-followups")
};

function openApp(hash = "") {
  chrome.tabs.create({ url: chrome.runtime.getURL("app/app.html") + hash });
}

els.openSettings.addEventListener("click", () => openApp("#/settings"));
els.setupBtn.addEventListener("click", () => openApp("#/settings"));
els.openDashboard.addEventListener("click", () => openApp("#/dashboard"));

async function init() {
  els.brandDate.textContent = new Date().toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" });
  els.date.value = todayISO();

  const spreadsheetId = await getSpreadsheetId();
  els.loading.classList.add("hidden");

  if (!spreadsheetId) {
    els.setupBanner.classList.remove("hidden");
    return;
  }

  const categories = await getCategories();
  els.category.innerHTML = categories.map((c) => `<option>${c}</option>`).join("");
  els.main.classList.remove("hidden");

  loadStats(spreadsheetId).catch(() => {
    els.qsCompleted.textContent = "–";
    els.qsTodos.textContent = "–";
    els.qsFollowups.textContent = "–";
  });
}

async function loadStats(spreadsheetId) {
  const month = monthSheetName(todayISO());
  const rows = await getMonthRows(spreadsheetId, month, { interactive: false });
  const today = todayISO();
  const todayRows = rows.filter((r) => r.date === today);

  els.qsCompleted.textContent = todayRows.filter((r) => r.workType === "Work" && r.status === "Completed").length;
  els.qsTodos.textContent = rows.filter((r) => r.workType === "Todo" && r.status !== "Completed").length;
  els.qsFollowups.textContent = rows.filter(
    (r) => (r.flag === "Follow-up" || r.status === "Follow-up Required" || r.workType === "Follow-up") && r.status !== "Completed"
  ).length;
}

els.form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const description = els.desc.value.trim();
  if (!description) {
    showToast("Please describe the work you completed.", "error");
    return;
  }
  if (!els.date.value) {
    showToast("Please pick a date.", "error");
    return;
  }

  setLoading(els.submit, true, "Adding…");
  try {
    const spreadsheetId = await getSpreadsheetId();
    const now = nowISOTime();
    const row = {
      id: uid(),
      date: els.date.value,
      description,
      workType: "Work",
      category: els.category.value,
      priority: els.priority.value,
      flag: "None",
      status: "Completed",
      followUpDate: "",
      notes: "",
      createdTime: now,
      updatedTime: now
    };
    await appendRow(spreadsheetId, monthSheetName(row.date), row);
    showToast(`Added to ${formatDisplayDate(row.date)}`, "success");
    els.desc.value = "";
    els.desc.focus();
    loadStats(spreadsheetId).catch(() => {});
    chrome.runtime.sendMessage({ type: "mwt:refresh-badge" });
  } catch (err) {
    showToast(err.message || "Could not save. Please try again.", "error");
  } finally {
    setLoading(els.submit, false);
  }
});

init();
