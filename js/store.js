// État de l’appli et stockage des documents (IndexedDB, ou localStorage en secours).
import { lsGet, lsSet, toast } from './util.js';

// rev : compteur des écritures (put, del), pour invalider les calculs gardés en mémoire
export const S = { docs:new Map(), rev:0, loaded:false, view:'today',
  progEx:'la_hack', progTab:'seances', progressTab:'stats', calMonth:null, calDay:null, day:null, openHist:null, confirm:null, summary:null,
  restEnd:0, restLabel:'', restDoneAt:0, picker:null, draft:null, setup:null, renaming:false, fiche:null, exQ:'', food:null, foodDay:null, from:null, navHint:null, act:null, adjOk:false,
  // Aujourd'hui : ligne compacte ouverte ('eau' | 'corps' | 'activites' | 'genou' | null), autres conseils d'Émile affichés
  todayOpen:null, emileMore:false, emileOpen:false,
  // fiche d'un exercice ouverte depuis 'exercices' ou 'progress'
  ficheFrom:null,
  // Séance : exercice ouvert à la main, exercice qui attend ses reps en réserve, série faite en correction ({ ex, i }), exercice de « Voir le mouvement »
  sessOpen:null, rirAsk:null, setEdit:null, move:null };
const LS_DOCS = 'carnet_docs_v1'; // ancien stockage : recopié dans IndexedDB au premier lancement, puis laissé en place
const IDB_NAME = 'carnet-muscu';
let idb = null; // null : IndexedDB indisponible, on reste sur localStorage
function loadLocal(){ const raw = lsGet(LS_DOCS); if (!raw) return new Map(); try { return new Map(Object.entries(JSON.parse(raw))); } catch (e) { return new Map(); } }
function saveLocal(){ lsSet(LS_DOCS, JSON.stringify(Object.fromEntries(S.docs))); }
function openIdb(){
  return new Promise((ok, ko) => {
    const r = indexedDB.open(IDB_NAME, 1);
    // docs : un enregistrement par document, clé = identifiant ; meta : état de la migration
    r.onupgradeneeded = () => { r.result.createObjectStore('docs'); r.result.createObjectStore('meta'); };
    r.onsuccess = () => ok(r.result);
    r.onerror = () => ko(r.error);
  });
}
function loadIdb(db){
  return new Promise((ok, ko) => {
    const tx = db.transaction(['docs', 'meta'], 'readwrite');
    const docs = tx.objectStore('docs'), meta = tx.objectStore('meta');
    const m = new Map();
    meta.get('migration').onsuccess = e => {
      if (!e.target.result) {
        const old = loadLocal();
        old.forEach((o, id) => docs.put(o, id));
        meta.put({ from:LS_DOCS, at:new Date().toISOString(), count:old.size }, 'migration');
      }
      const keys = docs.getAllKeys(); const vals = docs.getAll();
      vals.onsuccess = () => keys.result.forEach((k, i) => m.set(k, vals.result[i]));
    };
    tx.oncomplete = () => ok(m);
    tx.onerror = tx.onabort = () => ko(tx.error);
  });
}
// Écrit l'état actuel de ces documents dans une seule transaction
function writeIdb(ids){
  return new Promise((ok, ko) => {
    const tx = idb.transaction('docs', 'readwrite'); const st = tx.objectStore('docs');
    ids.forEach(id => { const o = S.docs.get(id); if (o === undefined) st.delete(id); else st.put(o, id); });
    // Valider tout de suite : l'appli peut être fermée juste après un geste
    if (tx.commit) tx.commit();
    tx.oncomplete = () => ok();
    tx.onerror = tx.onabort = () => ko(tx.error);
  });
}
const pending = new Set();
async function flush(){
  const ids = [...pending]; pending.clear();
  try { await writeIdb(ids); }
  catch (e) {
    // iOS peut couper la connexion après une longue pause : on rouvre une fois avant d'abandonner
    try { idb = await openIdb(); await writeIdb(ids); }
    catch (e2) { toast(e2 && e2.name === 'QuotaExceededError' ? 'Stockage plein : exporte tes données puis supprime d’anciennes séances.' : 'Enregistrement impossible. Exporte tes données pour ne rien perdre, puis recharge la page.'); }
  }
}
function save(id){
  if (!S.loaded) return; // avant la fin du chargement, ne rien écrire : surtout pas par-dessus l'ancien stockage
  if (!idb) { saveLocal(); return; }
  if (!pending.size) queueMicrotask(flush);
  pending.add(id);
}
export function put(id, obj){ S.docs.set(id, obj); S.rev++; save(id); }
export function del(id){ S.docs.delete(id); S.rev++; save(id); }
// Charge les documents : IndexedDB (avec migration de l’ancien stockage), sinon localStorage
export async function loadDocs(){
  try { idb = await openIdb(); S.docs = await loadIdb(idb); }
  catch (e) { idb = null; S.docs = loadLocal(); }
}
export const usingIdb = () => !!idb;
