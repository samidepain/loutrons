// Recettes faites maison : ingrédients Ciqual existants, valeurs plausibles, calcul des recettes créées, recherche.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fromCiqual, scale, searchFoods } from '../js/food.js';
import { mixPer100, ownRecipe, RECIPES, recipeFoods } from '../js/recipes.js';
import { norm } from '../js/util.js';

const ciq = JSON.parse(readFileSync(new URL('../data/ciqual.json', import.meta.url), 'utf8')).foods.map(r => Object.assign(fromCiqual(r), { n: norm(r[1]) }));
const recs = recipeFoods(ciq);

test('chaque recette classique : ingrédients présents dans la table Ciqual, valeurs plausibles pour une portion', () => {
  assert.equal(recs.length, RECIPES.length);
  assert.equal(new Set(RECIPES.map(r => r.id)).size, RECIPES.length);
  recs.forEach(f => {
    const v = scale(f.per100, f.serving);
    assert.ok(f.per100.kcal >= 30 && f.per100.kcal <= 400, f.name + ' : ' + f.per100.kcal + ' kcal/100 g');
    assert.ok(v.kcal >= 100 && v.kcal <= 1200, f.name + ' : ' + Math.round(v.kcal) + ' kcal la portion');
    assert.ok(v.p != null && v.c != null && v.f != null, f.name + ' : macros inconnues');
  });
});

test('mélange : une valeur inconnue compte pour 0 sous 10 % du poids, sinon elle est inconnue', () => {
  const a = { kcal: 100, p: 10, c: null }, b = { kcal: 0, p: 0, c: 5 };
  assert.deepEqual([mixPer100([{ per100: a, g: 95 }, { per100: b, g: 5 }]).p, mixPer100([{ per100: a, g: 95 }, { per100: b, g: 5 }]).c], [9.5, null]);
  assert.equal(mixPer100([{ per100: b, g: 95 }, { per100: a, g: 5 }]).c, 4.75);
});

test('recette créée : valeurs pour 100 g de plat cuit si on le pèse, portion = plat / portions', () => {
  const pates = { kcal: 350, p: 12, c: 70, s: 3, f: 2, sf: 0.4, fib: 3, salt: 0 };
  const r = ownRecipe([{ g: 500, per100: pates }], 4, 1250);
  assert.equal(r.per100.kcal, 140);
  assert.equal(r.serving, 313);
  assert.equal(ownRecipe([{ g: 500, per100: pates }], 4).serving, 125);
});

test('recherche : la recette maison avant le plat industriel, autres noms reconnus', () => {
  assert.equal(searchFoods([[], recs, ciq], 'pâtes bolognaise')[0].key, 'rec:bolognaise');
  assert.equal(searchFoods([[], recs, ciq], 'bolo')[0].key, 'rec:bolognaise');
  assert.equal(searchFoods([[], recs, ciq], 'carbonara')[0].key, 'rec:carbonara');
  assert.equal(searchFoods([[], recs, ciq], 'boeuf bourguignon')[0].key, 'rec:bourguignon');
  assert.ok(searchFoods([[], recs, ciq], 'bourguignon').some(f => f.src === 'ciq'));
});
