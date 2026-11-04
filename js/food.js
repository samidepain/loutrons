// Journal des repas : aliments (table Ciqual, Open Food Facts, aliments créés), repas du jour et totaux. Sans affichage.
// Documents : m_<date> (repas du jour : { date, items: [{ id, meal, key, name, brand, g, per100 }] }),
// f_<code> (produit scanné, gardé sur le téléphone) et f_own<id> (aliment créé). Valeurs pour 100 g : { kcal, p, c, s, f, sf, fib, salt }.
import { norm } from './util.js';
import { S } from './store.js';

export const MEALS = [['breakfast', 'Petit-déjeuner'], ['lunch', 'Déjeuner'], ['dinner', 'Dîner'], ['snack', 'Collations']];
export const NUTRIENTS = [['kcal', 'Calories', 'kcal'], ['p', 'Protéines', 'g'], ['c', 'Glucides', 'g'], ['s', 'dont sucres', 'g'], ['f', 'Lipides', 'g'], ['sf', 'dont saturés', 'g'], ['fib', 'Fibres', 'g'], ['salt', 'Sel', 'g']];
const KEYS = NUTRIENTS.map(n => n[0]);
// Repères pour la journée : fibres (ANSES 2016), sucres hors lactose (ANSES 2016), acides gras saturés (ANSES 2011), sel (OMS 2012)
export const LIMITS = { fib:30, s:100, sfPct:0.12, salt:5 };

const numOrNull = v => { const n = typeof v === 'string' ? Number(v.replace(',', '.')) : v; return typeof n === 'number' && isFinite(n) && n >= 0 ? n : null; };
// Produit d'Open Food Facts (réponse de /api/v2/product) : null si introuvable ou sans calories
export function fromOff(json, code){
  const p = json && json.status === 1 && json.product; if (!p) return null;
  const n = p.nutriments || {};
  const per100 = { kcal:null, p:numOrNull(n.proteins_100g), c:numOrNull(n.carbohydrates_100g), s:numOrNull(n.sugars_100g), f:numOrNull(n.fat_100g), sf:numOrNull(n['saturated-fat_100g']), fib:numOrNull(n.fiber_100g), salt:numOrNull(n.salt_100g) };
  const kj = numOrNull(n['energy-kj_100g']); let kcal = numOrNull(n['energy-kcal_100g']); let fixed = null;
  if (kcal == null && kj != null) kcal = Math.round(kj / 4.184);
  else if (kcal != null) { const k = plausibleKcal(kcal, kj, per100); if (k == null) return null; if (k !== kcal) { kcal = k; fixed = 'kcal'; } }
  if (kcal == null) return null;
  per100.kcal = kcal;
  const name = String(p.product_name_fr || p.product_name || '').trim() || 'Produit ' + code;
  const brand = String(p.brands || '').split(',')[0].trim();
  const serving = numOrNull(p.serving_quantity);
  const out = { key:'off:' + code, src:'off', code: String(code), name, brand, per100, serving: serving && serving > 0 && serving < 2000 ? serving : null };
  if (fixed) out.fixed = fixed;
  return out;
}
// Open Food Facts est rempli par des bénévoles : des kJ sont parfois notés à la place des kcal (4,184 fois trop).
// Repères : 900 kcal pour 100 g au plus (lipides purs) ; calories recalculées depuis les nutriments (règlement UE 1169/2011 :
// 4 kcal par g de protéines et de glucides, 9 de lipides, 2 de fibres), à 20 % ou 20 kcal près. L'alcool (7 kcal par g)
// et les édulcorants éloignent les calories des nutriments : on ne corrige que si une autre valeur colle aux nutriments.
// Renvoie les calories à garder, ou null si elles sont impossibles et sans correction possible.
function plausibleKcal(kcal, kj, v){
  const est = v.p != null && v.c != null && v.f != null ? 4 * v.p + 4 * v.c + 9 * v.f + 2 * (v.fib || 0) : null;
  const near = x => est == null || Math.abs(x - est) <= Math.max(20, 0.2 * est);
  if (kcal <= 900 && near(kcal)) return kcal;
  const fromKj = kj != null ? kj / 4.184 : null;
  if (fromKj != null && fromKj <= 900 && near(fromKj)) return Math.round(fromKj);
  if (est != null && near(kcal / 4.184)) return Math.round(kcal / 4.184);
  return kcal <= 900 ? kcal : null;
}
// Journée assez notée pour compter dans une moyenne : au moins 2 repas (règle de l'appli), pour qu'un café seul ne fasse pas croire
// qu'on a très peu mangé
export const fullDay = doc => new Set((doc.items || []).map(i => i.meal)).size >= 2;
// Aliment de la table Ciqual : [code, nom, kcal, p, c, s, f, sf, fib, salt] (null : valeur inconnue)
export const fromCiqual = r => ({ key:'ciq:' + r[0], src:'ciq', name:r[1], brand:'', per100:{ kcal:r[2], p:r[3], c:r[4], s:r[5], f:r[6], sf:r[7], fib:r[8], salt:r[9] }, serving:null });
// Valeurs pour une quantité en grammes ; une valeur inconnue reste inconnue
export function scale(per100, g){ const o = {}; KEYS.forEach(k => { o[k] = per100[k] == null ? null : per100[k] * g / 100; }); return o; }
// Totaux d'une liste d'entrées ; missing : nutriments inconnus pour au moins une entrée
export function totals(items){
  const t = {}; const missing = new Set(); KEYS.forEach(k => { t[k] = 0; });
  items.forEach(it => { const v = scale(it.per100, it.g); KEYS.forEach(k => { if (v[k] == null) missing.add(k); else t[k] += v[k]; }); });
  t.missing = [...missing]; return t;
}
export const dayDoc = day => S.docs.get('m_' + day) || { date: day, items: [] };
export function myFoods(){ const out = []; S.docs.forEach((o, id) => { if (id.indexOf('f_') === 0) out.push(Object.assign({ id }, o)); }); return out; }
// Aliments mangés récemment, du plus récent au plus ancien, sans doublon ; g : dernière quantité notée
export function recentFoods(limit){
  const days = []; S.docs.forEach((o, id) => { if (id.indexOf('m_') === 0) days.push(o); });
  days.sort((a, b) => a.date < b.date ? 1 : -1);
  const seen = new Map();
  days.forEach(d => (d.items || []).slice().reverse().forEach(it => { if (!seen.has(it.key)) seen.set(it.key, { key: it.key, src: it.src || it.key.split(':')[0], name: it.name, brand: it.brand || '', per100: it.per100, serving: it.serving || null, portion: it.portion || null, g: it.g }); }));
  return [...seen.values()].slice(0, limit || 20);
}
// Recherche tolérante (accents, majuscules, pluriels) : chaque mot doit commencer un mot du nom, de la marque ou d'un autre nom (alt).
// Les aliments déjà notés ou créés passent avant tout, puis la 2e liste (les recettes) ; puis les noms qui commencent par la recherche,
// les mots écrits tels quels (« pâtes » avant « pâte sablée ») et les noms qui commencent par le premier mot.
export function searchFoods(lists, q, limit){
  const typed = norm(q).split(' ').filter(Boolean);
  const words = typed.map(w => w.length > 3 && w.slice(-1) === 's' ? w.slice(0, -1) : w);
  if (!words.length) return [];
  const qn = words.join(' '); const out = []; const seen = new Set();
  lists.forEach((list, li) => list.forEach(f => {
    if (seen.has(f.key)) return;
    const n = f.n || norm(f.name); const nw = n.split(' '); const all = nw.concat(norm(f.brand).split(' '), f.alt ? f.alt.split(' ') : []);
    if (!words.every(w => all.some(x => x.indexOf(w) === 0))) return;
    seen.add(f.key);
    out.push({ f, r: (n.indexOf(qn) === 0 ? 4 : 0) + (words.every(w => nw.some(x => x.indexOf(w) === 0)) ? 2 : 0) + typed.filter(w => nw.indexOf(w) >= 0).length
      + (nw[0].indexOf(words[0]) === 0 ? 1 : 0) + ([10, 1][li] || 0), len: n.length });
  }));
  return out.sort((a, b) => b.r - a.r || a.len - b.len).slice(0, limit || 40).map(x => x.f);
}
// Code-barres EAN-13, EAN-8 ou UPC-A, avec sa clé de contrôle
export function validBarcode(code){
  const c = String(code || '').replace(/\D/g, ''); if ([8, 12, 13].indexOf(c.length) < 0) return false;
  const d = c.split('').map(Number); const check = d.pop();
  const sum = d.reverse().reduce((a, x, i) => a + x * (i % 2 === 0 ? 3 : 1), 0);
  return (10 - sum % 10) % 10 === check;
}
// Table Ciqual (data/ciqual.json), chargée à la première recherche puis gardée en mémoire ; n : nom sans accents pour la recherche
let ciqual = null;
export function loadCiqual(){
  if (!ciqual) ciqual = fetch('data/ciqual.json').then(r => { if (!r.ok) throw new Error('ciqual'); return r.json(); })
    .then(j => j.foods.map(r => Object.assign(fromCiqual(r), { n: norm(r[1]) })))
    .catch(() => { ciqual = null; return []; });
  return ciqual;
}
