import { getRowsForDateRange, updateRowByRowNumber, deleteRowByRowNumber } from "../../shared/sheetsApi.js";
import { todayISO, toISODate, escapeHtml, formatDisplayDate, nowISOTime, addDays, debounce } from "../../shared/utils.js";
import { statusBadge, priorityBadge, flagBadge, categoryBadge } from "../../shared/badges.js";
import { STATUSES } from "../../shared/constants.js";
import { showToast, setLoading, confirmAction, openModal } from "../../shared/ui.js";
import { renderWorkFormFields, attachWorkFormBehavior, readWorkForm, validateWorkForm, applyFieldErrors } from "./workFormFields.js";

const PAGE_SIZE = 20;
let state = { all: [], filtered: [], page: 1, sort: "date-desc" };

export async function render(container, ctx) {
  const { appState } = ctx;
  const start = toISODate(addDays(-30));
  const end = todayISO();

  container.innerHTML = `
    <div class="view-toolbar">
      <span class="section-title">Work History</span>
      <span class="text-muted" id="result-count" style="font-size:13px;"></span>
    </div>

    <div class="filters-bar">
      <div class="field"><label for="h-start">Start Date</label><input class="input" type="date" id="h-start" value="${start}" /></div>
      <div class="field"><label for="h-end">End Date</label><input class="input" type="date" id="h-end" value="${end}" /></div>
      <div class="field"><label for="h-category">Category</label><select class="select" id="h-category"><option>All</option>${appState.categories.map((c) => `<option>${c}</option>`).join("")}</select></div>
      <div class="field"><label for="h-status">Status</label><select class="select" id="h-status"><option>All</option>${STATUSES.map((s) => `<option>${s}</option>`).join("")}</select></div>
      <div class="field"><label for="h-flag">Flag</label><select class="select" id="h-flag"><option>All</option>${appState.flags.map((f) => `<option>${f}</option>`).join("")}</select></div>
      <div class="field grow"><label for="h-search">Search</label><input class="input" id="h-search" placeholder="Search description or notes…" /></div>
      <div class="field"><label for="h-sort">Sort</label>
        <select class="select" id="h-sort">
          <option value="date-desc">Date (newest)</option>
          <option value="date-asc">Date (oldest)</option>
          <option value="priority">Priority (high first)</option>
          <option value="status">Status</option>
        </select>
      </div>
      <button class="btn btn-secondary btn-sm" id="h-refresh">↻ Refresh</button>
    </div>

    <div class="card" style="padding:0;">
      <div id="h-table-wrap"></div>
    </div>
    <div class="pagination" id="h-pagination"></div>
  `;

  const els = Object.fromEntries(
    ["start", "end", "category", "status", "flag", "search", "sort", "refresh"].map((k) => [k, document.getElementById(`h-${k}`)])
  );

  async function load(force = false) {
    document.getElementById("h-table-wrap").innerHTML = `<div style="padding:20px;"><div class="skeleton" style="height:220px"></div></div>`;
    try {
      state.all = await getRowsForDateRange(appState.spreadsheetId, els.start.value, els.end.value, { force });
      state.page = 1;
      applyFilters();
    } catch (err) {
      document.getElementById("h-table-wrap").innerHTML = `<div class="empty-state"><div class="empty-icon">⚠️</div><h4>Could not load history</h4><p>${err.message || err}</p></div>`;
    }
  }

  function applyFilters() {
    let rows = state.all;
    if (els.category.value !== "All") rows = rows.filter((r) => r.category === els.category.value);
    if (els.status.value !== "All") rows = rows.filter((r) => r.status === els.status.value);
    if (els.flag.value !== "All") rows = rows.filter((r) => r.flag === els.flag.value);
    if (els.search.value.trim()) {
      const q = els.search.value.trim().toLowerCase();
      rows = rows.filter((r) => r.description.toLowerCase().includes(q) || r.notes.toLowerCase().includes(q));
    }
    rows = sortRows(rows, els.sort.value);
    state.filtered = rows;
    state.page = 1;
    renderPage(appState, els, load);
  }

  [els.start, els.end].forEach((el) => el.addEventListener("change", () => load(true)));
  [els.category, els.status, els.flag, els.sort].forEach((el) => el.addEventListener("change", applyFilters));
  els.search.addEventListener("input", debounce(applyFilters, 200));
  els.refresh.addEventListener("click", () => load(true));

  await load(false);
}

function sortRows(rows, sort) {
  const copy = [...rows];
  const priorityRank = { High: 0, Medium: 1, Low: 2 };
  if (sort === "date-asc") copy.sort((a, b) => (a.date < b.date ? -1 : 1));
  else if (sort === "priority") copy.sort((a, b) => (priorityRank[a.priority] ?? 3) - (priorityRank[b.priority] ?? 3));
  else if (sort === "status") copy.sort((a, b) => a.status.localeCompare(b.status));
  else copy.sort((a, b) => (a.date < b.date ? 1 : -1));
  return copy;
}

function renderPage(appState, els, reload) {
  document.getElementById("result-count").textContent = `${state.filtered.length} record${state.filtered.length === 1 ? "" : "s"}`;
  const wrap = document.getElementById("h-table-wrap");
  const totalPages = Math.max(1, Math.ceil(state.filtered.length / PAGE_SIZE));
  state.page = Math.min(state.page, totalPages);
  const pageRows = state.filtered.slice((state.page - 1) * PAGE_SIZE, state.page * PAGE_SIZE);

  if (!pageRows.length) {
    wrap.innerHTML = `<div class="empty-state"><div class="empty-icon">🔍</div><h4>No matching records</h4><p>Try widening your date range or clearing filters.</p></div>`;
    document.getElementById("h-pagination").innerHTML = "";
    return;
  }

  wrap.innerHTML = `
    <div class="table-wrap" style="border:none;border-radius:0;">
      <table class="table">
        <thead><tr><th>Date</th><th>Description</th><th>Type</th><th>Category</th><th>Priority</th><th>Flag</th><th>Status</th><th>Follow-up</th><th></th></tr></thead>
        <tbody>
          ${pageRows
            .map(
              (r, i) => `
            <tr data-idx="${i}">
              <td>${formatDisplayDate(r.date)}</td>
              <td class="desc-cell">${escapeHtml(r.description)}${r.notes ? `<div class="text-muted" style="font-size:12px;margin-top:3px;">${escapeHtml(r.notes)}</div>` : ""}</td>
              <td>${escapeHtml(r.workType)}</td>
              <td>${categoryBadge(r.category)}</td>
              <td>${priorityBadge(r.priority)}</td>
              <td>${flagBadge(r.flag)}</td>
              <td>${statusBadge(r.status)}</td>
              <td>${r.followUpDate ? formatDisplayDate(r.followUpDate) : "—"}</td>
              <td>
                <div class="row-actions">
                  <button class="icon-btn edit-btn" data-idx="${i}" title="Edit" aria-label="Edit">✎</button>
                  <button class="icon-btn delete-btn" data-idx="${i}" title="Delete" aria-label="Delete">🗑</button>
                </div>
              </td>
            </tr>`
            )
            .join("")}
        </tbody>
      </table>
    </div>
  `;

  wrap.querySelectorAll(".edit-btn").forEach((btn) => {
    btn.addEventListener("click", () => openEditModal(appState, pageRows[Number(btn.dataset.idx)], () => reload(true)));
  });
  wrap.querySelectorAll(".delete-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const row = pageRows[Number(btn.dataset.idx)];
      const ok = await confirmAction({
        title: "Delete this record?",
        message: `"${row.description}" will be permanently removed from your spreadsheet.`,
        confirmText: "Delete",
        danger: true
      });
      if (!ok) return;
      try {
        await deleteRowByRowNumber(appState.spreadsheetId, row.monthName, row.sheetRow);
        showToast("Deleted.", "success");
        reload(true);
      } catch (err) {
        showToast(err.message || "Could not delete.", "error");
      }
    });
  });

  const pager = document.getElementById("h-pagination");
  pager.innerHTML = `
    <button class="btn btn-ghost btn-sm" id="h-prev" ${state.page <= 1 ? "disabled" : ""}>← Prev</button>
    <span>Page ${state.page} of ${totalPages}</span>
    <button class="btn btn-ghost btn-sm" id="h-next" ${state.page >= totalPages ? "disabled" : ""}>Next →</button>
  `;
  document.getElementById("h-prev")?.addEventListener("click", () => { state.page--; renderPage(appState, els, reload); });
  document.getElementById("h-next")?.addEventListener("click", () => { state.page++; renderPage(appState, els, reload); });
}

function openEditModal(appState, row, onSaved) {
  const { modal, close } = openModal(`
    <div class="modal-header">
      <h3>Edit Record</h3>
      <button class="icon-btn" data-modal-close aria-label="Close">✕</button>
    </div>
    <form id="edit-form">
      ${renderWorkFormFields({ categories: appState.categories, flags: appState.flags, values: row })}
      <div class="modal-actions">
        <button type="button" class="btn btn-ghost" data-modal-close>Cancel</button>
        <button type="submit" class="btn btn-primary" id="edit-submit">Save Changes</button>
      </div>
    </form>
  `);
  const form = modal.querySelector("#edit-form");
  attachWorkFormBehavior(form);
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const data = readWorkForm(form);
    const { valid, errors } = validateWorkForm(data);
    applyFieldErrors(form, errors);
    if (!valid) return;
    const btn = document.getElementById("edit-submit");
    setLoading(btn, true);
    try {
      await updateRowByRowNumber(appState.spreadsheetId, row.monthName, row.sheetRow, {
        ...row,
        ...data,
        updatedTime: nowISOTime()
      });
      showToast("Record updated.", "success");
      close();
      onSaved();
    } catch (err) {
      showToast(err.message || "Could not save.", "error");
      setLoading(btn, false);
    }
  });
}
