// Objectif de poids et besoins du jour : formulaire (accueil et profil), avis d'Émile, carte d'Aujourd'hui.
import { addDays, daysBetween, esc, fmtDate, fmtDateYear, fmtInt, fmtKg, num, today, withDot } from '../util.js';
import { S } from '../store.js';
import { bodyDocs, bodyweight, settings } from '../data.js';
import { ACTIVITY, adjustFor, CHECK, GAIN, LOSS, planFor, weightTrend, withExtra } from '../nutrition.js';
import { dayEnergy } from '../energy.js';
import { emile, hey } from '../emile.js';
import { dayDoc, fullDay, totals } from '../food.js';

export const nutritionOf = () => settings().nutrition || {};
// Données de la personne : réglages et dernière pesée, ou ce qui est saisi à l'accueil
export function profileData(){ const s = settings(); return { sex: s.sex, birth: s.birth, height: num(s.height), weight: bodyweight() }; }
export function setupData(U){ return { sex: U.sex, birth: U.birth, height: num(U.height), weight: num(U.weight) }; }
export const myPlan = () => planFor(profileData(), nutritionOf(), today());
// Besoins d'un jour : ceux du profil, plus la dépense des séances et des activités de ce jour-là
export const dayPlan = day => withExtra(myPlan(), dayEnergy(day).kcal);

// Point toutes les 2 semaines : 14 jours après le début de l'objectif ou après le dernier point
export function nextCheck(){
  const n = nutritionOf(); const start = n.start && n.start.date; if (!n.on || !start) return null;
  const pl = myPlan(); if (['ok', 'fast', 'keep', 'bmi'].indexOf(pl.status) < 0 || pl.age < 18) return null;
  const checks = n.checks || []; const last = checks.length ? checks[checks.length - 1].date : null;
  const from = last && last > start ? last : start;
  return { from, date: addDays(from, CHECK.days), pl };
}
// Ce qui a été mangé d'après le journal, sur les jours notés (sans aujourd'hui, pas fini), comparé aux besoins de ces jours-là
function intakeBetween(from, to){
  let days = 0, kcal = 0, target = 0;
  for (let d = from; d <= to; d = addDays(d, 1)) { const doc = dayDoc(d); if (!fullDay(doc)) continue; days++; kcal += totals(doc.items).kcal; target += dayPlan(d).kcal; }
  return days ? { days, avg: kcal / days, target: target / days } : { days: 0 };
}
export function checkDue(){
  const nc = nextCheck(); const d = today(); if (!nc || d < nc.date) return null;
  // Pesées des 2 dernières semaines, ou depuis le dernier point si on l'a laissé passer (4 semaines au plus)
  const from = daysBetween(nc.from, d) > CHECK.maxDays ? addDays(d, -CHECK.maxDays) : nc.from;
  const trend = weightTrend(bodyDocs().map(b => ({ date: b.date, weight: num(b.weight) })), from, d);
  const intake = intakeBetween(from, addDays(d, -1));
  return Object.assign(adjustFor(nc.pl, trend, intake), { from, pl: nc.pl, intake });
}
const perWeek = x => (x > 0.005 ? '+' : x < -0.005 ? '−' : '') + fmtKg(Math.round(Math.abs(x) * 100) / 100);
// Espace insécable avant « : » et « ? », pour qu'ils ne passent pas seuls à la ligne
const fr = s => esc(s).replace(/ ([:;?!])/g, '\u00a0$1');
// Carte d'Aujourd'hui, le jour du point
export function checkCard(){
  if (!S.loaded) return '';
  const c = checkDue(); if (!c) return '';
  // La croix vaut « Pas cette fois », ou « Compris » quand il n'y a rien à décider
  const opt = { title:'Le point sur tes 2 semaines', id:'check-card', close: ['ontrack', 'offplan', 'limit'].indexOf(c.status) >= 0 ? 'adj-keep' : 'adj-later' };
  if (c.status === 'weighins') return emile('<p>' + fr(hey('Pour faire le point, j’ai besoin d’au moins ' + CHECK.weighins + ' pesées sur une semaine ou plus. Pèse-toi 2 ou 3 fois par semaine, le matin, avant de manger.')) + '</p><button type="button" class="link" data-act="adj-later">Pas cette fois</button>', opt);
  const trend = 'Ta tendance : de ' + fmtKg(Math.round(c.w0 * 10) / 10) + ' à ' + fmtKg(Math.round(c.w1 * 10) / 10) + ' kg en ' + c.days + ' jours, soit ' + perWeek(c.actual) + ' kg par semaine' + (c.planned ? ' pour ' + perWeek(c.planned) + ' prévu.' : ', alors que tu veux maintenir ton poids.');
  const kcal = fmtInt(c.pl.kcal);
  if (c.status === 'offplan') {
    const more = c.intake.avg > c.intake.target;
    return emile('<p>' + fr(trend) + '</p><p>' + fr('D’après ton journal (' + c.intake.days + ' jours notés), tu as mangé en moyenne ' + fmtInt(c.intake.avg) + ' kcal par jour, pour un objectif moyen de ' + fmtInt(c.intake.target) + ' kcal : ' + (more ? 'plus' : 'moins') + ' que prévu. L’écart de poids vient sans doute de là, alors je garde ton objectif. Essaie de t’en approcher, je referai le point dans 2 semaines.') + '</p><button type="button" class="btn" data-act="adj-keep">Compris</button>', opt);
  }
  if (c.status === 'ontrack') return emile('<p>' + fr(trend) + '</p><p>' + fr(hey('Tu suis le plan : on garde ' + kcal + ' kcal par jour.')) + '</p><button type="button" class="btn" data-act="adj-keep">Super</button>', Object.assign(opt, { tone:'good' }));
  if (c.status === 'limit') {
    const why = { resting:'ce serait moins que ta dépense au repos', bmi:'ton poids est déjà au plus bas que je peux viser avec toi', total:'j’ai déjà corrigé tes besoins de ' + Math.round(CHECK.total * 100) + ' %, le maximum' }[c.limit];
    return emile('<p>' + fr(trend) + '</p><p>' + fr('Je ne peux pas ajuster davantage : ' + why + '. On garde ' + kcal + ' kcal par jour. Si ça continue, parles-en à un diététicien.') + '</p><button type="button" class="btn" data-act="adj-keep">Compris</button>', Object.assign(opt, { tone:'warn' }));
  }
  // Ajustement proposé ; sans journal suffisant, Émile demande d'abord si l'objectif a été suivi
  if (c.intake.days < CHECK.logDays && !S.adjOk) return emile('<p>' + fr(trend) + '</p><p>' + fr('Avant de proposer un ajustement : as-tu mangé à peu près ton objectif ces 2 semaines ?') + '</p><div class="row"><button type="button" class="btn" data-act="adj-yes">Oui, à peu près</button><button type="button" class="btn ghost" data-act="adj-no">Pas vraiment</button></div>', opt);
  const add = c.change > 0;
  return emile('<p>' + fr(trend) + '</p><p>' + fr('Je te propose ' + (add ? 'd’ajouter ' : 'de retirer ') + Math.abs(c.change) + ' kcal par jour : ' + fmtInt(c.kcal) + ' kcal au lieu de ' + kcal + '. Je ne corrige que la moitié de l’écart, car le poids varie aussi avec l’eau.') + '</p><div class="row"><button type="button" class="btn primary" data-act="adj-apply">Passer à ' + fmtInt(c.kcal) + ' kcal</button><button type="button" class="btn ghost" data-act="adj-keep">Garder ' + kcal + ' kcal</button></div>', opt);
}

const MISSING = { sex:'si tu es un loutron ou une loutronne', birth:'ta date de naissance', height:'ta taille', weight:'ton poids', activity:'ton activité au quotidien' };
const kg = x => fmtKg(Math.round(x * 10) / 10);
const andList = l => l.length > 1 ? l.slice(0, -1).join(', ') + ' et ' + l[l.length - 1] : l[0];
const pct = x => fmtKg(Math.round(x * 100) / 100);
const signed = x => (x > 0 ? '+' : '−') + kg(Math.abs(x));
// Avis d'Émile sur l'objectif. n : réglages de l'objectif (pour la date visée)
export function verdict(pl, n, key){
  let t = '', tone = '', btn = '';
  if (pl.status === 'missing') t = 'Pour calculer tes besoins, dis-moi ' + andList(['birth', 'height', 'weight', 'activity', 'sex'].filter(k => pl.missing.indexOf(k) >= 0).map(k => MISSING[k])) + '.';
  else if (pl.status === 'keep') t = 'Pour maintenir ton poids, vise à peu près ta dépense de chaque jour, ci-dessous.';
  else if (pl.status === 'target') t = 'Indique ton poids visé.';
  else if (pl.status === 'date') t = n.by && n.by <= today() ? 'La date visée est passée : choisis-en une nouvelle.' : 'Choisis la date à laquelle tu veux l’atteindre.';
  else if (pl.status === 'direction') t = 'Ton poids visé doit être ' + (pl.goal === 'lose' ? 'sous' : 'au-dessus de') + ' ton poids actuel (' + kg(pl.start.weight) + ' kg).';
  else if (pl.status === 'minor') { tone = 'warn'; t = 'Avant 18 ans, je ne propose pas d’objectif de perte de masse grasse : ton corps grandit encore. Si ton poids te préoccupe, parles-en à ton médecin ou à un diététicien. Les besoins ci-dessous servent à maintenir ton poids.'; }
  else if (pl.status === 'bmi') { tone = 'warn'; t = 'Je ne peux pas t’accompagner jusqu’à ' + kg(pl.target) + ' kg : pour ta taille, ce poids correspond à un IMC sous 18,5, ce que l’Organisation mondiale de la santé considère comme une insuffisance pondérale. Le plus bas que je peux viser avec toi : ' + kg(pl.minKg) + ' kg. Les besoins ci-dessous servent à maintenir ton poids.'; }
  else {
    const gain = pl.goal === 'gain'; const d = Math.abs(pl.target - pl.start.weight);
    if (pl.status === 'ok') {
      tone = 'good';
      t = (gain ? 'Prendre de la masse musculaire' : 'Perdre de la masse grasse') + ' pour passer de ' + kg(pl.start.weight) + ' à ' + kg(pl.target) + ' kg d’ici le ' + fmtDateYear(n.by) + ' : ' + signed(pl.kgWeek) + ' kg par semaine, soit ' + pct(Math.abs(pl.pctWeek)) + ' % de ton poids. ';
      const adv = gain ? GAIN.advised : LOSS.advised;
      // Nettement sous le rythme conseillé (la date proposée par Émile, arrondie à la semaine, reste « le bon rythme »)
      t += Math.abs(pl.pctWeek) < adv * 0.8
        ? (gain ? 'C’est un rythme lent : jusqu’à 0,5 % par semaine reste raisonnable.' : 'C’est un rythme doux : jusqu’à 1 % par semaine reste raisonnable.')
        : (gain ? 'C’est le bon rythme pour prendre de la masse musculaire en limitant la masse grasse.' : 'C’est un rythme qui aide à préserver ta masse musculaire.');
    } else {
      tone = 'warn';
      t = (gain ? 'Prendre ' : 'Perdre ') + kg(d) + ' kg d’ici le ' + fmtDateYear(n.by) + ', c’est trop rapide : ';
      t += gain ? 'au-delà de 0,5 % de ton poids par semaine (' + kg(pl.maxKg) + ' kg pour toi), une grande part serait de la masse grasse. '
        : pl.limit === 'resting' ? 'il faudrait manger moins que ta dépense au repos (' + fmtInt(pl.bmr) + ' kcal par jour), et ça, je ne te le proposerai jamais. '
        : 'au-delà de 1 % de ton poids par semaine (' + kg(pl.maxKg) + ' kg pour toi), tu perdrais aussi de la masse musculaire. ';
      t += 'Au plus tôt, vise le ' + fmtDateYear(pl.realistic) + ' : j’ai calculé tes besoins sur ce rythme.';
      btn = '<button type="button" class="btn" data-act="n-realistic">Viser le ' + esc(fmtDateYear(pl.realistic)) + '</button>';
    }
  }
  if (pl.age != null && pl.age < 18 && pl.status !== 'minor') t += ' Ce calcul est prévu pour les adultes : avant 18 ans, prends-le comme une estimation.';
  return emile('<p>' + esc(t) + '</p>' + btn, { tone, key });
}
// Besoins du jour, hors séances
export function needs(pl, compact){
  if (pl.status === 'missing') return '';
  const st = (v, l, wide) => '<div class="stat' + (wide ? ' wide' : '') + '"><span class="v num">' + v + '</span><span class="l">' + l + '</span></div>';
  let h = (compact ? '' : '<span class="label">Tes besoins par jour</span>') + '<div class="stats needs">' + st(fmtInt(pl.kcal) + ' <small>kcal</small>', pl.extra ? 'calories aujourd’hui, séances et activités comprises' : 'calories, sans compter tes séances', true)
    + st(pl.protein[0] + '-' + pl.protein[1] + ' <small>g</small>', 'protéines') + st(pl.fat[0] + '-' + pl.fat[1] + ' <small>g</small>', 'lipides')
    + st('≈ ' + pl.carbs + ' <small>g</small>', 'glucides (le reste)') + st(pl.fibre + ' <small>g</small>', 'fibres') + '</div>';
  if (!compact) h += '<p class="muted small">Ce total ne compte pas tes séances ni tes activités : chaque jour, j’ajoute leur dépense (voir « Tes activités » dans Aujourd’hui).' + (pl.adjust ? ' Il comprend la correction de ' + signedKcal(pl.adjust) + ' issue de nos derniers points.' : '') + (pl.goal !== 'keep' ? ' Calcul approximatif : environ 7 700 kcal par kilo, et le poids varie aussi d’un jour à l’autre avec l’eau.' : '') + ' Détails dans « La science ».</p>';
  return h;
}
// Formulaire : activité, objectif, poids et date visés, puis avis d'Émile et besoins. n : { activity, goal, target, by }
export function goalForm(n, pl){
  let h = '<div class="stack" style="gap:6px"><span class="label">Ton activité au quotidien, hors sport</span>';
  Object.keys(ACTIVITY).forEach(k => { const a = ACTIVITY[k]; h += '<button type="button" class="pick' + (n.activity === k ? ' on' : '') + '" data-act="n-act" data-v="' + k + '" aria-pressed="' + (n.activity === k) + '"><span class="stack" style="gap:2px"><span class="n">' + esc(a.label) + '</span><span class="m">' + esc(a.desc) + '</span></span><span aria-hidden="true">' + (n.activity === k ? '✓' : '') + '</span></button>'; });
  h += '</div><div class="stack" style="gap:6px"><span class="label">Ton objectif</span><div class="chips" role="group">' + [['lose', 'Perdre de la masse grasse'], ['keep', 'Maintenir mon poids'], ['gain', 'Prendre de la masse musculaire']].map(o => '<button type="button" class="chip txt' + ((n.goal || 'keep') === o[0] ? ' on' : '') + '" data-act="n-goal" data-v="' + o[0] + '" aria-pressed="' + ((n.goal || 'keep') === o[0]) + '">' + o[1] + '</button>').join('') + '</div></div>';
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
  if (!n.on) return h + emile('<p>Veux-tu suivre ton alimentation ? Je calcule tes besoins en calories et en protéines, et un rythme réaliste pour perdre de la masse grasse ou prendre de la masse musculaire.</p><button type="button" class="btn primary" data-act="n-on" data-v="1">Oui, je veux suivre</button>') + '</section>';
  h += '<p class="muted small">Je me sers de ta date de naissance, de ta taille, de ton poids et de « loutron ou loutronne », ci-dessus.</p>';
  return h + goalForm(n, myPlan()) + checkSummary(n) + '<button type="button" class="btn ghost" data-act="n-on" data-v="0">Arrêter le suivi</button></section>';
}
const CHECK_DONE = { change:'ajustement refusé', ontrack:'dans le plan', offplan:'journal loin de l’objectif, rien changé', notfollowed:'objectif pas suivi, rien changé', limit:'limite atteinte, rien changé', skip:'passé, pas assez de pesées' };
const signedKcal = x => (x > 0 ? '+' : '−') + fmtInt(Math.abs(x)) + ' kcal';
function checkSummary(n){
  const nc = nextCheck(); const done = (n.checks || []).slice(-3).reverse();
  let h = '<div class="stack" style="gap:4px"><span class="label">Le point toutes les 2 semaines</span><p class="small">';
  h += nc ? (nc.date <= today() ? 'C’est le moment de faire le point : regarde dans Aujourd’hui.' : 'Prochain point le ' + esc(fmtDateYear(nc.date)) + '.') : 'Le point se fera une fois ton objectif complet.';
  if (n.adjust) h += ' Tes besoins sont corrigés de ' + signedKcal(n.adjust) + ' par jour.';
  h += '</p>' + done.map(c => '<p class="small muted">' + esc(fmtDate(c.date)) + ' : ' + (c.actual != null ? perWeek(c.actual) + ' kg par semaine' + (c.planned ? ' pour ' + perWeek(c.planned) + ' prévu' : '') + ', ' : '') + esc(c.applied ? signedKcal(c.change) + ' par jour' : CHECK_DONE[c.status] || '') + '</p>').join('');
  if (n.adjust) h += '<button type="button" class="link" data-act="adj-reset" style="align-self:flex-start">Annuler les corrections</button>';
  return h + '</div>';
}
// Aujourd'hui : ce qu'il reste à manger aujourd'hui (séances et activités comprises), en un coup d'œil
export function foodTodayCard(){
  const n = nutritionOf(); if (!S.loaded || !n.on) return '';
  const pl = dayPlan(today());
  if (pl.status === 'missing' || !(pl.kcal > 0)) return '<section class="card food-today"><h3>Ton alimentation</h3><button type="button" class="link" data-act="goal-edit">Complète ton profil pour calculer tes besoins ›</button></section>';
  const t = totals(dayDoc(today()).items); const rest = pl.kcal - t.kcal; const prot = pl.protein[0] - t.p;
  const msg = rest > 0 ? 'Il te reste ' + fmtInt(rest) + ' kcal' + (prot > 0 ? ' et ' + fmtInt(prot) + ' g de protéines' : '') + '.' : 'Objectif du jour atteint' + (prot > 0 ? ' ; il te manque ' + fmtInt(prot) + ' g de protéines.' : '.');
  return '<section class="card food-today"><div class="row between"><h3>Ton alimentation</h3><span class="muted small num">' + fmtInt(t.kcal) + ' / ' + fmtInt(pl.kcal) + ' kcal</span></div><p>' + esc(msg) + '</p>'
    + '<div class="mbar" role="img" aria-label="' + esc(fmtInt(t.kcal) + ' kcal sur ' + fmtInt(pl.kcal)) + '"><i style="width:' + Math.min(100, t.kcal / pl.kcal * 100).toFixed(1) + '%"></i></div>'
    + '<button type="button" class="btn" data-act="go-food">Noter un repas</button></section>';
}
// Carte d'Aujourd'hui : objectif, rythme et besoins du jour
export function goalTodayCard(){
  const n = nutritionOf(); if (!S.loaded || !n.on) return '';
  const pl = myPlan(); const w = bodyweight();
  if (['ok', 'fast', 'keep'].indexOf(pl.status) < 0) return verdict(pl, n, 'goal:' + today()).replace('</p>', ' <button type="button" class="link" data-act="goal-edit">Régler dans ton profil</button></p>');
  let t = pl.status === 'keep' ? 'Ton objectif : maintenir ton poids (' + kg(w) + ' kg).'
    : 'Ton objectif : ' + (pl.goal === 'gain' ? 'prendre de la masse musculaire' : 'perdre de la masse grasse') + ', jusqu’à ' + kg(pl.target) + ' kg le ' + fmtDateYear(pl.status === 'fast' ? pl.realistic : n.by) + ', à ' + signed(pl.kgWeek) + ' kg par semaine. Dernière pesée : ' + kg(w) + ' kg.';
  if (pl.status === 'ok' && w != null && (pl.goal === 'gain' ? w >= pl.target : w <= pl.target)) t = 'Tu as atteint ton poids visé, bravo ! Choisis un nouvel objectif dans ton profil.';
  // Ce qui est déjà noté dans le journal aujourd'hui
  const day = dayDoc(today()); const eat = day.items.length ? totals(day.items) : null; const dp = withExtra(pl, dayEnergy(today()).kcal);
  const ate = eat ? '<p class="small"><b>Mangé aujourd’hui : ' + fmtInt(eat.kcal) + ' / ' + fmtInt(dp.kcal) + ' kcal</b>, protéines ' + fmtInt(eat.p) + ' / ' + dp.protein[0] + ' g. <button type="button" class="link" data-act="tab" data-v="food">Ouvrir le journal</button></p>' : '<p class="small"><button type="button" class="link" data-act="tab" data-v="food">Noter ce que je mange</button></p>';
  const nc = nextCheck(); const incl = (dp.extra ? 'Dont ' + fmtInt(dp.extra) + ' kcal pour tes séances et activités du jour.' : 'Pas de séance ni d’activité aujourd’hui.') + (nc && nc.date > today() ? ' ' + withDot('Prochain point sur ton poids le ' + fmtDate(nc.date)) : '');
  return emile('<p>' + esc(hey(t)) + '</p>' + needs(dp, true) + ate + '<p class="muted small">' + esc(incl) + ' <button type="button" class="link" data-act="goal-edit">Modifier</button></p>', { title:'Ton objectif', key:'goal:' + today() });
}
