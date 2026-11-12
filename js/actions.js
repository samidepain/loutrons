// Actions de l’interface : clics, saisies et changements.
import { $, addDays, addMonths, capFirst, clone, fmtDate, fmtInt, fmtKg, mondayOf, nbsp, num, rid, stepValue, toast, today, toggleIn, withDot } from './util.js';
import { DAY_ORDER, PROGRAMS } from './library.js';
import { del, put, S } from './store.js';
import { activeWorkout, allTpl, bodyweight, buildPlan, canon, excluded, exDef, itemsOf, mods, needsSetup, normSS, planOf, programOf, programRotation, putSettings, rotationOf, rotationWith, saveTpl, sessionFocus, settings, snapItem, sportInfo, tplDef, tplEst, tplItems, tplLower, toggleLink, upgradeLegacy, upNext, weekInfo } from './data.js';
import { findPRs, initItem, prSet } from './engine.js';
import { downloadFile, exportFile, importable, useShare } from './backup.js';
import { requestWake, startRest, stopRest, unlockAudio, updateRest } from './timers.js';
import { applyTheme, render } from './render.js';
import { screenOf } from './nav.js';
import { pickerList } from './views/picker.js';
import { exerciseList } from './views/program.js';
import { newSetup } from './views/setup.js';
import { blankEx } from './views/editors.js';
import { checkDue, nutritionOf, profileData, setupData } from './views/goal.js';
import { planFor } from './nutrition.js';
import { copyEntries, dayDoc, freshFood, fromOff, habitualFoods, mealLabel, MEALS, recentFoods, validBarcode } from './food.js';
import { convText, foodFromDoc, foodList, preview, recList, recPreview, recShown, shown } from './views/food.js';
import { ownRecipe } from './recipes.js';
import { gramsOf, measuresFor } from './measures.js';
import { activityKcal, choiceOf, computeSessionKcal, EFFORT, glassOf, LEVELS, sportOf, WATER_RANGE, waterOf } from './energy.js';
import { actDoc, actPreview, liters } from './views/activity.js';

// Supprime une séance perso (jamais une séance de base) et la retire de la rotation et du planning ; faux si elle n'existe pas ou est de base
function deleteTpl(id){
  const t = tplDef(id); if (!t || t.builtin) return false;
  del('p_' + id); const st = settings();
  if (Array.isArray(st.rotation) || Array.isArray(st.rotOff)) putSettings({ rotation: (st.rotation || []).filter(x => x !== id), rotOff: (st.rotOff || []).filter(x => x !== id) });
  const p = Object.assign({}, planOf()); let ch = false; Object.keys(p).forEach(k => { if (p[k] && p[k].s === id) { p[k] = { label:'Repos' }; ch = true; } }); if (ch) putSettings({ plan:p });
  return true;
}

function startWorkout(tplId){
  if (!S.loaded) return;
  S.day = null;
  if (activeWorkout()) { S.view = 'training'; render(); return; }
  const t = tplDef(tplId); if (!t) return;
  const date = today(); const wk = weekInfo(date);
  if (!settings().start) putSettings({});
  const id = 'w_' + date.replace(/-/g, '') + '_' + rid();
  const items = tplItems(t).map(it => { const e = exDef(it.ex); return e ? snapItem(e, it) : null; }).filter(Boolean);
  const w = { date, tpl:tplId, name:t.name, cut:t.cut || '', lower:tplLower(t), est:tplEst(t), status:'en_cours', startedAt:Date.now(), week:wk.n, blockWeek:wk.bw, deload:wk.deload, items, ex:{}, targets:{} };
  items.forEach(it => initItem(w, it, wk));
  put(id, w);
  S.view = 'training'; S.summary = null; S.picker = null; S.draft = null; S.navHint = 'up'; resetSession();
  render(); window.scrollTo(0, 0); requestWake();
}
function finishWorkout(){
  const w = activeWorkout(); if (!w) return;
  w.status = 'terminée'; w.endedAt = Date.now(); w.duration = Math.round((w.endedAt - w.startedAt) / 60000);
  w.effort = 'classic'; w.kcal = computeSessionKcal(w, bodyweight());
  put(w.id, w);
  // Écran de fin de séance (fenêtre qui monte) ; son entrée animée ne se joue qu'une fois
  S.summary = { id:w.id, prs: findPRs(w), screen:true, enter:true }; resetSession();
  stopRest(); S.view = 'today'; render(); window.scrollTo(0, 0); S.summary.enter = false;
}
// Point toutes les 2 semaines : la réponse est gardée dans l'historique ; « Passer à … » corrige les besoins
function recordCheck(status, applied){
  const c = checkDue(); if (!c) { render(); return; }
  const n = Object.assign({}, nutritionOf()); const r2 = x => Math.round(x * 100) / 100;
  const rec = { date: today(), status: status || c.status, applied: !!applied };
  if (c.actual != null) Object.assign(rec, { actual: r2(c.actual), planned: r2(c.planned) });
  if (c.change) rec.change = c.change;
  if (applied && c.status === 'change') n.adjust = c.adjust;
  n.checks = (n.checks || []).concat([rec]).slice(-12);
  S.adjOk = false; putSettings({ nutrition: n }); render();
}
function addWater(ml){
  const d = today(); const v = Math.max(0, waterOf(d) + ml);
  put('e_' + d, { date:d, ml:v }); render();
}
function applyPick(exId){
  const P = S.picker; if (!P) return;
  const e = exDef(exId); if (!e) return;
  if (P.mode === 'draft') {
    if (S.draft && S.draft.kind === 'tpl') S.draft.data.items.push({ ex:e.id, sets:e.sets, lo:e.lo, hi:e.hi, rest:e.rest, ss:null });
    S.picker = null; render(); return;
  }
  const w = activeWorkout(); if (!w) { S.picker = null; render(); return; }
  if (w.ex[e.id]) { toast('Cet exercice est déjà dans la séance.'); return; }
  if (!w.items) w.items = itemsOf(w).slice();
  const wk = weekInfo(w.date);
  if (P.mode === 'add') {
    const it = snapItem(e, {}); w.items.push(it); initItem(w, it, wk);
    toast(e.name + ' ajouté.');
  } else {
    const old = w.items[P.idx]; if (!old) return;
    const it = snapItem(e, { sets: old.sets, ss: old.ss });
    w.items[P.idx] = it; delete w.ex[old.ex]; delete w.targets[old.ex]; initItem(w, it, wk);
    // L'exercice ouvert à la main reste ouvert sous son nouveau nom
    if (S.sessOpen === old.ex) S.sessOpen = it.ex; if (S.rirAsk === old.ex) S.rirAsk = null; if (S.setEdit && S.setEdit.ex === old.ex) S.setEdit = null;
    if (P.alsoTpl && w.tpl) {
      const t = tplDef(w.tpl);
      if (t) { const j = t.items.findIndex(x => canon(x.ex) === canon(old.ex)); if (j >= 0) { t.items[j] = { ex:e.id, sets:t.items[j].sets, lo:e.lo, hi:e.hi, rest:e.rest, ss:t.items[j].ss || null }; saveTpl(t); } }
    }
    toast(old.name + ' remplacé par ' + e.name + (P.alsoTpl ? ' (aussi dans la séance modèle).' : '.'));
  }
  put(w.id, w); S.picker = null; render();
}
function setField(t){
  const w = activeWorkout(); if (!w) return;
  const f = t.dataset.f;
  if (f === 'notes') w.notes = t.value;
  else { const st = w.ex[t.dataset.ex]; const s = st && st.sets[+t.dataset.i]; if (!s) return; s[f] = t.value; }
  put(w.id, w);
}
// État de l'écran de séance, remis à zéro au début, à la fin et à l'abandon d'une séance
// Rotation figée : l'ordre actuel et les séances hors rotation (une séance non citée entrerait sinon d'elle-même dans la rotation)
function frozenRot(){ const rot = rotationOf(); return { rotation: rot.slice(), rotOff: allTpl().map(t => t.id).filter(id => rot.indexOf(id) < 0) }; }
function moveRot(id, dir){ const f = frozenRot(); const i = f.rotation.indexOf(id); const j = i + dir; if (i < 0 || j < 0 || j >= f.rotation.length) return; f.rotation[i] = f.rotation[j]; f.rotation[j] = id; putSettings(f); render(); }
function resetSession(){ S.sessOpen = null; S.rirAsk = null; S.setEdit = null; S.move = null; }
const lessMotion = () => window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
// Après une validation ou l'ouverture d'un exercice : la série en cours (#cur) reste visible entre l'en-tête de la séance et le minuteur
function showCurrent(){
  const c = document.getElementById('cur'); if (!c) return;
  const r = c.getBoundingClientRect(); const bar = document.querySelector('#restbar:not([hidden]) .restbar-in') || document.querySelector('.tabs');
  const lo = (bar ? bar.getBoundingClientRect().top : innerHeight) - 8; const hi = stickyBottom() + 8;
  let dy = 0; if (r.bottom > lo) dy = r.bottom - lo; if (r.top - dy < hi) dy = r.top - hi;
  if (Math.abs(dy) > 1) window.scrollBy({ top: dy, behavior: lessMotion() ? 'auto' : 'smooth' });
}
// Exercice ouvert à la main et terminé (question des reps en réserve réglée) : on l'oublie, le suivant s'ouvre
function forgetOpen(w){ if (S.sessOpen && !S.rirAsk && !sessionFocus(w, { open:S.sessOpen }).turn) S.sessOpen = null; }
// Réponse à la question des reps en réserve, ou « Passer » (v = null)
function answerRir(key, v){ const w = activeWorkout(); if (!w || !w.ex[key]) return; if (v != null) w.ex[key].rir = v; S.rirAsk = null; S.setEdit = null; forgetOpen(w); put(w.id, w); render(); showCurrent(); }
// Exercice à la charge ou au poids du corps qui vient de se terminer sans reps en réserve notées : on pose la question
function askRir(it, st){ if ((it.kind === 'load' || it.kind === 'bw') && st.rir == null && st.sets.length && st.sets.every(x => x.done)) S.rirAsk = it.ex; }
// Bas des en-têtes collés en haut (barre de l'appli, et en-tête de la séance sauf sur les écrans peu hauts)
const stickyBottom = () => Math.max(0, ...[...document.querySelectorAll('.top, .sess-head')].filter(e => getComputedStyle(e).position === 'sticky').map(e => e.getBoundingClientRect().bottom));
// Exercice ouvert à la main : son haut sous l'en-tête de la séance
function showOpen(key){
  const c = [...document.querySelectorAll('.card.ex.open')].find(x => x.dataset.ex === key); if (!c) return;
  const box = c.closest('.group') || c;
  const dy = box.getBoundingClientRect().top - stickyBottom() - 8;
  if (Math.abs(dy) > 1) window.scrollBy({ top: dy, behavior: lessMotion() ? 'auto' : 'smooth' });
}
function supersetNext(w, key){ const items = itemsOf(w); const i = items.findIndex(x => x.ex === key); const it = items[i]; const nx = items[i + 1]; return it && it.ss && nx && nx.ss === it.ss ? nx : null; }
const bodyTimers = {};
// Champs facultatifs du profil : vides, ou plausibles
function profileError(f, v){
  if (v == null || String(v).trim() === '') return '';
  if (f === 'height') { const n = num(v); return n != null && n >= 100 && n <= 250 ? '' : 'Indique ta taille en cm, par exemple 178.'; }
  if (f === 'weight') { const n = num(v); return n != null && n >= 25 && n <= 350 ? '' : 'Indique ton poids en kg, par exemple 72,5.'; }
  if (f === 'birth') return /^\d{4}-\d{2}-\d{2}$/.test(v) && v >= '1900-01-01' && v <= today() ? '' : 'Vérifie ta date de naissance.';
  return '';
}
// Pesée du jour, comme dans « Corps et sommeil »
function saveWeight(kg){ const d = today(); put('b_' + d, Object.assign({ date:d }, S.docs.get('b_' + d) || {}, { weight:kg })); }
// Programme choisi à l'écran 2 de l'accueil (ou au changement de programme) : [message, champ] si incomplet
function progError(U){
  if (!U.prog) return ['Choisis un programme.'];
  if (U.prog === 'custom' && !String(U.progName || '').trim()) return ['Donne un nom à ton programme.', '#setup-pname'];
  return null;
}
// Objectif et alimentation : à l'accueil (S.setup.n) ou dans le profil (settings.nutrition).
// Dans le profil, changer d'objectif repart du poids et de la date du jour.
function nSave(patch, restart){
  if (S.setup) { Object.assign(S.setup.n, patch); render(); return; }
  const n = Object.assign({}, nutritionOf(), patch);
  if (restart) n.start = { date: today(), weight: bodyweight() };
  putSettings({ nutrition: n }); render();
}
// Plan calculé comme si l'objectif repartait d'aujourd'hui, avec une date volontairement trop proche : donne la date réaliste et la date conseillée
function freshPlan(extra){
  const U = S.setup; const n = Object.assign({}, U ? U.n : nutritionOf(), { start: null, by: addDays(today(), 7) }, extra);
  return planFor(U ? setupData(U) : profileData(), n, today());
}
function nField(k, v){
  if (k === 'target') {
    const x = num(v);
    if (x == null || x < 25 || x > 350) { toast('Indique ton poids visé en kg, par exemple 72,5.'); render(); return; }
    const cur = S.setup ? S.setup.n : nutritionOf(); const patch = { target: x };
    if (!cur.by) { const pl = freshPlan({ target: x }); if (pl.advised) patch.by = pl.advised; }
    nSave(patch, true); return;
  }
  if (k === 'by') { if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) { render(); return; } nSave({ by: v }, true); }
}
// Journal des repas : une entrée garde les valeurs pour 100 g de l'aliment, pour que l'historique ne change pas
function addEntry(day, entry){ addEntries(day, [entry]); }
function addEntries(day, entries){ const d = dayDoc(day); put('m_' + day, Object.assign({}, d, { date: day, items: (d.items || []).concat(entries) })); }
// Raccourcis du journal : jour et repas visés (la fenêtre d'ajout ouverte, sinon le jour affiché et le repas du raccourci)
const quickTarget = m => S.food ? { day: S.food.day, meal: S.food.meal } : { day: S.foodDay || today(), meal: m };
// Aliment d'un raccourci : un habituel de ce repas (dernière quantité), sinon un récent
const quickFoodOf = (key, m, day, l) => { const f = (l !== 'rec' && habitualFoods(m, day, 60).find(x => x.key === key)) || recentFoods(200).find(x => x.key === key); return f ? freshFood(f) : null; };
const mealLow = m => ((MEALS.find(x => x[0] === m) || ['', ''])[1]);
// « Ajouté : 1 aliment », « Ajoutés : 3 aliments » (accord indépendant du nom des aliments et du repas)
const added = n => (n > 1 ? 'Ajoutés : ' : 'Ajouté : ') + n + ' aliment' + (n > 1 ? 's' : '');
// Nom d'un repas enregistré : obligatoire, 40 caractères au plus
function savedName(){ const i = $('#sm-name'); const v = i ? i.value.trim() : ''; if (!v || v.length > 40) { toast('Donne un nom à ce repas.'); if (i) i.focus(); return ''; } return v; }
const unitOf = F => { const fam = measuresFor(F.sel); return (fam && fam.units.find(x => x.id === F.unit)) || null; };
function setN(n){ const F = S.food; F.n = n; F.g = gramsOf(unitOf(F), num(n)); }
function pickFood(f){
  const last = recentFoods(200).find(r => r.key === f.key);
  Object.assign(S.food, { mode:'portion', sel:f, g: last ? last.g : f.serving || 100, unit:null, n:null, msg:null }); S.confirm = null;
  render(); window.scrollTo(0, 0);
}
// Code-barres lu ou tapé : produit déjà gardé sur le téléphone, sinon Open Food Facts
const OFF_FIELDS = 'code,product_name,product_name_fr,brands,serving_quantity,nutriments';
async function lookupBarcode(raw){
  const F = S.food; if (!F) return;
  const code = String(raw || '').replace(/\D/g, '');
  const msg = t => { F.msg = t; const m = $('#scan-msg'); if (m) m.textContent = t; };
  if (!validBarcode(code)) { msg('Code-barres incomplet ou mal lu : réessaie, ou tape les chiffres.'); return; }
  const kept = S.docs.get('f_' + code);
  if (kept) { pickFood(foodFromDoc('f_' + code, kept)); return; }
  const notFound = why => { Object.assign(S.food, { mode:'notfound', why, code, msg:null }); render(); window.scrollTo(0, 0); };
  if (!navigator.onLine) { notFound('offline'); return; }
  msg('Recherche du produit ' + code + '…');
  try {
    const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 10000);
    const r = await fetch('https://world.openfoodfacts.org/api/v2/product/' + code + '.json?lc=fr&fields=' + OFF_FIELDS, { signal: ctl.signal });
    clearTimeout(t);
    if (S.food !== F) return; // écran quitté entre-temps
    const j = r.status === 404 ? { status: 0 } : await r.json();
    const f = fromOff(j, code);
    if (!f) { notFound(j && j.status === 1 ? 'incomplete' : 'unknown'); return; }
    put('f_' + code, Object.assign({ src:'off', code, name:f.name, brand:f.brand, per100:f.per100, serving:f.serving, fetched: today() }, f.fixed ? { fixed:f.fixed } : {}));
    pickFood(f);
  } catch (e) { if (S.food === F) notFound(navigator.onLine ? 'error' : 'offline'); }
}
document.addEventListener('barcode', e => { if (S.food && S.food.mode === 'scan') lookupBarcode(e.detail); });
// Un choix du formulaire d'activité ('run', 'sport:basket', 'other'…) en type, sport et niveau ; un sport commence en « entraînement ou loisir »
function choice(v){ const p = String(v).split(':'); return p[0] === 'sport' && p[1] ? { type:'sport', sport:p[1], level:'train' } : { type:p[0] === 'sport' ? 'run' : p[0] }; }
const A = {
  // Chaque onglet retrouve sa position ; toucher l'onglet affiché remonte en haut
  tab(b){ const before = screenOf().key; const was = S.view; S.view = b.dataset.v; S.confirm = null; S.picker = null; S.draft = null; S.bilan = null; S.renaming = false; S.calMonth = null; S.calDay = null; S.day = null; S.fiche = null; S.move = null; S.exQ = ''; S.food = null; S.act = null; if (S.setup && S.setup.mode === 'change') S.setup = null;
    render(); if (was === b.dataset.v && before === screenOf().key) window.scrollTo({ top:0, behavior:'smooth' }); },
  // Aujourd'hui : ouvrir ou fermer une ligne compacte, afficher les autres conseils d'Émile, liens vers Séances et Alimentation
  'today-open'(b){ S.todayOpen = S.todayOpen === b.dataset.v ? null : b.dataset.v; render(); },
  'emile-more'(){ S.emileMore = !S.emileMore; render(); },
  'emile-open'(){ S.emileOpen = !S.emileOpen; render(); },
  'go-seances'(){ S.progTab = 'seances'; A.tab({ dataset:{ v:'training' } }); },
  'go-food'(){ A.tab({ dataset:{ v:'food' } }); },
  // Profil : vers les réglages de l'entraînement (Entraînement › Planning)
  'go-planning'(){ S.progTab = 'planning'; A.tab({ dataset:{ v:'training' } }); },
  // Premier lancement et programme
  'setup-prog'(b){ const U = S.setup; U.prog = b.dataset.v; U.perWeek = PROGRAMS[U.prog] ? Math.min(6, PROGRAMS[U.prog].days.length) : 3; render(); },
  'setup-day'(b){ S.setup.days = toggleIn(S.setup.days, +b.dataset.v); render(); },
  'setup-per-week'(b){ S.setup.perWeek = +b.dataset.v; render(); },
  'setup-restart'(b){ S.setup.restart = b.checked; },
  'setup-cancel'(){ S.setup = null; render(); },
  'setup-next'(){
    const U = S.setup;
    if (U.step === 2) {
      const e = progError(U); if (e) { toast(e[0]); const i = e[1] && $(e[1]); if (i) i.focus(); return; }
      U.ask = ['sex', 'birth', 'height', 'weight'].filter(k => !U[k]);
      U.step = 3; $('#toast').hidden = true; render(); window.scrollTo(0, 0); return;
    }
    if (!String(U.name || '').trim()) { toast('Indique ton prénom ou un pseudo.'); const i = $('#setup-name'); if (i) i.focus(); return; }
    const bad = ['birth', 'height', 'weight'].map(f => profileError(f, U[f])).find(Boolean);
    if (bad) { toast(bad); return; }
    U.step = 2; $('#toast').hidden = true; render(); window.scrollTo(0, 0);
  },
  'setup-back'(){ S.setup.step = Math.max(1, S.setup.step - 1); render(); },
  'setup-done'(){
    const U = S.setup; const first = U.mode === 'welcome'; const custom = U.prog === 'custom';
    if (first) {
      // Déjà vérifié à l'écran 1 ; on y revient si besoin
      if (!String(U.name || '').trim() || ['birth', 'height', 'weight'].some(f => profileError(f, U[f]))) { U.step = 1; A['setup-next'](); return; }
    }
    const pe = progError(U);
    if (pe) { if (first) U.step = 2; render(); toast(pe[0]); const i = pe[1] && $(pe[1]); if (i) i.focus(); return; }
    const name = custom ? String(U.progName || '').trim() : PROGRAMS[U.prog].name;
    if (first && U.n.on && planFor(setupData(U), U.n, today()).status === 'missing') { toast('Complète ce qu’il manque pour le calcul, ou choisis « Pas maintenant ».'); return; }
    // Rotation (version 2.13) : un objectif de séances par semaine, plus de jours fixes ; la rotation repart de l'ordre du nouveau programme
    const program = { base: custom ? null : U.prog, name, days: [] };
    const patch = Object.assign({ program, perWeek: U.perWeek || 3 }, programRotation(program.base));
    if (first) {
      patch.name = String(U.name || '').trim(); patch.modules = { knee:false, jumps:false, sport:false }; patch.created = today();
      if (U.sex) patch.sex = U.sex;
      if (U.birth) patch.birth = U.birth;
      if (num(U.height) != null) patch.height = num(U.height);
      if (U.n.on) patch.nutrition = { on:true, activity:U.n.activity, goal:U.n.goal, target:num(U.n.target), by:U.n.by || null, start:{ date:today(), weight:num(U.weight) } };
    }
    if (first || U.restart) patch.start = mondayOf(today());
    putSettings(patch);
    if (first && num(U.weight) != null) saveWeight(num(U.weight));
    S.setup = null; S.renaming = false; S.progTab = 'seances';
    S.view = custom || !first ? 'training' : 'today'; if (first) S.navHint = 'fade';
    render(); window.scrollTo(0, 0);
    toast(custom ? 'Programme créé : ajoute ta première séance.' : first ? 'C’est parti !' : 'Programme changé.');
  },
  'setup-sex'(b){ S.setup.sex = S.setup.sex === b.dataset.v ? null : b.dataset.v; render(); },
  'setup-n-on'(b){ S.setup.n.on = b.dataset.v === '1'; render(); },
  // Objectif et alimentation
  'n-on'(b){ nSave({ on: b.dataset.v === '1' }, b.dataset.v === '1' && !nutritionOf().start); if (b.dataset.v === '0') toast('Suivi de l’alimentation arrêté. Tes réglages sont gardés.'); },
  'n-act'(b){ nSave({ activity: b.dataset.v }); },
  'n-goal'(b){ nSave({ goal: b.dataset.v }, true); },
  'n-realistic'(){ const pl = freshPlan(); if (pl.realistic) { nSave({ by: pl.realistic }, true); toast(withDot('Date visée : ' + fmtDate(pl.realistic))); } },
  // Journal des repas
  fday(b){ const d = addDays(S.foodDay || today(), +b.dataset.v); S.foodDay = d >= today() ? null : d; render(); },
  'fd-add'(b){ S.food = { mode:'search', meal:b.dataset.v, day:S.foodDay || today(), q:'' }; render(); window.scrollTo(0, 0); },
  'fd-cancel'(){ S.food = null; S.confirm = null; render(); },
  // « + » d'un habituel ou d'un récent : ajouté d'un geste avec la dernière quantité
  'fd-plus'(b){
    const t = quickTarget(b.dataset.m); const f = quickFoodOf(b.dataset.v, b.dataset.m, t.day, b.dataset.l); if (!f) return;
    addEntries(t.day, copyEntries([f], t.meal)); S.food = null; render(); toast(nbsp(withDot('Ajouté : ' + f.name)));
  },
  // « + » d'un repas passé : tout le repas copié, mêmes quantités
  'fd-again'(b){
    const t = quickTarget(b.dataset.m); const items = dayDoc(b.dataset.d).items.filter(i => i.meal === b.dataset.m); if (!items.length) return;
    addEntries(t.day, copyEntries(items, t.meal)); S.food = null; render();
    const lab = mealLabel(b.dataset.d, t.day);
    toast(nbsp(added(items.length) + ' (' + mealLow(b.dataset.m).toLowerCase() + ' ' + (lab === 'hier' ? 'd’hier' : 'de ' + lab) + ')'));
  },
  // « + » d'un repas enregistré : tous ses aliments, dans le repas choisi en haut de la fenêtre
  'fd-meal-add'(b){
    const q = S.docs.get(b.dataset.v); if (!q || !q.items || !q.items.length) return; const t = quickTarget(q.meal);
    addEntries(t.day, copyEntries(q.items, t.meal)); S.food = null; render(); toast(nbsp(added(q.items.length) + ' (« ' + q.name + ' »)'));
  },
  // Repas enregistrés : enregistrer un repas du journal (2 aliments au moins), détail, renommer, supprimer
  'fd-save-meal'(b){
    const m = b.dataset.m; const day = S.foodDay || today(); if (dayDoc(day).items.filter(i => i.meal === m).length < 2) return;
    S.food = { mode:'save-meal', meal:m, day, q:'' }; S.confirm = null; render(); window.scrollTo(0, 0);
  },
  'fd-save-meal-ok'(){
    const F = S.food; const name = savedName(); if (!F || !name) return;
    const items = dayDoc(F.day).items.filter(i => i.meal === F.meal).map(({ id, meal, ...rest }) => rest);
    put('q_' + rid(), { name, meal:F.meal, items, at:today() }); S.food = null; render(); toast('Repas enregistré.');
  },
  'fd-saved'(b){ Object.assign(S.food, { mode:'meal', qid:b.dataset.v, renaming:false, nameDraft:null }); S.confirm = null; render(); window.scrollTo(0, 0); },
  'fd-saved-rename'(){ S.food.renaming = true; S.food.nameDraft = null; render(); const i = $('#sm-name'); if (i) i.focus(); },
  'fd-saved-rename-ok'(){ const name = savedName(); const q = S.docs.get(S.food.qid); if (!name || !q) return; put(S.food.qid, Object.assign({}, q, { name })); S.food.renaming = false; S.food.nameDraft = null; render(); },
  'fd-saved-del'(){ S.confirm = 'q-del'; render(); },
  'fd-saved-del-yes'(){ del(S.food.qid); S.confirm = null; Object.assign(S.food, { mode:'search', qid:null }); render(); toast('Repas supprimé.'); },
  // Nom d'un habituel ou d'un récent touché : écran « Quantité » déjà rempli
  'fd-open'(b){
    const t = quickTarget(b.dataset.m); const f = quickFoodOf(b.dataset.v, b.dataset.m, t.day, b.dataset.l); if (!f) return;
    // Ouvert depuis le journal (pas de fenêtre d'ajout) : « ‹ Retour » ramène au journal
    const fromDay = !S.food;
    S.food = Object.assign(S.food || { q:'' }, { mode:'portion', meal:t.meal, day:t.day, sel:f, g:f.g, unit:null, n:null, msg:null }, fromDay ? { fromDay:true } : {}); S.confirm = null; render(); window.scrollTo(0, 0);
  },
  'fd-back'(){ if (S.food.edit) { S.food = null; } else { S.food.mode = 'search'; S.food.msg = null; } render(); },
  'fd-meal'(b){ S.food.meal = b.dataset.v; render(); },
  'fd-pick'(b){ const f = shown.get(b.dataset.v); if (f) pickFood(f); },
  'fd-gset'(b){ S.food.g = +b.dataset.v; render(); },
  // Mesure usuelle : le journal garde des grammes (F.g), calculés d'après le nombre saisi (F.n) ; revenir aux grammes garde ce poids
  'fd-unit'(b){ const F = S.food; const fam = measuresFor(F.sel); const u = fam && fam.units.find(x => x.id === b.dataset.v); if (u) { F.unit = u.id; setN(String(u.start)); } else { F.unit = null; F.n = null; } render(); },
  'fd-nset'(b){ setN(b.dataset.v); render(); },
  'fd-save'(){
    const F = S.food; const g = num(F.g);
    if (g == null || g <= 0 || g > 5000) { toast(unitOf(F) ? 'Indique la quantité, par exemple 1 ou 1,5.' : 'Indique la quantité en grammes, par exemple 120.'); const i = $('#fd-g') || $('#fd-n'); if (i) i.focus(); return; }
    const f = F.sel; const entry = { id: F.edit || rid(), meal:F.meal, key:f.key, name:f.name, brand:f.brand || '', g, per100:f.per100 };
    if (f.serving) entry.serving = f.serving;
    if (f.portion) entry.portion = f.portion;
    if (f.src === 'rec' || f.src === 'recipe') entry.src = f.src;
    if (F.edit) { const d = dayDoc(F.day); put('m_' + F.day, Object.assign({}, d, { items: d.items.map(i => i.id === F.edit ? entry : i) })); }
    else addEntry(F.day, entry);
    S.food = null; render(); toast(withDot((F.edit ? 'Modifié : ' : 'Ajouté : ') + f.name));
  },
  'fd-edit'(b){
    const day = S.foodDay || today(); const it = dayDoc(day).items.find(i => i.id === b.dataset.v); if (!it) return;
    S.food = { mode:'portion', edit:it.id, meal:it.meal, day, g:it.g, sel:{ key:it.key, src:it.key.split(':')[0], name:it.name, brand:it.brand || '', per100:it.per100, serving:it.serving || null } };
    S.confirm = null; render(); window.scrollTo(0, 0);
  },
  'fd-del'(){ S.confirm = 'fd-del'; render(); },
  'fd-del-yes'(){ const F = S.food; const d = dayDoc(F.day); put('m_' + F.day, Object.assign({}, d, { items: d.items.filter(i => i.id !== F.edit) })); S.food = null; S.confirm = null; render(); toast('Retiré du journal.'); },
  'fd-scan'(){ Object.assign(S.food, { mode:'scan', msg:null }); render(); window.scrollTo(0, 0); },
  'fd-code'(){ const i = $('#scan-code'); lookupBarcode(i ? i.value : ''); },
  'fd-create'(){ const F = S.food; F.draft = { name: F.mode === 'search' ? capFirst(String(F.q || '').trim()) : '' }; if (F.mode !== 'notfound') F.code = null; F.mode = 'create'; render(); window.scrollTo(0, 0); },
  // Recettes : créer (ingrédients et quantités pour toute la recette), modifier, enregistrer comme un aliment (portion)
  'rec-new'(){ const F = S.food; F.rec = { name: capFirst(String(F.q || '').trim()), servings:'4', cooked:'', items:[], q:'' }; F.mode = 'recipe'; render(); window.scrollTo(0, 0); },
  'rec-edit'(b){ const o = S.docs.get(b.dataset.v); if (!o) return; S.food.rec = { id:b.dataset.v, name:o.name, servings:String(o.servings || 1), cooked: o.cooked ? String(o.cooked) : '', items: clone(o.items || []), q:'' }; S.food.mode = 'recipe'; render(); window.scrollTo(0, 0); },
  'rec-add'(b){ const f = recShown.get(b.dataset.v); if (!f) return; const R = S.food.rec; R.items.push({ key:f.key, name:f.name, g: f.serving || 100, per100:f.per100 }); R.q = ''; render(); },
  'rec-rm'(b){ S.food.rec.items.splice(+b.dataset.i, 1); render(); },
  'rec-save'(){
    const F = S.food; const R = F.rec; const name = String(R.name || '').trim(); const items = R.items.filter(i => i.g > 0);
    const servings = num(R.servings); const cooked = num(R.cooked);
    if (!name) { toast('Donne un nom à ta recette.'); $('#rc-name').focus(); return; }
    if (!items.length) { toast('Ajoute au moins un ingrédient, avec sa quantité.'); $('#rec-q').focus(); return; }
    if (!(servings >= 1 && servings <= 50)) { toast('Indique le nombre de portions, entre 1 et 50.'); $('#rc-servings').focus(); return; }
    if (R.cooked && !(cooked >= 10 && cooked <= 20000)) { toast('Poids du plat cuit : en grammes, par exemple 1200.'); $('#rc-cooked').focus(); return; }
    const r = ownRecipe(items, servings, cooked);
    if (r.per100.kcal == null) { toast('Il manque les calories d’un ingrédient important.'); return; }
    const id = R.id || 'f_own' + rid();
    const doc = { src:'recipe', name, servings, cooked: cooked || null, items: items.map(i => ({ key:i.key, name:i.name, g:i.g, per100:i.per100 })), per100:r.per100, serving:r.serving, created: (S.docs.get(id) || {}).created || today() };
    put(id, doc); toast(R.id ? 'Recette modifiée.' : 'Recette enregistrée.'); F.rec = null; pickFood(foodFromDoc(id, doc));
  },
  'fd-create-save'(){
    const F = S.food; const d = F.draft; const name = String(d.name || '').trim(); const kcal = num(d.kcal);
    if (!name) { toast('Donne un nom à l’aliment.'); $('#fc-name').focus(); return; }
    if (kcal == null || kcal < 0 || kcal > 900) { toast('Indique les calories pour 100 g (entre 0 et 900).'); $('#fc-kcal').focus(); return; }
    const per100 = { kcal }; let bad = '';
    ['p', 'c', 's', 'f', 'sf', 'fib', 'salt'].forEach(k => { const v = num(d[k]); if (d[k] != null && String(d[k]).trim() !== '' && (v == null || v < 0 || v > 100)) bad = k; per100[k] = v != null && v >= 0 && v <= 100 ? v : null; });
    if (bad) { toast('Vérifie les valeurs pour 100 g : entre 0 et 100 g.'); $('#fc-' + bad).focus(); return; }
    if (per100.s != null && per100.c != null && per100.s > per100.c) { toast('Les sucres font partie des glucides : ils ne peuvent pas être plus élevés.'); return; }
    if (per100.sf != null && per100.f != null && per100.sf > per100.f) { toast('Les saturés font partie des lipides : ils ne peuvent pas être plus élevés.'); return; }
    const serving = num(d.serving); const id = F.code ? 'f_' + F.code : 'f_own' + rid();
    const doc = { src:'own', name, brand: String(d.brand || '').trim(), per100, serving: serving > 0 && serving < 2000 ? serving : null, created: today() };
    if (F.code) doc.code = F.code;
    put(id, doc); toast('Aliment enregistré.'); pickFood(foodFromDoc(id, doc));
  },
  'goal-edit'(){ if (nutritionOf().on) S.todayOpen = 'p-goal'; A.profile(); const c = $('#goal-card'); if (c) c.scrollIntoView({ block:'start' }); },
  'prog-change'(){ S.setup = newSetup('change'); render(); window.scrollTo(0, 0); },
  // Profil, apparence, sous-onglets de Progrès
  profile(){ if (S.view !== 'profile' && S.view !== 'science') S.from = S.view; S.view = 'profile'; S.act = null; S.move = null; S.confirm = null; S.picker = null; S.draft = null; S.bilan = null; S.renaming = false; if (S.setup && S.setup.mode === 'change') S.setup = null; render(); window.scrollTo(0, 0); },
  science(){ S.view = 'science'; render(); window.scrollTo(0, 0); },
  'profile-back'(){ S.view = S.from || 'today'; render(); },
  prtab(b){ S.progressTab = b.dataset.v; S.confirm = null; render(); },
  // Période des courbes et mesure du rythme (Progrès › Résumé) : états d'affichage, non enregistrés
  prrange(b){ S.prRange = b.dataset.v; render(); },
  prmetric(b){ S.prMetric = b.dataset.v; render(); },
  // Calendrier : toucher un jour ouvre son mois et affiche ce jour ; flèches ou glissement pour changer de mois
  'cal-month'(){ S.calMonth = (S.calDay || today()).slice(0, 7); render(); },
  'cal-week'(){ S.calMonth = null; S.calDay = null; render(); },
  'cal-prev'(){ S.calMonth = addMonths(S.calMonth, -1); S.calDay = null; render(); },
  'cal-next'(){ S.calMonth = addMonths(S.calMonth, 1); S.calDay = null; render(); },
  // Toucher un jour ouvre son écran ; le mois (ou la semaine) et le jour choisi sont gardés pour le retour
  'cal-day'(b){ const d = b.dataset.v; if (S.calMonth) S.calMonth = d.slice(0, 7); S.calDay = d; S.day = d; S.confirm = null; render(); window.scrollTo(0, 0); },
  'day-close'(){ S.day = null; S.confirm = null; render(); },
  'cal-hist'(b){ S.day = null; S.view = 'progress'; S.progressTab = 'history'; S.openHist = b.dataset.v; S.calMonth = null; S.calDay = null; render(); const el = document.querySelector('[data-act="hist"][data-v="' + b.dataset.v + '"]'); if (el) el.scrollIntoView({ block:'start' }); },
  'set-sex'(b){ putSettings({ sex: settings().sex === b.dataset.v ? null : b.dataset.v }); render(); },
  theme(b){ putSettings({ theme: b.dataset.v }); applyTheme(b.dataset.v); render(); },
  'prog-rename'(){ S.renaming = true; render(); const i = $('#prog-name'); if (i) i.focus(); },
  'prog-rename-save'(){ const v = String(($('#prog-name') || {}).value || '').trim(); if (!v) { toast('Donne un nom à ton programme.'); return; } putSettings({ program: Object.assign({}, programOf(), { name:v }) }); S.renaming = false; render(); toast('Programme renommé.'); },
  'go-new-tpl'(){ S.view = 'training'; S.progTab = 'seances'; A['new-tpl'](); },
  mod(b){ const m = Object.assign({}, mods()); m[b.dataset.v] = b.checked; putSettings({ modules:m }); render(); toast(b.checked ? 'Option activée.' : 'Option désactivée.'); },
  'sport-day'(b){ const sp = Object.assign({ name:'', train:[], match:[] }, settings().sport); const k = b.dataset.k; const o = k === 'train' ? 'match' : 'train'; const wd = +b.dataset.v; sp[k] = toggleIn(sp[k], wd); sp[o] = (sp[o] || []).filter(x => x !== wd); putSettings({ sport:sp }); render(); },
  'ex-hide'(b){ const id = b.dataset.v; const ex = excluded().filter(x => x !== id); if (b.checked) ex.push(id); putSettings({ excluded:ex }); toast(b.checked ? 'Exercice masqué.' : 'Exercice affiché à nouveau.'); },
  'ex-unhide'(b){ putSettings({ excluded: excluded().filter(x => x !== b.dataset.v) }); render(); toast('Exercice affiché à nouveau.'); },
  bilan(b){ S.bilan = +b.dataset.v; render(); window.scrollTo(0, 0); },
  'bilan-close'(){ S.bilan = null; render(); },
  'fatigue-deload'(){ const s = settings(); const wk = mondayOf(today()); const dl = Object.assign({}, s.deload); dl[wk] = true; putSettings({ deload: dl }); render(); toast('Décharge avancée à cette semaine.'); },
  'fatigue-ignore'(){ putSettings({ fatigueDismiss: mondayOf(today()) }); render(); },
  'save-jump'(){
    const w = activeWorkout(); if (!w) return;
    const tries = [0,1,2].map(i => num(($('#jump-' + i) || {}).value)).filter(v => v != null && v > 0 && v < 150);
    if (!tries.length) { toast('Note au moins un essai, en cm.'); return; }
    const best = Math.max.apply(null, tries);
    put('t_' + Date.now().toString(36), { date:w.date, cm:best, tries, block: weekInfo(w.date).block });
    render(); toast('Test enregistré : ' + fmtKg(best) + ' cm.');
  },
  ptab(b){ S.progTab = b.dataset.v; S.confirm = null; render(); },
  start(b){ startWorkout(b.dataset.v); },
  // Terminer avec des séries non validées : on demande d'abord (la séance ne se reprend pas)
  finish(){ S.confirm = 'finish'; render(); },
  'finish-yes'(){ S.confirm = null; finishWorkout(); },
  'finish-no'(){ S.confirm = null; render(); },
  abandon(){ S.confirm = 'abandon'; render(); },
  'abandon-yes'(){ const w = activeWorkout(); if (w) del(w.id); S.confirm = null; resetSession(); stopRest(); S.view = 'today'; S.navHint = 'down'; render(); window.scrollTo(0, 0); toast('Séance supprimée.'); },
  'close-summary'(){ S.summary = null; render(); },
  // Conseil d'Émile fermé : il ne revient que quand sa clé change ; on oublie les clés de plus de 4 mois
  'emile-x'(b){
    const lim = addDays(today(), -120); const d = {}; const old = settings().dismissed || {};
    Object.keys(old).forEach(k => { if (old[k] >= lim) d[k] = old[k]; });
    d[b.dataset.v] = today(); putSettings({ dismissed: d }); render();
  },
  // Effort de la séance qui vient de se terminer : sa dépense est recalculée
  // La séance visée est celle du bouton (carte « Séance faite »), même après une relance de l'appli
  effort(b){ const id = b.dataset.w || (S.summary && S.summary.id); const w = id && S.docs.get(id); if (!w || !EFFORT[b.dataset.v]) return; w.effort = b.dataset.v; w.kcal = computeSessionKcal(w, bodyweight()); put(id, w); render(); },
  'adj-yes'(){ S.adjOk = true; render(); },
  'adj-no'(){ recordCheck('notfollowed'); toast('Objectif gardé : je referai le point dans 2 semaines.'); },
  'adj-apply'(){ const c = checkDue(); if (!c || c.status !== 'change') return; recordCheck('change', true); toast('Nouvel objectif : ' + fmtInt(c.kcal) + ' kcal par jour.'); },
  'adj-keep'(){ recordCheck(); },
  'adj-later'(){ recordCheck('skip'); },
  'adj-reset'(){ putSettings({ nutrition: Object.assign({}, nutritionOf(), { adjust: 0 }) }); render(); toast('Corrections annulées.'); },
  // Activités : ajout (éventuellement le sport prévu aujourd'hui), modification, suppression
  'act-add'(b){
    const v = b.dataset.v; const date = b.dataset.d || today(); const planned = b.dataset.p === '1' ? { planned:true } : {};
    S.act = v ? { type:'sport', sport: sportOf(sportInfo().name), level:v, min:90, date } : Object.assign({ date }, planned, choice(settings().lastAct || 'run'));
    S.confirm = null; render(); window.scrollTo(0, 0);
  },
  'act-cancel'(){ S.act = null; S.confirm = null; render(); },
  'act-type'(b){ const c = choice(b.dataset.v); if (c.type === 'sport' && S.act.type === 'sport') c.level = S.act.level || 'train'; Object.assign(S.act, { level:null, sport:null }, c); render(); },
  'act-level'(b){ S.act.level = b.dataset.v; render(); },
  'act-edit'(b){ const o = S.docs.get(b.dataset.v); if (!o) return; S.act = Object.assign({}, o, { edit:b.dataset.v }); S.confirm = null; render(); window.scrollTo(0, 0); },
  // data-v="done" (depuis une activité prévue) : l'enregistre comme faite, avec ses calories calculées maintenant
  'act-save'(b){
    const A = S.act; const a = actDoc(A); const done = !!(b && b.dataset.v === 'done'); const planned = !!A.planned && !done;
    if (done && A.date > today()) { toast('Cette activité est prévue plus tard : change sa date pour la noter.'); return; }
    if (!(a.min > 0 && a.min <= 900)) { toast('Indique la durée, en minutes.'); return; }
    if (a.type === 'run' && !(a.km > 0 && a.km <= 300)) { toast('Indique la distance, en kilomètres.'); return; }
    if (LEVELS[a.type] && !a.level) { toast('Choisis l’allure.'); return; }
    if (a.type === 'sport' && !(a.sport && a.level)) { toast('Choisis le sport, puis entraînement ou match.'); return; }
    if (a.kcal != null && !(a.kcal >= 0 && a.kcal <= 5000)) { toast('Calories : entre 0 et 5 000 kcal.'); return; }
    // Une activité prévue peut avoir une date à venir ; une activité faite, jamais
    const date = A.date && (planned ? (A.edit || A.date >= today()) : A.date <= today()) ? A.date : today();
    const doc = { date, type:a.type, min:a.min, at: done ? Date.now() : A.at || Date.now() };
    if (planned) doc.planned = true;
    if (a.type === 'run') doc.km = a.km;
    if (a.level) doc.level = a.level;
    if (a.type === 'sport') doc.sport = a.sport;
    if (a.type === 'other') { if (a.name) doc.name = a.name; doc.kcal = a.kcal; }
    else if (!planned) doc.kcal = activityKcal(doc, bodyweight()); // prévue : calories calculées quand elle sera faite, avec le poids de ce jour-là
    // L'identifiant porte la date : changer la date, c'est déplacer l'activité
    const id = A.edit && A.edit.indexOf('a_' + date + '_') === 0 ? A.edit : 'a_' + date + '_' + rid();
    if (A.edit && A.edit !== id) del(A.edit);
    put(id, doc); if (!A.edit) putSettings({ lastAct: choiceOf(a) });
    S.act = null; render(); toast(done ? 'Activité faite.' : planned ? (A.edit ? 'Activité prévue modifiée.' : 'Activité prévue.') : A.edit ? 'Activité modifiée.' : 'Activité ajoutée.');
  },
  // Un geste : une activité prévue (aujourd'hui ou avant) devient faite
  'act-done'(b){
    const o = S.docs.get(b.dataset.v); if (!o || !o.planned || o.date > today()) return;
    const d = Object.assign({}, o, { at: Date.now() }); delete d.planned;
    if (d.type !== 'other') d.kcal = activityKcal(d, bodyweight());
    put(b.dataset.v, d); render(); toast('Activité faite.');
  },
  'act-del'(){ S.confirm = 'act-del'; render(); },
  'act-ask-del'(b){ S.confirm = 'act-del:' + b.dataset.v; render(); },
  'act-del-yes'(b){ const id = b.dataset.v || S.act.edit; del(id); S.act = null; S.confirm = null; render(); toast('Activité supprimée.'); },
  // Eau : un verre de plus ou de moins, ou une quantité en mL
  water(b){ addWater(+b.dataset.v * glassOf()); },
  'water-auto'(){ putSettings({ waterGoal: null }); render(); toast('Objectif remis au repère de l’appli.'); },
  'water-ml'(){ const i = $('#water-ml'); const v = num(i ? i.value : ''); if (!(v > 0 && v <= 3000)) { toast('Indique une quantité entre 1 et 3 000 mL.'); return; } addWater(v); },
  done(b){
    unlockAudio();
    const w = activeWorkout(); if (!w) return;
    const key = b.dataset.ex; const it = itemsOf(w).find(x => x.ex === key); if (!it) return;
    const i = +b.dataset.i; const st = w.ex[key]; const s = st.sets[i];
    if (!s.done && it.kind === 'cardio') {
      const minIn = document.getElementById('min-' + key + '-0'); const kmIn = document.getElementById('km-' + key + '-0');
      s.min = minIn && num(minIn.value) > 0 ? minIn.value : String(it.lo); if (kmIn) s.km = kmIn.value;
      if (!(num(s.min) > 0 && num(s.min) <= 300)) { toast('Indique la durée, en minutes.'); return; }
      s.done = true; forgetOpen(w); put(w.id, w); render(); showCurrent(); return;
    }
    if (!s.done) {
      if (it.kind !== 'plyo') {
        const t = w.targets[key] || {};
        const kgIn = document.getElementById('kg-' + key + '-' + i); const repsIn = document.getElementById('reps-' + key + '-' + i);
        if (kgIn) s.kg = kgIn.value;
        if (repsIn) s.reps = repsIn.value;
        if (num(s.reps) == null) s.reps = String(t.reps && t.reps[i] != null ? t.reps[i] : it.lo);
        if (it.kind === 'bw' && num(s.kg) == null) s.kg = '0';
        if (num(s.kg) == null) { toast('Indique la charge utilisée.'); if (kgIn) kgIn.focus(); return; }
        const nx = st.sets[i + 1]; if (nx && !nx.done && num(nx.kg) == null) nx.kg = s.kg;
      } else s.reps = it.lo;
      s.done = true; S.justDone = key + ':' + i;
      // Après la dernière série d'un exercice, le minuteur annonce l'exercice suivant
      const left = st.sets.findIndex(x => !x.done);
      // Dernière série d'un exercice à la charge ou au poids du corps : la question des reps en réserve, si elles ne sont pas notées
      if (left < 0) askRir(it, st);
      forgetOpen(w);
      const after = left < 0 ? upNext(w, { open:S.sessOpen }) : null;
      const nxt = supersetNext(w, key);
      // Série qui bat la meilleure force estimée des séances d'avant : annoncée tout de suite (même règle que l'écran de fin)
      const pr = prSet(w, it); const rec = pr && pr.i === i;
      if (nxt) toast((rec ? 'Nouveau record ! ' : '') + 'Enchaîne : ' + nxt.name);
      else { if (rec) toast('Nouveau record sur ' + it.name + ' !'); if (it.kind !== 'plyo') startRest(it.rest || 90, after ? 'Prochain : ' + after.name : (left >= 0 ? 'Série ' + (left + 1) + '/' + st.sets.length + ' ensuite · ' : 'Terminé · ') + it.name);
      else startRest(60, after ? 'Prochain : ' + after.name : 'Récupère avant la série suivante'); }
    } else { s.done = false; if (S.rirAsk === key) S.rirAsk = null; }
    S.setEdit = null; put(w.id, w); render(); showCurrent(); S.justDone = null;
  },
  // − et + de la série en cours : la charge avance du palier de l'exercice, les reps de 1
  step(b){
    const w = activeWorkout(); if (!w) return;
    const key = b.dataset.ex; const i = +b.dataset.i; const f = b.dataset.f; const it = itemsOf(w).find(x => x.ex === key);
    const st = w.ex[key]; const s = st && st.sets[i]; if (!it || !s || (f !== 'kg' && f !== 'reps')) return;
    const t = w.targets[key] || {}; const inp = document.getElementById(f + '-' + key + '-' + i);
    let v = num(inp ? inp.value : s[f]); if (v == null && f === 'reps') v = Array.isArray(t.reps) && t.reps[i] != null ? t.reps[i] : it.lo;
    s[f] = String(stepValue(v, +b.dataset.v, f === 'kg' ? (it.step || (exDef(key) || {}).step || 1) : 1));
    put(w.id, w); render();
  },
  // Ouvrir un autre exercice pendant la question des reps en réserve revient à la passer (rien n'est noté)
  'ex-open'(b){ const w = activeWorkout(); if (w && S.rirAsk && sessionFocus(w, { ask:S.rirAsk }).open.indexOf(b.dataset.v) < 0) S.rirAsk = null; S.sessOpen = b.dataset.v; S.setEdit = null; render(); showOpen(b.dataset.v); },
  // « Voir le mouvement » : fenêtre ouverte depuis la séance ; la pause fige l'alternance des photos sans redessiner
  'move-open'(b){ S.move = b.dataset.v; render(); },
  'move-close'(){ S.move = null; render(); },
  // Silhouette en 3D : « De face » ou « De dos » la fait pivoter (sans redessiner l'écran)
  'bm-side'(b){ const box = b.closest('.bm3d'); if (box && (b.dataset.v === 'back') !== box.classList.contains('back')) turnTo(box, (+box.dataset.ry || 0) + 180); },
  'move-pause'(b){ const m = b.closest('.mv'); if (!m) return; const p = m.classList.toggle('paused'); b.setAttribute('aria-pressed', String(p)); const t = b.querySelector('.sr'); if (t) t.textContent = (p ? 'Reprendre l’animation' : 'Mettre en pause l’animation') + ' : '; },
  'set-edit'(b){ S.setEdit = { ex:b.dataset.ex, i:+b.dataset.i }; render(); showCurrent(); },
  // Enregistrer une correction : mêmes règles qu'à la validation (reps visées si vide, 0 de lest au poids du corps, charge obligatoire)
  'set-save'(b){
    const w = activeWorkout(); if (!w) return; const key = b.dataset.ex; const i = +b.dataset.i; const it = itemsOf(w).find(x => x.ex === key);
    const s = w.ex[key] && w.ex[key].sets[i]; if (!it || !s) { S.setEdit = null; render(); return; }
    const t = w.targets[key] || {};
    if (num(s.reps) == null) s.reps = String(Array.isArray(t.reps) && t.reps[i] != null ? t.reps[i] : it.lo);
    if (it.kind === 'bw' && num(s.kg) == null) s.kg = '0';
    if (it.kind === 'load' && num(s.kg) == null) { toast('Indique la charge utilisée.'); const k = document.getElementById('kg-' + key + '-' + i); if (k) k.focus(); return; }
    S.setEdit = null; put(w.id, w); render();
  },
  'set-undo'(b){ const w = activeWorkout(); if (!w) return; const st = w.ex[b.dataset.ex]; const s = st && st.sets[+b.dataset.i]; if (s) s.done = false; if (S.rirAsk === b.dataset.ex) S.rirAsk = null; S.setEdit = null; put(w.id, w); render(); },
  check(b){ const w = activeWorkout(); if (!w) return; const st = w.ex[b.dataset.ex]; st.done = !st.done; if (st.done) forgetOpen(w); put(w.id, w); render(); if (st.done) showCurrent(); },
  unskip(b){ const w = activeWorkout(); if (!w) return; const st = w.ex[b.dataset.ex]; st.skip = false; if (!st.sets.length) { const it = itemsOf(w).find(x => x.ex === b.dataset.ex); for (let i = 0; i < (it ? it.sets : 3); i++) st.sets.push({ kg:null, reps:null, done:false }); } put(w.id, w); render(); showCurrent(); },
  addset(b){ const w = activeWorkout(); if (!w) return; const st = w.ex[b.dataset.ex]; const last = st.sets[st.sets.length - 1]; st.sets.push({ kg: last ? last.kg : null, reps:null, done:false }); put(w.id, w); render(); },
  // Retirer la dernière série : si l'exercice est alors terminé, la question des reps en réserve arrive comme après une validation
  rmset(b){ const w = activeWorkout(); if (!w) return; const st = w.ex[b.dataset.ex]; if (st.sets.length > 1 && !st.sets[st.sets.length - 1].done) st.sets.pop(); const it = itemsOf(w).find(x => x.ex === b.dataset.ex); if (it) askRir(it, st); S.setEdit = null; forgetOpen(w); put(w.id, w); render(); showCurrent(); },
  clevel(b){ const w = activeWorkout(); if (!w) return; const st = w.ex[b.dataset.ex]; if (st) { st.level = b.dataset.v; put(w.id, w); render(); } },
  rir(b){ if (S.rirAsk === b.dataset.ex) { answerRir(b.dataset.ex, +b.dataset.v); return; } const w = activeWorkout(); if (!w) return; const st = w.ex[b.dataset.ex]; const v = +b.dataset.v; st.rir = st.rir === v ? null : v; put(w.id, w); render(); },
  'rir-skip'(b){ answerRir(b.dataset.ex, null); },
  knee(b){ const w = activeWorkout(); if (!w) return; const v = +b.dataset.v; w.knee = w.knee === v ? null : v; put(w.id, w); render(); },
  // Douleurs des autres zones : note du jour (d_<date>), signaux d'alerte, note pendant la séance (w.pain), zones suivies
  'pain-d'(b){
    const d = today(); const id = 'd_' + d; const z = b.dataset.z; const v = +b.dataset.v; const cur = Object.assign({ date:d }, S.docs.get(id)); cur.z = Object.assign({}, cur.z);
    if (cur.z[z] && cur.z[z].v === v) delete cur.z[z]; else cur.z[z] = Object.assign({}, cur.z[z], { v });
    if (Object.keys(cur.z).length) put(id, cur); else del(id); render();
  },
  'pain-flag'(b){
    const d = today(); const id = 'd_' + d; const z = b.dataset.z; const cur = S.docs.get(id); if (!cur || !cur.z || !cur.z[z]) return;
    const fl = toggleIn((cur.z[z].flags || []).slice(), b.dataset.v); put(id, Object.assign({}, cur, { z: Object.assign({}, cur.z, { [z]: Object.assign({}, cur.z[z], { flags: fl }) }) })); render();
  },
  'pain-s'(b){ const w = activeWorkout(); if (!w) return; const z = b.dataset.z; const v = +b.dataset.v; w.pain = Object.assign({}, w.pain); if (w.pain[z] === v) delete w.pain[z]; else w.pain[z] = v; put(w.id, w); render(); },
  'pain-zone'(b){
    const z = b.dataset.v;
    if (z === 'knee') { const m = Object.assign({}, mods()); m.knee = !m.knee; putSettings({ modules:m }); }
    else { const p = Object.assign({}, settings().pain); p.zones = toggleIn((p.zones || []).slice(), z); putSettings({ pain:p }); }
    render();
  },
  'weigh-now'(){ S.todayOpen = 'corps'; render(); const i = $('#b-weight'); if (i) { i.scrollIntoView({ block:'center' }); i.focus(); } },
  stairs(b){ const d = today(); const id = 'k_' + d; const v = +b.dataset.v; const cur = S.docs.get(id); if (cur && cur.stairs === v) del(id); else put(id, { date:d, stairs:v }); render(); },
  sleepq(b){ const d = today(); const id = 'b_' + d; const cur = Object.assign({ date:d }, S.docs.get(id) || {}); const v = +b.dataset.v; cur.sleepQ = cur.sleepQ === v ? null : v; put(id, cur); render(); },
  busy(b){ const s = settings(); const wk = mondayOf(today()); const busy = Object.assign({}, s.busy); if (b.checked) busy[wk] = true; else delete busy[wk]; putSettings({ busy }); render(); },
  deload(b){ const s = settings(); const wk = mondayOf(today()); const dl = Object.assign({}, s.deload); if (b.checked) dl[wk] = true; else delete dl[wk]; putSettings({ deload: dl }); render(); },
  'rest-add'(){ if (S.restEnd) S.restEnd += 15000; updateRest(); },
  'rest-stop'(){ stopRest(); },
  hist(b){ S.openHist = S.openHist === b.dataset.v ? null : b.dataset.v; S.confirm = null; render(); },
  'ask-del-w'(b){ S.confirm = b.dataset.v; render(); },
  'cancel-confirm'(){ S.confirm = null; render(); },
  'del-w'(b){ del(b.dataset.v); S.confirm = null; S.openHist = null; render(); toast('Séance supprimée.'); },
  reopen(b){ const w = S.docs.get(b.dataset.v); if (!w || activeWorkout()) return; w.status = 'en_cours'; put(b.dataset.v, w); S.view = 'training'; render(); window.scrollTo(0, 0); toast('Séance rouverte : corrige puis termine-la.'); },
  'add-test'(){ const cm = num($('#test-cm').value); const date = $('#test-date').value || today(); if (cm == null || cm <= 0 || cm > 150) { toast('Indique une hauteur en cm, par exemple 52.'); return; } put('t_' + Date.now().toString(36), { date, cm }); render(); toast('Test ajouté.'); },
  'del-test'(b){ if (S.confirm === b.dataset.v) { del(b.dataset.v); S.confirm = null; } else S.confirm = b.dataset.v; render(); },
  // Choix d'exercice
  'pick-add'(){ S.picker = { mode:'add', q:'' }; render(); window.scrollTo(0, 0); },
  'pick-replace'(b){ S.picker = { mode:'replace', idx:+b.dataset.i, q:'', alsoTpl:false }; render(); window.scrollTo(0, 0); },
  'pick-draft'(){ S.picker = { mode:'draft', q:'' }; render(); window.scrollTo(0, 0); },
  'pick-cancel'(){ S.picker = null; render(); },
  'pick-tpl'(b){ if (S.picker) S.picker.alsoTpl = b.checked; },
  pick(b){ applyPick(b.dataset.v); window.scrollTo(0, 0); },
  'new-ex-from-pick'(){ const back = { picker:S.picker, prevDraft:S.draft }; S.picker = null; S.draft = { kind:'ex', isNew:true, id:null, data:blankEx(), after:back }; render(); window.scrollTo(0, 0); },
  // Séances modèles
  'new-tpl'(){ S.draft = { kind:'tpl', isNew:true, id:'s' + rid(), data:{ name:'', focus:'', cut:'', items:[] } }; render(); window.scrollTo(0, 0); },
  'edit-tpl'(b){ const t = tplDef(b.dataset.v); if (!t) return; S.draft = { kind:'tpl', isNew:false, id:t.id, data:{ name:t.name, focus:t.focus || '', cut:t.cut || '', items: normSS(clone(t.items)) } }; render(); window.scrollTo(0, 0); },
  // Déplacer ou retirer un exercice peut défaire un superset : les repères sont renumérotés à chaque fois
  'it-up'(b){ const a = S.draft.data.items; const i = +b.dataset.i; if (i > 0) { const x = a[i]; a[i] = a[i - 1]; a[i - 1] = x; } normSS(a); render(); },
  'it-down'(b){ const a = S.draft.data.items; const i = +b.dataset.i; if (i < a.length - 1) { const x = a[i]; a[i] = a[i + 1]; a[i + 1] = x; } normSS(a); render(); },
  'it-rm'(b){ S.draft.data.items.splice(+b.dataset.i, 1); normSS(S.draft.data.items); render(); },
  'it-link'(b){ toggleLink(S.draft.data.items, +b.dataset.i); render(); },
  'save-tpl'(){
    const D = S.draft; const t = D.data;
    if (!t.name.trim()) { toast('Donne un nom à la séance.'); $('#d-name').focus(); return; }
    if (!t.items.length) { toast('Ajoute au moins un exercice.'); return; }
    // Séance créée : elle entre à la fin de la rotation (figée d'abord si elle venait encore du planning d'avant)
    normSS(t.items); const isNew = !tplDef(D.id); saveTpl(Object.assign({ id:D.id }, t)); if (isNew) { const rw = rotationWith(D.id); if (rw) putSettings(rw); } S.draft = null; S.confirm = null; S.view = 'training'; S.progTab = 'seances'; render(); toast('Séance enregistrée.');
  },
  'reset-tpl'(){ del('p_' + S.draft.id); S.draft = null; render(); toast('Version d’origine rétablie.'); },
  'del-tpl'(){ S.confirm = 'del-tpl'; render(); },
  'del-tpl-yes'(){ const id = S.draft.id; deleteTpl(id); S.draft = null; S.confirm = null; render(); toast('Séance supprimée.'); },
  'tpl-swipe-del'(b){ if (deleteTpl(b.dataset.v)) { render(); toast('Séance supprimée.'); } },
  'ex-swipe-del'(b){ const e = exDef(b.dataset.v); if (!e || !e.custom) return; del('x_' + b.dataset.v); render(); toast('Exercice supprimé.'); },
  'fd-swipe-del'(b){ const d = dayDoc(b.dataset.d); put('m_' + b.dataset.d, Object.assign({}, d, { items: d.items.filter(i => i.id !== b.dataset.v) })); render(); toast('Retiré du journal.'); },
  'intro-ok'(b){ putSettings({ intro: Object.assign({}, settings().intro, { [b.dataset.v]: true }) }); render(); },
  'draft-cancel'(){ const after = S.draft && S.draft.after; S.draft = after ? after.prevDraft || null : null; S.confirm = null; if (after) S.picker = after.picker; render(); },
  // Exercices
  'new-ex'(){ S.draft = { kind:'ex', isNew:true, id:null, data:blankEx() }; render(); window.scrollTo(0, 0); },
  // Fiche d'un exercice, ouverte depuis Entraînement › Exercices ou depuis Progrès (le retour nomme l'écran d'origine)
  'ex-fiche'(b){ S.fiche = b.dataset.v; S.ficheFrom = S.view === 'progress' ? 'progress' : 'exercices'; render(); window.scrollTo(0, 0); },
  'fiche-close'(){ S.fiche = null; S.ficheFrom = null; render(); },
  'edit-ex'(b){ const e = exDef(b.dataset.v); if (!e) return; const d = clone(e); delete d.id; delete d.custom; S.draft = { kind:'ex', isNew:false, id:e.id, data:d }; render(); window.scrollTo(0, 0); },
  'e-kind'(b){ S.draft.data.kind = b.dataset.v; if (b.dataset.v === 'plyo' && !S.draft.data.unit) S.draft.data.unit = 'sauts'; render(); },
  'e-cat'(b){ S.draft.data.cat = b.dataset.v; render(); },
  'e-mp'(b){ const m = S.draft.data.muscles; m.p = toggleIn(m.p, b.dataset.v); m.s = (m.s || []).filter(x => m.p.indexOf(x) < 0); render(); },
  'e-ms'(b){ const m = S.draft.data.muscles; m.s = toggleIn(m.s, b.dataset.v); m.p = (m.p || []).filter(x => m.s.indexOf(x) < 0); render(); },
  'e-flag'(b){ S.draft.data[b.dataset.v] = b.checked; },
  'save-ex'(){
    const D = S.draft; const e = D.data;
    if (!String(e.name || '').trim()) { toast('Donne un nom à l’exercice.'); $('#e-name').focus(); return; }
    const isSet = e.kind === 'load' || e.kind === 'bw';
    const lo = num(e.lo), hi = num(e.hi);
    if (isSet && (!(lo > 0) || !(hi >= lo))) { toast('Vérifie la fourchette de reps : le max doit être au moins égal au min.'); return; }
    if (isSet && !(e.muscles.p || []).length) { toast('Choisis au moins un muscle principal.'); return; }
    const out = { name:String(e.name).trim(), kind:e.kind, cat:e.cat || 'iso', sets:num(e.sets) || 3, lo:lo || 1, hi:hi || lo || 1, rest:num(e.rest) || 90, step:num(e.step) || 2.5, unit:e.unit || '', uni:!!e.uni, knee:!!e.knee, back:!!e.back, muscles:{ p:(e.muscles.p || []).slice(), s:(e.muscles.s || []).slice() }, cue:e.cue || '' };
    if (e.optional) out.optional = true;
    // Cardio : une seule « série », sa durée ; les allures restent celles de la bibliothèque
    if (e.kind === 'cardio') Object.assign(out, { cat:'cardio', sets:1, hi:out.lo, rest:0, unit:'min' });
    const id = D.id || ('c' + rid());
    put('x_' + id, out);
    const after = D.after; S.draft = after ? after.prevDraft || null : null; S.confirm = null;
    toast('Exercice enregistré.');
    if (after) { S.picker = after.picker; applyPick(id); return; }
    render();
  },
  'reset-ex'(){ del('x_' + S.draft.id); S.draft = null; render(); toast('Version d’origine rétablie.'); },
  'del-ex'(){ S.confirm = 'del-ex'; render(); },
  'del-ex-yes'(){ del('x_' + S.draft.id); S.draft = null; S.confirm = null; S.fiche = null; render(); toast('Exercice supprimé.'); },
  // Rotation : ordre, séances mises de côté, objectif, jours prévus. La rotation déduite est d'abord figée (ordre et mises de côté)
  'rot-up'(b){ moveRot(b.dataset.v, -1); },
  'rot-down'(b){ moveRot(b.dataset.v, 1); },
  'rot-toggle'(b){
    const f = frozenRot(); const id = b.dataset.v;
    if (f.rotation.indexOf(id) >= 0) { f.rotation = f.rotation.filter(x => x !== id); f.rotOff.push(id); } else { f.rotOff = f.rotOff.filter(x => x !== id); f.rotation.push(id); }
    putSettings(f); render();
  },
  'reset-rotation'(){ putSettings(programRotation((programOf() || {}).base)); render(); toast('Ordre du programme rétabli.'); },
  'per-week'(b){ putSettings({ perWeek: +b.dataset.v }); render(); },
  'plan-day'(b){
    const d = b.dataset.v; const lim = addDays(today(), -14); const cur = (settings().planned || []).filter(x => typeof x === 'string' && x >= lim);
    const on = cur.indexOf(d) >= 0; putSettings({ planned: on ? cur.filter(x => x !== d) : cur.concat([d]).sort() }); render(); toast(on ? 'Séance retirée.' : 'Séance prévue.');
  },
  'reset-plan'(){ const g = programOf(); if (!g || !PROGRAMS[g.base]) return; putSettings({ plan: buildPlan(g.base, g.days || []) }); render(); toast('Planning d’origine rétabli.'); },
  // Données
  async export(b){
    // navigator.share doit partir directement du clic : rien d'asynchrone avant
    const kind = b.dataset.v; const file = exportFile(kind);
    const saved = () => { if (kind === 'json') { putSettings({ lastExport: today() }); render(); } };
    if (!useShare(kind)) { downloadFile(file); saved(); toast('Fichier prêt.'); return; }
    try { await navigator.share({ files:[file] }); saved(); }
    catch (e) { if (e && e.name === 'AbortError') return; downloadFile(file); saved(); toast('Partage impossible : fichier téléchargé à la place.'); }
  }
};
// Croix d'un conseil d'Émile : la bulle se replie, puis l'action s'applique
function collapse(el){
  if (!el || !el.animate || matchMedia('(prefers-reduced-motion: reduce)').matches) return Promise.resolve();
  el.style.overflow = 'hidden';
  return el.animate([{ height: el.offsetHeight + 'px', opacity: 1 }, { height: '0px', opacity: 0 }], { duration: 220, easing: 'ease-in', fill: 'forwards' }).finished.catch(() => {});
}
document.addEventListener('click', e => {
  const b = e.target.closest('[data-act]'); if (!b || b.disabled) return;
  if (b.tagName === 'INPUT') return; // cases à cocher : gérées par change
  const fn = A[b.dataset.act]; if (!fn) return;
  e.preventDefault();
  if (b.classList.contains('emile-x')) { b.disabled = true; collapse(b.closest('.emile')).then(() => fn(b, e)); return; }
  fn(b, e);
});
document.addEventListener('input', e => {
  const t = e.target;
  if (t.matches('[data-f]')) { setField(t); return; }
  if (t.matches('[data-u]') && S.setup) { S.setup[t.dataset.u] = t.value; return; }
  if (t.matches('[data-pq]') && S.picker) { S.picker.q = t.value; const l = $('#pick-list'); if (l) l.innerHTML = pickerList(); return; }
  if (t.matches('[data-xq]')) { S.exQ = t.value; const l = $('#ex-list'); if (l) l.innerHTML = exerciseList(); return; }
  if (t.matches('[data-fq]') && S.food) { S.food.q = t.value; const l = $('#fd-list'); if (l) l.innerHTML = foodList(); return; }
  if (t.matches('[data-fg]') && S.food) { S.food.g = t.value; const pv = $('#fd-prev'); if (pv) pv.innerHTML = preview(S.food.sel, num(t.value)); return; }
  if (t.matches('[data-fn]') && S.food) { setN(t.value); const pv = $('#fd-prev'); if (pv) pv.innerHTML = preview(S.food.sel, num(S.food.g)); const cv = $('#fd-conv'); if (cv) cv.innerHTML = convText(unitOf(S.food), num(S.food.g)); return; }
  if (t.matches('[data-fc]') && S.food && S.food.draft) { S.food.draft[t.dataset.fc] = t.value; return; }
  if (t.id === 'sm-name' && S.food) { S.food.nameDraft = t.value; return; }
  if (t.matches('[data-rc]') && S.food && S.food.rec) { S.food.rec[t.dataset.rc] = t.value; const pv = $('#rec-prev'); if (pv) pv.innerHTML = recPreview(); return; }
  if (t.matches('[data-ri]') && S.food && S.food.rec) { const it = S.food.rec.items[+t.dataset.ri]; if (it) it.g = num(t.value); const pv = $('#rec-prev'); if (pv) pv.innerHTML = recPreview(); return; }
  if (t.matches('[data-rq]') && S.food && S.food.rec) { S.food.rec.q = t.value; const l = $('#rec-list'); if (l) l.innerHTML = recList(); return; }
  if (t.matches('[data-ac]') && S.act) { S.act[t.dataset.ac] = t.value; const pv = $('#act-prev'); if (pv) pv.innerHTML = actPreview(); return; }
  if (t.matches('[data-d]') && S.draft) { S.draft.data[t.dataset.d] = t.value; return; }
  if (t.matches('[data-it]') && S.draft) { const it = S.draft.data.items[+t.dataset.it]; if (it) it[t.dataset.k] = t.dataset.k === 'ss' ? (t.value || null) : t.value; return; }
  if (t.matches('[data-e]') && S.draft) { S.draft.data[t.dataset.e] = t.value; return; }
  if (t.matches('[data-b]')) {
    const d = today(); const id = 'b_' + d; const f = t.dataset.b;
    clearTimeout(bodyTimers[f]);
    bodyTimers[f] = setTimeout(() => { const cur = Object.assign({ date:d }, S.docs.get(id) || {}); const v = num(t.value); if (v == null) delete cur[f]; else cur[f] = v; put(id, cur); }, 600);
  }
});
// Photo d'exercice pas encore gardée et pas de connexion : message à la place des photos
document.addEventListener('error', e => {
  const box = e.target.closest && e.target.closest('.photos, .mv-photos'); if (!box) return;
  box.hidden = true; const par = box.parentElement; const m = par && par.querySelector('.photos-off'); if (m) m.hidden = false;
  const cap = par && par.querySelector('.mv-cap'); if (cap) cap.hidden = true;
}, true);
// Calendrier : glisser vers la gauche (mois suivant) ou vers la droite (mois précédent)
let swipe = null;
document.addEventListener('touchstart', e => { swipe = e.target.closest('.cal-month') ? { x:e.touches[0].clientX, y:e.touches[0].clientY } : null; }, { passive:true });
document.addEventListener('touchend', e => {
  if (!swipe || !S.calMonth) return;
  const t = e.changedTouches[0]; const dx = t.clientX - swipe.x, dy = t.clientY - swipe.y; swipe = null;
  if (Math.abs(dx) > 60 && Math.abs(dx) > 1.5 * Math.abs(dy)) { S.calMonth = addMonths(S.calMonth, dx < 0 ? 1 : -1); S.calDay = null; render(); }
}, { passive:true });
document.addEventListener('change', e => {
  const t = e.target;
  if (t.matches('input[type=checkbox][data-act]')) { const fn = A[t.dataset.act]; if (fn) fn(t); return; }
  if (t.matches('select[data-it]') && S.draft) { const it = S.draft.data.items[+t.dataset.it]; if (it) it[t.dataset.k] = t.dataset.k === 'ss' ? (t.value || null) : t.value; render(); return; }
  if (t.matches('[data-plan]')) { const p = Object.assign({}, planOf()); const v = t.value; p[t.dataset.plan] = v.indexOf('s:') === 0 ? { s:v.slice(2) } : { label:v.slice(2) }; putSettings({ plan:p }); toast('Planning mis à jour.'); return; }
  if (t.id === 'water-goal') { const ml = Math.round(num(t.value) * 20) * 50; if (!(ml >= WATER_RANGE[0] && ml <= WATER_RANGE[1])) { toast('Choisis un objectif entre 0,5 et 6 L par jour.'); render(); return; } putSettings({ waterGoal: ml }); render(); toast(nbsp('Objectif : ' + liters(ml) + ' L par jour.')); return; }
  if (t.id === 'glass') { putSettings({ glass: num(t.value) }); render(); toast('Verre de ' + t.value + ' mL.'); return; }
  if (t.matches('[data-n]')) { nField(t.dataset.n, t.value); return; }
  // Accueil, écran 3 : données demandées pour le calcul, vérifiées puis prises en compte
  if (t.matches('[data-u]') && S.setup && S.setup.step === 3) { const bad = profileError(t.dataset.u, t.value); if (bad) { toast(bad); return; } render(); return; }
  if (t.id === 'set-height') { const bad = profileError('height', t.value); if (bad) { toast(bad); render(); return; } putSettings({ height: num(t.value) }); toast('Taille enregistrée.'); return; }
  if (t.id === 'set-name') { const v = t.value.trim(); if (!v) { toast('Ton prénom ou pseudo est obligatoire.'); render(); return; } putSettings({ name: v }); render(); toast('Prénom enregistré.'); return; }
  if (t.id === 'set-birth') { const bad = profileError('birth', t.value); if (bad) { toast(bad); render(); return; } putSettings({ birth: t.value || null }); toast('Date de naissance enregistrée.'); return; }
  if (t.id === 'set-weight') { const bad = profileError('weight', t.value); if (bad || num(t.value) == null) { if (bad) toast(bad); render(); return; } saveWeight(num(t.value)); render(); toast('Poids enregistré.'); return; }
  if (t.id === 'set-sport') { putSettings({ sport: Object.assign({ train:[], match:[] }, settings().sport, { name: t.value.trim() }) }); render(); toast('Sport enregistré.'); return; }
  if (t.id === 'start-date' && t.value) { const st = mondayOf(t.value); putSettings({ start: st }); render(); toast(withDot('Début fixé au lundi ' + fmtDate(st))); return; }
  if (t.id === 'import-file' && t.files && t.files[0]) {
    const r = new FileReader();
    r.onload = () => {
      try {
        const j = JSON.parse(r.result); const docs = j && j.docs; if (!docs || typeof docs !== 'object') throw new Error('format');
        let n = 0; Object.keys(docs).forEach(id => { if (importable(id)) { put(id, docs[id]); n++; } });
        // Exports version 2 ou plus anciens : réglages complétés comme au chargement
        upgradeLegacy(); applyTheme(settings().theme);
        if (S.setup && S.setup.mode === 'welcome' && !needsSetup()) S.setup = null;
        toast(n + ' éléments importés.'); render();
      } catch (err) { toast('Fichier non reconnu : choisis un export JSON du carnet.'); }
    };
    r.readAsText(t.files[0]);
  }
});

// Silhouette en 3D : elle suit le doigt (0,6° par pixel), puis se cale de face ou de dos ; un toucher sans glisser la retourne.
// Un glissement surtout vertical reste un défilement de la page (touch-action: pan-y).
function turnTo(box, ry){
  const back = Math.round(ry / 180) % 2 !== 0;
  box.dataset.ry = ry; box.style.setProperty('--ry', ry + 'deg'); box.classList.toggle('back', back);
  box.querySelectorAll('[data-act="bm-side"]').forEach(b => { const on = (b.dataset.v === 'back') === back; b.classList.toggle('on', on); b.setAttribute('aria-pressed', String(on)); });
}
let turn = null;
document.addEventListener('pointerdown', e => {
  const st = e.isPrimary && e.target.closest && e.target.closest('.bm3d-stage'); const box = st && st.closest('.bm3d');
  turn = box ? { box, id:e.pointerId, x0:e.clientX, y0:e.clientY, ry0:+box.dataset.ry || 0, moved:false } : null;
});
document.addEventListener('pointermove', e => {
  const t = turn; if (!t || e.pointerId !== t.id) return; const dx = e.clientX - t.x0;
  if (!t.moved) { if (Math.abs(dx) < 6) return; if (Math.abs(e.clientY - t.y0) > Math.abs(dx)) { turn = null; return; } t.moved = true; t.box.classList.add('turning'); }
  t.ry = t.ry0 + dx * 0.6; t.box.style.setProperty('--ry', t.ry + 'deg');
  t.box.style.setProperty('--sx', (0.45 + 0.55 * Math.abs(Math.cos(t.ry * Math.PI / 180))).toFixed(3));
});
const turnEnd = e => {
  const t = turn; turn = null; if (!t || e.pointerId !== t.id) return;
  t.box.classList.remove('turning'); t.box.style.removeProperty('--sx');
  if (t.moved) turnTo(t.box, Math.round(t.ry / 180) * 180); else if (e.type === 'pointerup') turnTo(t.box, t.ry0 + 180);
};
document.addEventListener('pointerup', turnEnd); document.addEventListener('pointercancel', turnEnd);
