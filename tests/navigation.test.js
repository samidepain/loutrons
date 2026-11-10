// Navigation et Aujourd'hui : familles d'activité, familles d'un jour, ordre des conseils d'Émile, progrès d'un exercice.
import { test, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { activityFamily, dayFamilies } from '../js/data.js';
import { emileQueue } from '../js/emile.js';
import { exerciseProgress, findPRs, prSet, recentRecord, recordLog } from '../js/engine.js';
import { S } from '../js/store.js';
import { donnees, jour, reglages, seance, docs } from './aide.js';
import { greeting, shortName } from '../js/util.js';

afterEach(() => mock.timers.reset());

const act = (date, type, extra) => ['a_' + date + '_' + type, Object.assign({ date, type, min: 30, at: 1 }, extra)];
const sport = extra => reglages(Object.assign({ modules: { knee: false, jumps: false, sport: true }, sport: { name: 'Basket', train: [4], match: [6] } }, extra));

test('famille d’une activité : course, vélo, natation et marche en cardio, sport en collectif, le reste en autre', () => {
  assert.deepEqual(['run', 'bike', 'swim', 'walk', 'sport', 'other'].map(activityFamily), ['cardio', 'cardio', 'cardio', 'cardio', 'collectif', 'autre']);
});

test('une course et une séance le même jour donnent deux familles, la salle d’abord', () => {
  jour('2026-11-04');
  donnees(docs(reglages(), seance('2026-11-02', { ua_bench: { kg: 50, reps: [8, 8, 8] } }), act('2026-11-02', 'run', { km: 5 })));
  assert.deepEqual(dayFamilies('2026-11-02'), [{ fam: 'salle', state: 'done' }, { fam: 'cardio', state: 'done' }]);
});

test('un jeudi d’entraînement de sport à venir donne sports collectifs prévu', () => {
  jour('2026-11-04');
  donnees(docs(sport()));
  assert.deepEqual(dayFamilies('2026-11-05'), [{ fam: 'collectif', state: 'planned' }]);
});

test('une séance en cours compte comme « en cours » pour la salle', () => {
  jour('2026-11-04');
  donnees(docs(reglages(), seance('2026-11-04', { ua_bench: { kg: 50, reps: [8] } }, { status: 'en_cours' })));
  assert.deepEqual(dayFamilies('2026-11-04'), [{ fam: 'salle', state: 'active' }]);
});

test('un jour passé sans séance ni activité ne donne rien, même si une séance y était prévue', () => {
  jour('2026-11-04');
  donnees(docs(reglages()));
  assert.deepEqual(dayFamilies('2026-11-03'), []);
});

test('un sport noté un jour de match prévu donne sports collectifs fait, une seule fois (et la salle prévue tant que l’objectif de la semaine n’est pas atteint)', () => {
  jour('2026-11-07');
  donnees(docs(sport(), act('2026-11-07', 'sport', { sport: 'basket', level: 'match' })));
  assert.deepEqual(dayFamilies('2026-11-07'), [{ fam: 'salle', state: 'planned' }, { fam: 'collectif', state: 'done' }]);
});

test('ordre des conseils d’Émile : le plus petit rang d’abord, ordre gardé à rang égal, conseils fermés retirés', () => {
  const q = emileQueue([{ rank: 5, html: 'semaine' }, { rank: 3, html: '' }, { rank: 1, html: 'point' }, { rank: 2, html: 'fatigue' }, { rank: 1, html: 'bilan' }]);
  assert.equal(q.first, 'point');
  assert.deepEqual(q.rest, ['bilan', 'fatigue', 'semaine']);
});

test('sans conseil à montrer, la file d’Émile est vide', () => {
  assert.deepEqual(emileQueue([{ rank: 1, html: '' }]), { first: '', rest: [] });
});

test('progrès d’un exercice : meilleure série par la force estimée, 5 dernières séances de la plus récente à la plus ancienne', () => {
  jour('2026-11-04');
  const s = [['2026-10-01', 40, [10, 10, 10]], ['2026-10-08', 45, [8, 8, 8]], ['2026-10-15', 50, [6, 6, 5]], ['2026-10-22', 47.5, [8, 8, 7]], ['2026-10-29', 50, [8, 7, 7]], ['2026-11-02', 52.5, [6, 6, 6]]]
    .map(([d, kg, reps]) => seance(d, { ua_bench: { kg, reps, rir: 2 } }));
  donnees(docs(reglages(), ...s));
  const p = exerciseProgress('ua_bench');
  assert.equal(p.kind, 'load');
  assert.deepEqual(p.best, { kg: 50, reps: 8, e1rm: 63.3, date: '2026-10-29' });
  assert.deepEqual(p.last.map(x => x.date), ['2026-11-02', '2026-10-29', '2026-10-22', '2026-10-15', '2026-10-08']);
  assert.deepEqual(p.last[0], { date: '2026-11-02', sets: [{ kg: 52.5, reps: 6 }, { kg: 52.5, reps: 6 }, { kg: 52.5, reps: 6 }], rir: 2, deload: false });
});

test('progrès d’un exercice jamais fait : pas de meilleure série, aucune séance', () => {
  jour('2026-11-04');
  donnees(docs(reglages()));
  assert.deepEqual(exerciseProgress('ua_bench').best, null);
  assert.deepEqual(exerciseProgress('ua_bench').last, []);
});

test('progrès d’un cardio : pas de meilleure série, dernières séances avec durée, distance et allure', () => {
  jour('2026-11-04');
  donnees(docs(reglages(), ['w_20261102_c', { date: '2026-11-02', status: 'terminée', startedAt: 1, ex: { ex_bike: { sets: [{ min: '30', km: '12', done: true }], level: 'mod' } } }]));
  const p = exerciseProgress('ex_bike');
  assert.equal(p.kind, 'cardio');
  assert.equal(p.best, null);
  assert.deepEqual(p.last, [{ date: '2026-11-02', min: 30, km: 12, level: 'mod' }]);
});

test('progrès d’un exercice au poids du corps sans poids noté : meilleure série = le plus de lest, puis le plus de reps', () => {
  jour('2026-11-04');
  donnees(docs(reglages(), seance('2026-10-20', { ua_pull: { kg: 0, reps: [12, 10] } }), seance('2026-11-02', { ua_pull: { kg: 0, reps: [8, 8] } })));
  const p = exerciseProgress('ua_pull');
  assert.equal(p.kind, 'bw');
  assert.deepEqual(p.best, { kg: 0, reps: 12, e1rm: null, date: '2026-10-20' });
});

test('progrès d’un exercice au poids du corps avec un poids noté : force estimée poids du corps compris', () => {
  jour('2026-11-04');
  donnees(docs(reglages(), ['b_2026-11-01', { date: '2026-11-01', weight: 80 }], seance('2026-10-20', { ua_pull: { kg: 0, reps: [12] } }), seance('2026-11-02', { ua_pull: { kg: 10, reps: [8] } })));
  // 80 × (1 + 12/30) = 112 ; 90 × (1 + 8/30) = 114
  assert.deepEqual(exerciseProgress('ua_pull').best, { kg: 10, reps: 8, e1rm: 114, date: '2026-11-02' });
});

test('progrès d’un saut (pliométrie) : pas de meilleure série', () => {
  jour('2026-11-04');
  donnees(docs(reglages(), seance('2026-11-02', { la_pogo: { kg: 0, reps: [10, 10] } })));
  assert.equal(exerciseProgress('la_pogo').best, null);
});

test('progrès d’un exercice : une séance de décharge est marquée comme telle', () => {
  jour('2026-11-04');
  donnees(docs(reglages(), seance('2026-11-02', { ua_bench: { kg: 50, reps: [8] } }, { deload: true })));
  assert.equal(exerciseProgress('ua_bench').last[0].deload, true);
});

test('records : une séance qui dépasse la force estimée des séances d’avant, jamais la première, du plus récent au plus ancien', () => {
  jour('2026-11-04');
  donnees(docs(reglages(),
    seance('2026-10-20', { ua_bench: { kg: 50, reps: [8] } }),
    seance('2026-10-23', { ua_bench: { kg: 50, reps: [6] } }),
    seance('2026-10-27', { ua_bench: { kg: 52.5, reps: [8] } }),
    seance('2026-11-02', { ua_bench: { kg: 55, reps: [8] } })));
  const r = recordLog();
  assert.deepEqual(r.map(x => x.date), ['2026-11-02', '2026-10-27']);
  assert.equal(r[0].kg, 70);
  assert.equal(r[1].gain, 3.2);
});

test('records : aucun sans séance terminée, ni avec une seule séance par exercice', () => {
  jour('2026-11-04');
  donnees(docs(reglages(), seance('2026-11-02', { ua_bench: { kg: 50, reps: [8] } })));
  assert.deepEqual(recordLog(), []);
});

test('série record pendant la séance : la meilleure série validée, seulement si elle bat les séances d’avant', () => {
  jour('2026-11-10');
  const it = { ex: 'ua_bench', kind: 'load', name: 'Développé couché' };
  const enCours = sets => ({ date: '2026-11-10', status: 'en_cours', items: [it], ex: { ua_bench: { sets } } });
  const avant = seance('2026-11-03', { ua_bench: { kg: 60, reps: [8, 8, 7] } });
  const fait = (kg, reps) => ({ kg: String(kg), reps: String(reps), done: true });
  donnees(docs(reglages(), avant));
  // 60 × 8 égale le record : rien ; 62,5 × 8 le bat : 2e série ; une série non validée ne compte pas
  assert.equal(prSet(enCours([fait(60, 8)]), it), null);
  const w = enCours([fait(60, 8), fait(62.5, 8), { kg: '80', reps: '8', done: false }]);
  assert.equal(prSet(w, it).i, 1);
  assert.equal(findPRs(w).length, 1);
  // Première séance de l'exercice : pas de record
  donnees(docs(reglages()));
  assert.equal(prSet(w, it), null);
});

test('salutation : nuit avant 5 h, matin avant midi, après-midi avant 18 h, soir ensuite', () => {
  assert.equal(greeting(4), 'Bonne nuit'); assert.equal(greeting(5), 'Bonjour'); assert.equal(greeting(11), 'Bonjour');
  assert.equal(greeting(12), 'Bon après-midi'); assert.equal(greeting(17), 'Bon après-midi'); assert.equal(greeting(18), 'Bonsoir');
});

test('recentRecord : le dernier record compte 7 jours, pas 8', () => {
  jour('2026-11-20');
  donnees(docs(reglages(), seance('2026-11-02', { ua_bench: { kg: 60, reps: [8, 8, 8], rir: 2 } }), seance('2026-11-13', { ua_bench: { kg: 70, reps: [8, 8, 8], rir: 2 } })));
  assert.equal(recentRecord('2026-11-20').date, '2026-11-13');
  assert.equal(recentRecord('2026-11-21'), null);
});

test('recordLog : gardé tant que les documents ne changent pas, recalculé après une écriture', () => {
  jour('2026-11-20');
  donnees(docs(reglages(), seance('2026-11-02', { ua_bench: { kg: 60, reps: [8, 8, 8], rir: 2 } }), seance('2026-11-13', { ua_bench: { kg: 70, reps: [8, 8, 8], rir: 2 } })));
  const a = recordLog(); assert.equal(recordLog(), a);
  S.rev++; assert.notEqual(recordLog(), a);
});

test('nom court d’une séance dans la bande de semaine : initiales, ou mot long coupé', () => {
  assert.equal(shortName('Upper A'), 'UA'); assert.equal(shortName('Full body A'), 'FBA'); assert.equal(shortName('Course'), 'Course');
  assert.equal(shortName('Football'), 'Footb.'); assert.equal(shortName(''), '');
});
