// Chaque module importe ce qu'il utilise, et n'importe que ce qui existe (vérification par lecture du code, sans navigateur).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname, relative, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const racine = join(dirname(fileURLToPath(import.meta.url)), '..', 'js');
const fichiers = [];
(function lire(dossier){ for (const e of readdirSync(dossier, { withFileTypes: true })) { const p = join(dossier, e.name); if (e.isDirectory()) lire(p); else if (e.name.endsWith('.js')) fichiers.push(p); } })(racine);

// Retire chaînes et commentaires (les rares expressions régulières contenant des guillemets sont neutralisées d'abord)
function sansTexte(code){
  code = code.replace(/\/\[&<>"']\/g/g, '/RX/').replace(/\/\[",;\\n\]\//g, '/RX/').replace(/\/"\/g/g, '/RX/');
  let out = '', i = 0;
  while (i < code.length) {
    const c = code[i];
    if (c === '"' || c === "'" || c === '`') { const q = c; i++; while (i < code.length && code[i] !== q) i += code[i] === '\\' ? 2 : 1; i++; out += ' "" '; continue; }
    if (code.startsWith('//', i)) { while (i < code.length && code[i] !== '\n') i++; continue; }
    if (code.startsWith('/*', i)) { i = code.indexOf('*/', i) + 2; continue; }
    out += c; i++;
  }
  return out;
}

const modules = fichiers.map(f => {
  const code = readFileSync(f, 'utf8');
  const exports = new Set([...code.matchAll(/^export (?:async )?(?:function|const|let) ([\w$]+)/gm)].map(m => m[1]));
  for (const m of code.matchAll(/^export const [\w$]+ = .*?, ([\w$]+) = \(\) =>/gm)) exports.add(m[1]);
  for (const m of code.matchAll(/^export const .*$/gm)) for (const n of m[0].matchAll(/, ([\w$]+) = \(\) =>/g)) exports.add(n[1]);
  const imports = [...code.matchAll(/^import \{ ([^}]+) \} from '([^']+)';/gm)].map(m => ({ noms: m[1].split(',').map(s => s.trim()), de: normalize(join(dirname(f), m[2])) }));
  const locaux = new Set([...code.matchAll(/(?:function|const|let|var)\s+([\w$]+)/g)].map(m => m[1]));
  // Paramètres : function f(a, b), (a, b) => et a =>
  for (const m of code.matchAll(/function\s*[\w$]*\s*\(([^)]*)\)|\(([^()]*)\)\s*=>|([\w$]+)\s*=>/g)) (m[1] || m[2] || m[3] || '').split(',').forEach(x => { const n = x.trim().split('=')[0].trim(); if (/^[\w$]+$/.test(n)) locaux.add(n); });
  return { f, nom: relative(racine, f), code: sansTexte(code), exports, imports, locaux };
});
const parNom = new Map(modules.map(m => [m.f, m]));
const tousExports = new Map(); modules.forEach(m => m.exports.forEach(n => tousExports.set(n, m.nom)));

test('chaque import existe dans le module visé', () => {
  const erreurs = [];
  modules.forEach(m => m.imports.forEach(i => {
    const cible = parNom.get(i.de);
    if (!cible) { erreurs.push(m.nom + ' : module introuvable ' + i.de); return; }
    i.noms.forEach(n => { if (!cible.exports.has(n)) erreurs.push(m.nom + ' : « ' + n + ' » n’est pas exporté par ' + cible.nom); });
  }));
  assert.deepEqual(erreurs, []);
});

test('chaque module importe les fonctions des autres modules qu’il utilise', () => {
  const erreurs = [];
  modules.forEach(m => {
    const importes = new Set(m.imports.flatMap(i => i.noms));
    for (const r of m.code.matchAll(/(?<![\w$])([A-Za-z_$][\w$]*)/g)) {
      const n = r[1]; const avant = m.code.slice(Math.max(0, r.index - 3), r.index);
      if (!tousExports.has(n) || m.exports.has(n) || m.locaux.has(n) || importes.has(n)) continue;
      if (avant.endsWith('.') && !avant.endsWith('...')) continue; // propriété : objet.nom
      const apres = m.code.slice(r.index + n.length).trimStart()[0]; const prec = m.code.slice(0, r.index).trimEnd().slice(-1);
      if (apres === ':' && (prec === '{' || prec === ',')) continue; // clé d'objet { nom: … }
      erreurs.push(m.nom + ' utilise « ' + n + ' » sans l’importer de ' + tousExports.get(n));
    }
  });
  assert.deepEqual([...new Set(erreurs)], []);
});

test('chaque module a une syntaxe valide (sinon l’appli ne se charge pas)', () => {
  const erreurs = fichiers.filter(f => spawnSync(process.execPath, ['--check', f], { encoding: 'utf8' }).status !== 0).map(f => relative(racine, f));
  assert.deepEqual(erreurs, []);
});
