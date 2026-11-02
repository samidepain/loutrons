// Fiche d’un exercice : photos du mouvement, muscles travaillés, consignes.
import { esc, fmtKg } from '../util.js';
import { KINDS } from '../library.js';
import { S } from '../store.js';
import { excluded, exDef } from '../data.js';
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
  if (e.kind === 'load' || e.kind === 'bw') return e.sets + ' × ' + e.lo + '-' + e.hi + (e.uni ? ' par côté' : '') + ' · repos ' + e.rest + ' s · palier ' + fmtKg(e.step) + ' kg';
  if (e.kind === 'plyo') return e.sets + ' × ' + e.lo + ' ' + (e.unit || '');
  return '';
}
export function viewFiche(){
  const back = '<div class="row"><button type="button" class="link" data-act="fiche-close" data-back>‹ Exercices</button></div>';
  const e = exDef(S.fiche);
  if (!e || e.deleted) return back + '<p class="empty">Cet exercice n’existe plus.</p>';
  const p = presc(e);
  let h = back + '<section class="card"><div class="stack" style="gap:4px"><h2>' + esc(e.name) + '</h2><span class="muted small">' + esc(KINDS[e.kind] || '') + (p ? ' · ' + esc(p) : '') + (e.custom ? ' · perso' : '') + '</span></div>';
  h += exVisual(e);
  if (e.cue) h += '<div class="stack" style="gap:4px"><h3>Consignes</h3><p>' + esc(e.cue) + '</p></div>';
  if (excluded().indexOf(e.id) >= 0) h += '<p class="muted small">Exercice masqué : il n’est plus proposé quand tu ajoutes ou remplaces un exercice.</p>';
  h += '<button type="button" class="btn" data-act="edit-ex" data-v="' + esc(e.id) + '">Modifier l’exercice</button>';
  if (e.photo) h += '<p class="muted small">Photos : Free Exercise DB, domaine public.</p>';
  return h + '</section>';
}
