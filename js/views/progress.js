// Écrans Progrès et Bilan de bloc.
import { addDays, esc, fmtDate, fmtInt, fmtKg, mondayOf, nbsp, num, parseIso, today, withDot } from '../util.js';
import { JUMP_PROTOCOL, MUSCLES } from '../library.js';
import { S } from '../store.js';
import { painEntries, painZones, ZONES } from '../pain.js';
import { allEx, blockRange, bodyDocs, canon, countSets, jumpsOn, kneeEntries, kneeOn, lastWeighIn, nextSession, perWeekOf, settings, testForBlock, tplDef, weekInfo, workouts } from '../data.js';
import { blockReport, exerciseGains, exerciseProgress, fatigueCheck, muscleDone, musclePlanned, PERIODS, periodStart, recordLog, setScore, weeklyRhythm } from '../engine.js';
import { bars, chart } from '../chart.js';
import { viewHistory } from './history.js';
import { emile } from '../emile.js';
import { myPlan, nutritionOf, weightReading } from './goal.js';
import { introCard } from './intro.js';

const TROPHY = '<svg viewBox="0 0 24 24"><path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0V4zM7 6H4v1a3 3 0 0 0 3 3M17 6h3v1a3 3 0 0 1-3 3"/></svg>';
const PRTABS = [['stats','Résumé'],['history','Historique']];
export function viewProgressPage(){
  const h = '<h1>Progrès</h1><div class="seg" role="tablist">' + PRTABS.map(t => '<button type="button" class="chip' + (S.progressTab === t[0] ? ' on' : '') + '" data-act="prtab" data-v="' + t[0] + '" role="tab" aria-selected="' + (S.progressTab === t[0]) + '">' + t[1] + '</button>').join('') + '</div>';
  return h + (S.progressTab === 'history' ? viewHistory() : viewProgress());
}
// Phrase avec espaces insécables avant les unités et la ponctuation haute
const t = x => nbsp(esc(x));
const r1 = x => Math.round(x * 10) / 10;
// Phrase qui finit par une date abrégée (« nov. ») : un seul point final
const dot = x => x.endsWith('.') ? x : x + '.';
const chips = (act, cur, list, label) => '<div class="seg" role="group" aria-label="' + esc(label) + '">' + list.map(c => '<button type="button" class="chip' + (cur === c[0] ? ' on' : '') + '" data-act="' + act + '" data-v="' + c[0] + '" aria-pressed="' + (cur === c[0]) + '">' + esc(c[1]) + '</button>').join('') + '</div>';
const METRICS = [['sessions', 'Séances'], ['sets', 'Séries']];
function viewProgress(){
  if (!S.loaded) return '<p class="loading">Chargement…</p>';
  const ws = workouts().filter(w => w.status === 'terminée'); const d = today(); const wk = weekInfo(d);
  const from = periodStart(S.prRange); const inRange = date => !from || date >= from;
  const bd = bodyDocs(); const hasBody = bd.some(x => num(x.weight) > 0 || num(x.sleep) > 0);
  let h = '';
  // Premier lancement, aucune séance : la rubrique s'explique d'abord
  const intro = introCard('progress'); if (intro) return intro;
  if (!ws.length) {
    // Rien à comparer : Émile (logo, lumière douce) dit ce qu'il faut, plutôt que des cases à zéro
    const nx = nextSession(); const tp = nx && tplDef(nx);
    h += '<section class="card empty-state"><img class="end-logo" src="icons/logo.png" alt="" width="96" height="96"><h2>Ta progression commence ici</h2><p class="muted">Après ta première séance, tu verras ici ton rythme et tes séries. Pour voir ta force progresser, il faut au moins 2 séances sur un même exercice ; pour ton poids, au moins 2 pesées.</p>'
      + (tp ? '<button type="button" class="btn primary big" data-act="start" data-v="' + esc(nx) + '">Commencer ' + esc(tp.name) + '</button>' : '') + '</section>';
  } else h += workoutPart(ws, d, wk);
  const painOn = kneeOn() || painZones().some(z => z !== 'knee');
  if (!ws.length && !hasBody && !painOn) return h;
  h += '<h2 class="sec-h">Évolution</h2>' + chips('prrange', S.prRange, PERIODS, 'Période affichée') + '<p class="muted small">' + (from ? 'Du ' + esc(fmtDate(from)) + ' à aujourd’hui' : 'Depuis ta première donnée') + '. Les cartes ci-dessous suivent cette période, sauf celle des muscles (semaine en cours).</p>';
  if (ws.length) h += rhythmCard(ws, from) + musclesCard(d);
  h += bodyCards(bd, inRange, wk);
  return h + painCards(inRange, wk);
}
// Chiffres, records, exercices et bilans : tout l'historique, sans choix de période
function workoutPart(ws, d, wk){
  const perWeek = perWeekOf(); const last28 = ws.filter(w => w.date > addDays(d, -28));
  let h = '<div class="stats"><div class="stat"><span class="v num">' + ws.length + '</span><span class="l">séances terminées</span></div><div class="stat"><span class="v num">' + last28.length + '<small>/' + perWeek * 4 + '</small></span><span class="l">séances sur 28 jours</span></div><div class="stat"><span class="v num">' + fmtInt(last28.reduce((a, w) => a + countSets(w), 0)) + '</span><span class="l">séries validées sur 28 jours</span></div></div>';
  // Tes records : un par exercice (le plus récent), calculés sur tout l'historique
  const recs = recordLog(); const seen = new Set(); const lastPerEx = recs.filter(r => !seen.has(r.id) && seen.add(r.id)).slice(0, 5);
  h += recs.length ? '<section class="card gold"><div class="ring-row"><span class="trophy" aria-hidden="true">' + TROPHY + '</span><div class="stack" style="gap:2px"><h2>Tes records</h2><span class="muted small">' + recs.length + ' battu' + (recs.length > 1 ? 's' : '') + ' depuis le début · force estimée en kg</span></div></div>'
      + lastPerEx.map(r => '<p class="rec-line"><span>' + esc(r.name) + '</span><span class="num">' + fmtKg(r.kg) + '&nbsp;kg <span class="muted small">+' + fmtKg(r.gain) + '&nbsp;kg · ' + esc(fmtDate(r.date)) + '</span></span></p>').join('')
      + '<details class="cue"><summary>Que veulent dire ces chiffres ?</summary><p class="muted">Pour chaque exercice avec une charge, l’appli prend ta meilleure série de la séance et estime la charge que tu soulèverais une seule fois (formule d’Epley : charge × (1 + reps ÷ 30)). C’est une estimation, moins précise avec beaucoup de reps. Un record est une séance où elle dépasse toutes les séances d’avant sur le même exercice ; le « + » est l’écart avec le record précédent, et la première séance d’un exercice n’en est pas un. Au poids du corps, ton dernier poids noté s’ajoute à la charge.</p></details></section>'
    : '<section class="card"><h3>Tes records</h3>' + emile('<p>' + t('Un record, c’est une meilleure force estimée que lors de tes séances d’avant sur le même exercice : il en faut donc au moins 2 sur un exercice avec une charge. Continue de noter tes séries.') + '</p>') + '</section>';
  const fat = fatigueCheck();
  if (fat) h += emile('<p>Baisse de force sur ' + fat.drops.length + ' exercices cette semaine. Regarde l’onglet Aujourd’hui pour avancer la décharge.</p>', { title:'Fatigue probable', tone:'warn', key:'fatigue-p:' + mondayOf(today()) });

  // Tes exercices : ceux déjà faits, du plus récent au plus ancien, avec leur dernière meilleure série et leur gain de force ; une ligne ouvre la fiche (courbe)
  const used = new Set(); workouts().forEach(w => Object.keys(w.ex || {}).forEach(k => used.add(canon(k))));
  const mine = allEx().filter(e => used.has(e.id) && (e.kind === 'load' || e.kind === 'bw' || e.kind === 'cardio')).map(e => ({ e, p: exerciseProgress(e.id) })).filter(x => x.p.last.length)
    .sort((a, b) => a.p.last[0].date < b.p.last[0].date ? 1 : a.p.last[0].date > b.p.last[0].date ? -1 : 0);
  if (mine.length) {
    // même règle que la meilleure série de la fiche (poids du corps compris s'il est noté)
    const bestOf = (kind, x) => { const sc = setScore(kind); return x.sets.reduce((m, s) => !m || sc(s) > sc(m) ? s : m, null); };
    const detail = (e, l) => e.kind === 'cardio' ? l.min + ' min' + (l.km ? ' · ' + fmtKg(l.km) + ' km' : '') : (s => (e.kind === 'bw' && !s.kg ? 'PdC' : fmtKg(s.kg) + ' kg') + ' × ' + s.reps)(bestOf(e.kind, l));
    const gains = exerciseGains();
    const row = x => { const g = gains[canon(x.e.id)]; const up = g && g.n >= 2 && g.best.kg > g.first.kg ? ' · force +' + fmtKg(r1(g.best.kg - g.first.kg)) + ' kg depuis le ' + fmtDate(g.first.date) : '';
      return '<button type="button" class="pick" data-act="ex-fiche" data-v="' + esc(x.e.id) + '"><span class="stack" style="gap:2px"><span class="n">' + esc(x.e.name) + '</span><span class="m">' + t(detail(x.e, x.p.last[0]) + ' · ' + fmtDate(x.p.last[0].date) + up) + '</span></span><span aria-hidden="true">›</span></button>'; };
    h += '<section class="card"><h3>Tes exercices</h3><p class="muted small">Dernière meilleure série. Le gain compare ta meilleure force estimée à celle de ta première séance sur l’exercice ; touche une ligne pour voir sa courbe.</p>' + mine.slice(0, 6).map(row).join('')
      + (mine.length > 6 ? '<details class="cue"><summary>Voir les ' + (mine.length - 6) + ' autres exercices</summary>' + mine.slice(6).map(row).join('') + '</details>' : '') + '</section>';
  }
  h += '<section class="card"><h3>Bilans de bloc</h3><p class="muted small">Le bilan compare le début et la fin de chaque bloc de 6 semaines.</p><div class="row">';
  for (let bk = 1; bk <= wk.block; bk++) h += '<button type="button" class="btn" data-act="bilan" data-v="' + bk + '">Bloc ' + bk + (bk === wk.block ? ' (en cours)' : '') + '</button>';
  return h + '</div></section>';
}
// Séances ou séries par semaine : seulement depuis la première séance (avant, la donnée n'existe pas, ce n'est pas un zéro)
function rhythmCard(ws, from){
  const cur = mondayOf(today()); const first = mondayOf(ws[0].date);
  const start = [from ? mondayOf(from) : first, first, addDays(cur, -7 * 51)].reduce((a, b) => a > b ? a : b);
  const sets = S.prMetric === 'sets'; const unit = sets ? 'séries' : 'séances';
  const items = weeklyRhythm(start, cur).map(x => ({ label:x.monday, v: sets ? x.sets : x.sessions, open:x.current })); const done = items.filter(x => !x.open);
  let h = '<section class="card"><div class="row between"><h3>Ton rythme</h3><div class="chips" role="group" aria-label="Mesure du rythme">' + METRICS.map(m => '<button type="button" class="chip' + (S.prMetric === m[0] || (!S.prMetric && m[0] === 'sessions') ? ' on' : '') + '" data-act="prmetric" data-v="' + m[0] + '" aria-pressed="' + (S.prMetric === m[0] || (!S.prMetric && m[0] === 'sessions')) + '">' + m[1] + '</button>').join('') + '</div></div>';
  if (items.length < 2) return h + '<p class="muted small">Le rythme apparaît dès ta 2e semaine d’entraînement : jusque-là, il n’y a rien à comparer.</p></section>';
  h += '<p class="muted small">' + (sets ? 'Séries validées' : 'Séances terminées') + ' par semaine, du lundi au dimanche' + (start === first ? ' ; la première semaine commence à ta première séance' : '') + '. Objectif actuel : ' + perWeekOf() + ' séances par semaine.</p>' + bars(items, { unit:unit, label: (sets ? 'Séries validées' : 'Séances terminées') + ' par semaine' });
  if (items.some(x => x.open)) h += '<p class="muted small">Barre en pointillés : la semaine en cours, pas encore terminée. Elle n’entre pas dans la moyenne.</p>';
  if (done.length >= 2) h += '<p class="small">' + t('Moyenne : ' + fmtKg(r1(done.reduce((a, x) => a + x.v, 0) / done.length)) + ' ' + unit + ' par semaine, sur ' + done.length + ' semaines terminées.') + '</p>';
  return h + '</section>';
}
// Séries par muscle de la semaine en cours, comparées au planning
function musclesCard(d){
  const mon = mondayOf(d); const doneW = muscleDone(mon, addDays(mon, 6)); const lastW = muscleDone(addDays(mon, -7), addDays(mon, -1)); const plan = musclePlanned();
  const maxV = Math.max(20, ...MUSCLES.map(x => Math.max(doneW[x], plan[x], lastW[x])));
  let h = '<section class="card"><h3>Séries par muscle cette semaine</h3>';
  h += '<div class="legend"><span><i style="background:var(--accent)"></i>Fait cette semaine</span><span><i style="background:var(--court)"></i>Prévu par ton planning</span></div>';
  // Un muscle ni travaillé ni prévu n'a pas de ligne (13 groupes depuis la version 3.17)
  MUSCLES.filter(x => doneW[x] || plan[x] || lastW[x]).forEach(x => {
    h += '<div class="mrow"><span>' + esc(x) + '</span><span class="mbar"><i style="width:' + (doneW[x] / maxV * 100).toFixed(1) + '%"></i><b style="left:' + (plan[x] / maxV * 100).toFixed(1) + '%"></b></span><span class="v num">' + fmtKg(doneW[x]) + ' / ' + fmtKg(plan[x]) + '</span></div>';
  });
  h += '<p class="muted small">Semaine dernière : ' + MUSCLES.filter(x => lastW[x] > 0).map(x => x + ' ' + fmtKg(lastW[x])).join(' · ') + (MUSCLES.some(x => lastW[x] > 0) ? '' : 'aucune série enregistrée') + '.</p>';
  return h + '<details class="cue"><summary>Pourquoi ces chiffres ?</summary><p class="muted">Une série compte 1 sur le muscle principal, 0,5 sur les secondaires (Pelland et al., 2026) : plus de séries rapporte plus, mais de moins en moins. La semaine en cours n’est pas finie : le « fait » monte au fil des séances.</p></details></section>';
}
// Poids de corps et sommeil, sur la période choisie
function bodyCards(bd, inRange, wk){
  const height = num(settings().height); const pt = k => bd.filter(x => num(x[k]) > 0 && inRange(x.date)).map(x => ({ date:x.date, x:parseIso(x.date).getTime(), y:num(x[k]) }));
  const wPts = pt('weight'); const sPts = pt('sleep'); const last = lastWeighIn(); const nut = nutritionOf();
  const gp = nut.on ? myPlan() : null; const gl = gp && gp.target && (gp.status === 'ok' || gp.status === 'fast') ? gp.target : null;
  let h = '<section class="card"><h3>Poids de corps</h3>';
  h += last ? '<p class="muted small">' + t(dot('Dernière pesée : ' + fmtKg(num(last.weight)) + ' kg le ' + fmtDate(last.date) + (height ? ' · taille ' + fmtKg(height) + ' cm · IMC ' + fmtKg(r1(num(last.weight) / Math.pow(height / 100, 2))) : ''))) + (nut.on && nut.goal === 'gain' ? ' En prise de masse musculaire, une hausse lente et régulière est attendue.' : '') + '</p>' : '<p class="muted small">Note ton poids dans Aujourd’hui et ta taille dans ton profil.</p>';
  h += chart([{ pts:wPts }], Object.assign({ label:'Poids en kg', unit:'kg', empty:'Pas de pesée sur cette période.' }, gl ? { thresh:gl, threshLabel:'objectif', threshColor:'var(--good)' } : {}));
  if (wPts.length === 1) h += '<p class="muted small">Une seule pesée sur la période : il en faut 2 pour voir une évolution.</p>';
  if (wPts.length > 1) { const a = wPts[0], b = wPts[wPts.length - 1]; h += '<p class="small">' + t('Sur la période : ' + fmtKg(a.y) + ' kg le ' + fmtDate(a.date) + ', puis ' + fmtKg(b.y) + ' kg le ' + fmtDate(b.date) + ' (' + (b.y >= a.y ? '+' : '−') + fmtKg(r1(Math.abs(b.y - a.y))) + ' kg, ' + wPts.length + ' pesées).') + '</p>'; }
  h += '<p class="small">' + esc(weightReading()) + '</p></section>';
  h += '<section class="card"><h3>Sommeil</h3>' + chart([{ pts:sPts, color:'var(--court)' }], { label:'Sommeil en heures', unit:'h', yMin:0, thresh:7, threshLabel:'7 h', empty:'Pas de nuit notée sur cette période. Note tes heures de sommeil dans Aujourd’hui.' });
  if (sPts.length) h += '<p class="muted small">' + t('Moyenne sur la période : ' + fmtKg(r1(sPts.reduce((a, p) => a + p.y, 0) / sPts.length)) + ' h (' + sPts.length + ' nuit' + (sPts.length > 1 ? 's' : '') + ' notée' + (sPts.length > 1 ? 's' : '') + '). Ligne pointillée : 7 h.') + '</p>';
  h += '</section>';
  return h;
}
// Douleurs suivies et tests de détente
function painCards(inRange, wk){
  const pts = (list, src) => list.filter(k => k.src === src && inRange(k.date)).map(k => ({ x: parseIso(k.date).getTime(), y: k.v }));
  let h = '';
  const opts = (label, empty) => ({ yMin:0, yMax:10, thresh:3, threshLabel:'3/10', area:false, label, empty });
  // Genou
  if (kneeOn()) { const ke = kneeEntries(); h += '<section class="card"><h3>Genou</h3><p class="muted small">Escaliers le matin (courbe) et douleur max pendant les séances jambes (points). La ligne pointillée marque 3/10.</p>' +
    chart([{ pts: pts(ke, 'stairs') }, { pts: pts(ke, 'session'), color:'var(--court)', line:false }], opts('Douleur au genou', 'Pas de note sur cette période. Note la douleur aux escaliers dans Aujourd’hui.')) + '</section>'; }
  // Autres zones de douleur suivies : note du matin (courbe) et douleur max pendant les séances (points)
  painZones().filter(z => z !== 'knee').forEach(z => {
    const pe = painEntries(z);
    h += '<section class="card"><h3>' + esc(ZONES[z].label) + '</h3><p class="muted small">Note du jour (courbe) et douleur max pendant les séances (points). La ligne pointillée marque 3/10.</p>' +
      chart([{ pts: pts(pe, 'day') }, { pts: pts(pe, 'session'), color:'var(--court)', line:false }], opts('Douleur : ' + ZONES[z].label.toLowerCase(), 'Pas de note sur cette période. Note ta douleur dans Aujourd’hui.')) + '</section>';
  });
  // Détente
  if (!jumpsOn()) return h;
  const tests = []; S.docs.forEach((o, id) => { if (id.indexOf('t_') === 0) tests.push(Object.assign({ id }, o)); });
  tests.sort((a, b) => a.date < b.date ? -1 : 1);
  h += '<section class="card"><h3>Tests de détente</h3><p class="muted small">Un test par bloc, en semaine de décharge, au début de ta séance jambes. ' + esc(JUMP_PROTOCOL) + '</p>' + (testForBlock(wk.block) ? '<p class="small">Test du bloc ' + wk.block + ' fait.</p>' : '<p class="small">Prochain test : semaine du ' + esc(withDot(fmtDate(addDays(blockRange(wk.block).from, 35)))) + '</p>') +
    chart([{ pts: tests.map(t => ({ x: parseIso(t.date).getTime(), y: t.cm })) }], { label:'Détente verticale en cm', unit:'cm', empty:'Aucun test pour l’instant.' }) +
    '<div class="row"><input class="plain" type="date" id="test-date" value="' + today() + '" aria-label="Date du test" style="width:auto"><input class="plain" id="test-cm" inputmode="decimal" placeholder="Hauteur en cm" aria-label="Hauteur en cm" style="flex:1;min-width:120px;width:auto"><button type="button" class="btn primary" data-act="add-test">Ajouter</button></div>';
  if (tests.length) h += '<div class="scroll"><table class="tbl"><tbody>' + tests.slice().reverse().map(t => '<tr><td>' + esc(fmtDate(t.date)) + '</td><td class="num">' + fmtKg(t.cm) + ' cm</td><td style="text-align:right"><button type="button" class="link" data-act="del-test" data-v="' + t.id + '">' + (S.confirm === t.id ? 'Confirmer' : 'Supprimer') + '</button></td></tr>').join('') + '</tbody></table></div>';
  return h + '</section>';
}
export function viewBilan(block){
  if (!S.loaded) return '<p class="loading">Chargement…</p>';
  const R = blockReport(block);
  let h = '<div class="row"><button type="button" class="link" data-act="bilan-close" data-back>‹ ' + (S.view === 'today' ? 'Aujourd’hui' : 'Progrès') + '</button></div><h1>Bilan du bloc ' + block + '</h1>';
  h += '<p class="muted">' + esc(fmtDate(R.r.from)) + ' – ' + esc(fmtDate(R.r.to)) + (R.finished ? '' : ' · en cours, ' + R.weeks + ' semaine' + (R.weeks > 1 ? 's' : '') + ' écoulée' + (R.weeks > 1 ? 's' : '')) + '</p>';
  const avgF = R.forces.length ? R.forces.reduce((a, f) => a + f.pct, 0) / R.forces.length : null;
  h += '<div class="stats"><div class="stat"><span class="v num">' + R.done.length + '<span class="small muted">/' + R.planned + '</span></span><span class="l">séances faites</span></div><div class="stat"><span class="v num">' + (avgF == null ? '—' : (avgF >= 0 ? '+' : '') + fmtKg(Math.round(avgF * 10) / 10) + '%') + '</span><span class="l">force moyenne</span></div>' + (jumpsOn() ? '<div class="stat"><span class="v num">' + (R.test ? fmtKg(R.test.cm) : '—') + '</span><span class="l">détente (cm)</span></div>' : '<div class="stat"><span class="v num">' + R.weeks + '</span><span class="l">semaine' + (R.weeks > 1 ? 's' : '') + '</span></div>') + '</div>';
  h += emile((R.tips.length ? R.tips.map(t => '<div class="alert ' + (t[0] === 'bad' ? '' : t[0]) + '" style="font-weight:500">' + esc(t[1]) + '</div>').join('') : '<p class="small">Pas encore assez de données : continue de noter tes séances' + (kneeOn() ? ', ton genou' : '') + ', ton poids et ton sommeil.</p>') + '<p class="muted small">Ce sont des pistes calculées à partir de tes données, à ajuster avec ton ressenti.</p>', { title:'Pistes pour la suite', key:'bilan:' + block });
  h += '<section class="card"><h3>Force par exercice</h3><p class="muted small">Force estimée (Epley) entre la première et la dernière séance du bloc, hors décharge, dès 2 séances par exercice.</p>';
  h += R.forces.length ? '<div class="scroll"><table class="tbl"><thead><tr><th>Exercice</th><th>Début</th><th>Fin</th><th>Écart</th></tr></thead><tbody>' + R.forces.map(f => '<tr><td>' + esc(f.name) + '</td><td class="num">' + fmtKg(Math.round(f.from)) + (f.unit === 'reps' ? ' reps' : '') + '</td><td class="num">' + fmtKg(Math.round(f.to)) + (f.unit === 'reps' ? ' reps' : '') + '</td><td class="num" style="color:var(--' + (f.pct >= 1 ? 'good' : f.pct <= -2.5 ? 'bad' : 'muted') + ')">' + (f.pct >= 0 ? '+' : '') + fmtKg(Math.round(f.pct * 10) / 10) + ' %</td></tr>').join('') + '</tbody></table></div>' : '<p class="empty">Pas encore 2 séances sur le même exercice dans ce bloc.</p>';
  h += '</section>';
  const maxV = Math.max(20, ...MUSCLES.map(m => Math.max(R.avg[m], R.mp[m])));
  h += '<section class="card"><h3>Séries par muscle (moyenne par semaine)</h3><div class="legend"><span><i style="background:var(--accent)"></i>Moyenne faite</span><span><i style="background:var(--court)"></i>Prévu par semaine</span></div>';
  MUSCLES.filter(m => R.avg[m] || R.mp[m]).forEach(m => { h += '<div class="mrow"><span>' + esc(m) + '</span><span class="mbar"><i style="width:' + (R.avg[m] / maxV * 100).toFixed(1) + '%"></i><b style="left:' + (R.mp[m] / maxV * 100).toFixed(1) + '%"></b></span><span class="v num">' + fmtKg(Math.round(R.avg[m] * 10) / 10) + ' / ' + fmtKg(R.mp[m]) + '</span></div>'; });
  h += '</section>';
  h += '<section class="card"><h3>' + (R.pains.length ? 'Douleurs, poids et sommeil' : kneeOn() ? 'Genou, poids et sommeil' : 'Poids et sommeil') + '</h3><div class="stack small">';
  if (kneeOn()) h += '<p><b>Genou :</b> ' + (R.kneeMax == null ? 'aucune mesure.' : R.kneeN + ' mesures, max ' + R.kneeMax + '/10, ' + R.kneeHigh + ' jour(s) au-dessus de 3/10.') + '</p>';
  R.pains.forEach(p => { h += '<p><b>' + esc(p.label) + ' :</b> ' + (p.max == null ? 'aucune mesure.' : p.n + ' mesure' + (p.n > 1 ? 's' : '') + ', max ' + p.max + '/10, ' + p.high + ' jour(s) au-dessus de 3/10.') + '</p>'; });
  h += '<p><b>Poids :</b> ' + (R.wc ? fmtKg(R.wc.from) + ' → ' + fmtKg(R.wc.to) + ' kg (' + (R.wc.kg >= 0 ? '+' : '') + fmtKg(Math.round(R.wc.kg * 10) / 10) + ' kg, ' + fmtKg(Math.round(R.wc.pctWeek * 100) / 100) + ' % par semaine).' : 'il faut au moins 2 pesées dans le bloc.') + '</p>';
  h += '<p><b>Sommeil :</b> ' + (R.sleepAvg == null ? 'aucune donnée.' : 'moyenne ' + fmtKg(Math.round(R.sleepAvg * 10) / 10) + ' h, ' + R.shortN + ' nuit(s) sous 6 h.') + '</p>';
  if (jumpsOn()) h += '<p><b>Détente :</b> ' + (R.test ? fmtKg(R.test.cm) + ' cm' + (R.prevTest ? ' (bloc précédent : ' + fmtKg(R.prevTest.cm) + ' cm)' : '') : 'pas de test dans ce bloc.') + '</p>';
  h += '</div></section>';
  return h;
}
