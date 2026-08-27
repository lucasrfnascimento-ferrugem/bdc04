import { $, $$, escapeHtml, toast, openModal, closeModal, confirmAction, todayISO, formatDate } from "../utils.js";
import { createDoc, saveDoc, removeDoc, createDocWithId } from "../db.js";

// ============================================================================
// Financeiro — saldo, lançamentos de entrada/saída, controle de mensalidade
// por mês (só jogadores marcados como "pagante" no cadastro) e histórico de
// transações. Tudo guardado na coleção `financeiro` (uma linha por
// lançamento) + um documento único `configuracoes/geral` com o valor atual
// da mensalidade.
// ============================================================================

// Mês em que o controle financeiro do time começou — a lista de meses
// "passados/atual" da tela sempre parte daqui, nunca antes.
const MES_INICIO = "2026-08";

const MESES_PT = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

function mesAtualRef(){
  return todayISO().slice(0, 7);
}

function addMeses(mesRef, delta){
  const [ano, mes] = mesRef.split("-").map(Number);
  const d = new Date(ano, mes - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function mesesEntre(inicio, fim){
  const out = [];
  let cur = inicio;
  while (cur <= fim){
    out.push(cur);
    cur = addMeses(cur, 1);
  }
  return out;
}

function mesLabel(mesRef){
  const [ano, mes] = mesRef.split("-").map(Number);
  return `${MESES_PT[mes - 1]}/${ano}`;
}

function fmtBRL(n){
  return (Number(n) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function idMensalidade(mesRef, atletaId){
  return `mens_${mesRef}_${atletaId}`;
}

// Quantos meses passados/atual aparecem direto na tela principal — o
// restante do histórico (conforme os meses forem se acumulando) fica só no
// botão "Ver todas". No mobile, 3 é o que cabe lado a lado sem espremer.
const MESES_VISIVEIS_TELA = 3;

// Monta o "tile" de um mês (nome + quantas mensalidades já foram pagas) —
// usado tanto na tela principal quanto nos modais de meses futuros/todos.
function mesTileHtml(mesRef, transacoes, pagantesAtivos){
  const pagos = pagantesAtivos.filter(a => transacoes.some(
    t => t.tipo === "mensalidade" && t.mesRef === mesRef && t.atletaId === a.id
  )).length;
  return `
    <button type="button" class="mes-tile" data-mes="${mesRef}">
      <div class="mes-nome">${mesLabel(mesRef)}</div>
      <div class="mes-sub">${pagos}/${pagantesAtivos.length} pagas</div>
    </button>`;
}

// ----------------------------------------------------------------------------
// Lançar Entrada / Saída
// ----------------------------------------------------------------------------
function openTransacaoForm(tipo){
  const label = tipo === "entrada" ? "Entrada" : "Saída";
  openModal(`
    <div class="modal-head">
      <h3>Nova ${label}</h3>
      <button class="modal-close" data-close>&times;</button>
    </div>
    <div class="modal-body">
      <form id="form-transacao">
        <div class="form-grid">
          <div class="field">
            <label>Valor (R$) *</label>
            <input type="number" name="valor" min="0.01" step="0.01" required>
          </div>
          <div class="field">
            <label>Data *</label>
            <input type="date" name="data" value="${todayISO()}" required>
          </div>
          <div class="field span-2">
            <label>Descrição</label>
            <input type="text" name="descricao" placeholder="Ex.: compra de bolas, aluguel de campo…">
          </div>
        </div>
        <div class="form-actions">
          <button type="button" class="btn btn-ghost" data-close>Cancelar</button>
          <button type="submit" class="btn btn-primary">Salvar</button>
        </div>
      </form>
    </div>
  `);
  $$("[data-close]").forEach(b => b.addEventListener("click", closeModal));

  $("#form-transacao").addEventListener("submit", async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const valor = Number(fd.get("valor"));
    if (!valor || valor <= 0){ toast("Informe um valor válido.", "err"); return; }
    const btn = e.target.querySelector('button[type="submit"]');
    btn.disabled = true;
    try{
      await createDoc("financeiro", {
        tipo,
        valor,
        data: fd.get("data") || todayISO(),
        descricao: (fd.get("descricao") || "").trim(),
      });
      toast(`${label} lançada.`, "ok");
      closeModal();
    }catch(err){
      console.error(err);
      toast("Erro ao salvar: " + err.message, "err");
      btn.disabled = false;
    }
  });
}

// ----------------------------------------------------------------------------
// Editar uma transação já lançada (data, valor, descrição) — vale pra
// qualquer tipo (entrada, saída ou mensalidade); o tipo em si não muda.
// ----------------------------------------------------------------------------
function openEditTransacaoForm(t){
  const tipoLabel = t.tipo === "entrada" ? "Entrada" : t.tipo === "saida" ? "Saída" : "Mensalidade";
  openModal(`
    <div class="modal-head">
      <h3>Editar ${tipoLabel}</h3>
      <button class="modal-close" data-close>&times;</button>
    </div>
    <div class="modal-body">
      <form id="form-editar-transacao">
        <div class="form-grid">
          <div class="field">
            <label>Valor (R$) *</label>
            <input type="number" name="valor" min="0.01" step="0.01" value="${t.valor ?? ""}" required>
          </div>
          <div class="field">
            <label>Data *</label>
            <input type="date" name="data" value="${t.data || todayISO()}" required>
          </div>
          <div class="field span-2">
            <label>Descrição</label>
            <input type="text" name="descricao" value="${escapeHtml(t.descricao || "")}" placeholder="Ex.: compra de bolas, aluguel de campo…">
          </div>
        </div>
        <div class="form-actions">
          <button type="button" class="btn btn-ghost" data-close>Cancelar</button>
          <button type="submit" class="btn btn-primary">Salvar</button>
        </div>
      </form>
    </div>
  `);
  $$("[data-close]").forEach(b => b.addEventListener("click", closeModal));

  $("#form-editar-transacao").addEventListener("submit", async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const valor = Number(fd.get("valor"));
    if (!valor || valor <= 0){ toast("Informe um valor válido.", "err"); return; }
    const btn = e.target.querySelector('button[type="submit"]');
    btn.disabled = true;
    try{
      await saveDoc("financeiro", t.id, {
        valor,
        data: fd.get("data") || todayISO(),
        descricao: (fd.get("descricao") || "").trim(),
      });
      toast(`${tipoLabel} atualizada.`, "ok");
      closeModal();
    }catch(err){
      console.error(err);
      toast("Erro ao salvar: " + err.message, "err");
      btn.disabled = false;
    }
  });
}

// ----------------------------------------------------------------------------
// Valor da mensalidade (configuracoes/geral) — mudar aqui NÃO altera
// mensalidades já marcadas como pagas (cada uma guarda o valor de quando foi
// paga), só passa a valer pros próximos lançamentos.
// ----------------------------------------------------------------------------
function openConfigMensalidadeForm(state){
  const atual = state.configFinanceiro?.valorMensalidade ?? 0;
  openModal(`
    <div class="modal-head">
      <h3>Valor da mensalidade</h3>
      <button class="modal-close" data-close>&times;</button>
    </div>
    <div class="modal-body">
      <form id="form-mensalidade-valor">
        <div class="field">
          <label>Valor (R$) *</label>
          <input type="number" name="valor" min="0" step="0.01" value="${atual || ""}" required>
        </div>
        <p class="field-hint">Esse valor vale a partir de agora — mensalidades já marcadas como pagas não mudam retroativamente.</p>
        <div class="form-actions">
          <button type="button" class="btn btn-ghost" data-close>Cancelar</button>
          <button type="submit" class="btn btn-primary">Salvar</button>
        </div>
      </form>
    </div>
  `);
  $$("[data-close]").forEach(b => b.addEventListener("click", closeModal));

  $("#form-mensalidade-valor").addEventListener("submit", async (e) => {
    e.preventDefault();
    const valor = Number(new FormData(e.target).get("valor"));
    const btn = e.target.querySelector('button[type="submit"]');
    btn.disabled = true;
    try{
      await createDocWithId("configuracoes", "geral", { valorMensalidade: valor });
      toast("Valor da mensalidade atualizado.", "ok");
      closeModal();
    }catch(err){
      console.error(err);
      toast("Erro ao salvar: " + err.message, "err");
      btn.disabled = false;
    }
  });
}

// ----------------------------------------------------------------------------
// Detalhe de um mês — lista de jogadores pagantes ativos com checkbox de
// pago/não pago (idempotente: id fixo por mês+atleta) + botão de copiar a
// lista pra colar no WhatsApp.
// ----------------------------------------------------------------------------
function openMesDetalhe(mesRef, state){
  const valorMensalidade = state.configFinanceiro?.valorMensalidade ?? 0;
  const atletasPagantes = (state.atletas || [])
    .filter(a => a.pagante && a.ativo !== false)
    .sort((a, b) => (a.nome || "").localeCompare(b.nome || "", "pt-BR"));

  const statusInicial = (atletaId) => (state.financeiro || []).some(
    f => f.tipo === "mensalidade" && f.mesRef === mesRef && f.atletaId === atletaId
  );

  const rowsHtml = atletasPagantes.map(a => {
    const pago = statusInicial(a.id);
    return `
      <label class="event-row" style="cursor:pointer; justify-content:space-between;" data-atleta-nome="${escapeHtml(a.nome)}">
        <span style="display:flex; align-items:center; gap:8px;">
          <input type="checkbox" data-atleta-id="${a.id}" ${pago ? "checked" : ""} style="width:16px; height:16px;">
          ${escapeHtml(a.nome)}
        </span>
        <span class="badge ${pago ? "badge-ok" : "badge-off"}">${pago ? "Pago" : "Não pago"}</span>
      </label>`;
  }).join("");

  openModal(`
    <div class="modal-head">
      <h3>Mensalidades — ${mesLabel(mesRef)}</h3>
      <button class="modal-close" data-close>&times;</button>
    </div>
    <div class="modal-body">
      <p class="field-hint" style="margin-bottom:10px;">Valor da mensalidade: <strong>${fmtBRL(valorMensalidade)}</strong></p>
      ${atletasPagantes.length ? rowsHtml : `<p style="color:var(--ink-faint); font-style:italic;">Nenhum jogador pagante ativo cadastrado.</p>`}
      <div class="form-actions" style="justify-content:space-between;">
        <button type="button" class="btn btn-ghost" id="btn-copiar-lista">Copiar lista p/ WhatsApp</button>
        <button type="button" class="btn btn-primary" data-close>Fechar</button>
      </div>
    </div>
  `);
  $$("[data-close]").forEach(b => b.addEventListener("click", closeModal));

  $$("input[type=checkbox][data-atleta-id]").forEach(chk => {
    chk.addEventListener("change", async () => {
      const atletaId = chk.dataset.atletaId;
      const atleta = atletasPagantes.find(a => a.id === atletaId);
      const docId = idMensalidade(mesRef, atletaId);
      const badge = chk.closest("label").querySelector(".badge");
      const wasChecked = !chk.checked; // valor antes desse clique, pra reverter se der erro
      chk.disabled = true;
      try{
        if (chk.checked){
          await createDocWithId("financeiro", docId, {
            tipo: "mensalidade",
            valor: valorMensalidade,
            data: todayISO(),
            descricao: `Mensalidade ${mesLabel(mesRef)} — ${atleta.nome}`,
            atletaId,
            mesRef,
          });
          badge.textContent = "Pago";
          badge.className = "badge badge-ok";
        } else {
          await removeDoc("financeiro", docId);
          badge.textContent = "Não pago";
          badge.className = "badge badge-off";
        }
      }catch(err){
        console.error(err);
        toast("Erro ao atualizar: " + err.message, "err");
        chk.checked = wasChecked;
      }
      chk.disabled = false;
    });
  });

  $("#btn-copiar-lista")?.addEventListener("click", async () => {
    const linhas = $$("label.event-row[data-atleta-nome]").map(label => {
      const nome = label.dataset.atletaNome;
      const pago = label.querySelector("input[type=checkbox]").checked;
      return `${pago ? "✅" : "❌"} ${nome}`;
    });
    const texto = `*Mensalidades — ${mesLabel(mesRef)}*\n${linhas.join("\n")}`;
    try{
      await navigator.clipboard.writeText(texto);
      toast("Lista copiada! Cole no WhatsApp.", "ok");
    }catch(err){
      toast("Não foi possível copiar automaticamente.", "err");
    }
  });
}

// ----------------------------------------------------------------------------
// Meses futuros — botão pequeno na tela principal, pra lançar mensalidade
// adiantada sem poluir a lista padrão (que só mostra passado/atual).
// ----------------------------------------------------------------------------
function openMesesFuturos(state){
  const atual = mesAtualRef();
  const meses = mesesEntre(addMeses(atual, 1), addMeses(atual, 6));
  const tilesHtml = meses.map(m => `
    <button type="button" class="mes-tile" data-mes="${m}">
      <div class="mes-nome">${mesLabel(m)}</div>
      <div class="mes-sub">Lançar mensalidades</div>
    </button>`).join("");

  openModal(`
    <div class="modal-head">
      <h3>Meses futuros</h3>
      <button class="modal-close" data-close>&times;</button>
    </div>
    <div class="modal-body">
      <div class="mes-grid">${tilesHtml}</div>
    </div>
  `);
  $$("[data-close]").forEach(b => b.addEventListener("click", closeModal));
  $$(".mes-tile").forEach(btn => {
    btn.addEventListener("click", () => openMesDetalhe(btn.dataset.mes, state));
  });
}

// ----------------------------------------------------------------------------
// Ver todas — a tela principal só mostra os meses mais recentes (pra não
// espremer no mobile); esse modal lista o histórico completo, desde
// MES_INICIO até o mês atual, conforme ele for crescendo mês a mês.
// ----------------------------------------------------------------------------
function openMesesTodos(state){
  const transacoes = state.financeiro || [];
  const pagantesAtivos = (state.atletas || []).filter(a => a.pagante && a.ativo !== false);
  const todos = mesesEntre(MES_INICIO, mesAtualRef()).reverse();
  const tilesHtml = todos.map(m => mesTileHtml(m, transacoes, pagantesAtivos)).join("");

  openModal(`
    <div class="modal-head">
      <h3>Todos os meses</h3>
      <button class="modal-close" data-close>&times;</button>
    </div>
    <div class="modal-body">
      <div class="mes-grid">${tilesHtml}</div>
    </div>
  `);
  $$("[data-close]").forEach(b => b.addEventListener("click", closeModal));
  $$(".mes-tile").forEach(btn => {
    btn.addEventListener("click", () => openMesDetalhe(btn.dataset.mes, state));
  });
}

// ----------------------------------------------------------------------------
// Tela principal
// ----------------------------------------------------------------------------
export function renderFinanceiro(root, state){
  const transacoes = state.financeiro || [];

  const saldo = transacoes.reduce((acc, t) => {
    if (t.tipo === "saida") return acc - (t.valor || 0);
    return acc + (t.valor || 0);
  }, 0);

  const mesesPassados = mesesEntre(MES_INICIO, mesAtualRef()).reverse();
  const pagantesAtivos = (state.atletas || []).filter(a => a.pagante && a.ativo !== false);
  const mesesRecentes = mesesPassados.slice(0, MESES_VISIVEIS_TELA);

  const mesesHtml = mesesRecentes.map(m => mesTileHtml(m, transacoes, pagantesAtivos)).join("");

  const atletasPorId = Object.fromEntries((state.atletas || []).map(a => [a.id, a]));
  const historicoOrdenado = [...transacoes].sort((a, b) => (b.data || "").localeCompare(a.data || ""));

  const historicoRows = historicoOrdenado.map(t => {
    const tipoLabel = t.tipo === "entrada" ? "Entrada" : t.tipo === "saida" ? "Saída" : "Mensalidade";
    const tipoBadge = t.tipo === "saida" ? "badge-danger" : t.tipo === "mensalidade" ? "badge-pending" : "badge-ok";
    const sinal = t.tipo === "saida" ? "−" : "+";
    const desc = t.descricao || (t.tipo === "mensalidade" && atletasPorId[t.atletaId]
      ? `Mensalidade — ${atletasPorId[t.atletaId].nome}`
      : "—");
    return `
      <tr>
        <td>${formatDate(t.data)}</td>
        <td><span class="badge ${tipoBadge}">${tipoLabel}</span></td>
        <td>${escapeHtml(desc)}</td>
        <td style="font-family:var(--font-mono); font-weight:700; ${t.tipo === "saida" ? "color:var(--danger);" : "color:var(--ok);"}">${sinal} ${fmtBRL(t.valor || 0)}</td>
        <td class="col-actions">
          <button class="btn btn-ghost btn-sm btn-editar-transacao" data-id="${t.id}" type="button">Editar</button>
          <button class="btn btn-ghost btn-sm btn-excluir-transacao" data-id="${t.id}" type="button">Excluir</button>
        </td>
      </tr>`;
  }).join("");

  root.innerHTML = `
    <div class="topbar">
      <div>
        <div class="eyebrow">Gestão</div>
        <h1>Financeiro</h1>
      </div>
    </div>

    <div class="saldo-hero">
      <div class="lbl">Saldo atual</div>
      <div class="val ${saldo < 0 ? "negativo" : ""}">${fmtBRL(saldo)}</div>
      <div style="display:flex; gap:8px; margin-top:14px;">
        <button class="btn btn-primary" id="btn-entrada" type="button">+ Entrada</button>
        <button class="btn btn-danger" id="btn-saida" type="button">+ Saída</button>
      </div>
    </div>

    <div class="card card-pad" style="margin:18px 0; display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:10px;">
      <div>
        <div class="card-title" style="margin-bottom:2px;">Valor da mensalidade</div>
        <div class="card-sub" style="margin-bottom:0;">${fmtBRL(state.configFinanceiro?.valorMensalidade ?? 0)}</div>
      </div>
      <button class="btn btn-ghost btn-sm" id="btn-editar-mensalidade" type="button">Editar valor</button>
    </div>

    <div class="topbar" style="margin-bottom:12px;">
      <h2 style="font-size:18px; margin:0;">Mensalidades por mês</h2>
      <div style="display:flex; gap:8px;">
        <button class="btn btn-ghost btn-sm" id="btn-ver-todos-meses" type="button">Ver todas</button>
        <button class="btn btn-ghost btn-sm" id="btn-meses-futuros" type="button">Meses futuros</button>
      </div>
    </div>
    <div class="mes-grid">
      ${mesesHtml || `<p style="color:var(--ink-faint); font-style:italic;">Nenhum mês disponível ainda.</p>`}
    </div>

    <h2 style="font-size:18px; margin:26px 0 12px;">Histórico de transações</h2>
    <div class="table-wrap">
      <table>
        <thead><tr><th>Data</th><th>Tipo</th><th>Descrição</th><th>Valor</th><th></th></tr></thead>
        <tbody>
          ${historicoRows || `<tr class="empty-row"><td colspan="5">Nenhuma transação lançada ainda.</td></tr>`}
        </tbody>
      </table>
    </div>
  `;

  $("#btn-entrada", root).addEventListener("click", () => openTransacaoForm("entrada"));
  $("#btn-saida", root).addEventListener("click", () => openTransacaoForm("saida"));
  $("#btn-editar-mensalidade", root).addEventListener("click", () => openConfigMensalidadeForm(state));
  $("#btn-meses-futuros", root).addEventListener("click", () => openMesesFuturos(state));
  $("#btn-ver-todos-meses", root).addEventListener("click", () => openMesesTodos(state));
  $$(".mes-tile", root).forEach(btn => btn.addEventListener("click", () => openMesDetalhe(btn.dataset.mes, state)));
  $$(".btn-editar-transacao", root).forEach(btn => {
    btn.addEventListener("click", () => {
      const t = transacoes.find(x => x.id === btn.dataset.id);
      if (!t) return;
      openEditTransacaoForm(t);
    });
  });
  $$(".btn-excluir-transacao", root).forEach(btn => {
    btn.addEventListener("click", async () => {
      const t = transacoes.find(x => x.id === btn.dataset.id);
      if (!t) return;
      const label = t.tipo === "entrada" ? "esta entrada" : t.tipo === "saida" ? "esta saída" : "esta mensalidade";
      if (!(await confirmAction(`Excluir ${label}? Essa ação não pode ser desfeita.`))) return;
      try{
        await removeDoc("financeiro", t.id);
        toast("Transação excluída.", "ok");
      }catch(err){
        console.error(err);
        toast("Erro ao excluir: " + err.message, "err");
      }
    });
  });
}
