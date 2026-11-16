// Écran Entraînement (hors séance en cours) : ton programme, ses séances, les exercices, le planning.
import { addDays, capFirst, esc, fmtDateLong, lowFirst, mondayOf, nbsp, parseIso, today } from '../util.js';
import { DAY_ORDER, DAY_SHORT, KINDS, MUSCLES } from '../library.js';
import { S } from '../store.js';
import { allEx, allTpl, excluded, jumpsOn, mods, nextSession, perWeekOf, plannedDates, plannedSessions, programOf, rotationOf, searchEx, settings, sportInfo, sportOn, startDate, tplDef, tplEst, tplItems, weekInfo } from '../data.js';
import { introCard } from './intro.js';
import { swipeRow } from '../swipe.js';

const PTABS = [['seances','Séances'],['planning','Planning'],['exercices','Exercices']];
export function viewProgram(){
  let h = '<h1>Entraînement</h1><div class="seg" role="tablist">' + PTABS.map(t => '<button type="button" class="chip' + (S.progTab === t[0] ? ' on' : '') + '" data-act="ptab" data-v="' + t[0] + '" role="tab" aria-selected="' + (S.progTab === t[0]) + '">' + t[1] + '</button>').join('') + '</div>';
  if (!S.loaded) return h + '<p class="loading">Chargement…</p>';
  // Premier lancement, aucune séance faite : la rubrique s'explique d'abord (sans les sous-onglets)
  const intro = introCard('training'); if (intro) return '<h1>Entraînement</h1>' + intro;
  if (S.progTab === 'exercices') return h + viewExercises();
  if (S.progTab === 'planning') return h + viewPlanning();
  return h + viewTemplates();
}
function programCard(){
  const g = programOf() || {};
  let h = '<section class="card"><span class="label">Ton programme</span>';
  h += S.renaming
    ? '<div class="row"><input class="plain" id="prog-name" value="' + esc(g.name || '') + '" aria-label="Nom du programme" style="flex:1;width:auto;min-width:0"><button type="button" class="btn primary" data-act="prog-rename-save">Enregistrer</button></div>'
    : '<div class="row between"><h2>' + esc(g.name || 'Mon programme') + '</h2><button type="button" class="link" data-act="prog-rename">Renommer</button></div>';
  return h + '<button type="button" class="btn" data-act="prog-change">Changer de programme</button></section>';
}
export function noTplCard(){
  return '<section class="card"><h2>Crée ta première séance</h2><button type="button" class="btn primary big" data-act="go-new-tpl">Créer une séance</button></section>';
}
// Séances : la prochaine de la rotation d'abord, en carte vedette avec un grand « Commencer » ; les autres en gris, avec le strict
// nécessaire (nom, nombre d'exercices, durée) ; « Créer » puis « Ton programme » (réglages rares) en bas
function viewTemplates(){
  const next = nextSession(); let h = '';
  const tpls = allTpl(); const first = tpls.filter(t => t.id === next);
  first.concat(tpls.filter(t => t.id !== next)).forEach(t => {
    const its = tplItems(t); const up = t.id === next;
    let c = '<section class="card tpl' + (up ? ' hero' : '') + '"><div class="row between"><div class="stack" style="gap:2px">' + (up ? '<span class="label">Ta prochaine séance</span>' : '') + '<h2 class="tpl-name">' + esc(t.name) + '</h2><span class="muted small">' + its.length + ' exercices · environ ' + tplEst(t) + ' min</span></div></div>';
    c += up ? '<button type="button" class="btn primary big" data-act="start" data-v="' + esc(t.id) + '">Commencer</button><button type="button" class="link tpl-edit" data-act="edit-tpl" data-v="' + esc(t.id) + '">Modifier la séance</button></section>'
      : '<div class="tpl-btns"><button type="button" class="btn" data-act="start" data-v="' + esc(t.id) + '">Commencer</button><button type="button" class="btn" data-act="edit-tpl" data-v="' + esc(t.id) + '">Modifier</button></div></section>';
    // Une séance perso se supprime en la balayant ; celles du programme de base ne se suppriment pas
    h += t.builtin ? c : swipeRow(c, 'tpl-swipe-del', esc(t.id), 'Supprimer la séance ' + esc(t.name), '').replace('class="sw"', 'class="sw card-r"');
  });
  return h + '<button type="button" class="btn big" data-act="new-tpl">+ Créer une séance</button>' + programCard();
}
function viewExercises(){
  const h = '<input class="plain" type="search" id="ex-q" data-xq="1" placeholder="Nom, muscle ou « DC »…" aria-label="Rechercher un exercice" value="' + esc(S.exQ || '') + '" autocomplete="off" enterkeyhint="search">';
  return h + '<div class="stack" id="ex-list" style="gap:16px">' + exerciseList() + '</div><button type="button" class="btn big" data-act="new-ex">+ Créer un exercice</button>';
}
const exRow = (e, hidden) => (e.custom ? row => swipeRow(row, 'ex-swipe-del', esc(e.id), 'Supprimer ' + esc(e.name), '') : row => row)('<button type="button" class="pick" data-act="ex-fiche" data-v="' + esc(e.id) + '"><span class="stack" style="gap:2px"><span class="n">' + esc(e.name) + '</span><span class="m">' + esc(KINDS[e.kind] || '') + (e.kind === 'load' || e.kind === 'bw' ? ' · ' + e.sets + ' × ' + e.lo + '-' + e.hi : e.kind === 'cardio' ? ' · ' + e.lo + ' min' : '') + (e.custom ? ' · perso' : '') + (hidden ? ' · masqué' : '') + '</span></span><span aria-hidden="true">›</span></button>');
// Avec une recherche : résultats du plus proche au moins proche ; sinon, groupes par muscle principal
export function exerciseList(){
  const hid = excluded(); const list = allEx().filter(e => e.kind !== 'plyo' || jumpsOn());
  if (String(S.exQ || '').trim()) {
    const r = searchEx(list, S.exQ);
    return r.length ? '<section class="card"><h3>' + r.length + ' résultat' + (r.length > 1 ? 's' : '') + '</h3>' + r.map(e => exRow(e, hid.indexOf(e.id) >= 0)).join('') + '</section>'
      : '<p class="empty">Aucun exercice trouvé. Tu peux le créer en bas de la liste.</p>';
  }
  const groups = {};
  list.forEach(e => { const g = hid.indexOf(e.id) >= 0 ? 'Masqués' : e.kind === 'plyo' ? 'Pliométrie' : e.kind === 'cardio' ? 'Cardio' : ((e.muscles.p || [])[0] || 'Autres'); (groups[g] = groups[g] || []).push(e); });
  return [...MUSCLES, 'Cardio', 'Pliométrie', 'Autres', 'Masqués'].filter(g => groups[g]).map(g =>
    g === 'Masqués'
      // exercices masqués, tout en bas : on peut les réafficher d'ici (anciennement dans le profil)
      ? '<section class="card"><h3>Exercices masqués <span class="muted small">' + groups[g].length + '</span></h3>' + groups[g].map(e => '<div class="pick static"><span class="n">' + esc(e.name) + '</span><button type="button" class="btn" data-act="ex-unhide" data-v="' + esc(e.id) + '">Réafficher</button></div>').join('') + '</section>'
      : '<section class="card"><h3>' + esc(g) + ' <span class="muted small">' + groups[g].length + '</span></h3>' + groups[g].map(e => exRow(e, false)).join('') + '</section>').join('');
}
// Planning : ta rotation (à glisser), tes jours prévus, cette semaine, et les deux réglages de l'entraînement.
// Les douleurs suivies et les autres sports se règlent dans le profil (Paramètres).
function viewPlanning(){
  const tpls = allTpl(); const rot = rotationOf(); const per = perWeekOf(); const off = tpls.filter(t => rot.indexOf(t.id) < 0);
  let h = '<section class="card"><h3>Ta rotation</h3>';
  if (!tpls.length) h += '<p class="small">Crée d’abord tes séances dans l’onglet Séances.</p>';
  if (rot.length > 1) h += '<p class="muted small">Maintiens une séance et glisse-la pour changer l’ordre.</p>';
  h += '<div class="rot-list">' + rot.map((id, i) => rotRow(tplDef(id), i, true)).join('') + '</div>';
  if (off.length) h += '<span class="label">Hors rotation</span><div class="rot-list">' + off.map(t => rotRow(t, -1, false)).join('') + '</div>';
  h += '<span class="label">Séances par semaine</span><div class="chips" role="group" aria-label="Séances par semaine">' + [2, 3, 4, 5, 6].map(n => '<button type="button" class="chip' + (per === n ? ' on' : '') + '" data-act="per-week" data-v="' + n + '" aria-pressed="' + (per === n) + '">' + n + '</button>').join('') + '</div>';
  if (Array.isArray(settings().rotation) || Array.isArray(settings().rotOff)) h += '<button type="button" class="link" data-act="reset-rotation">Revenir à l’ordre du programme</button>';
  return h + '</section>' + planAheadCard() + weekCard() + settingsCard();
}
// Une séance de la rotation : poignée (on glisse la ligne ; au clavier, flèches haut et bas sur la poignée), rang, nom, case « dans la rotation »
const GRIP = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9h12M6 15h12"/></svg>';
function rotRow(t, i, on){
  const id = esc(t.id); const nm = esc(t.name);
  return '<div class="rot-row' + (on ? '" data-rot="' + id : ' off') + '">'
    + (on ? '<button type="button" class="rot-grip" data-v="' + id + '" aria-label="Déplacer ' + nm + ', position ' + (i + 1) + ' : flèches haut et bas">' + GRIP + '</button><span class="rot-n num" aria-hidden="true">' + (i + 1) + '</span>' : '')
    + '<span class="rot-name">' + nm + '</span>'
    + '<input type="checkbox" class="rot-in" data-act="rot-toggle" data-v="' + id + '"' + (on ? ' checked' : '') + ' aria-label="' + nm + ' dans la rotation"></div>';
}
// Prévoir tes séances (facultatif) : cette semaine et la suivante ; les jours prévus reçoivent la rotation dans l'ordre
function planAheadCard(){
  const t = today(); const mon = mondayOf(t); const planned = plannedDates(); const ses = plannedSessions();
  let h = '<section class="card"><h3>Prévoir tes séances</h3><p class="muted small">Facultatif : touche les jours où tu comptes venir.</p>';
  [0, 7].forEach(off => {
    h += '<span class="label">' + (off ? 'Semaine prochaine' : 'Cette semaine') + '</span><div class="days" role="group" aria-label="' + (off ? 'Semaine prochaine' : 'Cette semaine') + '">';
    for (let i = 0; i < 7; i++) { const d = addDays(mon, off + i); const on = planned.indexOf(d) >= 0;
      h += '<button type="button" class="chip txt plan-chip' + (on ? ' on' : '') + '" data-act="plan-day" data-v="' + d + '" aria-pressed="' + on + '"' + (d < t ? ' disabled' : '') + '>' + DAY_SHORT[DAY_ORDER[i]] + '<span class="num">' + parseIso(d).getDate() + '</span></button>'; }
    h += '</div>';
  });
  const list = Object.keys(ses);
  if (list.length) h += '<p class="small">' + list.map(d => esc(nbsp(capFirst(fmtDateLong(d)) + ' : ' + tplDef(ses[d]).name))).join('<br>') + '</p>';
  return h + '</section>';
}
// Cette semaine : semaine chargée en sport (si sport et détente), décharge anticipée
function weekCard(){
  const wk = weekInfo(today());
  let h = '<section class="card"><h3>Cette semaine</h3>';
  if (sportOn() && jumpsOn()) h += '<label class="toggle"><input type="checkbox" id="busy-week" data-act="busy"' + (wk.busy ? ' checked' : '') + '><span><b>Semaine chargée en ' + esc(lowFirst(sportInfo().name)) + '</b><br><span class="muted small">Pas de sauts en salle cette semaine.</span></span></label>';
  h += '<label class="toggle"><input type="checkbox" id="deload-week" data-act="deload"' + (wk.forced ? ' checked' : '') + (wk.bw !== 6 ? '' : ' disabled') + '><span><b>Semaine plus légère</b><br><span class="muted small">' + (wk.bw === 6 ? 'C’est déjà ta semaine de décharge.' : 'Si tu es fatigué : mêmes charges, moins de séries.') + '</span></span></label>';
  return h + '</section>';
}
// Réglages de l'entraînement : début du programme, détente et sauts
function settingsCard(){
  return '<section class="card"><h3>Réglages</h3><label class="f"><span>Début du programme (un lundi)</span><input type="date" class="plain" id="start-date" value="' + esc(startDate()) + '"></label>'
    + '<label class="toggle"><input type="checkbox" id="mod-jumps" data-act="mod" data-v="jumps"' + (mods().jumps ? ' checked' : '') + '><span><b>Détente et sauts</b><br><span class="muted small">Des sauts dans tes séances et un test de détente à chaque bloc.</span></span></label></section>';
}
