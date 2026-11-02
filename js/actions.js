// Actions de l’interface : clics, saisies et changements.
import { $, addDays, addMonths, capFirst, clone, fmtDate, fmtInt, fmtKg, mondayOf, num, rid, toast, today, toggleIn, withDot } from './util.js';
import { DAY_ORDER, PROGRAMS } from './library.js';
import { del, put, S } from './store.js';
import { activeWorkout, bodyweight, buildPlan, canon, excluded, exDef, itemsOf, mods, needsSetup, planOf, programOf, putSettings, saveTpl, settings, snapItem, sportInfo, tplDef, tplEst, tplItems, tplLower, upgradeLegacy, weekInfo } from './data.js';
import { findPRs, initItem } from './engine.js';
import { downloadFile, exportFile, useShare } from './backup.js';
import { requestWake, startRest, stopRest, unlockAudio, updateRest } from './timers.js';
import { applyTheme, render } from './render.js';
import { screenOf } from './nav.js';
import { pickerList } from './views/picker.js';
import { exerciseList } from './views/program.js';
import { newSetup } from './views/setup.js';
import { blankEx } from './views/editors.js';
import { checkDue, nutritionOf, profileData, setupData } from './views/goal.js';
import { planFor } from './nutrition.js';
import { dayDoc, fromOff, recentFoods, validBarcode } from './food.js';
import { foodFromDoc, foodList, preview, shown } from './views/food.js';
import { activityKcal, computeSessionKcal, EFFORT, glassOf, LEVELS, sportOf, waterOf } from './energy.js';
import { actDoc, actPreview } from './views/activity.js';

function startWorkout(tplId){
  if (!S.loaded) return;
  if (activeWorkout()) { S.view = 'training'; render(); return; }
  const t = tplDef(tplId); if (!t) return;
  const date = today(); const wk = weekInfo(date);
  if (!settings().start) putSettings({});
  const id = 'w_' + date.replace(/-/g, '') + '_' + rid();
  const items = tplItems(t).map(it => { const e = exDef(it.ex); return e ? snapItem(e, it) : null; }).filter(Boolean);
  const w = { date, tpl:tplId, name:t.name, cut:t.cut || '', lower:tplLower(t), est:tplEst(t), status:'en_cours', startedAt:Date.now(), week:wk.n, blockWeek:wk.bw, deload:wk.deload, items, ex:{}, targets:{} };
  items.forEach(it => initItem(w, it, wk));
  put(id, w);
  S.view = 'training'; S.summary = null; S.picker = null; S.draft = null; S.navHint = 'up';
  render(); window.scrollTo(0, 0); requestWake();
}
function finishWorkout(){
  const w = activeWorkout(); if (!w) return;
  w.status = 'terminée'; w.endedAt = Date.now(); w.duration = Math.round((w.endedAt - w.startedAt) / 60000);
  w.effort = 'classic'; w.kcal = computeSessionKcal(w, bodyweight());
  put(w.id, w);
  S.summary = { id:w.id, prs: findPRs(w) };
  stopRest(); S.view = 'today'; S.navHint = 'down'; render(); window.scrollTo(0, 0);
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
  if (U.prog !== 'custom' && !U.days.length) return ['Choisis au moins un jour.'];
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
function addEntry(day, entry){ const d = dayDoc(day); put('m_' + day, Object.assign({}, d, { date: day, items: (d.items || []).concat([entry]) })); }
function pickFood(f){
  const last = recentFoods(200).find(r => r.key === f.key);
  Object.assign(S.food, { mode:'portion', sel:f, g: last ? last.g : f.serving || 100, msg:null }); S.confirm = null;
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
    put('f_' + code, { src:'off', code, name:f.name, brand:f.brand, per100:f.per100, serving:f.serving, fetched: today() });
    pickFood(f);
  } catch (e) { if (S.food === F) notFound(navigator.onLine ? 'error' : 'offline'); }
}
document.addEventListener('barcode', e => { if (S.food && S.food.mode === 'scan') lookupBarcode(e.detail); });
const A = {
  // Chaque onglet retrouve sa position ; toucher l'onglet affiché remonte en haut
  tab(b){ const before = screenOf().key; const was = S.view; S.view = b.dataset.v; S.confirm = null; S.picker = null; S.draft = null; S.bilan = null; S.renaming = false; S.calMonth = null; S.calDay = null; S.fiche = null; S.exQ = ''; S.food = null; S.act = null; if (S.setup && S.setup.mode === 'change') S.setup = null;
    render(); if (was === b.dataset.v && before === screenOf().key) window.scrollTo({ top:0, behavior:'smooth' }); },
  // Premier lancement et programme
  'setup-prog'(b){ const U = S.setup; U.prog = b.dataset.v; if (PROGRAMS[U.prog]) U.days = PROGRAMS[U.prog].days.slice(); render(); },
  'setup-day'(b){ S.setup.days = toggleIn(S.setup.days, +b.dataset.v); render(); },
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
    const program = { base: custom ? null : U.prog, name, days: DAY_ORDER.filter(d => !custom && U.days.indexOf(d) >= 0) };
    const patch = { program, plan: buildPlan(program.base, program.days) };
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
  'fd-back'(){ if (S.food.edit) { S.food = null; } else { S.food.mode = 'search'; S.food.msg = null; } render(); },
  'fd-meal'(b){ S.food.meal = b.dataset.v; render(); },
  'fd-pick'(b){ const f = shown.get(b.dataset.v); if (f) pickFood(f); },
  'fd-gset'(b){ S.food.g = +b.dataset.v; render(); },
  'fd-save'(){
    const F = S.food; const g = num(F.g);
    if (g == null || g <= 0 || g > 5000) { toast('Indique la quantité en grammes, par exemple 120.'); const i = $('#fd-g'); if (i) i.focus(); return; }
    const f = F.sel; const entry = { id: F.edit || rid(), meal:F.meal, key:f.key, name:f.name, brand:f.brand || '', g, per100:f.per100 };
    if (f.serving) entry.serving = f.serving;
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
  'goal-edit'(){ A.profile(); const c = $('#goal-card'); if (c) c.scrollIntoView({ block:'start' }); },
  'prog-change'(){ S.setup = newSetup('change'); render(); window.scrollTo(0, 0); },
  // Profil, apparence, sous-onglets de Progrès
  profile(){ if (S.view !== 'profile' && S.view !== 'science') S.from = S.view; S.view = 'profile'; S.act = null; S.confirm = null; S.picker = null; S.draft = null; S.bilan = null; S.renaming = false; if (S.setup && S.setup.mode === 'change') S.setup = null; render(); window.scrollTo(0, 0); },
  science(){ S.view = 'science'; render(); window.scrollTo(0, 0); },
  'profile-back'(){ S.view = S.from || 'today'; render(); },
  prtab(b){ S.progressTab = b.dataset.v; S.confirm = null; render(); },
  // Calendrier : toucher un jour ouvre son mois et affiche ce jour ; flèches ou glissement pour changer de mois
  'cal-month'(){ S.calMonth = today().slice(0, 7); S.calDay = null; render(); },
  'cal-week'(){ S.calMonth = null; S.calDay = null; render(); },
  'cal-prev'(){ S.calMonth = addMonths(S.calMonth, -1); S.calDay = null; render(); },
  'cal-next'(){ S.calMonth = addMonths(S.calMonth, 1); S.calDay = null; render(); },
  'cal-day'(b){ const d = b.dataset.v; S.calMonth = d.slice(0, 7); S.calDay = S.calDay === d ? null : d; render(); },
  'cal-hist'(b){ S.view = 'progress'; S.progressTab = 'history'; S.openHist = b.dataset.v; S.calMonth = null; S.calDay = null; render(); const el = document.querySelector('[data-act="hist"][data-v="' + b.dataset.v + '"]'); if (el) el.scrollIntoView({ block:'start' }); },
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
  finish(){ finishWorkout(); },
  abandon(){ S.confirm = 'abandon'; render(); },
  'abandon-yes'(){ const w = activeWorkout(); if (w) del(w.id); S.confirm = null; stopRest(); S.view = 'today'; S.navHint = 'down'; render(); window.scrollTo(0, 0); toast('Séance supprimée.'); },
  'close-summary'(){ S.summary = null; render(); },
  // Effort de la séance qui vient de se terminer : sa dépense est recalculée
  effort(b){ const w = S.summary && S.docs.get(S.summary.id); if (!w || !EFFORT[b.dataset.v]) return; w.effort = b.dataset.v; w.kcal = computeSessionKcal(w, bodyweight()); put(S.summary.id, w); render(); },
  'adj-yes'(){ S.adjOk = true; render(); },
  'adj-no'(){ recordCheck('notfollowed'); toast('Objectif gardé : je referai le point dans 2 semaines.'); },
  'adj-apply'(){ const c = checkDue(); if (!c || c.status !== 'change') return; recordCheck('change', true); toast('Nouvel objectif : ' + fmtInt(c.kcal) + ' kcal par jour.'); },
  'adj-keep'(){ recordCheck(); },
  'adj-later'(){ recordCheck('skip'); },
  'adj-reset'(){ putSettings({ nutrition: Object.assign({}, nutritionOf(), { adjust: 0 }) }); render(); toast('Corrections annulées.'); },
  // Activités : ajout (éventuellement le sport prévu aujourd'hui), modification, suppression
  'act-add'(b){
    const v = b.dataset.v; const last = settings().lastAct || 'run';
    S.act = v ? { type:'sport', sport: sportOf(sportInfo().name), level:v, min:90, date:today() } : { type:last, date:today() };
    S.confirm = null; render(); window.scrollTo(0, 0);
  },
  'act-cancel'(){ S.act = null; S.confirm = null; render(); },
  'act-type'(b){ S.act.type = b.dataset.v; S.act.level = null; render(); },
  'act-level'(b){ S.act.level = b.dataset.v; render(); },
  'act-sport'(b){ S.act.sport = b.dataset.v; render(); },
  'act-edit'(b){ const o = S.docs.get(b.dataset.v); if (!o) return; S.act = Object.assign({}, o, { edit:b.dataset.v }); S.confirm = null; render(); window.scrollTo(0, 0); },
  'act-save'(){
    const A = S.act; const a = actDoc(A);
    if (!(a.min > 0 && a.min <= 900)) { toast('Indique la durée, en minutes.'); return; }
    if (a.type === 'run' && !(a.km > 0 && a.km <= 300)) { toast('Indique la distance, en kilomètres.'); return; }
    if (LEVELS[a.type] && !a.level) { toast('Choisis l’allure.'); return; }
    if (a.type === 'sport' && !(a.sport && a.level)) { toast('Choisis le sport, puis entraînement ou match.'); return; }
    if (a.kcal != null && !(a.kcal >= 0 && a.kcal <= 5000)) { toast('Calories : entre 0 et 5 000 kcal.'); return; }
    const date = A.date && A.date <= today() ? A.date : today();
    const doc = { date, type:a.type, min:a.min, at: A.at || Date.now() };
    if (a.type === 'run') doc.km = a.km;
    if (a.level) doc.level = a.level;
    if (a.type === 'sport') doc.sport = a.sport;
    if (a.type === 'other') { if (a.name) doc.name = a.name; doc.kcal = a.kcal; }
    else doc.kcal = activityKcal(doc, bodyweight());
    // L'identifiant porte la date : changer la date, c'est déplacer l'activité
    const id = A.edit && A.edit.indexOf('a_' + date + '_') === 0 ? A.edit : 'a_' + date + '_' + rid();
    if (A.edit && A.edit !== id) del(A.edit);
    put(id, doc); if (!A.edit) putSettings({ lastAct: a.type });
    S.act = null; render(); toast(A.edit ? 'Activité modifiée.' : 'Activité ajoutée.');
  },
  'act-del'(){ S.confirm = 'act-del'; render(); },
  'act-del-yes'(){ del(S.act.edit); S.act = null; S.confirm = null; render(); toast('Activité supprimée.'); },
  // Eau : un verre de plus ou de moins, ou une quantité en mL
  water(b){ addWater(+b.dataset.v * glassOf()); },
  'water-ml'(){ const i = $('#water-ml'); const v = num(i ? i.value : ''); if (!(v > 0 && v <= 3000)) { toast('Indique une quantité entre 1 et 3 000 mL.'); return; } addWater(v); },
  done(b){
    unlockAudio();
    const w = activeWorkout(); if (!w) return;
    const key = b.dataset.ex; const it = itemsOf(w).find(x => x.ex === key); if (!it) return;
    const i = +b.dataset.i; const st = w.ex[key]; const s = st.sets[i];
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
      s.done = true;
      const nxt = supersetNext(w, key);
      if (nxt) toast('Enchaîne : ' + nxt.name);
      else if (it.kind !== 'plyo') startRest(it.rest || 90, it.name + (i + 1 < st.sets.length ? ' · série ' + (i + 2) + ' ensuite' : ' · terminé'));
      else startRest(60, 'Récupère avant la série suivante');
    } else s.done = false;
    put(w.id, w); render();
  },
  check(b){ const w = activeWorkout(); if (!w) return; const st = w.ex[b.dataset.ex]; st.done = !st.done; put(w.id, w); render(); },
  unskip(b){ const w = activeWorkout(); if (!w) return; const st = w.ex[b.dataset.ex]; st.skip = false; if (!st.sets.length) { const it = itemsOf(w).find(x => x.ex === b.dataset.ex); for (let i = 0; i < (it ? it.sets : 3); i++) st.sets.push({ kg:null, reps:null, done:false }); } put(w.id, w); render(); },
  addset(b){ const w = activeWorkout(); if (!w) return; const st = w.ex[b.dataset.ex]; const last = st.sets[st.sets.length - 1]; st.sets.push({ kg: last ? last.kg : null, reps:null, done:false }); put(w.id, w); render(); },
  rmset(b){ const w = activeWorkout(); if (!w) return; const st = w.ex[b.dataset.ex]; if (st.sets.length > 1) st.sets.pop(); put(w.id, w); render(); },
  rir(b){ const w = activeWorkout(); if (!w) return; const st = w.ex[b.dataset.ex]; const v = +b.dataset.v; st.rir = st.rir === v ? null : v; put(w.id, w); render(); },
  knee(b){ const w = activeWorkout(); if (!w) return; const v = +b.dataset.v; w.knee = w.knee === v ? null : v; put(w.id, w); render(); },
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
  'edit-tpl'(b){ const t = tplDef(b.dataset.v); if (!t) return; S.draft = { kind:'tpl', isNew:false, id:t.id, data:{ name:t.name, focus:t.focus || '', cut:t.cut || '', items: clone(t.items) } }; render(); window.scrollTo(0, 0); },
  'it-up'(b){ const a = S.draft.data.items; const i = +b.dataset.i; if (i > 0) { const x = a[i]; a[i] = a[i - 1]; a[i - 1] = x; } render(); },
  'it-down'(b){ const a = S.draft.data.items; const i = +b.dataset.i; if (i < a.length - 1) { const x = a[i]; a[i] = a[i + 1]; a[i + 1] = x; } render(); },
  'it-rm'(b){ S.draft.data.items.splice(+b.dataset.i, 1); render(); },
  'save-tpl'(){
    const D = S.draft; const t = D.data;
    if (!t.name.trim()) { toast('Donne un nom à la séance.'); $('#d-name').focus(); return; }
    if (!t.items.length) { toast('Ajoute au moins un exercice.'); return; }
    saveTpl(Object.assign({ id:D.id }, t)); S.draft = null; S.confirm = null; S.view = 'training'; S.progTab = 'seances'; render(); toast('Séance enregistrée.');
  },
  'reset-tpl'(){ del('p_' + S.draft.id); S.draft = null; render(); toast('Version d’origine rétablie.'); },
  'del-tpl'(){ S.confirm = 'del-tpl'; render(); },
  'del-tpl-yes'(){ const id = S.draft.id; del('p_' + id); const p = Object.assign({}, planOf()); let ch = false; Object.keys(p).forEach(k => { if (p[k] && p[k].s === id) { p[k] = { label:'Repos' }; ch = true; } }); if (ch) putSettings({ plan:p }); S.draft = null; S.confirm = null; render(); toast('Séance supprimée.'); },
  'draft-cancel'(){ const after = S.draft && S.draft.after; S.draft = after ? after.prevDraft || null : null; S.confirm = null; if (after) S.picker = after.picker; render(); },
  // Exercices
  'new-ex'(){ S.draft = { kind:'ex', isNew:true, id:null, data:blankEx() }; render(); window.scrollTo(0, 0); },
  'ex-fiche'(b){ S.fiche = b.dataset.v; render(); window.scrollTo(0, 0); },
  'fiche-close'(){ S.fiche = null; render(); },
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
    const out = { name:String(e.name).trim(), kind:e.kind, cat:e.cat || 'iso', sets:num(e.sets) || 3, lo:lo || 1, hi:hi || lo || 1, rest:num(e.rest) || 90, step:num(e.step) || 2.5, unit:e.unit || '', uni:!!e.uni, knee:!!e.knee, muscles:{ p:(e.muscles.p || []).slice(), s:(e.muscles.s || []).slice() }, cue:e.cue || '' };
    if (e.optional) out.optional = true;
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
document.addEventListener('click', e => {
  const b = e.target.closest('[data-act]'); if (!b || b.disabled) return;
  if (b.tagName === 'INPUT') return; // cases à cocher : gérées par change
  const fn = A[b.dataset.act]; if (fn) { e.preventDefault(); fn(b, e); }
});
document.addEventListener('input', e => {
  const t = e.target;
  if (t.matches('[data-f]')) { setField(t); return; }
  if (t.matches('[data-u]') && S.setup) { S.setup[t.dataset.u] = t.value; return; }
  if (t.matches('[data-pq]') && S.picker) { S.picker.q = t.value; const l = $('#pick-list'); if (l) l.innerHTML = pickerList(); return; }
  if (t.matches('[data-xq]')) { S.exQ = t.value; const l = $('#ex-list'); if (l) l.innerHTML = exerciseList(); return; }
  if (t.matches('[data-fq]') && S.food) { S.food.q = t.value; const l = $('#fd-list'); if (l) l.innerHTML = foodList(); return; }
  if (t.matches('[data-fg]') && S.food) { S.food.g = t.value; const pv = $('#fd-prev'); if (pv) pv.innerHTML = preview(S.food.sel, num(t.value)); return; }
  if (t.matches('[data-fc]') && S.food && S.food.draft) { S.food.draft[t.dataset.fc] = t.value; return; }
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
  const box = e.target.closest && e.target.closest('.photos'); if (!box) return;
  box.hidden = true; const m = box.nextElementSibling; if (m && m.classList.contains('photos-off')) m.hidden = false;
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
  if (t.matches('select[data-it]') && S.draft) { const it = S.draft.data.items[+t.dataset.it]; if (it) it.ss = t.value || null; return; }
  if (t.matches('[data-plan]')) { const p = Object.assign({}, planOf()); const v = t.value; p[t.dataset.plan] = v.indexOf('s:') === 0 ? { s:v.slice(2) } : { label:v.slice(2) }; putSettings({ plan:p }); toast('Planning mis à jour.'); return; }
  if (t.id === 'prog-ex') { S.progEx = t.value; render(); return; }
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
        let n = 0; Object.keys(docs).forEach(id => { if (/^(w_|k_|t_|b_|x_|p_|m_|f_|a_|e_)[A-Za-z0-9_\-.]+$/.test(id) || id === 'settings') { put(id, docs[id]); n++; } });
        // Exports version 2 ou plus anciens : réglages complétés comme au chargement
        upgradeLegacy(); applyTheme(settings().theme);
        if (S.setup && S.setup.mode === 'welcome' && !needsSetup()) S.setup = null;
        toast(n + ' éléments importés.'); render();
      } catch (err) { toast('Fichier non reconnu : choisis un export JSON du carnet.'); }
    };
    r.readAsText(t.files[0]);
  }
});
