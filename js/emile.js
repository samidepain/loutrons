// Émile, le coach des Loutrons : une loutre tirée du logo qui signe les conseils de l'appli.
// Il appelle la personne « loutron » ou « loutronne », ou par son prénom si elle n'a pas répondu.
import { capFirst, esc, lowFirst } from './util.js';
import { settings } from './data.js';

export function callName(){ const s = settings(); return s.sex === 'm' ? 'loutron' : s.sex === 'f' ? 'loutronne' : String(s.name || '').trim(); }
// « Loutron, ta dernière sauvegarde… » : la phrase adressée à la personne
export function hey(text){ const c = callName(); return c ? capFirst(c) + ', ' + lowFirst(text) : text; }
// Conseils fermés avec la croix (settings.dismissed : clé → date). La clé décrit la situation (semaine, séance, jour…) :
// un conseil fermé ne revient que quand la situation change.
export const isDismissed = key => !!(settings().dismissed || {})[key];
const CROSS = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';
// Bulle d'Émile. body : HTML déjà échappé. opts : { title, tone: 'warn' | 'bad' | 'good', id, hidden,
// key : clé du conseil (croix qui le ferme), close : action de la croix à la place (ex. 'close-summary') }
export function emile(body, opts){
  const o = opts || {};
  if (o.key && isDismissed(o.key)) return '';
  const x = o.close || o.key ? '<button type="button" class="emile-x" data-act="' + (o.close || 'emile-x') + '"' + (o.key && !o.close ? ' data-v="' + esc(o.key) + '"' : '') + ' aria-label="Fermer le conseil d’Émile">' + CROSS + '</button>' : '';
  return '<div class="emile' + (o.tone ? ' ' + o.tone : '') + '"' + (o.id ? ' id="' + o.id + '"' : '') + (o.hidden ? ' hidden' : '') + '><img src="icons/emile.png" alt="" width="44" height="44"><div class="bubble">'
    + '<div class="row between"><span class="who">Émile</span>' + x + '</div>'
    + (o.title ? '<h3>' + esc(o.title) + '</h3>' : '') + body + '</div></div>';
}
// File des conseils du jour : on retire ceux qui sont fermés (texte vide), on garde le plus petit rang d'abord
// (ordre de la liste à rang égal) ; le premier s'affiche, les autres derrière « N autres conseils »
export function emileQueue(items){
  const q = items.filter(x => x.html).sort((a, b) => a.rank - b.rank).map(x => x.html);
  return { first: q[0] || '', rest: q.slice(1) };
}
