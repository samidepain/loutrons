// Écrans Progrès et Bilan de bloc.
import { addDays, e1rm, esc, fmtDate, fmtKg, mondayOf, num, parseIso, today, withDot } from '../util.js';
import { DAY_ORDER, JUMP_PROTOCOL, MUSCLES } from '../library.js';
import { S } from '../store.js';
import { allEx, allTpl, blockRange, bodyDocs, bodyweight, canon, exDef, history, jumpsOn, kneeEntries, kneeOn, planDay, settings, testForBlock, weekInfo, workouts } from '../data.js';
import { blockReport, fatigueCheck, muscleDone, musclePlanned } from '../engine.js';
import { chart } from '../chart.js';
import { viewHistory } from './history.js';
import { emile } from '../emile.js';
import { myPlan, nutritionOf } from './goal.js';

const PRTABS = [['stats','Résumé'],['history','Historique']];
export function viewProgressPage(){
  const h = '<h1>Progrès</h1><div class="seg" role="tablist">' + PRTABS.map(t => '<button type="button" class="chip' + (S.progressTab === t[0] ? ' on' : '') + '" data-act="prtab" data-v="' + t[0] + '" role="tab" aria-selected="' + (S.progressTab === t[0]) + '">' + t[1] + '</button>').join('') + '</div>';
  return h + (S.progressTab === 'history' ? viewHistory() : viewProgress());
}
function viewProgress(){
  if (!S.loaded) return '<p class="empty">Chargement…</p>';
  const ws = workouts().filter(w => w.status === 'terminée'); const d = today();
  const last28 = ws.filter(w => w.date > addDays(d, -28)); const wk = weekInfo(d);
  const perWeek = DAY_ORDER.filter(x => planDay(x).s).length;
  let h = '';
  h += '<div class="stats"><div class="stat"><span class="v num">' + ws.length + '</span><span class="l">séances au total</span></div><div class="stat"><span class="v num">' + last28.length + '<span class="small muted">/' + perWeek * 4 + '</span></span><span class="l">sur 4 semaines</span></div><div class="stat"><span class="v num">' + wk.n + '</span><span class="l">semaine du programme</span></div></div>';

  const fat = fatigueCheck();
  if (fat) h += emile('<p>Baisse de force sur ' + fat.drops.length + ' exercices cette semaine. Regarde l’onglet Aujourd’hui pour avancer la décharge.</p>', { title:'Fatigue probable', tone:'warn' });
  h += '<section class="card"><h3>Bilans de bloc</h3><p class="muted small">Un bloc = 6 semaines. Le bilan compare le début et la fin du bloc et propose des pistes.</p><div class="row">';
  for (let bk = 1; bk <= wk.block; bk++) h += '<button type="button" class="btn" data-act="bilan" data-v="' + bk + '">Bloc ' + bk + (bk === wk.block ? ' (en cours)' : '') + '</button>';
  h += '</div></section>';

  // Séries par muscle
  const mon = mondayOf(d); const doneW = muscleDone(mon, addDays(mon, 6)); const lastW = muscleDone(addDays(mon, -7), addDays(mon, -1)); const plan = musclePlanned();
  const maxV = Math.max(20, ...MUSCLES.map(x => Math.max(doneW[x], plan[x], lastW[x])));
  h += '<section class="card"><div class="stack"><h3>Séries par muscle cette semaine</h3><p class="muted small">Une série compte pour 1 sur le muscle principal et pour 0,5 sur les muscles secondaires (comptage fractionné de Pelland et al., 2026). Plus de séries donne plus de muscle avec des gains de plus en plus faibles, sans seuil obligatoire.</p></div>';
  h += '<div class="legend"><span><i style="background:var(--accent)"></i>Fait cette semaine</span><span><i style="background:var(--court)"></i>Prévu par ton planning</span></div>';
  MUSCLES.forEach(x => {
    h += '<div class="mrow"><span>' + esc(x) + '</span><span class="mbar"><i style="width:' + (doneW[x] / maxV * 100).toFixed(1) + '%"></i><b style="left:' + (plan[x] / maxV * 100).toFixed(1) + '%"></b></span><span class="v num">' + fmtKg(doneW[x]) + ' / ' + fmtKg(plan[x]) + '</span></div>';
  });
  h += '<p class="muted small">Semaine dernière : ' + MUSCLES.filter(x => lastW[x] > 0).map(x => x + ' ' + fmtKg(lastW[x])).join(' · ') + (MUSCLES.some(x => lastW[x] > 0) ? '' : 'aucune série enregistrée') + '.</p></section>';

  // Par exercice
  const used = new Set(); workouts().forEach(w => Object.keys(w.ex || {}).forEach(k => used.add(canon(k))));
  const exList = allEx().filter(e => (e.kind === 'load' || e.kind === 'bw') && (used.has(e.id) || allTpl().some(t => t.items.some(it => canon(it.ex) === e.id))));
  const ex = exDef(S.progEx) || exList[0];
  if (ex) {
    const hist = history(ex.id, null).slice().reverse(); const bw = bodyweight();
    h += '<section class="card"><h3>Par exercice</h3><label class="f"><span>Exercice</span><select id="prog-ex">' + exList.map(e => '<option value="' + esc(e.id) + '"' + (e.id === ex.id ? ' selected' : '') + '>' + esc(e.name) + '</option>').join('') + '</select></label>';
    const tot = kg => ex.kind === 'bw' ? (bw || 0) + kg : kg;
    if (ex.kind === 'load' || bw) {
      const pts = hist.map(x => ({ x: parseIso(x.date).getTime(), y: Math.round(Math.max.apply(null, x.sets.map(s => e1rm(tot(s.kg), s.reps))) * 10) / 10 }));
      h += '<p class="muted small">Force estimée (1RM, formule d’Epley) de ta meilleure série' + (ex.kind === 'bw' ? ', poids du corps compris' : '') + '.</p>' + chart([{ pts }], { label:'Force estimée', empty:'Fais cet exercice une première fois pour voir ta courbe.' });
    } else {
      const pts = hist.map(x => ({ x: parseIso(x.date).getTime(), y: x.sets.reduce((a, s) => a + s.reps, 0) }));
      h += '<p class="muted small">Total de reps par séance. Note ton poids de corps pour voir la force estimée.</p>' + chart([{ pts }], { label:'Total de reps', empty:'Fais cet exercice une première fois pour voir ta courbe.' });
    }
    if (hist.length) h += '<div class="scroll"><table class="tbl"><thead><tr><th>Date</th><th>Séries</th><th>Réserve</th></tr></thead><tbody>' + hist.slice().reverse().slice(0, 8).map(x => '<tr><td>' + esc(fmtDate(x.date)) + (x.deload ? ' <span class="pill court">déch.</span>' : '') + '</td><td>' + x.sets.map(s => (ex.kind === 'bw' && !s.kg ? 'PdC' : fmtKg(s.kg)) + '×' + s.reps).join(' · ') + '</td><td class="num">' + (x.rir == null ? '—' : (x.rir >= 4 ? '4+' : x.rir)) + '</td></tr>').join('') + '</tbody></table></div>';
    h += '</section>';
  }

  // Corps
  const bd = bodyDocs(); const height = num(settings().height);
  const wPts = bd.filter(x => num(x.weight) > 0).map(x => ({ x: parseIso(x.date).getTime(), y: num(x.weight) }));
  const sPts = bd.filter(x => num(x.sleep) > 0).map(x => ({ x: parseIso(x.date).getTime(), y: num(x.sleep) }));
  const bwNow = bodyweight(); const gp = nutritionOf().on ? myPlan() : null; const gl = gp && gp.target && (gp.status === 'ok' || gp.status === 'fast') ? gp.target : null;
  h += '<section class="card"><h3>Poids de corps</h3>' + (bwNow && height ? '<p class="muted small">Dernier : ' + fmtKg(bwNow) + ' kg · taille ' + fmtKg(height) + ' cm · IMC ' + fmtKg(Math.round(bwNow / Math.pow(height / 100, 2) * 10) / 10) + '. En prise de muscle, une hausse lente et régulière est le signe attendu.</p>' : '<p class="muted small">Note ton poids dans Aujourd’hui et ta taille dans ton profil.</p>') + chart([{ pts:wPts }], gl ? { label:'Poids', empty:'Pas encore de pesée.', thresh:gl, threshLabel:'objectif', threshColor:'var(--good)' } : { label:'Poids', empty:'Pas encore de pesée.' }) + '</section>';
  h += '<section class="card"><h3>Sommeil</h3>' + chart([{ pts:sPts, color:'var(--court)' }], { label:'Sommeil', yMin:0, thresh:7, threshLabel:'7 h', empty:'Note tes heures de sommeil dans Aujourd’hui.' }) + '</section>';

  // Genou
  const ke = kneeEntries();
  if (kneeOn()) h += '<section class="card"><h3>Genou</h3><p class="muted small">Escaliers le matin (courbe) et douleur max pendant les séances jambes (points). La ligne pointillée marque 3/10.</p>' +
    chart([{ pts: ke.filter(k => k.src === 'stairs').map(k => ({ x: parseIso(k.date).getTime(), y: k.v })) }, { pts: ke.filter(k => k.src === 'session').map(k => ({ x: parseIso(k.date).getTime(), y: k.v })), color:'var(--court)', line:false }], { yMin:0, yMax:10, thresh:3, threshLabel:'3/10', area:false, label:'Douleur au genou', empty:'Note la douleur aux escaliers dans Aujourd’hui.' }) + '</section>';

  // Détente
  if (!jumpsOn()) return h;
  const tests = []; S.docs.forEach((o, id) => { if (id.indexOf('t_') === 0) tests.push(Object.assign({ id }, o)); });
  tests.sort((a, b) => a.date < b.date ? -1 : 1);
  h += '<section class="card"><h3>Tests de détente</h3><p class="muted small">Un test par bloc, pendant la semaine de décharge : il s’affiche au début de ta séance jambes. ' + esc(JUMP_PROTOCOL) + '</p>' + (testForBlock(wk.block) ? '<p class="small">Test du bloc ' + wk.block + ' fait.</p>' : '<p class="small">Prochain test : semaine du ' + esc(withDot(fmtDate(addDays(blockRange(wk.block).from, 35)))) + '</p>') +
    chart([{ pts: tests.map(t => ({ x: parseIso(t.date).getTime(), y: t.cm })) }], { label:'Détente verticale', empty:'Aucun test pour l’instant.' }) +
    '<div class="row"><input class="plain" type="date" id="test-date" value="' + today() + '" aria-label="Date du test" style="width:auto"><input class="plain" id="test-cm" inputmode="decimal" placeholder="Hauteur en cm" aria-label="Hauteur en cm" style="flex:1;min-width:120px;width:auto"><button type="button" class="btn primary" data-act="add-test">Ajouter</button></div>';
  if (tests.length) h += '<div class="scroll"><table class="tbl"><tbody>' + tests.slice().reverse().map(t => '<tr><td>' + esc(fmtDate(t.date)) + '</td><td class="num">' + fmtKg(t.cm) + ' cm</td><td style="text-align:right"><button type="button" class="link" data-act="del-test" data-v="' + t.id + '">' + (S.confirm === t.id ? 'Confirmer' : 'Supprimer') + '</button></td></tr>').join('') + '</tbody></table></div>';
  return h + '</section>';
}
export function viewBilan(block){
  if (!S.loaded) return '<p class="empty">Chargement…</p>';
  const R = blockReport(block);
  let h = '<div class="row"><button type="button" class="link" data-act="bilan-close" data-back>‹ Retour</button></div><h1>Bilan du bloc ' + block + '</h1>';
  h += '<p class="muted">' + esc(fmtDate(R.r.from)) + ' – ' + esc(fmtDate(R.r.to)) + (R.finished ? '' : ' · en cours, ' + R.weeks + ' semaine' + (R.weeks > 1 ? 's' : '') + ' écoulée' + (R.weeks > 1 ? 's' : '')) + '</p>';
  const avgF = R.forces.length ? R.forces.reduce((a, f) => a + f.pct, 0) / R.forces.length : null;
  h += '<div class="stats"><div class="stat"><span class="v num">' + R.done.length + '<span class="small muted">/' + R.planned + '</span></span><span class="l">séances faites</span></div><div class="stat"><span class="v num">' + (avgF == null ? '—' : (avgF >= 0 ? '+' : '') + fmtKg(Math.round(avgF * 10) / 10) + '%') + '</span><span class="l">force moyenne</span></div>' + (jumpsOn() ? '<div class="stat"><span class="v num">' + (R.test ? fmtKg(R.test.cm) : '—') + '</span><span class="l">détente (cm)</span></div>' : '<div class="stat"><span class="v num">' + R.weeks + '</span><span class="l">semaine' + (R.weeks > 1 ? 's' : '') + '</span></div>') + '</div>';
  h += emile((R.tips.length ? R.tips.map(t => '<div class="alert ' + (t[0] === 'bad' ? '' : t[0]) + '" style="font-weight:500">' + esc(t[1]) + '</div>').join('') : '<p class="small">Pas encore assez de données : continue de noter tes séances' + (kneeOn() ? ', ton genou' : '') + ', ton poids et ton sommeil.</p>') + '<p class="muted small">Ce sont des pistes calculées à partir de tes données, à ajuster avec ton ressenti.</p>', { title:'Pistes pour la suite' });
  h += '<section class="card"><h3>Force par exercice</h3><p class="muted small">Force estimée (Epley) à la première et à la dernière séance du bloc, hors décharge. Il faut au moins 2 séances par exercice.</p>';
  h += R.forces.length ? '<div class="scroll"><table class="tbl"><thead><tr><th>Exercice</th><th>Début</th><th>Fin</th><th>Écart</th></tr></thead><tbody>' + R.forces.map(f => '<tr><td>' + esc(f.name) + '</td><td class="num">' + fmtKg(Math.round(f.from)) + (f.unit === 'reps' ? ' reps' : '') + '</td><td class="num">' + fmtKg(Math.round(f.to)) + (f.unit === 'reps' ? ' reps' : '') + '</td><td class="num" style="color:var(--' + (f.pct >= 1 ? 'good' : f.pct <= -2.5 ? 'bad' : 'muted') + ')">' + (f.pct >= 0 ? '+' : '') + fmtKg(Math.round(f.pct * 10) / 10) + ' %</td></tr>').join('') + '</tbody></table></div>' : '<p class="empty">Pas encore 2 séances sur le même exercice dans ce bloc.</p>';
  h += '</section>';
  const maxV = Math.max(20, ...MUSCLES.map(m => Math.max(R.avg[m], R.mp[m])));
  h += '<section class="card"><h3>Séries par muscle (moyenne par semaine)</h3><div class="legend"><span><i style="background:var(--accent)"></i>Moyenne faite</span><span><i style="background:var(--court)"></i>Prévu par semaine</span></div>';
  MUSCLES.forEach(m => { h += '<div class="mrow"><span>' + esc(m) + '</span><span class="mbar"><i style="width:' + (R.avg[m] / maxV * 100).toFixed(1) + '%"></i><b style="left:' + (R.mp[m] / maxV * 100).toFixed(1) + '%"></b></span><span class="v num">' + fmtKg(Math.round(R.avg[m] * 10) / 10) + ' / ' + fmtKg(R.mp[m]) + '</span></div>'; });
  h += '</section>';
  h += '<section class="card"><h3>' + (kneeOn() ? 'Genou, poids et sommeil' : 'Poids et sommeil') + '</h3><div class="stack small">';
  if (kneeOn()) h += '<p><b>Genou :</b> ' + (R.kneeMax == null ? 'aucune mesure.' : R.kneeN + ' mesures, max ' + R.kneeMax + '/10, ' + R.kneeHigh + ' jour(s) au-dessus de 3/10.') + '</p>';
  h += '<p><b>Poids :</b> ' + (R.wc ? fmtKg(R.wc.from) + ' → ' + fmtKg(R.wc.to) + ' kg (' + (R.wc.kg >= 0 ? '+' : '') + fmtKg(Math.round(R.wc.kg * 10) / 10) + ' kg, ' + fmtKg(Math.round(R.wc.pctWeek * 100) / 100) + ' % par semaine).' : 'il faut au moins 2 pesées dans le bloc.') + '</p>';
  h += '<p><b>Sommeil :</b> ' + (R.sleepAvg == null ? 'aucune donnée.' : 'moyenne ' + fmtKg(Math.round(R.sleepAvg * 10) / 10) + ' h, ' + R.shortN + ' nuit(s) sous 6 h.') + '</p>';
  if (jumpsOn()) h += '<p><b>Détente :</b> ' + (R.test ? fmtKg(R.test.cm) + ' cm' + (R.prevTest ? ' (bloc précédent : ' + fmtKg(R.prevTest.cm) + ' cm)' : '') : 'pas de test dans ce bloc.') + '</p>';
  h += '</div></section>';
  return h;
}
