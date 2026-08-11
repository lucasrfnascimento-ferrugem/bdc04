import { $, $$, escapeHtml, fmt1 } from "../utils.js";
import { mediaNotaAtleta, notasPorPosicao, jogosRealizados } from "../stats.js";
import { filtrarPorPeriodo, anosDisponiveis, MESES } from "../filters.js";

// Cada formação define as linhas do campo (do ataque para o goleiro) e, para
// cada linha, quais posições jogadas contam como candidatas e quantas vagas
// ela tem. "4-3-2-1" tem uma linha extra (segunda linha de ataque) — por isso
// o layout aceita qualquer número de linhas, não só as 4 originais.
const FORMATIONS = {
  "4-3-3": [
    { label: "Ataque", positions: ["Atacante"], slots: 3 },
    { label: "Meio-campo", positions: ["Volante", "Meia"], slots: 3 },
    { label: "Defesa", positions: ["Zagueiro", "Lateral"], slots: 4 },
    { label: "Goleiro", positions: ["Goleiro"], slots: 1 },
  ],
  "4-4-2": [
    { label: "Ataque", positions: ["Atacante"], slots: 2 },
    { label: "Meio-campo", positions: ["Volante", "Meia"], slots: 4 },
    { label: "Defesa", positions: ["Zagueiro", "Lateral"], slots: 4 },
    { label: "Goleiro", positions: ["Goleiro"], slots: 1 },
  ],
  "3-5-2": [
    { label: "Ataque", positions: ["Atacante"], slots: 2 },
    { label: "Meio-campo", positions: ["Volante", "Meia"], slots: 5 },
    { label: "Defesa", positions: ["Zagueiro", "Lateral"], slots: 3 },
    { label: "Goleiro", positions: ["Goleiro"], slots: 1 },
  ],
  "4-3-2-1": [
    { label: "Ataque", positions: ["Atacante"], slots: 1 },
    { label: "Segunda linha", positions: ["Meia", "Atacante"], slots: 2 },
    { label: "Meio-campo", positions: ["Volante", "Meia"], slots: 3 },
    { label: "Defesa", positions: ["Zagueiro", "Lateral"], slots: 4 },
    { label: "Goleiro", positions: ["Goleiro"], slots: 1 },
  ],
  "3-4-3": [
    { label: "Ataque", positions: ["Atacante"], slots: 3 },
    { label: "Meio-campo", positions: ["Volante", "Meia"], slots: 4 },
    { label: "Defesa", positions: ["Zagueiro", "Lateral"], slots: 3 },
    { label: "Goleiro", positions: ["Goleiro"], slots: 1 },
  ],
};

let formacaoAtual = "4-3-3";
let filtroAno = "";
let filtroMes = "";
const excluidos = new Set();

export function renderEscalacaoIdeal(root, state){
  const realizados = jogosRealizados(state.jogos);
  const anos = anosDisponiveis(realizados);
  const jogosFiltrados = filtrarPorPeriodo(realizados, { ano: filtroAno, mes: filtroMes });

  const atletasElenco = state.atletas.filter(a => a.ativo !== false);
  const atletasConsiderados = atletasElenco.filter(a => !excluidos.has(a.id));

  const notasPos = notasPorPosicao(atletasConsiderados, jogosFiltrados);
  const linhas = FORMATIONS[formacaoAtual] || FORMATIONS["4-3-3"];

  const usados = new Set();
  const linhasResolvidas = linhas.map(linha => {
    const candidatosPorAtleta = {};
    atletasConsiderados.forEach(atleta => {
      const porPosicao = notasPos[atleta.id];
      if (!porPosicao) return;
      linha.positions.forEach(pos => {
        const stat = porPosicao[pos];
        if (!stat) return;
        const atual = candidatosPorAtleta[atleta.id];
        if (!atual || stat.media > atual.media){
          candidatosPorAtleta[atleta.id] = { atleta, posicaoJogada: pos, media: stat.media, qtd: stat.qtd };
        }
      });
    });

    const ordenados = Object.values(candidatosPorAtleta).sort((a, b) => b.media - a.media);
    const titulares = [];
    for (const c of ordenados){
      if (titulares.length >= linha.slots) break;
      if (usados.has(c.atleta.id)) continue; // cada atleta só ocupa uma vaga na escalação ideal
      titulares.push(c);
      usados.add(c.atleta.id);
    }
    return { linha, titulares };
  });

  const temDados = Object.keys(notasPos).length > 0;

  const linhasHtml = linhasResolvidas.map(({ linha, titulares }) => {
    const vagasAbertas = linha.slots - titulares.length;
    const jogadoresHtml = titulares.map(t => `
      <div class="pitch-player">
        <div class="dot">${t.atleta.numero ?? "•"}</div>
        <div class="nm">${escapeHtml(t.atleta.nome)} <span style="opacity:.65; font-weight:400;">(${escapeHtml(t.posicaoJogada)})</span></div>
        <div class="nota">${fmt1(t.media)}</div>
      </div>`).join("") + Array.from({ length: vagasAbertas }).map(() => `
      <div class="pitch-player">
        <div class="dot" style="background:transparent; border-style:dashed; color:rgba(255,255,255,.6);">?</div>
        <div class="nm" style="color:rgba(255,255,255,.5);">Vaga em aberto</div>
      </div>`).join("");

    return `<div class="pitch-line-players">${jogadoresHtml}</div>`;
  }).join("");

  // Tabela geral: nota média por atleta (independente de posição) + a posição
  // em que ele mais atuou, considerando só os jogadores/período selecionados.
  const rankingCompleto = atletasConsiderados
    .map(a => {
      const overall = mediaNotaAtleta(a.id, jogosFiltrados);
      const porPosicao = notasPos[a.id];
      let posicaoMaisJogada = null;
      if (porPosicao){
        posicaoMaisJogada = Object.entries(porPosicao)
          .sort((x, y) => y[1].qtd - x[1].qtd || y[1].media - x[1].media)[0]?.[0] || null;
      }
      return { atleta: a, media: overall.media, qtd: overall.qtd, posicao: posicaoMaisJogada || a.posicao };
    })
    .filter(x => x.media !== null)
    .sort((a, b) => b.media - a.media);

  root.innerHTML = `
    <div class="topbar">
      <div><div class="eyebrow">Visão geral</div><h1>Escalação ideal</h1></div>
    </div>
    <p style="font-size:13px; color:var(--ink-soft); margin:-14px 0 20px; max-width:640px;">
      Calculada a partir da nota média de cada atleta nas avaliações pós-jogo, agrupada pela posição em que
      ele efetivamente jogou em cada partida (não a posição cadastrada no elenco).
    </p>

    <div class="form-grid" style="margin-bottom:20px; max-width:680px;">
      <div class="field">
        <label>Formação</label>
        <select id="sel-formacao">
          ${Object.keys(FORMATIONS).map(f => `<option value="${f}" ${f === formacaoAtual ? "selected" : ""}>${f}</option>`).join("")}
        </select>
      </div>
      <div class="field">
        <label>Ano</label>
        <select id="filtro-ano">
          <option value="">Todos</option>
          ${anos.map(a => `<option value="${a}" ${a === filtroAno ? "selected" : ""}>${a}</option>`).join("")}
        </select>
      </div>
      <div class="field">
        <label>Mês</label>
        <select id="filtro-mes">
          <option value="">Todos</option>
          ${MESES.map((m, idx) => {
            const val = String(idx + 1).padStart(2, "0");
            return `<option value="${val}" ${val === filtroMes ? "selected" : ""}>${m}</option>`;
          }).join("")}
        </select>
      </div>
    </div>

    <div class="card card-pad" style="margin-bottom:20px;">
      <div class="card-title">Jogadores considerados</div>
      <div class="card-sub">Desmarque quem você não quer considerar no cálculo da escalação ideal. Por padrão, todos entram.</div>
      <div class="player-grid">
        ${atletasElenco.map(a => `
          <label class="player-chip ${excluidos.has(a.id) ? "" : "selected"}">
            <input type="checkbox" data-excluir="${a.id}" ${excluidos.has(a.id) ? "" : "checked"}>
            <span class="player-num">${a.numero ?? "•"}</span>
            <span style="flex:1;">${escapeHtml(a.nome)}</span>
          </label>`).join("")}
      </div>
    </div>

    ${!temDados ? `
      <div class="empty-state">
        <h3>Sem dados para essa seleção</h3>
        <p>Ajuste o período ou os jogadores considerados, ou registre a escalação (com posição) e as avaliações pós-jogo.</p>
      </div>
    ` : `
      <div class="pitch-board">${linhasHtml}</div>

      <div class="card card-pad" style="margin-top:22px;">
        <div class="card-title">Notas médias — jogadores considerados</div>
        <div class="card-sub">"Posição" = a posição em que o atleta mais jogou nas partidas avaliadas, no período selecionado.</div>
        <div class="table-wrap" style="border:none; margin-top:10px;">
          <table>
            <thead><tr><th>Atleta</th><th>Posição</th><th>Nota média</th><th>Avaliações</th></tr></thead>
            <tbody>
              ${rankingCompleto.map(x => `
                <tr>
                  <td><strong>${escapeHtml(x.atleta.nome)}</strong></td>
                  <td>${escapeHtml(x.posicao || "—")}</td>
                  <td class="pill-num">${fmt1(x.media)}</td>
                  <td>${x.qtd}</td>
                </tr>`).join("")}
            </tbody>
          </table>
        </div>
      </div>
    `}
  `;

  $("#sel-formacao", root)?.addEventListener("change", (e) => { formacaoAtual = e.target.value; renderEscalacaoIdeal(root, state); });
  $("#filtro-ano", root)?.addEventListener("change", (e) => { filtroAno = e.target.value; renderEscalacaoIdeal(root, state); });
  $("#filtro-mes", root)?.addEventListener("change", (e) => { filtroMes = e.target.value; renderEscalacaoIdeal(root, state); });
  $$("[data-excluir]", root).forEach(chk => {
    chk.addEventListener("change", (e) => {
      const id = e.target.dataset.excluir;
      if (e.target.checked) excluidos.delete(id); else excluidos.add(id);
      renderEscalacaoIdeal(root, state);
    });
  });
}
