// Mesures usuelles (cuillères, mL) : de quelques familles d'aliments seulement, avec un poids documenté. Calculs seuls, sans affichage.
// Le journal garde toujours des grammes (entrée { g }) : une mesure n'est qu'une façon de saisir, convertie à l'enregistrement.
// Une famille se reconnaît au début du nom (sans accents) ET à des calories pour 100 g plausibles (« Miel Pops » n'est pas du miel).
// Sources : USDA FoodData Central, SR Legacy (poids d'une portion, relevés le 10/11/2026) : confiture 1 c. à soupe = 20 g (169641),
// miel 21 g (169640), sucre cristallisé 1 c. à café = 4,2 g (169655), beurre de cacahuète 2 c. à soupe = 32 g (172470),
// pâte à tartiner chocolat-noisette 2 c. à soupe = 37 g (168000). Le sucre en c. à soupe vient de 1 tasse = 200 g (÷ 16).
// Une c. à café vaut un tiers de c. à soupe. Huile et lait : volume (c. à soupe 15 mL, c. à café 5 mL) × densité (huile 0,92 g/mL ;
// lait 1,03 g/mL), propriétés physiques courantes, non relevées dans une base. Cuillère rase : une cuillère bombée pèse davantage.
import { norm } from './util.js';

const cc = (g, hint) => ({ id: 'cc', label: 'c. à café', g, start: 1, quick: [1, 2, 3], hint });
const cs = (g, hint) => ({ id: 'cs', label: 'c. à soupe', g, start: 1, quick: [1, 2, 3], hint });
const r1 = x => Math.round(x * 10) / 10;
// Pour un aliment dont on connaît la c. à soupe : la c. à café en est le tiers
const spoons = (tbsp, hint) => [cc(r1(tbsp / 3), hint), cs(tbsp, hint)];

export const FAMILIES = [
  { id: 'jam', re: /^(confiture|marmelade)/, kcal: [140, 290], units: spoons(20, 'USDA : 1 c. à soupe ≈ 20 g') },
  { id: 'honey', re: /^miel\b/, kcal: [290, 350], units: spoons(21, 'USDA : 1 c. à soupe ≈ 21 g') },
  { id: 'sugar', re: /^sucre\b(?! glace)/, kcal: [380, 405], units: [cc(4.2, 'USDA : 1 c. à café ≈ 4,2 g'), cs(12.5, 'USDA : 1 tasse = 200 g, donc 1 c. à soupe ≈ 12,5 g')] },
  { id: 'peanut', re: /^(beurre|puree|creme) (de cacahuete|d arachide)/, kcal: [560, 680], units: spoons(16, 'USDA : 1 c. à soupe ≈ 16 g') },
  { id: 'spread', re: /^(pate a tartiner|nutella)/, kcal: [500, 580], units: spoons(18.5, 'USDA : 1 c. à soupe ≈ 18,5 g') },
  { id: 'oil', re: /^huile\b/, kcal: [800, 900], units: [cc(4.6, '5 mL × 0,92 g/mL'), cs(13.8, '15 mL × 0,92 g/mL')] },
  { id: 'milk', re: /^lait (entier|demi ecreme|ecreme)/, kcal: [30, 70], units: [{ id: 'ml', label: 'mL', g: 1.03, start: 200, quick: [100, 200, 250], hint: 'densité du lait ≈ 1,03 g/mL' }] }
];

// Mesures proposées pour un aliment (famille et unités), ou null : alors seule la saisie en grammes est possible
export function measuresFor(f){
  if (!f || !f.per100 || f.per100.kcal == null) return null;
  const n = norm(f.name);
  return FAMILIES.find(x => x.re.test(n) && f.per100.kcal >= x.kcal[0] && f.per100.kcal <= x.kcal[1]) || null;
}
// Grammes pour n mesures (arrondis au dixième) ; null si le nombre est vide ou pas positif
export const gramsOf = (unit, n) => n > 0 ? r1(unit.g * n) : null;
