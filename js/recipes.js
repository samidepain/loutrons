// Recettes faites maison : classiques (une assiette type) et recettes créées par la personne. Calculs seuls, sans affichage.
// Les valeurs viennent des ingrédients de la table Ciqual, en grammes tels que mangés (cuits) ; pour une semoule crue,
// l'eau absorbée à la cuisson est un ingrédient. C'est une recette type : la tienne peut différer.
import { norm } from './util.js';

// items : [code Ciqual, grammes pour une portion, nom court]
export const RECIPES = [
  { id:'bolognaise', name:'Pâtes à la bolognaise', aka:['spaghetti bolognaise', 'bolo', 'tagliatelles bolognaise'], items:[[9811, 250, 'pâtes cuites'], [6255, 80, 'bœuf haché 15 % cuit'], [20260, 100, 'coulis de tomate'], [20035, 25, 'oignon cuit'], [20353, 20, 'carotte cuite'], [17270, 8, 'huile d’olive'], [12120, 8, 'parmesan']] },
  { id:'carbonara', name:'Pâtes à la carbonara', aka:['spaghetti carbonara', 'carbo'], items:[[9811, 250, 'pâtes cuites'], [28504, 50, 'lardons cuits'], [19417, 40, 'crème fraîche 30 %'], [22002, 18, 'jaune d’œuf'], [12120, 12, 'parmesan']] },
  { id:'pesto', name:'Pâtes au pesto', aka:['spaghetti pesto'], items:[[9811, 250, 'pâtes cuites'], [11179, 30, 'sauce pesto'], [12120, 8, 'parmesan']] },
  { id:'saumoncreme', name:'Pâtes au saumon et à la crème', aka:['pâtes saumon', 'tagliatelles saumon'], items:[[9811, 250, 'pâtes cuites'], [26038, 80, 'saumon cuit'], [19436, 50, 'crème légère'], [20255, 10, 'échalote cuite'], [17270, 5, 'huile d’olive']] },
  { id:'saladepates', name:'Salade de pâtes au thon', aka:['salade pâtes thon'], items:[[9811, 180, 'pâtes cuites'], [26039, 70, 'thon au naturel'], [20276, 80, 'tomate'], [20066, 40, 'maïs'], [11108, 20, 'vinaigrette']] },
  { id:'lasagnes', name:'Lasagnes à la bolognaise', aka:['lasagne'], items:[[9811, 120, 'feuilles de lasagne cuites'], [6255, 80, 'bœuf haché 15 % cuit'], [20260, 80, 'coulis de tomate'], [20035, 15, 'oignon cuit'], [11143, 100, 'béchamel maison'], [12118, 20, 'emmental râpé'], [17270, 5, 'huile d’olive']] },
  { id:'bourguignon', name:'Bœuf bourguignon', aka:['boeuf bourguignon'], items:[[6230, 200, 'bœuf cuit'], [11164, 80, 'sauce au vin rouge'], [20353, 60, 'carottes cuites'], [20102, 40, 'champignons'], [20035, 30, 'oignon cuit'], [28725, 20, 'lardons fumés cuits']] },
  { id:'blanquette', name:'Blanquette de veau', aka:['blanquette'], items:[[6563, 180, 'veau braisé'], [20353, 60, 'carottes cuites'], [20102, 40, 'champignons'], [20035, 20, 'oignon cuit'], [25909, 60, 'bouillon'], [19415, 30, 'crème 30 %'], [16400, 8, 'beurre'], [9435, 8, 'farine'], [22002, 10, 'jaune d’œuf']] },
  { id:'potaufeu', name:'Pot-au-feu', aka:['pot au feu'], items:[[6230, 180, 'bœuf cuit'], [20353, 80, 'carottes cuites'], [20327, 60, 'poireau cuit'], [20033, 60, 'navet cuit'], [4003, 120, 'pommes de terre'], [25909, 100, 'bouillon']] },
  { id:'hachis', name:'Hachis parmentier', aka:['parmentier'], items:[[6255, 120, 'bœuf haché 15 % cuit'], [20035, 20, 'oignon cuit'], [4003, 200, 'pommes de terre'], [19041, 40, 'lait demi-écrémé'], [16400, 10, 'beurre'], [12118, 20, 'emmental râpé']] },
  { id:'chili', name:'Chili con carne et riz', aka:['chili', 'chili con carne'], items:[[6255, 100, 'bœuf haché 15 % cuit'], [20503, 80, 'haricots rouges'], [20137, 100, 'tomates pelées'], [20035, 20, 'oignon cuit'], [20088, 30, 'poivron rouge cuit'], [17270, 5, 'huile d’olive'], [9104, 150, 'riz blanc cuit']] },
  { id:'couscous', name:'Couscous poulet et merguez', aka:['couscous royal', 'couscous'], items:[[9610, 70, 'semoule (crue)'], [18066, 90, 'eau absorbée'], [36006, 100, 'poulet rôti'], [30151, 50, 'merguez'], [20353, 50, 'carottes cuites'], [20021, 60, 'courgette cuite'], [20033, 40, 'navet cuit'], [20507, 40, 'pois chiches'], [17270, 8, 'huile d’olive'], [25909, 100, 'bouillon']] },
  { id:'currycoco', name:'Poulet curry coco et riz', aka:['curry de poulet', 'poulet curry'], items:[[36018, 130, 'poulet grillé'], [18041, 60, 'lait de coco'], [20035, 25, 'oignon cuit'], [11005, 2, 'curry'], [17270, 5, 'huile d’olive'], [9104, 150, 'riz blanc cuit']] },
  { id:'basquaise', name:'Poulet basquaise et riz', aka:['poulet basquaise'], items:[[36006, 150, 'poulet rôti'], [20088, 40, 'poivron rouge cuit'], [20086, 30, 'poivron vert cuit'], [20137, 80, 'tomates pelées'], [20035, 25, 'oignon cuit'], [17270, 8, 'huile d’olive'], [9104, 150, 'riz blanc cuit']] },
  { id:'pouletpdt', name:'Poulet rôti et pommes de terre', aka:['poulet frites', 'poulet rôti'], items:[[36005, 150, 'poulet rôti avec la peau'], [4026, 200, 'pommes de terre rôties'], [17270, 5, 'huile d’olive']] },
  { id:'pouletriz', name:'Poulet, riz et brocolis', aka:['poulet riz', 'riz poulet brocoli'], items:[[36018, 150, 'poulet grillé'], [9104, 180, 'riz blanc cuit'], [20304, 150, 'brocolis vapeur'], [17270, 5, 'huile d’olive']] },
  { id:'saumonriz', name:'Saumon, riz et brocolis', aka:['saumon riz'], items:[[26230, 130, 'saumon au four'], [9104, 150, 'riz blanc cuit'], [20304, 150, 'brocolis vapeur'], [17270, 5, 'huile d’olive']] },
  { id:'paella', name:'Paella', aka:['paëlla'], items:[[9104, 200, 'riz cuit'], [36006, 60, 'poulet rôti'], [10007, 50, 'crevettes'], [10013, 40, 'moules'], [30315, 15, 'chorizo'], [20037, 30, 'petits pois'], [20088, 30, 'poivron rouge cuit'], [17270, 10, 'huile d’olive']] },
  { id:'cantonais', name:'Riz cantonais maison', aka:['riz cantonais', 'riz sauté'], items:[[9104, 200, 'riz blanc cuit'], [22000, 40, 'œuf'], [28910, 40, 'jambon cuit'], [20037, 40, 'petits pois'], [17440, 8, 'huile']] },
  { id:'risotto', name:'Risotto aux champignons', aka:['risotto'], items:[[9104, 220, 'riz cuit'], [20102, 60, 'champignons'], [20035, 20, 'oignon cuit'], [12120, 15, 'parmesan'], [16400, 10, 'beurre']] },
  { id:'steakfrites', name:'Steak haché et frites', aka:['steak frites'], items:[[6255, 120, 'steak haché 15 % cuit'], [4030, 180, 'frites au four']] },
  { id:'burger', name:'Burger maison', aka:['hamburger', 'cheeseburger'], items:[[7259, 80, 'pain burger'], [6255, 110, 'steak haché 15 % cuit'], [12726, 20, 'cheddar'], [20031, 15, 'salade'], [20276, 30, 'tomate'], [20034, 10, 'oignon'], [11054, 10, 'mayonnaise']] },
  { id:'lentilles', name:'Lentilles et saucisse', aka:['petit salé aux lentilles', 'saucisse lentilles'], items:[[20587, 200, 'lentilles cuites'], [30011, 100, 'saucisse de Toulouse cuite'], [20353, 40, 'carottes cuites'], [20035, 20, 'oignon cuit']] },
  { id:'gratin', name:'Gratin dauphinois', aka:['gratin de pommes de terre'], items:[[4003, 200, 'pommes de terre'], [19415, 40, 'crème 30 %'], [19023, 40, 'lait entier'], [16400, 5, 'beurre']] },
  { id:'tartiflette', name:'Tartiflette', aka:[], items:[[4003, 220, 'pommes de terre'], [12045, 60, 'reblochon'], [28725, 40, 'lardons fumés cuits'], [20035, 25, 'oignon cuit'], [19415, 20, 'crème 30 %']] },
  { id:'puree', name:'Purée maison', aka:['purée de pommes de terre'], items:[[4003, 200, 'pommes de terre'], [19041, 50, 'lait demi-écrémé'], [16400, 10, 'beurre']] },
  { id:'ratatouille', name:'Ratatouille', aka:[], items:[[20021, 100, 'courgette cuite'], [20002, 80, 'aubergine cuite'], [20088, 40, 'poivron rouge cuit'], [20137, 80, 'tomates pelées'], [20035, 30, 'oignon cuit'], [17270, 10, 'huile d’olive']] },
  { id:'soupe', name:'Soupe de légumes maison', aka:['velouté de légumes', 'potage'], items:[[20353, 80, 'carottes cuites'], [20327, 60, 'poireau cuit'], [4003, 80, 'pommes de terre'], [20035, 20, 'oignon cuit'], [25909, 100, 'bouillon'], [17270, 5, 'huile d’olive']] },
  { id:'nicoise', name:'Salade niçoise', aka:['salade nicoise'], items:[[26039, 60, 'thon au naturel'], [22010, 50, 'œuf dur'], [20276, 100, 'tomate'], [20030, 60, 'haricots verts'], [4003, 80, 'pommes de terre'], [13032, 15, 'olives noires'], [11108, 20, 'vinaigrette'], [20031, 30, 'salade']] },
  { id:'taboule', name:'Taboulé maison', aka:['taboulé'], items:[[9610, 50, 'semoule (crue)'], [18066, 60, 'eau absorbée'], [20276, 60, 'tomate'], [20019, 50, 'concombre'], [11014, 10, 'persil'], [17270, 10, 'huile d’olive'], [2028, 10, 'jus de citron']] },
  { id:'quiche', name:'Quiche lorraine', aka:['quiche'], portion:'1 part', items:[[23399, 50, 'pâte brisée cuite'], [22000, 50, 'œuf'], [19415, 40, 'crème 30 %'], [19023, 30, 'lait entier'], [28725, 30, 'lardons fumés cuits']] },
  { id:'croque', name:'Croque-monsieur maison', aka:['croque monsieur'], portion:'1 croque', items:[[7200, 60, 'pain de mie'], [28910, 30, 'jambon cuit'], [12115, 25, 'emmental'], [16400, 8, 'beurre']] },
  { id:'crepes', name:'Crêpes maison', aka:['crêpe'], portion:'2 crêpes', items:[[9435, 31, 'farine'], [19041, 62, 'lait demi-écrémé'], [22000, 25, 'œuf'], [16400, 4, 'beurre'], [31016, 4, 'sucre']] },
  { id:'pancakes', name:'Pancakes maison', aka:['pancake'], portion:'3 pancakes', items:[[9435, 60, 'farine'], [19041, 70, 'lait demi-écrémé'], [22000, 25, 'œuf'], [31016, 8, 'sucre'], [16400, 6, 'beurre']] },
  { id:'porridge', name:'Porridge au lait et à la banane', aka:['porridge', 'flocons d’avoine au lait'], portion:'1 bol', items:[[32140, 50, 'flocons d’avoine'], [19041, 250, 'lait demi-écrémé'], [13005, 60, 'banane']] },
  { id:'omeletteplat', name:'Omelette au jambon et au fromage', aka:['omelette jambon fromage'], items:[[22000, 150, 'œufs (3)'], [28910, 40, 'jambon cuit'], [12118, 20, 'emmental râpé'], [16400, 5, 'beurre']] }
];
const KEYS = ['kcal', 'p', 'c', 's', 'f', 'sf', 'fib', 'salt'];
// Valeurs pour 100 g d'un mélange [{ per100, g }]. Un ingrédient dont une valeur est inconnue compte pour 0 s'il pèse
// moins de 10 % du total ; sinon cette valeur du mélange est inconnue. weight : poids du plat cuit, s'il est connu.
export function mixPer100(items, weight){
  const total = items.reduce((t, i) => t + i.g, 0); const w = weight > 0 ? weight : total; const o = {};
  KEYS.forEach(k => {
    let sum = 0, unknown = 0;
    items.forEach(i => { const v = i.per100 && i.per100[k]; if (v == null) unknown += i.g; else sum += v * i.g / 100; });
    o[k] = !total || unknown > total * 0.1 ? null : Math.round(sum / w * 100 * 100) / 100;
  });
  return o;
}
// Recettes classiques prêtes pour la recherche, à partir de la table Ciqual chargée (liste de fromCiqual)
export function recipeFoods(ciq){
  const byCode = new Map(ciq.map(f => [Number(f.key.slice(4)), f]));
  return RECIPES.map(r => {
    const items = r.items.map(([code, g, label]) => ({ code, g, label, per100: (byCode.get(code) || {}).per100 }));
    if (items.some(i => !i.per100)) return null; // table incomplète : la recette n'est pas proposée
    const g = items.reduce((t, i) => t + i.g, 0);
    return { key:'rec:' + r.id, src:'rec', name:r.name, brand:'', n:norm(r.name), alt:norm(r.aka.join(' ')), per100:mixPer100(items), serving:g, portion:r.portion || '1 assiette', items:items.map(i => [i.label, i.g]) };
  }).filter(Boolean);
}
// Recette créée par la personne : portions et poids du plat cuit (facultatif) ; renvoie per100 et la portion en grammes
export function ownRecipe(items, servings, cooked){
  const total = items.reduce((t, i) => t + (i.g || 0), 0); const w = cooked > 0 ? cooked : total; const n = servings > 0 ? servings : 1;
  return { per100: mixPer100(items.filter(i => i.g > 0), w), serving: Math.round(w / n), total };
}
