import { getRowsForDateRange } from "../../shared/sheetsApi.js";
import { todayISO, toISODate, nowISOTime, uid } from "../../shared/utils.js";
import { computeReportData, buildReportHtml } from "../../shared/reportRenderer.js";
import { setReportPayload } from "../../shared/storage.js";
import { showToast, setLoading } from "../../shared/ui.js";

export async function render(container, ctx) {
  const { appState } = ctx;
  const start = toISODate(firstOfMonth());
  const end = todayISO();

  container.innerHTML = `
    <div class="view-toolbar">
      <span class="section-title">Reports</span>
    </div>

    <div class="card" style="margin-bottom:20px;">
      <h3 class="card-title">Generate a Report</h3>
      <p class="card-subtitle">Pick a date range, preview it below, then export a print-ready PDF.</p>
      <div class="filters-bar" style="margin:16px 0 0; padding:0; border:none;">
        <div class="field"><label for="r-start">Start Date</label><input class="input" type="date" id="r-start" value="${start}" /></div>
        <div class="field"><label for="r-end">End Date</label><input class="input" type="date" id="r-end" value="${end}" /></div>
        <button class="btn btn-primary btn-sm" id="r-generate">🔍 Preview Report</button>
        <button class="btn btn-success btn-sm" id="r-download" disabled>⬇ Export / Download PDF</button>
      </div>
    </div>

    <div class="card" id="r-preview-card">
      <div class="empty-state">
        <div class="empty-icon">📄</div>
        <h4>No report generated yet</h4>
        <p>Choose a date range and click "Preview Report" to see a summary here.</p>
      </div>
    </div>
  `;

  let lastPayload = null;

  document.getElementById("r-generate").addEventListener("click", async () => {
    const startVal = document.getElementById("r-start").value;
    const endVal = document.getElementById("r-end").value;
    if (!startVal || !endVal || startVal > endVal) {
      showToast("Please choose a valid start and end date.", "error");
      return;
    }
    const btn = document.getElementById("r-generate");
    setLoading(btn, true, "Loading…");
    const previewCard = document.getElementById("r-preview-card");
    try {
      const rows = await getRowsForDateRange(appState.spreadsheetId, startVal, endVal, { force: true });
      const data = computeReportData(rows);
      const meta = { startIso: startVal, endIso: endVal, generatedAt: nowISOTime() };
      previewCard.innerHTML = `<div class="rp-doc rp-preview">${buildReportHtml(data, meta)}</div>`;
      lastPayload = { rows, startIso: startVal, endIso: endVal, generatedAt: meta.generatedAt };
      document.getElementById("r-download").disabled = false;
      showToast(`Report ready — ${rows.length} record${rows.length === 1 ? "" : "s"} found.`, "success");
    } catch (err) {
      previewCard.innerHTML = `<div class="empty-state"><div class="empty-icon">⚠️</div><h4>Could not generate report</h4><p>${err.message || err}</p></div>`;
    } finally {
      setLoading(btn, false);
    }
  });

  document.getElementById("r-download").addEventListener("click", async () => {
    if (!lastPayload) return;
    const btn = document.getElementById("r-download");
    setLoading(btn, true, "Preparing…");
    try {
      const reportId = uid();
      await setReportPayload(reportId, lastPayload);
      chrome.tabs.create({ url: chrome.runtime.getURL(`report/report.html?reportId=${reportId}`) });
    } finally {
      setLoading(btn, false);
    }
  });
}

function firstOfMonth() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1);
}
