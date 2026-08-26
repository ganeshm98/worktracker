// Light/dark/system theme engine shared by every extension page (popup, app,
// report). Preference is stored in chrome.storage.local (source of truth,
// synced live across all open extension pages via onChanged) and mirrored
// into localStorage purely so shared/theme-init.js can apply it synchronously
// before first paint on each page.

const STORAGE_KEY = "mwt_theme";
const LOCAL_MIRROR_KEY = "mwt-theme";
const ORDER = ["system", "light", "dark"];
const ICON = { system: "🖥️", light: "☀️", dark: "🌙" };
const LABEL = { system: "System", light: "Light", dark: "Dark" };

export function getStoredTheme() {
  return new Promise((resolve) => {
    chrome.storage.local.get([STORAGE_KEY], (res) => resolve(res[STORAGE_KEY] || "system"));
  });
}

export function applyTheme(pref) {
  const root = document.documentElement;
  if (pref === "light" || pref === "dark") {
    root.setAttribute("data-theme", pref);
  } else {
    root.removeAttribute("data-theme");
  }
  try {
    if (pref === "light" || pref === "dark") localStorage.setItem(LOCAL_MIRROR_KEY, pref);
    else localStorage.removeItem(LOCAL_MIRROR_KEY);
  } catch {
    /* localStorage unavailable — page will still theme correctly this session */
  }
}

export async function initTheme() {
  const pref = await getStoredTheme();
  applyTheme(pref);
  return pref;
}

export async function setTheme(pref) {
  await new Promise((resolve) => chrome.storage.local.set({ [STORAGE_KEY]: pref }, resolve));
  applyTheme(pref);
}

/** Calls `callback(pref)` whenever the theme changes in another extension page. */
export function watchTheme(callback) {
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local" || !changes[STORAGE_KEY]) return;
    const pref = changes[STORAGE_KEY].newValue || "system";
    applyTheme(pref);
    callback?.(pref);
  });
}

export function isDarkMode() {
  const explicit = document.documentElement.dataset.theme;
  if (explicit === "dark") return true;
  if (explicit === "light") return false;
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

/** Wires a button to cycle System → Light → Dark and reflect the current state. */
export function mountThemeToggle(button) {
  async function refresh() {
    const pref = await getStoredTheme();
    button.textContent = ICON[pref];
    button.title = `Theme: ${LABEL[pref]} (click to change)`;
    button.setAttribute("aria-label", button.title);
  }
  button.addEventListener("click", async () => {
    const current = await getStoredTheme();
    const next = ORDER[(ORDER.indexOf(current) + 1) % ORDER.length];
    await setTheme(next);
    refresh();
  });
  watchTheme(refresh);
  refresh();
}
