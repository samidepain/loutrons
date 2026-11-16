// Niveaux, XP et badges : calculés sur l'historique des séances, sans rien stocker (sans affichage). Ce sont des règles de jeu de l'appli,
// pas des règles d'entraînement. L'XP ne dépend d'aucun réglage (objectif de la semaine, programme) : elle ne baisse pas quand on en change.
import { mondayOf, today } from './util.js';
import { S } from './store.js';
import { blockRange, weekInfo, workouts } from './data.js';
import { recordLog } from './engine.js';

// Séance terminée (une par jour) ; régularité : par séance à partir de la 2e de la semaine (6 au plus) ; record d'un exercice (3 au plus
// par séance) ; bloc de 6 semaines passé avec des séances sur au moins 4 de ses semaines
export const XP = { session:100, regular:50, record:50, recordsMax:3, block:300 };
// XP cumulée pour atteindre un niveau : chaque niveau demande 300 XP de plus que le précédent (niveau 2 : 300, niveau 3 : 900, niveau 4 : 1 800…)
export const levelFloor = n => 150 * n * (n - 1);
export function levelOf(xp){ let n = 1; while (levelFloor(n + 1) <= xp) n++; return n; }

// Une séance compte si elle est terminée avec au moins une série validée ou un exercice coché
const counts = w => w.status === 'terminée' && Object.keys(w.ex || {}).some(k => w.ex[k].done || (w.ex[k].sets || []).some(s => s.done));
let cache = { docs:null, rev:-1, day:'', val:null };
// État du jeu : { total, level, from, to (XP du niveau et du suivant), parts : { sessions, regular, records, blocks } chacun { n, xp },
// bySession : { id de séance : XP gagnée }, weeks : séances par semaine (lundi → nombre de jours avec séance) }
export function xpState(){
  if (cache.docs === S.docs && cache.rev === S.rev && cache.day === today()) return cache.val;
  const bySession = {}; const weeks = {}; const days = new Set();
  const parts = { sessions:{ n:0, xp:0 }, regular:{ n:0, xp:0 }, records:{ n:0, xp:0 }, blocks:{ n:0, xp:0 } };
  const add = (part, id, xp) => { parts[part].n++; parts[part].xp += xp; if (id) bySession[id] = (bySession[id] || 0) + xp; };
  workouts().filter(counts).forEach(w => {
    if (days.has(w.date)) return; days.add(w.date);
    add('sessions', w.id, XP.session);
    const m = mondayOf(w.date); weeks[m] = (weeks[m] || 0) + 1;
    if (weeks[m] > 1 && weeks[m] <= 6) add('regular', w.id, XP.regular);
  });
  const perW = {};
  recordLog().forEach(r => { perW[r.w] = (perW[r.w] || 0) + 1; if (perW[r.w] <= XP.recordsMax) add('records', r.w, XP.record); });
  const cur = weekInfo(today()).block;
  for (let b = 1; b < cur; b++) { const g = blockRange(b); if (g && new Set([...days].filter(d => d >= g.from && d <= g.to).map(mondayOf)).size >= 4) add('blocks', null, XP.block); }
  const total = parts.sessions.xp + parts.regular.xp + parts.records.xp + parts.blocks.xp; const level = levelOf(total);
  cache = { docs:S.docs, rev:S.rev, day:today(), val:{ total, level, from:levelFloor(level), to:levelFloor(level + 1), parts, bySession, weeks } };
  return cache.val;
}
// Plus longue suite de semaines voisines avec au moins 2 séances
function streak(weeks){
  let best = 0, run = 0, prev = null;
  Object.keys(weeks).sort().forEach(m => { if (weeks[m] < 2) { run = 0; prev = m; return; } run = prev && (Date.parse(m) - Date.parse(prev)) < 8 * 86400000 && run ? run + 1 : 1; prev = m; best = Math.max(best, run); });
  return best;
}
// Badges : { id, name, how (ce qu'il faut faire), got }
export function badges(){
  const x = xpState(); const s = x.parts.sessions.n; const r = recordLog().length;
  return [
    { id:'first', name:'Première séance', how:'Termine une séance', got: s >= 1 },
    { id:'s10', name:'10 séances', how:'Termine 10 séances', got: s >= 10 },
    { id:'s50', name:'50 séances', how:'Termine 50 séances', got: s >= 50 },
    { id:'s100', name:'100 séances', how:'Termine 100 séances', got: s >= 100 },
    { id:'rec1', name:'Premier record', how:'Bats ta meilleure série sur un exercice', got: r >= 1 },
    { id:'rec25', name:'25 records', how:'Bats 25 records', got: r >= 25 },
    { id:'streak4', name:'4 semaines d’affilée', how:'Au moins 2 séances par semaine, 4 semaines de suite', got: streak(x.weeks) >= 4 },
    { id:'block1', name:'Premier bloc', how:'Va au bout d’un bloc de 6 semaines', got: x.parts.blocks.n >= 1 }
  ];
}
