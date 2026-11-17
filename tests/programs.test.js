// Programmes enregistrés : changer de programme actif ne supprime rien, et revenir à un programme le retrouve tel qu'il était.
import { test, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { allTpl, perWeekOf, programOf, programRotation, rotationOf, savedPrograms, savedTplCount, saveTpl, settings, switchProgram, tplDef } from '../js/data.js';
import { S } from '../js/store.js';
import { donnees, jour, reglages, docs } from './aide.js';

afterEach(() => mock.timers.reset());

const perso = (id, name) => ({ ['p_' + id]: { name, focus: '', items: [{ ex: 'ua_bench' }] } });
const ids = () => allTpl().map(t => t.id);

test('créer un programme : l’ancien est enregistré avec sa rotation et son objectif, ses séances créées ne sont plus affichées mais restent', () => {
  jour('2026-11-04');
  donnees(docs(reglages({ rotation: ['LA', 'UA', 'perso1'], rotOff: ['UB', 'LB'], perWeek: 5 }), perso('perso1', 'Ma séance')));
  const g = switchProgram({ name: 'Prise de masse' }, 3);
  assert.equal(g.base, null); assert.equal(programOf().name, 'Prise de masse');
  assert.deepEqual(ids(), []); assert.equal(perWeekOf(), 3);
  assert.equal(S.docs.get('p_perso1').name, 'Ma séance'); // jamais supprimée
  assert.equal(S.docs.get('p_perso1').prog, 'exemple');
  const [old] = savedPrograms();
  assert.deepEqual([old.id, old.name, old.perWeek], ['exemple', 'Programme exemple', 5]);
  assert.deepEqual(old.rotation, ['LA', 'UA', 'perso1']);
  assert.equal(savedTplCount(old), 5);
});

test('revenir à un programme enregistré : ses séances, sa rotation et son objectif reviennent ; celui qu’on quitte est enregistré à son tour', () => {
  jour('2026-11-04');
  donnees(docs(reglages({ rotation: ['LA', 'UA', 'perso1'], rotOff: ['UB', 'LB'], perWeek: 5 }), perso('perso1', 'Ma séance')));
  const a = switchProgram({ name: 'Prise de masse' }, 3);
  saveTpl({ id: 'perso2', name: 'Jambes', focus: '', items: [{ ex: 'la_hack' }] });
  assert.deepEqual(ids(), ['perso2']);
  switchProgram({ id: 'exemple' });
  assert.equal(programOf().base, 'exemple');
  assert.deepEqual(rotationOf(), ['LA', 'UA', 'perso1']); assert.equal(perWeekOf(), 5);
  assert.deepEqual(ids().sort(), ['LA', 'LB', 'UA', 'UB', 'perso1']);
  assert.deepEqual(savedPrograms().map(p => p.name), ['Prise de masse']);
  assert.equal(tplDef('perso2').name, 'Jambes'); // toujours lisible pour l'historique
  switchProgram({ id: a.id });
  assert.deepEqual(ids(), ['perso2']); assert.equal(perWeekOf(), 3);
  assert.deepEqual(savedPrograms().map(p => p.id), ['exemple']);
});

test('deux programmes créés ne mélangent pas leurs séances, même si le premier date d’avant les programmes enregistrés (sans identifiant)', () => {
  jour('2026-11-04');
  donnees(docs(reglages({ program: { base: null, name: 'Ancien', days: [] } }), perso('a1', 'A1'), perso('a2', 'A2')));
  assert.deepEqual(ids(), ['a1', 'a2']);
  switchProgram({ name: 'Nouveau' }, 4);
  saveTpl({ id: 'n1', name: 'N1', focus: '', items: [{ ex: 'ua_bench' }] });
  assert.deepEqual(ids(), ['n1']);
  const old = savedPrograms()[0];
  assert.equal(old.name, 'Ancien'); assert.deepEqual(old.rotation, ['a1', 'a2']);
  switchProgram({ id: old.id });
  assert.deepEqual(ids(), ['a1', 'a2']); assert.equal(programOf().name, 'Ancien');
});

test('choisir un programme type déjà suivi le reprend au lieu d’en créer un double ; choisir le programme actif ne change rien', () => {
  jour('2026-11-04');
  donnees(docs(reglages({ rotation: ['UB', 'UA'], rotOff: ['LA', 'LB'], perWeek: 2 })));
  switchProgram({ base: 'fullbody' }, 3);
  assert.deepEqual(rotationOf(), ['FA', 'FB', 'FC']);
  switchProgram({ base: 'fullbody' }, 6);
  assert.equal(perWeekOf(), 3); assert.equal(savedPrograms().length, 1);
  switchProgram({ base: 'exemple' }, 6);
  assert.deepEqual(rotationOf(), ['UB', 'UA']); assert.equal(perWeekOf(), 2);
  assert.deepEqual(savedPrograms().map(p => p.id), ['fullbody']);
  assert.equal(settings().programs.length, 1);
});

test('« Revenir à l’ordre du programme » garde les séances créées du programme repris', () => {
  jour('2026-11-04');
  donnees(docs(reglages({ program: { id: 'g1', base: null, name: 'Perso', days: [] } }), { p_a1: { name: 'A1', focus: '', items: [{ ex: 'ua_bench' }], prog: 'g1' } }, perso('a2', 'A2'), { p_b1: { name: 'B1', focus: '', items: [{ ex: 'ua_bench' }], prog: 'g2' } }));
  assert.deepEqual(ids(), ['a1', 'a2']);
  const r = programRotation(null, 'g1');
  assert.deepEqual(r.rotation.sort(), ['a1', 'a2']);
});
