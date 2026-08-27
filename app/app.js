import { getSpreadsheetId, getCategories, getFlags } from "../shared/storage.js";
import { verifySpreadsheet } from "../shared/sheetsApi.js";
import { getUserProfile, hasStoredSession } from "../shared/auth.js";
import { showToast } from "../shared/ui.js";
import { initTheme, mountThemeToggle } from "../shared/theme.js";

initTheme();
mountThemeToggle(document.getElementById("theme-toggle"));

const viewRoot = document.getElementById("view-root");
const viewTitle = document.getElementById("view-title");
const nav = document.getElementById("main-nav");
const sidebar = document.getElementById("sidebar");
const connStatusBtn = document.getElementById("connection-status");
const connSimple = document.getElementById("conn-simple");
const connDot = connStatusBtn.querySelector(".conn-dot");
const connText = connStatusBtn.querySelector(".conn-text");
const connProfile = document.getElementById("conn-profile");
const connAvatar = document.getElementById("conn-avatar");
const connName = document.getElementById("conn-name");
const connEmail = document.getElementById("conn-email");

let cachedProfile = null;
async function loadProfile() {
  if (cachedProfile) return cachedProfile;
  try {
    cachedProfile = await getUserProfile(false);
  } catch {
    cachedProfile = null;
  }
  return cachedProfile;
}

const ROUTES = {
  dashboard: { title: "Dashboard", load: () => import("./views/dashboard.js") },
  "add-work": { title: "Add Work", load: () => import("./views/addWork.js") },
  todos: { title: "Todo & Follow-up", load: () => import("./views/todos.js") },
  history: { title: "Work History", load: () => import("./views/history.js") },
  reports: { title: "Reports", load: () => import("./views/reports.js") },
  settings: { title: "Settings", load: () => import("./views/settings.js") }
};

export const appState = {
  spreadsheetId: null,
  categories: [],
  flags: [],
  connected: false
};

export async function refreshAppState() {
  appState.spreadsheetId = await getSpreadsheetId();
  appState.categories = await getCategories();
  appState.flags = await getFlags();
  return appState;
}

export async function refreshConnectionStatus() {
  if (!appState.spreadsheetId) {
    cachedProfile = null;
    setConnStatus("offline", "No spreadsheet linked");
    return false;
  }
  if (!(await hasStoredSession())) {
    cachedProfile = null;
    appState.connected = false;
    setConnStatus("offline", "Not connected");
    return false;
  }

  const result = await verifySpreadsheet(appState.spreadsheetId, { interactive: false });
  if (!result.ok) {
    cachedProfile = null;
    setConnStatus("offline", "Not connected");
    appState.connected = false;
    return false;
  }

  appState.connected = true;
  const profile = await loadProfile();
  if (profile && (profile.email || profile.name)) {
    showProfile(profile);
  } else {
    setConnStatus("online", result.title || "Connected");
  }
  return true;
}

function setConnStatus(state, text) {
  connProfile.classList.add("hidden");
  connSimple.classList.remove("hidden");
  connDot.className = `conn-dot ${state}`;
  connText.textContent = text;
}

function showProfile(profile) {
  connSimple.classList.add("hidden");
  connProfile.classList.remove("hidden");
  connAvatar.src = profile.picture || "";
  connAvatar.alt = profile.name || profile.email || "Connected account";
  connName.textContent = profile.name || "Connected";
  connEmail.textContent = profile.email || "";
}

export function go(route) {
  location.hash = `#/${route}`;
}

let currentCleanup = null;

async function renderRoute() {
  const hash = location.hash.replace(/^#\/?/, "");
  const route = ROUTES[hash] ? hash : "dashboard";

  nav.querySelectorAll("a").forEach((a) => a.classList.toggle("active", a.dataset.route === route));
  viewTitle.textContent = ROUTES[route].title;
  sidebar.classList.remove("open");

  await refreshAppState();

  const hasSession = appState.spreadsheetId ? await hasStoredSession() : false;
  if ((!appState.spreadsheetId || !hasSession) && route !== "settings") {
    showToast(
      appState.spreadsheetId ? "Reconnect your Google account to continue." : "Connect Google Sheets to get started.",
      "info"
    );
    location.hash = "#/settings";
    return;
  }

  if (typeof currentCleanup === "function") {
    try { currentCleanup(); } catch { /* noop */ }
    currentCleanup = null;
  }

  viewRoot.innerHTML = `<div class="view-loading"><span class="spinner spinner-dark"></span> Loading…</div>`;
  try {
    const mod = await ROUTES[route].load();
    viewRoot.innerHTML = "";
    currentCleanup = await mod.render(viewRoot, { appState, go, refreshAppState, refreshConnectionStatus });
  } catch (err) {
    console.error(err);
    viewRoot.innerHTML = `<div class="empty-state"><div class="empty-icon">⚠️</div><h4>Something went wrong</h4><p>${err.message || err}</p></div>`;
  }

  refreshConnectionStatus();
}

window.addEventListener("hashchange", renderRoute);

document.getElementById("mobile-nav-toggle").addEventListener("click", () => {
  sidebar.classList.toggle("open");
});
document.getElementById("topbar-add").addEventListener("click", () => go("add-work"));
document.getElementById("topbar-report").addEventListener("click", () => go("reports"));
connStatusBtn.addEventListener("click", () => go("settings"));

renderRoute();
