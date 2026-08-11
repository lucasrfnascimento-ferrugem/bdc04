import { $, $$, escapeHtml, openModal, closeModal, toast, confirmAction, fmt1 } from "../utils.js";
import { createDoc, saveDoc, removeDoc, setPrivateDoc, getPrivateDoc } from "../db.js";
import { mediaNotaAtleta, mediaCampo, mediaAdversario, contagemJogosPorCampo, contagemJogosPorAdversario, POSICAO_TECNICO } from "../stats.js";

// ============================================================================
// Motor genérico de CRUD (usado por Atletas, Adversários e Campos)
// ============================================================================

export function fieldHtml(f, item){
  const val = item ? item[f.key] : (f.default ?? "");
  const req = f.required ? "required" : "";
  const spanCls = f.span2 ? "field span-2" : "field";

  if (f.type === "select"){
    const opts = f.options.map(o => {
      const ov = typeof o === "string" ? o : o.value;
      const ol = typeof o === "string" ? o : o.label;
      return `<option value="${escapeHtml(ov)}" ${val === ov ? "selected" : ""}>${escapeHtml(ol)}</option>`;
    }).join("");
    return `<div class="${spanCls}"><label>${f.label}${f.required ? " *" : ""}</label>
      <select name="${f.key}" ${req}>${f.placeholder ? `<option value="">${escapeHtml(f.placeholder)}</option>` : ""}${opts}</select></div>`;
  }
  if (f.type === "textarea"){
    return `<div class="${spanCls}"><label>${f.label}</label>
      <textarea name="${f.key}" placeholder="${escapeHtml(f.placeholder || "")}">${escapeHtml(val)}</textarea></div>`;
  }
  if (f.type === "checkbox"){
    return `<div class="${spanCls}" style="flex-direction:row; align-items:center; gap:8px; padding-top:18px;">
      <input type="checkbox" name="${f.key}" id="chk-${f.key}" ${val ? "checked" : ""} style="width:16px;height:16px;">
      <label for="chk-${f.key}" style="margin:0;">${f.label}</label></div>`;
  }
  if (f.type === "number"){
    return `<div class="${spanCls}"><label>${f.label}${f.required ? " *" : ""}</label>
      <input type="number" name="${f.key}" value="${val ?? ""}" ${req} ${f.min !== undefined ? `min="${f.min}"` : ""} ${f.max !== undefined ? `max="${f.max}"` : ""}></div>`;
  }
  if (f.type === "date"){
    return `<div class="${spanCls}"><label>${f.label}${f.required ? " *" : ""}</label>
      <input type="date" name="${f.key}" value="${escapeHtml(val)}" ${req}></div>`;
  }
  return `<div class="${spanCls}"><label>${f.label}${f.required ? " *" : ""}</label>
    <input type="text" name="${f.key}" value="${escapeHtml(val)}" placeholder="${escapeHtml(f.placeholder || "")}" ${req}></div>`;
}

export function collectFormData(fields, formEl){
  const data = {};
  fields.forEach(f => {
    const el = formEl.elements[f.key];
    if (!el) return;
    if (f.type === "checkbox") data[f.key] = el.checked;
    else if (f.type === "number") data[f.key] = el.value === "" ? null : Number(el.value);
    else data[f.key] = el.value;
  });
  return data;
}

// Separa os campos marcados como `private:true` (ex: CPF, data de nascimento)
// dos campos públicos — os privados vão para uma coleção à parte, com leitura
// restrita a e-mails autorizados nas regras do Firestore.
function splitPublicPrivate(fields, data){
  const pub = {}, priv = {};
  fields.forEach(f => {
    if (f.private) priv[f.key] = data[f.key];
    else pub[f.key] = data[f.key];
  });
  return { pub, priv };
}

function openCrudForm(opts, item){
  const isEdit = !!item;
  const fieldsHtml = opts.fields.map(f => fieldHtml(f, item)).join("");
  openModal(`
    <div class="modal-head">
      <h3>${isEdit ? "Editar" : "Novo(a)"} ${opts.singular}</h3>
      <button class="modal-close" data-close>&times;</button>
    </div>
    <div class="modal-body">
      <form id="crud-form">
        <div class="form-grid">${fieldsHtml}</div>
        <div class="form-actions" style="justify-content:space-between;">
          ${isEdit ? `<button type="button" class="btn btn-danger" id="btn-delete-item">Excluir</button>` : `<span></span>`}
          <div style="display:flex; gap:8px;">
            <button type="button" class="btn btn-ghost" data-close>Cancelar</button>
            <button type="submit" class="btn btn-primary">Salvar</button>
          </div>
        </div>
      </form>
    </div>
  `);
  $$("[data-close]").forEach(b => b.addEventListener("click", closeModal));

  $("#crud-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const data = collectFormData(opts.fields, e.target);
    const { pub, priv } = opts.privateCollectionName ? splitPublicPrivate(opts.fields, data) : { pub: data, priv: null };
    const btn = e.target.querySelector('button[type="submit"]');
    btn.disabled = true;
    try{
      if (isEdit){
        await saveDoc(opts.collectionName, item.id, pub);
        if (opts.privateCollectionName) await setPrivateDoc(opts.privateCollectionName, item.id, priv);
      } else {
        const ref = await createDoc(opts.collectionName, pub);
        if (opts.privateCollectionName) await setPrivateDoc(opts.privateCollectionName, ref.id, priv);
      }
      toast(`${opts.singular} salvo.`, "ok");
      closeModal();
    }catch(err){
      console.error(err);
      toast("Erro ao salvar: " + err.message, "err");
      btn.disabled = false;
    }
  });

  if (isEdit){
    $("#btn-delete-item").addEventListener("click", async () => {
      if (!confirmAction(`Excluir "${item[opts.fields[0].key] || ""}"? Essa ação não pode ser desfeita.`)) return;
      try{
        await removeDoc(opts.collectionName, item.id);
        if (opts.privateCollectionName) await removeDoc(opts.privateCollectionName, item.id);
        toast(`${opts.singular} excluído.`, "ok");
        closeModal();
      }catch(err){
        toast("Erro ao excluir: " + err.message, "err");
      }
    });
  }
}

function renderCrudView(root, opts, state){
  const items = state[opts.collectionName] || [];
  const rows = items.map(item => `
    <tr class="clickable" data-id="${item.id}">
      ${opts.columns.map(c => `<td>${c.render(item, state)}</td>`).join("")}
    </tr>
  `).join("");

  root.innerHTML = `
    <div class="topbar">
      <div>
        <div class="eyebrow">Cadastro</div>
        <h1>${opts.plural}</h1>
      </div>
      <button class="btn btn-primary" id="btn-new">+ Novo(a) ${opts.singular}</button>
    </div>
    <div class="table-wrap">
      <table>
        <thead><tr>${opts.columns.map(c => `<th>${c.label}</th>`).join("")}</tr></thead>
        <tbody>
          ${rows || `<tr class="empty-row"><td colspan="${opts.columns.length}">Nenhum(a) ${opts.singular.toLowerCase()} cadastrado(a) ainda.</td></tr>`}
        </tbody>
      </table>
    </div>
  `;

  $("#btn-new").addEventListener("click", () => openCrudForm(opts, null));
  $$("tbody tr[data-id]", root).forEach(tr => {
    tr.addEventListener("click", async () => {
      const item = items.find(i => i.id === tr.dataset.id);
      if (!item) return;
      if (!opts.privateCollectionName){
        openCrudForm(opts, item);
        return;
      }
      try{
        const priv = await getPrivateDoc(opts.privateCollectionName, item.id);
        openCrudForm(opts, { ...item, ...priv });
      }catch(err){
        // Mesmo se a leitura dos dados privados (CPF/nascimento) falhar — por
        // exemplo, se as regras do Firestore ainda não tiverem sido publicadas
        // no console —, abre o formulário com os dados públicos mesmo assim,
        // em vez de travar sem abrir nada.
        console.error(err);
        toast("Não foi possível carregar CPF/nascimento (dado protegido). Abrindo com os demais dados.", "err");
        openCrudForm(opts, item);
      }
    });
  });
}

// ============================================================================
// Configurações específicas
// ============================================================================

// Posições de linha — usadas na escalação de partida (posição jogada em campo).
export const POSICOES = ["Goleiro", "Zagueiro", "Lateral", "Volante", "Meia", "Atacante"];

// Categorias do cadastro do atleta — inclui "Técnico" além das posições de
// linha, pra cadastrar comissão técnica. "Técnico" não é uma posição jogada
// em campo, por isso não entra nas opções de POSICOES (usada na escalação).
export const CATEGORIAS_ATLETA = [...POSICOES, POSICAO_TECNICO];

// Hub que agrupa Atletas/Adversários/Campos numa tela só — no mobile isso
// substitui 3 ícones separados no menu inferior por 1 só (evita menu apertado).
export function renderCadastrosHub(root, state){
  const itens = [
    {
      route: "atletas", label: "Atletas", desc: `${state.atletas.length} cadastrado(s)`,
      icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="8" r="3.5"/><path d="M5 21c0-4 3-6.5 7-6.5s7 2.5 7 6.5"/></svg>`,
    },
    {
      route: "adversarios", label: "Adversários", desc: `${state.adversarios.length} cadastrado(s)`,
      icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 21V4l8 4 8-4v17"/><path d="M4 21h16"/></svg>`,
    },
    {
      route: "campos", label: "Campos", desc: `${state.campos.length} cadastrado(s)`,
      icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="6" width="18" height="12" rx="1"/><circle cx="12" cy="12" r="2.4"/><path d="M12 6v12M3 9h3v6H3M18 9h3v6h-3"/></svg>`,
    },
  ];

  root.innerHTML = `
    <div class="topbar">
      <div>
        <div class="eyebrow">Gestão</div>
        <h1>Cadastros</h1>
      </div>
    </div>
    <div class="dashboard-grid-3">
      ${itens.map(it => `
        <a href="#${it.route}" class="card card-pad" style="display:flex; align-items:center; gap:14px; text-decoration:none;">
          <div style="width:44px; height:44px; border-radius:50%; background:var(--pitch-light); display:flex; align-items:center; justify-content:center; flex-shrink:0; color:var(--pitch);">${it.icon}</div>
          <div style="min-width:0;">
            <div class="card-title" style="margin-bottom:2px;">${it.label}</div>
            <div class="card-sub" style="margin-bottom:0;">${it.desc}</div>
          </div>
        </a>`).join("")}
    </div>
  `;
}

export function renderAtletas(root, state){
  renderCrudView(root, {
    collectionName: "atletas",
    privateCollectionName: "atletas_privado",
    singular: "Atleta",
    plural: "Atletas",
    fields: [
      { key: "nome", label: "Nome", type: "text", required: true, span2: true },
      { key: "posicao", label: "Posição / categoria", type: "select", options: CATEGORIAS_ATLETA, placeholder: "Selecione" },
      { key: "numero", label: "Número da camisa", type: "number", min: 0 },
      { key: "cpf", label: "CPF (opcional)", type: "text", placeholder: "000.000.000-00", private: true },
      { key: "dataNascimento", label: "Data de nascimento (opcional)", type: "date", private: true },
      { key: "ativo", label: "Atleta ativo no elenco", type: "checkbox", default: true },
      { key: "podeVotar", label: "Direito a voto (diretor/capitão)", type: "checkbox", default: false },
      { key: "observacoes", label: "Observações", type: "textarea", span2: true },
    ],
    columns: [
      { label: "#", render: a => `<span class="pill-num">${a.numero ?? "—"}</span>` },
      { label: "Nome", render: a => `<strong>${escapeHtml(a.nome)}</strong>` },
      { label: "Posição", render: a => escapeHtml(a.posicao || "—") },
      { label: "Status", render: a => a.ativo === false
        ? `<span class="badge badge-off">Inativo</span>`
        : `<span class="badge badge-ok">Ativo</span>` },
      { label: "Votante", render: a => a.podeVotar
        ? `<span class="badge badge-pending">Vota</span>`
        : `<span style="color:var(--ink-faint);">—</span>` },
      { label: "Nota média", render: (a, state) => {
        const { media, qtd } = mediaNotaAtleta(a.id, state.jogos);
        return media === null ? "—" : `${fmt1(media)} <span style="color:var(--ink-faint); font-size:11px;">(${qtd})</span>`;
      }},
    ],
  }, state);
}

export function renderAdversarios(root, state){
  renderCrudView(root, {
    collectionName: "adversarios",
    singular: "Adversário",
    plural: "Adversários",
    fields: [
      { key: "nome", label: "Nome do time", type: "text", required: true, span2: true },
      { key: "cidade", label: "Cidade", type: "text" },
      { key: "observacoes", label: "Observações", type: "textarea", span2: true },
    ],
    columns: [
      { label: "Nome", render: a => `<strong>${escapeHtml(a.nome)}</strong>` },
      { label: "Cidade", render: a => escapeHtml(a.cidade || "—") },
      { label: "Jogos", render: (a, state) => contagemJogosPorAdversario(state.jogos)[a.id] || 0 },
      { label: "Nota média", render: (a, state) => {
        const { media, qtd } = mediaAdversario(a.id, state.jogos);
        return media === null ? "—" : `${fmt1(media)} <span style="color:var(--ink-faint); font-size:11px;">(${qtd})</span>`;
      }},
    ],
  }, state);
}

export function renderCampos(root, state){
  renderCrudView(root, {
    collectionName: "campos",
    singular: "Campo",
    plural: "Campos",
    fields: [
      { key: "nome", label: "Nome do campo", type: "text", required: true, span2: true },
      { key: "endereco", label: "Endereço", type: "text", span2: true },
      { key: "tipo", label: "Tipo de gramado", type: "select", options: ["Gramado natural", "Gramado sintético", "Society", "Quadra"], placeholder: "Selecione" },
      { key: "observacoes", label: "Observações", type: "textarea", span2: true },
    ],
    columns: [
      { label: "Nome", render: c => `<strong>${escapeHtml(c.nome)}</strong>` },
      { label: "Tipo", render: c => escapeHtml(c.tipo || "—") },
      { label: "Jogos", render: (c, state) => contagemJogosPorCampo(state.jogos)[c.id] || 0 },
      { label: "Nota média", render: (c, state) => {
        const { media, qtd } = mediaCampo(c.id, state.jogos);
        return media === null ? "—" : `${fmt1(media)} <span style="color:var(--ink-faint); font-size:11px;">(${qtd})</span>`;
      }},
    ],
  }, state);
}
