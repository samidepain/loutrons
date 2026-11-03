// Écran Séance.
import { esc, fmtDate, fmtKg, num } from '../util.js';
import { JUMP_PROTOCOL } from '../library.js';
import { S } from '../store.js';
import { activeWorkout, allTpl, exDef, history, itemsOf, jumpsOn, kneeOn, testDue, testForBlock, weekInfo, wName } from '../data.js';
import { warmup } from '../engine.js';
import { kneeChips } from '../render.js';
import { noTplCard } from './program.js';
import { exVisual } from './fiche.js';
import { emile } from '../emile.js';

export function viewSession(){
  const w = S.loaded && activeWorkout();
  if (!w && S.loaded && !allTpl().length) return noTplCard();
  if (!w) return '<section class="card"><h2>Pas de séance en cours</h2><p class="muted">Choisis la séance à faire. Les objectifs de chaque exercice sont calculés à partir de tes dernières séances.</p><div class="row">' +
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
    h += '<section class="card" style="border-color:var(--court)"><div class="stack" style="gap:4px"><h3>Test de détente du bloc ' + weekInfo(w.date).block + '</h3><p class="small">' + esc(JUMP_PROTOCOL) + '</p></div>';
    h += '<div class="fields">' + [0,1,2].map(i => '<label class="f"><span>Essai ' + (i + 1) + ' (cm)</span><input class="n" id="jump-' + i + '" inputmode="decimal" placeholder="cm"></label>').join('') + '</div>';
    const prevT = testForBlock(weekInfo(w.date).block - 1);
    h += (prevT ? '<p class="muted small">Bloc précédent : ' + fmtKg(prevT.cm) + ' cm.</p>' : '') + '<button type="button" class="btn primary" data-act="save-jump">Enregistrer le test</button></section>';
  }
  h += emile('<p>Plus de 75 min : si tu manques de temps, coupe ' + (w.cut ? 'dans cet ordre : ' + esc(w.cut) : 'les dernières séries d’isolation') + '. Ne raccourcis pas les repos des mouvements lourds.</p>', { id:'cutwarn', hidden:true, tone:'warn', key:'long:' + w.id });
  let i = 0;
  while (i < items.length) {
    const it = items[i];
    if (it.ss) {
      let j = i; const grp = [];
      while (j < items.length && items[j].ss === it.ss) { grp.push(j); j++; }
      h += '<div class="group"><span class="gh">Superset : alterne sans repos, puis repos ' + (items[grp[grp.length - 1]].rest || 75) + ' s</span>' + grp.map(k => exCard(items[k], w, k)).join('') + '</div>';
      i = j;
    } else { h += exCard(it, w, i); i++; }
  }
  h += '<button type="button" class="btn" data-act="pick-add">+ Ajouter un exercice à cette séance</button>';
  if (w.lower && kneeOn()) h += '<section class="card"><h3>Genou pendant la séance</h3><p class="muted small">Douleur maximale ressentie, de 0 à 10.</p>' + kneeChips(w.knee == null ? null : w.knee, 'knee') + '</section>';
  h += '<section class="card"><h3>Notes</h3><textarea id="notes-' + w.id + '" data-f="notes" placeholder="Sensations, réglages de machine, ce qui a gêné…">' + esc(w.notes || '') + '</textarea></section>';
  h += '<button type="button" class="btn primary big" data-act="finish">Terminer la séance</button>';
  h += S.confirm === 'abandon' ? '<button type="button" class="btn danger big" data-act="abandon-yes">Confirmer : supprimer cette séance</button>' : '<button type="button" class="btn ghost big" data-act="abandon">Abandonner la séance</button>';
  return h;
}
function exCard(it, w, idx){
  const key = it.ex; const st = w.ex[key] || { sets:[] }; const t = w.targets[key] || {};
  const pillCls = { up:'good', reps:'acc', calib:'court', deload:'court', down:'warn', reset:'warn', hold:'warn', confirm:'court', skip:'bad', opt:'', plyo:'acc', check:'' }[t.type] || '';
  const e = exDef(key) || it;
  let presc = '';
  if (it.kind === 'load' || it.kind === 'bw') presc = (t.sets || it.sets) + ' × ' + it.lo + '-' + it.hi + (it.uni ? ' par jambe' : '') + ' · repos ' + (it.rest >= 120 ? Math.floor(it.rest / 60) + (it.rest % 60 ? ' min ' + (it.rest % 60) : ' min') : it.rest + ' s') + (t.rir != null ? ' · ' + t.rir + ' en réserve' : '');
  else if (it.kind === 'plyo') presc = (t.sets || it.sets) + ' × ' + it.lo + ' ' + it.unit;
  const complete = it.kind === 'check' ? st.done : (st.sets.length && st.sets.every(s => s.done));
  let h = '<section class="card ex' + (st.skip ? ' skipped' : '') + (complete ? ' complete' : '') + '">';
  h += '<div class="row between" style="align-items:flex-start"><div class="stack" style="gap:4px;flex:1"><div class="exname">' + esc(it.name) + '</div>' + (presc ? '<span class="presc">' + esc(presc) + '</span>' : '') + '</div><button type="button" class="btn sm" data-act="pick-replace" data-i="' + idx + '">Remplacer</button></div>';
  if (t.type && t.type !== 'check') {
    const kgTxt = t.kg != null && it.kind !== 'plyo' ? '<b class="num" style="font-size:18px">' + (it.kind === 'bw' ? (t.kg > 0 ? 'Lest ' + fmtKg(t.kg) + ' kg' : 'Poids du corps') : fmtKg(t.kg) + ' kg') + '</b>' + (t.reps ? ' × ' + t.reps.join(', ') : '') + '<br>' : '';
    h += '<div class="target"><span class="pill ' + pillCls + ' tl">' + esc(t.label) + '</span><p>' + kgTxt + esc(t.text || '') + '</p></div>';
    const wu = warmup(Object.assign({}, e, it), t); if (wu && !st.sets.some(s => s.done)) h += '<p class="last">' + esc(wu) + '</p>';
  }
  if (it.kind === 'load' || it.kind === 'bw') {
    const last = history(key, w.id)[0];
    if (last) h += '<p class="last">Dernière fois (' + esc(fmtDate(last.date)) + ') : <b>' + last.sets.map(s => (it.kind === 'bw' && !s.kg ? 'PdC' : fmtKg(s.kg)) + '×' + s.reps).join(' · ') + '</b>' + (last.rir != null ? ' · ' + (last.rir >= 4 ? '4+' : last.rir) + ' en réserve' : '') + '</p>';
  }
  if (it.kind === 'check') {
    h += '<p class="small">' + esc(e.cue || '') + '</p><div class="setrow plyo' + (st.done ? ' done' : '') + '"><span class="sn">✓</span><span class="plyo-lab">' + (st.done ? 'Fait' : 'À faire') + '</span><button type="button" class="chk" data-act="check" data-ex="' + esc(key) + '" aria-label="Marquer comme fait">✓</button></div>';
  } else if (st.skip) {
    if (t.type === 'opt') h += '<button type="button" class="btn" data-act="unskip" data-ex="' + esc(key) + '">Je le fais cette semaine</button>';
  } else {
    h += '<div class="sets">';
    st.sets.forEach((s, i) => {
      if (it.kind === 'plyo') {
        h += '<div class="setrow plyo' + (s.done ? ' done' : '') + '"><span class="sn">' + (i + 1) + '</span><span class="plyo-lab">' + it.lo + ' ' + esc(it.unit) + '</span><button type="button" class="chk" data-act="done" data-ex="' + esc(key) + '" data-i="' + i + '" aria-label="Valider la série ' + (i + 1) + '">✓</button></div>';
      } else {
        const ph = t.reps && t.reps[i] != null ? t.reps[i] : it.lo;
        h += '<div class="setrow' + (s.done ? ' done' : '') + '"><span class="sn">' + (i + 1) + '</span>' +
          '<label class="fld"><input id="kg-' + esc(key) + '-' + i + '" data-f="kg" data-ex="' + esc(key) + '" data-i="' + i + '" inputmode="decimal" autocomplete="off" value="' + esc(s.kg == null || s.kg === '' ? '' : fmtKg(num(s.kg))) + '" placeholder="' + (it.kind === 'bw' ? '0' : 'kg') + '" aria-label="' + (it.kind === 'bw' ? 'Lest' : 'Charge') + ' série ' + (i + 1) + '"><span>' + (it.kind === 'bw' ? 'lest' : 'kg') + '</span></label>' +
          '<label class="fld"><input id="reps-' + esc(key) + '-' + i + '" data-f="reps" data-ex="' + esc(key) + '" data-i="' + i + '" inputmode="numeric" autocomplete="off" value="' + esc(s.reps == null ? '' : s.reps) + '" placeholder="' + ph + '" aria-label="Répétitions série ' + (i + 1) + '"><span>reps</span></label>' +
          '<button type="button" class="chk" data-act="done" data-ex="' + esc(key) + '" data-i="' + i + '" aria-label="Valider la série ' + (i + 1) + '">✓</button></div>';
      }
    });
    h += '</div><div class="row between"><button type="button" class="link" data-act="addset" data-ex="' + esc(key) + '">+ Ajouter une série</button>' + (st.sets.length > 1 ? '<button type="button" class="link" data-act="rmset" data-ex="' + esc(key) + '">Retirer la dernière</button>' : '') + '</div>';
    if (it.kind !== 'plyo') h += '<div class="stack" style="gap:6px"><span class="label">Reps en réserve sur la dernière série</span><div class="chips">' + [0,1,2,3,4].map(v => '<button type="button" class="chip' + (st.rir === v ? ' on' : '') + '" data-act="rir" data-ex="' + esc(key) + '" data-v="' + v + '" aria-pressed="' + (st.rir === v) + '">' + (v === 4 ? '4+' : v) + '</button>').join('') + '</div></div>';
  }
  const cue = it.kind !== 'check' && e.cue; const vis = exVisual(e);
  if (cue || vis) h += '<details class="cue"><summary>' + (cue && vis ? 'Consignes et schéma' : cue ? 'Consignes' : 'Schéma') + '</summary>' + (cue ? '<p>' + esc(cue) + '</p>' : '') + vis + '</details>';
  return h + '</section>';
}
