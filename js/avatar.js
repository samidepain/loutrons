// Avatar de la personne : Émile en couches superposées (sans affichage). Toutes les illustrations partagent la même toile carrée
// (CANVAS px de côté, fond transparent, personnage dessiné au même endroit) : les superposer suffit, sans point d'ancrage par élément.
// Tant que les illustrations ne sont pas livrées (ITEMS vide), la personnalisation n'apparaît pas dans l'appli.
export const CANVAS = 1024;
// Catégories de l'éditeur, une seule affichée à la fois
export const CATS = [['face', 'Visage'], ['head', 'Tête'], ['acc', 'Accessoires'], ['outfit', 'Tenue']];
// Couches, du fond vers le dessus. need : couche obligatoire (son premier élément sert par défaut) ; zoom : vignette cadrée sur la tête
export const SLOTS = [
  { id:'body', name:'Pelage', cat:'face', need:true },
  { id:'shoes', name:'Chaussures', cat:'outfit' },
  { id:'bottom', name:'Bas', cat:'outfit' },
  { id:'top', name:'Haut', cat:'outfit' },
  { id:'gear', name:'Équipement', cat:'acc' },
  { id:'face', name:'Expression', cat:'face', need:true, zoom:true },
  { id:'hair', name:'Coiffure', cat:'head', zoom:true },
  { id:'eyes', name:'Lunettes', cat:'acc', zoom:true },
  { id:'hat', name:'Couvre-chef', cat:'head', zoom:true },
  { id:'ears', name:'Casque audio', cat:'acc', zoom:true }
];
// Catalogue : { id (unique, ne change plus : les avatars enregistrés s'y rattachent), slot, name }. Image : avatars/<slot>/<id>.webp,
// ou « file ». Ajouter un élément : son image, une ligne ici, et son chemin dans FILES de sw.js (npm test le vérifie).
// unlock (facultatif) : { level: n } débloque l'élément à ce niveau (js/levels.js) ; une autre condition (objectif, saison) reste fermée tant que sa règle n'est pas écrite.
export const ITEMS = [];
export const fileOf = it => it.file || 'avatars/' + it.slot + '/' + it.id + '.webp';
export const unlocked = (it, level = 0) => !it.unlock || (it.unlock.level != null && level >= it.unlock.level);
export const slotItems = (slot, items = ITEMS, level = 0) => items.filter(it => it.slot === slot && unlocked(it, level));
// La personnalisation s'ouvre quand chaque couche obligatoire a au moins une illustration disponible dès le niveau 1
export const avatarReady = (items = ITEMS) => SLOTS.every(s => !s.need || slotItems(s.id, items).length > 0);
// Configuration valide, { couche: identifiant } : un élément inconnu ou verrouillé est retiré, une couche obligatoire reprend son premier élément
export function avatarOf(cfg, items = ITEMS, level = 0){
  const out = {};
  SLOTS.forEach(s => { const l = slotItems(s.id, items, level); const it = l.find(x => x.id === (cfg || {})[s.id]) || (s.need ? l[0] : null); if (it) out[s.id] = it.id; });
  return out;
}
// Éléments à dessiner, du fond vers le dessus
export function layersOf(cfg, items = ITEMS, level = 0){
  const c = avatarOf(cfg, items, level);
  return SLOTS.filter(s => c[s.id]).map(s => items.find(it => it.id === c[s.id]));
}
