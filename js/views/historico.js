import { $, $$, escapeHtml, formatDate, formatDateLong, openModal, closeModal, fmt1 } from "../utils.js";
import { resultadoJogo, mediaNotaAtleta, normalizeEscalacao } from "../stats.js";

const RESULTADO_BADGE = {
  vitoria: `<span class="badge badge-ok">Vitória</span>`,
  empate: `<span class="badge badge-pending">Empate</span>`,
  derrota: `<span class="badge" style="background:var(--danger-bg); color:var(--danger);">Derrota</span>`,
};

export function renderHistorico(root, state){
  const realizados = state.jogos
    .filter(j => j.status === "realizado")
    .sort((a, b) => (b.data || "").localeCompare(a.data || ""));

  const nomeAdv = id => state.adversarios.find(a => a.id === id)?.nome || "?";
  const nomeCampo = id => state.campos.find(c => c.id === id)?.nome || "?";

  const rows = realizados.map(j => {
    const r = resultadoJogo(j);
    return `
      <tr class="clickable" data-id="${j.id}">
        <td>${formatDate(j.data)}</td>
        <td><strong>${escapeHtml(nomeAdv(j.adversarioId))}</strong></td>
        <td>${escapeHtml(nomeCampo(j.campoId))}</td>
        <td class="pill-num">${j.placarNos ?? "–"} x ${j.placarAdversario ?? "–"}</td>
        <td>${r ? RESULTADO_BADGE[r] : "—"}</td>
      </tr>`;
  }).join("");

  root.innerHTML = `
    <div class="topbar">
      <div><div class="eyebrow">Visão geral</div><h1>Histórico</h1></div>
    </div>
    <div class="table-wrap">
      <table>
        <thead><tr><th>Data</th><th>Adversário</th><th>Campo</th><th>Placar</th><th>Resultado</th></tr></thead>
        <tbody>${rows || `<tr class="empty-row"><td colspan="5">Nenhuma partida realizada ainda.</td></tr>`}</tbody>
      </table>
    </div>
  `;

  $$("tbody tr[data-id]", root).forEach(tr => {
    tr.addEventListener("click", () => {
      const jogo = realizados.find(j => j.id === tr.dataset.id);
      openSumulaModal(jogo, state);
    });
  });
}

function openSumulaModal(jogo, state){
  const adv = state.adversarios.find(a => a.id === jogo.adversarioId);
  const campo = state.campos.find(c => c.id === jogo.campoId);
  const nome = id => escapeHtml(state.atletas.find(a => a.id === id)?.nome || "?");
  const eventos = jogo.golsAssistencias || [];

  const eventosHtml = eventos.length === 0
    ? `<p style="color:var(--ink-faint); font-size:13px;">Nenhum gol registrado.</p>`
    : eventos.map(e => `
      <div class="event-row">
        <span class="event-min">${e.minuto ?? "–"}'</span>
        <span>⚽ ${nome(e.atletaGolId)}${e.atletaAssistId ? ` <span style="color:var(--ink-soft);">(assist. ${nome(e.atletaAssistId)})</span>` : ""}</span>
      </div>`).join("");

  const listaEscalacao = (arr) => {
    const entries = normalizeEscalacao(arr);
    if (!entries.length) return `<p style="color:var(--ink-faint); font-size:13px;">Não informada.</p>`;
    return entries.map(e => `
      <div class="event-row">
        <span>${nome(e.atletaId)}</span>
        ${e.posicao ? `<span style="margin-left:auto; color:var(--ink-faint); font-size:11px;">${escapeHtml(e.posicao)}</span>` : ""}
      </div>`).join("");
  };

  const notasHtml = Object.keys(jogo.avaliacoesJogadores || {}).length === 0
    ? `<p style="color:var(--ink-faint); font-size:13px;">Sem avaliações registradas.</p>`
    : Object.entries(jogo.avaliacoesJogadores).sort((a, b) => (b[1].nota || 0) - (a[1].nota || 0)).map(([id, v]) => `
        <div class="event-row"><span>${nome(id)}</span><span class="pill-num" style="margin-left:auto;">${fmt1(v.nota)}</span></div>`).join("");

  openModal(`
    <div class="modal-head">
      <h3>Súmula da partida</h3>
      <button class="modal-close" data-close>&times;</button>
    </div>
    <div class="modal-body">
      <div class="sumula" style="margin-bottom:20px;">
        <div class="sumula-side"><div class="team">Bom D' Copus</div><div class="score">${jogo.placarNos ?? "–"}</div></div>
        <div class="sumula-mid"><div class="vs">VS</div><div class="date">${formatDateLong(jogo.data)}</div></div>
        <div class="sumula-side"><div class="team">${escapeHtml(adv?.nome || "?")}</div><div class="score">${jogo.placarAdversario ?? "–"}</div></div>
        <div class="sumula-meta"><span>📍 ${escapeHtml(campo?.nome || "—")}</span><span>Realizado</span></div>
      </div>

      <h4 style="font-size:13px; text-transform:uppercase; letter-spacing:.08em; color:var(--ink-soft); margin-bottom:8px;">Gols e assistências</h4>
      ${eventosHtml}

      <div class="sumula-list" style="margin-top:20px;">
        <div>
          <h4>Escalação inicial</h4>
          ${listaEscalacao(jogo.escalacaoInicial)}
        </div>
        <div>
          <h4>Escalação final</h4>
          ${listaEscalacao(jogo.escalacaoFinal)}
        </div>
      </div>

      <h4 style="font-size:13px; text-transform:uppercase; letter-spacing:.08em; color:var(--ink-soft); margin:20px 0 8px;">Notas dos jogadores</h4>
      ${notasHtml}
    </div>
  `, { wide: true });

  $$("[data-close]").forEach(b => b.addEventListener("click", closeModal));
}
