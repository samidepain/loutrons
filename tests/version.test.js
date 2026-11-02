// Le numéro affiché dans Réglages et celui du cache du service worker doivent rester identiques.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { VERSION } from '../js/version.js';

test('même numéro de version dans js/version.js et sw.js', () => {
  const sw = readFileSync(new URL('../sw.js', import.meta.url), 'utf8');
  assert.equal(sw.match(/^const VERSION = '([^']+)';/m)[1], VERSION);
});

test('sw.js met en cache tous les modules de js/', () => {
  const sw = readFileSync(new URL('../sw.js', import.meta.url), 'utf8');
  const enCache = new Set([...sw.matchAll(/'(js\/[^']+\.js)'/g)].map(m => m[1]));
  const dir = new URL('../js/', import.meta.url);
  const fichiers = [];
  const walk = (u, rel) => { for (const e of readdirSync(u, { withFileTypes: true })) { if (e.isDirectory()) walk(new URL(e.name + '/', u), rel + e.name + '/'); else if (e.name.endsWith('.js')) fichiers.push('js/' + rel + e.name); } };
  walk(dir, '');
  assert.deepEqual(fichiers.filter(f => !enCache.has(f)), []);
});

test('chaque fichier mis en cache par sw.js existe (sinon l’installation hors connexion échoue)', () => {
  const sw = readFileSync(new URL('../sw.js', import.meta.url), 'utf8');
  const liste = [...sw.match(/const FILES = \[([\s\S]*?)\];/)[1].matchAll(/'([^']+)'/g)].map(m => m[1]);
  assert.deepEqual(liste.filter(f => !existsSync(new URL('../' + f, import.meta.url))), []);
});
