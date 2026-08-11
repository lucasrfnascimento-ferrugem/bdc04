import { $, $$, escapeHtml, formatDate, fmt1, toast } from "../utils.js";
import { resumoGeral, rankingGolsAssistencias } from "../stats.js";

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

export function renderDashboard(root, state){
  const r = resumoGeral(state.jogos);
  const top3 = rankingGolsAssistencias(state.atletas, state.jogos).slice(0, 3);
  const proximosJogos = [...state.jogos]
    .filter(j => j.status === "agendado")
    .sort((a, b) => (a.data || "").localeCompare(b.data || ""))
    .slice(0, 4);

  const nomeAdv = id => escapeHtml(state.adversarios.find(a => a.id === id)?.nome || "?");
  const nomeCampo = id => escapeHtml(state.campos.find(c => c.id === id)?.nome || "?");
  const appUrl = location.origin + location.pathname;

  root.innerHTML = `
    <div class="topbar">
      <div>
        <div class="eyebrow">Visão geral</div>
        <h1>Dashboard</h1>
      </div>
    </div>

    <div class="kpi-grid">
      <div class="kpi-tile"><div class="kpi-label">Jogos realizados</div><div class="kpi-value">${r.qtdJogos}</div></div>
      <div class="kpi-tile"><div class="kpi-label">Gols</div><div class="kpi-value">${r.qtdGols}</div></div>
      <div class="kpi-tile"><div class="kpi-label">Assistências</div><div class="kpi-value">${r.qtdAssistencias}</div></div>
      <div class="kpi-tile"><div class="kpi-label">Aproveitamento</div><div class="kpi-value small">${r.vitorias}V <span class="unit">${r.empates}E</span> <span class="unit">${r.derrotas}D</span></div></div>
      <div class="kpi-tile"><div class="kpi-label">Nota média jogadores</div><div class="kpi-value">${fmt1(r.mediaJogadores)}</div></div>
      <div class="kpi-tile"><div class="kpi-label">Nota média campo</div><div class="kpi-value">${fmt1(r.mediaCampo)}</div></div>
      <div class="kpi-tile"><div class="kpi-label">Nota média adversário</div><div class="kpi-value">${fmt1(r.mediaAdversario)}</div></div>
    </div>

    <div class="card card-pad share-card">
      <div style="flex:1; min-width:220px;">
        <div class="card-title">Acesso rápido ao app</div>
        <div class="card-sub">Compartilhe o link ou escaneie o QR code para abrir em outro dispositivo.</div>
        <div class="share-link-row">
          <input id="app-link" class="share-link-input" type="text" readonly value="${escapeHtml(appUrl)}">
          <button class="btn btn-primary btn-sm" id="btn-copy-link">Copiar link</button>
        </div>
      </div>
      <div class="qr-box" id="qr-code"></div>
    </div>

    <div class="sumula-list">
      <div class="card card-pad">
        <div class="card-title">Artilharia &amp; garçons — Top 3</div>
        <div class="card-sub">Gols + assistências no total de jogos realizados</div>
        ${top3.length === 0 ? `<p style="color:var(--ink-faint); font-size:13px;">Nenhum gol registrado ainda.</p>` : top3.map((t, i) => `
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
        <div class="card-title">Próximos jogos</div>
        <div class="card-sub">Partidas agendadas</div>
        ${proximosJogos.length === 0 ? `<p style="color:var(--ink-faint); font-size:13px;">Nenhum jogo agendado.</p>` : proximosJogos.map(j => `
          <div class="event-row" style="cursor:pointer;" data-goto="${j.id}">
            <span class="event-min" style="width:auto; padding-right:8px;">${formatDate(j.data)}</span>
            <span>vs ${nomeAdv(j.adversarioId)} — ${nomeCampo(j.campoId)}</span>
          </div>`).join("")}
        <div class="form-actions" style="justify-content:flex-start; border:none; padding-top:12px;">
          <a href="#jogos" class="btn btn-ghost btn-sm">Ver todos os jogos →</a>
        </div>
      </div>
    </div>
  `;

  $$("[data-goto]", root).forEach(el => el.addEventListener("click", () => { location.hash = `#jogos/${el.dataset.goto}`; }));

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
