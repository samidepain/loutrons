// Identité : couleurs des thèmes, couleur de lancement, polices et icônes.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const lire = f => readFileSync(new URL('../' + f, import.meta.url), 'utf8');
const html = lire('index.html');
const enCache = new Set([...lire('sw.js').match(/const FILES = \[([\s\S]*?)\];/)[1].matchAll(/'([^']+)'/g)].map(m => m[1]));
// Variables d'un bloc CSS : { '--bg': '#000000', … }
const vars = bloc => Object.fromEntries([...bloc.matchAll(/(--[\w-]+):\s*([^;]+);/g)].map(m => [m[1], m[2].trim()]));
const clair = vars(html.match(/\n:root\{([\s\S]*?)\n\}/)[1]);
const sombreAuto = vars(html.match(/:root:not\(\[data-theme="light"\]\)\{([\s\S]*?)\}\}/)[1]);
const sombreChoisi = vars(html.match(/:root\[data-theme="dark"\]\{([\s\S]*?)\n\}/)[1]);

test('les deux blocs du thème sombre ont les mêmes valeurs, et chaque couleur du thème clair y est redéfinie', () => {
  assert.deepEqual(sombreAuto, sombreChoisi);
  const couleurs = Object.keys(clair).filter(k => /^(#|rgba?\()/.test(clair[k]));
  assert.deepEqual(couleurs.filter(k => !(k in sombreAuto)), []);
});

test('la couleur de lancement est celle du fond de chaque thème (balises, manifeste, render.js)', () => {
  assert.equal(clair['--bg'], '#FFFFFF');
  assert.equal(sombreAuto['--bg'], '#000000');
  const metas = Object.fromEntries([...html.matchAll(/<meta name="theme-color" content="([^"]+)" media="\(prefers-color-scheme: (\w+)\)">/g)].map(m => [m[2], m[1]]));
  assert.deepEqual(metas, { light: '#FFFFFF', dark: '#000000' });
  const man = JSON.parse(lire('manifest.webmanifest'));
  assert.equal(man.background_color, '#000000');
  assert.equal(man.theme_color, '#000000');
  assert.match(lire('js/render.js'), /const THEME_COLORS = \{ light:'#FFFFFF', dark:'#000000' \};/);
});

test('chaque police déclarée dans index.html existe et est mise en cache par sw.js', () => {
  const polices = [...html.matchAll(/url\((fonts\/[^)]+)\)/g)].map(m => m[1]);
  assert.ok(polices.length > 0);
  assert.deepEqual(polices.filter(f => !existsSync(new URL('../' + f, import.meta.url)) || !enCache.has(f)), []);
});

test('seul « LOUTRONS » est mis en capitales par le CSS', () => {
  const regles = [...html.matchAll(/([^{}]+)\{[^}]*text-transform:\s*uppercase/g)].map(m => m[1].trim());
  assert.deepEqual(regles, ['.brand']);
});

test('les icônes ont la taille annoncée (manifeste, iPhone, en-tête, Émile)', () => {
  const taille = f => { const b = readFileSync(new URL('../' + f, import.meta.url)); return [b.readUInt32BE(16), b.readUInt32BE(20)]; };
  for (const i of JSON.parse(lire('manifest.webmanifest')).icons) assert.deepEqual(taille(i.src), i.sizes.split('x').map(Number), i.src);
  assert.deepEqual(taille('icons/apple-touch-icon.png'), [180, 180]);
  assert.deepEqual(taille('icons/logo.png'), [512, 512]);
  assert.deepEqual(taille('icons/emile.png'), [128, 128]);
  assert.deepEqual(taille('icons/favicon-32.png'), [32, 32]);
});

test('l’ancienne palette (crème, anthracite, marron, beige) a disparu', () => {
  const anciennes = ['#FAF5EC', '#120F10', '#8A4B1F', '#F3C98B', '#FE980B', '#D97000', '#A65200'];
  const textes = [html, lire('manifest.webmanifest'), lire('js/render.js')].join('\n').toUpperCase();
  assert.deepEqual(anciennes.filter(c => textes.includes(c)), []);
});
