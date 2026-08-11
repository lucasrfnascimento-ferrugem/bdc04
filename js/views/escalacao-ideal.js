import { escapeHtml, fmt1 } from "../utils.js";
import { mediaNotaAtleta, notasPorPosicao } from "../stats.js";

const LINHAS = [
  { label: "Ataque", positions: ["Atacante"], slots: 3 },
  { label: "Meio-campo", positions: ["Volante", "Meia"], slots: 3 },
  { label: "Defesa", positions: ["Zagueiro", "Lateral"], slots: 4 },
  { label: "Goleiro", positions: ["Goleiro"], slots: 1 },
];

export function renderEscalacaoIdeal(root, state){
  // Notas médias de cada atleta por posição realmente jogada em cada partida
  // (não a posição de cadastro) — é isso que decide quem entra em cada linha.
  const notasPos = notasPorPosicao(state.atletas, state.jogos);

  if (Object.keys(notasPos).length === 0){
    root.innerHTML = `
      <div class="topbar"><div><div class="eyebrow">Visão geral</div><h1>Escalação ideal</h1></div></div>
      <div class="empty-state"><h3>Ainda sem dados</h3><p>Registre a escalação (com a posição de cada atleta) e as avaliações pós-jogo para calcular a escalação ideal.</p></div>`;
    return;
  }

  const usados = new Set();

  const linhasResolvidas = LINHAS.map(linha => {
    // Para cada atleta, pega a melhor média dele entre as posições desta linha
    // (ex: um zagueiro que também jogou de lateral entra com a posição em que rendeu mais).
    const candidatosPorAtleta = {};
    state.atletas.forEach(atleta => {
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
  // em que ele mais atuou, para dar contexto de qual foi a "melhor versão" dele.
  const rankingCompleto = state.atletas
    .map(a => {
      const overall = mediaNotaAtleta(a.id, state.jogos);
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
    <p style="font-size:13px; color:var(--ink-soft); margin:-14px 0 20px; max-width:600px;">
      Calculada a partir da nota média de cada atleta nas avaliações pós-jogo, agrupada pela posição em que
      ele efetivamente jogou em cada partida (não a posição cadastrada no elenco).
    </p>

    <div class="pitch-board">${linhasHtml}</div>

    <div class="card card-pad" style="margin-top:22px;">
      <div class="card-title">Notas médias — todos os atletas avaliados</div>
      <div class="card-sub">"Posição" = a posição em que o atleta mais jogou nas partidas avaliadas.</div>
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
  `;
}
