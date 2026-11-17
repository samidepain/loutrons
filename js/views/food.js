// Écran Alimentation : journal du jour par repas, et ajout d'un aliment (recherche, code-barres, quantité, création).
import { addDays, capFirst, esc, fmtDate, fmtDateLong, fmtInt, fmtKg, nbsp, num, today } from '../util.js';
import { S } from '../store.js';
import { dayDoc, freshFood, habitualFoods, LIMITS, loadCiqual, mealLabel, MEALS, myFoods, pastMeals, recentFoods, savedMeals, scale, searchFoods, totals, validBarcode } from '../food.js';
import { startScanner } from '../scanner.js';
import { emile, hey } from '../emile.js';
import { dayPlan, nutritionOf } from './goal.js';
import { ownRecipe, recipeFoods } from '../recipes.js';
import { ring } from '../ring.js';
import { gramsOf, measuresFor } from '../measures.js';
import { ic, MEAL_ICON } from '../icons.js';
import { introCard } from './intro.js';
import { swipeRow } from '../swipe.js';

const q1 = x => x == null ? '—' : x < 10 ? fmtKg(Math.round(x * 10) / 10) : fmtInt(x);
// Valeur inconnue : un tiret seul, sans unité
const qg = x => x == null ? '—' : q1(x) + ' g';
const mealName = m => (MEALS.find(x => x[0] === m) || ['', ''])[1];
const dayLabel = d => d === today() ? 'Aujourd’hui' : d === addDays(today(), -1) ? 'Hier' : capFirst(fmtDateLong(d));
// Raccourcis : une ligne avec le nom et le détail, et un « + » rond qui ajoute d'un geste. Aliment : toucher le nom ouvre « Quantité ».
// Calories d'une liste, avec les valeurs actuelles des aliments gardés sur le téléphone (celles qu'un « + » ajoutera)
const kcalOf = items => fmtInt(totals(items.map(freshFood)).kcal) + ' kcal';
// Calories d'aliments déjà notés : leurs valeurs enregistrées, comme le journal
const kcalIn = items => fmtInt(totals(items).kcal) + ' kcal';
const names = items => items.slice(0, 3).map(i => i.name).join(', ') + (items.length > 3 ? '…' : '');
const plusBtn = (act, attrs, label) => '<button type="button" class="plus" data-act="' + act + '"' + attrs + ' aria-label="' + esc(label) + '">+</button>';
// fromRecent : aliment de la liste « Récents » (dernière quantité tous repas confondus), sinon un habituel de ce repas
export function quickFood(food, meal, fromRecent){
  const f = freshFood(food); const at = ' data-v="' + esc(f.key) + '" data-m="' + meal + '"' + (fromRecent ? ' data-l="rec"' : '');
  return '<div class="quick"><button type="button" class="pick" data-act="fd-open"' + at + '><span class="ql"><span class="n">' + esc(f.name) + '</span><span class="m">' + (f.brand ? esc(f.brand) + ' · ' : '') + nbsp(fmtKg(f.g) + ' g · ' + kcalOf([f])) + '</span></span></button>' + plusBtn('fd-plus', at, 'Ajouter ' + f.name) + '</div>';
}
// Repas passé : « Comme hier » dans le journal, « Hier » ou « Lundi 2 nov. » dans la fenêtre d'ajout
// withDate : dans la fenêtre, le nom du bouton donne aussi la date (deux lundis dans les 14 jours restent distincts)
export function quickPast(p, meal, title, day, withDate){
  const lab = mealLabel(p.date, day);
  return '<div class="quick"><div class="pick static"><span class="ql"><span class="n">' + esc(title) + '</span><span class="m">' + esc(names(p.items)) + ' · ' + nbsp(kcalOf(p.items)) + '</span></span></div>'
    + plusBtn('fd-again', ' data-d="' + esc(p.date) + '" data-m="' + meal + '"', 'Ajouter le repas ' + (lab === 'hier' ? 'd’hier' : 'de ' + lab + (withDate ? ' ' + fmtDate(p.date) : ''))) + '</div>';
}
// Repas enregistré : toucher le nom ouvre son détail, « + » ajoute tous ses aliments
function quickSaved(q, meal){
  const n = q.items.length;
  return '<div class="quick"><button type="button" class="pick" data-act="fd-saved" data-v="' + esc(q.id) + '"><span class="ql"><span class="n">' + esc(q.name) + '</span><span class="m">' + nbsp(n + ' aliment' + (n > 1 ? 's' : '') + ' · ' + kcalOf(q.items)) + '</span></span></button>'
    + plusBtn('fd-meal-add', ' data-v="' + esc(q.id) + '" data-m="' + meal + '"', 'Ajouter le repas ' + q.name) + '</div>';
}
const HAB = { breakfast:'au petit-déjeuner', lunch:'au déjeuner', dinner:'au dîner', snack:'en collation' };
const ADD_TO = { breakfast:'au petit-déjeuner', lunch:'au déjeuner', dinner:'au dîner', snack:'aux collations' };
const DEFAULT_NAME = { breakfast:'Mon petit-déjeuner', lunch:'Mon déjeuner', dinner:'Mon dîner', snack:'Ma collation' };
// Repas enregistré : champ du nom (40 caractères au plus), puis ses aliments et le total
// Le nom tapé est gardé dans S.food.nameDraft, pour survivre à un nouvel affichage (par exemple « Supprimer le repas » pendant un renommage)
const nameField = v => '<label class="f"><span>Nom</span><input id="sm-name" maxlength="40" autocomplete="off" value="' + esc(S.food && S.food.nameDraft != null ? S.food.nameDraft : v) + '"></label>';
function mealItems(list){
  const items = list.map(freshFood); const t = totals(items);
  return '<div class="stack sm-list">' + items.map(i => '<p class="sm-item"><span>' + esc(i.name) + '</span><span class="muted num">' + nbsp(fmtKg(i.g) + ' g · ' + kcalOf([i])) + '</span></p>').join('') + '</div>'
    + '<p class="small"><b>' + nbsp('Total : ' + fmtInt(t.kcal) + ' kcal · ' + qg(t.p) + ' de protéines') + '</b></p>';
}
// Aliment noté dans le journal : le toucher ouvre sa quantité, le balayer vers la gauche découvre « Supprimer »
function entryRow(i, day){
  return swipeRow('<button type="button" class="pick" data-act="fd-edit" data-v="' + esc(i.id) + '"><span class="stack" style="gap:2px"><span class="n">' + esc(i.name) + '</span><span class="m">' + (i.brand ? esc(i.brand) + ' · ' : '') + fmtKg(i.g) + ' g</span></span><span class="num">' + fmtInt(scale(i.per100, i.g).kcal || 0) + ' kcal</span></button>', 'fd-swipe-del', esc(i.id), 'Retirer ' + esc(i.name) + ' du journal', ' data-d="' + day + '"');
}
const group = (title, lines) => lines.length ? '<div class="stack qgroup"><span class="label">' + title + '</span>' + lines.join('') + '</div>' : '';
// Fenêtre d'ajout, recherche vide : refaire un repas, tes repas, tes habituels, récents (un groupe vide n'est pas affiché)
function quickGroups(meal, day){
  const past = pastMeals(meal, day).map(p => { const lab = mealLabel(p.date, day); return quickPast(p, meal, lab === 'hier' ? 'Hier' : capFirst(lab) + ' ' + fmtDate(p.date), day, true); });
  const saved = savedMeals(meal).map(q => quickSaved(q, meal));
  const hab = habitualFoods(meal, day, 8); const keys = new Set(hab.map(f => f.key));
  const rec = recentFoods(200).filter(f => !keys.has(f.key)).slice(0, 10);
  const now = dayDoc(day).items.filter(i => i.meal === meal);
  return group('Dans ce repas · ' + kcalIn(now), now.map(i => entryRow(i, day))) + group('Refaire un repas', past) + group('Tes repas', saved) + group('Tes habituels ' + HAB[meal], hab.map(f => quickFood(f, meal))) + group('Récents', rec.map(f => quickFood(f, meal, true)));
}
// Aliment d'un document f_ (produit scanné ou aliment créé)
export function foodFromDoc(id, o){ return { key: o.code ? 'off:' + o.code : 'own:' + id.slice(5), src: o.src || 'own', code: o.code || null, name: o.name, brand: o.brand || '', per100: o.per100, serving: o.serving || null, portion: o.src === 'recipe' ? '1 portion' : null, fixed: o.fixed || null, docId: id }; }
// Aliments affichés dans la dernière liste, pour retrouver celui qu'on touche
export const shown = new Map();

// Aujourd'hui : ce qu'il reste à manger (séances et activités comprises), puis les trois macros en grands chiffres, protéines d'abord
// (une case par macro : mangé, barre fine, objectif ou plafond) ; le détail (fibres, sucres, saturés, sel, repas) est dans Alimentation.
// Journal vide : l'objectif du jour, sans chiffres à zéro
export function foodTodayCard(){
  const n = nutritionOf(); if (!S.loaded || !n.on) return '';
  const pl = dayPlan(today());
  if (pl.status === 'missing' || !(pl.kcal > 0)) return '<section class="card"><h3>Ton alimentation</h3><button type="button" class="link" data-act="goal-edit">Complète ton profil pour calculer tes besoins ›</button></section>';
  const items = dayDoc(today()).items; const t = totals(items); const rest = pl.kcal - t.kcal;
  let h = '<section class="card"><div class="row between"><h3>Ton alimentation</h3>' + (pl.extra ? '<span class="muted small">activités comprises</span>' : '') + '</div>';
  if (!items.length) return h + '<div class="kcal"><p><span class="v num">' + fmtInt(pl.kcal) + '</span><small>kcal</small></p><p class="muted small">ton objectif du jour · rien de noté</p></div><button type="button" class="btn" data-act="go-food">Noter un repas</button></section>';
  h += '<div class="kcal"><p><span class="v num">' + fmtInt(Math.abs(rest)) + '</span><small>kcal</small></p><p class="muted small">' + esc(nbsp((rest >= 0 ? 'restantes aujourd’hui' : 'au-dessus de ton objectif') + ' · ' + fmtInt(t.kcal) + ' mangées sur ' + fmtInt(pl.kcal))) + '</p></div>';
  const mac = (nom, k, cible, max) => '<div class="stat"><span class="l">' + nom + '</span><span class="v num">' + (t.missing.includes(k) && !t[k] ? '—' : q1(t[k]) + '<small>g</small>') + '</span>'
    + '<span class="bar" aria-hidden="true"><i style="width:' + Math.min(100, cible > 0 ? t[k] / cible * 100 : 0).toFixed(0) + '%' + (max && t[k] > cible ? ';background:var(--warn)' : '') + '"></i></span><span class="l">' + (max ? 'max ' : 'sur ') + q1(cible) + '&nbsp;g</span></div>';
  h += '<div class="stats mac-stats">' + mac('Protéines', 'p', pl.protein[0]) + mac('Glucides', 'c', pl.carbs) + mac('Lipides', 'f', pl.fat[1], true) + '</div>';
  return h + '<button type="button" class="btn" data-act="go-food">Noter un repas</button></section>';
}
function bar(label, v, goal, unit, max){
  const pct = goal ? Math.min(100, v / goal * 100) : 0;
  return '<div class="mrow fd"><span>' + label + '</span><span class="mbar"><i style="width:' + pct.toFixed(1) + '%' + (max && v > goal ? ';background:var(--warn)' : '') + '"></i></span><span class="v num">' + q1(v) + (goal ? ' / ' + q1(goal) : '') + ' ' + unit + '</span></div>';
}
// Macro du jour : petit anneau (décoratif) et valeur sur l'objectif ; max : plafond (lipides), dépassé en ambre
// unknown : valeur inconnue pour au moins un aliment : « — » si rien n'est connu, sinon un minimum (« ≥ 7,3 »)
function macro(label, v, goal, max, unknown){
  const val = unknown && !v ? '—' : (unknown ? '≥ ' : '') + q1(v);
  return '<div class="macro">' + ring(goal ? v / goal : 0, { cls:'xs' + (max && goal && v > goal ? ' over' : '') }) + '<span class="label">' + label + '</span><span class="num">' + val + (goal ? ' / ' + q1(goal) : '') + '&nbsp;g</span></div>';
}
export function viewFood(){
  if (S.food) return viewFoodAdd();
  const day = S.foodDay || today(); const doc = dayDoc(day); const t = totals(doc.items); const pl = dayPlan(day); const has = pl.status !== 'missing';
  let h = '<h1>Alimentation</h1><div class="row between daynav"><button type="button" class="btn sm" data-act="fday" data-v="-1" aria-label="Jour précédent">‹</button><b>' + esc(dayLabel(day)) + '</b><button type="button" class="btn sm" data-act="fday" data-v="1" aria-label="Jour suivant"' + (day >= today() ? ' disabled' : '') + '>›</button></div>';
  if (!S.loaded) return h + '<p class="loading">Chargement…</p>';
  // Premier lancement, journal encore vide : la rubrique s'explique d'abord
  const intro = introCard('food'); if (intro) return '<h1>Alimentation</h1>' + intro;
  // Avis d'Émile, seulement pour aujourd'hui
  if (day === today()) {
    let m = '', tone = '', kind = 'rest';
    if (!doc.items.length) { kind = 'empty'; m = hey('Note ce que tu manges au fil de la journée : je fais les comptes.'); }
    else if (!has) { kind = 'profile'; m = 'Complète ton profil (date de naissance, taille, poids, loutron ou loutronne) pour que je compare à tes besoins.'; }
    else {
      const rest = pl.kcal - t.kcal; const prot = pl.protein[0] - t.p;
      if (t.kcal > pl.kcal * 1.1) { kind = 'over'; tone = 'warn'; m = hey('Tu as dépassé ton objectif de ' + fmtInt(-rest) + ' kcal. Sur une journée, ce n’est pas grave : c’est la régularité sur la semaine qui compte.'); }
      else if (rest <= pl.kcal * 0.1) { kind = 'ok'; tone = 'good'; m = hey('Tu es dans ton objectif de calories' + (prot > 0 ? ' ; il te manque ' + fmtInt(prot) + ' g de protéines.' : ', avec assez de protéines.')); }
      else m = ''; // en cours de journée, l'anneau dit déjà ce qui reste : pas de bulle qui le répète
    }
    if (m) h += emile('<p>' + esc(m) + '</p>', { tone, key:'food:' + day + ':' + kind });
  }
  // Totaux du jour, comparés aux besoins du jour (séances et activités comprises) et aux repères :
  // anneau des calories, trois petits anneaux des macros, le reste sous « Détails ». Journal vide : anneau en pointillés, pas de « 0 ».
  const empty = !doc.items.length; const over = has && t.kcal > pl.kcal * 1.1; const rest = has ? pl.kcal - t.kcal : 0;
  h += '<section class="card hero day-card"><div class="row between"><h3>Ta journée</h3>' + (has && pl.extra ? '<span class="muted small">activités comprises</span>' : '') + '</div>';
  const pct = has && pl.kcal ? Math.round(t.kcal / pl.kcal * 100) : null;
  const centre = empty ? '<span class="muted small">Rien de noté</span>' : has ? '<b class="num day-n">' + pct + '&nbsp;%</b>' : '<b class="num day-n">' + fmtInt(t.kcal) + '</b><span class="muted small">kcal</span>';
  // À droite, le chiffre à retenir : ce qu'il reste à manger (ou l'objectif si rien n'est noté, ou ce qui dépasse)
  const big = empty ? pl.kcal : has ? Math.abs(rest) : t.kcal;
  const cap = empty ? 'ton objectif du jour' : !has ? 'mangées' : rest >= 0 ? 'restantes aujourd’hui' : 'au-dessus de ton objectif';
  h += '<div class="ring-row">' + ring(has ? t.kcal / pl.kcal : 0, { cls:'md' + (empty ? ' empty' : '') + (over ? ' over' : ''), label: empty ? 'Rien de noté' : fmtInt(t.kcal) + ' kcal mangées' + (has ? ' sur ' + fmtInt(pl.kcal) : ''), html:centre })
    + (empty && !has ? '<p class="muted">Note ton premier repas de la journée.</p>' : '<div class="kcal"><p><span class="v num">' + fmtInt(big) + '</span><small>kcal</small></p><p class="muted small">' + cap + '</p>'
    + (has && !empty ? '<p class="muted small">' + esc(nbsp(fmtInt(t.kcal) + ' mangées sur ' + fmtInt(pl.kcal))) + '</p>' : '')
    + (has && pl.extra ? '<p class="muted small">' + esc(nbsp(fmtInt(pl.base0) + ' de base + ' + fmtInt(pl.extra) + ' de séances et d’activités')) + '</p>' : '') + '</div>') + '</div>';
  if (!empty) h += '<div class="macros">' + macro('Protéines', t.p, has ? pl.protein[0] : 0, false, t.missing.includes('p')) + macro('Glucides', t.c, has ? pl.carbs : 0, false, t.missing.includes('c')) + macro('Lipides', t.f, has ? pl.fat[1] : 0, true, t.missing.includes('f')) + '</div>';
  const sfMax = has ? pl.kcal * LIMITS.sfPct / 9 : null;
  if (!empty) {
    // Le détail, toujours visible : fibres (au moins), sucres, saturés et sel (plafonds, barre en ambre au-delà)
    h += '<div class="stack day-more"><span class="label">Le détail</span>' + bar('Fibres', t.fib, LIMITS.fib, 'g') + bar('Sucres', t.s, LIMITS.s, 'g', true) + bar('Saturés', t.sf, sfMax, 'g', true) + bar('Sel', t.salt, LIMITS.salt, 'g', true)
      + '<p class="small muted">Fibres : au moins ' + LIMITS.fib + ' g. Sucres (hors lait), saturés et sel : à ne pas dépasser.</p></div>';
  }
  if (t.missing.length && !empty) h += '<p class="muted small">Valeurs inconnues pour certains aliments (' + t.missing.map(k => ({ p:'protéines', c:'glucides', s:'sucres', f:'lipides', sf:'saturés', fib:'fibres', salt:'sel' })[k]).filter(Boolean).join(', ') + ') : les totaux peuvent être un peu bas.</p>';
  h += '</section>';
  MEALS.forEach(([m, label]) => {
    const its = doc.items.filter(i => i.meal === m); const mt = totals(its); const kc = mt.kcal;
    // En-tête du repas, touchable en entier (nom, kcal, « + ») : il ouvre l'ajout d'aliments à ce repas, déjà choisi
    h += '<section class="card meal" data-meal="' + m + '"><h3 class="meal-hd"><button type="button" class="meal-h" data-act="fd-add" data-v="' + m + '">' + ic(MEAL_ICON[m]) + '<span class="stack meal-t"><span>' + label + '</span>' + (its.length ? '<span class="muted small num">' + esc(nbsp(fmtInt(kc) + ' kcal · P ' + q1(mt.p) + ' · G ' + q1(mt.c) + ' · L ' + q1(mt.f) + ' g')) + '</span>' : '') + '</span><span class="sr">, ajouter des aliments</span><span class="plus" aria-hidden="true">+</span></button></h3>';
    h += its.map(i => entryRow(i, day)).join('');
    // Repas vide : « Comme hier » (repas passé des 7 derniers jours) et le premier habituel ; repas noté : « Enregistrer ce repas » dès 2 aliments
    if (!its.length) {
      const p = pastMeals(m, day, 7, 1)[0]; const hab = habitualFoods(m, day, 1)[0];
      if (p) h += quickPast(p, m, 'Comme ' + mealLabel(p.date, day), day);
      if (hab) h += quickFood(hab, m);
    }
    if (its.length >= 2) h += '<button type="button" class="link" data-act="fd-save-meal" data-m="' + m + '">Enregistrer ce repas</button>';
    h += '</section>';
  });
  return h;
}
const BARCODE = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7V5a1 1 0 0 1 1-1h2M17 4h2a1 1 0 0 1 1 1v2M20 17v2a1 1 0 0 1-1 1h-2M7 20H5a1 1 0 0 1-1-1v-2M8 8v8M11 8v8M14 8v8M17 8v8"/></svg>';
// Ajout d'un aliment : recherche, scan, non trouvé, création, quantité
function viewFoodAdd(){
  const F = S.food;
  const mealChips = '<div class="chips" role="group">' + MEALS.map(([m, l]) => '<button type="button" class="chip txt' + (F.meal === m ? ' on' : '') + '" data-act="fd-meal" data-v="' + m + '" aria-pressed="' + (F.meal === m) + '">' + l + '</button>').join('') + '</div>';
  // close : nom du bouton de gauche sans retour (« Fermer » quand ce qui est ajouté est déjà enregistré) ; lab : étiquette de droite
  const head = (title, back, lab, close) => '<div class="row between"><button type="button" class="link" data-act="' + (back || 'fd-cancel') + '"' + (back && F.mode !== 'scan' ? ' data-back' : '') + '>' + (back ? '‹ Retour' : close || 'Annuler') + '</button><span class="label">' + esc(lab || mealName(F.meal) + ' · ' + dayLabel(F.day)) + '</span></div><h1>' + title + '</h1>';
  if (F.mode === 'scan') {
    return head('Scanner', 'fd-back') + '<div class="scan"><video id="scan-video" playsinline muted autoplay></video><i class="aim" aria-hidden="true"></i></div><p id="scan-msg" class="muted small" aria-live="polite">' + esc(F.msg || 'Vise le code-barres du produit, bien à plat et éclairé.') + '</p>'
      + '<div class="row"><input class="plain" id="scan-code" inputmode="numeric" autocomplete="off" placeholder="ou tape les chiffres du code" aria-label="Chiffres du code-barres" style="flex:1;width:auto;min-width:0"><button type="button" class="btn" data-act="fd-code">Chercher</button></div>'
      + '<p class="muted small">Un produit déjà scanné est reconnu, même sans connexion.</p>';
  }
  if (F.mode === 'notfound') {
    // Le code a bien été lu : c'est le produit qui manque (ou le réseau). Trois sorties, aucune impasse : le créer, le chercher par son nom, rescanner
    const net = F.why === 'offline' || F.why === 'error'; const part = F.why === 'incomplete' && F.partial;
    const why = { offline:'Pas de connexion, et ce produit n’a jamais été scanné sur ce téléphone.', unknown:'Le code-barres est bien lu, mais ce produit n’est pas encore dans la base de produits.', incomplete:'Ce produit est connu, mais sans ses calories.', error:'La base de produits ne répond pas pour l’instant.' }[F.why] || '';
    const quoi = part ? ' J’ai repris son nom et les valeurs connues : complète le reste avec l’emballage.' : ' Crée-le avec les valeurs de l’emballage, ou cherche-le par son nom : dans les deux cas, il sera reconnu au prochain scan.';
    return head(part ? 'Produit incomplet' : net ? 'Produit pas encore trouvé' : 'Produit inconnu', 'fd-back') + emile('<p>' + esc(why + quoi) + '</p><p class="muted small">Code ' + esc(F.code) + (part && F.partial.name ? ' · ' + esc(F.partial.name) : '') + '</p>', { tone:'warn' })
      + (net ? '<button type="button" class="btn primary big" data-act="fd-retry">Réessayer</button>' : '')
      + '<button type="button" class="btn' + (net ? '' : ' primary') + ' big" data-act="fd-create">' + (part ? 'Compléter ce produit' : 'Créer cet aliment') + '</button><button type="button" class="btn big" data-act="fd-link">Chercher par nom</button><button type="button" class="btn ghost" data-act="fd-scan">Scanner à nouveau</button>';
  }
  if (F.mode === 'create') {
    const d = F.draft; const fld = (k, l, ph) => '<label class="f"><span>' + l + '</span><input class="n" id="fc-' + k + '" data-fc="' + k + '" inputmode="decimal" value="' + esc(d[k] == null ? '' : d[k]) + '" placeholder="' + ph + '"></label>';
    let h = head('Créer un aliment', 'fd-back') + '<section class="card">' + (F.code ? '<p class="muted small">Code-barres ' + esc(F.code) + '</p>' : '');
    h += '<label class="f"><span>Nom</span><input id="fc-name" data-fc="name" value="' + esc(d.name || '') + '" placeholder="ex. Granola maison"></label><label class="f"><span>Marque (facultatif)</span><input id="fc-brand" data-fc="brand" value="' + esc(d.brand || '') + '"></label>';
    h += '<span class="label">Pour 100 g (voir l’emballage)</span><div class="fields">' + fld('kcal', 'Calories (kcal)', 'ex. 380') + fld('p', 'Protéines (g)', '') + fld('c', 'Glucides (g)', '') + fld('s', 'dont sucres (g)', '') + fld('f', 'Lipides (g)', '') + fld('sf', 'dont saturés (g)', '') + fld('fib', 'Fibres (g)', '') + fld('salt', 'Sel (g)', '') + '</div>';
    h += '<div class="fields">' + fld('serving', 'Une portion (g), facultatif', 'ex. 40') + '</div><p class="muted small">Seuls le nom et les calories sont obligatoires. Une case vide compte comme « inconnu ».</p>';
    return h + '<button type="button" class="btn primary big" data-act="fd-create-save">Enregistrer l’aliment</button></section>';
  }
  if (F.mode === 'recipe') {
    const R = F.rec;
    let h = head(R.id ? 'Modifier la recette' : 'Créer une recette', 'fd-back') + '<section class="card">';
    h += '<label class="f"><span>Nom</span><input id="rc-name" data-rc="name" value="' + esc(R.name || '') + '" placeholder="ex. Gratin de pâtes de mamie"></label>';
    h += '<div class="fields"><label class="f"><span>Nombre de portions</span><input class="n" id="rc-servings" data-rc="servings" inputmode="numeric" value="' + esc(R.servings == null ? '' : R.servings) + '"></label>';
    h += '<label class="f"><span>Poids du plat cuit (g), facultatif</span><input class="n" id="rc-cooked" data-rc="cooked" inputmode="numeric" value="' + esc(R.cooked == null ? '' : R.cooked) + '" placeholder="ex. 1200"></label></div>';
    h += '<span class="label">Ingrédients (' + R.items.length + '), pour toute la recette</span>';
    h += R.items.map((it, i) => '<div class="row" style="flex-wrap:nowrap"><span class="small" style="flex:1;min-width:0">' + esc(it.name) + '</span><label class="fld" style="width:96px;flex:none"><input data-ri="' + i + '" inputmode="decimal" value="' + esc(it.g == null ? '' : fmtKg(it.g)) + '" aria-label="Quantité de ' + esc(it.name) + ' en grammes"><span>g</span></label><button type="button" class="btn sm" data-act="rec-rm" data-i="' + i + '" aria-label="Retirer ' + esc(it.name) + '">✕</button></div>').join('');
    h += '<input class="plain" type="search" id="rec-q" data-rq="1" placeholder="Ajouter un ingrédient : riz, poulet, crème…" aria-label="Chercher un ingrédient" value="' + esc(R.q || '') + '" autocomplete="off">';
    h += '<div class="stack" id="rec-list">' + recList() + '</div><div id="rec-prev">' + recPreview() + '</div>';
    h += '<p class="muted small">Pèse les ingrédients comme tu les utilises ; le poids du plat cuit, facultatif, corrige l’eau perdue ou absorbée à la cuisson.</p>';
    return h + '<button type="button" class="btn primary big" data-act="rec-save">Enregistrer la recette</button></section>';
  }
  if (F.mode === 'portion') {
    const f = F.sel; const g = num(F.g);
    // Modifier depuis le journal : on y revient ; depuis la fenêtre d'ajout (F.ret) ou après un choix dans la liste : retour à la liste
    let h = head(F.edit ? 'Modifier' : 'Quantité', (F.edit && !F.ret) || F.fromDay ? 'fd-cancel' : 'fd-back') + '<section class="card"><div class="stack" style="gap:2px"><h2>' + esc(f.name) + '</h2><span class="muted small">' + esc(nbsp((f.brand ? f.brand + ' · ' : '') + fmtInt(f.per100.kcal) + ' kcal pour 100 g')) + '</span></div>';
    if (f.fixed === 'kcal') h += '<p class="alert info">Calories corrigées : la fiche du produit donnait sans doute des kilojoules. Vérifie sur l’emballage.</p>';
    // Mesure usuelle (cuillères, mL) pour quelques familles d'aliments : la quantité enregistrée reste en grammes, estimée et affichée
    const fam = measuresFor(f); const u = fam && fam.units.find(x => x.id === F.unit);
    if (fam) h += '<span class="label">Saisir la quantité en</span><div class="chips" role="group" aria-label="Saisir la quantité en">' + [{ id:'g', label:'grammes' }].concat(fam.units).map(x => { const on = (u ? u.id : 'g') === x.id; return '<button type="button" class="chip txt' + (on ? ' on' : '') + '" data-act="fd-unit" data-v="' + x.id + '" aria-pressed="' + on + '">' + esc(x.label) + '</button>'; }).join('') + '</div>';
    if (u) {
      h += '<label class="f"><span>Nombre de ' + esc(u.label) + ' (estimation)</span><input class="n" id="fd-n" data-fn="1" inputmode="decimal" value="' + esc(F.n == null ? '' : F.n) + '"></label>'
        + '<div class="chips" role="group">' + u.quick.map(x => '<button type="button" class="chip txt" data-act="fd-nset" data-v="' + x + '">' + x + ' ' + esc(u.label) + '</button>').join('') + '</div>'
        + '<p class="small" id="fd-conv" aria-live="polite">' + convText(u, g) + '</p>';
    } else {
      h += '<label class="f"><span>Quantité (g)</span><input class="n" id="fd-g" data-fg="1" inputmode="decimal" value="' + esc(F.g == null ? '' : fmtKg(num(F.g))) + '"></label>';
      const dish = f.src === 'rec' || f.src === 'recipe';
      h += '<div class="chips" role="group">' + (f.serving ? '<button type="button" class="chip txt" data-act="fd-gset" data-v="' + f.serving + '">' + esc(f.portion || '1 portion') + ' (' + fmtKg(f.serving) + ' g)</button>' : '') + (dish ? [200, 300, 400] : [50, 100, 150, 200]).map(x => '<button type="button" class="chip txt" data-act="fd-gset" data-v="' + x + '">' + x + ' g</button>').join('') + '</div>';
    }
    const rf = f.src === 'rec' && !f.items ? recipeByKey(f.key) : f;
    if (rf && rf.items) h += '<details class="cue"><summary>Recette type pour ' + esc(rf.portion) + '</summary><p>' + rf.items.map(i => i[1] + ' g ' + esc(i[0])).join(' · ') + '</p><p class="muted small">Ajuste la quantité si ta recette diffère.</p></details>';
    // Ta recette (trouvée dans tes aliments ou dans les récents) : on peut la modifier
    const docId = f.docId || (f.key.indexOf('own:') === 0 ? 'f_own' + f.key.slice(4) : null);
    if (f.src === 'recipe' && docId && S.docs.get(docId)) h += '<button type="button" class="link" data-act="rec-edit" data-v="' + esc(docId) + '" style="align-self:flex-start">Modifier la recette</button>';
    // Le repas est choisi à l'ouverture : on ne le redemande pas ; seule une modification depuis le journal peut déplacer l'aliment d'un repas à l'autre
    h += (F.edit && !F.ret ? '<span class="label">Repas</span>' + mealChips : '') + '<div id="fd-prev">' + preview(f, g) + '</div>';
    h += '<button type="button" class="btn primary big" data-act="fd-save">' + (F.edit ? 'Enregistrer' : 'Ajouter ' + ADD_TO[F.meal]) + '</button>';
    if (F.edit) h += S.confirm === 'fd-del' ? '<button type="button" class="btn danger" data-act="fd-del-yes">Confirmer : retirer du journal</button>' : '<button type="button" class="btn ghost" data-act="fd-del">Retirer du journal</button>';
    return h + '</section>';
  }
  // Enregistrer un repas du journal, ou détail d'un repas enregistré (ajouter, renommer, supprimer)
  if (F.mode === 'save-meal') {
    const items = dayDoc(F.day).items.filter(i => i.meal === F.meal);
    return head('Enregistrer ce repas') + '<section class="card">' + nameField(DEFAULT_NAME[F.meal] || 'Mon repas') + mealItems(items)
      + '<button type="button" class="btn primary big" data-act="fd-save-meal-ok">Enregistrer le repas</button></section>';
  }
  if (F.mode === 'meal') {
    const q = S.docs.get(F.qid);
    if (!q) return head('Repas', 'fd-back') + '<p class="empty">Ce repas n’existe plus.</p>';
    let h = head(esc(q.name), 'fd-back') + '<section class="card">';
    if (F.renaming) h += nameField(q.name) + '<button type="button" class="btn" data-act="fd-saved-rename-ok">Enregistrer</button>';
    h += mealItems(q.items || []) + '<button type="button" class="btn primary big" data-act="fd-meal-add" data-v="' + esc(F.qid) + '" data-m="' + esc(q.meal) + '">Ajouter ' + ADD_TO[F.meal] + '</button>';
    if (!F.renaming) h += '<button type="button" class="btn" data-act="fd-saved-rename">Renommer</button>';
    h += S.confirm === 'q-del' ? '<button type="button" class="btn danger" data-act="fd-saved-del-yes">Confirmer : supprimer ce repas</button>' : '<button type="button" class="btn ghost" data-act="fd-saved-del">Supprimer le repas</button>';
    return h + '</section>';
  }
  // Recherche : le repas en titre ; chaque aliment validé est enregistré aussitôt et la fenêtre reste ouverte pour le suivant
  let h = head(esc(mealName(F.meal)), null, dayLabel(F.day), 'Fermer');
  if (F.link) h += '<p class="alert info">' + esc(nbsp('Code-barres ' + F.link + ' : choisis l’aliment qui correspond, il sera reconnu au prochain scan.')) + ' <button type="button" class="link" data-act="fd-unlink">Ne pas associer</button></p>';
  // Recherche en grand, scanner en carré orange à côté (l'action rapide la plus forte), créations en dessous
  h += '<div class="fd-search"><input class="plain" type="search" id="fd-q" data-fq="1" placeholder="Rechercher : pomme, riz, bolognaise…" aria-label="Rechercher un aliment" value="' + esc(F.q || '') + '" autocomplete="off" enterkeyhint="search"><button type="button" class="btn primary scan-btn" data-act="fd-scan" aria-label="Scanner un code-barres">' + BARCODE + '</button></div>';
  h += '<div class="stack" id="fd-list">' + foodList() + '</div>';
  h += '<div class="row fd-new"><button type="button" class="link" data-act="fd-create">Créer un aliment</button><button type="button" class="link" data-act="rec-new">Créer une recette</button></div>';
  // Terminé : fixé au bas de l'écran dès que le repas contient un aliment (ils sont déjà enregistrés : il ferme seulement)
  const now = dayDoc(F.day).items.filter(i => i.meal === F.meal); const n = now.length;
  return h + (n ? '<div class="fd-done"><button type="button" class="btn primary big" data-act="fd-cancel">' + esc(nbsp('Terminé · ' + n + ' aliment' + (n > 1 ? 's' : '') + ', ' + kcalIn(now))) + '</button></div>' : '');
}
// Éditeur de recette : ingrédients trouvés (aliments notés, créés, table Ciqual ; pas d'autres recettes)
export const recShown = new Map();
export function recList(){
  const R = S.food.rec; const q = String(R.q || '').trim(); recShown.clear();
  if (!q) return '';
  needCiqual(() => { const l = document.getElementById('rec-list'); if (l && S.food && S.food.mode === 'recipe') l.innerHTML = recList(); });
  const mine = recentFoods(200).filter(f => f.src !== 'rec' && f.src !== 'recipe'); const own = myFoods().map(o => foodFromDoc(o.id, o)).filter(f => f.src !== 'recipe' && !mine.some(m => m.key === f.key));
  const res = searchFoods([mine.concat(own), [], ciq || []], q, 8);
  return res.map(f => { recShown.set(f.key, f); return '<button type="button" class="pick" data-act="rec-add" data-v="' + esc(f.key) + '"><span class="stack" style="gap:2px"><span class="n">' + esc(f.name) + '</span><span class="m">' + esc(nbsp((f.brand ? f.brand + ' · ' : '') + fmtInt(f.per100.kcal) + ' kcal pour 100 g')) + '</span></span><span aria-hidden="true">+</span></button>'; }).join('') || (ciq ? '<p class="muted small">Aucun aliment trouvé.</p>' : '<p class="loading">Chargement des aliments…</p>');
}
export function recPreview(){
  const R = S.food.rec; const items = R.items.filter(i => i.g > 0); if (!items.length) return '';
  const r = ownRecipe(items, num(R.servings), num(R.cooked)); const v = scale(r.per100, r.serving);
  return '<p class="small"><b>Une portion : ' + fmtKg(r.serving) + ' g, ' + (v.kcal == null ? '— kcal' : fmtInt(v.kcal) + ' kcal') + '</b>, protéines ' + qg(v.p) + ', glucides ' + qg(v.c) + ', lipides ' + qg(v.f) + '.</p>';
}
// Ce qui sera enregistré pour n mesures : toujours des grammes, avec la valeur de la mesure et sa limite
export function convText(u, g){
  return (g > 0 ? '<b>' + nbsp('= ' + fmtKg(g) + ' g enregistrés') + '</b> ' : '') + '<span class="muted">' + esc(nbsp(u.id === 'ml' ? '(estimation) · ' + u.hint : '(estimation, cuillère rase) · ' + u.hint)) + '</span>';
}
export function preview(f, g){
  if (!(g > 0)) return '<p class="muted small">Indique une quantité.</p>';
  const v = scale(f.per100, g); const st = (val, l) => '<div class="stat"><span class="v num">' + val + '</span><span class="l">' + l + '</span></div>';
  return '<div class="stats">' + st(fmtInt(v.kcal), 'kcal') + st(q1(v.p) + ' <small>g</small>', 'protéines') + st(q1(v.c) + ' <small>g</small>', 'glucides') + '</div>'
    + '<p class="small muted">Lipides ' + qg(v.f) + ' (saturés ' + qg(v.sf) + ') · sucres ' + qg(v.s) + ' · fibres ' + qg(v.fib) + ' · sel ' + qg(v.salt) + '</p>';
}
// Résultat : nom, marque, puis une quantité et ce qu'elle apporte (dernière quantité notée, sinon la portion du produit, sinon 100 g)
const basis = f => { const g = f.g || f.serving || 100; const v = scale(f.per100, g);
  return (f.g ? fmtKg(g) + ' g' : f.serving ? (f.portion || '1 portion') + ' (' + fmtKg(g) + ' g)' : '100 g') + ' · ' + (v.kcal == null ? '—' : fmtInt(v.kcal)) + ' kcal' + (v.p == null ? '' : ' · ' + q1(v.p) + ' g de protéines'); };
const row = f => { shown.set(f.key, f); return '<button type="button" class="pick" data-act="fd-pick" data-v="' + esc(f.key) + '"><span class="stack" style="gap:2px"><span class="n">' + esc(f.name) + '</span><span class="m">' + esc(nbsp((f.brand ? f.brand + ' · ' : '') + basis(f))) + '</span></span><span aria-hidden="true">›</span></button>'; };
let ciq = null, recs = null; // table Ciqual, une fois chargée, et recettes types calculées avec elle
const recipeByKey = key => (recs || []).find(r => r.key === key);
function needCiqual(after){
  if (!ciq) loadCiqual().then(list => { ciq = list; recs = recipeFoods(list); after(); });
}
export function foodList(){
  const F = S.food; const q = String(F.q || '').trim(); shown.clear();
  if (!q) return quickGroups(F.meal, F.day) || '<p class="empty">Cherche un aliment par son nom, ou scanne un code-barres.</p>';
  const mine = recentFoods(200); const own = myFoods().map(o => foodFromDoc(o.id, o)).filter(f => !mine.some(m => m.key === f.key));
  needCiqual(() => { if (S.food && S.food.mode === 'search') { const l = document.getElementById('fd-list'); if (l) l.innerHTML = foodList(); } });
  // Une suite de chiffres qui forme un code-barres valide : on propose de le chercher, comme après un scan
  const code = q.replace(/\s/g, ''); const asCode = !/\D/.test(code) && validBarcode(code) ? '<button type="button" class="btn primary" data-act="fd-code" data-v="' + code + '">Chercher le code-barres ' + code + '</button>' : '';
  const res = searchFoods([mine.concat(own), recs || [], ciq || []], q, 40);
  let h = asCode + (res.length ? res.map(row).join('') : ciq && !asCode ? '<p class="empty">Aucun aliment trouvé. Essaie un autre mot, scanne le produit ou crée-le.</p>' : '');
  if (!ciq) h += '<p class="loading">Chargement des aliments…</p>';
  else if (!ciq.length) h += '<p class="muted small">La liste des aliments n’est pas disponible pour l’instant.</p>';
  return h;
}
// Caméra : allumée tant que l'écran de scan est affiché, éteinte dès qu'on le quitte. Un code lu est envoyé à actions.js (événement « barcode »).
let scan = null;
export function foodAfterRender(){
  const v = document.getElementById('scan-video');
  if (scan && scan.video !== v) { scan.stop(); scan = null; }
  if (!v || scan) return;
  const cur = { video: v, stop: () => { cur.dead = true; } }; scan = cur;
  startScanner(v, code => document.dispatchEvent(new CustomEvent('barcode', { detail: code })), validBarcode)
    .then(stop => { if (cur.dead) stop(); else cur.stop = () => { cur.dead = true; stop(); }; })
    .catch(e => { const m = document.getElementById('scan-msg'); if (m && !cur.dead) m.textContent = e && e.name === 'NotAllowedError' ? 'Accès à la caméra refusé : autorise-le dans les réglages du téléphone, ou tape les chiffres du code.' : 'Caméra indisponible : tape les chiffres du code.'; });
}
