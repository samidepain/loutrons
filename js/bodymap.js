// Silhouette de face et de dos, muscles principaux en orange et secondaires en beige ou brun (dessin de l'appli, sans fichier).
import { esc } from './util.js';

// Formes du côté gauche (reprises en miroir à droite), puis formes centrales. Muscle : nom de MUSCLES, ou '' pour le reste du corps.
const LEFT = {
  front: [
    ['Épaules', 'M37 35C29 34 24 38 23 47c0 3 2 5 5 4 2-6 5-10 10-11z'],
    ['Pectoraux', 'M49 37v18c-6 3-13 2-16-3-1-5 0-10 4-13 4-2 8-2 12-2z'],
    ['Biceps', 'M27 53c-4 3-6 10-6 17 1 3 5 3 7 0 2-6 3-12 2-16z'],
    ['', 'M21 74c-3 6-5 14-5 21l4 1c3-7 6-15 7-22z'],
    ['', 'M14 97c0-2 2-3 4-3s3 2 3 4l-1 5c-2 1-4 1-5 0z'],
    ['Abdos', 'M34 56c2 3 5 4 7 4-1 12-1 24 0 35l-4 2c-2-9-3-25-3-41z'],
    ['Quadriceps', 'M36 107c-2 13-1 28 2 43 3 3 7 3 9 0 2-12 2-28 1-36-4-2-8-4-12-7z'],
    ['', 'M38 153c3 4 7 4 9 0v6c-3 2-6 2-9 0z'],
    ['', 'M38 161c-1 11 0 23 2 34h5c1-11 2-23 2-34z'],
    ['', 'M39 196h7l1 6H37z']
  ],
  back: [
    ['Épaules', 'M37 35C29 34 24 38 23 47c0 3 2 5 5 4 2-6 5-10 10-11z'],
    ['Dos', 'M37 41l7 4 5 12v27c-5-1-10-6-13-14-2-10-2-20 1-29z'],
    ['Triceps', 'M27 53c-4 3-6 10-6 17 1 3 5 3 7 0 2-6 3-12 2-16z'],
    ['', 'M21 74c-3 6-5 14-5 21l4 1c3-7 6-15 7-22z'],
    ['', 'M14 97c0-2 2-3 4-3s3 2 3 4l-1 5c-2 1-4 1-5 0z'],
    ['Fessiers', 'M49 101v20c-6 2-12 0-13-7-1-6 1-11 4-13z'],
    ['Ischios', 'M36 123c-1 10 0 20 3 29 3 2 6 2 8 0 2-10 2-20 1-28-4 1-8 1-12-1z'],
    ['', 'M39 154c3 2 6 2 8 0v5c-3 1-6 1-8 0z'],
    ['Mollets', 'M38 160c-3 7-2 17 2 26 2 4 5 4 6 0 2-8 2-18 1-26z'],
    ['', 'M40 188h5v7h-5z'],
    ['', 'M39 196h7l1 6H37z']
  ]
};
const CENTER = {
  front: [
    ['', 'M50 4c5 0 9 5 9 11s-4 11-9 11-9-5-9-11 4-11 9-11z'],
    ['', 'M45 24h10v9H45z'],
    ['Abdos', 'M43 59h14c1 11 1 25 0 36-3 4-11 4-14 0-1-11-1-25 0-36z'],
    ['', 'M38 99c6 2 18 2 24 0l1 7c-5 4-9 7-13 8-4-1-8-4-13-8z']
  ],
  back: [
    ['', 'M50 4c5 0 9 5 9 11s-4 11-9 11-9-5-9-11 4-11 9-11z'],
    ['Dos', 'M44 26h12l8 10-8 8-6 12-6-12-8-8z'],
    ['Dos', 'M44 86h12l3 13H41z']
  ]
};
const MIRROR = 'matrix(-1 0 0 1 100 0)';
// Les sauts travaillent surtout les jambes : affichées ainsi quand l'exercice n'a pas de muscles notés
const LEGS = { p:['Quadriceps', 'Fessiers', 'Mollets'], s:[] };
export function musclesForMap(e){ const m = e.muscles || {}; return (m.p || []).length || (m.s || []).length ? m : e.kind === 'plyo' ? LEGS : null; }
function figure(side, m, dx, label){
  const cls = n => !n ? '' : (m.p || []).indexOf(n) >= 0 ? ' class="p"' : (m.s || []).indexOf(n) >= 0 ? ' class="s"' : '';
  let h = '<g transform="translate(' + dx + ' 0)">';
  CENTER[side].forEach(([n, d]) => { h += '<path' + cls(n) + ' d="' + d + '"/>'; });
  LEFT[side].forEach(([n, d]) => { h += '<path' + cls(n) + ' d="' + d + '"/><path' + cls(n) + ' transform="' + MIRROR + '" d="' + d + '"/>'; });
  return h + '<text x="50" y="214">' + label + '</text></g>';
}
// Silhouette sur toute la largeur, puis les noms des muscles en deux lignes (« Voir le mouvement », fiche). muscles : { p: [...], s: [...] }
export function bodyMap(m){
  const p = (m.p || []).join(', '), s = (m.s || []).join(', ');
  const aria = 'Muscles travaillés : ' + (p || 'aucun') + (s ? ' ; secondaires : ' + s : '');
  return '<svg class="bodymap big" viewBox="0 0 220 220" role="img" aria-label="' + esc(aria) + '">' + figure('front', m, 0, 'De face') + figure('back', m, 120, 'De dos') + '</svg>'
    + '<div class="legend big"><p><i class="lg-p"></i>Principaux : ' + esc(p || '—') + '</p>' + (s ? '<p><i class="lg-s"></i>Secondaires : ' + esc(s) + '</p>' : '') + '</div>';
}
