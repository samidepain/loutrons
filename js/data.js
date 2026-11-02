// Accès aux données : réglages, exercices, séances modèles, planning, historique.
import { addDays, capFirst, clone, daysBetween, e1rm, lowFirst, mondayOf, norm, num, parseIso, today } from './util.js';
import { ALIAS, BASE_EX, BASE_TPL, DAY_NOTES, DAY_ORDER, M, PROGRAMS } from './library.js';
import { put, S } from './store.js';

export function settings(){ return S.docs.get('settings') || {}; }
export function putSettings(patch){ put('settings', Object.assign({}, settings(), { start: startDate() }, patch)); }
// Options désactivées au départ, activables dans le profil
export const mods = () => settings().modules || {};
export const kneeOn = () => !!mods().knee, jumpsOn = () => !!mods().jumps, sportOn = () => !!mods().sport;
export function sportInfo(){ const s = settings().sport || {}; return { name: String(s.name || '').trim() || 'Sport', train: s.train || [], match: s.match || [] }; }
export function programOf(){ return settings().program || null; }
export function needsSetup(){ return S.loaded && !programOf(); }
export function excluded(){ return settings().excluded || []; }
// Rappel de sauvegarde : 2 semaines après le dernier export JSON, ou après le début si aucun export. Seulement s'il y a des séances.
export function backupDue(){
  const ws = workouts(); if (!ws.length) return false;
  const s = settings(); const ref = s.lastExport || [s.created, ws[0].date].filter(Boolean).sort()[0];
  return daysBetween(ref, today()) >= 14;
}
// Données d'avant les programmes au choix (export version 2 ou plus ancien) : l'appli n'avait alors qu'un programme.
// On complète les réglages pour que tout reste comme avant, sans rien effacer.
export function upgradeLegacy(){
  if (programOf() || !S.docs.size) return;
  const s = settings(); const plan = s.plan && typeof s.plan === 'object' ? s.plan : null;
  const daysWith = f => DAY_ORDER.filter(wd => plan[wd] && f(plan[wd]));
  // Le basket du lundi n'apparaissait que dans la note du jour, tant que le lundi gardait Upper A
  const train = plan ? daysWith(d => d.label === 'Basket') : [1,4];
  if (plan && plan[1] && plan[1].s === 'UA' && train.indexOf(1) < 0) train.unshift(1);
  put('settings', Object.assign({}, s, { start: startDate(),
    program:{ base:'exemple', name:PROGRAMS.exemple.name, days: plan ? daysWith(d => d.s) : PROGRAMS.exemple.days.slice() },
    modules:{ knee:true, jumps:true, sport:true },
    sport:{ name:'Basket', train, match: plan ? daysWith(d => d.label === 'Match') : [6] },
    excluded: s.excluded || ['lib_bulgarian'] }));
}
export function canon(id){ return ALIAS[id] || id; }
function cueOf(base){
  if (kneeOn() && base.cueKnee) return base.cueKnee;
  if (sportOn() && base.cueSport) return base.cueSport.replace('{sport}', lowFirst(sportInfo().name));
  return base.cue || '';
}
export function exDef(id){
  id = canon(id);
  const base = BASE_EX[id]; const ov = S.docs.get('x_' + id);
  if (!base && !ov) return null;
  const e = Object.assign({ id, sets:3, lo:8, hi:12, rest:90, step:2.5, cat:'iso', muscles:M() }, base || {}, ov || {});
  if (base && !(ov && ov.cue != null)) e.cue = cueOf(base);
  delete e.cueKnee; delete e.cueSport;
  e.custom = !base;
  if (!e.muscles) e.muscles = M();
  return e;
}
export function allEx(){
  const ids = new Set(Object.keys(BASE_EX));
  S.docs.forEach((o, id) => { if (id.indexOf('x_') === 0) ids.add(id.slice(2)); });
  return [...ids].map(exDef).filter(e => e && !e.deleted).sort((a, b) => a.name.localeCompare(b.name, 'fr'));
}
// Exercices proposés dans les listes de choix : sans les exercices masqués, ni les sauts si le module détente est désactivé
export function offeredEx(){ const hid = excluded(); return allEx().filter(e => hid.indexOf(e.id) < 0 && (jumpsOn() || e.kind !== 'plyo')); }
// Recherche d'exercice tolérante : accents, majuscules, pluriels et ponctuation ignorés ; chaque mot cherché doit
// commencer un mot du nom, d'un autre nom (aka) ou d'un muscle. Ordre : nom qui commence par la recherche, puis nom, autres noms, muscles.
export function searchEx(list, q){
  const words = norm(q).split(' ').filter(Boolean).map(w => w.length > 3 && w.slice(-1) === 's' ? w.slice(0, -1) : w);
  if (!words.length) return list;
  const hit = (txt, w) => { const t = norm(txt); return t.split(' ').some(x => x.indexOf(w) === 0) || (w.length >= 4 && t.replace(/ /g, '').indexOf(w) >= 0); };
  const all = (txt) => words.every(w => hit(txt, w));
  return list.map(e => {
    const ms = e.muscles || M(); const aka = (e.aka || []).join(' ');
    const rank = norm(e.name).indexOf(norm(q)) === 0 ? 4 : all(e.name) ? 3 : all(e.name + ' ' + aka) ? 2
      : all(e.name + ' ' + aka + ' ' + (ms.p || []).join(' ')) ? 1 : all(e.name + ' ' + aka + ' ' + (ms.p || []).concat(ms.s || []).join(' ')) ? 0 : -1;
    return { e, rank };
  }).filter(x => x.rank >= 0).sort((a, b) => b.rank - a.rank || a.e.name.localeCompare(b.e.name, 'fr')).map(x => x.e);
}
const isPlyo = it => { const e = exDef(it.ex); return !!e && e.kind === 'plyo'; };
export function tplDef(id){
  const ov = S.docs.get('p_' + id); const base = BASE_TPL[id];
  if (ov) return Object.assign({ id, builtin: !!base, edited: !!base }, clone(ov));
  if (!base) return null;
  const t = Object.assign({ id, builtin:true, edited:false }, clone(base));
  if (!jumpsOn()) { t.items = t.items.filter(it => !isPlyo(it)); t.focus = t.focusNoJump || t.focus; t.cut = t.cutNoJump || t.cut; }
  delete t.focusNoJump; delete t.cutNoJump;
  return t;
}
// Séances du programme actif, puis séances créées par la personne
export function allTpl(){
  const g = programOf(); const ids = g && PROGRAMS[g.base] ? PROGRAMS[g.base].tpls.slice() : [];
  S.docs.forEach((o, id) => { const k = id.slice(2); if (id.indexOf('p_') === 0 && !BASE_TPL[k] && ids.indexOf(k) < 0) ids.push(k); });
  return ids.map(tplDef).filter(t => t && !t.deleted);
}
// Exercices réellement faits : sans les sauts si le module détente est désactivé
export function tplItems(t){ return (t.items || []).filter(it => jumpsOn() || !isPlyo(it)); }
export function tplLower(t){ return tplItems(t).some(it => { const e = exDef(it.ex); return e && (e.knee || e.cat === 'lower' || e.kind === 'plyo'); }); }
export function tplEst(t){
  let sec = 0;
  tplItems(t).forEach(it => { const e = exDef(it.ex); if (!e) return;
    if (e.kind === 'check') { sec += 480; return; }
    const sets = it.sets || e.sets || 3;
    if (e.kind === 'plyo') { sec += sets * 75; return; }
    const rest = it.rest || e.rest || 90; const work = (e.uni ? 2 : 1) * 45;
    sec += sets * (work + (it.ss ? rest / 2 + 20 : rest)) + 60;
  });
  return Math.round(sec / 60);
}
// Répartit les séances du programme sur les jours choisis, dans l'ordre de la semaine
export function buildPlan(base, days){
  const ids = PROGRAMS[base] ? PROGRAMS[base].tpls : []; const p = {}; let i = 0;
  DAY_ORDER.forEach(wd => { p[wd] = days.indexOf(wd) >= 0 && ids.length ? { s: ids[i++ % ids.length] } : { label:'Repos' }; });
  return p;
}
export function planOf(){ const p = settings().plan; if (p && typeof p === 'object') return p; const g = programOf(); return g ? buildPlan(g.base, g.days || []) : {}; }
export function planDay(wd){
  const p = planOf()[wd] || {}; let label = 'Repos';
  if (sportOn()) { const sp = sportInfo(); if (sp.match.indexOf(wd) >= 0) label = 'Match'; else if (sp.train.indexOf(wd) >= 0) label = capFirst(sp.name); }
  return { s: p.s && tplDef(p.s) ? p.s : null, label, note: dayNote(wd) };
}
function dayNote(wd){
  const g = programOf(); if (!g || g.base !== 'exemple' || !sportOn()) return '';
  const sp = sportInfo(); const same = (a, b) => a.slice().sort().join() === b.slice().sort().join();
  if (!same(sp.train, [1,4]) || !same(sp.match, [6])) return '';
  const p = planOf()[wd] || {}; const def = buildPlan('exemple', PROGRAMS.exemple.days)[wd];
  return (p.s || null) === (def.s || null) ? DAY_NOTES[wd].replace('{Sport}', capFirst(sp.name)) : '';
}
export function workouts(){
  const out = [];
  S.docs.forEach((o, id) => { if (id.indexOf('w_') === 0) out.push(Object.assign({}, o, { id })); });
  return out.sort((a, b) => a.date === b.date ? (a.startedAt || 0) - (b.startedAt || 0) : (a.date < b.date ? -1 : 1));
}
export function wName(w){ return w.name || (BASE_TPL[w.sess] ? BASE_TPL[w.sess].name : (w.sess || 'Séance')); }
export function itemsOf(w){
  if (w.items) return w.items;
  return Object.keys(w.ex || {}).map(k => { const e = exDef(k); return Object.assign(e ? snapItem(e, {}) : { name:k, kind:'load', sets:3, lo:8, hi:12 }, { ex:k }); });
}
export function snapItem(e, it){
  return { ex:e.id, name:e.name, kind:e.kind, cat:e.cat || 'iso', step:e.step || 2.5,
    sets: it.sets || e.sets || 3, lo: it.lo || e.lo || 8, hi: it.hi || e.hi || 12, rest: it.rest || e.rest || 90,
    ss: it.ss || null, unit:e.unit || '', uni:!!e.uni, knee:!!e.knee, optional:!!e.optional, muscles:e.muscles || M() };
}
export function startDate(){ const s = settings(); if (s.start) return s.start; const w = workouts(); return mondayOf(w.length ? w[0].date : today()); }
export function weekInfo(dateIso){
  const st = startDate();
  const n = Math.max(1, Math.floor(daysBetween(st, dateIso) / 7) + 1);
  const bw = ((n - 1) % 6) + 1; const wk = mondayOf(dateIso); const s = settings();
  const forced = !!(s.deload && s.deload[wk]); const busy = sportOn() && jumpsOn() && !!(s.busy && s.busy[wk]);
  return { n, bw, block: Math.floor((n - 1) / 6) + 1, deload: bw === 6 || forced, forced, busy, wk };
}
export function weekGoal(w){
  if (w.deload) return { t:'Décharge', d:(w.forced ? 'Décharge anticipée. ' : '') + 'Mêmes charges, environ 1/3 de séries en moins, 3-4 reps en réserve' + (jumpsOn() ? ', moitié des sauts' : '') + '. Tu récupères pour repartir plus fort au bloc suivant.' };
  if (w.bw === 1) return w.block === 1
    ? { t:'Calibration', d:'Première semaine : trouve tes charges de travail en gardant 2-3 reps en réserve et note tes reps en réserve. L’appli calcule ensuite tes objectifs.' }
    : { t:'Reprise', d:'Retour après la décharge : reprends les charges de ta dernière semaine de progression, avec 2 reps en réserve.' };
  if (w.bw === 5) return { t:'Fin de bloc', d:'Dernière semaine de progression avant la décharge : vise 1 rep en réserve' + (kneeOn() ? ', sauf sur les exercices qui sollicitent le genou (2 en réserve).' : '.') };
  return { t:'Progression', d:'Suis l’objectif de chaque exercice : reps en plus ou nouvelle charge, selon tes reps en réserve de la dernière fois.' };
}
export function kneeEntries(){
  const out = [];
  S.docs.forEach((o, id) => {
    if (id.indexOf('k_') === 0 && o.stairs != null) out.push({ date:o.date, v:o.stairs, src:'stairs' });
    if (id.indexOf('w_') === 0 && o.knee != null) out.push({ date:o.date, v:o.knee, src:'session' });
  });
  return out.sort((a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : 0);
}
export function kneeAlert(){ if (!kneeOn()) return false; const lim = addDays(today(), -10); return kneeEntries().some(k => k.date >= lim && k.v > 3); }
export function bodyDocs(){ const out = []; S.docs.forEach((o, id) => { if (id.indexOf('b_') === 0) out.push(Object.assign({ id }, o)); }); return out.sort((a, b) => a.date < b.date ? -1 : 1); }
export function bodyweight(){ const b = bodyDocs().filter(x => num(x.weight) > 0); return b.length ? num(b[b.length - 1].weight) : null; }
export function validSets(arr){ return (arr || []).filter(s => s && s.done && num(s.reps) > 0); }
export function history(exId, excludeId){
  const id = canon(exId); const out = [];
  workouts().forEach(w => {
    if (w.id === excludeId || !w.ex) return;
    Object.keys(w.ex).forEach(k => {
      if (canon(k) !== id) return;
      const vs = validSets(w.ex[k].sets); if (!vs.length) return;
      out.push({ date:w.date, at:w.startedAt || 0, deload:!!w.deload, rir: w.ex[k].rir == null ? null : w.ex[k].rir, sets: vs.map(s => ({ kg: num(s.kg) || 0, reps: num(s.reps) })) });
    });
  });
  return out.sort((a, b) => a.date === b.date ? b.at - a.at : (a.date < b.date ? 1 : -1));
}
export const maxKg = h => Math.max.apply(null, h.sets.map(s => s.kg));
export const topSets = h => { const k = maxKg(h); return h.sets.filter(s => s.kg === k); };
export function activeWorkout(){
  let w = null;
  S.docs.forEach((o, id) => { if (id.indexOf('w_') === 0 && o.status === 'en_cours' && (!w || (o.startedAt || 0) > (w.startedAt || 0))) w = Object.assign(o, { id }); });
  return w;
}
// Une journée pour le calendrier : séances faites, séance en cours, et séance prévue (aujourd'hui et après seulement)
export function daySummary(day){
  const ws = workouts().filter(w => w.date === day);
  const done = ws.filter(w => w.status === 'terminée'); const active = ws.find(w => w.status === 'en_cours') || null;
  const future = day >= today(); const p = planDay(parseIso(day).getDay());
  return { date: day, done, active, planned: future && !done.length && !active && p.s ? p.s : null, label: future ? p.label : 'Repos', acts: activities(day) };
}
// Activités notées un jour donné (course, vélo…), dans l'ordre où elles ont été ajoutées
export function activities(day){
  const out = []; S.docs.forEach((o, id) => { if (id.indexOf('a_') === 0 && o.date === day) out.push(Object.assign({ id }, o)); });
  return out.sort((a, b) => (a.at || 0) - (b.at || 0));
}
export function countSets(w){ let n = 0; Object.keys(w.ex || {}).forEach(id => { n += validSets(w.ex[id].sets).length; }); return n; }
export function musclesOf(key, w){
  const e = exDef(key); if (e && e.muscles) return e.muscles;
  const it = w && (w.items || []).find(x => x.ex === key); return it && it.muscles ? it.muscles : M();
}
export function kindOf(key, w){ const e = exDef(key); if (e) return e.kind; const it = w && (w.items || []).find(x => x.ex === key); return it ? it.kind : 'load'; }
function testsList(){ const t = []; S.docs.forEach((o, id) => { if (id.indexOf('t_') === 0) t.push(Object.assign({ id }, o)); }); return t.sort((a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : 0); }
export function blockRange(block){ const from = addDays(startDate(), (block - 1) * 42); return { from, to: addDays(from, 41) }; }
export function testForBlock(block){ if (block < 1) return null; const r = blockRange(block); return testsList().filter(t => t.date >= r.from && t.date <= r.to).pop() || null; }
export function testDue(dateIso){ const wk = weekInfo(dateIso); return wk.bw === 6 && !testForBlock(wk.block); }
function totFor(exId, kg){ const e = exDef(exId); return e && e.kind === 'bw' ? (bodyweight() || 0) + kg : kg; }
export function bestE1(exId, h){ return Math.max.apply(null, h.sets.map(s => e1rm(totFor(exId, s.kg), s.reps))); }
export function saveTpl(t){
  const data = { name:t.name, focus:t.focus || '', cut:t.cut || '', items:t.items.map(it => { const o = { ex:it.ex }; ['sets','lo','hi','rest'].forEach(k => { if (num(it[k]) > 0) o[k] = num(it[k]); }); if (it.ss) o.ss = it.ss; return o; }) };
  put('p_' + t.id, data);
}
