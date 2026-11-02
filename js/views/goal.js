// Objectif de poids et besoins du jour : formulaire (accueil et profil), avis d'Émile, carte d'Aujourd'hui.
import { addDays, esc, fmtDateYear, fmtInt, fmtKg, num, today } from '../util.js';
import { S } from '../store.js';
import { bodyweight, settings } from '../data.js';
import { ACTIVITY, GAIN, LOSS, planFor } from '../nutrition.js';
import { emile, hey } from '../emile.js';
import { dayDoc, totals } from '../food.js';

export const nutritionOf = () => settings().nutrition || {};
// Données de la personne : réglages et dernière pesée, ou ce qui est saisi à l'accueil
export function profileData(){ const s = settings(); return { sex: s.sex, birth: s.birth, height: num(s.height), weight: bodyweight() }; }
export function setupData(U){ return { sex: U.sex, birth: U.birth, height: num(U.height), weight: num(U.weight) }; }
export const myPlan = () => planFor(profileData(), nutritionOf(), today());

const MISSING = { sex:'si tu es un loutron ou une loutronne', birth:'ta date de naissance', height:'ta taille', weight:'ton poids', activity:'ton activité au quotidien' };
const kg = x => fmtKg(Math.round(x * 10) / 10);
const andList = l => l.length > 1 ? l.slice(0, -1).join(', ') + ' et ' + l[l.length - 1] : l[0];
const pct = x => fmtKg(Math.round(x * 100) / 100);
const signed = x => (x > 0 ? '+' : '−') + kg(Math.abs(x));
// Avis d'Émile sur l'objectif. n : réglages de l'objectif (pour la date visée)
export function verdict(pl, n){
  let t = '', tone = '', btn = '';
  if (pl.status === 'missing') t = 'Pour calculer tes besoins, dis-moi ' + andList(['birth', 'height', 'weight', 'activity', 'sex'].filter(k => pl.missing.indexOf(k) >= 0).map(k => MISSING[k])) + '.';
  else if (pl.status === 'keep') t = 'Pour garder ton poids, vise à peu près ta dépense de chaque jour, ci-dessous.';
  else if (pl.status === 'target') t = 'Indique ton poids visé.';
  else if (pl.status === 'date') t = n.by && n.by <= today() ? 'La date visée est passée : choisis-en une nouvelle.' : 'Choisis la date à laquelle tu veux l’atteindre.';
  else if (pl.status === 'direction') t = 'Ton poids visé doit être ' + (pl.goal === 'lose' ? 'sous' : 'au-dessus de') + ' ton poids actuel (' + kg(pl.start.weight) + ' kg).';
  else if (pl.status === 'minor') { tone = 'warn'; t = 'Avant 18 ans, je ne propose pas de perte de poids : ton corps grandit encore. Si ton poids te préoccupe, parles-en à ton médecin ou à un diététicien. Les besoins ci-dessous servent à garder ton poids.'; }
  else if (pl.status === 'bmi') { tone = 'warn'; t = 'Je ne peux pas t’accompagner jusqu’à ' + kg(pl.target) + ' kg : pour ta taille, ce poids correspond à un IMC sous 18,5, ce que l’Organisation mondiale de la santé considère comme une insuffisance pondérale. Le plus bas que je peux viser avec toi : ' + kg(pl.minKg) + ' kg. Les besoins ci-dessous servent à garder ton poids.'; }
  else {
    const gain = pl.goal === 'gain'; const d = Math.abs(pl.target - pl.start.weight);
    if (pl.status === 'ok') {
      tone = 'good';
      t = 'Passer de ' + kg(pl.start.weight) + ' à ' + kg(pl.target) + ' kg d’ici le ' + fmtDateYear(n.by) + ' : ' + signed(pl.kgWeek) + ' kg par semaine, soit ' + pct(Math.abs(pl.pctWeek)) + ' % de ton poids. ';
      const adv = gain ? GAIN.advised : LOSS.advised;
      // Nettement sous le rythme conseillé (la date proposée par Émile, arrondie à la semaine, reste « le bon rythme »)
      t += Math.abs(pl.pctWeek) < adv * 0.8
        ? (gain ? 'C’est un rythme lent : jusqu’à 0,5 % par semaine reste raisonnable.' : 'C’est un rythme doux : jusqu’à 1 % par semaine reste raisonnable.')
        : (gain ? 'C’est le bon rythme pour prendre du muscle sans trop de gras.' : 'C’est un rythme qui aide à garder ton muscle.');
    } else {
      tone = 'warn';
      t = (gain ? 'Prendre ' : 'Perdre ') + kg(d) + ' kg d’ici le ' + fmtDateYear(n.by) + ', c’est trop rapide : ';
      t += gain ? 'au-delà de 0,5 % de ton poids par semaine (' + kg(pl.maxKg) + ' kg pour toi), une grande part serait du gras. '
        : pl.limit === 'resting' ? 'il faudrait manger moins que ta dépense au repos (' + fmtInt(pl.bmr) + ' kcal par jour), et ça, je ne te le proposerai jamais. '
        : 'au-delà de 1 % de ton poids par semaine (' + kg(pl.maxKg) + ' kg pour toi), tu perdrais aussi du muscle. ';
      t += 'Au plus tôt, vise le ' + fmtDateYear(pl.realistic) + ' : j’ai calculé tes besoins sur ce rythme.';
      btn = '<button type="button" class="btn" data-act="n-realistic">Viser le ' + esc(fmtDateYear(pl.realistic)) + '</button>';
    }
  }
  if (pl.age != null && pl.age < 18 && pl.status !== 'minor') t += ' Ce calcul est prévu pour les adultes : avant 18 ans, prends-le comme une estimation.';
  return emile('<p>' + esc(t) + '</p>' + btn, { tone });
}
// Besoins du jour, hors séances
export function needs(pl, compact){
  if (pl.status === 'missing') return '';
  const st = (v, l, wide) => '<div class="stat' + (wide ? ' wide' : '') + '"><span class="v num">' + v + '</span><span class="l">' + l + '</span></div>';
  let h = (compact ? '' : '<span class="label">Tes besoins par jour</span>') + '<div class="stats needs">' + st(fmtInt(pl.kcal) + ' <small>kcal</small>', 'calories, sans compter tes séances', true)
    + st(pl.protein[0] + '-' + pl.protein[1] + ' <small>g</small>', 'protéines') + st(pl.fat[0] + '-' + pl.fat[1] + ' <small>g</small>', 'lipides')
    + st('≈ ' + pl.carbs + ' <small>g</small>', 'glucides (le reste)') + st(pl.fibre + ' <small>g</small>', 'fibres') + '</div>';
  if (!compact) h += '<p class="muted small">Les jours où tu t’entraînes, tu dépenses davantage : ce total ne compte pas tes séances.' + (pl.goal !== 'keep' ? ' Calcul approximatif : environ 7 700 kcal par kilo, et le poids varie aussi d’un jour à l’autre avec l’eau.' : '') + ' Détails dans « La science ».</p>';
  return h;
}
// Formulaire : activité, objectif, poids et date visés, puis avis d'Émile et besoins. n : { activity, goal, target, by }
export function goalForm(n, pl){
  let h = '<div class="stack" style="gap:6px"><span class="label">Ton activité au quotidien, hors sport</span>';
  Object.keys(ACTIVITY).forEach(k => { const a = ACTIVITY[k]; h += '<button type="button" class="pick' + (n.activity === k ? ' on' : '') + '" data-act="n-act" data-v="' + k + '" aria-pressed="' + (n.activity === k) + '"><span class="stack" style="gap:2px"><span class="n">' + esc(a.label) + '</span><span class="m">' + esc(a.desc) + '</span></span><span aria-hidden="true">' + (n.activity === k ? '✓' : '') + '</span></button>'; });
  h += '</div><div class="stack" style="gap:6px"><span class="label">Ton objectif</span><div class="chips" role="group">' + [['lose', 'Perdre du poids'], ['keep', 'Garder mon poids'], ['gain', 'Prendre du poids']].map(o => '<button type="button" class="chip txt' + ((n.goal || 'keep') === o[0] ? ' on' : '') + '" data-act="n-goal" data-v="' + o[0] + '" aria-pressed="' + ((n.goal || 'keep') === o[0]) + '">' + o[1] + '</button>').join('') + '</div></div>';
  if (n.goal === 'lose' || n.goal === 'gain') {
    h += '<div class="fields"><label class="f"><span>Poids visé (kg)</span><input class="n" id="n-target" data-n="target" inputmode="decimal" value="' + esc(n.target == null || n.target === '' ? '' : fmtKg(num(n.target))) + '" placeholder="ex. ' + (n.goal === 'lose' ? '72' : '78') + '"></label>';
    h += '<label class="f"><span>Date visée</span><input type="date" id="n-by" data-n="by" value="' + esc(n.by || '') + '" min="' + addDays(today(), 7) + '"></label></div>';
  }
  return h + verdict(pl, n) + needs(pl);
}
// Carte du profil : proposer le suivi, ou le régler
export function goalProfileCard(){
  const n = nutritionOf();
  let h = '<section class="card" id="goal-card"><h3>Ton alimentation</h3>';
  if (!n.on) return h + emile('<p>Veux-tu suivre ton alimentation ? Je calcule tes besoins en calories et en protéines, et un rythme réaliste pour ton objectif de poids.</p><button type="button" class="btn primary" data-act="n-on" data-v="1">Oui, je veux suivre</button>') + '</section>';
  h += '<p class="muted small">Je me sers de ta date de naissance, de ta taille, de ton poids et de « loutron ou loutronne », ci-dessus.</p>';
  return h + goalForm(n, myPlan()) + '<button type="button" class="btn ghost" data-act="n-on" data-v="0">Arrêter le suivi</button></section>';
}
// Carte d'Aujourd'hui : objectif, rythme et besoins du jour
export function goalTodayCard(){
  const n = nutritionOf(); if (!S.loaded || !n.on) return '';
  const pl = myPlan(); const w = bodyweight();
  if (['ok', 'fast', 'keep'].indexOf(pl.status) < 0) return verdict(pl, n).replace('</p>', ' <button type="button" class="link" data-act="goal-edit">Régler dans ton profil</button></p>');
  let t = pl.status === 'keep' ? 'Ton objectif : garder ton poids (' + kg(w) + ' kg).'
    : 'Tu vises ' + kg(pl.target) + ' kg le ' + fmtDateYear(pl.status === 'fast' ? pl.realistic : n.by) + ', à ' + signed(pl.kgWeek) + ' kg par semaine. Dernière pesée : ' + kg(w) + ' kg.';
  if (pl.status === 'ok' && w != null && (pl.goal === 'gain' ? w >= pl.target : w <= pl.target)) t = 'Tu as atteint ton poids visé, bravo ! Choisis un nouvel objectif dans ton profil.';
  // Ce qui est déjà noté dans le journal aujourd'hui
  const day = dayDoc(today()); const eat = day.items.length ? totals(day.items) : null;
  const ate = eat ? '<p class="small"><b>Mangé aujourd’hui : ' + fmtInt(eat.kcal) + ' / ' + fmtInt(pl.kcal) + ' kcal</b>, protéines ' + fmtInt(eat.p) + ' / ' + pl.protein[0] + ' g. <button type="button" class="link" data-act="tab" data-v="food">Ouvrir le journal</button></p>' : '<p class="small"><button type="button" class="link" data-act="tab" data-v="food">Noter ce que je mange</button></p>';
  return emile('<p>' + esc(hey(t)) + '</p>' + needs(pl, true) + ate + '<p class="muted small">Sans compter tes séances. <button type="button" class="link" data-act="goal-edit">Modifier</button></p>', { title:'Ton objectif' });
}
