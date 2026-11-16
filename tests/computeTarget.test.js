// Moteur de progression : objectif de chaque exercice (règles décrites dans CLAUDE.md et dans « La science »).
import { test, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { computeTarget, targetRIR } from '../js/engine.js';
import { exDef, weekInfo } from '../js/data.js';
import { today } from '../js/util.js';
import { donnees, jour, reglages, seance, docs } from './aide.js';

afterEach(() => mock.timers.reset());

// Objectif du jour pour un exercice de la bibliothèque
const objectif = id => computeTarget(exDef(id), weekInfo(today()));

// Hack squat : bas du corps, 3 × 5-8, palier 5 kg, sollicite le genou. RDL : bas du corps, 3 × 6-8, palier 2,5 kg.
// Élévations latérales : isolation, 3 × 12-15, palier 1 kg. Tractions : poids du corps + lest, 4 × 5-7, palier 1,25 kg.

test('première fois : calibration', () => {
  jour('2026-09-23'); donnees(docs(reglages()));
  const t = objectif('la_hack');
  assert.equal(t.type, 'calib');
  assert.equal(t.kg, null);
  assert.deepEqual(t.reps, [5, 5, 5]);
  assert.equal(t.rir, 2);
});

test('haut de fourchette deux séances de suite : +5 % sur un gros exercice du bas du corps', () => {
  jour('2026-09-23');
  donnees(docs(reglages(),
    seance('2026-09-14', { la_hack: { kg: 100, reps: [8, 8, 8], rir: 1 } }),
    seance('2026-09-21', { la_hack: { kg: 100, reps: [8, 8, 8], rir: 1 } })));
  const t = objectif('la_hack');
  assert.equal(t.type, 'up');
  assert.equal(t.kg, 105);
  assert.equal(t.label, '+5 kg');
  // Epley : 100 kg pour 8 reps + 1 en réserve = 130 kg ; à 105 kg avec 2 en réserve → 5 reps
  assert.deepEqual(t.reps, [5, 5, 5]);
  assert.equal(t.rir, 2);
});

test('haut de fourchette une seule fois mais avec 2 reps en réserve : hausse tout de suite', () => {
  jour('2026-09-23');
  donnees(docs(reglages(), seance('2026-09-21', { la_rdl: { kg: 80, reps: [8, 8, 8], rir: 2 } })));
  const t = objectif('la_rdl');
  assert.equal(t.type, 'up');
  assert.equal(t.kg, 85); // 5 % de 80 = 4, arrondi au palier de 2,5 → 5
  assert.deepEqual(t.reps, [6, 6, 6]);
});

test('haut de fourchette une seule fois avec 1 rep en réserve : à confirmer', () => {
  jour('2026-09-23');
  donnees(docs(reglages(), seance('2026-09-21', { la_hack: { kg: 100, reps: [8, 8, 8], rir: 1 } })));
  const t = objectif('la_hack');
  assert.equal(t.type, 'confirm');
  assert.equal(t.kg, 100);
  assert.deepEqual(t.reps, [8, 8, 8]);
});

test('isolation : hausse d’au moins un palier, même quand 2 % arrondi donne 0', () => {
  jour('2026-09-23');
  donnees(docs(reglages(), seance('2026-09-21', { ua_lat: { kg: 10, reps: [15, 15, 15], rir: 2 } })));
  const t = objectif('ua_lat');
  assert.equal(t.type, 'up');
  assert.equal(t.kg, 11);
  assert.equal(t.label, '+1 kg');
  assert.equal(t.rir, 1);
});

test('3 reps en réserve ou plus : haut de la plage (10 % sur un gros exercice du bas du corps)', () => {
  jour('2026-09-23');
  donnees(docs(reglages(), seance('2026-09-21', { la_hack: { kg: 100, reps: [8, 8, 8], rir: 3 } })));
  const t = objectif('la_hack');
  assert.equal(t.type, 'up');
  assert.equal(t.kg, 110);
});

test('poids du corps : le pourcentage porte sur le poids de corps plus le lest', () => {
  jour('2026-09-23');
  donnees(docs(reglages(),
    { 'b_2026-09-20': { date: '2026-09-20', weight: 80 } },
    seance('2026-09-21', { ua_pull: { kg: 0, reps: [7, 7, 7, 7], rir: 2 } })));
  const t = objectif('ua_pull');
  assert.equal(t.type, 'up');
  assert.equal(t.kg, 2.5); // 2,5 % de 80 kg = 2 kg, arrondi au palier de 1,25 → 2,5 kg de lest
  assert.match(t.text, /du poids total avec ton corps/);
});

test('charge trop lourde : nouvelle charge d’après la force estimée', () => {
  jour('2026-09-23');
  donnees(docs(reglages(), seance('2026-09-21', { la_hack: { kg: 100, reps: [4, 4, 3], rir: 0 } })));
  const t = objectif('la_hack');
  assert.equal(t.type, 'down');
  assert.equal(t.kg, 85); // 1RM estimé 110 kg ; pour 5 reps + 2 en réserve : 89 kg, arrondi au palier inférieur
  assert.equal(t.label, '−15 kg');
  assert.deepEqual(t.reps, [5, 5, 5]);
});

test('stagnation sur 3 séances à la même charge : −10 %, sans citer d’étude (règle de terrain)', () => {
  jour('2026-09-23');
  donnees(docs(reglages(),
    seance('2026-09-14', { la_hack: { kg: 100, reps: [7, 7, 7], rir: 1 } }),
    seance('2026-09-17', { la_hack: { kg: 100, reps: [7, 7, 7], rir: 1 } }),
    seance('2026-09-21', { la_hack: { kg: 100, reps: [7, 7, 7], rir: 1 } })));
  const t = objectif('la_hack');
  assert.equal(t.type, 'reset');
  assert.equal(t.kg, 90);
  assert.doesNotMatch(t.text, /étude|et al\./);
});

test('reps en plus : +1 sans réserve notée, +2 avec 3 en réserve, 0 à l’échec', () => {
  jour('2026-09-23');
  const cas = [[null, 'reps', [7, 7, 7]], [3, 'reps', [8, 8, 8]], [0, 'hold', [6, 6, 6]]];
  cas.forEach(([rir, type, reps]) => {
    donnees(docs(reglages(), seance('2026-09-21', { la_hack: { kg: 100, reps: [6, 6, 6], rir } })));
    const t = objectif('la_hack');
    assert.equal(t.type, type, 'réserve ' + rir);
    assert.equal(t.kg, 100);
    assert.deepEqual(t.reps, reps, 'réserve ' + rir);
  });
});

test('semaine 6 : décharge, même charge et environ 1/3 de séries en moins', () => {
  jour('2026-10-14');
  donnees(docs(reglages(), seance('2026-10-05', { la_hack: { kg: 100, reps: [7, 7, 7], rir: 2 } })));
  const t = objectif('la_hack');
  assert.equal(t.type, 'deload');
  assert.equal(t.kg, 100);
  assert.equal(t.sets, 2);
  assert.equal(t.rir, 3);
});

test('genou au-dessus de 3/10 ces 10 jours : pas de hausse sur un exercice qui sollicite le genou, seulement avec le module genou', () => {
  jour('2026-09-23');
  const base = [
    seance('2026-09-14', { la_hack: { kg: 100, reps: [8, 8, 8], rir: 1 } }),
    seance('2026-09-21', { la_hack: { kg: 100, reps: [8, 8, 8], rir: 1 } }),
    { 'k_2026-09-20': { date: '2026-09-20', stairs: 4 } }];
  donnees(docs(reglages({ modules: { knee: true, jumps: false, sport: false } }), ...base));
  const avec = objectif('la_hack');
  assert.equal(avec.type, 'hold');
  assert.equal(avec.kg, 100);
  donnees(docs(reglages(), ...base));
  assert.equal(objectif('la_hack').type, 'up');
});

test('sauts : suspendus si le genou dépasse 3/10, pas de sauts une semaine chargée, moitié des séries en décharge', () => {
  const options = { knee: true, jumps: true, sport: true };
  jour('2026-09-23');
  donnees(docs(reglages({ modules: options }), { 'k_2026-09-22': { date: '2026-09-22', stairs: 5 } }));
  assert.equal(objectif('la_cmj').type, 'skip');
  donnees(docs(reglages({ modules: options, sport: { name: 'Basket', train: [1, 4], match: [6] }, busy: { '2026-09-21': true } })));
  const charge = objectif('la_cmj');
  assert.equal(charge.type, 'skip');
  assert.match(charge.text, /Semaine chargée en basket/);
  jour('2026-10-14'); donnees(docs(reglages({ modules: options })));
  const dech = objectif('la_cmj');
  assert.equal(dech.type, 'plyo');
  assert.equal(dech.sets, 2); // 3 séries → 2
});

test('reps en réserve visées : 1 en isolation, 2 sur les gros exercices, 1 en semaine 5 sauf exercices genou (module genou)', () => {
  donnees(docs(reglages()));
  const s3 = { bw: 3 }, s5 = { bw: 5 };
  assert.equal(targetRIR(exDef('ua_lat'), s3), 1);
  assert.equal(targetRIR(exDef('la_rdl'), s3), 2);
  assert.equal(targetRIR(exDef('la_rdl'), s5), 1);
  assert.equal(targetRIR(exDef('la_hack'), s5), 1); // module genou désactivé
  donnees(docs(reglages({ modules: { knee: true, jumps: false, sport: false } })));
  assert.equal(targetRIR(exDef('la_hack'), s5), 2);
});
