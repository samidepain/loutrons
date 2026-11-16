// Avatar : dessin par couches superposées, et éditeur (fenêtre S.avatar : { cfg, cat, hist }) ouvert depuis le profil.
import { esc } from '../util.js';
import { S } from '../store.js';
import { avatarOf, CATS, fileOf, ITEMS, layersOf, SLOTS, unlocked } from '../avatar.js';
import { xpState } from '../levels.js';

// Les couches empilées dans un carré ; cls « head » cadre la tête (rond du profil, vignettes)
export function avatarImg(cfg, cls){
  return '<span class="av' + (cls ? ' ' + cls : '') + '" aria-hidden="true"><span class="av-in">' + layersOf(cfg, ITEMS, xpState().level).map(it => '<img src="' + esc(fileOf(it)) + '" alt="" draggable="false">').join('') + '</span></span>';
}
// Une couche se choisit s'il y a de quoi choisir : au moins un élément, ou deux pour une couche obligatoire
const choosable = s => ITEMS.filter(it => it.slot === s.id).length > (s.need ? 1 : 0);
export function viewAvatar(){
  const E = S.avatar; const lvl = xpState().level; const cfg = avatarOf(E.cfg, ITEMS, lvl);
  const cats = CATS.filter(c => SLOTS.some(s => s.cat === c[0] && choosable(s))); const cat = cats.some(c => c[0] === E.cat) ? E.cat : (cats[0] || [])[0];
  let h = '<div class="row between"><h1>Ton avatar</h1><button type="button" class="link" data-act="av-cancel">Annuler</button></div>';
  // Aperçu toujours visible pendant qu'on fait défiler les éléments
  h += '<div class="av-stage">' + avatarImg(cfg, 'big') + '</div>';
  h += '<div class="row"><button type="button" class="btn sm" data-act="av-undo"' + (E.hist.length ? '' : ' disabled') + '>Revenir en arrière</button><button type="button" class="btn sm ghost" data-act="av-reset">Réinitialiser</button></div>';
  h += '<div class="seg" role="tablist">' + cats.map(c => '<button type="button" class="chip' + (cat === c[0] ? ' on' : '') + '" data-act="av-cat" data-v="' + c[0] + '" role="tab" aria-selected="' + (cat === c[0]) + '">' + c[1] + '</button>').join('') + '</div>';
  // Vignette d'un élément : l'avatar en cours qui le porte, cadré sur la tête pour ce qui se porte sur la tête
  const item = (s, id, name) => { const on = (cfg[s.id] || '') === id;
    return '<button type="button" class="av-item' + (on ? ' on' : '') + '" data-act="av-pick" data-s="' + s.id + '" data-v="' + esc(id) + '" role="radio" aria-checked="' + on + '">' + avatarImg(Object.assign({}, cfg, { [s.id]: id }), s.zoom ? 'head' : '') + '<span class="small">' + esc(name) + '</span></button>'; };
  SLOTS.filter(s => s.cat === cat && choosable(s)).forEach(s => {
    // Un élément pas encore débloqué reste visible, grisé, avec le niveau qui l'ouvre
    const locked = it => '<button type="button" class="av-item" disabled>' + avatarImg(Object.assign({}, cfg, { [s.id]: '' }), s.zoom ? 'head' : '') + '<span class="small">' + esc(it.name) + '</span><span class="pill">' + (it.unlock.level != null ? 'Niveau ' + it.unlock.level : 'Bientôt') + '</span></button>';
    h += '<div class="stack"><span class="label">' + s.name + '</span><div class="av-grid" role="radiogroup" aria-label="' + s.name + '">' + (s.need ? '' : item(s, '', 'Aucun')) + ITEMS.filter(it => it.slot === s.id).map(it => unlocked(it, lvl) ? item(s, it.id, it.name) : locked(it)).join('') + '</div></div>';
  });
  return h + '<button type="button" class="btn primary big" data-act="av-save">Enregistrer mon avatar</button>';
}
