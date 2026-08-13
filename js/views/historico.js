import { $, $$, escapeHtml, formatDate, formatDateLong, openModal, closeModal, fmt1, avg, sortRows, sortableTh, wireSortableHeaders } from "../utils.js";
import { resultadoJogo, normalizeEscalacao, notasDoAtletaNoJogo, jogosRealizados, GOL_CONTRA_ID } from "../stats.js";
import { getFiltroPeriodo, setFiltroPeriodo, filtrarPorPeriodo, anosDisponiveis, MESES } from "../filters.js";

const RESULTADO_BADGE = {
  vitoria: `<span class="badge badge-ok">Vitória</span>`,
  empate: `<span class="badge badge-pending">Empate</span>`,
  derrota: `<span class="badge badge-danger">Derrota</span>`,
};

const RESULTADO_ORDEM = { vitoria: 2, empate: 1, derrota: 0 };

// Ordem das posições no campo, usada pra ordenar a lista de escalação na
// súmula (GOL, ZAG, LAT, VOL, MEI, ATA) — posições fora dessa lista (ou não
// informadas) vão pro final.
const ORDEM_POSICAO = { "Goleiro": 0, "Zagueiro": 1, "Lateral": 2, "Volante": 3, "Meia": 4, "Atacante": 5 };

const sortState = { key: null, dir: "asc" };

export function renderHistorico(root, state){
  const filtro = getFiltroPeriodo();
  const todosRealizados = [...jogosRealizados(state.jogos)].sort((a, b) => (b.data || "").localeCompare(a.data || ""));
  const anos = anosDisponiveis(todosRealizados);
  const realizados = filtrarPorPeriodo(todosRealizados, filtro);

  const nomeAdv = id => state.adversarios.find(a => a.id === id)?.nome || "?";
  const nomeCampo = id => state.campos.find(c => c.id === id)?.nome || "?";

  const sortFns = {
    data: j => j.data || "",
    adversario: j => nomeAdv(j.adversarioId).toLowerCase(),
    campo: j => nomeCampo(j.campoId).toLowerCase(),
    placar: j => (j.placarNos ?? 0) - (j.placarAdversario ?? 0),
    resultado: j => { const r = resultadoJogo(j); return r ? RESULTADO_ORDEM[r] : -1; },
  };
  const listaOrdenada = sortRows(realizados, sortState, sortFns);

  const rows = listaOrdenada.map(j => {
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

    <div class="form-grid" style="margin-bottom:20px; max-width:460px;">
      <div class="field">
        <label>Ano</label>
        <select id="filtro-ano">
          <option value="">Todos</option>
          ${anos.map(a => `<option value="${a}" ${a === filtro.ano ? "selected" : ""}>${a}</option>`).join("")}
        </select>
      </div>
      <div class="field">
        <label>Mês</label>
        <select id="filtro-mes">
          <option value="">Todos</option>
          ${MESES.map((m, idx) => {
            const val = String(idx + 1).padStart(2, "0");
            return `<option value="${val}" ${val === filtro.mes ? "selected" : ""}>${m}</option>`;
          }).join("")}
        </select>
      </div>
    </div>

    <div class="table-wrap">
      <table>
        <thead><tr>
          ${sortableTh("Data", "data", sortState)}
          ${sortableTh("Adversário", "adversario", sortState)}
          ${sortableTh("Campo", "campo", sortState)}
          ${sortableTh("Placar", "placar", sortState)}
          ${sortableTh("Resultado", "resultado", sortState)}
        </tr></thead>
        <tbody>${rows || `<tr class="empty-row"><td colspan="5">Nenhuma partida realizada para o período selecionado.</td></tr>`}</tbody>
      </table>
    </div>
  `;

  wireSortableHeaders(root, sortState, () => renderHistorico(root, state));

  $$("tbody tr[data-id]", root).forEach(tr => {
    tr.addEventListener("click", () => {
      const jogo = listaOrdenada.find(j => j.id === tr.dataset.id);
      openSumulaModal(jogo, state);
    });
  });

  $("#filtro-ano", root)?.addEventListener("change", (e) => { setFiltroPeriodo({ ano: e.target.value }); renderHistorico(root, state); });
  $("#filtro-mes", root)?.addEventListener("change", (e) => { setFiltroPeriodo({ mes: e.target.value }); renderHistorico(root, state); });
}

function openSumulaModal(jogo, state){
  const adv = state.adversarios.find(a => a.id === jogo.adversarioId);
  const campo = state.campos.find(c => c.id === jogo.campoId);
  const nome = id => id === GOL_CONTRA_ID ? "Gol contra (adversário)" : escapeHtml(state.atletas.find(a => a.id === id)?.nome || "?");
  const eventos = jogo.golsAssistencias || [];

  const eventosHtml = eventos.length === 0
    ? `<p style="color:var(--ink-faint); font-size:13px;">Nenhum gol registrado.</p>`
    : eventos.map(e => {
        const meta = [e.tipoGol, e.tempo].filter(Boolean).map(escapeHtml).join(" · ");
        return `
      <div class="event-row">
        <span class="event-min">${e.minuto ?? "–"}'</span>
        <span>⚽ ${nome(e.atletaGolId)}${e.atletaAssistId ? ` <span style="color:var(--ink-soft);">(assist. ${nome(e.atletaAssistId)})</span>` : ""}${meta ? ` <span style="color:var(--ink-faint); font-size:11px;">— ${meta}</span>` : ""}</span>
      </div>`;
      }).join("");

  // Ordena a escalação por posição (GOL, ZAG, LAT, VOL, MEI, ATA) — quem não
  // tem posição informada (jogos antigos) fica no final, na ordem original.
  const listaEscalacao = (arr) => {
    const entries = normalizeEscalacao(arr);
    if (!entries.length) return `<p style="color:var(--ink-faint); font-size:13px;">Não informada.</p>`;
    const ordenadas = [...entries].sort((a, b) => {
      const oa = a.posicao in ORDEM_POSICAO ? ORDEM_POSICAO[a.posicao] : 99;
      const ob = b.posicao in ORDEM_POSICAO ? ORDEM_POSICAO[b.posicao] : 99;
      return oa - ob;
    });
    return ordenadas.map(e => `
      <div class="event-row">
        <span>${nome(e.atletaId)}</span>
        ${e.posicao ? `<span style="margin-left:auto; color:var(--ink-faint); font-size:11px;">${escapeHtml(e.posicao)}</span>` : ""}
      </div>`).join("");
  };

  const notasAtletas = Object.keys(jogo.avaliacoesJogadores || {})
    .map(id => {
      const notas = notasDoAtletaNoJogo(jogo, id);
      return { id, media: avg(notas), qtd: notas.length };
    })
    .filter(x => x.media !== null)
    .sort((a, b) => b.media - a.media);

  const notasHtml = notasAtletas.length === 0
    ? `<p style="color:var(--ink-faint); font-size:13px;">Sem avaliações registradas.</p>`
    : notasAtletas.map(x => `
        <div class="event-row"><span>${nome(x.id)}</span><span class="pill-num" style="margin-left:auto;">${fmt1(x.media)} <span style="color:var(--ink-faint); font-weight:400;">(${x.qtd})</span></span></div>`).join("");

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

      <div style="display:flex; align-items:center; justify-content:space-between; gap:10px; flex-wrap:wrap; margin-bottom:8px;">
        <h4 style="font-size:13px; text-transform:uppercase; letter-spacing:.08em; color:var(--ink-soft); margin:0;">Gols e assistências</h4>
        <div style="display:flex; gap:14px; font-size:12px; color:var(--ink-soft);">
          <span>🏟️ Campo: <strong style="color:var(--ink);">${fmt1(jogo.avaliacaoCampo?.nota)}</strong></span>
          <span>🆚 Adversário: <strong style="color:var(--ink);">${fmt1(jogo.avaliacaoAdversario?.nota)}</strong></span>
        </div>
      </div>
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

      <h4 style="font-size:13px; text-transform:uppercase; letter-spacing:.08em; color:var(--ink-soft); margin:20px 0 8px;">Nota média dos jogadores</h4>
      ${notasHtml}
    </div>
  `, { wide: true });

  $$("[data-close]").forEach(b => b.addEventListener("click", closeModal));
}
