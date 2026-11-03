// Conseils d'Émile : une croix les ferme, et un conseil fermé ne revient que si sa clé change.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { emile, hey } from '../js/emile.js';
import { donnees, docs, reglages } from './aide.js';

test('conseil avec une clé : croix, puis plus rien une fois fermé ; nouvelle clé : il revient', () => {
  donnees(docs(reglages({ sex: 'f' })));
  const h = emile('<p>Bravo</p>', { key: 'week:2026-11-02:Progression' });
  assert.match(h, /class="emile-x" data-act="emile-x" data-v="week:2026-11-02:Progression"/);
  donnees(docs(reglages({ sex: 'f', dismissed: { 'week:2026-11-02:Progression': '2026-11-03' } })));
  assert.equal(emile('<p>Bravo</p>', { key: 'week:2026-11-02:Progression' }), '');
  assert.notEqual(emile('<p>Bravo</p>', { key: 'week:2026-11-09:Progression' }), '');
  assert.equal(hey('Tu suis le plan.'), 'Loutronne, tu suis le plan.');
});

test('croix qui lance une action (fermer le résumé) ; sans clé ni action : pas de croix', () => {
  donnees(docs(reglages()));
  assert.match(emile('<p>Séance</p>', { close: 'close-summary' }), /data-act="close-summary"/);
  assert.doesNotMatch(emile('<p>Accueil</p>'), /emile-x/);
});
