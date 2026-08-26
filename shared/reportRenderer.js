import { escapeHtml, formatDisplayDate, formatDisplayDateTime } from "./utils.js";
import { BRAND } from "./constants.js";

export function computeReportData(rows) {
  const completedWork = rows.filter((r) => r.workType === "Work" && r.status === "Completed");
  const todoItems = rows.filter((r) => r.workType === "Todo");
  const followUps = rows.filter((r) => r.workType === "Follow-up" || r.flag === "Follow-up" || r.status === "Follow-up Required");

  const byCategory = tally(rows, "category");
  const byStatus = tally(rows, "status");
  const byFlag = tally(rows.filter((r) => r.flag && r.flag !== "None"), "flag");

  const byDate = {};
  rows.forEach((r) => {
    if (!r.date) return;
    (byDate[r.date] = byDate[r.date] || []).push(r);
  });
  const days = Object.keys(byDate).sort();

  return {
    totalRecords: rows.length,
    completedWork,
    todoItems,
    followUps,
    pendingTodos: todoItems.filter((r) => r.status !== "Completed").length,
    pendingFollowUps: followUps.filter((r) => r.status !== "Completed").length,
    byCategory,
    byStatus,
    byFlag,
    byDate,
    days
  };
}

function tally(rows, key) {
  const map = {};
  rows.forEach((r) => { if (r[key]) map[r[key]] = (map[r[key]] || 0) + 1; });
  return map;
}

function statRow(label, value) {
  return `<div class="rp-stat"><div class="rp-stat-value">${value}</div><div class="rp-stat-label">${label}</div></div>`;
}

function tallyTable(map, colLabel) {
  const entries = Object.entries(map).sort((a, b) => b[1] - a[1]);
  if (!entries.length) return `<p class="rp-muted">No data.</p>`;
  return `
    <table class="rp-table">
      <thead><tr><th>${colLabel}</th><th>Count</th></tr></thead>
      <tbody>${entries.map(([k, v]) => `<tr><td>${escapeHtml(k)}</td><td>${v}</td></tr>`).join("")}</tbody>
    </table>`;
}

function recordsTable(rows, columns) {
  if (!rows.length) return `<p class="rp-muted">No records in this range.</p>`;
  return `
    <table class="rp-table">
      <thead><tr>${columns.map((c) => `<th>${c.label}</th>`).join("")}</tr></thead>
      <tbody>
        ${rows
          .map(
            (r) => `<tr>${columns.map((c) => `<td>${escapeHtml(c.get(r) ?? "")}</td>`).join("")}</tr>`
          )
          .join("")}
      </tbody>
    </table>`;
}

const workColumns = [
  { label: "Date", get: (r) => formatDisplayDate(r.date) },
  { label: "Description", get: (r) => r.description },
  { label: "Category", get: (r) => r.category },
  { label: "Priority", get: (r) => r.priority },
  { label: "Status", get: (r) => r.status }
];

const todoColumns = [
  { label: "Due Date", get: (r) => formatDisplayDate(r.date) },
  { label: "Description", get: (r) => r.description },
  { label: "Category", get: (r) => r.category },
  { label: "Status", get: (r) => r.status },
  { label: "Notes", get: (r) => r.notes }
];

const followUpColumns = [
  { label: "Date", get: (r) => formatDisplayDate(r.date) },
  { label: "Description", get: (r) => r.description },
  { label: "Flag", get: (r) => r.flag },
  { label: "Status", get: (r) => r.status },
  { label: "Follow-up Date", get: (r) => (r.followUpDate ? formatDisplayDate(r.followUpDate) : "—") }
];

export function buildReportHtml(data, meta) {
  const { startIso, endIso, generatedAt } = meta;

  const dailySummary = data.days.length
    ? data.days
        .map((date) => {
          const items = data.byDate[date];
          return `
        <div class="rp-day">
          <div class="rp-day-heading">${formatDisplayDate(date)} <span class="rp-muted">(${items.length} item${items.length === 1 ? "" : "s"})</span></div>
          <ul class="rp-day-list">
            ${items
              .map(
                (r) => `<li><strong>${escapeHtml(r.description)}</strong> — ${escapeHtml(r.workType)} · ${escapeHtml(r.category || "Uncategorized")} · ${escapeHtml(r.status)}${r.flag && r.flag !== "None" ? ` · 🚩 ${escapeHtml(r.flag)}` : ""}</li>`
              )
              .join("")}
          </ul>
        </div>`;
        })
        .join("")
    : `<p class="rp-muted">No work logged in this date range.</p>`;

  return `
    <div class="rp-header">
      <div class="rp-brand">
        <span class="rp-mark">W</span>
        <div>
          <div class="rp-brand-name">${BRAND.name}</div>
          <div class="rp-brand-tag">${BRAND.tagline}</div>
        </div>
      </div>
      <div class="rp-meta">
        <div class="rp-report-title">Work Report</div>
        <div>${formatDisplayDate(startIso)} – ${formatDisplayDate(endIso)}</div>
        <div class="rp-muted">Generated ${formatDisplayDateTime(generatedAt)}</div>
      </div>
    </div>

    <section class="rp-section">
      <h2>Summary Statistics</h2>
      <div class="rp-stats">
        ${statRow("Total Records", data.totalRecords)}
        ${statRow("Completed Work", data.completedWork.length)}
        ${statRow("Pending Todos", data.pendingTodos)}
        ${statRow("Pending Follow-ups", data.pendingFollowUps)}
      </div>
    </section>

    <section class="rp-section rp-columns">
      <div>
        <h3>By Category</h3>
        ${tallyTable(data.byCategory, "Category")}
      </div>
      <div>
        <h3>By Status</h3>
        ${tallyTable(data.byStatus, "Status")}
      </div>
      <div>
        <h3>By Flag</h3>
        ${tallyTable(data.byFlag, "Flag")}
      </div>
    </section>

    <section class="rp-section">
      <h2>Daily Work Summary</h2>
      ${dailySummary}
    </section>

    <section class="rp-section">
      <h2>Completed Work (${data.completedWork.length})</h2>
      ${recordsTable(data.completedWork, workColumns)}
    </section>

    <section class="rp-section">
      <h2>Todo Items (${data.todoItems.length})</h2>
      ${recordsTable(data.todoItems, todoColumns)}
    </section>

    <section class="rp-section">
      <h2>Follow-ups (${data.followUps.length})</h2>
      ${recordsTable(data.followUps, followUpColumns)}
    </section>

    <footer class="rp-footer">Generated by ${BRAND.name} · Data source: your linked Google Sheet</footer>
  `;
}
