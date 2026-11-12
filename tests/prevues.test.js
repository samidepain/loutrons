// Activités prévues à l'avance (planned:true) et familles collectif / individuel.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { activities, activityFamily, dayFamilies, daySummary, pendingActivities, plannedActivities } from '../js/data.js';
import { dayEnergy, SPORTS } from '../js/energy.js';
import { donnees, docs, jour, reglages } from './aide.js';

const pesee = ['b_2026-11-01', { date: '2026-11-01', weight: 80 }];

test('tennis et badminton sont des sports individuels, les autres des sports collectifs ; la liste de data.js suit SPORTS', () => {
  Object.keys(SPORTS).forEach(k => assert.equal(activityFamily('sport', k), SPORTS[k].group, k));
  assert.equal(activityFamily('sport', 'basket'), 'collectif');
  assert.equal(activityFamily('sport', 'tennis'), 'individuel');
  assert.equal(activityFamily('sport'), 'collectif');   // ancienne activité sans sport précis
  assert.equal(activityFamily('run', 'tennis'), 'cardio');
});

test('une activité prévue est lue à part : pas dans les activités faites, ni dans la dépense', () => {
  jour('2026-11-10');
  donnees(docs(reglages(), pesee, {
    'a_2026-11-12_a': { date: '2026-11-12', type: 'run', min: 40, km: 7, planned: true, at: 1 },
    'a_2026-11-12_b': { date: '2026-11-12', type: 'bike', min: 30, level: 'mod', kcal: 260, at: 2 }
  }));
  assert.deepEqual(activities('2026-11-12').map(a => a.type), ['bike']);
  assert.deepEqual(plannedActivities('2026-11-12').map(a => a.type), ['run']);
  assert.deepEqual(daySummary('2026-11-12').plannedActs.map(a => a.type), ['run']);
  assert.deepEqual(dayEnergy('2026-11-12').items.map(i => i.kind), ['activity']);
  assert.equal(dayEnergy('2026-11-12').kcal, 260);
});

test('calendrier : une activité prévue donne un anneau, une activité faite un point plein, et le fait l’emporte', () => {
  jour('2026-11-10');
  donnees(docs(reglages(), pesee, {
    'a_2026-11-14_a': { date: '2026-11-14', type: 'sport', sport: 'tennis', min: 60, level: 'train', planned: true },
    'a_2026-11-15_a': { date: '2026-11-15', type: 'swim', min: 30, level: 'mod', planned: true },
    'a_2026-11-15_b': { date: '2026-11-15', type: 'walk', min: 30, level: 'easy', kcal: 100 }
  }));
  assert.deepEqual(dayFamilies('2026-11-14'), [{ fam: 'individuel', state: 'planned' }]);
  assert.deepEqual(dayFamilies('2026-11-15'), [{ fam: 'cardio', state: 'done' }]);   // nage prévue et marche faite : même famille, le fait l'emporte
});

test('rappel : les activités prévues d’un jour passé (14 jours au plus) et jamais notées, de la plus ancienne à la plus récente', () => {
  jour('2026-11-12');
  donnees(docs(reglages(), pesee, {
    'a_2026-11-10_a': { date: '2026-11-10', type: 'run', min: 40, km: 7, planned: true },
    'a_2026-11-08_a': { date: '2026-11-08', type: 'walk', min: 30, level: 'easy', planned: true },
    'a_2026-10-20_a': { date: '2026-10-20', type: 'swim', min: 30, level: 'mod', planned: true },   // trop ancienne
    'a_2026-11-09_a': { date: '2026-11-09', type: 'bike', min: 30, level: 'mod', kcal: 260 },        // faite : pas un rappel
    'a_2026-11-12_a': { date: '2026-11-12', type: 'run', min: 30, km: 5, planned: true },            // aujourd'hui : pas en retard
    'a_2026-11-14_a': { date: '2026-11-14', type: 'run', min: 30, km: 5, planned: true }             // à venir
  }));
  assert.deepEqual(pendingActivities('2026-11-12').map(a => a.date), ['2026-11-08', '2026-11-10']);
});

test('prochaine pesée : 14 jours après la dernière, due le jour venu, rien sans pesée', async () => {
  const { nextWeigh } = await import('../js/data.js');
  jour('2026-11-10');
  donnees(docs(reglages()));
  assert.equal(nextWeigh('2026-11-10'), null);
  donnees(docs(reglages(), { 'b_2026-11-01': { date: '2026-11-01', weight: 80 } }));
  assert.deepEqual(nextWeigh('2026-11-10'), { date: '2026-11-15', last: '2026-11-01', due: false });
  assert.equal(nextWeigh('2026-11-15').due, true);
});
