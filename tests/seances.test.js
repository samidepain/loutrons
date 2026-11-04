// Séances : repos lisible, durée estimée (valeurs tapées, installation, montée en charge), cardio.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fmtRest } from '../js/util.js';
import { BASE_EX, BASE_TPL } from '../js/library.js';
import { tplEst } from '../js/data.js';
import { computeTarget, initItem, lastCardio } from '../js/engine.js';
import { donnees, docs, reglages } from './aide.js';

test('repos : « 45 s », « 1 min 30 », « 2 min »', () => {
  assert.deepEqual([45, 60, 90, 120, 150, 180].map(fmtRest), ['45 s', '1 min', '1 min 30', '2 min', '2 min 30', '3 min']);
});

test('durée estimée : les valeurs tapées dans l’éditeur sont des nombres, pas du texte collé', () => {
  donnees(docs(reglages()));
  // 3 séries × (45 s + 90 s) + 2 min d'installation + 4 min de montée en charge = 12 min 45 s
  assert.equal(tplEst({ items: [{ ex: 'lib_bench', sets: '3', rest: '90' }] }), 13);
  assert.equal(tplEst({ items: [{ ex: 'lib_bench', sets: 3, rest: 90 }] }), 13);
  // Isolation : pas de montée en charge ; cardio : sa durée et 1 min d'installation
  assert.equal(tplEst({ items: [{ ex: 'ub_rope', sets: 3, rest: 90 }] }), 9);
  assert.equal(tplEst({ items: [{ ex: 'ex_rower', lo: '15' }] }), 16);
  // Séances de départ : sous 1 h 30
  Object.values(BASE_TPL).forEach(t => assert.ok(tplEst(t) <= 90, t.name + ' : ' + tplEst(t) + ' min'));
});

test('cardio : durée prévue, allure de la dernière fois, rien dans le volume par muscle', () => {
  const w0 = { date: '2026-10-20', status: 'terminée', startedAt: 1, items: [{ ex: 'ex_rower', kind: 'cardio' }], ex: { ex_rower: { level: 'fast', sets: [{ min: '12', km: '2,9', done: true }] } } };
  donnees(docs(reglages(), ['w_20261020_a', w0]));
  const e = Object.assign({ id: 'ex_rower' }, BASE_EX.ex_rower);
  const t = computeTarget(e, { deload: false });
  assert.deepEqual([t.type, t.min], ['cardio', 15]);
  assert.deepEqual(lastCardio('ex_rower'), { date: '2026-10-20', at: 1, min: 12, km: 2.9, level: 'fast' });
  const w = { id: 'w_x', targets: {}, ex: {} };
  initItem(w, { ex: 'ex_rower' }, { deload: false });
  assert.equal(w.ex.ex_rower.level, 'fast');
  assert.deepEqual(w.ex.ex_rower.sets, [{ min: null, km: null, done: false }]);
});

test('vélo d’appartement : paliers du Compendium 2024 de 50 à 229 W ; première fois : allure « Modéré »', () => {
  ['ex_bike', 'ex_recumbent'].forEach(id => assert.deepEqual(BASE_EX[id].levels.map(l => [l[0], l[3]]), [['easy', 4.0], ['mod', 6.0], ['firm', 8.0], ['hard', 10.3], ['fast', 10.8]]));
  donnees(docs(reglages()));
  const w = { id: 'w_x', targets: {}, ex: {} };
  initItem(w, { ex: 'ex_bike' }, { deload: false });
  assert.equal(w.ex.ex_bike.level, 'mod');
  initItem(w, { ex: 'ex_elliptical' }, { deload: false });
  assert.equal(w.ex.ex_elliptical.level, 'mod');
});
