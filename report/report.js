import { getReportPayload } from "../shared/storage.js";
import { computeReportData, buildReportHtml } from "../shared/reportRenderer.js";
import { initTheme, mountThemeToggle } from "../shared/theme.js";

initTheme();
mountThemeToggle(document.getElementById("theme-toggle"));

const params = new URLSearchParams(location.search);
const reportId = params.get("reportId");
const body = document.getElementById("report-body");

document.getElementById("close-tab").addEventListener("click", () => window.close());
document.getElementById("print-btn").addEventListener("click", () => window.print());

async function init() {
  if (!reportId) {
    body.innerHTML = emptyState("⚠️", "No report data found", "Please generate a report again from the Reports tab.");
    return;
  }
  const payload = await getReportPayload(reportId);
  if (!payload) {
    body.innerHTML = emptyState("⚠️", "Report expired", "This preview is no longer available. Please generate it again.");
    return;
  }
  const data = computeReportData(payload.rows);
  body.className = "report-page rp-doc";
  body.innerHTML = buildReportHtml(data, { startIso: payload.startIso, endIso: payload.endIso, generatedAt: payload.generatedAt });
  document.title = `MyWorkTracking Report ${payload.startIso} to ${payload.endIso}`;
}

function emptyState(icon, title, msg) {
  return `<div class="empty-state"><div class="empty-icon">${icon}</div><h4>${title}</h4><p>${msg}</p></div>`;
}

init();
