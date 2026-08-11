import { avg } from "./utils.js";

// Jogos "realizados" são os que entram nas estatísticas (jogos agendados/futuros não contam).
export function jogosRealizados(jogos){
  return jogos.filter(j => j.status === "realizado");
}

// ----------------------------------------------------------------------------
// Gols e assistências
// ----------------------------------------------------------------------------
export function golsEAssistenciasPorAtleta(jogos){
  const map = {}; // atletaId -> { gols, assistencias }
  const bump = (id, key) => {
    if (!id) return;
    if (!map[id]) map[id] = { gols: 0, assistencias: 0 };
    map[id][key]++;
  };
  jogosRealizados(jogos).forEach(j => {
    (j.golsAssistencias || []).forEach(evt => {
      if (evt.atletaGolId) bump(evt.atletaGolId, "gols");
      if (evt.atletaAssistId) bump(evt.atletaAssistId, "assistencias");
    });
  });
  return map;
}

export function totalGols(jogos){
  return jogosRealizados(jogos).reduce((sum, j) => sum + (j.golsAssistencias?.length || 0), 0);
}

export function totalAssistencias(jogos){
  return jogosRealizados(jogos).reduce((sum, j) =>
    sum + (j.golsAssistencias || []).filter(e => !!e.atletaAssistId).length, 0);
}

export function rankingGolsAssistencias(atletas, jogos){
  const map = golsEAssistenciasPorAtleta(jogos);
  return atletas
    .map(a => ({
      atleta: a,
      gols: map[a.id]?.gols || 0,
      assistencias: map[a.id]?.assistencias || 0,
    }))
    .filter(r => r.gols > 0 || r.assistencias > 0)
    .sort((a, b) => (b.gols + b.assistencias) - (a.gols + a.assistencias) || b.gols - a.gols);
}

// Quantidade de partidas realizadas em que o atleta esteve escalado
// (na inicial ou na final), independente de ter marcado gol/assistência.
export function contagemJogosPorAtleta(jogos){
  const map = {};
  jogosRealizados(jogos).forEach(j => {
    const ids = new Set([
      ...normalizeEscalacao(j.escalacaoInicial).map(e => e.atletaId),
      ...normalizeEscalacao(j.escalacaoFinal).map(e => e.atletaId),
    ]);
    ids.forEach(id => { map[id] = (map[id] || 0) + 1; });
  });
  return map;
}

// Estatísticas combinadas de cada atleta (jogos, gols, assistências, nota
// média), calculadas a partir de um conjunto de jogos já filtrado (por
// período ou por partida específica) — usado na tela de Ranking.
export function statsPorAtleta(atletas, jogos){
  const gaMap = golsEAssistenciasPorAtleta(jogos);
  const jogosMap = contagemJogosPorAtleta(jogos);
  return atletas.map(a => {
    const { media, qtd } = mediaNotaAtleta(a.id, jogos);
    return {
      atleta: a,
      jogosCount: jogosMap[a.id] || 0,
      gols: gaMap[a.id]?.gols || 0,
      assistencias: gaMap[a.id]?.assistencias || 0,
      media,
      qtdAvaliacoes: qtd,
    };
  });
}

// ----------------------------------------------------------------------------
// Escalação — posição jogada em cada partida
// ----------------------------------------------------------------------------

// Aceita tanto o formato novo (array de {atletaId, posicao}) quanto o antigo
// (array de ids em string, de jogos criados antes desse recurso existir).
export function normalizeEscalacao(arr){
  return (arr || [])
    .map(e => typeof e === "string" ? { atletaId: e, posicao: null } : { atletaId: e?.atletaId, posicao: e?.posicao || null })
    .filter(e => !!e.atletaId);
}

// Posição em que o atleta atuou numa partida específica: prioriza a escalação
// final (reflete o que de fato aconteceu em campo, incluindo substituições),
// caindo para a inicial se só ela tiver a posição informada.
export function posicaoJogadaNoJogo(jogo, atletaId){
  const buscar = (field) => normalizeEscalacao(jogo?.[field]).find(e => e.atletaId === atletaId)?.posicao || null;
  return buscar("escalacaoFinal") || buscar("escalacaoInicial");
}

// ----------------------------------------------------------------------------
// Avaliações
// ----------------------------------------------------------------------------
export function mediaNotaAtleta(atletaId, jogos){
  const notas = jogosRealizados(jogos)
    .map(j => j.avaliacoesJogadores?.[atletaId]?.nota)
    .filter(n => typeof n === "number");
  return { media: avg(notas), qtd: notas.length };
}

// Notas médias de cada atleta separadas pela posição que ele efetivamente
// jogou em cada partida (não a posição de cadastro). Um atleta que já jogou
// de Zagueiro em alguns jogos e de Lateral em outros terá uma média para
// cada posição. Se a partida não tiver posição informada (jogos antigos),
// usa a posição de cadastro do atleta como fallback só para não perder o dado.
export function notasPorPosicao(atletas, jogos){
  const map = {}; // atletaId -> { posicao -> notas[] }
  jogosRealizados(jogos).forEach(j => {
    Object.entries(j.avaliacoesJogadores || {}).forEach(([atletaId, v]) => {
      if (typeof v?.nota !== "number") return;
      const atleta = atletas.find(a => a.id === atletaId);
      const posicao = posicaoJogadaNoJogo(j, atletaId) || atleta?.posicao || null;
      if (!posicao) return;
      if (!map[atletaId]) map[atletaId] = {};
      if (!map[atletaId][posicao]) map[atletaId][posicao] = [];
      map[atletaId][posicao].push(v.nota);
    });
  });
  const result = {};
  Object.entries(map).forEach(([atletaId, porPosicao]) => {
    result[atletaId] = {};
    Object.entries(porPosicao).forEach(([posicao, notas]) => {
      result[atletaId][posicao] = { media: avg(notas), qtd: notas.length };
    });
  });
  return result;
}

export function mediaGeralJogadores(jogos){
  const todasNotas = [];
  jogosRealizados(jogos).forEach(j => {
    Object.values(j.avaliacoesJogadores || {}).forEach(v => {
      if (typeof v?.nota === "number") todasNotas.push(v.nota);
    });
  });
  return avg(todasNotas);
}

export function mediaCampo(campoId, jogos){
  const notas = jogosRealizados(jogos)
    .filter(j => j.campoId === campoId)
    .map(j => j.avaliacaoCampo?.nota)
    .filter(n => typeof n === "number");
  return { media: avg(notas), qtd: notas.length };
}

export function mediaAdversario(adversarioId, jogos){
  const notas = jogosRealizados(jogos)
    .filter(j => j.adversarioId === adversarioId)
    .map(j => j.avaliacaoAdversario?.nota)
    .filter(n => typeof n === "number");
  return { media: avg(notas), qtd: notas.length };
}

export function mediaGeralCampos(jogos){
  return avg(jogosRealizados(jogos).map(j => j.avaliacaoCampo?.nota).filter(n => typeof n === "number"));
}

export function mediaGeralAdversarios(jogos){
  return avg(jogosRealizados(jogos).map(j => j.avaliacaoAdversario?.nota).filter(n => typeof n === "number"));
}

// ----------------------------------------------------------------------------
// Contagens / resultado
// ----------------------------------------------------------------------------
export function contagemJogosPorCampo(jogos){
  const map = {};
  jogosRealizados(jogos).forEach(j => { if (j.campoId) map[j.campoId] = (map[j.campoId] || 0) + 1; });
  return map;
}

export function contagemJogosPorAdversario(jogos){
  const map = {};
  jogosRealizados(jogos).forEach(j => { if (j.adversarioId) map[j.adversarioId] = (map[j.adversarioId] || 0) + 1; });
  return map;
}

export function resultadoJogo(jogo){
  if (jogo.placarNos === null || jogo.placarNos === undefined || jogo.placarAdversario === null || jogo.placarAdversario === undefined){
    return null;
  }
  if (jogo.placarNos > jogo.placarAdversario) return "vitoria";
  if (jogo.placarNos < jogo.placarAdversario) return "derrota";
  return "empate";
}

export function resumoGeral(jogos){
  const realizados = jogosRealizados(jogos);
  let vitorias = 0, empates = 0, derrotas = 0;
  realizados.forEach(j => {
    const r = resultadoJogo(j);
    if (r === "vitoria") vitorias++;
    else if (r === "empate") empates++;
    else if (r === "derrota") derrotas++;
  });
  return {
    qtdJogos: realizados.length,
    qtdGols: totalGols(jogos),
    qtdAssistencias: totalAssistencias(jogos),
    mediaJogadores: mediaGeralJogadores(jogos),
    mediaCampo: mediaGeralCampos(jogos),
    mediaAdversario: mediaGeralAdversarios(jogos),
    vitorias, empates, derrotas,
  };
}
