// Écrans d'explication du premier lancement, journal vide et ligne qu'on balaie pour la supprimer.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { S } from '../js/store.js';
import { hasMeals } from '../js/food.js';
import { introCard } from '../js/views/intro.js';
import { swipeRow } from '../js/swipe.js';
import { donnees, jour, reglages, seance } from './aide.js';

const charge = fn => { S.loaded = true; try { return fn(); } finally { S.loaded = false; } };

test('une rubrique vide s’explique, jusqu’à ce qu’on la ferme', () => {
  jour('2026-11-10');
  donnees({ settings: reglages() });
  assert.match(charge(() => introCard('training')), /Ton entraînement/);
  donnees({ settings: reglages({ intro: { training: true } }) });
  assert.equal(charge(() => introCard('training')), '');
  assert.match(charge(() => introCard('progress')), /Ta progression/);
});

test('l’explication ne revient pas dès qu’il y a une séance', () => {
  jour('2026-11-10');
  donnees({ settings: reglages(), ...Object.fromEntries([seance('2026-11-09', { ua_bench: { kg: 40, reps: [8, 8, 8], rir: 2 } })]) });
  assert.equal(charge(() => introCard('training')), '');
  assert.equal(charge(() => introCard('today')), '');
});

test('l’explication de l’alimentation disparaît au premier aliment noté', () => {
  jour('2026-11-10');
  donnees({ settings: reglages() });
  assert.equal(hasMeals(), false);
  assert.match(charge(() => introCard('food')), /Ton alimentation/);
  donnees({ settings: reglages(), m_20261110: { date: '2026-11-10', items: [] } });
  assert.equal(hasMeals(), false);
  donnees({ settings: reglages(), m_20261110: { date: '2026-11-10', items: [{ id: 'a', meal: 'lunch', key: 'own:x', name: 'Riz', g: 100, per100: { kcal: 130 } }] } });
  assert.equal(hasMeals(), true);
  assert.equal(charge(() => introCard('food')), '');
});

test('une ligne balayable garde son contenu et son bouton Supprimer avec l’action et la cible', () => {
  const h = swipeRow('<button>Riz</button>', 'fd-swipe-del', 'a', 'Retirer Riz', ' data-d="2026-11-10"');
  assert.match(h, /class="sw"><div class="sw-in"><button>Riz<\/button><\/div>/);
  assert.match(h, /data-act="fd-swipe-del" data-v="a" data-d="2026-11-10" aria-label="Retirer Riz" tabindex="-1">Supprimer</);
});
