// Fiche d’un exercice : tes progrès (s'il a déjà été fait), photos du mouvement, muscles travaillés, consignes.
import { e1rm, esc, fmtDate, fmtKg, fmtRest, parseIso } from '../util.js';
import { KINDS } from '../library.js';
import { S } from '../store.js';
import { bodyweight, excluded, exDef, history } from '../data.js';
import { exerciseProgress } from '../engine.js';
import { chart } from '../chart.js';
import { bodyMap, musclesForMap } from '../bodymap.js';

// Photos du domaine public (Free Exercise DB), dans photos/ : chargées seulement quand on les affiche, puis gardées pour le hors connexion
function photos(e){
  if (!e.photo) return '';
  const fig = (n, t) => '<figure><img src="photos/' + esc(e.photo) + '-' + n + '.jpg" width="360" height="240" loading="lazy" alt="' + esc(e.name) + ' : position ' + (n ? 'd’arrivée' : 'de départ') + '"><figcaption>' + t + '</figcaption></figure>';
  return '<div class="photos">' + fig(0, 'Départ') + fig(1, 'Arrivée') + '</div><p class="photos-off muted small" hidden>Les photos s’affichent avec une connexion internet.</p>';
}
// Photos puis silhouette : utilisé dans la fiche et dans les consignes pendant la séance
export function exVisual(e){ const m = musclesForMap(e); return photos(e) + (m ? bodyMap(m) : ''); }
function presc(e){
  if (e.kind === 'load' || e.kind === 'bw') return e.sets + ' × ' + e.lo + '-' + e.hi + (e.uni ? ' par côté' : '') + ' · repos ' + fmtRest(e.rest) + ' · palier ' + fmtKg(e.step) + ' kg';
  if (e.kind === 'cardio') return e.lo + ' min' + (e.levels && e.levels.length > 1 ? ' · ' + e.levels.length + ' allures' : '');
  if (e.kind === 'plyo') return e.sets + ' × ' + e.lo + ' ' + (e.unit || '');
  return '';
}
// Tes progrès : meilleure série (force estimée d'Epley), courbe et 5 dernières séances ; cardio : dernières séances
function progressPart(e, pr){
  let h = '<div class="stack"><h3>Tes progrès</h3>';
  if (pr.kind === 'cardio') {
    const lv = id => ((e.levels || []).find(l => l[0] === id) || [])[1] || '';
    h += '<div class="scroll"><table class="tbl"><thead><tr><th>Date</th><th>Durée</th><th>Distance</th><th>Allure</th></tr></thead><tbody>' + pr.last.map(x => '<tr><td>' + esc(fmtDate(x.date)) + '</td><td class="num">' + x.min + ' min</td><td class="num">' + (x.km ? fmtKg(x.km) + ' km' : '—') + '</td><td>' + esc(lv(x.level)) + '</td></tr>').join('') + '</tbody></table></div>';
    return h + '</div>';
  }
  const bw = bodyweight(); const tot = kg => e.kind === 'bw' ? (bw || 0) + kg : kg;
  if (pr.best) h += '<p>Meilleure série : <b class="num">' + (e.kind === 'bw' && !pr.best.kg ? 'PdC' : fmtKg(pr.best.kg) + ' kg') + ' × ' + pr.best.reps + '</b> · ' + esc(fmtDate(pr.best.date)) + (pr.best.e1rm != null ? ' · force estimée ' + fmtKg(pr.best.e1rm) + ' kg' : '') + '</p>';
  // même courbe que l'ancien bloc « Par exercice » de Progrès : force estimée, ou total de reps sans poids de corps noté
  const hist = history(e.id, null).slice().reverse();
  if (e.kind === 'load' || bw) h += '<p class="muted small">Force estimée (1RM, formule d’Epley) de ta meilleure série' + (e.kind === 'bw' ? ', poids du corps compris' : '') + '.</p>' + chart([{ pts: hist.map(x => ({ x: parseIso(x.date).getTime(), y: Math.round(Math.max.apply(null, x.sets.map(s => e1rm(tot(s.kg), s.reps))) * 10) / 10 })) }], { label:'Force estimée', empty:'Fais cet exercice une première fois pour voir ta courbe.' });
  else h += '<p class="muted small">Total de reps par séance. Note ton poids de corps pour voir la force estimée.</p>' + chart([{ pts: hist.map(x => ({ x: parseIso(x.date).getTime(), y: x.sets.reduce((a, s) => a + s.reps, 0) })) }], { label:'Total de reps', empty:'Fais cet exercice une première fois pour voir ta courbe.' });
  h += '<div class="scroll"><table class="tbl"><thead><tr><th>Date</th><th>Séries</th><th>Réserve</th></tr></thead><tbody>' + pr.last.map(x => '<tr><td>' + esc(fmtDate(x.date)) + (x.deload ? ' <span class="pill court">déch.</span>' : '') + '</td><td>' + x.sets.map(s => (e.kind === 'bw' && !s.kg ? 'PdC' : fmtKg(s.kg)) + '×' + s.reps).join(' · ') + '</td><td class="num">' + (x.rir == null ? '—' : (x.rir >= 4 ? '4+' : x.rir)) + '</td></tr>').join('') + '</tbody></table></div>';
  return h + '</div>';
}
export function viewFiche(){
  const back = '<div class="row"><button type="button" class="link" data-act="fiche-close" data-back>‹ ' + (S.ficheFrom === 'progress' ? 'Progrès' : 'Exercices') + '</button></div>';
  const e = exDef(S.fiche);
  if (!e || e.deleted) return back + '<p class="empty">Cet exercice n’existe plus.</p>';
  const p = presc(e); const pr = exerciseProgress(e.id);
  let h = back + '<section class="card"><div class="stack" style="gap:4px"><h2>' + esc(e.name) + '</h2><span class="muted small">' + esc(KINDS[e.kind] || '') + (p ? ' · ' + esc(p) : '') + (e.custom ? ' · perso' : '') + '</span></div>';
  // déjà fait : les progrès d'abord ; jamais fait : la fiche habituelle et une ligne d'attente ; pas de progrès pour les sauts et les contrôles
  const suivi = e.kind === 'load' || e.kind === 'bw' || e.kind === 'cardio';
  if (suivi && pr.last.length) h += progressPart(e, pr);
  else if (suivi) h += '<p class="muted small">Pas encore fait : tes progrès apparaîtront ici.</p>';
  h += exVisual(e);
  if (e.cue) h += '<div class="stack" style="gap:4px"><h3>Consignes</h3><p>' + esc(e.cue) + '</p></div>';
  if (excluded().indexOf(e.id) >= 0) h += '<p class="muted small">Exercice masqué : il n’est plus proposé quand tu ajoutes ou remplaces un exercice.</p>';
  h += '<button type="button" class="btn" data-act="edit-ex" data-v="' + esc(e.id) + '">Modifier l’exercice</button>';
  if (e.photo) h += '<p class="muted small">Photos : Free Exercise DB, domaine public.</p>';
  return h + '</section>';
}
