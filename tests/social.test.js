// Social : ce qu'une séance partagée montre (volume, statistiques au choix, texte).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { docs, donnees, jour, reglages, seance } from './aide.js';
import { S } from '../js/store.js';
import { sessionVolume, shareStats, shareText } from '../js/social.js';

const lue = pair => Object.assign({ id: pair[0] }, S.docs.get(pair[0]));

test('le volume additionne charge × reps des séries validées à la charge, sans le poids du corps', () => {
  jour('2026-11-17');
  // développé couché 60 kg × 8, 8, 6 = 1 320 kg ; tractions au poids du corps : pas comptées
  const a = seance('2026-11-16', { dc: { kg: 60, reps: [8, 8, 6] }, tractions: { kg: 0, reps: [8, 7] } });
  donnees(docs(reglages(), a));
  assert.equal(sessionVolume(lue(a)), 1320);
});

test('une séance sans série à la charge n’a pas de volume, et la statistique n’est pas proposée', () => {
  jour('2026-11-17');
  const a = seance('2026-11-16', { tractions: { kg: 0, reps: [8, 7] } }, { duration: 40 });
  donnees(docs(reglages(), a));
  assert.equal(sessionVolume(lue(a)), null);
  assert.deepEqual(shareStats(lue(a), 0).map(x => x[0]), ['dur', 'ex', 'sets']);
});

test('seules les statistiques que la séance a vraiment sont proposées, et le texte reprend celles qui sont choisies', () => {
  jour('2026-11-17');
  const a = seance('2026-11-16', { dc: { kg: 60, reps: [8, 8, 6] } });
  donnees(docs(reglages(), a));
  // durée non notée, pas de record : ni « durée » ni « record »
  const st = shareStats(lue(a), 0);
  assert.deepEqual(st.map(x => x[0]), ['ex', 'sets', 'vol']);
  assert.deepEqual(shareStats(lue(a), 2).pop(), ['pr', '2', '', 'records']);
  const t = shareText(lue(a), st.filter(x => x[0] !== 'vol'), '  Bonne séance  ');
  assert.equal(t.split('\n')[0], 'Bonne séance');
  assert.match(t, /1 exercice · 3 séries/); assert.doesNotMatch(t, /soulevés/);
});
