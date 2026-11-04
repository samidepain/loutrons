// Calendrier en haut d'Aujourd'hui : la semaine ; toucher un jour ouvre le mois avec le détail de ce jour.
import { addDays, capFirst, esc, fmtDateLong, fmtMonth, mondayOf, monthDays, nSeries, parseIso, today } from '../util.js';
import { DAY_SHORT } from '../library.js';
import { S } from '../store.js';
import { bodyweight, countSets, daySummary, tplDef, tplEst, wName, workouts } from '../data.js';
import { workoutLines } from './history.js';
import { activityKcal, activityName, sessionKcal } from '../energy.js';
import { actDetail } from './activity.js';

const INITIALES = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
function cell(day, mois){
  const s = daySummary(day);
  const etat = s.active ? 'active' : s.done.length ? 'done' : s.planned ? 'planned' : s.acts.length ? 'act' : '';
  const nom = s.active ? wName(s.active) : s.done.length ? wName(s.done[0]) : s.planned ? tplDef(s.planned).name : s.acts.length ? activityName(s.acts[0]) : (s.label !== 'Repos' ? s.label : '');
  const dit = { active:'séance en cours', done:'séance faite', planned:'séance prévue', act:'activité', '':'' }[etat];
  const aria = fmtDateLong(day) + (dit || nom ? ' : ' + [dit, nom].filter(Boolean).join(', ') : '');
  let h = '<button type="button" class="cday' + (etat ? ' ' + etat : '') + (day === today() ? ' today' : '') + (S.calDay === day ? ' sel' : '') + '" data-act="cal-day" data-v="' + day + '" aria-label="' + esc(aria) + '">';
  if (!mois) h += '<span class="dn">' + DAY_SHORT[parseIso(day).getDay()] + '</span>';
  h += '<span class="dd">' + Number(day.slice(8)) + '</span><i class="mk" aria-hidden="true"></i>';
  if (!mois) h += '<span class="s">' + esc(nom) + '</span>';
  return h + '</button>';
}
function dayDetail(day){
  const s = daySummary(day); const t = today();
  let h = '<div class="cal-detail"><h3>' + esc(capFirst(fmtDateLong(day))) + '</h3>';
  if (s.active) h += '<p><b>' + esc(wName(s.active)) + '</b> : séance en cours.</p><button type="button" class="btn primary" data-act="tab" data-v="training">Reprendre la séance</button>';
  const kg = bodyweight(); const kc = k => k == null ? '' : ' · ≈ ' + Math.round(k / 10) * 10 + ' kcal';
  s.done.forEach(w => { h += '<div class="stack" style="gap:4px"><p><b>' + esc(wName(w)) + '</b> · ' + (w.duration || 0) + ' min · ' + nSeries(countSets(w)) + kc(sessionKcal(w, kg)) + '</p>' + workoutLines(w) + '<button type="button" class="link" data-act="cal-hist" data-v="' + esc(w.id) + '">Voir dans l’historique</button></div>'; });
  if (s.planned) {
    const tp = tplDef(s.planned);
    h += '<p>Prévu : <b>' + esc(tp.name) + '</b> · environ ' + tplEst(tp) + ' min.</p>';
    if (day === t) h += '<button type="button" class="btn primary" data-act="start" data-v="' + esc(tp.id) + '">Commencer ' + esc(tp.name) + '</button>';
  }
  s.acts.forEach(a => { h += '<p><b>' + esc(activityName(a)) + '</b>' + (actDetail(a) ? ' · ' + esc(actDetail(a)) : '') + kc(a.kcal != null ? a.kcal : activityKcal(a, kg)) + '</p>'; });
  if (!s.active && !s.done.length && !s.planned && !s.acts.length) h += '<p class="muted">' + (day < t ? 'Aucune séance notée ce jour-là.' : s.label !== 'Repos' ? esc(s.label) + ' : pas de séance de salle prévue.' : 'Repos : pas de séance prévue.') + '</p>';
  return h + '</div>';
}
export function calendarCard(){
  if (!S.loaded) return '';
  if (!S.calMonth) {
    const mon = mondayOf(today()); const n = workouts().filter(w => w.date >= mon && w.date <= addDays(mon, 6) && w.status === 'terminée').length;
    let h = '<section class="card cal"><div class="row between"><div class="stack" style="gap:2px"><h3>Ta semaine</h3><span class="muted small">' + n + ' séance' + (n > 1 ? 's faites' : ' faite') + '</span></div><button type="button" class="link" data-act="cal-month">Voir le mois</button></div><div class="cal-week">';
    for (let i = 0; i < 7; i++) h += cell(addDays(mon, i), false);
    return h + '</div><p class="muted small">Touche un jour pour voir le détail.</p></section>';
  }
  const ym = S.calMonth;
  let h = '<section class="card cal"><div class="row between"><button type="button" class="btn sm" data-act="cal-prev" aria-label="Mois précédent">‹</button><h3 class="cal-title" aria-live="polite">' + esc(capFirst(fmtMonth(ym))) + '</h3><button type="button" class="btn sm" data-act="cal-next" aria-label="Mois suivant">›</button></div>';
  h += '<div class="cal-month">' + INITIALES.map(x => '<span class="cal-h" aria-hidden="true">' + x + '</span>').join('') + monthDays(ym).map(d => d ? cell(d, true) : '<span></span>').join('') + '</div>';
  h += '<div class="row between"><span class="legend"><span><i class="mk done"></i>faite</span><span><i class="mk planned"></i>prévue</span><span><i class="mk act"></i>activité</span></span><button type="button" class="link" data-act="cal-week">Revenir à la semaine</button></div>';
  if (S.calDay && S.calDay.slice(0, 7) === ym) h += dayDetail(S.calDay);
  return h + '</section>';
}
