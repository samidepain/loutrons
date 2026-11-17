// Social : ce qu'une séance partagée peut montrer (sans affichage). Rien n'est envoyé à un serveur : la carte part par le menu de partage
// du téléphone, seulement quand la personne le demande. Amis, fil d'actualité et classements demandent un serveur, pas encore choisi.
import { fmtDateLong, fmtInt, num } from './util.js';
import { itemsOf, validSets, wName } from './data.js';

// Volume soulevé : somme charge × reps des séries validées des exercices à la charge. Le poids du corps n'est pas compté (il n'est pas
// noté par série) : null si la séance n'a aucune série à la charge. C'est une quantité de travail, pas une note de la séance.
// shortcut: un exercice unilatéral compte ses reps une fois (par côté), à revoir si le volume sert un jour à comparer des personnes
export function sessionVolume(w){
  let v = 0, n = 0;
  itemsOf(w).forEach(it => { if (it.kind === 'load') validSets(((w.ex || {})[it.ex] || {}).sets).forEach(s => { if (num(s.kg) > 0) { v += num(s.kg) * num(s.reps); n++; } }); });
  return n ? Math.round(v) : null;
}
// Statistiques qu'on peut choisir de montrer : [clé, valeur, unité, libellé], seulement celles que la séance a vraiment
export function shareStats(w, records){
  const st = it => (w.ex || {})[it.ex] || {}; const done = itemsOf(w).filter(it => st(it).done || (st(it).sets || []).some(s => s.done));
  const sets = done.reduce((n, it) => n + (it.kind === 'cardio' || it.kind === 'check' ? 0 : st(it).sets.filter(s => s.done).length), 0);
  const vol = sessionVolume(w);
  return [
    num(w.duration) > 0 && ['dur', String(w.duration), 'min', 'durée'],
    done.length > 0 && ['ex', String(done.length), '', done.length > 1 ? 'exercices' : 'exercice'],
    sets > 0 && ['sets', String(sets), '', sets > 1 ? 'séries' : 'série'],
    vol && ['vol', fmtInt(vol), 'kg', 'soulevés'],
    records > 0 && ['pr', String(records), '', records > 1 ? 'records' : 'record']
  ].filter(Boolean);
}
// Texte qui accompagne l'image (ou la remplace quand l'appareil ne sait pas partager un fichier)
export function shareText(w, stats, msg){
  return [String(msg || '').trim(), wName(w) + ' · ' + fmtDateLong(w.date), stats.map(s => s[1] + (s[2] ? ' ' + s[2] : '') + ' ' + s[3]).join(' · '), 'Séance notée avec Loutrons'].filter(Boolean).join('\n');
}
