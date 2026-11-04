// Journal des repas : habituels d'un repas, repas passés (« Comme hier »), repas enregistrés, copie d'entrées, sauvegarde des repas enregistrés.
import { test, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { copyEntries, habitualFoods, mealLabel, pastMeals, savedMeals } from '../js/food.js';
import { exportFile, importable } from '../js/backup.js';
import { quickPast } from '../js/views/food.js';
import { donnees, jour, reglages, docs } from './aide.js';

afterEach(() => mock.timers.reset());

const P = { kcal: 100, p: 10, c: 10, s: 1, f: 1, sf: 0.5, fib: 1, salt: 0.1 };
let n = 0;
const entree = (meal, key, g, extra) => Object.assign({ id: 'e' + (++n), meal, key, name: key.split(':')[1], brand: '', g, per100: Object.assign({}, P) }, extra);
const repas = (date, ...items) => ['m_' + date, { date, items }];

test('habituels : classés par nombre de fois, puis du plus récent, avec la dernière quantité', () => {
  jour('2026-11-04');
  donnees(docs(reglages(),
    repas('2026-11-03', entree('breakfast', 'ciq:cafe', 300), entree('breakfast', 'ciq:pain', 50)),
    repas('2026-11-02', entree('breakfast', 'ciq:cafe', 250)),
    repas('2026-11-01', entree('breakfast', 'ciq:cafe', 250), entree('breakfast', 'ciq:pain', 60)),
    repas('2026-10-30', entree('breakfast', 'ciq:jus', 200))));
  const h = habitualFoods('breakfast', '2026-11-04');
  assert.deepEqual(h.map(x => x.key), ['ciq:cafe', 'ciq:pain', 'ciq:jus']);
  assert.deepEqual([h[0].g, h[0].count, h[1].g], [300, 3, 50]);
});

test('habituels : à égalité, le plus récent d’abord', () => {
  jour('2026-11-04');
  donnees(docs(reglages(), repas('2026-11-01', entree('breakfast', 'ciq:a', 10)), repas('2026-11-03', entree('breakfast', 'ciq:b', 10))));
  assert.deepEqual(habitualFoods('breakfast', '2026-11-04').map(x => x.key), ['ciq:b', 'ciq:a']);
});

test('habituels : seulement les 60 jours avant le jour affiché', () => {
  jour('2026-11-04');
  donnees(docs(reglages(), repas('2026-09-04', entree('breakfast', 'ciq:vieux', 10)), repas('2026-09-05', entree('breakfast', 'ciq:limite', 10))));
  assert.deepEqual(habitualFoods('breakfast', '2026-11-04').map(x => x.key), ['ciq:limite']);
});

test('habituels : un autre repas ne compte pas, et un aliment déjà noté ce jour à ce repas est retiré', () => {
  jour('2026-11-04');
  donnees(docs(reglages(),
    repas('2026-11-03', entree('breakfast', 'ciq:cafe', 250), entree('breakfast', 'ciq:pain', 50), entree('lunch', 'ciq:riz', 200)),
    repas('2026-11-04', entree('breakfast', 'ciq:cafe', 250), entree('lunch', 'ciq:pain', 50))));
  assert.deepEqual(habitualFoods('breakfast', '2026-11-04').map(x => x.key), ['ciq:pain']);
});

test('habituels : 8 au plus', () => {
  jour('2026-11-04');
  donnees(docs(reglages(), repas('2026-11-03', ...Array.from({ length: 10 }, (_, i) => entree('snack', 'ciq:a' + i, 10)))));
  assert.equal(habitualFoods('snack', '2026-11-04').length, 8);
});

test('repas passés : du plus récent au plus ancien, jours sans ce repas sautés, 3 au plus', () => {
  jour('2026-11-04');
  donnees(docs(reglages(),
    repas('2026-11-03', entree('breakfast', 'ciq:cafe', 250)), repas('2026-11-02', entree('lunch', 'ciq:riz', 200)),
    repas('2026-11-01', entree('breakfast', 'ciq:pain', 50)), repas('2026-10-30', entree('breakfast', 'ciq:jus', 200)), repas('2026-10-29', entree('breakfast', 'ciq:the', 200))));
  const p = pastMeals('breakfast', '2026-11-04');
  assert.deepEqual(p.map(x => x.date), ['2026-11-03', '2026-11-01', '2026-10-30']);
  assert.deepEqual(p[0].items.map(i => i.key), ['ciq:cafe']);
});

test('repas passés : seulement les 14 jours avant le jour affiché', () => {
  jour('2026-11-04');
  donnees(docs(reglages(), repas('2026-10-20', entree('breakfast', 'ciq:vieux', 10)), repas('2026-10-21', entree('breakfast', 'ciq:limite', 10))));
  assert.deepEqual(pastMeals('breakfast', '2026-11-04').map(x => x.date), ['2026-10-21']);
});

test('libellé d’un repas passé : « hier » pour la veille, sinon le jour de la semaine', () => {
  assert.equal(mealLabel('2026-11-03', '2026-11-04'), 'hier');
  assert.equal(mealLabel('2026-11-02', '2026-11-04'), 'lundi');
});

test('repas enregistrés : ceux du repas demandé d’abord, puis les autres, chacun par nom', () => {
  donnees(docs(reglages(), { q_1: { name: 'Mon déjeuner', meal: 'lunch', items: [] }, q_2: { name: 'Après la salle', meal: 'lunch', items: [] }, q_3: { name: 'Aaa', meal: 'breakfast', items: [] } }));
  assert.deepEqual(savedMeals('lunch').map(q => q.name), ['Après la salle', 'Mon déjeuner', 'Aaa']);
  assert.equal(savedMeals('lunch')[0].id, 'q_2');
});

test('copie : nouvel identifiant, repas demandé, même quantité, rien de plus que le format du journal', () => {
  donnees(docs(reglages()));
  const src = Object.assign(entree('breakfast', 'ciq:x', 120), { count: 3 });
  const [c] = copyEntries([src], 'dinner');
  assert.notEqual(c.id, src.id);
  assert.deepEqual(Object.assign({}, c, { id: 'x' }), { id: 'x', meal: 'dinner', key: 'ciq:x', name: 'x', brand: '', g: 120, per100: P });
});

test('copie : valeurs actuelles d’un produit gardé sur le téléphone, sinon valeurs copiées', () => {
  donnees(docs(reglages(), { f_123: { code: '123', src: 'off', name: 'Nouveau nom', brand: 'Marque', per100: Object.assign({}, P, { kcal: 300 }) } }));
  const [a, b, c] = copyEntries([entree('lunch', 'off:123', 50), entree('lunch', 'off:999', 50), entree('lunch', 'ciq:x', 50)], 'lunch');
  assert.deepEqual([a.per100.kcal, a.name, a.brand], [300, 'Nouveau nom', 'Marque']);
  assert.equal(b.per100.kcal, 100);
  assert.equal(c.per100.kcal, 100);
});

test('sauvegarde : l’export annonce la version 6 et contient les repas enregistrés', async () => {
  jour('2026-11-04');
  donnees(docs(reglages(), { q_a: { name: 'Matin', meal: 'breakfast', items: [], at: '2026-11-04' } }));
  const j = JSON.parse(await exportFile('json').text());
  assert.equal(j.version, 6);
  assert.equal(j.docs.q_a.name, 'Matin');
});

test('sauvegarde : l’import accepte les repas enregistrés, pas un identifiant inconnu', () => {
  assert.ok(importable('q_a') && importable('m_2026-11-04') && importable('settings'));
  assert.ok(!importable('z_a') && !importable('q_'));
});

test('repas passés : un document dont la date n’est pas AAAA-MM-JJ est ignoré (sauvegarde importée)', () => {
  jour('2026-11-04');
  donnees(docs(reglages(), { 'm_2026-11-03': { date: '2026-11-03" onfocus="x', items: [entree('breakfast', 'ciq:cafe', 250)] } }));
  assert.deepEqual(pastMeals('breakfast', '2026-11-04'), []);
});

test('la ligne d’un repas passé échappe ce qu’elle met dans ses attributs', () => {
  const h = quickPast({ date: '2026-11-03" onfocus="x', items: [entree('breakfast', 'ciq:cafe', 250, { name: 'Café <b>' })] }, 'breakfast', 'Comme hier', '2026-11-04');
  assert.ok(!/onfocus="x"/.test(h) && !/<b>/.test(h));
});

test('repas enregistrés : un document sans liste d’aliments est ignoré (sauvegarde importée)', () => {
  donnees(docs(reglages(), { q_1: { name: 'Sans aliments', meal: 'lunch' }, q_2: { name: 'Mon déjeuner', meal: 'lunch', items: [] } }));
  assert.deepEqual(savedMeals('lunch').map(q => q.id), ['q_2']);
});
