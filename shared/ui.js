// Small reusable UI helpers: toasts, confirm dialogs and modals.
// Every host page (popup.html, app.html) must include a
// <div id="toast-root"></div> and <div id="modal-root"></div>.

export function showToast(message, type = "success", duration = 3200) {
  const root = document.getElementById("toast-root");
  if (!root) return;
  const icons = { success: "✓", error: "!", info: "i" };
  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `<span class="toast-icon">${icons[type] || icons.info}</span><span class="toast-msg"></span>`;
  toast.querySelector(".toast-msg").textContent = message;
  root.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add("toast-show"));
  const remove = () => {
    toast.classList.remove("toast-show");
    setTimeout(() => toast.remove(), 220);
  };
  toast.addEventListener("click", remove);
  setTimeout(remove, duration);
}

export function confirmAction({ title = "Are you sure?", message = "", confirmText = "Confirm", danger = false } = {}) {
  return new Promise((resolve) => {
    const root = document.getElementById("modal-root");
    if (!root) return resolve(window.confirm(message || title));

    const overlay = document.createElement("div");
    overlay.className = "modal-overlay";
    overlay.innerHTML = `
      <div class="modal modal-sm" role="alertdialog" aria-modal="true" aria-labelledby="confirm-title">
        <h3 id="confirm-title">${title}</h3>
        <p class="modal-message">${message}</p>
        <div class="modal-actions">
          <button type="button" class="btn btn-ghost" data-act="cancel">Cancel</button>
          <button type="button" class="btn ${danger ? "btn-danger" : "btn-primary"}" data-act="confirm">${confirmText}</button>
        </div>
      </div>
    `;
    root.appendChild(overlay);
    const cleanup = (result) => {
      overlay.remove();
      resolve(result);
    };
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) cleanup(false);
      const act = e.target.closest("[data-act]")?.dataset.act;
      if (act === "confirm") cleanup(true);
      if (act === "cancel") cleanup(false);
    });
    const onKey = (e) => {
      if (e.key === "Escape") { cleanup(false); document.removeEventListener("keydown", onKey); }
    };
    document.addEventListener("keydown", onKey);
    overlay.querySelector('[data-act="confirm"]').focus();
  });
}

export function openModal(innerHtml, { onClose } = {}) {
  const root = document.getElementById("modal-root");
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.innerHTML = `<div class="modal">${innerHtml}</div>`;
  root.appendChild(overlay);

  const close = () => {
    overlay.remove();
    if (onClose) onClose();
  };
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay || e.target.closest("[data-modal-close]")) close();
  });
  const onKey = (e) => {
    if (e.key === "Escape") { close(); document.removeEventListener("keydown", onKey); }
  };
  document.addEventListener("keydown", onKey);

  return { overlay, modal: overlay.querySelector(".modal"), close };
}

export function setLoading(button, isLoading, labelWhenLoading = "Saving…") {
  if (!button) return;
  if (isLoading) {
    button.dataset.originalLabel = button.dataset.originalLabel || button.innerHTML;
    button.disabled = true;
    button.classList.add("is-loading");
    button.innerHTML = `<span class="spinner" aria-hidden="true"></span> ${labelWhenLoading}`;
  } else {
    button.disabled = false;
    button.classList.remove("is-loading");
    if (button.dataset.originalLabel) button.innerHTML = button.dataset.originalLabel;
  }
}
