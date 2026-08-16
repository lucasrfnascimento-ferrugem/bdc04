import { $, escapeHtml, formatDate, toast, fmt1, avg, ratingWidgetHtml, wireRatingWidgets } from "../utils.js";
import { jogosRealizados, jogadoresDaPartida, posicaoJogadaNoJogo, notaDoVotanteNoJogo, notasDoAtletaNoJogo } from "../stats.js";
import { updateJogoField } from "../db.js";

let votanteId = "";
let jogoId = "";

export function renderAvaliacao(root, state){
  const votantes = state.atletas.filter(a => a.podeVotar);
  const partidas = [...jogosRealizados(state.jogos)].sort((a, b) => (b.data || "").localeCompare(a.data || ""));

  // Se a partida selecionada anteriormente sumiu da lista (ex: filtro/estado
  // obsoleto), volta pro estado "nada selecionado" em vez de quebrar.
  if (votanteId && !votantes.some(v => v.id === votanteId)) votanteId = "";
  if (jogoId && !partidas.some(j => j.id === jogoId)) jogoId = "";

  const jogo = partidas.find(j => j.id === jogoId) || null;
  const jogadores = jogo ? jogadoresDaPartida(jogo, state.atletas) : [];
  const nomeAdv = id => escapeHtml(state.adversarios.find(a => a.id === id)?.nome || "?");
  const votanteAtual = votantes.find(v => v.id === votanteId);

  root.innerHTML = `
    <div class="topbar">
      <div>
        <div class="eyebrow">Partidas</div>
        <h1>Avaliação de jogadores</h1>
      </div>
    </div>

    ${votantes.length === 0 ? `
      <div class="empty-state">
        <h3>Nenhum votante cadastrado</h3>
        <p>Marque a opção "Direito a voto (diretor/capitão)" no cadastro dos atletas responsáveis em Atletas para liberar a votação aqui.</p>
      </div>
    ` : `
      <div class="form-grid" style="max-width:680px; margin-bottom:24px;">
        <div class="field">
          <label>Quem está votando?</label>
          <select id="sel-votante">
            <option value="">Selecione</option>
            ${votantes.map(v => `<option value="${v.id}" ${v.id === votanteId ? "selected" : ""}>${escapeHtml(v.nome)}</option>`).join("")}
          </select>
        </div>
        <div class="field">
          <label>Selecione a partida</label>
          <select id="sel-jogo" ${partidas.length === 0 ? "disabled" : ""}>
            <option value="">Selecione</option>
            ${partidas.map(j => `<option value="${j.id}" ${j.id === jogoId ? "selected" : ""}>${formatDate(j.data)} — vs ${nomeAdv(j.adversarioId)}</option>`).join("")}
          </select>
        </div>
      </div>

      ${partidas.length === 0 ? `
        <div class="empty-state"><h3>Nenhuma partida realizada</h3><p>Registre uma partida como "Realizado" em Jogos para poder avaliar os jogadores dela.</p></div>
      ` : !votanteId || !jogoId ? `
        <div class="empty-state"><p>Selecione quem está votando e a partida para ver os jogadores escalados.</p></div>
      ` : jogadores.length === 0 ? `
        <div class="empty-state"><h3>Sem escalação</h3><p>Essa partida ainda não tem jogadores na escalação inicial ou final.</p></div>
      ` : `
        <div class="card card-pad">
          <div class="card-title">Notas — vs ${nomeAdv(jogo.adversarioId)} (${formatDate(jogo.data)})</div>
          <div class="card-sub">Nota de 0 a 10 (incrementos de 0,5) de cada atleta que entrou em campo, segundo ${escapeHtml(votanteAtual?.nome || "")}.</div>
          ${jogadores.map(a => {
            const posicaoJogada = posicaoJogadaNoJogo(jogo, a.id) || a.posicao || "—";
            const notaAtual = notaDoVotanteNoJogo(jogo, a.id, votanteId);
            const notasGerais = notasDoAtletaNoJogo(jogo, a.id);
            const mediaGeral = avg(notasGerais);
            return `
            <div style="display:flex; align-items:center; gap:14px; padding:10px 0; border-bottom:1px solid var(--line); flex-wrap:wrap;">
              <span style="flex:0 0 180px; font-weight:600; font-size:13.5px;">${escapeHtml(a.nome)}
                <span style="display:block; font-weight:400; font-size:11px; color:var(--ink-faint);">${escapeHtml(posicaoJogada)}</span>
              </span>
              ${ratingWidgetHtml(`av-${a.id}`, notaAtual)}
              <span style="margin-left:auto; font-size:11px; color:var(--ink-faint); white-space:nowrap;">
                ${mediaGeral !== null ? `média atual ${fmt1(mediaGeral)} · ${notasGerais.length} voto(s)` : "sem votos ainda"}
              </span>
            </div>`;
          }).join("")}
          <div class="form-actions"><button class="btn btn-primary" id="btn-save-avaliacao">Salvar minhas avaliações</button></div>
        </div>
      `}
    `}
  `;

  if (votantes.length === 0) return;

  $("#sel-votante", root)?.addEventListener("change", (e) => { votanteId = e.target.value; renderAvaliacao(root, state); });
  $("#sel-jogo", root)?.addEventListener("change", (e) => { jogoId = e.target.value; renderAvaliacao(root, state); });

  if (!votanteId || !jogoId || !jogo || jogadores.length === 0) return;

  wireRatingWidgets(root);

  $("#btn-save-avaliacao", root)?.addEventListener("click", async (e) => {
    const map = { ...(jogo.avaliacoesJogadores || {}) };
    jogadores.forEach(a => {
      const hidden = $(`input[data-rating="av-${a.id}"]`, root);
      const val = hidden?.value !== "" && hidden?.value != null ? Number(hidden.value) : null;
      if (val === null) return;
      const atual = map[a.id];
      if (atual && typeof atual.nota === "number"){
        // Formato antigo (nota única, sem votante identificado) — preserva a
        // nota antiga como um voto "legado" e adiciona o novo voto por cima,
        // em vez de perder o dado.
        map[a.id] = { _legado: { nota: atual.nota }, [votanteId]: { nota: val } };
      } else {
        map[a.id] = { ...(atual || {}), [votanteId]: { nota: val } };
      }
    });
    e.target.disabled = true;
    try{
      await updateJogoField(jogo.id, { avaliacoesJogadores: map });
      toast("Avaliações salvas.", "ok");
    }catch(err){
      console.error(err);
      toast("Erro ao salvar: " + err.message, "err");
    }
    e.target.disabled = false;
  });
}
