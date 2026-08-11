import { escapeHtml, fmt1 } from "../utils.js";
import { rankingGolsAssistencias, mediaNotaAtleta } from "../stats.js";

export function renderRanking(root, state){
  const ranking = rankingGolsAssistencias(state.atletas, state.jogos);

  const rows = ranking.map((r, i) => {
    const { media } = mediaNotaAtleta(r.atleta.id, state.jogos);
    return `
      <tr>
        <td class="pill-num">${i + 1}º</td>
        <td><strong>${escapeHtml(r.atleta.nome)}</strong></td>
        <td>${escapeHtml(r.atleta.posicao || "—")}</td>
        <td class="pill-num">${r.gols}</td>
        <td class="pill-num">${r.assistencias}</td>
        <td class="pill-num">${r.gols + r.assistencias}</td>
        <td>${fmt1(media)}</td>
      </tr>`;
  }).join("");

  root.innerHTML = `
    <div class="topbar">
      <div>
        <div class="eyebrow">Visão geral</div>
        <h1>Ranking</h1>
      </div>
    </div>
    <div class="table-wrap">
      <table>
        <thead><tr><th>#</th><th>Atleta</th><th>Posição</th><th>Gols</th><th>Assist.</th><th>G+A</th><th>Nota média</th></tr></thead>
        <tbody>${rows || `<tr class="empty-row"><td colspan="7">Nenhum gol ou assistência registrado ainda.</td></tr>`}</tbody>
      </table>
    </div>
  `;
}
