import { getRowsForDateRange, updateRowByRowNumber, deleteRowByRowNumber, appendRow } from "../../shared/sheetsApi.js";
import { todayISO, toISODate, escapeHtml, formatDisplayDate, nowISOTime, uid, monthSheetName, addDays } from "../../shared/utils.js";
import { statusBadge, priorityBadge, flagBadge, categoryBadge } from "../../shared/badges.js";
import { STATUSES } from "../../shared/constants.js";
import { showToast, setLoading, confirmAction, openModal } from "../../shared/ui.js";
import { renderWorkFormFields, attachWorkFormBehavior, readWorkForm, validateWorkForm, applyFieldErrors } from "./workFormFields.js";

let state = { rows: [], statusFilter: "All", search: "" };

export async function render(container, ctx) {
  const { appState } = ctx;
  const today = todayISO();
  const start = toISODate(addDays(-30));
  const end = toISODate(addDays(60));

  container.innerHTML = `
    <div class="view-toolbar">
      <span class="section-title">Todo & Follow-up</span>
      <button class="btn btn-primary btn-sm" id="add-todo-btn">＋ Add Todo / Follow-up</button>
    </div>

    <div class="filters-bar">
      <div class="field">
        <label for="todo-start">From</label>
        <input class="input" type="date" id="todo-start" value="${start}" />
      </div>
      <div class="field">
        <label for="todo-end">To</label>
        <input class="input" type="date" id="todo-end" value="${end}" />
      </div>
      <div class="field">
        <label for="todo-status">Status</label>
        <select class="select" id="todo-status">
          <option>All</option>
          ${STATUSES.map((s) => `<option>${s}</option>`).join("")}
        </select>
      </div>
      <div class="field grow">
        <label for="todo-search">Search</label>
        <input class="input" id="todo-search" placeholder="Search description or notes…" />
      </div>
      <button class="btn btn-secondary btn-sm" id="todo-refresh">↻ Refresh</button>
    </div>

    <div class="card" style="padding:0;">
      <div id="todo-table-wrap"></div>
    </div>
  `;

  const els = {
    start: document.getElementById("todo-start"),
    end: document.getElementById("todo-end"),
    status: document.getElementById("todo-status"),
    search: document.getElementById("todo-search"),
    refresh: document.getElementById("todo-refresh")
  };

  async function load(force = false) {
    document.getElementById("todo-table-wrap").innerHTML = `<div style="padding:20px;"><div class="skeleton" style="height:180px"></div></div>`;
    try {
      const rows = await getRowsForDateRange(appState.spreadsheetId, els.start.value, els.end.value, { force });
      state.rows = rows.filter(
        (r) => r.workType === "Todo" || r.workType === "Follow-up" || r.flag === "Follow-up" || r.status === "Follow-up Required"
      );
      applyFiltersAndRender(appState);
    } catch (err) {
      document.getElementById("todo-table-wrap").innerHTML = `<div class="empty-state"><div class="empty-icon">⚠️</div><h4>Could not load</h4><p>${err.message || err}</p></div>`;
    }
  }

  [els.start, els.end].forEach((el) => el.addEventListener("change", () => load(true)));
  els.status.addEventListener("change", () => { state.statusFilter = els.status.value; applyFiltersAndRender(appState); });
  els.search.addEventListener("input", () => { state.search = els.search.value.toLowerCase(); applyFiltersAndRender(appState); });
  els.refresh.addEventListener("click", () => load(true));

  document.getElementById("add-todo-btn").addEventListener("click", () => openTodoModal(appState, () => load(true)));

  await load(false);
}

function applyFiltersAndRender(appState) {
  let rows = state.rows;
  if (state.statusFilter !== "All") rows = rows.filter((r) => r.status === state.statusFilter);
  if (state.search) {
    rows = rows.filter(
      (r) => r.description.toLowerCase().includes(state.search) || r.notes.toLowerCase().includes(state.search)
    );
  }
  rows = [...rows].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  renderTable(rows, appState);
}

function renderTable(rows, appState) {
  const wrap = document.getElementById("todo-table-wrap");
  if (!rows.length) {
    wrap.innerHTML = `<div class="empty-state"><div class="empty-icon">✅</div><h4>Nothing here</h4><p>No todos or follow-ups match your filters.</p></div>`;
    return;
  }
  wrap.innerHTML = `
    <div class="table-wrap" style="border:none;border-radius:0;">
      <table class="table">
        <thead><tr><th>Due Date</th><th>Description</th><th>Category</th><th>Priority</th><th>Flag</th><th>Status</th><th></th></tr></thead>
        <tbody>
          ${rows
            .map(
              (r, i) => `
            <tr data-idx="${i}">
              <td>${formatDisplayDate(r.date)}${isOverdue(r) ? ' <span class="badge badge-priority-high">Overdue</span>' : ""}</td>
              <td class="desc-cell">${escapeHtml(r.description)}${r.notes ? `<div class="text-muted" style="font-size:12px;margin-top:3px;">${escapeHtml(r.notes)}</div>` : ""}</td>
              <td>${categoryBadge(r.category)}</td>
              <td>${priorityBadge(r.priority)}</td>
              <td>${flagBadge(r.flag)}</td>
              <td>
                <select class="select status-select" data-idx="${i}" style="min-width:150px;padding:6px 8px;font-size:12.5px;">
                  ${STATUSES.map((s) => `<option ${s === r.status ? "selected" : ""}>${s}</option>`).join("")}
                </select>
              </td>
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

  wrap.querySelectorAll(".status-select").forEach((sel) => {
    sel.addEventListener("change", async () => {
      const row = rows[Number(sel.dataset.idx)];
      const original = sel.value;
      sel.disabled = true;
      try {
        await updateRowByRowNumber(appState.spreadsheetId, row.monthName, row.sheetRow, {
          ...row,
          status: original,
          updatedTime: nowISOTime()
        });
        row.status = original;
        showToast("Status updated.", "success");
        chrome.runtime.sendMessage({ type: "mwt:refresh-badge" });
      } catch (err) {
        showToast(err.message || "Could not update status.", "error");
      } finally {
        sel.disabled = false;
      }
    });
  });

  wrap.querySelectorAll(".edit-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const row = rows[Number(btn.dataset.idx)];
      openTodoModal(appState, () => reloadCurrentFilters(appState), row);
    });
  });

  wrap.querySelectorAll(".delete-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const row = rows[Number(btn.dataset.idx)];
      const ok = await confirmAction({
        title: "Delete this item?",
        message: `"${row.description}" will be permanently removed from your spreadsheet.`,
        confirmText: "Delete",
        danger: true
      });
      if (!ok) return;
      try {
        await deleteRowByRowNumber(appState.spreadsheetId, row.monthName, row.sheetRow);
        showToast("Deleted.", "success");
        reloadCurrentFilters(appState);
      } catch (err) {
        showToast(err.message || "Could not delete.", "error");
      }
    });
  });
}

function reloadCurrentFilters(appState) {
  const start = document.getElementById("todo-start")?.value;
  const end = document.getElementById("todo-end")?.value;
  if (!start || !end) return;
  getRowsForDateRange(appState.spreadsheetId, start, end, { force: true }).then((rows) => {
    state.rows = rows.filter(
      (r) => r.workType === "Todo" || r.workType === "Follow-up" || r.flag === "Follow-up" || r.status === "Follow-up Required"
    );
    applyFiltersAndRender(appState);
  });
}

function isOverdue(row) {
  return row.date < todayISO() && row.status !== "Completed";
}


function openTodoModal(appState, onSaved, existing = null) {
  const isEdit = !!existing;
  const { modal, close } = openModal(`
    <div class="modal-header">
      <h3>${isEdit ? "Edit Item" : "Add Todo / Follow-up"}</h3>
      <button class="icon-btn" data-modal-close aria-label="Close">✕</button>
    </div>
    <form id="todo-modal-form">
      ${renderWorkFormFields({
        categories: appState.categories,
        flags: appState.flags,
        values: existing || { workType: "Todo", status: "Todo" }
      })}
      <div class="modal-actions">
        <button type="button" class="btn btn-ghost" data-modal-close>Cancel</button>
        <button type="submit" class="btn btn-primary" id="todo-modal-submit">${isEdit ? "Save Changes" : "Add Item"}</button>
      </div>
    </form>
  `);

  const form = modal.querySelector("#todo-modal-form");
  attachWorkFormBehavior(form);

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const data = readWorkForm(form);
    const { valid, errors } = validateWorkForm(data);
    applyFieldErrors(form, errors);
    if (!valid) return;

    const submitBtn = document.getElementById("todo-modal-submit");
    setLoading(submitBtn, true);
    try {
      const now = nowISOTime();
      if (isEdit) {
        await updateRowByRowNumber(appState.spreadsheetId, existing.monthName, existing.sheetRow, {
          ...existing,
          ...data,
          updatedTime: now
        });
        showToast("Item updated.", "success");
      } else {
        const row = { id: uid(), ...data, createdTime: now, updatedTime: now };
        await appendRow(appState.spreadsheetId, monthSheetName(row.date), row);
        showToast("Item added.", "success");
      }
      chrome.runtime.sendMessage({ type: "mwt:refresh-badge" });
      close();
      onSaved();
    } catch (err) {
      showToast(err.message || "Could not save.", "error");
      setLoading(submitBtn, false);
    }
  });
}
