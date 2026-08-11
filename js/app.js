import { watchAuth, loginWithGoogle, logout, isEmailAllowed } from "./auth.js";
import { listenCollection } from "./db.js";
import { $, $$, toast } from "./utils.js";

import { renderDashboard } from "./views/dashboard.js";
import { renderRanking } from "./views/ranking.js";
import { renderEscalacaoIdeal } from "./views/escalacao-ideal.js";
import { renderHistorico } from "./views/historico.js";
import { renderJogosList, renderJogoDetail } from "./views/jogos.js";
import { renderAtletas, renderAdversarios, renderCampos, renderCadastrosHub } from "./views/cadastros.js";
import { renderAvaliacao } from "./views/avaliacao.js";

const state = {
  adversarios: [], campos: [], atletas: [], jogos: [],
  loaded: { adversarios: false, campos: false, atletas: false, jogos: false },
};

let currentUser = null;

function isAuthorized(){
  return !!currentUser && isEmailAllowed(currentUser.email);
}

function allLoaded(){
  return Object.values(state.loaded).every(Boolean);
}

// Coleções públicas (leitura liberada nas regras do Firestore) — carregadas
// sempre, independente de login, para alimentar as telas públicas.
function startListeners(){
  listenCollection("adversarios", "nome", (items) => { state.adversarios = items; state.loaded.adversarios = true; render(); });
  listenCollection("campos", "nome", (items) => { state.campos = items; state.loaded.campos = true; render(); });
  listenCollection("atletas", "nome", (items) => { state.atletas = items; state.loaded.atletas = true; render(); });
  listenCollection("jogos", "data", (items) => { state.jogos = items; state.loaded.jogos = true; render(); });
}
startListeners();

// ============================================================================
// Router
// ============================================================================

const ROUTES = {
  dashboard: renderDashboard,
  ranking: renderRanking,
  "escalacao-ideal": renderEscalacaoIdeal,
  historico: renderHistorico,
  atletas: renderAtletas,
  adversarios: renderAdversarios,
  campos: renderCampos,
  avaliacao: renderAvaliacao,
  cadastros: renderCadastrosHub,
};

const PROTECTED_ROUTES = new Set(["jogos", "atletas", "adversarios", "campos", "avaliacao", "cadastros"]);

function parseHash(){
  const raw = (location.hash || "#dashboard").slice(1);
  const [route, subId] = raw.split("/");
  return { route: route || "dashboard", subId };
}

function renderRestricted(root){
  root.innerHTML = `
    <div class="card restricted-card">
      <img src="assets/logo-bomdcopus.png" alt="Bom D' Copus">
      <h2>Acesso restrito</h2>
      <p>Essa área é só para quem cuida do time. Entre com uma conta Google autorizada para continuar.</p>
      <button id="btn-login-restricted" class="btn-google">
        <svg width="18" height="18" viewBox="0 0 18 18"><path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62z"/><path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.81.54-1.85.87-3.04.87-2.34 0-4.32-1.58-5.03-3.7H.95v2.33A9 9 0 0 0 9 18z"/><path fill="#FBBC05" d="M3.97 10.73A5.4 5.4 0 0 1 3.69 9c0-.6.1-1.19.28-1.73V4.94H.95A9 9 0 0 0 0 9c0 1.45.35 2.83.95 4.06l3.02-2.33z"/><path fill="#EA4335" d="M9 3.58c1.32 0 2.51.45 3.44 1.35l2.59-2.59C13.46.89 11.43 0 9 0A9 9 0 0 0 .95 4.94l3.02 2.33C4.68 5.16 6.66 3.58 9 3.58z"/></svg>
        Entrar com Google
      </button>
    </div>
  `;
  $("#btn-login-restricted", root)?.addEventListener("click", doLogin);
}

function render(){
  if (!allLoaded()){
    $("#view-root").innerHTML = `<div class="loader">Carregando dados…</div>`;
    return;
  }
  const { route, subId } = parseHash();

  // "Cadastros" agrupa Atletas/Adversários/Campos num hub só — o botão do
  // menu continua marcado como ativo quando o usuário está em qualquer uma
  // dessas subtelas, não só na tela do hub em si.
  const CADASTROS_SUBROTAS = new Set(["atletas", "adversarios", "campos"]);
  const routeAtiva = CADASTROS_SUBROTAS.has(route) ? "cadastros" : route;
  $$(".nav-link[data-route]").forEach(a => a.classList.toggle("active", a.dataset.route === routeAtiva));

  const root = $("#view-root");

  if (PROTECTED_ROUTES.has(route) && !isAuthorized()){
    renderRestricted(root);
    return;
  }

  if (route === "jogos"){
    if (subId) renderJogoDetail(root, state, subId);
    else renderJogosList(root, state);
    return;
  }
  const fn = ROUTES[route];
  if (fn) fn(root, state);
  else renderDashboard(root, state);
}

window.addEventListener("hashchange", render);

$$(".nav-link[data-route]").forEach(btn => {
  btn.addEventListener("click", () => { location.hash = `#${btn.dataset.route}`; });
});

// ============================================================================
// Autenticação — login/logout não bloqueiam mais o app inteiro; só liberam
// as páginas de jogos/atletas/adversários/campos.
// ============================================================================

async function doLogin(){
  try{
    await loginWithGoogle();
  }catch(err){
    console.error(err);
    toast("Não foi possível entrar. Tente novamente.", "err");
  }
}

$("#btn-login-desktop")?.addEventListener("click", doLogin);
$("#btn-login-mobile")?.addEventListener("click", doLogin);
$("#btn-signout")?.addEventListener("click", () => logout());
$("#btn-signout-mobile")?.addEventListener("click", () => logout());

function updateAuthUI(user){
  const authorized = !!user && isEmailAllowed(user.email);

  $$(".nav-protected-only").forEach(el => { el.style.display = authorized ? "" : "none"; });

  const loginDesktop = $("#btn-login-desktop");
  const chipDesktop = $("#user-chip-desktop");
  const signoutDesktop = $("#btn-signout");
  const loginMobile = $("#btn-login-mobile");
  const chipMobile = $("#user-chip-mobile");

  if (authorized){
    loginDesktop.style.display = "none";
    chipDesktop.style.display = "flex";
    signoutDesktop.style.display = "";
    loginMobile.style.display = "none";
    chipMobile.style.display = "flex";

    $("#user-name").textContent = user.displayName || "";
    $("#user-email").textContent = user.email || "";
    $("#user-avatar").src = user.photoURL || "";
    $("#user-avatar-mobile").src = user.photoURL || "";
  } else {
    loginDesktop.style.display = "";
    chipDesktop.style.display = "none";
    signoutDesktop.style.display = "none";
    loginMobile.style.display = "";
    chipMobile.style.display = "none";
  }
}

watchAuth((user) => {
  if (user && !isEmailAllowed(user.email)){
    toast(`A conta ${user.email} não tem acesso liberado a este app.`, "err");
    currentUser = null;
    logout();
    updateAuthUI(null);
    render();
    return;
  }

  currentUser = user;
  updateAuthUI(user);
  render();
});
