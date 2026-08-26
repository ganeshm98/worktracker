import { WORK_TYPES, PRIORITIES, STATUSES } from "../../shared/constants.js";
import { todayISO, escapeHtml } from "../../shared/utils.js";

const DEFAULT_STATUS_FOR_TYPE = { Work: "Completed", Todo: "Todo", "Follow-up": "Follow-up Required" };

export function renderWorkFormFields({ categories, flags, values = {}, idPrefix = "wf" }) {
  const v = {
    date: values.date || todayISO(),
    description: values.description || "",
    workType: values.workType || "Work",
    category: values.category || categories[0] || "",
    priority: values.priority || "Medium",
    flag: values.flag || flags[0] || "None",
    status: values.status || DEFAULT_STATUS_FOR_TYPE[values.workType || "Work"],
    followUpDate: values.followUpDate || "",
    notes: values.notes || ""
  };
  const p = idPrefix;
  const opt = (list, selected) =>
    list.map((item) => `<option value="${escapeHtml(item)}" ${item === selected ? "selected" : ""}>${escapeHtml(item)}</option>`).join("");

  return `
    <div class="form-row">
      <div class="field">
        <label for="${p}-date">Date</label>
        <input class="input" type="date" id="${p}-date" value="${v.date}" required />
      </div>
      <div class="field">
        <label for="${p}-type">Work Type</label>
        <select class="select" id="${p}-type">${opt(WORK_TYPES, v.workType)}</select>
      </div>
    </div>

    <div class="field">
      <label for="${p}-desc">Description</label>
      <textarea class="textarea" id="${p}-desc" rows="3" placeholder="What did you work on / need to do?" required>${escapeHtml(v.description)}</textarea>
    </div>

    <div class="form-row-3">
      <div class="field">
        <label for="${p}-category">Category</label>
        <select class="select" id="${p}-category">${opt(categories, v.category)}</select>
      </div>
      <div class="field">
        <label for="${p}-priority">Priority</label>
        <select class="select" id="${p}-priority">${opt(PRIORITIES, v.priority)}</select>
      </div>
      <div class="field">
        <label for="${p}-flag">Flag</label>
        <select class="select" id="${p}-flag">${opt(flags, v.flag)}</select>
      </div>
    </div>

    <div class="form-row">
      <div class="field">
        <label for="${p}-status">Status</label>
        <select class="select" id="${p}-status">${opt(STATUSES, v.status)}</select>
      </div>
      <div class="field">
        <label for="${p}-followup-date">Follow-up Date <span class="hint">(optional)</span></label>
        <input class="input" type="date" id="${p}-followup-date" value="${v.followUpDate}" />
      </div>
    </div>

    <div class="field">
      <label for="${p}-notes">Notes <span class="hint">(optional)</span></label>
      <textarea class="textarea" id="${p}-notes" rows="2" placeholder="Any extra context…">${escapeHtml(v.notes)}</textarea>
    </div>
  `;
}

export function attachWorkFormBehavior(root, idPrefix = "wf") {
  const p = idPrefix;
  const typeSelect = root.querySelector(`#${p}-type`);
  const statusSelect = root.querySelector(`#${p}-status`);
  let statusTouchedByUser = false;
  statusSelect?.addEventListener("change", () => { statusTouchedByUser = true; });
  typeSelect?.addEventListener("change", () => {
    if (!statusTouchedByUser) {
      statusSelect.value = DEFAULT_STATUS_FOR_TYPE[typeSelect.value] || "Todo";
    }
  });
}

export function readWorkForm(root, idPrefix = "wf") {
  const p = idPrefix;
  const val = (id) => root.querySelector(`#${p}-${id}`)?.value?.trim() ?? "";
  return {
    date: val("date"),
    description: val("desc"),
    workType: val("type"),
    category: val("category"),
    priority: val("priority"),
    flag: val("flag"),
    status: val("status"),
    followUpDate: val("followup-date"),
    notes: val("notes")
  };
}

export function validateWorkForm(data) {
  const errors = {};
  if (!data.date) errors.date = "Date is required.";
  if (!data.description || data.description.length < 2) errors.description = "Please describe the work.";
  if (data.description && data.description.length > 2000) errors.description = "Keep it under 2000 characters.";
  return { valid: Object.keys(errors).length === 0, errors };
}

export function applyFieldErrors(root, errors, idPrefix = "wf") {
  root.querySelectorAll(".field-error").forEach((el) => el.remove());
  root.querySelectorAll(".has-error").forEach((el) => el.classList.remove("has-error"));
  Object.entries(errors).forEach(([field, message]) => {
    const key = field === "description" ? "desc" : field;
    const input = root.querySelector(`#${idPrefix}-${key}`);
    if (!input) return;
    const fieldWrap = input.closest(".field");
    fieldWrap?.classList.add("has-error");
    const err = document.createElement("span");
    err.className = "field-error";
    err.textContent = message;
    fieldWrap?.appendChild(err);
  });
}
