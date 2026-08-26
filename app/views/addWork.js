import { appendRow, getMonthRows } from "../../shared/sheetsApi.js";
import { monthSheetName, nowISOTime, uid, formatDisplayDate, escapeHtml } from "../../shared/utils.js";
import { showToast, setLoading } from "../../shared/ui.js";
import { statusBadge, priorityBadge, flagBadge, categoryBadge } from "../../shared/badges.js";
import {
  renderWorkFormFields,
  attachWorkFormBehavior,
  readWorkForm,
  validateWorkForm,
  applyFieldErrors
} from "./workFormFields.js";

let submitting = false;

export async function render(container, ctx) {
  const { appState } = ctx;

  container.innerHTML = `
    <div class="add-work-grid">
      <section class="card">
        <h3 class="card-title">Log completed work, a todo, or a follow-up</h3>
        <p class="card-subtitle">Submitting saves straight to your Google Sheet — add as many entries as you like for the same date.</p>
        <form id="add-work-form" class="add-work-form">
          ${renderWorkFormFields({ categories: appState.categories, flags: appState.flags })}
          <button type="submit" class="btn btn-success btn-block" id="add-work-submit">＋ Submit Work</button>
        </form>
      </section>

      <section class="card">
        <h3 class="card-title">Added for <span id="session-date-label">today</span></h3>
        <p class="card-subtitle">Entries you've logged for the selected date.</p>
        <div id="session-list" class="session-list"></div>
      </section>
    </div>
  `;

  injectStyles();

  const form = document.getElementById("add-work-form");
  attachWorkFormBehavior(form);

  const dateInput = document.getElementById("wf-date");
  const refreshSessionList = () => loadSessionList(appState.spreadsheetId, dateInput.value);
  dateInput.addEventListener("change", refreshSessionList);
  refreshSessionList();

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (submitting) return;

    const data = readWorkForm(form);
    const { valid, errors } = validateWorkForm(data);
    applyFieldErrors(form, errors);
    if (!valid) {
      showToast("Please fix the highlighted fields.", "error");
      return;
    }

    submitting = true;
    const submitBtn = document.getElementById("add-work-submit");
    setLoading(submitBtn, true, "Saving…");

    try {
      const now = nowISOTime();
      const row = { id: uid(), ...data, createdTime: now, updatedTime: now };
      await appendRow(appState.spreadsheetId, monthSheetName(row.date), row);
      showToast("Work saved to your spreadsheet.", "success");

      document.getElementById("wf-desc").value = "";
      document.getElementById("wf-notes").value = "";
      document.getElementById("wf-desc").focus();
      chrome.runtime.sendMessage({ type: "mwt:refresh-badge" });
      refreshSessionList();
    } catch (err) {
      showToast(err.message || "Could not save this entry.", "error");
    } finally {
      submitting = false;
      setLoading(submitBtn, false);
    }
  });
}

async function loadSessionList(spreadsheetId, dateIso) {
  const label = document.getElementById("session-date-label");
  const list = document.getElementById("session-list");
  label.textContent = formatDisplayDate(dateIso) || "this date";
  list.innerHTML = `<div class="skeleton" style="height:60px;"></div>`;

  try {
    const rows = await getMonthRows(spreadsheetId, monthSheetName(dateIso), { force: true });
    const dayRows = rows.filter((r) => r.date === dateIso).sort((a, b) => (b.createdTime > a.createdTime ? 1 : -1));

    if (!dayRows.length) {
      list.innerHTML = `<div class="empty-state"><div class="empty-icon">📝</div><h4>Nothing logged yet</h4><p>Entries you add for this date will appear here.</p></div>`;
      return;
    }

    list.innerHTML = dayRows
      .map(
        (r) => `
        <div class="list-item">
          <span class="list-item-dot" style="background:${dotColor(r)}"></span>
          <div class="list-item-body">
            <div class="list-item-title">${escapeHtml(r.description)}</div>
            <div class="list-item-meta">
              ${categoryBadge(r.category)} ${statusBadge(r.status)} ${priorityBadge(r.priority)} ${flagBadge(r.flag)}
            </div>
          </div>
        </div>`
      )
      .join("");
  } catch (err) {
    list.innerHTML = `<div class="empty-state"><div class="empty-icon">⚠️</div><h4>Could not load</h4><p>${err.message || err}</p></div>`;
  }
}

function dotColor(row) {
  if (row.status === "Completed") return "var(--green-500)";
  if (row.workType === "Todo") return "var(--blue-500)";
  return "var(--amber-500)";
}

function injectStyles() {
  if (document.getElementById("add-work-styles")) return;
  const style = document.createElement("style");
  style.id = "add-work-styles";
  style.textContent = `
    .add-work-grid { display: grid; grid-template-columns: 1.2fr 1fr; gap: 20px; align-items: start; }
    @media (max-width: 980px) { .add-work-grid { grid-template-columns: 1fr; } }
    .session-list { max-height: 520px; overflow-y: auto; }
  `;
  document.head.appendChild(style);
}
