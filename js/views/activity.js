// Aujourd'hui : activités du jour (avec la séance de muscu, prévue ou faite) et eau ; fenêtre d'ajout d'une activité.
import { addDays, capFirst, esc, fmtDateLong, fmtInt, fmtKg, lowFirst, num, today } from '../util.js';
import { S } from '../store.js';
import { bodyweight, settings, sportInfo } from '../data.js';
import { activityKcal, dayEnergy, EFFORT, glassOf, LEVELS, sportPlanned, SPORTS, TYPES, waterBase, waterGoal, waterOf, WATER } from '../energy.js';

const r10 = x => Math.round(x / 10) * 10;
const liters = ml => fmtKg(Math.round(ml / 100) / 10);
const dayLabel = d => d === today() ? 'Aujourd’hui' : d === addDays(today(), -1) ? 'Hier' : capFirst(fmtDateLong(d));
const kcalText = k => k == null ? '—' : '≈ ' + fmtInt(r10(k)) + ' kcal';
export function actDetail(a){
  const min = num(a.min) ? num(a.min) + ' min' : '';
  const lv = LEVELS[a.type] && LEVELS[a.type].find(x => x[0] === a.level);
  const more = a.type === 'run' && num(a.km) ? fmtKg(num(a.km)) + ' km' : lv ? lowFirst(lv[1]) + ', ' + lv[2] : '';
  return [min, more].filter(Boolean).join(' · ');
}

export function activitiesCard(){
  if (!S.loaded) return '';
  const d = today(); const e = dayEnergy(d);
  let h = '<section class="card"><div class="row between"><h3>Tes activités</h3>' + (e.kcal ? '<span class="muted small num">' + kcalText(e.kcal) + '</span>' : '') + '</div>';
  if (!e.items.length) h += '<p class="muted small">Note ici tes autres sports pour estimer ta dépense du jour : ta séance de muscu s’ajoute toute seule.</p>';
  e.items.forEach(i => {
    const det = i.kind === 'session' ? i.min + ' min · séance ' + EFFORT[i.effort].label.toLowerCase()
      : i.kind === 'planned' ? (i.active ? 'en cours' : 'prévue') + ' · environ ' + i.min + ' min' : actDetail(i.a);
    const body = '<span class="stack" style="gap:2px"><span class="n">' + esc(i.name) + '</span><span class="m">' + esc(det) + '</span></span><span class="num">' + kcalText(i.kcal) + '</span>';
    h += i.kind === 'activity' ? '<button type="button" class="pick" data-act="act-edit" data-v="' + esc(i.id) + '">' + body + '</button>' : '<div class="pick static' + (i.kind === 'planned' ? ' planned' : '') + '">' + body + '</div>';
  });
  // Sport collectif prévu aujourd'hui et pas encore noté : un geste pour l'ajouter
  const sp = sportPlanned(d);
  if (sp && !e.items.some(i => i.kind === 'activity' && i.a.type === 'sport')) h += '<button type="button" class="btn" data-act="act-add" data-v="' + sp + '">+ ' + esc(sp === 'match' ? 'Le match prévu aujourd’hui' : capFirst(sportInfo().name) + ' prévu aujourd’hui') + '</button>';
  h += '<button type="button" class="btn" data-act="act-add">+ Ajouter une activité</button>';
  if (!bodyweight() && e.items.some(i => i.kcal == null)) h += '<p class="muted small">Indique ton poids dans « Corps et sommeil » pour estimer les calories.</p>';
  return h + '</section>';
}

export function waterCard(){
  if (!S.loaded) return '';
  const d = today(); const ml = waterOf(d); const goal = waterGoal(d); const g = glassOf(); const sport = goal - Math.round(waterBase(settings().sex) / 100) * 100;
  let h = '<section class="card"><div class="row between"><h3>Eau</h3><span class="num"><b>' + liters(ml) + '</b> / ' + liters(goal) + ' L</span></div>';
  h += '<div class="mbar big water" role="img" aria-label="' + esc(liters(ml) + ' L bus sur ' + liters(goal) + ' L') + '"><i style="width:' + Math.min(100, ml / goal * 100).toFixed(1) + '%"></i></div>';
  h += '<div class="row"><button type="button" class="btn" data-act="water" data-v="-1" aria-label="Retirer un verre"' + (ml ? '' : ' disabled') + '>−</button><button type="button" class="btn primary" data-act="water" data-v="1" style="flex:1">+ 1 verre (' + g + ' mL)</button></div>';
  h += '<details class="cue"><summary>Autre quantité, taille du verre</summary><div class="row"><input class="n" id="water-ml" inputmode="numeric" placeholder="mL" aria-label="Quantité en mL" style="width:96px"><button type="button" class="btn" data-act="water-ml">Ajouter</button>';
  h += '<label class="row" style="gap:6px;margin-left:auto"><span class="small muted">Verre</span><select id="glass">' + [150, 200, 250, 330, 500].map(v => '<option value="' + v + '"' + (v === g ? ' selected' : '') + '>' + v + ' mL</option>').join('') + '</select></label></div></details>';
  h += '<p class="muted small">Repère : ' + liters(goal - sport) + ' L de boissons par jour' + (sport > 0 ? ', plus ' + liters(sport) + ' L pour ton sport' : '') + ', davantage s’il fait chaud.</p>';
  return h + '</section>';
}

// Fenêtre d'ajout ou de modification. S.act : { type, date, min, km, level, sport, name, kcal, edit }
export const actDoc = A => ({ type:A.type, min:num(A.min), km:num(A.km), level:A.level || null, sport:A.sport || null, name:String(A.name || '').trim(), kcal:num(A.kcal) });
export function actPreview(){
  const A = S.act; const a = actDoc(A); const kc = activityKcal(a, bodyweight());
  if (kc == null) return '<p class="muted small">' + (!bodyweight() && A.type !== 'other' ? 'Indique ton poids dans « Corps et sommeil » pour estimer les calories.' : A.type === 'other' ? 'Sans calories indiquées, l’activité est notée sans dépense.' : 'Complète les champs pour estimer la dépense.') + '</p>';
  return '<p><b class="num">' + kcalText(kc) + '</b> dépensées' + (a.min > 0 ? ' · environ ' + liters(WATER.perHour * a.min / 60) + ' L d’eau en plus' : '') + '</p>';
}
export function viewActivity(){
  const A = S.act;
  let h = '<div class="row between"><button type="button" class="link" data-act="act-cancel">Annuler</button><span class="label">' + esc(dayLabel(A.date)) + '</span></div><h1>' + (A.edit ? 'Modifier l’activité' : 'Ajouter une activité') + '</h1>';
  h += '<div class="chips" role="group" aria-label="Activité">' + TYPES.map(t => '<button type="button" class="chip txt' + (A.type === t[0] ? ' on' : '') + '" data-act="act-type" data-v="' + t[0] + '" aria-pressed="' + (A.type === t[0]) + '">' + t[1] + '</button>').join('') + '</div>';
  const pick = (act, v, on, title, desc) => '<button type="button" class="pick' + (on ? ' on' : '') + '" data-act="' + act + '" data-v="' + v + '" aria-pressed="' + on + '"><span class="stack" style="gap:2px"><span class="n">' + esc(title) + '</span>' + (desc ? '<span class="m">' + esc(desc) + '</span>' : '') + '</span><span aria-hidden="true">' + (on ? '✓' : '') + '</span></button>';
  if (LEVELS[A.type]) h += '<div class="stack" style="gap:6px"><span class="label">Allure</span>' + LEVELS[A.type].map(l => pick('act-level', l[0], A.level === l[0], l[1], l[2])).join('') + '</div>';
  if (A.type === 'sport') {
    h += '<div class="stack" style="gap:6px"><span class="label">Sport</span><div class="chips" role="group">' + Object.keys(SPORTS).map(k => '<button type="button" class="chip txt' + (A.sport === k ? ' on' : '') + '" data-act="act-sport" data-v="' + k + '" aria-pressed="' + (A.sport === k) + '">' + SPORTS[k].label + '</button>').join('') + '</div>';
    h += '<div class="chips" role="group">' + [['train', 'Entraînement ou loisir'], ['match', 'Match']].map(o => '<button type="button" class="chip txt' + (A.level === o[0] ? ' on' : '') + '" data-act="act-level" data-v="' + o[0] + '" aria-pressed="' + (A.level === o[0]) + '">' + o[1] + '</button>').join('') + '</div>';
    h += '<p class="muted small">Ton sport n’est pas dans la liste ? Choisis « Autre ».</p></div>';
  }
  if (A.type === 'other') h += '<label class="f"><span>Activité</span><input data-ac="name" value="' + esc(A.name || '') + '" placeholder="ex. escalade, yoga, ski"></label>';
  h += '<div class="fields"><label class="f"><span>Durée (min)</span><input class="n" data-ac="min" inputmode="numeric" value="' + esc(A.min == null ? '' : A.min) + '" placeholder="ex. 45"></label>';
  if (A.type === 'run') h += '<label class="f"><span>Distance (km)</span><input class="n" data-ac="km" inputmode="decimal" value="' + esc(A.km == null ? '' : A.km) + '" placeholder="ex. 8"></label>';
  if (A.type === 'other') h += '<label class="f"><span>Calories actives</span><input class="n" data-ac="kcal" inputmode="numeric" value="' + esc(A.kcal == null ? '' : A.kcal) + '" placeholder="facultatif"></label>';
  h += '<label class="f"><span>Date</span><input type="date" data-ac="date" value="' + esc(A.date) + '" max="' + today() + '"></label></div>';
  // Les montres affichent les calories totales et les calories actives : le total compterait deux fois la dépense au repos
  if (A.type === 'other') h += '<p class="muted small">Sur ta montre, prends les calories actives, pas le total : ta dépense au repos est déjà dans tes besoins.</p>';
  h += '<div id="act-prev">' + actPreview() + '</div>';
  h += '<button type="button" class="btn primary big" data-act="act-save">' + (A.edit ? 'Enregistrer' : 'Ajouter') + '</button>';
  if (A.edit) h += S.confirm === 'act-del' ? '<div class="row"><span class="small">Supprimer cette activité ?</span><button type="button" class="btn danger" data-act="act-del-yes">Supprimer</button><button type="button" class="btn ghost" data-act="cancel-confirm">Garder</button></div>'
    : '<button type="button" class="btn ghost" data-act="act-del">Supprimer l’activité</button>';
  return h;
}
