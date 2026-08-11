import { $, $$, escapeHtml, formatDate, fmt1, toast } from "../utils.js";
import { resumoGeral, rankingGolsAssistencias, mediaNotaJogadoresNoJogo, resultadoJogo, jogosRealizados, saldoGols, ehJogador } from "../stats.js";
import { getFiltroPeriodo, setFiltroPeriodo, filtrarPorPeriodo, anosDisponiveis, MESES } from "../filters.js";

function renderQr(containerId, texto){
  const el = document.getElementById(containerId);
  if (!el || typeof qrcode !== "function") return;
  try{
    const qr = qrcode(0, "M");
    qr.addData(texto);
    qr.make();
    el.innerHTML = qr.createImgTag(4, 4);
  }catch(err){
    console.error("Erro ao gerar QR code:", err);
  }
}

const RESULTADO_BADGE = {
  vitoria: `<span class="badge badge-ok">V</span>`,
  empate: `<span class="badge badge-pending">E</span>`,
  derrota: `<span class="badge badge-danger">D</span>`,
};

let outsideClickHandler = null;

export function renderDashboard(root, state){
  const filtro = getFiltroPeriodo();
  const todosRealizados = jogosRealizados(state.jogos);
  const anos = anosDisponiveis(todosRealizados);
  const realizadosFiltrados = filtrarPorPeriodo(todosRealizados, filtro);

  const r = resumoGeral(realizadosFiltrados);
  const saldo = saldoGols(realizadosFiltrados);
  const pctAssistencia = r.qtdGols > 0 ? Math.round((r.qtdAssistencias / r.qtdGols) * 100) : 0;
  const top3GA = rankingGolsAssistencias(state.atletas.filter(ehJogador), realizadosFiltrados).slice(0, 3);
  const ultimos5 = [...realizadosFiltrados].sort((a, b) => (b.data || "").localeCompare(a.data || "")).slice(0, 5);
  const top3Partidas = realizadosFiltrados
    .map(j => ({ jogo: j, ...mediaNotaJogadoresNoJogo(j) }))
    .filter(x => x.media !== null)
    .sort((a, b) => b.media - a.media)
    .slice(0, 3);
  // Próximos jogos não seguem o filtro de ano/mês — são sempre os agendamentos
  // futuros mais próximos, independente do período usado pra olhar o histórico.
  const proximosJogos = state.jogos
    .filter(j => j.status !== "realizado")
    .sort((a, b) => (a.data || "").localeCompare(b.data || ""))
    .slice(0, 5);

  const nomeAdv = id => escapeHtml(state.adversarios.find(a => a.id === id)?.nome || "?");
  const nomeCampo = id => escapeHtml(state.campos.find(c => c.id === id)?.nome || "?");
  const appUrl = location.origin + location.pathname;

  root.innerHTML = `
    <div class="topbar">
      <div>
        <div class="eyebrow">Visão geral</div>
        <h1>Dashboard</h1>
      </div>
      <div class="share-popover-wrap">
        <button class="btn-icon-share" id="btn-share" type="button" title="Compartilhar app" aria-label="Compartilhar app">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.6 10.6l6.8-3.8M8.6 13.4l6.8 3.8"/></svg>
        </button>
        <div class="share-popover" id="share-popover">
          <div class="card-title" style="font-size:13.5px;">Acesso rápido ao app</div>
          <div class="card-sub" style="margin-bottom:10px;">Compartilhe o link ou escaneie o QR code.</div>
          <div class="share-link-row">
            <input id="app-link" class="share-link-input" type="text" readonly value="${escapeHtml(appUrl)}">
            <button class="btn btn-primary btn-sm" id="btn-copy-link" type="button">Copiar</button>
          </div>
          <div class="qr-box" id="qr-code" style="margin-top:12px;"></div>
        </div>
      </div>
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

    <div class="kpi-grid">
      <div class="kpi-tile"><div class="kpi-label">Jogos realizados</div><div class="kpi-value">${r.qtdJogos}</div></div>
      <div class="kpi-tile"><div class="kpi-label">Gols</div><div class="kpi-value">${r.qtdGols}</div></div>
      <div class="kpi-tile"><div class="kpi-label">Saldo de gols</div><div class="kpi-value">${saldo.saldo > 0 ? "+" : ""}${saldo.saldo}</div></div>
      <div class="kpi-tile"><div class="kpi-label">% de assistência</div><div class="kpi-value">${pctAssistencia}<span class="unit">%</span></div></div>
      <div class="kpi-tile"><div class="kpi-label">Aproveitamento</div><div class="kpi-value small">${r.vitorias}V <span class="unit">${r.empates}E</span> <span class="unit">${r.derrotas}D</span></div></div>
      <div class="kpi-tile"><div class="kpi-label">Nota média jogadores</div><div class="kpi-value">${fmt1(r.mediaJogadores)}</div></div>
    </div>

    <div class="dashboard-grid-3">
      <div class="card card-pad">
        <div class="card-title">Artilharia &amp; garçons — Top 3</div>
        <div class="card-sub">Gols + assistências no período selecionado</div>
        ${top3GA.length === 0 ? `<p style="color:var(--ink-faint); font-size:13px;">Nenhum gol registrado ainda.</p>` : top3GA.map((t, i) => `
          <div class="podium-row">
            <span class="podium-rank">${i + 1}º</span>
            <div style="flex:1;">
              <div class="podium-name">${escapeHtml(t.atleta.nome)}</div>
              <div class="podium-sub">${t.gols} gol(s) · ${t.assistencias} assist.</div>
            </div>
            <span class="podium-val">${t.gols + t.assistencias}</span>
          </div>`).join("")}
        <div class="form-actions" style="justify-content:flex-start; border:none; padding-top:12px;">
          <a href="#ranking" class="btn btn-ghost btn-sm">Ver ranking completo →</a>
        </div>
      </div>

      <div class="card card-pad">
        <div class="card-title">Top 3 — melhores partidas</div>
        <div class="card-sub">Média das notas dos jogadores em cada partida</div>
        ${top3Partidas.length === 0 ? `<p style="color:var(--ink-faint); font-size:13px;">Sem partidas avaliadas ainda.</p>` : top3Partidas.map((t, i) => `
          <div class="podium-row" style="cursor:pointer;" data-goto="${t.jogo.id}">
            <span class="podium-rank">${i + 1}º</span>
            <div style="flex:1;">
              <div class="podium-name">vs ${nomeAdv(t.jogo.adversarioId)}</div>
              <div class="podium-sub">${formatDate(t.jogo.data)} · ${t.qtd} nota(s)</div>
            </div>
            <span class="podium-val">${fmt1(t.media)}</span>
          </div>`).join("")}
      </div>

      <div class="card card-pad">
        <div class="card-title">Últimos 5 confrontos</div>
        <div class="card-sub">Resultados mais recentes</div>
        ${ultimos5.length === 0 ? `<p style="color:var(--ink-faint); font-size:13px;">Nenhuma partida realizada ainda.</p>` : ultimos5.map(j => {
          const res = resultadoJogo(j);
          return `
          <div class="event-row" style="cursor:pointer;" data-goto="${j.id}">
            <span style="width:22px; flex-shrink:0;">${res ? RESULTADO_BADGE[res] : "—"}</span>
            <span style="flex:1;">vs ${nomeAdv(j.adversarioId)} <span style="color:var(--ink-faint); font-size:11px;">${formatDate(j.data)}</span></span>
            <span class="pill-num">${j.placarNos ?? "–"}x${j.placarAdversario ?? "–"}</span>
          </div>`;
        }).join("")}
        <div class="form-actions" style="justify-content:flex-start; border:none; padding-top:12px;">
          <a href="#historico" class="btn btn-ghost btn-sm">Ver histórico completo →</a>
        </div>
      </div>

      <div class="card card-pad">
        <div class="card-title">Próximos jogos</div>
        <div class="card-sub">Partidas agendadas</div>
        ${proximosJogos.length === 0 ? `<p style="color:var(--ink-faint); font-size:13px;">Nenhuma partida agendada no momento.</p>` : proximosJogos.map(j => `
          <div class="event-row" style="cursor:pointer;" data-goto="${j.id}">
            <span style="width:78px; flex-shrink:0; font-size:11px; color:var(--ink-faint);">${formatDate(j.data)}</span>
            <span style="flex:1;">vs ${nomeAdv(j.adversarioId)} <span style="color:var(--ink-faint); font-size:11px;">— ${nomeCampo(j.campoId)}</span></span>
          </div>`).join("")}
        <div class="form-actions" style="justify-content:flex-start; border:none; padding-top:12px;">
          <a href="#jogos" class="btn btn-ghost btn-sm">Ver todos os jogos →</a>
        </div>
      </div>
    </div>
  `;

  $$("[data-goto]", root).forEach(el => el.addEventListener("click", () => { location.hash = `#jogos/${el.dataset.goto}`; }));

  $("#filtro-ano", root)?.addEventListener("change", (e) => { setFiltroPeriodo({ ano: e.target.value }); renderDashboard(root, state); });
  $("#filtro-mes", root)?.addEventListener("change", (e) => { setFiltroPeriodo({ mes: e.target.value }); renderDashboard(root, state); });

  $("#btn-share", root)?.addEventListener("click", (e) => {
    e.stopPropagation();
    $("#share-popover", root)?.classList.toggle("open");
  });
  if (outsideClickHandler) document.removeEventListener("click", outsideClickHandler);
  outsideClickHandler = (e) => {
    const wrap = $(".share-popover-wrap", root);
    if (wrap && !wrap.contains(e.target)) $("#share-popover", root)?.classList.remove("open");
  };
  document.addEventListener("click", outsideClickHandler);

  $("#btn-copy-link", root)?.addEventListener("click", async () => {
    try{
      await navigator.clipboard.writeText(appUrl);
      toast("Link copiado!", "ok");
    }catch(err){
      const input = $("#app-link", root);
      input?.select?.();
      toast("Não foi possível copiar automaticamente. Selecione e copie manualmente.", "err");
    }
  });

  renderQr("qr-code", appUrl);
}
