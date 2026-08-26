import { escapeHtml } from "./utils.js";

function slug(str) {
  return String(str).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

export function statusBadge(status) {
  if (!status) return "";
  return `<span class="badge badge-status-${slug(status)}">${escapeHtml(status)}</span>`;
}

export function priorityBadge(priority) {
  if (!priority) return "";
  return `<span class="badge badge-priority-${slug(priority)}">${escapeHtml(priority)}</span>`;
}

export function flagBadge(flag) {
  if (!flag || flag === "None") return "";
  return `<span class="badge badge-flag flag-${slug(flag)}">🚩 ${escapeHtml(flag)}</span>`;
}

export function categoryBadge(category) {
  if (!category) return "";
  return `<span class="badge badge-category">${escapeHtml(category)}</span>`;
}
