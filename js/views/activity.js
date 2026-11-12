// Aujourd'hui : activités du jour (avec la séance de muscu, prévue ou faite) et eau ; fenêtre d'ajout d'une activité.
import { addDays, capFirst, esc, fmtDate, fmtDateLong, fmtInt, fmtKg, lowFirst, num, today } from '../util.js';
import { S } from '../store.js';
import { bodyweight, pendingActivities, plannedActivities, settings, sportInfo } from '../data.js';
import { ICONS } from '../icons.js';
import { activityKcal, activityName, CHOICES, choiceOf, dayEnergy, EFFORT, glassOf, LEVELS, SPORTS, sportPlanned, waterAuto, waterBase, waterChosen, waterGoal, waterOf, WATER } from '../energy.js';
import { ring } from '../ring.js';
import { ic, LINE_ICON } from '../icons.js';

const r10 = x => Math.round(x / 10) * 10;
// Litres au dixième, au centième si l'objectif choisi n'est pas un multiple de 100 mL (2,25 L)
export const liters = ml => { const m = Math.round(ml / 50) * 50; return (m / 1000).toFixed(m % 100 ? 2 : 1).replace('.', ','); };
const dayLabel = d => d === today() ? 'Aujourd’hui' : d === addDays(today(), -1) ? 'Hier' : capFirst(fmtDateLong(d));
const kcalText = k => k == null ? '—' : '≈ ' + fmtInt(r10(k)) + ' kcal';
export function actDetail(a){
  const min = num(a.min) ? num(a.min) + ' min' : '';
  const lv = LEVELS[a.type] && LEVELS[a.type].find(x => x[0] === a.level);
  const more = a.type === 'run' && num(a.km) ? fmtKg(num(a.km)) + ' km' : lv ? lowFirst(lv[1]) + ', ' + lv[2] : '';
  return [min, more].filter(Boolean).join(' · ');
}

// Ligne compacte d'Aujourd'hui : nom, valeur résumée et geste rapide ; on la touche pour l'ouvrir sur place.
// Une seule ligne ouverte à la fois (S.todayOpen), gardée quand l'écran se redessine.
const CHEVRON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>';
// mark : petit repère facultatif avant la valeur (HTML déjà échappé, ex. jauge de l'eau)
export function lineCard(key, name, value, quick, body, mark){
  const open = S.todayOpen === key;
  return '<section class="card line"><div class="line-row"><button type="button" class="line-h" data-act="today-open" data-v="' + key + '" aria-expanded="' + open + '"' + (open ? ' aria-controls="line-' + key + '"' : '') + '>' + (LINE_ICON[key] ? ic(LINE_ICON[key]) : '') + '<span class="n">' + esc(name) + '</span>' + (mark || '') + '<span class="v">' + esc(value) + '</span>' + CHEVRON + '</button>' + (quick || '') + '</div>'
    + (open ? '<div class="line-body" id="line-' + key + '">' + body + '</div>' : '') + '</section>';
}

export function activitiesLine(){
  if (!S.loaded) return '';
  const d = today(); const e = dayEnergy(d); const acts = e.items.filter(i => i.kind === 'activity'); const last = acts[acts.length - 1];
  const plan = plannedActivities(d);
  const value = last ? last.name + (num(last.a.min) ? ' · ' + num(last.a.min) + ' min' : '') + (acts.length > 1 ? ' · +' + (acts.length - 1) : '') : plan.length ? 'Prévue : ' + activityName(plan[0]) + (plan.length > 1 ? ' · +' + (plan.length - 1) : '') : 'Aucune';
  let h = e.kcal ? '<p class="muted small num">Dépense du jour : ' + kcalText(e.kcal) + '</p>' : '';
  if (!e.items.length && !plan.length && !pendingActivities(d).length) h += '<p class="muted small">Note ici tes autres sports pour estimer ta dépense du jour : ta séance de muscu s’ajoute toute seule.</p>';
  e.items.forEach(i => {
    const det = i.kind === 'session' ? i.min + ' min · séance ' + EFFORT[i.effort].label.toLowerCase()
      : i.kind === 'planned' ? (i.active ? 'en cours' : 'prévue') + ' · environ ' + i.min + ' min' : actDetail(i.a);
    const body = '<span class="stack" style="gap:2px"><span class="n">' + esc(i.name) + '</span><span class="m">' + esc(det) + '</span></span><span class="num">' + kcalText(i.kcal) + '</span>';
    h += i.kind === 'activity' ? '<button type="button" class="pick" data-act="act-edit" data-v="' + esc(i.id) + '">' + body + '</button>' : '<div class="pick static' + (i.kind === 'planned' ? ' planned' : '') + '">' + body + '</div>';
  });
  // Activités prévues pour aujourd'hui : toucher la ligne la modifie, la coche la note comme faite
  plan.forEach(a => { h += '<div class="quick"><button type="button" class="pick planned" data-act="act-edit" data-v="' + esc(a.id) + '"><span class="stack" style="gap:2px"><span class="n">' + esc(activityName(a)) + '</span><span class="m">' + esc('prévue · ' + actDetail(a)) + '</span></span></button>'
    + '<button type="button" class="plus ok" data-act="act-done" data-v="' + esc(a.id) + '" aria-label="' + esc('Marquer ' + lowFirst(activityName(a)) + ' comme faite') + '">' + ICONS.check + '</button></div>'; });
  // Activités prévues les jours précédents et jamais notées : la coche les note à leur date, toucher la ligne permet de les retirer
  const late = pendingActivities(d);
  late.forEach(a => { h += '<div class="quick"><button type="button" class="pick planned" data-act="act-edit" data-v="' + esc(a.id) + '"><span class="stack" style="gap:2px"><span class="n">' + esc(activityName(a)) + '</span><span class="m">' + esc('prévue le ' + fmtDate(a.date) + ' · pas notée') + '</span></span></button>'
    + '<button type="button" class="plus ok" data-act="act-done" data-v="' + esc(a.id) + '" aria-label="' + esc('Marquer ' + lowFirst(activityName(a)) + ' du ' + fmtDate(a.date) + ' comme faite') + '">' + ICONS.check + '</button></div>'; });
  // Sport collectif prévu aujourd'hui et pas encore noté : un geste pour l'ajouter
  const sp = sportPlanned(d);
  if (sp && !e.items.some(i => i.kind === 'activity' && i.a.type === 'sport')) h += '<button type="button" class="btn" data-act="act-add" data-v="' + sp + '">+ ' + esc(sp === 'match' ? 'Le match prévu aujourd’hui' : capFirst(sportInfo().name) + ' prévu aujourd’hui') + '</button>';
  if (!bodyweight() && e.items.some(i => i.kcal == null)) h += '<p class="muted small">Indique ton poids dans « Poids et sommeil » pour estimer les calories.</p>';
  h += '<button type="button" class="btn" data-act="act-add" data-p="1">+ Prévoir une activité</button>';
  return lineCard('activites', 'Activités', value, '<button type="button" class="btn" data-act="act-add">+ Ajouter</button>', h);
}

export function waterLine(){
  if (!S.loaded) return '';
  const d = today(); const ml = waterOf(d); const goal = waterGoal(d); const auto = waterAuto(d); const chosen = waterChosen(); const g = glassOf();
  let h = '<div class="mbar big water" role="img" aria-label="' + esc(liters(ml) + ' L bus sur ' + liters(goal) + ' L') + '"><i style="width:' + Math.min(100, ml / goal * 100).toFixed(1) + '%"></i></div>';
  h += '<div class="row"><button type="button" class="btn" data-act="water" data-v="-1"' + (ml ? '' : ' disabled') + '>− 1 verre</button><span class="muted small">Verre de ' + g + ' mL</span></div>';
  h += '<details class="cue"><summary>Autre quantité, taille du verre</summary><div class="row"><input class="n" id="water-ml" inputmode="numeric" placeholder="mL" aria-label="Quantité en mL" style="width:96px"><button type="button" class="btn" data-act="water-ml">Ajouter</button>';
  h += '<label class="row" style="gap:6px;margin-left:auto"><span class="small muted">Verre</span><select id="glass">' + [150, 200, 250, 330, 500].map(v => '<option value="' + v + '"' + (v === g ? ' selected' : '') + '>' + v + ' mL</option>').join('') + '</select></label></div></details>';
  // Objectif du jour : choisi par la personne (réglage waterGoal), sinon le repère de l'appli ; les quantités déjà bues ne changent pas
  h += '<div class="stack water-goal"><span class="label">Objectif par jour</span><div class="row"><label class="fld"><input class="n" id="water-goal" inputmode="decimal" value="' + esc(liters(goal)) + '" aria-label="Objectif d’eau par jour, en litres"><span>L</span></label>'
    + (chosen ? '<button type="button" class="btn ghost" data-act="water-auto">Revenir au repère (' + liters(auto) + ' L)</button>' : '') + '</div>'
    + '<p class="muted small">' + (chosen ? 'Objectif choisi par toi.' : 'Repère de l’appli : ' + liters(auto) + ' L (boissons' + (auto > waterBase(settings().sex) ? ', sport compris' : '') + ').') + ' Il s’applique à la jauge du jour ; tes quantités déjà bues ne changent pas.</p></div>';
  h += '<details class="cue"><summary>Quel objectif choisir ?</summary><p class="small">Repère général : l’EFSA estime qu’une femme adulte a besoin d’environ 2,0 L d’eau par jour et un homme adulte de 2,5 L, tous apports compris. Les aliments en fournissent environ 20 % : cela fait à peu près 1,6 L et 2,0 L de boissons, par temps tempéré et avec une activité modérée.</p>'
    + '<p class="small">Les besoins varient d’une personne à l’autre : la chaleur, le sport, la grossesse ou l’allaitement les augmentent. Ce n’est pas un conseil médical : si un professionnel de santé t’a donné une consigne (cœur, reins, traitement), suis la sienne.</p><p class="muted small">Source : EFSA, 2010 (valeurs de référence pour l’eau).</p></details>';
  return lineCard('eau', 'Eau', liters(ml) + ' / ' + liters(goal) + ' L', '<button type="button" class="btn" data-act="water" data-v="1">+ 1 verre</button>', h, ring(ml / goal, { cls:'xxs' }));
}

// Fenêtre d'ajout ou de modification. S.act : { type, date, min, km, level, sport, name, kcal, edit }
export const actDoc = A => ({ type:A.type, min:num(A.min), km:num(A.km), level:A.level || null, sport:A.sport || null, name:String(A.name || '').trim(), kcal:num(A.kcal) });
export function actPreview(){
  const A = S.act; const a = actDoc(A); const kc = activityKcal(a, bodyweight());
  if (kc == null) return '<p class="muted small">' + (!bodyweight() && A.type !== 'other' ? 'Indique ton poids dans « Poids et sommeil » pour estimer les calories.' : A.type === 'other' ? 'Sans calories indiquées, l’activité est notée sans dépense.' : 'Complète les champs pour estimer la dépense.') + '</p>';
  return '<p><b class="num">' + kcalText(kc) + '</b> ' + (A.planned ? 'prévues' : 'dépensées') + (a.min > 0 ? ' · environ ' + liters(WATER.perHour * a.min / 60) + ' L d’eau en plus' : '') + '</p>';
}
export function viewActivity(){
  const A = S.act; const pl = !!A.planned;
  let h = '<div class="row between"><button type="button" class="link" data-act="act-cancel">Annuler</button><span class="label">' + esc(dayLabel(A.date)) + '</span></div><h1>' + (pl ? (A.edit ? 'Modifier l’activité prévue' : 'Prévoir une activité') : A.edit ? 'Modifier l’activité' : 'Ajouter une activité') + '</h1>';
  // Les choix sont rangés par groupe : endurance, sports collectifs, sports individuels, puis « Autre »
  const chip = t => '<button type="button" class="chip txt' + (choiceOf(A) === t[0] ? ' on' : '') + '" data-act="act-type" data-v="' + t[0] + '" aria-pressed="' + (choiceOf(A) === t[0]) + '">' + t[1] + '</button>';
  const grp = (title, list) => '<div class="stack"><span class="label">' + title + '</span><div class="chips" role="group" aria-label="' + title + '">' + list.map(chip).join('') + '</div></div>';
  const sports = g => CHOICES.filter(c => c[0].indexOf('sport:') === 0 && SPORTS[c[0].slice(6)].group === g);
  h += grp('Endurance', CHOICES.filter(c => ['run', 'bike', 'swim', 'walk'].indexOf(c[0]) >= 0)) + grp('Sports collectifs', sports('collectif')) + grp('Sports individuels', sports('individuel'))
    + '<div class="chips" role="group" aria-label="Autre activité">' + CHOICES.filter(c => c[0] === 'other').map(chip).join('') + '</div>';
  const pick = (act, v, on, title, desc) => '<button type="button" class="pick' + (on ? ' on' : '') + '" data-act="' + act + '" data-v="' + v + '" aria-pressed="' + on + '"><span class="stack" style="gap:2px"><span class="n">' + esc(title) + '</span>' + (desc ? '<span class="m">' + esc(desc) + '</span>' : '') + '</span><span aria-hidden="true">' + (on ? '✓' : '') + '</span></button>';
  if (LEVELS[A.type]) h += '<div class="stack" style="gap:6px"><span class="label">Allure</span>' + LEVELS[A.type].map(l => pick('act-level', l[0], A.level === l[0], l[1], l[2])).join('') + '</div>';
  if (A.type === 'sport') {
    h += '<div class="stack" style="gap:6px"><div class="chips" role="group" aria-label="Entraînement ou match">' + [['train', 'Entraînement ou loisir'], ['match', 'Match']].map(o => '<button type="button" class="chip txt' + (A.level === o[0] ? ' on' : '') + '" data-act="act-level" data-v="' + o[0] + '" aria-pressed="' + (A.level === o[0]) + '">' + o[1] + '</button>').join('') + '</div>';
    h += '</div>';
  }
  if (A.type === 'other') h += '<p class="muted small">« Autre » : pour une activité qui n’est pas dans la liste.</p>';
  if (A.type === 'other') h += '<label class="f"><span>Activité</span><input data-ac="name" value="' + esc(A.name || '') + '" placeholder="ex. escalade, yoga, ski"></label>';
  // Prévoir : aujourd'hui, demain ou après-demain en un geste (la date exacte reste dans le champ)
  if (pl && !A.edit) h += '<div class="stack"><span class="label">Quand</span><div class="chips" role="group" aria-label="Jour prévu">' + [[0, 'Aujourd’hui'], [1, 'Demain'], [2, 'Après-demain']].map(o => { const dd = addDays(today(), o[0]); return '<button type="button" class="chip txt' + (A.date === dd ? ' on' : '') + '" data-act="act-pdate" data-v="' + dd + '" aria-pressed="' + (A.date === dd) + '">' + o[1] + '</button>'; }).join('') + '</div></div>';
  h += '<div class="fields"><label class="f"><span>Durée (min)</span><input class="n" data-ac="min" inputmode="numeric" value="' + esc(A.min == null ? '' : A.min) + '" placeholder="ex. 45"></label>';
  if (A.type === 'run') h += '<label class="f"><span>Distance (km)</span><input class="n" data-ac="km" inputmode="decimal" value="' + esc(A.km == null ? '' : A.km) + '" placeholder="ex. 8"></label>';
  if (A.type === 'other') h += '<label class="f"><span>Calories actives</span><input class="n" data-ac="kcal" inputmode="numeric" value="' + esc(A.kcal == null ? '' : A.kcal) + '" placeholder="facultatif"></label>';
  h += '<label class="f"><span>Date</span><input type="date" data-ac="date" value="' + esc(A.date) + '"' + (pl ? (A.edit ? '' : ' min="' + today() + '"') : ' max="' + today() + '"') + '></label></div>';
  // Les montres affichent les calories totales et les calories actives : le total compterait deux fois la dépense au repos
  if (A.type === 'other') h += '<p class="muted small">Sur ta montre, prends les calories actives, pas le total : ta dépense au repos est déjà dans tes besoins.</p>';
  h += '<div id="act-prev">' + actPreview() + '</div>';
  h += '<button type="button" class="btn primary big" data-act="act-save">' + (A.edit ? 'Enregistrer' : pl ? 'Prévoir' : 'Ajouter') + '</button>';
  // Activité prévue dont le jour est venu : on peut la noter comme faite, avec les changements saisis
  if (pl && A.edit && A.date <= today()) h += '<button type="button" class="btn" data-act="act-save" data-v="done">Marquer comme faite</button>';
  if (A.edit) h += S.confirm === 'act-del' ? '<div class="row"><span class="small">Supprimer cette activité ?</span><button type="button" class="btn danger" data-act="act-del-yes">Supprimer</button><button type="button" class="btn ghost" data-act="cancel-confirm">Garder</button></div>'
    : '<button type="button" class="btn ghost" data-act="act-del">Supprimer l’activité</button>';
  return h;
}
