export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

export function escapeHtml(str){
  if (str === null || str === undefined) return "";
  return String(str)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

export function formatDate(isoStr){
  if (!isoStr) return "—";
  const d = new Date(isoStr + "T00:00:00");
  if (isNaN(d)) return isoStr;
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export function formatDateLong(isoStr){
  if (!isoStr) return "—";
  const d = new Date(isoStr + "T00:00:00");
  if (isNaN(d)) return isoStr;
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric", weekday: "short" });
}

export function todayISO(){
  return new Date().toISOString().slice(0, 10);
}

export function avg(nums){
  const arr = nums.filter(n => typeof n === "number" && !isNaN(n));
  if (arr.length === 0) return null;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

export function fmt1(n){
  return (n === null || n === undefined || isNaN(n)) ? "—" : n.toFixed(1);
}

// ----------------------------------------------------------------------------
// Toasts
// ----------------------------------------------------------------------------
export function toast(msg, type = "ok"){
  const root = $("#toast-root");
  const el = document.createElement("div");
  el.className = `toast ${type}`;
  el.textContent = msg;
  root.appendChild(el);
  setTimeout(() => el.remove(), 3200);
}

// ----------------------------------------------------------------------------
// Modal
// ----------------------------------------------------------------------------
export function openModal(innerHtml, { wide = false } = {}){
  const root = $("#modal-root");
  root.innerHTML = `
    <div class="modal-overlay" id="modal-overlay">
      <div class="modal ${wide ? "wide" : ""}">${innerHtml}</div>
    </div>`;
  $("#modal-overlay").addEventListener("click", (e) => {
    if (e.target.id === "modal-overlay") closeModal();
  });
  document.addEventListener("keydown", escCloseHandler);
}

function escCloseHandler(e){
  if (e.key === "Escape") closeModal();
}

export function closeModal(){
  $("#modal-root").innerHTML = "";
  document.removeEventListener("keydown", escCloseHandler);
}

export function confirmAction(msg){
  return window.confirm(msg);
}

// ----------------------------------------------------------------------------
// Widget de nota (1 a 10) — usado nas telas de avaliação (jogo e avaliação de jogadores)
// ----------------------------------------------------------------------------
export function ratingWidgetHtml(name, value){
  let btns = "";
  for (let i = 1; i <= 10; i++){
    btns += `<button type="button" class="rating-btn" data-val="${i}">${i}</button>`;
  }
  return `<div class="rating-input" data-name="${name}"><input type="hidden" data-rating="${name}" value="${value ?? ""}">${btns}</div>`;
}

export function wireRatingWidgets(root){
  $$(".rating-input", root).forEach(wrap => {
    const hidden = wrap.querySelector("input[type=hidden]");
    $$(".rating-btn", wrap).forEach(btn => {
      if (btn.dataset.val === String(hidden.value)) btn.classList.add("active");
      btn.addEventListener("click", () => {
        hidden.value = btn.dataset.val;
        $$(".rating-btn", wrap).forEach(b => b.classList.toggle("active", b === btn));
      });
    });
  });
}
