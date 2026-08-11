import {
  collection, doc, addDoc, updateDoc, deleteDoc, onSnapshot,
  query, orderBy, serverTimestamp, setDoc, getDoc
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { db } from "./auth.js";

// ----------------------------------------------------------------------------
// Generic collection helpers (adversarios, campos, atletas, jogos)
// ----------------------------------------------------------------------------

export function listenCollection(name, orderField, cb){
  const q = query(collection(db, name), orderBy(orderField, orderField === "data" ? "desc" : "asc"));
  return onSnapshot(q, (snap) => {
    const items = [];
    snap.forEach(d => items.push({ id: d.id, ...d.data() }));
    cb(items);
  }, (err) => {
    console.error(`Erro ao ouvir ${name}:`, err);
    cb([], err);
  });
}

export async function createDoc(name, data){
  return addDoc(collection(db, name), { ...data, criadoEm: serverTimestamp() });
}

export async function saveDoc(name, id, data){
  return updateDoc(doc(db, name, id), data);
}

export async function removeDoc(name, id){
  return deleteDoc(doc(db, name, id));
}

// ----------------------------------------------------------------------------
// Documentos "privados" (ex: atletas_privado) — mesmo id do documento
// público correspondente, leitura/escrita restrita a e-mails autorizados
// pelas regras do Firestore.
// ----------------------------------------------------------------------------

export async function setPrivateDoc(name, id, data){
  return setDoc(doc(db, name, id), data, { merge: true });
}

export async function getPrivateDoc(name, id){
  const snap = await getDoc(doc(db, name, id));
  return snap.exists() ? snap.data() : {};
}

// ----------------------------------------------------------------------------
// Jogo — campos aninhados (escalação, gols/assistências, avaliações)
// Tudo fica dentro do próprio documento do jogo para manter a consulta simples.
// ----------------------------------------------------------------------------

export async function updateJogoField(jogoId, fields){
  return updateDoc(doc(db, "jogos", jogoId), fields);
}
