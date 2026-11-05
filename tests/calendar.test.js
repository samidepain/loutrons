// Calendrier : cases du mois, mois voisins, et résumé d'une journée.
import { test, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { addMonths, fmtMonth, monthDays } from '../js/util.js';
import { daySummary } from '../js/data.js';
import { donnees, jour, reglages, seance, docs } from './aide.js';

afterEach(() => mock.timers.reset());

test('novembre 2026 commence un dimanche : 6 cases vides, 30 jours, 6 semaines', () => {
  const c = monthDays('2026-11');
  assert.equal(c.indexOf('2026-11-01'), 6);
  assert.equal(c.filter(Boolean).length, 30);
  assert.equal(c.length, 42);
  assert.equal(c[c.length - 1], null);
});

test('février 2027 commence un lundi et tient en 4 semaines', () => {
  const c = monthDays('2027-02');
  assert.equal(c[0], '2027-02-01');
  assert.equal(c.length, 28);
});

test('mois voisins et nom du mois, y compris au changement d’année', () => {
  assert.equal(addMonths('2026-12', 1), '2027-01');
  assert.equal(addMonths('2026-01', -1), '2025-12');
  assert.equal(fmtMonth('2026-11'), 'novembre 2026');
});

test('résumé d’une journée : séance faite, en cours ; plus de séance prévue d’après le jour de la semaine (rotation)', () => {
  jour('2026-11-04'); // mercredi ; programme exemple : lundi, mardi, vendredi, dimanche
  donnees(docs(reglages(),
    seance('2026-11-02', { la_hack: { kg: 100, reps: [8, 8, 8], rir: 2 } }),
    seance('2026-11-04', { ua_bench: { kg: 40, reps: [8], rir: 2 } }, { status: 'en_cours' })));
  const lundi = daySummary('2026-11-02');
  assert.equal(lundi.done.length, 1);
  assert.equal(lundi.planned, null);
  assert.equal(daySummary('2026-11-03').planned, null); // mardi passé sans séance : rien de prévu affiché
  const auj = daySummary('2026-11-04');
  assert.ok(auj.active);
  assert.equal(auj.planned, null);
  assert.equal(daySummary('2026-11-06').planned, null); // vendredi à venir, pas prévu à l'avance
  assert.equal(daySummary('2026-11-09').planned, null); // lundi suivant
  const jeudi = daySummary('2026-11-05');
  assert.equal(jeudi.planned, null);
  assert.equal(jeudi.label, 'Repos');
});

test('jour à venir avec le sport collectif : le nom du sport, sans séance de salle', () => {
  jour('2026-11-04');
  donnees(docs(reglages({ modules: { knee: false, jumps: false, sport: true }, sport: { name: 'Basket', train: [4], match: [6] } })));
  assert.equal(daySummary('2026-11-05').label, 'Basket');
  assert.equal(daySummary('2026-11-07').label, 'Match');
});
