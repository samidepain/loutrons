// Moteur de progression : objectifs de chaque exercice, records, séries par muscle, alerte de fatigue, bilan de bloc.
import { addDays, clamp, daysBetween, e1rm, fmtKg, lowFirst, num, roundTo, today } from './util.js';
import { DAY_ORDER, MUSCLES } from './library.js';
import { bestE1, blockRange, bodyDocs, bodyweight, canon, exDef, history, itemsOf, jumpsOn, kindOf, kneeAlert, kneeEntries, kneeOn, maxKg, musclesOf, planDay, settings, sportInfo, testForBlock, topSets, tplDef, tplItems, validSets, weekInfo, workouts } from './data.js';

/* ================= Moteur de progression =================
   Sources : règle « 2 pour 2 » de la NSCA et paliers de terrain (la position de l'ACSM de 2026 ne fixe pas de chiffre),
   Plotkin et al. 2022 (progresser en reps ou en charge : résultats proches),
   Robinson et al. 2024 et ACSM 2026 (s'arrêter à 1-2 reps de l'échec suffit), Bell et al. 2023 et Coleman et al. 2024 (décharge). */
const PCT = { iso:[0.02, 0.05], upper:[0.025, 0.05], lower:[0.05, 0.10] };
export function targetRIR(e, wk){ if (e.cat === 'iso') return 1; if (wk && wk.bw === 5 && !(e.knee && kneeOn())) return 1; return 2; }
export function computeTarget(e, wk, excludeId){
  const alert = kneeAlert(); const knee = !!e.knee && alert;
  if (e.kind === 'check') return { type:'check', label:'À faire', text:e.cue || '' };
  if (e.kind === 'plyo') {
    if (alert) return { type:'skip', label:'Suspendu', sets:0, text:'Genou au-dessus de 3/10 ces 10 derniers jours : pas de sauts pour l’instant.' };
    if (wk.busy) return { type:'skip', label:'Pas cette semaine', sets:0, text:'Semaine chargée en ' + lowFirst(sportInfo().name) + ' : pas de sauts en salle.' };
    const n = wk.deload ? Math.max(1, Math.ceil(e.sets / 2)) : e.sets;
    return { type: e.optional ? 'opt' : 'plyo', label: wk.deload ? 'Décharge' : (e.optional ? 'Optionnel' : 'Sauts'), sets:n, reps:e.lo,
      text: wk.deload ? 'Semaine de décharge : moitié des séries.' : (e.optional ? (e.cue || '') : 'Qualité avant quantité : chaque saut au maximum, arrête si la hauteur baisse.') };
  }
  const lo = e.lo, hi = e.hi, step = e.step > 0 ? e.step : 2.5, tr = targetRIR(e, wk);
  const nSets = wk.deload ? Math.max(1, Math.round(e.sets * 2 / 3)) : e.sets;
  const fill = v => Array(nSets).fill(v);
  const bw = e.kind === 'bw' ? bodyweight() : null;
  const tot = kg => e.kind === 'bw' ? (bw || 0) + kg : kg;
  const all = history(e.id, excludeId); const prog = all.filter(h => !h.deload);
  const base = prog[0] || all[0];
  const rirTxt = r => r >= 4 ? '4+' : String(r);
  if (!base) return { type:'calib', label:'Calibration', sets:nSets, kg:null, reps:fill(lo), rir:tr,
    text: e.kind === 'bw' ? 'Première fois : commence au poids du corps (lest 0), vise ' + lo + '-' + hi + ' reps et note tes reps en réserve.'
      : 'Première fois : choisis une charge qui te permet ' + lo + '-' + hi + ' reps avec 2-3 reps en réserve, et note-les.' };
  const kg = maxKg(base); const top = topSets(base); const last = top[top.length - 1]; const rir = base.rir;
  if (wk.deload) return { type:'deload', label:'Décharge', sets:nSets, kg, reps:fill(lo), rir:3,
    text:'Même charge, environ 1/3 de séries en moins, 3-4 reps en réserve : on baisse le volume et on garde l’intensité.' };
  const allTop = top.length >= e.sets && top.every(s => s.reps >= hi);
  const prev = prog[1];
  const prevTop = !!prev && maxKg(prev) === kg && topSets(prev).length >= e.sets && topSets(prev).every(s => s.reps >= hi);
  if (allTop && !knee) {
    if ((rir != null && rir >= 2) || prevTop) {
      const range = PCT[e.cat] || PCT.iso; const pct = (rir != null && rir >= 3) ? range[1] : range[0];
      const L = tot(kg);
      let inc = (e.kind === 'bw' && !bw) ? step : Math.max(step, roundTo(L * pct, step));
      const nk = roundTo(kg + inc, 0.25);
      const effort = last.reps + (rir != null ? rir : tr);
      const est = e1rm(L, effort);
      const rt = clamp(Math.round(30 * (est / tot(nk) - 1) - tr), lo, hi);
      const why = (rir != null && rir >= 2) ? hi + ' reps sur toutes les séries avec ' + rirTxt(rir) + ' reps en réserve' : hi + ' reps sur toutes les séries deux séances de suite';
      const pctTxt = L > 0 ? ' (≈ ' + Math.round(inc / L * 100) + ' %' + (e.kind === 'bw' ? ' du poids total avec ton corps' : '') + ')' : '';
      return { type:'up', label:'+' + fmtKg(inc) + ' kg', sets:nSets, kg:nk, reps:fill(rt), rir:tr,
        text: why + ' : +' + fmtKg(inc) + ' kg' + pctTxt + '. À cette charge, vise ' + rt + ' reps avec ' + tr + ' en réserve.'
          + (L > 0 && inc / L > range[1] + 0.005 ? ' C’est plus que les ' + Math.round(range[1] * 100) + ' % conseillés parce que c’est le plus petit palier de ton matériel : si c’est trop dur, garde l’ancienne charge et ajoute des reps.' : '')
          + (e.kind === 'bw' && !bw ? ' Note ton poids de corps pour un calcul plus précis.' : '') };
    }
    return { type:'confirm', label:'À confirmer', sets:nSets, kg, reps:fill(hi), rir:tr,
      text:'Haut de fourchette atteint. Refais ' + hi + ' reps partout, ou note au moins 2 reps en réserve sur la dernière série : la charge montera ensuite.' };
  }
  const below = top.filter(s => s.reps < lo).length;
  if (!knee && kg > 0 && below >= Math.ceil(top.length / 2)) {
    const est = e1rm(tot(kg), last.reps + (rir != null ? rir : 0));
    let nk = est / (1 + (lo + tr) / 30) - (e.kind === 'bw' ? (bw || 0) : 0);
    nk = Math.floor(nk / step) * step; if (nk >= kg) nk = kg - step; nk = Math.max(0, roundTo(nk, 0.25));
    return { type:'down', label:'−' + fmtKg(kg - nk) + ' kg', sets:nSets, kg:nk, reps:fill(lo), rir:tr,
      text:'Sous ' + lo + ' reps sur la plupart des séries : ' + fmtKg(nk) + ' kg te remet dans la fourchette avec ' + tr + ' reps en réserve (calcul d’après ta force estimée).' };
  }
  if (!knee && kg > 0 && prog.length >= 3) {
    const h3 = prog.slice(0, 3);
    const best = h => Math.max.apply(null, topSets(h).map(s => e1rm(tot(maxKg(h)), s.reps)));
    if (h3.every(h => maxKg(h) === kg) && best(h3[0]) <= best(h3[2])) {
      let nk = Math.floor((kg * 0.9) / step) * step; if (nk >= kg) nk = kg - step; nk = Math.max(0, roundTo(nk, 0.25));
      return { type:'reset', label:'Relance −10 %', sets:nSets, kg:nk, reps:fill(lo), rir:tr,
        text:'Pas de progrès depuis 3 séances à ' + fmtKg(kg) + ' kg : repars à ' + fmtKg(nk) + ' kg et remonte. C’est une règle de terrain, pas un résultat d’étude.' };
    }
  }
  if (knee) {
    const reps = []; for (let i = 0; i < nSets; i++) { const r = (top[i] || last).reps; reps.push(clamp(r, lo, hi)); }
    return { type:'hold', label:'Maintien', sets:nSets, kg, reps, rir:2, text:'Genou sensible ces derniers jours : garde la charge et une amplitude confortable, sans chercher de record.' };
  }
  const add = rir == null ? 1 : rir >= 3 ? 2 : rir <= 0 ? 0 : 1;
  const reps = []; for (let i = 0; i < nSets; i++) { const r = (top[i] || last).reps; reps.push(clamp(r + add, lo, hi)); }
  const txt = rir == null ? 'Même charge, +1 rep par série jusqu’à ' + hi + '. Note tes reps en réserve pour des objectifs plus précis.'
    : rir >= 3 ? 'Tu avais ' + rirTxt(rir) + ' reps en réserve : +2 reps par série pour te rapprocher de ' + tr + ' en réserve.'
    : rir <= 0 ? 'Tu étais à l’échec : refais les mêmes reps proprement avant d’en ajouter.'
    : 'Même charge, +1 rep par série jusqu’à ' + hi + ', avec ' + tr + ' rep' + (tr > 1 ? 's' : '') + ' en réserve.';
  return { type: add ? 'reps' : 'hold', label: add ? '+' + add + ' rep' + (add > 1 ? 's' : '') : 'Consolide', sets:nSets, kg, reps, rir:tr, text:txt };
}
export function warmup(e, t){
  if (e.kind !== 'load' || (e.cat !== 'lower' && e.cat !== 'upper') || t.kg == null || t.kg < 20) return '';
  const step = e.step > 0 ? e.step : 2.5;
  const r = p => fmtKg(Math.max(step, Math.round(t.kg * p / step) * step));
  return 'Montée en charge : ' + r(0.5) + ' × 8 · ' + r(0.7) + ' × 4 · ' + r(0.85) + ' × 2';
}
export function initItem(w, it, wk){
  const e = Object.assign({}, exDef(it.ex) || {}, it, { id: canon(it.ex) });
  const t = computeTarget(e, wk, w.id);
  w.targets[it.ex] = t;
  const sets = [];
  if (e.kind !== 'check') { const n = t.sets == null ? e.sets : t.sets; for (let i = 0; i < n; i++) sets.push({ kg: e.kind === 'plyo' ? null : (t.kg == null ? null : t.kg), reps:null, done:false }); }
  w.ex[it.ex] = { sets, done:false, rir:null, skip: t.type === 'skip' || t.type === 'opt' };
}
export function findPRs(w){
  const out = []; const bw = bodyweight();
  itemsOf(w).forEach(it => {
    if (it.kind !== 'load' && it.kind !== 'bw') return;
    const cur = validSets(w.ex[it.ex] && w.ex[it.ex].sets).map(s => ({ kg:num(s.kg) || 0, reps:num(s.reps) }));
    if (!cur.length) return;
    const prev = history(it.ex, w.id); if (!prev.length) return;
    const tot = kg => it.kind === 'bw' ? (bw || 0) + kg : kg;
    const best = Math.max.apply(null, cur.map(s => e1rm(tot(s.kg), s.reps)));
    const old = Math.max.apply(null, prev.map(h => Math.max.apply(null, h.sets.map(s => e1rm(tot(s.kg), s.reps)))));
    if (best > old + 0.01) out.push(it.name + ' : force estimée ' + fmtKg(Math.round(best)) + ' kg (+' + fmtKg(Math.round((best - old) * 10) / 10) + ')');
  });
  return out;
}
export function muscleDone(from, to){
  const m = {}; MUSCLES.forEach(x => { m[x] = 0; });
  workouts().filter(w => w.date >= from && w.date <= to).forEach(w => {
    Object.keys(w.ex || {}).forEach(k => {
      const kind = kindOf(k, w); if (kind === 'plyo' || kind === 'check') return;
      const n = validSets(w.ex[k].sets).length; if (!n) return;
      const ms = musclesOf(k, w);
      (ms.p || []).forEach(x => { if (m[x] != null) m[x] += n; });
      (ms.s || []).forEach(x => { if (m[x] != null) m[x] += n * 0.5; });
    });
  });
  return m;
}
export function musclePlanned(){
  const m = {}; MUSCLES.forEach(x => { m[x] = 0; });
  DAY_ORDER.forEach(wd => { const p = planDay(wd); if (!p.s) return; const t = tplDef(p.s); if (!t) return;
    tplItems(t).forEach(it => { const e = exDef(it.ex); if (!e || e.kind === 'plyo' || e.kind === 'check') return; const n = it.sets || e.sets || 0;
      (e.muscles.p || []).forEach(x => { if (m[x] != null) m[x] += n; }); (e.muscles.s || []).forEach(x => { if (m[x] != null) m[x] += n * 0.5; }); }); });
  return m;
}
export function fatigueCheck(){
  const d = today(); const wk = weekInfo(d);
  if (wk.deload || settings().fatigueDismiss === wk.wk) return null;
  const recent = workouts().filter(w => w.status === 'terminée' && !w.deload && w.date >= addDays(d, -8));
  const drops = []; let compared = 0;
  recent.forEach(w => {
    Object.keys(w.ex || {}).forEach(k => {
      const kind = kindOf(k, w); if (kind !== 'load' && kind !== 'bw') return;
      const h = history(k, null).filter(x => !x.deload);
      const i = h.findIndex(x => x.date === w.date && x.at === (w.startedAt || 0));
      if (i < 0 || !h[i + 1]) return;
      compared++;
      const cur = bestE1(canon(k), h[i]), prev = bestE1(canon(k), h[i + 1]);
      if (cur < prev * 0.975) { const e = exDef(k); drops.push((e ? e.name : k) + ' (−' + Math.max(3, Math.round((1 - cur / prev) * 100)) + ' %)'); }
    });
  });
  if (drops.length >= 3 && drops.length >= compared * 0.4) {
    const sl = bodyDocs().filter(b => b.date >= addDays(d, -3) && num(b.sleep) > 0);
    return { drops, compared, avgSleep: sl.length ? sl.reduce((a, b) => a + num(b.sleep), 0) / sl.length : null };
  }
  return null;
}
export function blockReport(block){
  const r = blockRange(block); const d = today(); const to = r.to < d ? r.to : d;
  const finished = r.to < d;
  const weeks = Math.max(1, Math.min(6, Math.floor(daysBetween(r.from, to) / 7) + 1));
  const done = workouts().filter(w => w.status === 'terminée' && w.date >= r.from && w.date <= to);
  const perWeek = DAY_ORDER.filter(x => planDay(x).s).length;
  const planned = perWeek * weeks;
  const ids = new Set(); done.forEach(w => Object.keys(w.ex || {}).forEach(k => ids.add(canon(k))));
  const forces = [];
  ids.forEach(id => {
    const e = exDef(id); if (!e || (e.kind !== 'load' && e.kind !== 'bw')) return;
    const h = history(id, null).filter(x => !x.deload && x.date >= r.from && x.date <= to).reverse();
    if (h.length < 2) return;
    let a, b;
    if (e.kind === 'bw' && !bodyweight()) { a = h[0].sets.reduce((s, x) => s + x.reps, 0); b = h[h.length - 1].sets.reduce((s, x) => s + x.reps, 0); }
    else { a = bestE1(id, h[0]); b = bestE1(id, h[h.length - 1]); }
    forces.push({ id, name:e.name, from:a, to:b, pct: a > 0 ? (b / a - 1) * 100 : 0, n:h.length, unit: (e.kind === 'bw' && !bodyweight()) ? 'reps' : 'kg' });
  });
  forces.sort((x, y) => y.pct - x.pct);
  const md = muscleDone(r.from, to); const mp = musclePlanned(); const avg = {}; MUSCLES.forEach(m => { avg[m] = md[m] / weeks; });
  const knee = kneeEntries().filter(k => k.date >= r.from && k.date <= to);
  const kneeMax = knee.length ? Math.max.apply(null, knee.map(k => k.v)) : null; const kneeHigh = knee.filter(k => k.v > 3).length;
  const bd = bodyDocs().filter(b => b.date >= r.from && b.date <= to); const wts = bd.filter(b => num(b.weight) > 0);
  let wc = null;
  if (wts.length >= 2) { const a = num(wts[0].weight), b = num(wts[wts.length - 1].weight); const span = Math.max(1, daysBetween(wts[0].date, wts[wts.length - 1].date) / 7); wc = { from:a, to:b, kg:b - a, pctWeek: ((b / a - 1) * 100) / span }; }
  const sl = bd.filter(b => num(b.sleep) > 0); const sleepAvg = sl.length ? sl.reduce((a, b) => a + num(b.sleep), 0) / sl.length : null; const shortN = sl.filter(b => num(b.sleep) < 6).length;
  const test = testForBlock(block); const prevTest = testForBlock(block - 1);
  const tips = [];
  if (planned) {
    const ratio = done.length / planned;
    if (ratio < 0.75) tips.push(['warn', 'Régularité : ' + done.length + ' séances sur ' + planned + ' prévues. La régularité passe avant le reste ; si le planning est trop chargé, mieux vaut 3 séances tenues que 4 à moitié faites.']);
    else tips.push(['good', 'Régularité : ' + done.length + ' séances sur ' + planned + ' prévues, c’est solide.']);
  }
  const stag = forces.filter(f => f.pct < 1 && f.n >= 3);
  if (stag.length) tips.push(['warn', 'Pas de progrès sur : ' + stag.map(f => f.name).join(', ') + '. Vérifie que tu notes tes reps en réserve, essaie une autre fourchette de reps, ou remplace l’exercice avec le bouton Remplacer.']);
  const up = forces.filter(f => f.pct >= 1);
  if (up.length) tips.push(['good', 'Progrès sur ' + up.length + ' exercice' + (up.length > 1 ? 's' : '') + ', le meilleur : ' + up[0].name + ' (+' + fmtKg(Math.round(up[0].pct * 10) / 10) + ' %).']);
  const low = MUSCLES.filter(m => mp[m] >= 3 && avg[m] < mp[m] * 0.6);
  if (low.length) tips.push(['warn', 'Volume nettement sous le prévu pour : ' + low.join(', ') + '. Ce sont souvent les exercices coupés en fin de séance ; place-les plus tôt ou raccourcis autre chose.']);
  if (kneeOn() && kneeMax != null) {
    if (kneeHigh > 0) tips.push(['bad', 'Genou : ' + kneeHigh + ' jour' + (kneeHigh > 1 ? 's' : '') + ' au-dessus de 3/10 (max ' + kneeMax + '/10). Garde une amplitude confortable sur les exercices sensibles ; si ça se répète, fais évaluer ton genou par un kiné.']);
    else if (knee.length >= 5) tips.push(['good', 'Genou stable sous 3/10 tout le bloc : tu peux continuer à élargir l’amplitude au leg extension et garder les sauts.']);
  }
  if (wc) {
    // Rythme comparé à l'objectif choisi (suivi de l'alimentation) ; sans objectif, à la prise de masse musculaire, comme avant
    const p = wc.pctWeek; const pc = fmtKg(Math.round(Math.abs(p) * 100) / 100); const kgTxt = (wc.kg >= 0 ? '+' : '') + fmtKg(Math.round(wc.kg * 10) / 10) + ' kg';
    const nu = settings().nutrition || {}; const goal = nu.on ? (nu.goal || 'keep') : 'gain';
    if (goal === 'lose') tips.push(p <= -1.1 ? ['warn', 'Baisse rapide (' + pc + ' % par semaine) : au-delà de 1 %, tu risques de perdre aussi de la masse musculaire.']
      : p <= -0.4 ? ['good', 'Poids en baisse de ' + pc + ' % par semaine : dans la cible de 0,5 à 1 % pour perdre de la masse grasse en préservant ta masse musculaire.']
      : ['info', 'Poids ' + (p < 0 ? 'en légère baisse' : 'stable ou en hausse') + ' (' + kgTxt + '). Pour perdre de la masse grasse en préservant ta masse musculaire, la cible courante est une baisse de 0,5 à 1 % du poids par semaine (Helms et al., 2014).']);
    else if (goal === 'keep') tips.push(Math.abs(p) < 0.25 ? ['good', 'Poids stable (' + kgTxt + ') : conforme à ton objectif.']
      : ['info', 'Ton poids ' + (p > 0 ? 'monte' : 'baisse') + ' de ' + pc + ' % par semaine (' + kgTxt + ') alors que tu vises à le garder : ajuste un peu ce que tu manges.']);
    else tips.push(p < 0.1 ? ['info', 'Poids stable (' + kgTxt + '). Pour prendre de la masse musculaire, la cible courante est une hausse de 0,25 à 0,5 % du poids par semaine (Iraki et al., 2019).']
      : p > 0.6 ? ['warn', 'Hausse rapide (' + pc + ' % par semaine) : au-dessus de 0,5 %, une plus grande part risque d’être de la masse grasse.']
      : ['good', 'Poids en hausse de ' + pc + ' % par semaine : dans la cible de 0,25 à 0,5 % pour prendre de la masse musculaire.']);
  }
  if (sleepAvg != null && sleepAvg < 7) tips.push(['info', 'Sommeil moyen ' + fmtKg(Math.round(sleepAvg * 10) / 10) + ' h' + (shortN ? ', dont ' + shortN + ' nuit' + (shortN > 1 ? 's' : '') + ' sous 6 h' : '') + '. Les recommandations pour les adultes visent au moins 7 h.']);
  if (jumpsOn() && test && prevTest) { const dlt = test.cm - prevTest.cm; tips.push([dlt >= 0 ? 'good' : 'warn', 'Détente : ' + fmtKg(test.cm) + ' cm contre ' + fmtKg(prevTest.cm) + ' cm au bloc précédent (' + (dlt >= 0 ? '+' : '') + fmtKg(Math.round(dlt * 10) / 10) + ' cm).']); }
  return { block, r, to, finished, weeks, done, planned, forces, avg, mp, kneeMax, kneeHigh, kneeN:knee.length, wc, sleepAvg, shortN, test, prevTest, tips };
}
