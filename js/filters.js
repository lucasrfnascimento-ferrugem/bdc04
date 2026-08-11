// Filtro de período (ano/mês) compartilhado entre Dashboard e Histórico.
// É um estado simples em memória (não React, sem pub/sub): como só uma tela
// fica montada por vez nessa SPA, mudar o filtro numa tela e navegar para a
// outra já mostra o mesmo período selecionado — e cada tela pode alterá-lo
// independentemente a partir daí.
let filtro = { ano: "", mes: "" };

export function getFiltroPeriodo(){
  return { ...filtro };
}

export function setFiltroPeriodo(parcial){
  filtro = { ...filtro, ...parcial };
}

export const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

export function anosDisponiveis(jogos){
  return [...new Set(jogos.map(j => (j.data || "").slice(0, 4)).filter(Boolean))]
    .sort((a, b) => b.localeCompare(a));
}

export function filtrarPorPeriodo(jogos, filtroObj = filtro){
  return jogos.filter(j => {
    const ano = (j.data || "").slice(0, 4);
    const mes = (j.data || "").slice(5, 7);
    if (filtroObj.ano && ano !== filtroObj.ano) return false;
    if (filtroObj.mes && mes !== filtroObj.mes) return false;
    return true;
  });
}
