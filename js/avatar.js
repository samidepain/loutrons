// Avatar de la personne : Émile en couches superposées (sans affichage). Toutes les illustrations partagent la même toile carrée
// (CANVAS px de côté, fond transparent, personnage dessiné au même endroit) : les superposer suffit, sans point d'ancrage par élément.
// Les calques sont découpés d'images générées (voir .claude/tools/decoupe-avatars.js, hors dépôt) : la loutre de base porte déjà son visage
// souriant, et chaque autre élément est ce qui diffère de cette base. Sans illustration (ITEMS vide), la personnalisation n'apparaît pas.
export const CANVAS = 1024;
// Catégories de l'éditeur, une seule affichée à la fois
export const CATS = [['skin', 'Loutre'], ['face', 'Visage'], ['head', 'Tête'], ['acc', 'Accessoires'], ['outfit', 'Tenue']];
// Couches, du fond vers le dessus. need : couche obligatoire (son premier élément sert par défaut) ; zoom : vignette cadrée sur la tête ;
// none : nom du choix vide (« Aucun » sinon)
export const SLOTS = [
  { id:'body', name:'Loutre', cat:'skin', need:true },
  { id:'shoes', name:'Chaussures', cat:'outfit' },
  { id:'bottom', name:'Bas', cat:'outfit' },
  { id:'top', name:'Haut', cat:'outfit' },
  { id:'gear', name:'Équipement', cat:'acc' },
  { id:'face', name:'Expression', cat:'face', none:'Heureux', zoom:true },
  { id:'hair', name:'Coiffure', cat:'head', zoom:true },
  { id:'eyes', name:'Lunettes', cat:'acc', zoom:true },
  { id:'hat', name:'Couvre-chef', cat:'head', zoom:true },
  { id:'ears', name:'Casque audio', cat:'acc', zoom:true }
];
// Catalogue : { id (unique, ne change plus : les avatars enregistrés s'y rattachent), slot, name }. Image : avatars/<slot>/<id>.webp,
// ou « file ». Ajouter un élément : son image, une ligne ici, et son chemin dans FILES de sw.js (npm test le vérifie).
// unlock (facultatif) : { level: n } débloque l'élément à ce niveau (js/levels.js) ; une autre condition (objectif, saison) reste fermée tant que sa règle n'est pas écrite.
// solo : loutre complète redessinée avec sa tenue (un « skin ») ; les calques, découpés sur la loutre de base, ne s'y posent pas.
export const ITEMS = [
  { id:'emile', slot:'body', name:'Émile' },
  { id:'emile-tenue-noire', slot:'body', name:'Tenue noire', solo:true, unlock:{ level:3 } },
  { id:'rieur', slot:'face', name:'Rieur' },
  { id:'clin', slot:'face', name:'Clin d’œil' },
  { id:'determine', slot:'face', name:'Déterminé' },
  { id:'surpris', slot:'face', name:'Surpris' },
  { id:'bandeau', slot:'hat', name:'Bandeau' },
  { id:'casquette', slot:'hat', name:'Casquette' },
  { id:'bonnet', slot:'hat', name:'Bonnet', unlock:{ level:4 } },
  { id:'lunettes-soleil', slot:'eyes', name:'Lunettes de soleil', unlock:{ level:2 } },
  { id:'sweat-noir', slot:'top', name:'Sweat noir', unlock:{ level:5 } }
];
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
// Éléments à dessiner, du fond vers le dessus ; un skin complet (solo) se dessine seul
export function layersOf(cfg, items = ITEMS, level = 0){
  const c = avatarOf(cfg, items, level); const body = items.find(it => it.id === c.body);
  if (body && body.solo) return [body];
  return SLOTS.filter(s => c[s.id]).map(s => items.find(it => it.id === c[s.id]));
}
