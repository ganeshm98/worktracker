// Lightweight, dependency-free canvas chart helpers themed for MyWorkTracking.
// No third-party charting library is bundled: MV3 extension pages run under a
// strict CSP that disallows remote script execution, so charts are drawn
// directly with the Canvas 2D API instead of vendoring a large minified lib.

import { isDarkMode } from "./theme.js";

export const PALETTE = ["#2563eb", "#16a34a", "#f59e0b", "#dc2626", "#7c3aed", "#0891b2", "#64748b", "#db2777"];

function setupCanvas(canvas) {
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  const width = rect.width || canvas.clientWidth || 320;
  const height = rect.height || canvas.clientHeight || 220;
  canvas.width = width * dpr;
  canvas.height = height * dpr;
  const ctx = canvas.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, width, height);
  return { ctx, width, height };
}

function roundRect(ctx, x, y, w, h, r) {
  const radius = Math.min(r, w / 2, Math.abs(h) / 2);
  const dir = h < 0 ? -1 : 1;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + w - radius, y);
  ctx.arcTo(x + w, y, x + w, y + dir * radius, radius);
  ctx.lineTo(x + w, y + h - dir * radius);
  ctx.arcTo(x + w, y + h, x + w - radius, y + h, radius);
  ctx.lineTo(x + radius, y + h);
  ctx.arcTo(x, y + h, x, y + h - dir * radius, radius);
  ctx.lineTo(x, y + dir * radius);
  ctx.arcTo(x, y, x + radius, y, radius);
  ctx.closePath();
}

export function drawBarChart(canvas, { labels, values, color = "#2563eb", emptyText = "No data yet" }) {
  const { ctx, width, height } = setupCanvas(canvas);
  const isDark = isDarkMode();
  const textColor = isDark ? "#94a3b8" : "#64748b";
  const gridColor = isDark ? "#1e293b" : "#e2e8f0";

  if (!values.length || values.every((v) => v === 0)) {
    ctx.fillStyle = textColor;
    ctx.font = "13px 'Segoe UI', system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(emptyText, width / 2, height / 2);
    return;
  }

  const padLeft = 28, padBottom = 28, padTop = 16, padRight = 10;
  const chartW = width - padLeft - padRight;
  const chartH = height - padTop - padBottom;
  const max = Math.max(...values, 1);
  const niceMax = Math.ceil(max / 5) * 5 || max;

  ctx.strokeStyle = gridColor;
  ctx.lineWidth = 1;
  ctx.font = "11px 'Segoe UI', system-ui, sans-serif";
  ctx.fillStyle = textColor;
  ctx.textAlign = "right";
  const gridLines = 4;
  for (let i = 0; i <= gridLines; i++) {
    const y = padTop + (chartH / gridLines) * i;
    ctx.beginPath();
    ctx.moveTo(padLeft, y);
    ctx.lineTo(width - padRight, y);
    ctx.stroke();
    const val = Math.round(niceMax - (niceMax / gridLines) * i);
    ctx.fillText(String(val), padLeft - 6, y + 3);
  }

  const barSlot = chartW / values.length;
  const barWidth = Math.min(38, barSlot * 0.55);

  values.forEach((v, i) => {
    const barH = niceMax === 0 ? 0 : (v / niceMax) * chartH;
    const x = padLeft + barSlot * i + (barSlot - barWidth) / 2;
    const y = padTop + chartH - barH;
    const grad = ctx.createLinearGradient(0, y, 0, padTop + chartH);
    grad.addColorStop(0, color);
    grad.addColorStop(1, color + "aa");
    ctx.fillStyle = grad;
    roundRect(ctx, x, y, barWidth, barH || 0.001, 6);
    ctx.fill();

    if (v > 0) {
      ctx.fillStyle = isDark ? "#e2e8f0" : "#1e293b";
      ctx.font = "bold 11px 'Segoe UI', system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(String(v), x + barWidth / 2, y - 6);
    }

    ctx.fillStyle = textColor;
    ctx.font = "10px 'Segoe UI', system-ui, sans-serif";
    ctx.textAlign = "center";
    const label = labels[i].length > 6 ? labels[i].slice(0, 6) + "…" : labels[i];
    ctx.fillText(label, x + barWidth / 2, padTop + chartH + 16);
  });
}

export function drawDonutChart(canvas, { labels, values, colors = PALETTE, centerLabel }) {
  const { ctx, width, height } = setupCanvas(canvas);
  const total = values.reduce((a, b) => a + b, 0);
  const isDark = isDarkMode();

  const cx = width / 2, cy = height / 2;
  const radius = Math.min(width, height) / 2 - 8;
  const innerRadius = radius * 0.62;

  if (!total) {
    ctx.strokeStyle = isDark ? "#1e293b" : "#e2e8f0";
    ctx.lineWidth = radius - innerRadius;
    ctx.beginPath();
    ctx.arc(cx, cy, (radius + innerRadius) / 2, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = isDark ? "#94a3b8" : "#64748b";
    ctx.font = "13px 'Segoe UI', system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("No data", cx, cy + 4);
    return;
  }

  let start = -Math.PI / 2;
  values.forEach((v, i) => {
    if (v <= 0) return;
    const angle = (v / total) * Math.PI * 2;
    ctx.beginPath();
    ctx.arc(cx, cy, (radius + innerRadius) / 2, start, start + angle);
    ctx.lineWidth = radius - innerRadius;
    ctx.strokeStyle = colors[i % colors.length];
    ctx.lineCap = "butt";
    ctx.stroke();
    start += angle;
  });

  ctx.fillStyle = isDark ? "#f1f5f9" : "#0f172a";
  ctx.font = "bold 22px 'Segoe UI', system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(String(centerLabel ?? total), cx, cy + 7);
  ctx.font = "10px 'Segoe UI', system-ui, sans-serif";
  ctx.fillStyle = isDark ? "#94a3b8" : "#64748b";
  ctx.fillText("total", cx, cy + 22);
}

export function buildLegend(container, labels, values, colors = PALETTE) {
  container.innerHTML = "";
  const total = values.reduce((a, b) => a + b, 0) || 1;
  labels.forEach((label, i) => {
    if (values[i] <= 0) return;
    const item = document.createElement("div");
    item.className = "legend-item";
    const pct = Math.round((values[i] / total) * 100);
    item.innerHTML = `
      <span class="legend-dot" style="background:${colors[i % colors.length]}"></span>
      <span class="legend-label">${label}</span>
      <span class="legend-value">${values[i]} · ${pct}%</span>
    `;
    container.appendChild(item);
  });
  if (!container.children.length) {
    container.innerHTML = `<div class="legend-empty">No data yet</div>`;
  }
}
