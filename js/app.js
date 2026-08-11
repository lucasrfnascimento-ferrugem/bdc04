import { auth, watchAuth, loginWithGoogle, logout, isEmailAllowed } from "./auth.js";
import { listenCollection } from "./db.js";
import { $, $$, toast } from "./utils.js";

import { renderDashboard } from "./views/dashboard.js";
import { renderRanking } from "./views/ranking.js";
import { renderEscalacaoIdeal } from "./views/escalacao-ideal.js";
import { renderHistorico } from "./views/historico.js";
import { renderJogosList, renderJogoDetail } from "./views/jogos.js";
import { renderAtletas, renderAdversarios, renderCampos } from "./views/cadastros.js";

const state = {
  adversarios: [], campos: [], atletas: [], jogos: [],
  loaded: { adversarios: false, campos: false, atletas: false, jogos: false },
};

let unsubscribers = [];

function allLoaded(){
  return Object.values(state.loaded).every(Boolean);
}

function startListeners(){
  unsubscribers.push(listenCollection("adversarios", "nome", (items) => { state.adversarios = items; state.loaded.adversarios = true; render(); }));
  unsubscribers.push(listenCollection("campos", "nome", (items) => { state.campos = items; state.loaded.campos = true; render(); }));
  unsubscribers.push(listenCollection("atletas", "nome", (items) => { state.atletas = items; state.loaded.atletas = true; render(); }));
  unsubscribers.push(listenCollection("jogos", "data", (items) => { state.jogos = items; state.loaded.jogos = true; render(); }));
}

function stopListeners(){
  unsubscribers.forEach(u => u && u());
  unsubscribers = [];
  state.loaded = { adversarios: false, campos: false, atletas: false, jogos: false };
}

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
};

function parseHash(){
  const raw = (location.hash || "#dashboard").slice(1);
  const [route, subId] = raw.split("/");
  return { route: route || "dashboard", subId };
}

function render(){
  if (!allLoaded()){
    $("#view-root").innerHTML = `<div class="loader">Carregando dados…</div>`;
    return;
  }
  const { route, subId } = parseHash();

  $$(".nav-link[data-route]").forEach(a => a.classList.toggle("active", a.dataset.route === route));

  const root = $("#view-root");
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
// Autenticação
// ============================================================================

$("#btn-google-login").addEventListener("click", async () => {
  $("#login-error").textContent = "";
  $("#login-status").textContent = "Conectando…";
  try{
    await loginWithGoogle();
  }catch(err){
    console.error(err);
    $("#login-status").textContent = "";
    $("#login-error").textContent = "Não foi possível entrar. Tente novamente.";
  }
});

$("#btn-signout").addEventListener("click", () => logout());

watchAuth((user) => {
  const loginScreen = $("#login-screen");
  const shell = $("#app-shell");

  if (!user){
    stopListeners();
    shell.style.display = "none";
    loginScreen.style.display = "flex";
    $("#login-status").textContent = "";
    return;
  }

  if (!isEmailAllowed(user.email)){
    stopListeners();
    shell.style.display = "none";
    loginScreen.style.display = "flex";
    $("#login-status").textContent = "";
    $("#login-error").textContent = `A conta ${user.email} não tem acesso liberado a este app.`;
    logout();
    return;
  }

  loginScreen.style.display = "none";
  shell.style.display = "flex";
  $("#user-name").textContent = user.displayName || "";
  $("#user-email").textContent = user.email || "";
  $("#user-avatar").src = user.photoURL || "";

  if (unsubscribers.length === 0) startListeners();
  render();
});
