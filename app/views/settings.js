import { getSpreadsheetId, setSpreadsheetId, getCategories, setCategories, getFlags, setFlags } from "../../shared/storage.js";
import {
  createSpreadsheet,
  verifySpreadsheet,
  ensureMonthSheet,
  clearSessionCache,
  applyStandardFormattingToAllSheets
} from "../../shared/sheetsApi.js";
import { getAuthToken, signOut, isSignedIn } from "../../shared/auth.js";
import { monthSheetName, todayISO, escapeHtml } from "../../shared/utils.js";
import { showToast, setLoading, confirmAction } from "../../shared/ui.js";

function extractSpreadsheetId(input) {
  const trimmed = input.trim();
  const match = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (match) return match[1];
  if (/^[a-zA-Z0-9-_]{20,}$/.test(trimmed)) return trimmed;
  return null;
}

export async function render(container, ctx) {
  const spreadsheetId = await getSpreadsheetId();
  const categories = await getCategories();
  const flags = await getFlags();
  const signedIn = await isSignedIn();

  container.innerHTML = `
    <div class="settings-grid">
      <section class="card">
        <h3 class="card-title">Google Account</h3>
        <p class="card-subtitle">MyWorkTracking reads and writes only to the one spreadsheet you link below.</p>
        <div class="settings-row">
          <div class="flex items-center gap-2">
            <span class="conn-dot ${signedIn ? "online" : "offline"}" style="position:static;"></span>
            <span>${signedIn ? "Connected to Google" : "Not connected"}</span>
          </div>
          <button class="btn ${signedIn ? "btn-ghost" : "btn-primary"} btn-sm" id="auth-btn">
            ${signedIn ? "Disconnect" : "Connect Google Account"}
          </button>
        </div>
      </section>

      <section class="card">
        <h3 class="card-title">Spreadsheet</h3>
        <p class="card-subtitle">One spreadsheet holds all your data, with a separate tab created automatically for each month.</p>

        <div id="current-sheet-box" class="current-sheet-box ${spreadsheetId ? "" : "hidden"}">
          <div>
            <div class="css-label">Linked spreadsheet</div>
            <div id="current-sheet-title">Loading…</div>
          </div>
          <a id="open-sheet-link" href="#" target="_blank" rel="noopener" class="btn btn-secondary btn-sm">Open in Sheets ↗</a>
        </div>

        <div id="formatting-box" class="current-sheet-box ${spreadsheetId ? "" : "hidden"}" style="background:var(--green-50);border-color:var(--green-100);">
          <div>
            <div class="css-label" style="color:var(--green-700);">Cell colors</div>
            <div style="font-size:13.5px;color:var(--slate-900);">Color-code Status, Priority &amp; Flag cells to match the extension</div>
          </div>
          <button class="btn btn-success btn-sm" id="apply-formatting-btn">🎨 Apply to All Tabs</button>
        </div>

        <div class="divider"></div>

        <div class="form-row">
          <div>
            <button class="btn btn-success btn-block" id="create-sheet-btn">✨ Create New Spreadsheet</button>
            <p class="hint">Creates a fresh "MyWorkTracking" spreadsheet in your Drive.</p>
          </div>
          <div>
            <div class="field" style="margin-bottom:8px;">
              <input class="input" id="link-sheet-input" placeholder="Paste spreadsheet URL or ID" />
            </div>
            <button class="btn btn-secondary btn-block" id="link-sheet-btn">🔗 Link Existing Spreadsheet</button>
          </div>
        </div>
      </section>

      <section class="card">
        <h3 class="card-title">Categories</h3>
        <p class="card-subtitle">Used when logging work, todos and follow-ups.</p>
        <div class="tag-manager" id="category-manager"></div>
        <form id="category-form" class="inline-add-form">
          <input class="input" id="category-input" placeholder="Add a category…" maxlength="40" />
          <button type="submit" class="btn btn-secondary btn-sm">Add</button>
        </form>
      </section>

      <section class="card">
        <h3 class="card-title">Flags</h3>
        <p class="card-subtitle">Highlight important, urgent or blocked items.</p>
        <div class="tag-manager" id="flag-manager"></div>
        <form id="flag-form" class="inline-add-form">
          <input class="input" id="flag-input" placeholder="Add a flag…" maxlength="30" />
          <button type="submit" class="btn btn-secondary btn-sm">Add</button>
        </form>
      </section>

      <section class="card">
        <h3 class="card-title">About</h3>
        <p class="card-subtitle">MyWorkTracking v1.0.0 — Google Sheets is your data. Nothing is sent to any third-party server.</p>
        <button class="btn btn-ghost btn-sm" id="clear-cache-btn">Clear local cache</button>
      </section>
    </div>
  `;

  injectSettingsStyles();
  renderTagList(document.getElementById("category-manager"), categories, removeCategory);
  renderTagList(document.getElementById("flag-manager"), flags, removeFlag);
  refreshSheetBox(spreadsheetId);

  // --- Auth ---
  document.getElementById("auth-btn").addEventListener("click", async (e) => {
    const btn = e.currentTarget;
    setLoading(btn, true, signedIn ? "Disconnecting…" : "Connecting…");
    try {
      if (signedIn) {
        await signOut();
        showToast("Disconnected from Google.", "info");
        ctx.refreshConnectionStatus();
        render(container, ctx);
      } else {
        await getAuthToken(true);
        const existingId = await getSpreadsheetId();
        if (existingId) {
          showToast("Connected to Google.", "success");
        } else {
          // First-time connect: provision a spreadsheet automatically so a
          // new user gets a working setup in a single click.
          setLoading(btn, true, "Setting up your spreadsheet…");
          await provisionNewSpreadsheet();
          showToast("Connected — your MyWorkTracking spreadsheet is ready!", "success");
        }
        render(container, ctx);
      }
    } catch (err) {
      showToast(err.message || "Could not connect to Google.", "error");
      setLoading(btn, false);
    }
  });

  async function provisionNewSpreadsheet() {
    const id = await createSpreadsheet("MyWorkTracking");
    await ensureMonthSheet(id, monthSheetName(todayISO()));
    await setSpreadsheetId(id);
    clearSessionCache();
    await ctx.refreshAppState();
    ctx.refreshConnectionStatus();
    refreshSheetBox(id);
    return id;
  }

  // --- Create spreadsheet ---
  document.getElementById("create-sheet-btn").addEventListener("click", async (e) => {
    const btn = e.currentTarget;
    setLoading(btn, true, "Creating…");
    try {
      await provisionNewSpreadsheet();
      showToast("Spreadsheet created and linked!", "success");
    } catch (err) {
      showToast(err.message || "Could not create spreadsheet.", "error");
    } finally {
      setLoading(btn, false);
    }
  });

  // --- Link existing spreadsheet ---
  document.getElementById("link-sheet-btn").addEventListener("click", async (e) => {
    const btn = e.currentTarget;
    const input = document.getElementById("link-sheet-input");
    const id = extractSpreadsheetId(input.value || "");
    if (!id) {
      showToast("Please paste a valid Google Sheets URL or ID.", "error");
      return;
    }
    setLoading(btn, true, "Verifying…");
    try {
      const result = await verifySpreadsheet(id);
      if (!result.ok) throw new Error(result.error || "Could not access that spreadsheet.");
      await ensureMonthSheet(id, monthSheetName(todayISO()));
      await setSpreadsheetId(id);
      clearSessionCache();
      showToast(`Linked "${result.title}".`, "success");
      input.value = "";
      await ctx.refreshAppState();
      ctx.refreshConnectionStatus();
      refreshSheetBox(id);
    } catch (err) {
      showToast(err.message || "Could not link spreadsheet.", "error");
    } finally {
      setLoading(btn, false);
    }
  });

  // --- Categories ---
  document.getElementById("category-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const input = document.getElementById("category-input");
    const val = input.value.trim();
    if (!val) return;
    const list = await getCategories();
    if (list.some((c) => c.toLowerCase() === val.toLowerCase())) {
      showToast("That category already exists.", "error");
      return;
    }
    list.push(val);
    await setCategories(list);
    input.value = "";
    renderTagList(document.getElementById("category-manager"), list, removeCategory);
    await ctx.refreshAppState();
    showToast("Category added.", "success");
  });

  // --- Flags ---
  document.getElementById("flag-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const input = document.getElementById("flag-input");
    const val = input.value.trim();
    if (!val) return;
    const list = await getFlags();
    if (list.some((f) => f.toLowerCase() === val.toLowerCase())) {
      showToast("That flag already exists.", "error");
      return;
    }
    list.push(val);
    await setFlags(list);
    input.value = "";
    renderTagList(document.getElementById("flag-manager"), list, removeFlag);
    await ctx.refreshAppState();
    showToast("Flag added.", "success");
  });

  document.getElementById("apply-formatting-btn").addEventListener("click", async (e) => {
    const btn = e.currentTarget;
    const id = await getSpreadsheetId();
    if (!id) return;
    setLoading(btn, true, "Formatting…");
    try {
      const result = await applyStandardFormattingToAllSheets(id);
      if (result.failedTitles.length) {
        showToast(`Formatted ${result.succeeded} of ${result.total} tabs. Failed: ${result.failedTitles.join(", ")}`, "error");
      } else {
        showToast(`Applied standard colors to ${result.succeeded} tab${result.succeeded === 1 ? "" : "s"}.`, "success");
      }
    } catch (err) {
      showToast(err.message || "Could not apply formatting.", "error");
    } finally {
      setLoading(btn, false);
    }
  });

  document.getElementById("clear-cache-btn").addEventListener("click", async () => {
    const ok = await confirmAction({
      title: "Clear local cache?",
      message: "This clears cached data in this session only. Nothing in your Google Sheet is affected.",
      confirmText: "Clear cache"
    });
    if (!ok) return;
    clearSessionCache();
    showToast("Local cache cleared.", "success");
  });

  async function refreshSheetBox(id) {
    const box = document.getElementById("current-sheet-box");
    const formattingBox = document.getElementById("formatting-box");
    if (!id) {
      box.classList.add("hidden");
      formattingBox.classList.add("hidden");
      return;
    }
    box.classList.remove("hidden");
    formattingBox.classList.remove("hidden");
    document.getElementById("current-sheet-title").textContent = "Checking…";
    document.getElementById("open-sheet-link").href = `https://docs.google.com/spreadsheets/d/${id}/edit`;
    const result = await verifySpreadsheet(id, { interactive: false });
    document.getElementById("current-sheet-title").textContent = result.ok
      ? result.title
      : "Could not verify (check connection)";
  }

  async function removeCategory(name) {
    const list = (await getCategories()).filter((c) => c !== name);
    await setCategories(list);
    renderTagList(document.getElementById("category-manager"), list, removeCategory);
    await ctx.refreshAppState();
  }

  async function removeFlag(name) {
    const list = (await getFlags()).filter((f) => f !== name);
    await setFlags(list);
    renderTagList(document.getElementById("flag-manager"), list, removeFlag);
    await ctx.refreshAppState();
  }
}

function renderTagList(container, items, onRemove) {
  container.innerHTML = items
    .map(
      (item) => `
      <span class="tag-pill">
        ${escapeHtml(item)}
        <button type="button" class="tag-remove" data-item="${escapeHtml(item)}" aria-label="Remove ${escapeHtml(item)}">✕</button>
      </span>`
    )
    .join("") || `<span class="text-muted" style="font-size:13px;">None yet.</span>`;

  container.querySelectorAll(".tag-remove").forEach((btn) => {
    btn.addEventListener("click", () => onRemove(btn.dataset.item));
  });
}

function injectSettingsStyles() {
  if (document.getElementById("settings-inline-styles")) return;
  const style = document.createElement("style");
  style.id = "settings-inline-styles";
  style.textContent = `
    .settings-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; align-items: start; }
    .settings-grid .card:first-child, .settings-grid section.card:nth-child(2) { grid-column: span 2; }
    @media (max-width: 900px) { .settings-grid { grid-template-columns: 1fr; } .settings-grid section.card { grid-column: span 1 !important; } }
    .settings-row { display: flex; align-items: center; justify-content: space-between; margin-top: 14px; }
    .current-sheet-box {
      display: flex; align-items: center; justify-content: space-between; gap: 12px;
      background: var(--blue-50); border: 1px solid var(--blue-100); border-radius: 10px;
      padding: 12px 14px; margin: 14px 0;
    }
    .css-label { font-size: 11px; text-transform: uppercase; letter-spacing: 0.03em; color: var(--blue-700); font-weight: 700; }
    #current-sheet-title { font-size: 13.5px; font-weight: 600; color: var(--slate-900); margin-top: 2px; }
    .tag-manager { display: flex; flex-wrap: wrap; gap: 8px; margin: 12px 0 14px; }
    .tag-pill {
      display: inline-flex; align-items: center; gap: 8px;
      background: var(--slate-100); border-radius: 999px; padding: 6px 8px 6px 14px;
      font-size: 13px; font-weight: 600; color: var(--slate-700);
    }
    .tag-remove { background: none; border: none; color: var(--slate-400); cursor: pointer; padding: 2px 4px; border-radius: 50%; font-size: 11px; }
    .tag-remove:hover { background: var(--red-50); color: var(--red-600); }
    .inline-add-form { display: flex; gap: 8px; }
    .inline-add-form .input { flex: 1; }
  `;
  document.head.appendChild(style);
}
