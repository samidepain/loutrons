// Journal des repas : lecture d'un produit Open Food Facts, quantités, totaux, aliments récents, recherche, codes-barres et table Ciqual.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { norm } from '../js/util.js';
import { fromCiqual, fromOff, recentFoods, scale, searchFoods, totals, validBarcode } from '../js/food.js';
import { donnees, reglages, docs } from './aide.js';

// Réponse d'Open Food Facts (extrait de /api/v2/product/3017620422003.json)
const nutella = { status: 1, product: { product_name: 'Nutella', product_name_fr: 'Nutella', brands: 'Nutella, Ferrero', serving_quantity: 15,
  nutriments: { 'energy-kcal_100g': 539, proteins_100g: 6.3, carbohydrates_100g: 57.5, sugars_100g: 56.3, fat_100g: 30.9, 'saturated-fat_100g': 10.6, fiber_100g: 0, salt_100g: 0.107 } } };
const presque = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, a + ' au lieu de ' + b);

test('produit Open Food Facts : valeurs pour 100 g, marque, portion', () => {
  const f = fromOff(nutella, '3017620422003');
  assert.equal(f.key, 'off:3017620422003');
  assert.equal(f.name, 'Nutella');
  assert.equal(f.brand, 'Nutella');
  assert.equal(f.serving, 15);
  assert.deepEqual(f.per100, { kcal: 539, p: 6.3, c: 57.5, s: 56.3, f: 30.9, sf: 10.6, fib: 0, salt: 0.107 });
});

test('produit sans calories en kcal : converties depuis les kJ ; produit absent ou sans valeurs : rien', () => {
  const kj = fromOff({ status: 1, product: { product_name: 'Jus', nutriments: { 'energy-kj_100g': 184 } } }, '123');
  assert.equal(kj.per100.kcal, 44);
  assert.equal(kj.per100.p, null);
  assert.equal(fromOff({ status: 0 }, '123'), null);
  assert.equal(fromOff({ status: 1, product: { product_name: 'Mystère', nutriments: {} } }, '123'), null);
  assert.equal(fromOff({ status: 1, product: { nutriments: { 'energy-kcal_100g': 100 } } }, '42').name, 'Produit 42');
});

test('quantité et totaux : une valeur inconnue reste inconnue et est signalée', () => {
  const v = scale(fromOff(nutella, '1').per100, 15);
  presque(v.kcal, 80.85);
  presque(v.p, 0.945);
  const pain = fromCiqual([7001, 'Pain, baguette, courante', 268, 9.06, 54.3, 2.43, 1.24, 0.29, 3.14, 1.2]);
  const t = totals([{ per100: pain.per100, g: 100 }, { per100: { kcal: 50, p: 1, c: 10, s: 9, f: 0, sf: 0, fib: null, salt: null }, g: 200 }]);
  presque(t.kcal, 368);
  presque(t.p, 11.06);
  presque(t.fib, 3.14);
  assert.deepEqual(t.missing.sort(), ['fib', 'salt']);
});

test('aliments récents : du plus récent au plus ancien, sans doublon, avec la dernière quantité', () => {
  const item = (key, name, g) => ({ id: key + g, meal: 'lunch', key, name, g, per100: { kcal: 100 } });
  donnees(docs(reglages(),
    ['m_2026-11-01', { date: '2026-11-01', items: [item('ciq:1', 'Riz', 150), item('ciq:2', 'Poulet', 120)] }],
    ['m_2026-11-02', { date: '2026-11-02', items: [item('ciq:1', 'Riz', 200), item('off:3', 'Skyr', 150)] }]));
  const r = recentFoods();
  assert.deepEqual(r.map(f => f.name), ['Skyr', 'Riz', 'Poulet']);
  assert.equal(r[1].g, 200);
  assert.equal(r[0].src, 'off');
});

test('recherche : accents, majuscules et pluriels ignorés ; tes aliments d’abord', () => {
  const table = [fromCiqual([1, 'Pomme, crue, pulpe et peau', 54, 0.25, 11.6, 9.35, 0.25, 0.05, 2.4, 0]), fromCiqual([2, 'Pâtes sèches, cuites, non salées', 157, 5.6, 30.6, 0.5, 0.9, 0.2, 1.8, 0.01]), fromCiqual([3, 'Compote de pomme', 70, 0.3, 16, 14, 0.2, 0.05, 1.5, 0])];
  const mine = [{ key: 'off:9', src: 'off', name: 'Compote pomme vanille', brand: 'Andros', per100: { kcal: 80 } }];
  assert.deepEqual(searchFoods([[], table], 'PATES').map(f => f.name), ['Pâtes sèches, cuites, non salées']);
  assert.deepEqual(searchFoods([mine, table], 'pommes').map(f => f.key), ['off:9', 'ciq:1', 'ciq:3']);
  assert.deepEqual(searchFoods([mine, table], 'andros').map(f => f.key), ['off:9']);
  assert.deepEqual(searchFoods([mine, table], 'compote pomme').map(f => f.key), ['off:9', 'ciq:3']);
  assert.deepEqual(searchFoods([mine, table], ' '), []);
});

test('codes-barres : EAN-13, EAN-8 et UPC-A avec leur clé de contrôle', () => {
  assert.equal(validBarcode('3017620422003'), true);
  assert.equal(validBarcode('3017620422004'), false);
  assert.equal(validBarcode('96385074'), true);
  assert.equal(validBarcode('036000291452'), true);
  assert.equal(validBarcode('12345'), false);
  assert.equal(validBarcode(''), false);
});

// data/ciqual.json, tirée de la table Ciqual 2025 de l'ANSES : [code, nom, kcal, p, c, s, f, sf, fib, salt] pour 100 g
const ciqual = JSON.parse(readFileSync(new URL('../data/ciqual.json', import.meta.url), 'utf8'));
const table = ciqual.foods.map(r => Object.assign(fromCiqual(r), { n: norm(r[1]) }));

test('table Ciqual : source, licence et valeurs plausibles', () => {
  assert.match(ciqual.source, /Ciqual/);
  assert.equal(ciqual.licence, 'CC BY 4.0');
  assert.ok(ciqual.foods.length > 3000, ciqual.foods.length + ' aliments');
  assert.equal(new Set(ciqual.foods.map(r => r[0])).size, ciqual.foods.length);
  ciqual.foods.forEach(r => {
    assert.equal(r.length, 10, String(r[0]));
    assert.ok(Number.isInteger(r[0]) && typeof r[1] === 'string' && r[1].trim() === r[1] && r[1].length > 1, String(r[0]));
    assert.ok(typeof r[2] === 'number' && r[2] >= 0 && r[2] <= 900, r[1] + ' : ' + r[2] + ' kcal');
    r.slice(3).forEach(v => assert.ok(v === null || (typeof v === 'number' && v >= 0 && v <= 100), r[1] + ' : ' + v + ' g'));
    assert.ok(r[5] == null || r[4] == null || r[5] <= r[4] + 0.5, r[1] + ' : plus de sucres que de glucides');
    assert.ok(r[7] == null || r[6] == null || r[7] <= r[6] + 0.5, r[1] + ' : plus de saturés que de lipides');
  });
});

test('recherche dans la table Ciqual : « œuf » écrit par le clavier de l’iPhone, aliments courants', () => {
  assert.equal(norm('Œufs brouillés'), 'oeufs brouilles');
  assert.ok(searchFoods([[], table], 'œuf dur').some(f => f.name === 'Oeuf dur'));
  assert.ok(searchFoods([[], table], 'oeufs').length > 5);
  assert.ok(searchFoods([[], table], 'pomme').slice(0, 10).every(f => f.n.indexOf('pomme') === 0));
  assert.ok(searchFoods([[], table], 'poulet filet').some(f => f.name === 'Poulet, filet sans peau cru'));
  assert.ok(searchFoods([[], table], 'riz basmati cuit').some(f => /^Riz basmati, cuit/.test(f.name)));
  // Le mot tel qu'il est écrit passe avant un mot voisin (« pâte sablée », « fromage à pâte pressée demi-cuite »)
  assert.match(searchFoods([[], table], 'pâtes cuites')[0].name, /^Pâtes sèches/);
});
