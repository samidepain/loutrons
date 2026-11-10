// Écran Progrès : gains par exercice, rythme par semaine, périodes d'affichage.
import test from 'node:test';
import assert from 'node:assert/strict';
import { donnees, docs, jour, reglages, seance } from './aide.js';
import { exerciseGains, periodStart, recordLog, weeklyRhythm } from '../js/engine.js';

test('gains : première et meilleure force estimée par exercice, avec le nombre de séances', () => {
  jour('2026-11-04');
  donnees(docs(reglages(),
    seance('2026-10-20', { ua_bench: { kg: 50, reps: [8] } }),
    seance('2026-10-27', { ua_bench: { kg: 55, reps: [8] } }),
    seance('2026-11-02', { ua_bench: { kg: 52.5, reps: [8] } })));
  const g = exerciseGains().ua_bench;
  assert.equal(g.n, 3);
  assert.equal(g.first.date, '2026-10-20');
  assert.equal(g.best.date, '2026-10-27');
  assert.equal(g.best.kg, 69.7);
  assert.equal(recordLog()[0].id, 'ua_bench');
});

test('gains : une séance par exercice donne n = 1 (rien à comparer), le poids du corps sans poids noté n’en a pas', () => {
  jour('2026-11-04');
  donnees(docs(reglages(), seance('2026-11-02', { ua_bench: { kg: 50, reps: [8] }, ua_pull: { kg: 0, reps: [6] } })));
  assert.equal(exerciseGains().ua_bench.n, 1);
  assert.equal(exerciseGains().ua_pull, undefined);
});

test('rythme : séances et séries par semaine, la semaine en cours est signalée, une semaine sans séance vaut 0', () => {
  jour('2026-11-11');
  donnees(docs(reglages(),
    seance('2026-10-20', { ua_bench: { kg: 50, reps: [8, 8, 8] } }),
    seance('2026-10-22', { ua_bench: { kg: 50, reps: [8, 8] } }),
    seance('2026-11-10', { ua_bench: { kg: 50, reps: [8] } }),
    seance('2026-11-03', { ua_bench: { kg: 50, reps: [8] } }, { status: 'en_cours' })));
  const r = weeklyRhythm('2026-10-19', '2026-11-09');
  assert.deepEqual(r.map(x => [x.monday, x.sessions, x.sets, x.current]), [['2026-10-19', 2, 5, false], ['2026-10-26', 0, 0, false], ['2026-11-02', 0, 0, false], ['2026-11-09', 1, 1, true]]);
});

test('période : 8 semaines = 56 jours dont aujourd’hui, « Tout » = pas de début, clé inconnue = 6 mois', () => {
  jour('2026-11-10');
  assert.equal(periodStart('w8'), '2026-09-16');
  assert.equal(periodStart('all'), null);
  assert.equal(periodStart('xyz'), periodStart('m6'));
});
