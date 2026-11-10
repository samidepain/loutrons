// Mesures usuelles : familles reconnues au nom et aux calories, grammes arrondis, rien d'inventé pour les autres aliments.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FAMILIES, gramsOf, measuresFor } from '../js/measures.js';
import { scale, totals } from '../js/food.js';

const aliment = (name, kcal) => ({ name, per100: { kcal, p: 1, c: 1, s: 1, f: 1, sf: 1, fib: 1, salt: 1 } });
const unite = (f, id) => measuresFor(f).units.find(u => u.id === id);

test('confiture, miel, sucre, huile, lait : mesures proposées d’après le nom et les calories', () => {
  assert.equal(measuresFor(aliment('Confiture de fraise (extra ou classique)', 248)).id, 'jam');
  assert.equal(measuresFor(aliment('Miel', 331)).id, 'honey');
  assert.equal(measuresFor(aliment('Sucre blanc', 399)).id, 'sugar');
  assert.equal(measuresFor(aliment('Huile d’olive vierge extra', 899)).id, 'oil');
  assert.equal(measuresFor(aliment('Lait demi-écrémé, UHT', 47.7)).id, 'milk');
  assert.equal(measuresFor(aliment('Pâte à tartiner chocolat et noisette', 549)).id, 'spread');
  assert.equal(measuresFor(aliment('Beurre de cacahuète ou pâte d’arachide', 643)).id, 'peanut');
});

test('pas de mesure pour un aliment qui n’est pas de la famille, même au nom proche', () => {
  assert.equal(measuresFor(aliment('Miel Pops', 380)), null);                // céréales : calories d’un autre produit
  assert.equal(measuresFor(aliment('Confiture de lait', 340)), null);        // plus dense que la confiture
  assert.equal(measuresFor(aliment('Sucre glace', 398)), null);              // une cuillère de sucre glace pèse bien moins
  assert.equal(measuresFor(aliment('Farine de blé', 350)), null);
  assert.equal(measuresFor(aliment('Poulet rôti', 200)), null);
  assert.equal(measuresFor(aliment('Confiture', null)), null);               // calories inconnues : rien à comparer
  assert.equal(measuresFor(null), null);
});

test('chaque famille a des unités avec un poids positif, la c. à café valant environ le tiers de la c. à soupe', () => {
  FAMILIES.forEach(f => {
    assert.ok(f.units.length > 0 && f.units.every(u => u.g > 0 && u.hint && u.quick.length), f.id);
    const cc = f.units.find(u => u.id === 'cc'); const cs = f.units.find(u => u.id === 'cs');
    if (cc && cs) assert.ok(Math.abs(cs.g / cc.g - 3) < 0.2, f.id);
  });
});

test('grammes d’une mesure : arrondis au dixième, vide ou nul refusé', () => {
  const miel = aliment('Miel', 331);
  assert.equal(gramsOf(unite(miel, 'cs'), 1), 21);
  assert.equal(gramsOf(unite(miel, 'cs'), 1.5), 31.5);
  assert.equal(gramsOf(unite(miel, 'cc'), 2), 14);
  assert.equal(gramsOf(unite(miel, 'cs'), 0), null);
  assert.equal(gramsOf(unite(miel, 'cs'), null), null);
  assert.equal(gramsOf(unite(aliment('Lait entier, UHT', 64.6), 'ml'), 200), 206);
});

test('calories d’une mesure : une seule conversion en grammes, sans double comptage', () => {
  const confiture = aliment('Confiture de fraise (extra ou classique)', 248);
  const g = gramsOf(unite(confiture, 'cs'), 2);                               // 2 c. à soupe = 40 g
  assert.equal(g, 40);
  assert.equal(Math.round(scale(confiture.per100, g).kcal), 99);              // 248 × 40 / 100 = 99,2
  assert.equal(totals([{ per100: confiture.per100, g }]).kcal, scale(confiture.per100, 40).kcal);
});
