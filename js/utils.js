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
  // Se houver um confirmAction() aberto por cima (delete, etc.), o Escape
  // deve fechar só ele — não o modal de edição por trás.
  if (e.key === "Escape" && !document.getElementById("confirm-overlay")) closeModal();
}

export function closeModal(){
  $("#modal-root").innerHTML = "";
  document.removeEventListener("keydown", escCloseHandler);
}

// Modal de confirmação (substitui o confirm() nativo do navegador, que não
// respeita o visual do app nem o tema escuro). Retorna uma Promise<boolean> —
// use com `await`. Qualquer forma de fechar (botão cancelar, X, clique fora,
// Esc) resolve como `false`; só o botão de confirmar resolve como `true`.
//
// Usa um elemento próprio, anexado direto no <body> (em vez do #modal-root
// genérico), porque em vários lugares a confirmação é aberta a partir de um
// botão que já está dentro de outro modal (ex: "Excluir" no formulário de
// editar um atleta) — reaproveitar o #modal-root apagaria o modal de baixo.
// Assim a confirmação fica sobreposta, sem mexer no que já estava aberto.
export function confirmAction(msg, opts = {}){
  return new Promise((resolve) => {
    const confirmLabel = escapeHtml(opts.confirmLabel || "Excluir");
    const cancelLabel = escapeHtml(opts.cancelLabel || "Cancelar");
    const okClass = opts.danger === false ? "btn-primary" : "btn-danger";

    const wrap = document.createElement("div");
    wrap.innerHTML = `
      <div class="modal-overlay" id="confirm-overlay" style="z-index:200;">
        <div class="modal" style="max-width:400px;">
          <div class="modal-head">
            <h3>${escapeHtml(opts.title || "Confirmar ação")}</h3>
            <button class="modal-close" id="confirm-close">&times;</button>
          </div>
          <div class="modal-body">
            <p style="font-size:13.5px; color:var(--ink-soft); margin:0;">${escapeHtml(msg)}</p>
            <div class="form-actions">
              <button type="button" class="btn btn-ghost" id="confirm-cancel">${cancelLabel}</button>
              <button type="button" class="btn ${okClass}" id="confirm-ok">${confirmLabel}</button>
            </div>
          </div>
        </div>
      </div>`;
    document.body.appendChild(wrap);

    let done = false;
    const finish = (result) => {
      if (done) return;
      done = true;
      document.removeEventListener("keydown", onKeydown);
      wrap.remove();
      resolve(result);
    };
    const onKeydown = (e) => { if (e.key === "Escape") finish(false); };

    document.addEventListener("keydown", onKeydown);
    wrap.querySelector("#confirm-overlay").addEventListener("click", (e) => { if (e.target.id === "confirm-overlay") finish(false); });
    wrap.querySelector("#confirm-close").addEventListener("click", () => finish(false));
    wrap.querySelector("#confirm-cancel").addEventListener("click", () => finish(false));
    wrap.querySelector("#confirm-ok").addEventListener("click", () => finish(true));
  });
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

// ----------------------------------------------------------------------------
// Re-renderiza uma tela preservando o foco (e a posição do cursor, se for um
// campo de texto) do elemento focado dentro de `root`, e a posição de
// rolagem da página. As telas desse app recriam o HTML inteiro a cada
// interação (root.innerHTML = ...), o que por padrão tira o foco de qualquer
// campo e pode fazer a página "pular" pro topo — isso incomoda tanto ao
// digitar numa busca com filtro em tempo real quanto ao clicar num
// cabeçalho de coluna, filtro ou checkbox no meio de uma lista longa. Usa
// essa função no lugar de chamar a função de render direto sempre que a
// interação parte de dentro da própria tela (ordenar, filtrar, marcar algo).
// ----------------------------------------------------------------------------
export function reRenderKeepingFocus(root, renderFn){
  const active = document.activeElement;
  const isInsideRoot = !!active && root.contains(active);
  const id = isInsideRoot ? active.id : null;
  const hasSelection = isInsideRoot && typeof active.selectionStart === "number";
  const selStart = hasSelection ? active.selectionStart : null;
  const selEnd = hasSelection ? active.selectionEnd : null;
  const scrollY = window.scrollY;

  renderFn();

  window.scrollTo(0, scrollY);
  if (!id) return;
  const el = root.querySelector(`#${CSS.escape(id)}`);
  if (!el) return;
  el.focus({ preventScroll: true });
  if (selStart !== null && typeof el.setSelectionRange === "function"){
    try{ el.setSelectionRange(selStart, selEnd); }catch(err){ /* tipo de input sem seleção de texto (ex: select) — ignora */ }
  }
}

// ----------------------------------------------------------------------------
// Tema claro / escuro — persistido no localStorage e aplicado via atributo
// `data-theme` na tag <html> (o CSS reage a esse atributo em style.css).
// index.html já aplica o tema salvo antes do 1º paint, pra não piscar.
// ----------------------------------------------------------------------------
const THEME_KEY = "bdc_theme";

export function getTheme(){
  return document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light";
}

export function setTheme(theme){
  if (theme === "dark") document.documentElement.setAttribute("data-theme", "dark");
  else document.documentElement.removeAttribute("data-theme");
  try{ localStorage.setItem(THEME_KEY, theme); }catch(err){ /* localStorage indisponível — vale só pra essa sessão */ }
}

export function toggleTheme(){
  const next = getTheme() === "dark" ? "light" : "dark";
  setTheme(next);
  return next;
}

// ----------------------------------------------------------------------------
// Tabelas com colunas ordenáveis (clique no cabeçalho pra alternar
// crescente/decrescente) — usado em Atletas, Adversários, Campos e Histórico.
// `sortState` é um objeto mutável `{ key, dir }` mantido pela tela que chama
// (variável de módulo, pra sobreviver entre re-renders).
// ----------------------------------------------------------------------------
export function sortRows(rows, sortState, sortFns, ...extraArgs){
  if (!sortState?.key || typeof sortFns[sortState.key] !== "function") return rows;
  const getVal = sortFns[sortState.key];
  const dir = sortState.dir === "desc" ? -1 : 1;
  return [...rows].sort((a, b) => {
    const va = getVal(a, ...extraArgs);
    const vb = getVal(b, ...extraArgs);
    const aNull = va === null || va === undefined || va === "";
    const bNull = vb === null || vb === undefined || vb === "";
    if (aNull && bNull) return 0;
    if (aNull) return 1; // valores vazios sempre por último, independente da direção
    if (bNull) return -1;
    if (typeof va === "string" || typeof vb === "string") return String(va).localeCompare(String(vb), "pt-BR") * dir;
    return (va - vb) * dir;
  });
}

export function sortableTh(label, key, sortState){
  const active = sortState?.key === key;
  const arrow = active ? (sortState.dir === "desc" ? " ▾" : " ▴") : "";
  return `<th class="sortable" data-sort-key="${key}">${escapeHtml(label)}<span class="sort-arrow">${arrow}</span></th>`;
}

export function wireSortableHeaders(root, sortState, onChange){
  $$("thead th.sortable[data-sort-key]", root).forEach(th => {
    th.addEventListener("click", () => {
      const key = th.dataset.sortKey;
      if (sortState.key === key){
        sortState.dir = sortState.dir === "asc" ? "desc" : "asc";
      } else {
        sortState.key = key;
        sortState.dir = "asc";
      }
      // Preserva a rolagem — clicar num cabeçalho no meio de uma tabela longa
      // não deveria jogar a tela de volta pro topo.
      const scrollY = window.scrollY;
      onChange();
      window.scrollTo(0, scrollY);
    });
  });
}
