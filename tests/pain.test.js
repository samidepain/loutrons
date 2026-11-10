// Douleurs de plusieurs zones : zones suivies, maintien de la charge, conseils, signaux d'alerte ; rappel de pesée ; choix du formulaire d'activité.
import { test, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { computeTarget } from '../js/engine.js';
import { exDef, lastWeighIn, weekInfo, weighDue } from '../js/data.js';
import { CHOICES, choiceOf, activityName } from '../js/energy.js';
import { FLAG_LABEL, painAdvice, painAlert, painEntries, painStrong, painZones, soreZones, ZONES } from '../js/pain.js';
import { weightReading } from '../js/views/goal.js';
import { today } from '../js/util.js';
import { donnees, jour, reglages, seance, docs } from './aide.js';

afterEach(() => mock.timers.reset());
const objectif = id => computeTarget(exDef(id), weekInfo(today()));
const pain = zones => ({ pain: { zones } });
const d = (date, z) => ({ ['d_' + date]: { date, z } });
// Développé couché : haut de fourchette deux séances de suite, donc hausse de charge sauf douleur
const bench = [seance('2026-09-14', { ua_bench: { kg: 40, reps: [8, 8, 8], rir: 1 } }), seance('2026-09-21', { ua_bench: { kg: 40, reps: [8, 8, 8], rir: 1 } })];

test('zones suivies : le genou par son option, les autres par leurs réglages ; rien par défaut', () => {
  jour('2026-09-23');
  donnees(docs(reglages()));
  assert.deepEqual(painZones(), []);
  donnees(docs(reglages(Object.assign({ modules: { knee: true, jumps: false, sport: false } }, pain(['hip', 'shoulder'])))));
  assert.deepEqual(painZones(), ['knee', 'shoulder', 'hip']);
});

test('épaule au-dessus de 3/10 ces 10 jours : la charge d’un développé est maintenue, avec la raison ; sans la zone suivie, la hausse a lieu', () => {
  jour('2026-09-23');
  donnees(docs(reglages(pain(['shoulder'])), ...bench, d('2026-09-20', { shoulder: { v: 4, flags: [] } })));
  const t = objectif('ua_bench');
  assert.equal(t.type, 'hold');
  assert.equal(t.kg, 40);
  assert.match(t.text, /épaule/);
  donnees(docs(reglages(), ...bench, d('2026-09-20', { shoulder: { v: 4, flags: [] } })));
  assert.equal(objectif('ua_bench').type, 'up');
  donnees(docs(reglages(pain(['shoulder'])), ...bench, d('2026-09-20', { shoulder: { v: 3, flags: [] } })));  // 3/10 : pas au-dessus du seuil
  assert.equal(objectif('ua_bench').type, 'up');
  donnees(docs(reglages(pain(['shoulder'])), ...bench, d('2026-09-05', { shoulder: { v: 6, flags: [] } }))); // trop ancienne
  assert.equal(objectif('ua_bench').type, 'up');
});

test('une douleur mesurée pendant la séance compte aussi ; un exercice d’une autre zone n’est pas touché', () => {
  jour('2026-09-23');
  donnees(docs(reglages(pain(['elbow'])), ['w_20260920_a', { date: '2026-09-20', status: 'terminée', pain: { elbow: 5 }, ex: {} }]));
  assert.deepEqual(painEntries('elbow').map(e => [e.v, e.src]), [[5, 'session']]);
  assert.deepEqual(soreZones(exDef('ua_curl')), ['elbow']);
  assert.deepEqual(soreZones(exDef('la_calf')), []);
});

test('bas du dos : seuls les exercices repérés (soulevés, charnières, rowings, squats à la barre) sont concernés', () => {
  jour('2026-09-23');
  donnees(docs(reglages(pain(['lowback'])), d('2026-09-21', { lowback: { v: 5, flags: [] } })));
  assert.deepEqual(['lib_deadlift', 'la_rdl', 'lib_rowbar', 'lib_squat'].map(id => soreZones(exDef(id)).length), [1, 1, 1, 1]);
  assert.deepEqual(['ua_bench', 'lib_pulldown', 'la_calf'].map(id => soreZones(exDef(id)).length), [0, 0, 0]);
});

test('poignet, hanche, nuque, autre : la douleur est notée mais rien n’est adapté, et le conseil le dit', () => {
  jour('2026-09-23');
  donnees(docs(reglages(pain(['wrist'])), ...bench, d('2026-09-21', { wrist: { v: 5, flags: [] } })));
  assert.ok(painAlert('wrist'));
  assert.equal(ZONES.wrist.hits, null);
  assert.equal(objectif('ua_bench').type, 'up');
  const a = painAdvice('wrist');
  assert.match(a.lines.join(' '), /ne sais pas quels exercices/);
  assert.match(a.lines.join(' '), /Ce n’est pas un diagnostic/);
});

test('douleur forte ou signal d’alerte : l’appli conseille de consulter au lieu d’adapter à ta place', () => {
  jour('2026-09-23');
  donnees(docs(reglages(pain(['shoulder'])), d('2026-09-21', { shoulder: { v: 4, flags: [] } })));
  assert.equal(painStrong('shoulder'), false);
  assert.equal(painAdvice('shoulder', ['Développé couché']).tone, 'warn');
  assert.match(painAdvice('shoulder', ['Développé couché']).lines.join(' '), /charge maintenue sur : Développé couché/);
  donnees(docs(reglages(pain(['shoulder'])), d('2026-09-21', { shoulder: { v: 4, flags: ['numb'] } })));
  assert.equal(painStrong('shoulder'), true);
  donnees(docs(reglages(pain(['shoulder'])), d('2026-09-21', { shoulder: { v: 7, flags: [] } })));
  const a = painAdvice('shoulder');
  assert.equal(a.tone, 'bad');
  assert.match(a.lines.join(' '), /consulte un médecin ou un kiné avant de recharger/);
  donnees(docs(reglages(pain(['shoulder']))));
  assert.equal(painAdvice('shoulder'), null);
});

test('signaux d’alerte : seulement ceux qui ont un sens pour la zone ; l’entrejambe et la vessie, c’est une urgence', () => {
  assert.ok(Object.keys(ZONES).filter(z => z !== 'knee').every(z => ZONES[z].flags.every(f => FLAG_LABEL[f])));
  assert.ok(ZONES.lowback.flags.includes('saddle') && !ZONES.shoulder.flags.includes('saddle'));
  assert.ok(ZONES.shoulder.flags.includes('weak') && !ZONES.lowback.flags.includes('weak'));
  jour('2026-09-23');
  donnees(docs(reglages(pain(['lowback'])), d('2026-09-21', { lowback: { v: 4, flags: ['saddle'] } })));
  const a = painAdvice('lowback');
  assert.equal(a.tone, 'bad');
  assert.equal(a.lines.length, 2);                                   // la raison, puis l'urgence : pas de conseil d'adaptation
  assert.match(a.lines[1], /urgence médicale, consulte sans attendre/);
  donnees(docs(reglages(pain(['shoulder'])), d('2026-09-21', { shoulder: { v: 4, flags: ['weak', 'rest'] } })));
  assert.match(painAdvice('shoulder').lines.join(' '), /signal d’alerte \(perte soudaine de force, douleur la nuit ou au repos\)/);
});

test('rappel de pesée : 14 jours après la dernière, jamais avant ; les anciennes pesées restent', () => {
  jour('2026-11-10');
  const b = (date, weight) => ({ ['b_' + date]: { date, weight } });
  donnees(docs(reglages(), b('2026-10-20', 80), b('2026-10-28', 79.5)));
  assert.equal(lastWeighIn().date, '2026-10-28');
  assert.equal(weighDue('2026-11-10'), false);      // 13 jours
  assert.equal(weighDue('2026-11-11'), true);       // 14 jours
  donnees(docs(reglages()));
  assert.equal(weighDue('2026-11-10'), false);      // aucune pesée : pas de rappel
});

test('lecture du poids : trop tôt avec 2 pesées, sinon tendance avec sa marge, stable si dans la marge', () => {
  jour('2026-11-10');
  const b = (date, weight) => ({ ['b_' + date]: { date, weight } });
  donnees(docs(reglages(), b('2026-10-27', 80), b('2026-11-10', 79.6)));
  assert.match(weightReading(), /au moins 3/);
  donnees(docs(reglages(), b('2026-10-13', 80), b('2026-10-27', 79.9), b('2026-11-10', 79.9)));
  assert.match(weightReading(), /stable, compte tenu de la marge/);
  donnees(docs(reglages(), b('2026-10-13', 82), b('2026-10-27', 80.8), b('2026-11-10', 79.6)));
  assert.match(weightReading(), /plutôt en baisse/);
  assert.match(weightReading(), /pas une certitude/);
});

test('formulaire d’activité : chaque sport est un choix direct, « Autre » en dernier ; les anciennes activités restent lisibles', () => {
  assert.deepEqual(CHOICES.map(c => c[0]), ['run', 'bike', 'swim', 'walk', 'sport:basket', 'sport:foot', 'sport:hand', 'sport:rugby', 'sport:volley', 'sport:tennis', 'sport:badminton', 'other']);
  assert.ok(!CHOICES.some(c => c[0] === 'sport'));
  const ancienne = { type: 'sport', sport: 'basket', level: 'match', min: 90 };
  assert.equal(choiceOf(ancienne), 'sport:basket');
  assert.equal(activityName(ancienne), 'Basket (match)');
  assert.equal(choiceOf({ type: 'run' }), 'run');
});
