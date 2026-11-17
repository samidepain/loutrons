// Écrans Progrès : synthèse en cases, page détaillée de chaque statistique (S.stat), et bilan de bloc.
import { addDays, esc, fmtDate, fmtInt, fmtKg, mondayOf, nbsp, num, parseIso, today, withDot } from '../util.js';
import { JUMP_PROTOCOL, MUSCLES } from '../library.js';
import { S } from '../store.js';
import { painEntries, painZones, PAIN_LIMIT, ZONES } from '../pain.js';
import { allEx, blockRange, bodyDocs, canon, countSets, jumpsOn, kneeOn, nextSession, nextWeigh, perWeekOf, settings, testForBlock, tplDef, weekInfo, workouts } from '../data.js';
import { blockReport, exerciseGains, exerciseProgress, fatigueCheck, muscleDone, musclePlanned, PERIODS, periodStart, prevPeriod, recordLog, setScore, weeklyRhythm } from '../engine.js';
import { bars, chart, spark } from '../chart.js';
import { viewHistory } from './history.js';
import { emile, firstTime } from '../emile.js';
import { myPlan, nutritionOf, weightReading } from './goal.js';
import { introCard } from './intro.js';
import { subNav } from './program.js';

const TROPHY = '<svg viewBox="0 0 24 24"><path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0V4zM7 6H4v1a3 3 0 0 0 3 3M17 6h3v1a3 3 0 0 1-3 3"/></svg>';
const PRTABS = [['stats','Résumé'],['history','Historique']];
export function viewProgressPage(){
  const h = '<h1>Progrès</h1>' + subNav(PRTABS, S.progressTab, 'prtab');
  return h + (S.progressTab === 'history' ? viewHistory() : viewProgress());
}
// Phrase avec espaces insécables avant les unités et la ponctuation haute
const t = x => nbsp(esc(x));
const r1 = x => Math.round(x * 10) / 10;
const avg = l => l.reduce((a, x) => a + x, 0) / l.length;
const signed = x => (x >= 0 ? '+' : '−') + fmtKg(r1(Math.abs(x)));
const doneWs = () => workouts().filter(w => w.status === 'terminée');
const weights = () => bodyDocs().filter(x => num(x.weight) > 0).map(x => ({ date:x.date, y:num(x.weight) }));
const sleeps = () => bodyDocs().filter(x => num(x.sleep) > 0).map(x => ({ date:x.date, y:num(x.sleep) }));
const jumpTests = () => { const l = []; S.docs.forEach((o, id) => { if (id.indexOf('t_') === 0) l.push(Object.assign({ id }, o)); }); return l.sort((a, b) => a.date < b.date ? -1 : 1); };
const xy = l => l.map(p => ({ date:p.date, x:parseIso(p.date).getTime(), y:p.y }));
// Chiffres clés d'une page : [valeur (HTML), légende] ; sur 2 colonnes quand il n'y en a que 2
const stats = list => '<div class="stats' + (list.length < 3 ? ' needs' : '') + '">' + list.map(x => '<div class="stat"><span class="v num">' + x[0] + '</span><span class="l">' + esc(x[1]) + '</span></div>').join('') + '</div>';
const unit = u => '<small>' + u + '</small>';

// Synthèse : une case par statistique (valeur, repère, mini-courbe), chacune ouvre sa page ; les bilans de bloc dessous
const tile = (key, label, v, sub, vals) => '<button type="button" class="tile" data-act="stat-open" data-v="' + key + '"><span class="l">' + esc(label) + '<span aria-hidden="true">›</span></span><span class="v num">' + v + '</span><span class="m">' + t(sub) + '</span>' + spark(vals || []) + '</button>';
function viewProgress(){
  if (!S.loaded) return '<p class="loading">Chargement…</p>';
  // Premier lancement, aucune séance : la rubrique s'explique d'abord
  const intro = introCard('progress'); if (intro) return intro;
  const ws = doneWs(); const d = today(); const wk = weekInfo(d); let h = ''; const tiles = [];
  if (!ws.length) {
    // Rien à comparer : Émile (logo, lumière douce) dit ce qu'il faut, plutôt que des cases à zéro
    const nx = nextSession(); const tp = nx && tplDef(nx);
    h += '<section class="card empty-state"><img class="end-logo' + (firstTime('progress-empty') ? ' e-arrive' : '') + '" src="icons/logo.png" alt="" width="96" height="96"><h2>Ta progression commence ici</h2><p class="muted">Après ta première séance, tu verras ici ton rythme, ta force et tes records.</p>'
      + (tp ? '<button type="button" class="btn primary big" data-act="start" data-v="' + esc(nx) + '">Commencer ' + esc(tp.name) + '</button>' : '') + '</section>';
  } else {
    const fat = fatigueCheck();
    if (fat) h += emile('<p>Baisse de force sur ' + fat.drops.length + ' exercices cette semaine. Regarde l’onglet Aujourd’hui pour avancer la décharge.</p>', { title:'Fatigue probable', tone:'warn', key:'fatigue-p:' + mondayOf(d) });
    const last28 = ws.filter(w => w.date > addDays(d, -28)); const cur = mondayOf(d); const first = mondayOf(ws[0].date); const from = addDays(cur, -56);
    const weeks = weeklyRhythm(from > first ? from : first, addDays(cur, -7));
    tiles.push(tile('rhythm', 'Séances', last28.length, 'ces 28 derniers jours', weeks.map(x => x.sessions)));
    tiles.push(tile('volume', 'Séries', fmtInt(last28.reduce((a, w) => a + countSets(w), 0)), 'ces 28 derniers jours', weeks.map(x => x.sets)));
    const recs = recordLog();
    tiles.push(tile('strength', 'Force', recs.length ? recs.length + unit(recs.length > 1 ? 'records' : 'record') : '—', recs.length ? recs[0].name + ' · ' + fmtDate(recs[0].date) : 'Pas encore de record'));
  }
  const w = weights(); const lw = w[w.length - 1];
  if (ws.length || lw) tiles.push(tile('weight', 'Poids', lw ? fmtKg(r1(lw.y)) + unit('kg') : '—', lw ? (w.length > 1 ? signed(lw.y - w[0].y) + ' kg depuis le ' + fmtDate(w[0].date) : 'le ' + fmtDate(lw.date)) : 'À noter dans Aujourd’hui', w.slice(-12).map(p => p.y)));
  const sl = sleeps().slice(-7);
  if (sl.length) tiles.push(tile('sleep', 'Sommeil', fmtKg(r1(avg(sl.map(p => p.y)))) + unit('h'), sl.length > 1 ? 'moyenne de tes ' + sl.length + ' dernières nuits' : 'le ' + fmtDate(sl[0].date), sl.map(p => p.y)));
  // Douleurs et détente : seulement si elles sont suivies (réglées dans le profil et dans Planning)
  painZones().forEach(z => { const e = painEntries(z); const l = e[e.length - 1]; tiles.push(tile('pain:' + z, ZONES[z].label, l ? l.v + unit('/10') : '—', l ? 'le ' + fmtDate(l.date) : 'À noter dans Aujourd’hui', e.slice(-12).map(k => k.v))); });
  if (jumpsOn()) { const j = jumpTests(); const l = j[j.length - 1]; tiles.push(tile('jumps', 'Détente', l ? fmtKg(l.cm) + unit('cm') : '—', l ? 'le ' + fmtDate(l.date) : 'Aucun test', j.map(x => x.cm))); }
  if (tiles.length) h += '<div class="tiles">' + tiles.join('') + '</div>';
  if (!ws.length) return h;
  h += '<section class="card"><h3>Bilans de bloc</h3><div class="row">';
  for (let bk = 1; bk <= wk.block; bk++) h += '<button type="button" class="btn" data-act="bilan" data-v="' + bk + '">Bloc ' + bk + (bk === wk.block ? ' (en cours)' : '') + '</button>';
  return h + '</div></section>';
}

// Page d'une statistique : retour, titre, période, puis chiffres clés, grande courbe et repères
const TITLES = { rhythm:'Régularité', volume:'Volume d’entraînement', strength:'Force', weight:'Poids de corps', sleep:'Sommeil', jumps:'Détente' };
export function viewStat(){
  if (!S.loaded) return '<p class="loading">Chargement…</p>';
  const k = S.stat; const zone = k.indexOf('pain:') === 0 && ZONES[k.slice(5)] ? k.slice(5) : null;
  let h = '<div class="row"><button type="button" class="link" data-act="stat-close" data-back>‹ Progrès</button></div><h1>' + esc(zone ? ZONES[zone].label : TITLES[k] || 'Progrès') + '</h1>';
  if (k === 'jumps') return h + jumpsPage();
  const from = periodStart(S.prRange); const prev = prevPeriod(S.prRange);
  const P = { from, prev, in: date => !from || date >= from, before: date => !!prev && date >= prev.from && date <= prev.to };
  h += '<div class="seg" role="group" aria-label="Période affichée">' + PERIODS.map(c => '<button type="button" class="chip' + (S.prRange === c[0] ? ' on' : '') + '" data-act="prrange" data-v="' + c[0] + '" aria-pressed="' + (S.prRange === c[0]) + '">' + esc(c[1]) + '</button>').join('') + '</div>';
  return h + (zone ? painPage(zone, P) : k === 'rhythm' ? rhythmPage(false, P) : k === 'volume' ? rhythmPage(true, P) : k === 'strength' ? strengthPage(P) : k === 'weight' ? weightPage(P) : k === 'sleep' ? sleepPage(P) : '');
}
// Écart avec la période d'avant (même durée), seulement si l'historique la couvre en entier : sinon on comparerait à une période incomplète
const versus = (cur, before, first, P) => P.prev && first && first <= P.prev.from ? [[signed(cur - before), 'vs période d’avant']] : [];
const noSession = () => { const nx = nextSession(); const tp = nx && tplDef(nx); return '<section class="card"><p class="muted">Fais ta première séance pour voir cette statistique.</p>' + (tp ? '<button type="button" class="btn primary big" data-act="start" data-v="' + esc(nx) + '">Commencer ' + esc(tp.name) + '</button>' : '') + '</section>'; };

// Régularité (séances) ou volume (séries) par semaine, du lundi au dimanche ; rien avant la première séance (ce n'est pas un zéro)
function rhythmPage(sets, P){
  const ws = doneWs(); if (!ws.length) return noSession();
  const cur = mondayOf(today()); const first = mondayOf(ws[0].date); const val = w => sets ? countSets(w) : 1; const u = sets ? 'séries' : 'séances';
  const start = [P.from ? mondayOf(P.from) : first, first, addDays(cur, -7 * 51)].reduce((a, b) => a > b ? a : b);
  const items = weeklyRhythm(start, cur).map(x => ({ label:x.monday, v: sets ? x.sets : x.sessions, open:x.current })); const done = items.filter(x => !x.open);
  const sum = keep => ws.filter(w => keep(w.date)).reduce((a, w) => a + val(w), 0); const tot = sum(P.in);
  let h = stats([[fmtInt(tot), (tot > 1 ? u : u.slice(0, -1)) + ' sur la période']].concat(done.length ? [[fmtKg(r1(avg(done.map(x => x.v)))), 'par semaine, en moyenne']] : [], versus(tot, sum(P.before), ws[0].date, P)));
  h += '<section class="card">' + (items.length < 2 ? '<p class="empty">La courbe apparaît dès ta 2e semaine d’entraînement.</p>' : bars(items, { unit:u, h:200, label: (sets ? 'Séries validées' : 'Séances terminées') + ' par semaine' }));
  const notes = [sets ? '' : 'Objectif : ' + perWeekOf() + ' séances par semaine.', items.length > 1 && items.some(x => x.open) ? 'En pointillés : la semaine en cours.' : ''].filter(Boolean).join(' ');
  h += (notes ? '<p class="muted small">' + t(notes) + '</p>' : '') + '</section>';
  return h + (sets ? musclesCard(today()) : '');
}
// Séries par muscle de la semaine en cours, comparées à ce que prévoit le programme
function musclesCard(d){
  const mon = mondayOf(d); const doneW = muscleDone(mon, addDays(mon, 6)); const plan = musclePlanned();
  const maxV = Math.max(20, ...MUSCLES.map(x => Math.max(doneW[x], plan[x])));
  let h = '<section class="card"><h3>Par muscle, cette semaine</h3><div class="legend"><span><i style="background:var(--accent)"></i>Fait</span><span><i style="background:var(--court)"></i>Prévu</span></div>';
  // Un muscle ni travaillé ni prévu n'a pas de ligne
  MUSCLES.filter(x => doneW[x] || plan[x]).forEach(x => {
    h += '<div class="mrow"><span>' + esc(x) + '</span><span class="mbar"><i style="width:' + (doneW[x] / maxV * 100).toFixed(1) + '%"></i><b style="left:' + (plan[x] / maxV * 100).toFixed(1) + '%"></b></span><span class="v num">' + fmtKg(doneW[x]) + ' / ' + fmtKg(plan[x]) + '</span></div>';
  });
  return h + '</section>';
}
// Force : records de la période, puis chaque exercice déjà fait (sa ligne ouvre sa fiche et sa courbe)
function strengthPage(P){
  const ws = doneWs(); if (!ws.length) return noSession();
  const recs = recordLog(); const inP = recs.filter(r => P.in(r.date));
  // sans aucun record, pas de cases à zéro : la carte du dessous dit quand ils arrivent
  let h = recs.length ? stats([[inP.length, (inP.length > 1 ? 'records' : 'record') + ' sur la période'], [recs.length, 'depuis le début']].concat(versus(inP.length, recs.filter(r => P.before(r.date)).length, ws[0].date, P))) : '';
  // un record par exercice (le plus récent), en force estimée
  const seen = new Set(); const lastPerEx = inP.filter(r => !seen.has(r.id) && seen.add(r.id)).slice(0, 5);
  h += lastPerEx.length ? '<section class="card gold"><div class="ring-row"><span class="trophy" aria-hidden="true">' + TROPHY + '</span><div class="stack" style="gap:2px"><h2>Tes records</h2><span class="muted small">Force estimée, en kg</span></div></div>'
      + lastPerEx.map(r => '<p class="rec-line"><span>' + esc(r.name) + '</span><span class="num">' + fmtKg(r.kg) + '&nbsp;kg <span class="muted small">+' + fmtKg(r.gain) + '&nbsp;kg · ' + esc(fmtDate(r.date)) + '</span></span></p>').join('') + '</section>'
    : '<section class="card"><p class="muted">' + (recs.length ? 'Pas de record sur cette période.' : 'Tes records apparaissent dès ta 2e séance sur un même exercice.') + '</p></section>';
  const used = new Set(); workouts().forEach(w => Object.keys(w.ex || {}).forEach(k => used.add(canon(k))));
  const mine = allEx().filter(e => used.has(e.id) && (e.kind === 'load' || e.kind === 'bw' || e.kind === 'cardio')).map(e => ({ e, p: exerciseProgress(e.id) })).filter(x => x.p.last.length)
    .sort((a, b) => a.p.last[0].date < b.p.last[0].date ? 1 : a.p.last[0].date > b.p.last[0].date ? -1 : 0);
  if (!mine.length) return h;
  // même règle que la meilleure série de la fiche (poids du corps compris s'il est noté)
  const bestOf = (kind, x) => { const sc = setScore(kind); return x.sets.reduce((m, s) => !m || sc(s) > sc(m) ? s : m, null); };
  const detail = (e, l) => e.kind === 'cardio' ? l.min + ' min' + (l.km ? ' · ' + fmtKg(l.km) + ' km' : '') : (s => (e.kind === 'bw' && !s.kg ? 'PdC' : fmtKg(s.kg) + ' kg') + ' × ' + s.reps)(bestOf(e.kind, l));
  const gains = exerciseGains();
  const row = x => { const g = gains[canon(x.e.id)]; const up = g && g.n >= 2 && g.best.kg > g.first.kg ? ' · force +' + fmtKg(r1(g.best.kg - g.first.kg)) + ' kg' : '';
    return '<button type="button" class="pick" data-act="ex-fiche" data-v="' + esc(x.e.id) + '"><span class="stack" style="gap:2px"><span class="n">' + esc(x.e.name) + '</span><span class="m">' + t(detail(x.e, x.p.last[0]) + ' · ' + fmtDate(x.p.last[0].date) + up) + '</span></span><span aria-hidden="true">›</span></button>'; };
  return h + '<section class="card"><h3>Tes exercices</h3><p class="muted small">Touche un exercice pour voir sa courbe.</p>' + mine.slice(0, 6).map(row).join('')
    + (mine.length > 6 ? '<details class="cue"><summary>Voir les ' + (mine.length - 6) + ' autres exercices</summary>' + mine.slice(6).map(row).join('') + '</details>' : '') + '</section>';
}
function weightPage(P){
  const all = weights(); const pts = xy(all.filter(p => P.in(p.date))); const before = all.filter(p => P.before(p.date)); const last = all[all.length - 1];
  if (!last) return '<section class="card"><p class="muted">Note ton poids dans Aujourd’hui, le matin avant de manger : une pesée toutes les 2 semaines suffit.</p></section>';
  const a = pts[0], b = pts[pts.length - 1]; const nut = nutritionOf(); const gp = nut.on ? myPlan() : null; const gl = gp && gp.target && (gp.status === 'ok' || gp.status === 'fast') ? gp.target : null;
  let h = stats([[fmtKg(r1(last.y)) + unit('kg'), 'dernière pesée, le ' + fmtDate(last.date)]].concat(pts.length > 1 ? [[signed(b.y - a.y) + unit('kg'), 'sur la période']] : [],
    pts.length && before.length ? [[signed(avg(pts.map(p => p.y)) - avg(before.map(p => p.y))) + unit('kg'), 'moyenne vs période d’avant']] : []));
  h += '<section class="card">' + chart([{ pts }], Object.assign({ label:'Poids en kg', unit:'kg', h:220, empty:'Pas de pesée sur cette période.' }, gl ? { thresh:gl, threshLabel:'objectif', threshColor:'var(--good)' } : {}));
  const height = num(settings().height); const ys = pts.map(p => p.y);
  const facts = [pts.length > 1 ? 'Plus bas : ' + fmtKg(r1(Math.min(...ys))) + ' kg' : '', pts.length > 1 ? 'plus haut : ' + fmtKg(r1(Math.max(...ys))) + ' kg' : '', pts.length ? pts.length + ' pesée' + (pts.length > 1 ? 's' : '') : '', height ? 'IMC ' + fmtKg(r1(last.y / Math.pow(height / 100, 2))) : ''].filter(Boolean).join(' · ');
  if (facts) h += '<p class="muted small">' + t(facts) + '</p>';
  if (pts.length === 1) h += '<p class="muted small">Une seule pesée sur la période : il en faut 2 pour voir une évolution.</p>';
  h += '</section>';
  const nw = nextWeigh(today());
  return h + '<section class="card"><h3>Ta tendance</h3><p class="small">' + esc(weightReading()) + '</p><p class="muted small">' + t(nw.due ? 'Prochaine pesée : maintenant, le matin avant de manger.' : withDot('Prochaine pesée : vers le ' + fmtDate(nw.date))) + '</p></section>';
}
function sleepPage(P){
  const all = sleeps(); const pts = xy(all.filter(p => P.in(p.date))); const before = all.filter(p => P.before(p.date));
  if (!all.length) return '<section class="card"><p class="muted">Note tes heures de sommeil dans Aujourd’hui pour voir ta courbe.</p></section>';
  const m = pts.length ? avg(pts.map(p => p.y)) : null; const short = pts.filter(p => p.y < 6).length;
  let h = m == null ? '' : stats([[fmtKg(r1(m)) + unit('h'), 'en moyenne, sur ' + pts.length + ' nuit' + (pts.length > 1 ? 's' : '')], [short, short > 1 ? 'nuits sous 6 h' : 'nuit sous 6 h']].concat(before.length ? [[signed(m - avg(before.map(p => p.y))) + unit('h'), 'vs période d’avant']] : []));
  return h + '<section class="card">' + chart([{ pts, color:'var(--court)' }], { label:'Sommeil en heures', unit:'h', h:220, yMin:0, thresh:7, threshLabel:'7 h', empty:'Pas de nuit notée sur cette période.' }) + '</section>';
}
// Douleur d'une zone suivie : note du jour (courbe) et douleur maximale pendant les séances (points)
function painPage(z, P){
  const all = painEntries(z); const e = all.filter(k => P.in(k.date)); const last = all[all.length - 1]; const day = z === 'knee' ? 'stairs' : 'day';
  if (!last) return '<section class="card"><p class="muted">Note ta douleur dans Aujourd’hui pour voir sa courbe.</p></section>';
  const high = new Set(e.filter(k => k.v > PAIN_LIMIT).map(k => k.date)).size; const pts = src => e.filter(k => k.src === src).map(k => ({ x:parseIso(k.date).getTime(), y:k.v }));
  let h = stats([[last.v + unit('/10'), 'dernière note, le ' + fmtDate(last.date)]].concat(e.length ? [[Math.max(...e.map(k => k.v)) + unit('/10'), 'au plus haut sur la période'], [high, (high > 1 ? 'jours' : 'jour') + ' au-dessus de ' + PAIN_LIMIT + '/10']] : []));
  h += '<section class="card">' + chart([{ pts: pts(day) }, { pts: pts('session'), color:'var(--court)', line:false }], { yMin:0, yMax:10, h:220, thresh:PAIN_LIMIT, threshLabel:PAIN_LIMIT + '/10', area:false, label:'Douleur : ' + ZONES[z].label.toLowerCase(), empty:'Pas de note sur cette période.' });
  h += '<div class="legend"><span><i style="background:var(--accent)"></i>' + (z === 'knee' ? 'Escaliers le matin' : 'Note du jour') + '</span><span><i style="background:var(--court)"></i>Pendant les séances</span></div></section>';
  return h + '<p class="muted small">Ce n’est pas un diagnostic : si une douleur dure ou revient, consulte un médecin ou un kiné.</p>';
}
// Tests de détente : un par bloc, pendant la semaine de décharge ; ajout et suppression ici
function jumpsPage(){
  const tests = jumpTests(); const wk = weekInfo(today()); const last = tests[tests.length - 1];
  let h = tests.length ? stats([[fmtKg(last.cm) + unit('cm'), 'dernier test, le ' + fmtDate(last.date)], [fmtKg(Math.max(...tests.map(x => x.cm))) + unit('cm'), 'ton meilleur saut']].concat(tests.length > 1 ? [[signed(last.cm - tests[0].cm) + unit('cm'), 'depuis ton premier test']] : [])) : '';
  h += '<section class="card">' + chart([{ pts: tests.map(x => ({ x: parseIso(x.date).getTime(), y: x.cm })) }], { label:'Détente verticale en cm', unit:'cm', h:220, empty:'Aucun test pour l’instant.' });
  h += '<p class="muted small">' + (testForBlock(wk.block) ? 'Test du bloc ' + wk.block + ' fait.' : 'Prochain test : semaine du ' + esc(withDot(fmtDate(addDays(blockRange(wk.block).from, 35))))) + ' ' + esc(JUMP_PROTOCOL) + '</p></section>';
  h += '<section class="card"><h3>Ajouter un test</h3><div class="row"><input class="plain" type="date" id="test-date" value="' + today() + '" aria-label="Date du test" style="width:auto"><input class="plain" id="test-cm" inputmode="decimal" placeholder="Hauteur en cm" aria-label="Hauteur en cm" style="flex:1;min-width:120px;width:auto"><button type="button" class="btn primary" data-act="add-test">Ajouter</button></div>';
  if (tests.length) h += '<div class="scroll"><table class="tbl"><tbody>' + tests.slice().reverse().map(x => '<tr><td>' + esc(fmtDate(x.date)) + '</td><td class="num">' + fmtKg(x.cm) + ' cm</td><td style="text-align:right"><button type="button" class="link" data-act="del-test" data-v="' + x.id + '">' + (S.confirm === x.id ? 'Confirmer' : 'Supprimer') + '</button></td></tr>').join('') + '</tbody></table></div>';
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
  h += '<section class="card"><h3>Force par exercice</h3><p class="muted small">Entre la première et la dernière séance du bloc, hors décharge.</p>';
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
