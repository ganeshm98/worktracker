// Classic (non-module) script, loaded first in <head> before any stylesheet.
// Synchronously mirrors the theme preference from localStorage onto the root
// element so the correct theme paints on the very first frame, instead of
// flashing light before the async theme.js module can apply it.
(function () {
  try {
    var t = localStorage.getItem("mwt-theme");
    if (t === "light" || t === "dark") {
      document.documentElement.setAttribute("data-theme", t);
    }
  } catch (e) {
    /* localStorage unavailable — theme.js will still apply the theme shortly after */
  }
})();
