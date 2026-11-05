// Dépense des séances et des activités (Compendium 2024, dépense nette MET − 1), course (1 kcal/kg/km), eau, besoins du jour.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { activityKcal, computeSessionKcal, dayEnergy, sessionMin, sportOf, waterGoal } from '../js/energy.js';
import { planFor, withExtra } from '../js/nutrition.js';
import { donnees, docs, jour, reglages, seance } from './aide.js';

const pesee = kg => ['b_2026-10-01', { date: '2026-10-01', weight: kg }];

test('séance de muscu : durée réelle × effort, dépense nette ; séance oubliée : durée prévue', () => {
  const w = { est: 60, duration: 60 };
  assert.equal(computeSessionKcal(w, 80), 200);                              // (3,5 − 1) × 80 kg × 1 h
  assert.equal(computeSessionKcal(Object.assign({}, w, { effort: 'heavy' }), 80), 320);
  assert.equal(computeSessionKcal(Object.assign({}, w, { effort: 'intense' }), 80), 400);
  assert.equal(sessionMin({ est: 55, duration: 300 }), 55);                  // terminée bien plus tard : oubliée
  assert.equal(sessionMin({ est: 55, duration: 100 }), 100);
  assert.equal(computeSessionKcal(w, null), null);                           // poids inconnu
});

test('activités : course au kilomètre, niveaux du Compendium, sports, calories saisies', () => {
  assert.equal(activityKcal({ type: 'run', km: 10, min: 55 }, 70), 700);
  assert.equal(activityKcal({ type: 'run', min: 55 }, 70), null);            // distance manquante
  assert.equal(activityKcal({ type: 'bike', level: 'mod', min: 60 }, 80), 560); // (8 − 1) × 80
  assert.equal(activityKcal({ type: 'walk', level: 'mod', min: 30 }, 80), 152); // (4,8 − 1) × 80 × 0,5
  assert.equal(activityKcal({ type: 'sport', sport: 'basket', level: 'match', min: 90 }, 80), 840);
  assert.equal(activityKcal({ type: 'sport', sport: 'basket', level: 'train', min: 90 }, 80), 780);
  assert.equal(activityKcal({ type: 'other', kcal: '310' }, null), 310);     // valeur de la montre, sans poids
  assert.equal(activityKcal({ type: 'swim', min: 40 }, 80), null);           // niveau manquant
  assert.equal(sportOf('Basket-ball'), 'basket');
  assert.equal(sportOf('Foot à 5'), 'foot');
  assert.equal(sportOf('Escalade'), null);
});

test('dépense du jour : rien pour une séance pas encore commencée, puis la vraie ; activités ajoutées', () => {
  jour('2026-11-02'); // lundi : Upper A prévu dans le programme exemple
  donnees(docs(reglages(), pesee(80), ['a_2026-11-02_x', { date: '2026-11-02', type: 'run', km: 5, min: 28, at: 1 }]));
  const matin = dayEnergy('2026-11-02');
  assert.deepEqual(matin.items.map(i => i.kind), ['activity']);
  assert.equal(matin.items[0].kcal, 400);
  assert.equal(matin.kcal, 400);
  donnees(docs(reglages(), pesee(80), seance('2026-11-02', {}, { tpl: 'UA', est: 70, duration: 64, effort: 'heavy', kcal: 341 })));
  const soir = dayEnergy('2026-11-02');
  assert.deepEqual(soir.items.map(i => [i.kind, i.kcal]), [['session', 341]]);
  assert.equal(soir.min, 64);
  // Un jour passé : pas de séance prévue
  assert.deepEqual(dayEnergy('2026-11-01').items, []);
});

test('eau : repère EFSA selon le sexe, plus 0,5 L par heure de sport', () => {
  jour('2026-11-03'); // mardi : Lower A prévu
  donnees(docs(reglages({ sex: 'f', plan: { 2: { label: 'Repos' } } }), pesee(60)));
  assert.equal(waterGoal('2026-11-03'), 1600);
  donnees(docs(reglages({ sex: 'm', plan: { 2: { label: 'Repos' } } }), pesee(80), ['a_2026-11-03_y', { date: '2026-11-03', type: 'bike', level: 'mod', min: 60 }]));
  assert.equal(waterGoal('2026-11-03'), 2500);
  donnees(docs(reglages({ plan: { 2: { label: 'Repos' } } }), pesee(80)));
  assert.equal(waterGoal('2026-11-03'), 1800);                               // sexe non indiqué : moyenne
});

test('besoins du jour : dépense ajoutée aux calories, protéines inchangées, lipides et glucides recalculés', () => {
  const pl = planFor({ sex: 'm', birth: '1996-06-15', height: 180, weight: 80 }, { activity: 'sit', goal: 'keep' }, '2026-11-02');
  const d = withExtra(pl, 343);
  assert.equal(d.kcal, pl.kcal + 340);
  assert.equal(d.extra, 340);
  assert.deepEqual(d.protein, pl.protein);
  assert.ok(d.fat[0] > pl.fat[0] && d.carbs > pl.carbs);
  assert.equal(withExtra(pl, 0), pl);
});

test('séance avec cardio : le cardio compte avec sa propre allure, le reste avec l’effort de la séance', () => {
  donnees(docs(reglages(), pesee(80)));
  const w = { est: 60, duration: 60, effort: 'classic', items: [{ ex: 'ex_rower', kind: 'cardio', name: 'Rameur', lo: 15 }, { ex: 'lib_bench', kind: 'load', name: 'Développé couché', lo: 6, hi: 8 }],
    ex: { ex_rower: { level: 'mod', sets: [{ min: '15', km: '3,2', done: true }] }, lib_bench: { sets: [] } } };
  // Rameur soutenu (7,5 MET) 15 min : 6,5 × 80 × 0,25 = 130 ; muscu classique 45 min : 2,5 × 80 × 0,75 = 150
  assert.equal(computeSessionKcal(w, 80), 280);
  w.ex.ex_rower.sets[0].done = false;
  assert.equal(computeSessionKcal(w, 80), 200);
});
