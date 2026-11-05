// Semaines variables : rotation des séances, objectif de la semaine, jours prévus, calendrier, dépense et volume prévus.
import { test, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { blockRange, blockStarts, daySummary, exDef, lastSessionGap, needToday, nextSession, perWeekOf, plannedSessions, programRotation, rotationOf, rotationWith, weekInfo, weekProgress } from '../js/data.js';
import { blockReport, computeTarget, fatigueCheck, musclePlanned } from '../js/engine.js';
import { dayEnergy } from '../js/energy.js';
import { donnees, jour, reglages, seance, docs } from './aide.js';

afterEach(() => mock.timers.reset());

const exemple = extra => reglages(extra); // programme exemple : UA, LA, UB, LB ; jours lundi, mardi, vendredi, dimanche
const faite = (date, tpl, extra) => seance(date, { ua_bench: { kg: 50, reps: [8, 8, 8] } }, Object.assign({ tpl }, extra));

test('rotation déduite du planning par jour : ordre lundi → dimanche, objectif = nombre de jours de séance', () => {
  jour('2026-11-04');
  donnees(docs(exemple()));
  assert.deepEqual(rotationOf(), ['UA', 'LA', 'UB', 'LB']);
  assert.equal(perWeekOf(), 4);
});

test('rotation déduite : doublons retirés, séance supprimée ignorée, séances sans jour hors rotation, objectif entre 2 et 6', () => {
  jour('2026-11-04');
  donnees(docs(exemple({ plan: { 1: { s: 'UA' }, 3: { s: 'UA' }, 5: { s: 'ZZ' } } })));
  assert.deepEqual(rotationOf(), ['UA']); // les séances placées sur aucun jour restaient hors planning : hors rotation
  assert.equal(perWeekOf(), 2);
  donnees(docs(exemple({ plan: Object.fromEntries([0, 1, 2, 3, 4, 5, 6].map(d => [d, { s: 'UA' }])) })));
  assert.equal(perWeekOf(), 6);
});

test('rotation sans planning : ordre du programme, objectif 4 pour le programme exemple, 3 sinon', () => {
  jour('2026-11-04');
  donnees(docs(exemple({ program: { base: 'exemple', name: 'Programme exemple', days: [] } })));
  assert.deepEqual(rotationOf(), ['UA', 'LA', 'UB', 'LB']);
  assert.equal(perWeekOf(), 4);
  donnees(docs(exemple({ program: { base: 'fullbody', name: 'Full body 3 jours', days: [] } })));
  assert.equal(perWeekOf(), 3);
});

test('rotation réglée : ordre choisi, séances non citées à la fin, séances mises de côté retirées', () => {
  jour('2026-11-04');
  donnees(docs(exemple({ rotation: ['UB', 'UA'], perWeek: 3 })));
  assert.deepEqual(rotationOf(), ['UB', 'UA', 'LA', 'LB']);
  assert.equal(perWeekOf(), 3);
  donnees(docs(exemple({ rotOff: ['LA'] })));
  assert.deepEqual(rotationOf(), ['UA', 'UB', 'LB']);
});

test('séance suivante : celle qui suit la dernière séance terminée de la rotation, sinon la première', () => {
  jour('2026-11-04');
  donnees(docs(exemple()));
  assert.equal(nextSession(), 'UA');
  donnees(docs(exemple(), faite('2026-11-02', 'LA')));
  assert.equal(nextSession(), 'UB');
  donnees(docs(exemple(), faite('2026-11-02', 'LB')));
  assert.equal(nextSession(), 'UA');
  donnees(docs(exemple(), faite('2026-11-01', 'UA'), faite('2026-11-03', 'FA')));
  assert.equal(nextSession(), 'LA');
  donnees(docs(exemple({ rotOff: ['UA', 'LA', 'UB', 'LB'] })));
  assert.equal(nextSession(), null);
});

test('avancement de la semaine : séances terminées du lundi au dimanche, rapportées à l’objectif', () => {
  jour('2026-11-04');
  donnees(docs(exemple(), faite('2026-11-01', 'UA'), faite('2026-11-02', 'LA'), faite('2026-11-04', 'UB')));
  assert.deepEqual(weekProgress('2026-11-04'), { done: 2, target: 4 });
});

test('il faut venir aujourd’hui : jour prévu, ou autant de séances restantes que de jours', () => {
  jour('2026-11-04');
  donnees(docs(exemple()));
  assert.equal(needToday('2026-11-04'), false);
  donnees(docs(exemple({ planned: ['2026-11-04'] })));
  assert.equal(needToday('2026-11-04'), true);
  jour('2026-11-07');
  donnees(docs(exemple(), faite('2026-11-02', 'UA'), faite('2026-11-04', 'LA')));
  assert.equal(needToday('2026-11-07'), true);
  jour('2026-11-08');
  donnees(docs(exemple(), faite('2026-11-02', 'UA'), faite('2026-11-04', 'LA'), faite('2026-11-06', 'UB')));
  assert.equal(needToday('2026-11-08'), true);
  donnees(docs(exemple(), faite('2026-11-02', 'UA'), faite('2026-11-04', 'LA'), faite('2026-11-08', 'UB')));
  assert.equal(needToday('2026-11-08'), false);
});

test('jours prévus : la rotation répartie dans l’ordre sur les jours à venir, dates passées ignorées', () => {
  jour('2026-11-04');
  donnees(docs(exemple({ planned: ['2026-11-03', '2026-11-07', '2026-11-05'] }), faite('2026-11-02', 'LA')));
  assert.deepEqual(plannedSessions(), { '2026-11-05': 'UB', '2026-11-07': 'LB' });
});

test('calendrier : séance prévue aujourd’hui si l’objectif n’est pas atteint, et aux jours prévus seulement', () => {
  jour('2026-11-04');
  donnees(docs(exemple(), faite('2026-11-02', 'LA')));
  assert.equal(daySummary('2026-11-04').planned, 'UB');
  assert.equal(daySummary('2026-11-06').planned, null);
  donnees(docs(exemple({ planned: ['2026-11-06'] }), faite('2026-11-02', 'LA')));
  assert.equal(daySummary('2026-11-06').planned, 'UB');
  donnees(docs(exemple({ perWeek: 2 }), faite('2026-11-02', 'LA'), faite('2026-11-03', 'UB')));
  assert.equal(daySummary('2026-11-04').planned, null);
});

test('dépense du jour : pas de séance prévue comptée avant qu’elle commence', () => {
  jour('2026-11-04');
  donnees(docs(exemple({ planned: ['2026-11-04'] }), ['b_2026-11-04', { date: '2026-11-04', weight: 80 }]));
  assert.deepEqual(dayEnergy('2026-11-04').items, []);
  donnees(docs(exemple(), ['b_2026-11-04', { date: '2026-11-04', weight: 80 }], faite('2026-11-04', 'UA', { status: 'en_cours', est: 60 })));
  assert.deepEqual(dayEnergy('2026-11-04').items.map(i => [i.kind, i.active]), [['planned', true]]);
});

test('volume prévu par muscle : séries de la rotation ramenées à l’objectif de la semaine', () => {
  jour('2026-11-04');
  donnees(docs(exemple({ rotation: ['UA', 'LA'], rotOff: ['UB', 'LB'], perWeek: 2 })));
  const deux = musclePlanned();
  donnees(docs(exemple({ rotation: ['UA', 'LA'], rotOff: ['UB', 'LB'], perWeek: 4 })));
  const quatre = musclePlanned();
  assert.ok(deux.Pectoraux > 0);
  assert.equal(quatre.Pectoraux, deux.Pectoraux * 2);
});

test('bilan de bloc : séances prévues = objectif de la semaine × semaines écoulées', () => {
  jour('2026-11-04');
  donnees(docs(exemple({ perWeek: 3 })));
  assert.equal(blockReport(1).planned, 18);
});

// Pauses : jours sans l'exercice (Bosquet et al. 2013 : force presque intacte jusqu'à 4 semaines) ; règles de terrain pour la reprise
const banc = extra => Object.assign({}, exDef('ua_bench'), { id: 'ua_bench', step: 2.5 }, extra);
const cible = (date, extra, ex) => { jour('2026-11-04'); donnees(docs(exemple(extra), seance(date, { ua_bench: { kg: 50, reps: [8, 8, 8], rir: 1 } }))); return computeTarget(ex || banc(), weekInfo('2026-11-04')); };

test('pause : 14 jours sans l’exercice, la progression continue ; 15 et 28 jours, « Reprise » à la même charge', () => {
  assert.notEqual(cible('2026-10-21').type, 'back');
  const a = cible('2026-10-20'); assert.deepEqual([a.type, a.label, a.kg], ['back', 'Reprise', 50]);
  assert.ok(/^Pas fait depuis 15\u00a0jours|^Pas fait depuis 15 jours/.test(a.text));
  const b = cible('2026-10-07'); assert.deepEqual([b.type, b.label, b.kg], ['back', 'Reprise', 50]);
});

test('pause de plus de 28 jours : « Reprise −10 % », au palier inférieur et au moins un palier de moins', () => {
  const a = cible('2026-10-06'); assert.deepEqual([a.type, a.label, a.kg], ['back', 'Reprise −10 %', 45]);
  assert.equal(cible('2026-10-06', {}, banc({ step: 20 })).kg, 40);
  assert.deepEqual(a.reps, [8, 8, 8].map(r => Math.min(Math.max(r, banc().lo), banc().hi)));
});

test('pause au poids du corps sans lest : « Reprise », mêmes reps', () => {
  jour('2026-11-04');
  donnees(docs(exemple(), seance('2026-09-30', { ua_pull: { kg: 0, reps: [6, 6, 6, 6] } })));
  const t = computeTarget(Object.assign({}, exDef('ua_pull'), { id: 'ua_pull' }), weekInfo('2026-11-04'));
  assert.deepEqual([t.type, t.label, t.kg, t.reps[0]], ['back', 'Reprise', 0, 6]);
});

test('pause : un genou sensible garde la priorité (maintien) sur un exercice qui le sollicite', () => {
  jour('2026-11-04');
  donnees(docs(exemple({ modules: { knee: true, jumps: false, sport: false } }), ['k_2026-11-03', { date: '2026-11-03', stairs: 6 }], seance('2026-10-06', { ua_bench: { kg: 50, reps: [8, 8, 8], rir: 1 } })));
  const t = computeTarget(banc({ knee: true }), weekInfo('2026-11-04'));
  assert.equal(t.type, 'hold');
});

const series = (...dates) => dates.map(d => seance(d, { ua_bench: { kg: 50, reps: [8] } }));
test('bloc : nouveau départ au lundi de la reprise après plus de 14 jours sans séance ; numéros qui continuent', () => {
  jour('2026-11-04');
  donnees(docs(exemple(), ...series('2026-09-08', '2026-09-20', '2026-10-04', '2026-10-22', '2026-11-02')));
  assert.deepEqual(blockStarts(), ['2026-09-07', '2026-10-19']);
  assert.deepEqual([weekInfo('2026-10-22').bw, weekInfo('2026-10-22').block, weekInfo('2026-10-22').n], [1, 2, 7]);
  assert.deepEqual([weekInfo('2026-10-01').bw, weekInfo('2026-10-01').block], [4, 1]);
  assert.deepEqual(blockRange(1), { from: '2026-09-07', to: '2026-10-18' });
  assert.equal(blockRange(2).from, '2026-10-19');
});

test('bloc : 14 jours d’écart ne font pas de nouveau départ ; un bloc coupé par une pause compte pour un bloc', () => {
  jour('2026-11-04');
  donnees(docs(exemple(), ...series('2026-09-08', '2026-09-22', '2026-10-06', '2026-10-20', '2026-11-03')));
  assert.deepEqual(blockStarts(), ['2026-09-07']);
  donnees(docs(exemple(), ...series('2026-09-08', '2026-09-16', '2026-10-28')));
  assert.deepEqual(blockStarts(), ['2026-09-07', '2026-10-26']);
  assert.equal(weekInfo('2026-10-28').block, 2);
  assert.deepEqual(blockRange(1), { from: '2026-09-07', to: '2026-10-18' });
});

test('bloc : tant que la personne n’est pas revenue, la semaine en cours est déjà un nouveau départ', () => {
  jour('2026-11-04');
  donnees(docs(exemple(), ...series('2026-09-08', '2026-10-15')));
  assert.equal(weekInfo('2026-11-04').bw, 1);
  assert.equal(lastSessionGap('2026-11-04'), 20);
});

// Corrections après relecture
const maSeance = { p_MY: { name: 'Ma séance', items: [{ ex: 'ua_bench', sets: 3 }] } };
test('changement de programme : la rotation prend l’ordre du nouveau programme, une séance créée reste de côté', () => {
  jour('2026-11-04');
  donnees(docs(exemple({ plan: { 0: { s: 'MY' } } }), maSeance));
  assert.deepEqual(programRotation('fullbody'), { rotation: ['FA', 'FB', 'FC'], rotOff: ['MY'] });
  assert.deepEqual(programRotation(null), { rotation: ['MY'], rotOff: [] });
});

test('séance créée : elle entre à la fin d’une rotation encore déduite du planning d’avant', () => {
  jour('2026-11-04');
  donnees(docs(exemple(), maSeance));
  assert.deepEqual(rotationOf(), ['UA', 'LA', 'UB', 'LB']);
  assert.deepEqual(rotationWith('MY').rotation, ['UA', 'LA', 'UB', 'LB', 'MY']);
  donnees(docs(exemple({ rotation: ['UA', 'LA'] }), maSeance));
  assert.equal(rotationWith('MY'), null);
});

test('séance suivante : une séance ancienne notée avec « sess » compte aussi', () => {
  jour('2026-11-04');
  donnees(docs(exemple(), seance('2026-11-02', { ua_bench: { kg: 50, reps: [8] } }, { sess: 'LA' })));
  assert.equal(nextSession(), 'UB');
});

test('entraînement régulier : un exercice revenu après 15 jours, sans pause de séances, progresse normalement', () => {
  jour('2026-11-04');
  donnees(docs(exemple(), seance('2026-10-20', { ua_bench: { kg: 50, reps: [8, 8, 8], rir: 2 } }), seance('2026-11-01', { ua_curl: { kg: 10, reps: [10] } })));
  assert.notEqual(computeTarget(banc(), weekInfo('2026-11-04')).type, 'back');
});

test('exercice absent plus de 28 jours sans pause de séances : « Reprise » à la même charge, pas de −10 %', () => {
  jour('2026-11-04');
  donnees(docs(exemple(), seance('2026-09-30', { ua_bench: { kg: 50, reps: [8, 8, 8], rir: 2 } }), seance('2026-11-01', { ua_curl: { kg: 10, reps: [10] } })));
  const t = computeTarget(banc(), weekInfo('2026-11-04'));
  assert.deepEqual([t.type, t.label, t.kg], ['back', 'Reprise', 50]);
});

test('fatigue : une baisse prescrite par une reprise après une pause n’est pas une fatigue', () => {
  jour('2026-11-04');
  const ex = kg => ({ ua_bench: { kg, reps: [8, 8, 8] }, ua_lat: { kg: kg / 5, reps: [12, 12, 12] }, ua_curl: { kg: kg / 4, reps: [10, 10, 10] } });
  const back = { ua_bench: { type: 'back' }, ua_lat: { type: 'back' }, ua_curl: { type: 'back' } };
  donnees(docs(exemple(), seance('2026-09-28', ex(50)), seance('2026-11-03', ex(45), { targets: back })));
  assert.equal(fatigueCheck(), null);
});

test('bilan d’un bloc coupé par une pause : séances prévues comptées jusqu’à sa dernière séance', () => {
  jour('2026-11-04');
  donnees(docs(exemple(), ...series('2026-09-08', '2026-09-16', '2026-10-28')));
  assert.equal(blockReport(1).planned, 8);
});
