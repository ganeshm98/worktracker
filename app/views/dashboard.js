import { getRowsForDateRange } from "../../shared/sheetsApi.js";
import { todayISO, toISODate, escapeHtml, formatDisplayDateTime, addDays } from "../../shared/utils.js";
import { statusBadge, priorityBadge, flagBadge, categoryBadge } from "../../shared/badges.js";
import { drawDonutChart, drawBarChart, buildLegend, PALETTE } from "../../shared/charts.js";

export async function render(container, ctx) {
  const { appState, go } = ctx;
  const today = todayISO();
  const rangeStart = toISODate(addDays(-30));

  container.innerHTML = `
    <div class="stat-grid" id="stat-grid">
      ${statSkeleton()}${statSkeleton()}${statSkeleton()}${statSkeleton()}
    </div>

    <div class="view-toolbar">
      <span class="section-title">Overview</span>
      <div class="flex gap-2">
        <button class="btn btn-primary btn-sm" id="dash-add">＋ Quick Add Work</button>
        <button class="btn btn-secondary btn-sm" id="dash-report">📄 Generate Report</button>
      </div>
    </div>

    <div class="dash-grid">
      <div class="dash-col">
        <section class="card">
          <h3 class="card-title">Today's Completed Work</h3>
          <div id="today-completed" class="list-loading"><div class="skeleton" style="height:70px"></div></div>
        </section>
        <section class="card">
          <h3 class="card-title">Today's Todos</h3>
          <div id="today-todos" class="list-loading"><div class="skeleton" style="height:70px"></div></div>
        </section>
        <section class="card">
          <h3 class="card-title">Pending Follow-ups</h3>
          <div id="pending-followups" class="list-loading"><div class="skeleton" style="height:70px"></div></div>
        </section>
      </div>

      <div class="dash-col">
        <section class="card">
          <h3 class="card-title">Recent Activity</h3>
          <div id="recent-activity" class="list-loading"><div class="skeleton" style="height:70px"></div></div>
        </section>
        <section class="card">
          <h3 class="card-title">Tasks by Status</h3>
          <div class="donut-card">
            <canvas id="chart-status" width="140" height="140" style="width:140px;height:140px"></canvas>
            <div class="legend" id="legend-status"></div>
          </div>
        </section>
      </div>
    </div>

    <div class="chart-row">
      <section class="card">
        <h3 class="card-title">Tasks by Category <span class="text-muted" style="font-weight:400;">(last 30 days)</span></h3>
        <div class="donut-card">
          <canvas id="chart-category" width="140" height="140" style="width:140px;height:140px"></canvas>
          <div class="legend" id="legend-category"></div>
        </div>
      </section>
      <section class="card">
        <h3 class="card-title">Tasks by Day <span class="text-muted" style="font-weight:400;">(last 7 days)</span></h3>
        <canvas id="chart-day" style="width:100%;height:220px"></canvas>
      </section>
    </div>
  `;

  document.getElementById("dash-add").addEventListener("click", () => go("add-work"));
  document.getElementById("dash-report").addEventListener("click", () => go("reports"));

  let rows = [];
  try {
    rows = await getRowsForDateRange(appState.spreadsheetId, rangeStart, today);
  } catch (err) {
    container.querySelector(".dash-grid").innerHTML =
      `<div class="empty-state"><div class="empty-icon">⚠️</div><h4>Could not load dashboard data</h4><p>${err.message || err}</p></div>`;
    return;
  }

  const todayRows = rows.filter((r) => r.date === today);
  const todayCompleted = todayRows.filter((r) => r.workType === "Work" && r.status === "Completed");
  const todayTodos = todayRows.filter((r) => r.workType === "Todo");
  const pendingFollowups = rows.filter(
    (r) => r.status !== "Completed" && (r.flag === "Follow-up" || r.workType === "Follow-up" || r.status === "Follow-up Required")
  );
  const pendingTodos = rows.filter((r) => r.workType === "Todo" && r.status !== "Completed");
  const thisMonthCount = rows.filter((r) => r.date.slice(0, 7) === today.slice(0, 7)).length;

  renderStats([
    { icon: "✅", color: "green", value: todayCompleted.length, label: "Completed Today" },
    { icon: "🗒️", color: "blue", value: pendingTodos.length, label: "Pending Todos" },
    { icon: "🔁", color: "amber", value: pendingFollowups.length, label: "Pending Follow-ups" },
    { icon: "📊", color: "blue", value: thisMonthCount, label: "Logged This Month" }
  ]);

  renderList("today-completed", todayCompleted, "No completed work logged today yet.", "✅");
  renderList("today-todos", todayTodos, "No todos for today.", "🗒️");
  renderList("pending-followups", pendingFollowups.slice(0, 8), "You're all caught up — no pending follow-ups.", "🎉");

  const recent = [...rows].sort((a, b) => (a.updatedTime < b.updatedTime ? 1 : -1)).slice(0, 8);
  renderList("recent-activity", recent, "Nothing logged yet. Add your first entry!", "🕘", true);

  renderStatusChart(rows);
  renderCategoryChart(rows);
  renderDayChart(rows, today);
}

function statSkeleton() {
  return `<div class="stat-card"><div class="skeleton" style="width:44px;height:44px;border-radius:12px;"></div><div style="flex:1"><div class="skeleton" style="height:22px;width:60%;margin-bottom:6px;"></div><div class="skeleton" style="height:12px;width:80%;"></div></div></div>`;
}

function renderStats(items) {
  const grid = document.getElementById("stat-grid");
  grid.innerHTML = items
    .map(
      (s) => `
    <div class="stat-card">
      <span class="stat-icon ${s.color}">${s.icon}</span>
      <div>
        <div class="stat-value">${s.value}</div>
        <div class="stat-label">${s.label}</div>
      </div>
    </div>`
    )
    .join("");
}

function renderList(id, items, emptyMsg, emptyIcon, showTime = false) {
  const el = document.getElementById(id);
  if (!items.length) {
    el.innerHTML = `<div class="empty-state"><div class="empty-icon">${emptyIcon}</div><p>${emptyMsg}</p></div>`;
    return;
  }
  el.innerHTML = items
    .map(
      (r) => `
    <div class="list-item">
      <span class="list-item-dot" style="background:${dotColor(r)}"></span>
      <div class="list-item-body">
        <div class="list-item-title">${escapeHtml(r.description)}</div>
        <div class="list-item-meta">
          ${categoryBadge(r.category)} ${statusBadge(r.status)} ${flagBadge(r.flag)}
          ${showTime ? `<span>· ${formatDisplayDateTime(r.updatedTime)}</span>` : ""}
        </div>
      </div>
    </div>`
    )
    .join("");
}

function dotColor(row) {
  if (row.status === "Completed") return "var(--green-500)";
  if (row.priority === "High") return "var(--red-500)";
  if (row.workType === "Todo") return "var(--blue-500)";
  return "var(--amber-500)";
}

function renderStatusChart(rows) {
  const statuses = ["Todo", "In Progress", "Completed", "Follow-up Required"];
  const counts = statuses.map((s) => rows.filter((r) => r.status === s).length);
  drawDonutChart(document.getElementById("chart-status"), { labels: statuses, values: counts, centerLabel: rows.length });
  buildLegend(document.getElementById("legend-status"), statuses, counts);
}

function renderCategoryChart(rows) {
  const byCategory = {};
  rows.forEach((r) => { if (r.category) byCategory[r.category] = (byCategory[r.category] || 0) + 1; });
  const labels = Object.keys(byCategory);
  const values = Object.values(byCategory);
  drawDonutChart(document.getElementById("chart-category"), { labels, values, centerLabel: values.reduce((a, b) => a + b, 0) });
  buildLegend(document.getElementById("legend-category"), labels, values, PALETTE);
}

function renderDayChart(rows, today) {
  const labels = [];
  const values = [];
  for (let i = 6; i >= 0; i--) {
    const d = addDays(-i);
    const iso = toISODate(d);
    labels.push(d.toLocaleDateString(undefined, { weekday: "short" }));
    values.push(rows.filter((r) => r.date === iso && r.status === "Completed").length);
  }
  drawBarChart(document.getElementById("chart-day"), { labels, values, color: "#16a34a", emptyText: "No completed tasks yet" });
}
