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
// Temps estimé d'une séance, en minutes. Par exercice : séries (45 s d'effort, ou 2 × 45 s en unilatéral) et repos,
// plus 2 min pour s'installer et changer de machine (1 min pour le 2e exercice d'un superset, à côté),
// plus 4 min de montée en charge sur les gros exercices à la charge. Règles de l'appli.
export const SETUP_SEC = 120, WARMUP_SEC = 240;
export function tplEst(t){
  let sec = 0;
  tplItems(t).forEach(it => { const e = exDef(it.ex); if (!e) return;
    if (e.kind === 'check') { sec += 480; return; }
    if (e.kind === 'cardio') { sec += (num(it.lo) || num(e.lo) || 20) * 60 + SETUP_SEC / 2; return; }
    const sets = num(it.sets) || num(e.sets) || 3;
    if (e.kind === 'plyo') { sec += sets * 75 + SETUP_SEC / 2; return; }
    const rest = num(it.rest) || num(e.rest) || 90; const work = (e.uni ? 2 : 1) * 45;
    sec += sets * (work + (it.ss ? rest / 2 + 20 : rest)) + (it.ss ? SETUP_SEC / 2 : SETUP_SEC);
    if (e.kind === 'load' && (e.cat === 'lower' || e.cat === 'upper')) sec += WARMUP_SEC;
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
// Semaines variables (version 2.13) : une rotation de séances et un objectif par semaine remplacent les jours fixes.
// Séances du planning par jour d'avant (migration sans écriture) : ordre lundi → dimanche, sans doublon ni séance supprimée
const progIds = () => allTpl().map(t => t.id);
function planSessions(){ const p = planOf(); const ids = progIds(); const out = []; DAY_ORDER.forEach(wd => { const s = (p[wd] || {}).s; if (s && ids.indexOf(s) >= 0 && out.indexOf(s) < 0) out.push(s); }); return out; }
const planDays = () => { const p = planOf(); const ids = progIds(); return DAY_ORDER.filter(wd => { const s = (p[wd] || {}).s; return s && ids.indexOf(s) >= 0; }).length; };
// Rotation : ordre réglé (rotation) puis les séances non citées ; sinon le planning d'avant, sinon l'ordre du programme ; sans les séances mises de côté
export function rotationOf(){
  const s = settings(); const all = allTpl().map(t => t.id); const off = Array.isArray(s.rotOff) ? s.rotOff : [];
  let order;
  if (Array.isArray(s.rotation)) order = s.rotation.filter(id => all.indexOf(id) >= 0).concat(all.filter(id => s.rotation.indexOf(id) < 0));
  else { const fromPlan = planSessions(); order = fromPlan.length ? fromPlan : all; }
  return order.filter((id, i) => order.indexOf(id) === i && off.indexOf(id) < 0);
}
// Rotation d'un programme qu'on vient de choisir : ses séances dans l'ordre ; les séances créées restent de côté (programme créé : toutes)
export function programRotation(base){
  const prog = PROGRAMS[base] ? PROGRAMS[base].tpls.filter(id => { const t = tplDef(id); return t && !t.deleted; }) : [];
  const all = new Set(); Object.keys(PROGRAMS).forEach(k => PROGRAMS[k].tpls.forEach(id => all.add(id)));
  const own = []; S.docs.forEach((o, id) => { const k = id.slice(2); if (id.indexOf('p_') === 0 && !BASE_TPL[k] && !all.has(k) && !(o && o.deleted)) own.push(k); });
  return base && PROGRAMS[base] ? { rotation: prog, rotOff: own } : { rotation: own, rotOff: [] };
}
// Séance créée : à la fin de la rotation ; si la rotation est encore déduite du planning d'avant, elle est d'abord figée (null : rien à écrire)
export function rotationWith(id){
  if (Array.isArray(settings().rotation)) return null;
  const rot = rotationOf().filter(x => x !== id).concat([id]);
  return { rotation: rot, rotOff: allTpl().map(t => t.id).filter(x => rot.indexOf(x) < 0) };
}
// Objectif de la semaine (2 à 6 séances) : réglé, sinon le nombre de jours de séance du planning d'avant, sinon selon le programme
export function perWeekOf(){
  const s = settings(); const clampWeek = n => Math.max(2, Math.min(6, Math.round(n)));
  if (num(s.perWeek) != null) return clampWeek(num(s.perWeek));
  const n = planDays(); if (n) return clampWeek(n);
  const g = programOf(); return g && g.base === 'exemple' ? 4 : 3;
}
// Séance suivante : celle qui suit, dans la rotation, la dernière séance terminée de la rotation ; sinon la première
export function nextSession(){
  const rot = rotationOf(); if (!rot.length) return null;
  // séance modèle : tpl, ou sess pour les séances notées avec les premières versions
  const tplOf = w => w.tpl || w.sess;
  const done = workouts().filter(w => w.status === 'terminée' && rot.indexOf(tplOf(w)) >= 0); const last = done[done.length - 1];
  return last ? rot[(rot.indexOf(tplOf(last)) + 1) % rot.length] : rot[0];
}
// Séances terminées de la semaine (lundi à dimanche) du jour donné, et objectif
export function weekProgress(day){
  const from = mondayOf(day); const to = addDays(from, 6);
  return { done: workouts().filter(w => w.status === 'terminée' && w.date >= from && w.date <= to).length, target: perWeekOf() };
}
// Jours prévus à l'avance (facultatif) : aujourd'hui et après, triés
export function plannedDates(){
  const p = settings().planned; const d = today();
  return (Array.isArray(p) ? p : []).filter(x => typeof x === 'string' && x.length === 10 && x >= d).filter((x, i, a) => a.indexOf(x) === i).sort();
}
// Séances des jours prévus : la rotation répartie dans l'ordre des dates, à partir de la séance suivante (un jour déjà fait est sauté)
export function plannedSessions(){
  const rot = rotationOf(); const out = {}; if (!rot.length) return out;
  let i = Math.max(0, rot.indexOf(nextSession())); const ws = workouts();
  plannedDates().forEach(d => { if (ws.some(w => w.date === d && w.status === 'terminée')) return; out[d] = rot[i % rot.length]; i++; });
  return out;
}
// Faut-il venir ce jour-là ? Rien de fait ni en cours, et le jour est prévu, ou il reste autant de séances que de jours dans la semaine
export function needToday(day){
  if (!rotationOf().length || workouts().some(w => w.date === day && (w.status === 'terminée' || w.status === 'en_cours'))) return false;
  if (plannedDates().indexOf(day) >= 0) return true;
  const p = weekProgress(day); const left = p.target - p.done; const daysLeft = 7 - ((parseIso(day).getDay() + 6) % 7);
  return left > 0 && left >= daysLeft;
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
// Séance en cours : exercices ouverts (un groupe : un exercice seul ou un superset), série en cours, question des reps en réserve en attente.
// ui : { open: exercice ouvert à la main, ask: exercice qui attend ses reps en réserve }
export function sessionFocus(w, ui){
  const items = itemsOf(w); const u = ui || {}; const st = k => (w.ex || {})[k];
  const passed = it => !st(it.ex) || !!st(it.ex).skip;
  const finished = it => { const s = st(it.ex); if (!s) return false; return it.kind === 'check' ? !!s.done : s.sets.length > 0 && s.sets.every(x => x.done); };
  const groups = []; items.forEach(it => { const g = groups[groups.length - 1]; if (it.ss && g && g[0].ss === it.ss) g.push(it); else groups.push([it]); });
  const groupOf = k => groups.find(g => g.some(it => it.ex === k));
  const ask = u.ask && groupOf(u.ask) && finished(groupOf(u.ask).find(it => it.ex === u.ask)) ? u.ask : null;
  const g = ask ? groupOf(ask) : (u.open && groupOf(u.open)) || groups.find(gr => gr.some(it => !passed(it) && !finished(it)));
  if (!g) return { open: [], turn: null, ask: null };
  let turn = null;
  if (!ask) {
    const todo = g.filter(it => !passed(it) && !finished(it));
    const doneN = it => it.kind === 'check' ? 0 : st(it.ex).sets.filter(x => x.done).length;
    const next = todo.reduce((m, it) => !m || doneN(it) < doneN(m) ? it : m, null);
    if (next) turn = { ex: next.ex, i: next.kind === 'check' || next.kind === 'cardio' ? 0 : st(next.ex).sets.findIndex(x => !x.done) };
  }
  return { open: g.map(it => it.ex), turn, ask };
}
// Exercice qui viendra ensuite (pour le minuteur) : celui de la série en cours, sans tenir compte de la question des reps en réserve ;
// un exercice ouvert à la main et terminé est oublié, comme à l'écran
export function upNext(w, ui){
  let f = sessionFocus(w, { open: ui && ui.open }); if (!f.turn) f = sessionFocus(w, {});
  return f.turn ? itemsOf(w).find(it => it.ex === f.turn.ex) || null : null;
}
export function snapItem(e, it){
  return { ex:e.id, name:e.name, kind:e.kind, cat:e.cat || 'iso', step:e.step || 2.5,
    sets: it.sets || e.sets || 3, lo: it.lo || e.lo || 8, hi: it.hi || e.hi || 12, rest: it.rest || e.rest || 90,
    ss: it.ss || null, unit:e.unit || '', uni:!!e.uni, knee:!!e.knee, optional:!!e.optional, muscles:e.muscles || M() };
}
export function startDate(){ const s = settings(); if (s.start) return s.start; const w = workouts(); return mondayOf(w.length ? w[0].date : today()); }
// Blocs de 6 semaines et pauses (version 2.13). Départs (lundis) : début du programme, puis le lundi de la première séance terminée
// après plus de 14 jours sans séance terminée ; tant que la personne n'est pas revenue (dernière séance à plus de 14 jours), la semaine
// en cours est déjà un nouveau départ. Règle de terrain : la pause compte comme du repos, le bloc repart en semaine 1.
function startsAndLasts(){
  const st = startDate(); const starts = [st]; const lasts = [null];
  const ds = workouts().filter(w => w.status === 'terminée' && w.date >= st).map(w => w.date);
  ds.forEach((d, i) => {
    if (i && daysBetween(ds[i - 1], d) > 14) { const m = mondayOf(d); if (m > starts[starts.length - 1]) { starts.push(m); lasts.push(null); } }
    lasts[lasts.length - 1] = d;
  });
  const last = ds[ds.length - 1]; const t = today();
  if (last && daysBetween(last, t) > 14) { const m = mondayOf(t); if (m > starts[starts.length - 1]) { starts.push(m); lasts.push(null); } }
  return { starts, lasts };
}
export const blockStarts = () => startsAndLasts().starts;
// Blocs d'une période entre deux départs : jusqu'à sa dernière séance (des semaines de pause seules ne font pas un bloc), au moins un
const blocksIn = (start, last) => last ? Math.floor(daysBetween(start, last) / 42) + 1 : 1;
// Jours depuis la dernière séance terminée (au plus tard ce jour-là), ou null
export function lastSessionGap(day){
  const ds = workouts().filter(w => w.status === 'terminée' && w.date <= day).map(w => w.date);
  return ds.length ? daysBetween(ds[ds.length - 1], day) : null;
}
export function weekInfo(dateIso){
  const st = startDate();
  const n = Math.max(1, Math.floor(daysBetween(st, dateIso) / 7) + 1);
  const { starts, lasts } = startsAndLasts(); const wk = mondayOf(dateIso);
  let k = 0; starts.forEach((x, i) => { if (x <= wk) k = i; });
  let before = 0; for (let i = 0; i < k; i++) before += blocksIn(starts[i], lasts[i]);
  const off = Math.max(0, daysBetween(starts[k], dateIso)); const inSeg = Math.floor(off / 42);
  const bw = Math.floor(off / 7) % 6 + 1; const block = before + (k < starts.length - 1 ? Math.min(inSeg, blocksIn(starts[k], lasts[k]) - 1) : inSeg) + 1;
  const s = settings(); const forced = !!(s.deload && s.deload[wk]); const busy = sportOn() && jumpsOn() && !!(s.busy && s.busy[wk]);
  return { n, bw, block, deload: bw === 6 || forced, forced, busy, wk };
}
export function weekGoal(w){
  if (w.deload) return { t:'Décharge', d:(w.forced ? 'Décharge anticipée. ' : '') + 'Mêmes charges, environ 1/3 de séries en moins, 3-4 reps en réserve' + (jumpsOn() ? ', moitié des sauts' : '') + '. Tu récupères pour repartir plus fort au bloc suivant.' };
  if (w.bw === 1 && blockStarts().indexOf(w.wk) > 0) return { t:'Reprise', d:'Retour après une pause : les charges reprennent en douceur, exercice par exercice. Ton bloc repart en semaine 1.' };
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
  // Séance de salle prévue : aujourd'hui (jour prévu, ou objectif de la semaine pas atteint) et les jours prévus à l'avance
  let planned = null;
  if (future && !done.length && !active) planned = plannedSessions()[day] || (day === today() && weekProgress(day).done < perWeekOf() ? nextSession() : null);
  return { date: day, done, active, planned, label: future ? p.label : 'Repos', acts: activities(day) };
}
// Activités notées un jour donné (course, vélo…), dans l'ordre où elles ont été ajoutées
export function activities(day){
  const out = []; S.docs.forEach((o, id) => { if (id.indexOf('a_') === 0 && o.date === day) out.push(Object.assign({ id }, o)); });
  return out.sort((a, b) => (a.at || 0) - (b.at || 0));
}
// Famille d'une activité pour le calendrier : cardio, sports collectifs ou autre (la salle, ce sont les séances)
const CARDIO = ['run', 'bike', 'swim', 'walk'];
export const activityFamily = type => CARDIO.indexOf(type) >= 0 ? 'cardio' : type === 'sport' ? 'collectif' : 'autre';
// Familles d'un jour et leur état (en cours, fait, prévu), une entrée par famille, dans l'ordre salle, cardio, collectif, autre
const FAMS = ['salle', 'cardio', 'collectif', 'autre'];
const FORCE = { planned: 1, done: 2, active: 3 };
export function dayFamilies(day){
  const st = {}; const add = (f, s) => { if (!st[f] || FORCE[s] > FORCE[st[f]]) st[f] = s; };
  const s = daySummary(day);
  if (s.active) add('salle', 'active');
  if (s.done.length) add('salle', 'done');
  if (s.planned) add('salle', 'planned');
  s.acts.forEach(a => add(activityFamily(a.type), 'done'));
  // jours d'entraînement et de match du module sport, aujourd'hui ou plus tard
  if (sportOn() && day >= today()) { const wd = parseIso(day).getDay(); const sp = sportInfo(); if (sp.train.indexOf(wd) >= 0 || sp.match.indexOf(wd) >= 0) add('collectif', 'planned'); }
  return FAMS.filter(f => st[f]).map(f => ({ fam: f, state: st[f] }));
}
export function countSets(w){ let n = 0; Object.keys(w.ex || {}).forEach(id => { n += validSets(w.ex[id].sets).length; }); return n; }
export function musclesOf(key, w){
  const e = exDef(key); if (e && e.muscles) return e.muscles;
  const it = w && (w.items || []).find(x => x.ex === key); return it && it.muscles ? it.muscles : M();
}
export function kindOf(key, w){ const e = exDef(key); if (e) return e.kind; const it = w && (w.items || []).find(x => x.ex === key); return it ? it.kind : 'load'; }
function testsList(){ const t = []; S.docs.forEach((o, id) => { if (id.indexOf('t_') === 0) t.push(Object.assign({ id }, o)); }); return t.sort((a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : 0); }
// Dates d'un bloc : 42 jours depuis le départ de sa période, coupés au départ suivant ; les numéros continuent d'une période à l'autre
export function blockRange(block){
  const { starts, lasts } = startsAndLasts(); let b = 1;
  for (let i = 0; i < starts.length; i++) {
    const nb = i < starts.length - 1 ? blocksIn(starts[i], lasts[i]) : Infinity;
    if (block < b + nb) { const from = addDays(starts[i], (block - b) * 42); let to = addDays(from, 41); if (i < starts.length - 1 && to >= starts[i + 1]) to = addDays(starts[i + 1], -1); return { from, to }; }
    b += nb;
  }
  const from = addDays(startDate(), (block - 1) * 42); return { from, to: addDays(from, 41) };
}
export function testForBlock(block){ if (block < 1) return null; const r = blockRange(block); return testsList().filter(t => t.date >= r.from && t.date <= r.to).pop() || null; }
export function testDue(dateIso){ const wk = weekInfo(dateIso); return wk.bw === 6 && !testForBlock(wk.block); }
function totFor(exId, kg){ const e = exDef(exId); return e && e.kind === 'bw' ? (bodyweight() || 0) + kg : kg; }
export function bestE1(exId, h){ return Math.max.apply(null, h.sets.map(s => e1rm(totFor(exId, s.kg), s.reps))); }
export function saveTpl(t){
  const data = { name:t.name, focus:t.focus || '', cut:t.cut || '', items:t.items.map(it => { const o = { ex:it.ex }; ['sets','lo','hi','rest'].forEach(k => { if (num(it[k]) > 0) o[k] = num(it[k]); }); if (it.ss) o.ss = it.ss; return o; }) };
  put('p_' + t.id, data);
}
