import { $, $$, escapeHtml, formatDate, fmt1 } from "../utils.js";
import { statsPorAtleta } from "../stats.js";

let activeMetric = "ga"; // jogos | gols | assistencias | ga | nota
let filtroAno = "";
let filtroMes = "";
let filtroPartida = "";

const METRICAS = [
  { key: "jogos", label: "Qtde. de jogos" },
  { key: "gols", label: "Gols" },
  { key: "assistencias", label: "Assistências" },
  { key: "ga", label: "G+A" },
  { key: "nota", label: "Nota média" },
];

const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

function ordenarPorMetrica(lista, metrica){
  const cmp = {
    jogos: (a, b) => b.jogosCount - a.jogosCount,
    gols: (a, b) => b.gols - a.gols,
    assistencias: (a, b) => b.assistencias - a.assistencias,
    ga: (a, b) => (b.gols + b.assistencias) - (a.gols + a.assistencias),
    nota: (a, b) => (b.media ?? -1) - (a.media ?? -1),
  }[metrica];
  return [...lista].sort(cmp || (() => 0));
}

function filtrarPorMetrica(lista, metrica){
  switch (metrica){
    case "jogos": return lista.filter(s => s.jogosCount > 0);
    case "gols": return lista.filter(s => s.gols > 0);
    case "assistencias": return lista.filter(s => s.assistencias > 0);
    case "ga": return lista.filter(s => (s.gols + s.assistencias) > 0);
    case "nota": return lista.filter(s => s.media !== null);
    default: return lista;
  }
}

export function renderRanking(root, state){
  const realizados = [...state.jogos]
    .filter(j => j.status === "realizado")
    .sort((a, b) => (b.data || "").localeCompare(a.data || ""));

  const anosDisponiveis = [...new Set(realizados.map(j => (j.data || "").slice(0, 4)).filter(Boolean))]
    .sort((a, b) => b.localeCompare(a));

  const nomeAdv = id => state.adversarios.find(a => a.id === id)?.nome || "?";

  let jogosFiltrados;
  if (filtroPartida){
    jogosFiltrados = realizados.filter(j => j.id === filtroPartida);
  } else {
    jogosFiltrados = realizados.filter(j => {
      const ano = (j.data || "").slice(0, 4);
      const mes = (j.data || "").slice(5, 7);
      if (filtroAno && ano !== filtroAno) return false;
      if (filtroMes && mes !== filtroMes) return false;
      return true;
    });
  }

  const stats = statsPorAtleta(state.atletas, jogosFiltrados);
  const listaFinal = ordenarPorMetrica(filtrarPorMetrica(stats, activeMetric), activeMetric);

  const rows = listaFinal.map((s, i) => `
    <tr>
      <td class="pill-num">${i + 1}º</td>
      <td><strong>${escapeHtml(s.atleta.nome)}</strong></td>
      <td>${escapeHtml(s.atleta.posicao || "—")}</td>
      <td class="pill-num">${s.jogosCount}</td>
      <td class="pill-num">${s.gols}</td>
      <td class="pill-num">${s.assistencias}</td>
      <td class="pill-num">${s.gols + s.assistencias}</td>
      <td>${fmt1(s.media)}</td>
    </tr>`).join("");

  root.innerHTML = `
    <div class="topbar">
      <div>
        <div class="eyebrow">Visão geral</div>
        <h1>Ranking</h1>
      </div>
    </div>

    <div class="tabbar">
      ${METRICAS.map(m => `<button class="tab-btn" data-metric="${m.key}">${escapeHtml(m.label)}</button>`).join("")}
    </div>

    <div class="form-grid" style="margin-bottom:20px; max-width:680px;">
      <div class="field">
        <label>Ano</label>
        <select id="filtro-ano" ${filtroPartida ? "disabled" : ""}>
          <option value="">Todos</option>
          ${anosDisponiveis.map(a => `<option value="${a}" ${a === filtroAno ? "selected" : ""}>${a}</option>`).join("")}
        </select>
      </div>
      <div class="field">
        <label>Mês</label>
        <select id="filtro-mes" ${filtroPartida ? "disabled" : ""}>
          <option value="">Todos</option>
          ${MESES.map((m, idx) => {
            const val = String(idx + 1).padStart(2, "0");
            return `<option value="${val}" ${val === filtroMes ? "selected" : ""}>${m}</option>`;
          }).join("")}
        </select>
      </div>
      <div class="field span-2">
        <label>Partida específica</label>
        <select id="filtro-partida">
          <option value="">Todas as partidas</option>
          ${realizados.map(j => `<option value="${j.id}" ${j.id === filtroPartida ? "selected" : ""}>${formatDate(j.data)} — vs ${escapeHtml(nomeAdv(j.adversarioId))}</option>`).join("")}
        </select>
      </div>
    </div>

    <div class="table-wrap">
      <table>
        <thead><tr><th>#</th><th>Atleta</th><th>Posição</th><th>Jogos</th><th>Gols</th><th>Assist.</th><th>G+A</th><th>Nota média</th></tr></thead>
        <tbody>${rows || `<tr class="empty-row"><td colspan="8">Nenhum dado para os filtros selecionados.</td></tr>`}</tbody>
      </table>
    </div>
  `;

  $$(".tab-btn", root).forEach(btn => {
    btn.classList.toggle("active", btn.dataset.metric === activeMetric);
    btn.addEventListener("click", () => {
      activeMetric = btn.dataset.metric;
      renderRanking(root, state);
    });
  });

  $("#filtro-ano", root)?.addEventListener("change", (e) => { filtroAno = e.target.value; renderRanking(root, state); });
  $("#filtro-mes", root)?.addEventListener("change", (e) => { filtroMes = e.target.value; renderRanking(root, state); });
  $("#filtro-partida", root)?.addEventListener("change", (e) => { filtroPartida = e.target.value; renderRanking(root, state); });
}
