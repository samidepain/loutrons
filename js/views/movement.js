// « Voir le mouvement » : photos de départ et d'arrivée en alternance, consignes, silhouette en grand avec le nom des muscles.
// Le bloc sert dans la fenêtre ouverte depuis la séance (S.move) et dans la fiche de l'exercice.
import { esc } from '../util.js';
import { S } from '../store.js';
import { exDef } from '../data.js';
import { bodyMap, musclesForMap } from '../bodymap.js';

const lessMotion = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
const src = (e, n) => 'photos/' + esc(e.photo) + '-' + n + '.jpg';
const alt = (e, n) => esc(e.name) + ' : position ' + (n ? 'd’arrivée' : 'de départ');
// Photos du domaine public (Free Exercise DB) : chargées à l'affichage, puis gardées pour le hors connexion par le service worker
function photos(e){
  if (!e.photo) return '';
  const off = '<p class="photos-off muted small" hidden>Les photos s’affichent avec une connexion internet.</p>';
  // Moins d'animations demandé : les deux photos côte à côte, sans alternance
  if (lessMotion()) return '<div class="photos">' + [0, 1].map(n => '<figure><img src="' + src(e, n) + '" width="360" height="240" loading="lazy" alt="' + alt(e, n) + '"><figcaption>' + (n ? 'Arrivée' : 'Départ') + '</figcaption></figure>').join('') + '</div>' + off;
  // Alternance en CSS (2,9 s par cycle) ; un toucher fige l'animation où elle en est, sans redessiner l'écran
  // Nom du bouton pour les lecteurs d'écran : l'action (texte caché), puis la description des deux photos
  return '<button type="button" class="mv-photos" data-act="move-pause" aria-pressed="false"><span class="sr">Mettre en pause l’animation : </span>'
    + [0, 1].map(n => '<img class="mv-' + (n ? 'b' : 'a') + '" src="' + src(e, n) + '" width="360" height="240" alt="' + alt(e, n) + '">').join('') + '</button>'
    + '<p class="mv-cap"><span class="mv-ls"><span class="mv-l mv-la">Départ</span><span class="mv-l mv-lb">Arrivée</span></span><span class="mv-hint">touche pour mettre en pause</span><span class="mv-p">En pause · touche pour reprendre</span></p>' + off;
}
// Photo, consignes ou muscles : de quoi montrer le mouvement
export const hasMovement = e => !!e && !!(e.photo || e.cue || musclesForMap(e));
// Photos, consignes (dans la fenêtre seulement), puis silhouette en grand et noms des muscles
export function movementBlock(e, opts){
  const m = musclesForMap(e); const cue = opts && opts.cue && e.cue;
  return '<div class="mv">' + photos(e) + (cue ? '<div class="stack mv-cue"><h3>Consignes</h3><p>' + esc(e.cue) + '</p></div>' : '') + (m ? bodyMap(m, { big:true }) : '') + '</div>';
}
// Fenêtre ouverte depuis la séance
export function viewMovement(){
  const e = exDef(S.move);
  let h = '<div class="row between"><button type="button" class="link" data-act="move-close">Fermer</button></div>';
  if (!e) return h + '<p class="empty">Cet exercice n’existe plus.</p>';
  return h + '<h1>' + esc(e.name) + '</h1><section class="card">' + movementBlock(e, { cue:true }) + (e.photo ? '<p class="muted small">Photos : Free Exercise DB, domaine public.</p>' : '') + '</section>';
}
