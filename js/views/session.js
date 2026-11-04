// Écran Séance : un exercice ouvert à la fois, la série en cours avec − et +, les autres séries sur une ligne.
import { capFirst, esc, fmtDate, fmtKg, fmtRest, lowFirst, num } from '../util.js';
import { JUMP_PROTOCOL } from '../library.js';
import { S } from '../store.js';
import { activeWorkout, allTpl, exDef, history, itemsOf, jumpsOn, kneeOn, sessionFocus, testDue, testForBlock, weekInfo, wName } from '../data.js';
import { lastCardio, warmup } from '../engine.js';
import { kneeChips } from '../render.js';
import { noTplCard } from './program.js';
import { emile } from '../emile.js';
import { hasMovement } from './movement.js';

export function viewSession(){
  const w = S.loaded && activeWorkout();
  if (!w && S.loaded && !allTpl().length) return noTplCard();
  if (!w) return '<section class="card"><h2>Pas de séance en cours</h2><p class="muted">Choisis la séance à faire : les objectifs viennent de tes dernières séances.</p><div class="row">' +
    allTpl().map(t => '<button type="button" class="btn primary" data-act="start" data-v="' + esc(t.id) + '"' + (S.loaded ? '' : ' disabled') + '>' + esc(t.name) + '</button>').join('') + '</div></section>';
  const items = itemsOf(w);
  let total = 0, done = 0;
  items.forEach(it => { const st = w.ex[it.ex]; if (!st || st.skip) return; if (it.kind === 'check') { total++; if (st.done) done++; } else { total += st.sets.length; done += st.sets.filter(s => s.done).length; } });
  const pct = total ? Math.round(done / total * 100) : 0;
  let h = '<div class="sess-head"><div class="row between"><div class="stack" style="gap:2px"><h1>' + esc(wName(w)) + '</h1><span class="muted small">Semaine ' + w.week + ' · ' + (w.deload ? 'décharge' : 'bloc semaine ' + w.blockWeek + '/6') + (w.est ? ' · environ ' + w.est + ' min' : '') + '</span></div><span id="elapsed" class="clock">0:00</span></div>';
  h += '<div class="bar" aria-label="Avancement"><i style="width:' + pct + '%"></i></div><span class="muted small">' + done + '/' + total + ' séries validées</span></div>';
  const b = S.docs.get('b_' + w.date) || {};
  if (num(b.sleep) != null && num(b.sleep) < 6) h += emile('<p>Nuit courte (' + fmtKg(num(b.sleep)) + ' h) : vise les objectifs, mais garde 1 rep de plus en réserve et ne force pas de record aujourd’hui.</p>', { tone:'warn', key:'sleep:' + w.id });
  if (w.lower && jumpsOn() && testDue(w.date)) {
    h += '<section class="card plan"><div class="stack" style="gap:4px"><h3>Test de détente du bloc ' + weekInfo(w.date).block + '</h3><p class="small">' + esc(JUMP_PROTOCOL) + '</p></div>';
    h += '<div class="fields">' + [0,1,2].map(i => '<label class="f"><span>Essai ' + (i + 1) + ' (cm)</span><input class="n" id="jump-' + i + '" inputmode="decimal" placeholder="cm"></label>').join('') + '</div>';
    const prevT = testForBlock(weekInfo(w.date).block - 1);
    h += (prevT ? '<p class="muted small">Bloc précédent : ' + fmtKg(prevT.cm) + ' cm.</p>' : '') + '<button type="button" class="btn primary" data-act="save-jump">Enregistrer le test</button></section>';
  }
  h += emile('<p>Plus de 75 min : si tu manques de temps, coupe ' + (w.cut ? 'dans cet ordre : ' + esc(w.cut) : 'les dernières séries d’isolation') + '. Ne raccourcis pas les repos des mouvements lourds.</p>', { id:'cutwarn', hidden:true, tone:'warn', key:'long:' + w.id });
  const focus = sessionFocus(w, { open:S.sessOpen, ask:S.rirAsk });
  const one = (it, k) => focus.open.indexOf(it.ex) >= 0 ? openCard(it, w, k, focus) : exLine(it, w);
  let i = 0;
  while (i < items.length) {
    const it = items[i];
    if (it.ss) {
      let j = i; const grp = [];
      while (j < items.length && items[j].ss === it.ss) { grp.push(j); j++; }
      h += '<div class="group"><span class="gh">Superset : alterne sans repos, puis repos ' + fmtRest(items[grp[grp.length - 1]].rest || 90) + '</span>' + grp.map(k => one(items[k], k)).join('') + '</div>';
      i = j;
    } else { h += one(it, i); i++; }
  }
  h += '<button type="button" class="btn" data-act="pick-add">+ Ajouter un exercice à cette séance</button>';
  if (w.lower && kneeOn()) h += '<section class="card"><h3>Genou pendant la séance</h3><p class="muted small">Douleur maximale ressentie, de 0 à 10.</p>' + kneeChips(w.knee == null ? null : w.knee, 'knee') + '</section>';
  h += '<section class="card"><h3>Notes</h3><textarea id="notes-' + w.id + '" data-f="notes" placeholder="Sensations, réglages de machine, ce qui a gêné…">' + esc(w.notes || '') + '</textarea></section>';
  // Une seule action orange : « Valider la série » pendant la séance, « Terminer la séance » une fois tout validé
  h += '<button type="button" class="btn' + (focus.open.length || focus.ask ? '' : ' primary') + ' big" data-act="finish">Terminer la séance</button>';
  h += S.confirm === 'abandon' ? '<button type="button" class="btn danger big" data-act="abandon-yes">Confirmer : supprimer cette séance</button>' : '<button type="button" class="btn ghost big" data-act="abandon">Abandonner la séance</button>';
  return h;
}

const finished = (it, st) => it.kind === 'check' ? !!st.done : st.sets.length > 0 && st.sets.every(s => s.done);
// Reps affichées : celles notées, sinon celles visées pour cette série, sinon le bas de la fourchette
const repsOf = (it, s, t, i) => num(s.reps) != null ? num(s.reps) : (Array.isArray(t.reps) && t.reps[i] != null ? t.reps[i] : it.lo);
const kgText = (it, v) => it.kind === 'bw' ? (v > 0 ? 'Lest ' + fmtKg(v) + ' kg' : 'PdC') : fmtKg(v) + ' kg';
// Une série en texte : « 49,5 kg × 6 », « PdC × 9 », « 4 sauts » ; charge encore inconnue (calibration) : « 6 reps »
const setText = (it, s, t, i) => { if (it.kind === 'plyo') return it.lo + ' ' + it.unit; const v = num(s.kg) == null ? t.kg : num(s.kg); return it.kind === 'load' && v == null ? repsOf(it, s, t, i) + ' reps' : kgText(it, v) + ' × ' + repsOf(it, s, t, i); };

// Exercice replié : une ligne avec son avancement, qui l'ouvre
function exLine(it, w){
  const st = w.ex[it.ex]; const t = w.targets[it.ex] || {};
  let m; let fin = false;
  if (!st || st.skip) m = 'Passé cette semaine';
  else if (finished(it, st)) { fin = true; m = it.kind === 'check' ? '✓ Fait' : '✓ ' + st.sets.length + '/' + st.sets.length; }
  else if (it.kind === 'check') m = 'À faire';
  else if (it.kind === 'cardio') m = it.lo + ' min';
  else { const k = st.sets.findIndex(s => !s.done); m = st.sets.filter(s => s.done).length + '/' + st.sets.length + ' · ' + setText(it, st.sets[k], t, k); }
  return '<button type="button" class="pick ex-line' + (fin ? ' complete' : '') + '" data-act="ex-open" data-v="' + esc(it.ex) + '" aria-expanded="false"><span class="exl"><span class="n">' + esc(it.name) + '</span><span class="m">' + esc(m) + '</span></span><span aria-hidden="true">›</span></button>';
}

// Série en cours, ou série faite en correction : − et + pour la charge et les reps, puis Valider (ou Enregistrer la correction)
function curSet(it, w, i, edit){
  const key = esc(it.ex); const s = w.ex[it.ex].sets[i]; const t = w.targets[it.ex] || {}; const n = i + 1;
  const at = ' data-ex="' + key + '" data-i="' + i + '"';
  if (it.kind === 'plyo') return '<div class="cur-set" id="cur"><span class="plyo-lab">' + it.lo + ' ' + esc(it.unit) + '</span><button type="button" class="btn primary big" data-act="done"' + at + '>Valider la série ' + n + '</button></div>';
  const step = it.step || (exDef(it.ex) || {}).step || 1;
  const kg = num(s.kg); const reps = repsOf(it, s, t, i);
  const row = (f, lab, val, unit, mode, ph, less, more) => '<div class="stepper"><span class="st-lab">' + lab + '</span>'
    + '<button type="button" class="step" data-act="step" data-f="' + f + '" data-v="-1"' + at + ' aria-label="' + less + '">−</button>'
    + '<label class="fld"><input id="' + f + '-' + key + '-' + i + '" data-f="' + f + '"' + at + ' inputmode="' + mode + '" autocomplete="off" value="' + esc(val) + '" placeholder="' + ph + '" aria-label="' + lab + ', série ' + n + '"><span>' + unit + '</span></label>'
    + '<button type="button" class="step" data-act="step" data-f="' + f + '" data-v="1"' + at + ' aria-label="' + more + '">+</button></div>';
  let h = '<div class="cur-set" id="cur">' + row('kg', it.kind === 'bw' ? 'Lest' : 'Charge', kg == null ? '' : fmtKg(kg), 'kg', 'decimal', it.kind === 'bw' ? '0' : '', 'Moins ' + fmtKg(step) + ' kg', 'Plus ' + fmtKg(step) + ' kg')
    + row('reps', 'Reps', String(reps), 'reps', 'numeric', String(reps), 'Une rep de moins', 'Une rep de plus');
  h += edit ? '<button type="button" class="btn big" data-act="set-save"' + at + '>Enregistrer la correction</button><button type="button" class="link" data-act="set-undo"' + at + '>Annuler la validation</button>'
    : '<button type="button" class="btn primary big" data-act="done"' + at + '>Valider la série ' + n + '</button>';
  return h + '</div>';
}
// Séries faites (touchées : correction) et à venir (grisées)
function setLine(it, w, i){
  const s = w.ex[it.ex].sets[i]; const t = w.targets[it.ex] || {}; const n = i + 1; const txt = setText(it, s, t, i);
  if (!s.done) return '<div class="set-line next"><span class="sn">' + n + '</span><span class="sl-v">' + esc(txt) + '</span></div>';
  // Nom pour les lecteurs d'écran : l'action (texte caché), puis le texte visible
  const act = it.kind === 'plyo' ? 'done' : 'set-edit'; const lab = it.kind === 'plyo' ? 'Annuler la validation de la série' : 'Corriger la série';
  return '<button type="button" class="set-line done" data-act="' + act + '" data-ex="' + esc(it.ex) + '" data-i="' + i + '"><span class="sn"><span class="sr">' + lab + ' </span>' + n + '</span><span class="sl-v">' + esc(txt) + '</span><span class="sl-ok" aria-hidden="true">✓</span></button>';
}

// Question des reps en réserve, juste après la dernière série : la valeur visée est signalée, jamais choisie à la place de la personne
function rirAsk(key, t){
  const k = esc(key);
  return '<div class="cur-set rir-ask" id="cur"><p class="rir-q">Reps en réserve sur la dernière série ?</p><div class="chips" role="group" aria-label="Reps en réserve">'
    + [0,1,2,3,4].map(v => '<span class="rir-c"><button type="button" class="chip" data-act="rir" data-ex="' + k + '" data-v="' + v + '" aria-pressed="false"' + (v === t.rir ? ' aria-describedby="vise-' + k + '"' : '') + '>' + (v === 4 ? '4+' : v) + '</button>' + (v === t.rir ? '<span class="vise" id="vise-' + k + '">visé</span>' : '') + '</span>').join('')
    + '</div><button type="button" class="link" data-act="rir-skip" data-ex="' + k + '">Passer la question</button></div>';
}
// Exercice ouvert : en-tête, objectif, dernière fois, séries
function openCard(it, w, idx, focus){
  const key = it.ex; const st = w.ex[key] || { sets:[] }; const t = w.targets[key] || {};
  const e = exDef(key) || it; const fin = finished(it, st);
  let presc = '';
  if (it.kind === 'load' || it.kind === 'bw') presc = (t.sets || it.sets) + ' × ' + it.lo + '-' + it.hi + (it.uni ? ' par jambe' : '') + ' · repos ' + fmtRest(it.rest) + (t.rir != null ? ' · ' + t.rir + ' en réserve' : '');
  else if (it.kind === 'plyo') presc = (t.sets || it.sets) + ' × ' + it.lo + ' ' + it.unit;
  else if (it.kind === 'cardio') presc = it.lo + ' min';
  const pillCls = { up:'good', reps:'acc', calib:'court', deload:'court', down:'warn', reset:'warn', hold:'warn', confirm:'court', skip:'bad', opt:'', plyo:'acc', check:'' }[t.type] || '';
  let h = '<section class="card ex open' + (st.skip ? ' skipped' : '') + (fin ? ' complete' : '') + '" data-ex="' + esc(key) + '">';
  h += '<div class="stack ex-h"><h3 class="exname">' + esc(it.name) + '</h3>' + (presc ? '<span class="presc">' + esc(presc) + '</span>' : '')
    + '<div class="row ex-acts">' + (hasMovement(e) ? '<button type="button" class="btn sm" data-act="move-open" data-v="' + esc(key) + '">Voir le mouvement</button>' : '') + '<button type="button" class="btn sm" data-act="pick-replace" data-i="' + idx + '">Remplacer</button></div></div>';
  if (t.type && t.type !== 'check') {
    const kgTxt = t.kg != null && it.kind !== 'plyo' ? '<b class="num" style="font-size:18px">' + (it.kind === 'bw' ? (t.kg > 0 ? 'Lest ' + fmtKg(t.kg) + ' kg' : 'Poids du corps') : fmtKg(t.kg) + ' kg') + '</b>' + (Array.isArray(t.reps) ? ' × ' + t.reps.join(', ') : '') + '<br>' : '';
    h += '<div class="target"><span class="pill ' + pillCls + ' tl">' + esc(t.label) + '</span><p>' + kgTxt + esc(t.text || '') + '</p></div>';
    const wu = warmup(Object.assign({}, e, it), t); if (wu && !st.sets.some(s => s.done)) h += '<p class="last">' + esc(wu) + '</p>';
  }
  if (it.kind === 'load' || it.kind === 'bw') {
    const last = history(key, w.id)[0];
    if (last) h += '<p class="last">Dernière fois (' + esc(fmtDate(last.date)) + ') : <b>' + last.sets.map(s => (it.kind === 'bw' && !s.kg ? 'PdC' : fmtKg(s.kg)) + '×' + s.reps).join(' · ') + '</b>' + (last.rir != null ? ' · ' + (last.rir >= 4 ? '4+' : last.rir) + ' en réserve' : '') + '</p>';
  }
  const turn = focus.turn && focus.turn.ex === key ? focus.turn.i : -1;
  if (it.kind === 'cardio') {
    const lv = e.levels || []; const s = st.sets[0] || {}; const last = lastCardio(key, w.id);
    if (last) h += '<p class="last">Dernière fois (' + esc(fmtDate(last.date)) + ') : <b>' + last.min + ' min' + (last.km ? ' · ' + fmtKg(last.km) + ' km' : '') + '</b>' + (lv.find(l => l[0] === last.level) ? ' · ' + esc(lowFirst(lv.find(l => l[0] === last.level)[1])) : '') + '</p>';
    if (lv.length > 1) h += '<div class="stack" style="gap:6px"><span class="label">Allure</span><div class="chips">' + lv.map(l => '<button type="button" class="chip txt' + (st.level === l[0] ? ' on' : '') + '" data-act="clevel" data-ex="' + esc(key) + '" data-v="' + l[0] + '" aria-pressed="' + (st.level === l[0]) + '"' + (s.done ? ' disabled' : '') + '>' + esc(l[1]) + '</button>').join('') + '</div>' + (lv.find(l => l[0] === st.level) && lv.find(l => l[0] === st.level)[2] ? '<p class="muted small">' + esc(capFirst(lv.find(l => l[0] === st.level)[2])) + '</p>' : '') + '</div>';
    if (s.done) h += '<button type="button" class="set-line done" data-act="done" data-ex="' + esc(key) + '" data-i="0"><span class="sn"><span class="sr">Annuler la validation du cardio </span><span aria-hidden="true">⏱</span></span><span class="sl-v">' + esc(s.min + ' min' + (num(s.km) ? ' · ' + fmtKg(num(s.km)) + ' km' : '')) + '</span><span class="sl-ok" aria-hidden="true">✓</span></button>';
    else h += '<div class="cur-set"' + (turn === 0 ? ' id="cur"' : '') + '><div class="sets"><div class="setrow cardio"><span class="sn">⏱</span>'
      + '<label class="fld"><input id="min-' + esc(key) + '-0" data-f="min" data-ex="' + esc(key) + '" data-i="0" inputmode="numeric" autocomplete="off" value="' + esc(s.min == null ? '' : s.min) + '" placeholder="' + it.lo + '" aria-label="Durée en minutes"><span>min</span></label>'
      + (e.dist ? '<label class="fld"><input id="km-' + esc(key) + '-0" data-f="km" data-ex="' + esc(key) + '" data-i="0" inputmode="decimal" autocomplete="off" value="' + esc(s.km == null || s.km === '' ? '' : s.km) + '" placeholder="km" aria-label="Distance en km, facultative"><span>km</span></label>' : '')
      + '</div></div><button type="button" class="btn primary big" data-act="done" data-ex="' + esc(key) + '" data-i="0">Valider le cardio</button></div>';
  } else if (it.kind === 'check') {
    h += '<p class="small">' + esc(e.cue || '') + '</p>';
    h += st.done ? '<div class="row between"><span class="pill good">Fait ✓</span><button type="button" class="btn" data-act="check" data-ex="' + esc(key) + '">Annuler</button></div>'
      : '<div class="cur-set"' + (turn === 0 ? ' id="cur"' : '') + '><button type="button" class="btn primary big" data-act="check" data-ex="' + esc(key) + '">Marquer comme fait</button></div>';
  } else if (st.skip) {
    h += t.type === 'opt' ? '<button type="button" class="btn" data-act="unskip" data-ex="' + esc(key) + '">Je le fais cette semaine</button>' : '<p class="muted small">Passé cette semaine.</p>';
  } else {
    // Une série en correction prend la place de la série en cours (qui s'affiche alors comme une série à venir)
    const ed = S.setEdit && S.setEdit.ex === key && st.sets[S.setEdit.i] && st.sets[S.setEdit.i].done ? S.setEdit.i : -1;
    h += '<div class="sets">' + st.sets.map((s, i) => i === ed ? curSet(it, w, i, true) : (i === turn && ed < 0 ? curSet(it, w, i, false) : setLine(it, w, i))).join('') + '</div>';
    if (focus.ask === key) h += rirAsk(key, t);
    h += '<div class="row between"><button type="button" class="link" data-act="addset" data-ex="' + esc(key) + '">+ Ajouter une série</button>' + (st.sets.length > 1 ? '<button type="button" class="link" data-act="rmset" data-ex="' + esc(key) + '">Retirer la dernière</button>' : '') + '</div>';
    if (fin && it.kind !== 'plyo' && focus.ask !== key) h += '<div class="stack" style="gap:6px"><span class="label">Reps en réserve sur la dernière série</span><div class="chips">' + [0,1,2,3,4].map(v => '<button type="button" class="chip' + (st.rir === v ? ' on' : '') + '" data-act="rir" data-ex="' + esc(key) + '" data-v="' + v + '" aria-pressed="' + (st.rir === v) + '">' + (v === 4 ? '4+' : v) + '</button>').join('') + '</div></div>';
  }
  return h + '</section>';
}
