// Écran Profil : en-tête, progrès et liste des paramètres (informations, douleurs, autres sports, alimentation, apparence, sauvegarde) ;
// les réglages de l'entraînement sont dans Entraînement › Planning.
import { esc, mondayOf, nbsp, fmtDate, fmtDateLong, fmtDateYear, fmtInt, fmtKg, fmtMonth, num, today, withDot } from '../util.js';
import { S } from '../store.js';
import { backupDue, bodyDocs, mods, settings, sportInfo, startDate, workouts } from '../data.js';
import { DAY_ORDER, DAY_SHORT } from '../library.js';
import { CHOICES, mySports, SPORTS } from '../energy.js';
import { recordLog } from '../engine.js';
import { lineCard } from './activity.js';
import { useShare } from '../backup.js';
import { VERSION } from '../version.js';
import { emile } from '../emile.js';
import { GOALS, goalProfileCard, nutritionOf } from './goal.js';
import { painZones, ZONE_IDS, ZONES } from '../pain.js';
import { avatarReady } from '../avatar.js';
import { avatarImg } from './avatar.js';
import { badges, XP, xpState } from '../levels.js';
import { ic } from '../icons.js';

// « Tu es un loutron ou une loutronne ? » : facultatif, un second appui sur le choix l'annule
export function sexChips(act, val){
  return '<div class="stack" style="gap:6px"><span class="label">Tu es un loutron ou une loutronne ?</span><div class="chips" role="group">' +
    [['m', 'Un loutron'], ['f', 'Une loutronne']].map(o => '<button type="button" class="chip txt' + (val === o[0] ? ' on' : '') + '" data-act="' + act + '" data-v="' + o[0] + '" aria-pressed="' + (val === o[0]) + '">' + o[1] + '</button>').join('') + '</div></div>';
}
// Retour vers l'écran d'où le profil a été ouvert
const FROM = { today:'Aujourd’hui', training:'Entraînement', food:'Alimentation', progress:'Progrès', social:'Social' };
export function viewProfile(){
  const s = settings(); const pesees = bodyDocs().filter(b => num(b.weight) > 0); const last = pesees[pesees.length - 1];
  let h = '<div class="row"><button type="button" class="link" data-act="profile-back" data-back>‹ ' + (FROM[S.from] || FROM.today) + '</button></div>';
  // En-tête en carte vedette : initiale, prénom, ancienneté, puis séances, semaines et records ; sans séance, Émile dit quand les chiffres arrivent (jamais de « 0 »)
  const ws = workouts().filter(w => w.status === 'terminée'); const since = s.created || (ws[0] && ws[0].date) || startDate(); const who = String(s.name || '').trim(); const wk = new Set(ws.map(w => mondayOf(w.date))).size; const recs = recordLog().length;
  h += '<section class="card hero prof-card"><div class="prof-head">' + (avatarReady() ? avatarImg(s.avatar, 'head prof-av') : '<span class="prof-ini" aria-hidden="true">' + esc((who[0] || '?').toUpperCase()) + '</span>') + '<div class="prof-id"><h1>' + esc(who || 'Profil') + '</h1><span class="muted">' + esc((s.sex === 'f' ? 'Loutronne' : s.sex === 'm' ? 'Loutron' : 'Sur Loutrons') + ' depuis ' + fmtMonth(since.slice(0, 7))) + '</span></div></div>';
  if (ws.length) h += levelBar();
  h += ws.length ? '<div class="stats"><div class="stat"><span class="v num">' + ws.length + '</span><span class="l">' + (ws.length > 1 ? 'séances' : 'séance') + '</span></div><div class="stat"><span class="v num">' + wk + '</span><span class="l">' + (wk > 1 ? 'semaines actives' : 'semaine active') + '</span></div><div class="stat"><span class="v num">' + (recs || '—') + '</span><span class="l">' + (recs > 1 ? 'records' : 'record') + '</span></div></div>'
    : emile('<p>' + esc(nbsp('Dès ta première séance, tes chiffres et tes records apparaissent ici.')) + '</p>');
  if (avatarReady()) h += '<button type="button" class="btn" data-act="av-open">Personnaliser mon avatar</button>';
  h += '</section>';
  // Raccourci vers Progrès : dernière séance et records, sans répéter les courbes
  if (ws.length) { const lastDay = ws.map(w => w.date).sort().pop(); h += '<button type="button" class="pick" data-act="tab" data-v="progress"><span class="stack prof-id"><span class="n">Tes progrès</span><span class="m">' + esc(withDot('Dernière séance : ' + fmtDate(lastDay))) + '</span></span><span aria-hidden="true">›</span></button>'; }
  if (ws.length) { const got = badges().filter(b => b.got).length; h += row('level', 'Niveau et badges', 'Niveau ' + xpState().level + ' · ' + got + (got > 1 ? ' badges' : ' badge')); }
  // Paramètres : une ligne par rubrique, chacune ouvre son écran (viewSettings) au lieu d'un long écran de réglages
  const n = nutritionOf(); const ws2 = workouts(); const due = backupDue() || (!s.lastExport && ws2.length > 0);
  const info = [who, s.height != null && fmtKg(num(s.height)) + ' cm', last && fmtKg(num(last.weight)) + ' kg'].filter(Boolean).join(' · ');
  const names = k => CHOICES.filter(c => k.indexOf(c[0]) >= 0).map(c => c[1]).join(', ');
  h += '<h2>Paramètres</h2>';
  h += row('toi', 'Informations personnelles', info || 'Prénom, taille, poids');
  h += '<button type="button" class="pick" data-act="go-planning"><span class="stack prof-id"><span class="n">Entraînement</span><span class="m">Rotation, séances par semaine, début du programme</span></span><span aria-hidden="true">›</span></button>';
  h += row('pain', 'Douleurs et limitations', painZones().map(z => ZONES[z].label).join(', ') || 'Aucune suivie');
  h += row('sports', 'Autres sports', names(mySports()) || 'Musculation seulement');
  h += row('food', 'Alimentation', n.on ? GOALS[n.goal || 'keep'] : 'Suivi désactivé');
  h += row('look', 'Apparence', THEMES[s.theme || 'auto']);
  h += row('data', 'Sauvegarde et données', s.lastExport ? withDot('Dernière sauvegarde : ' + fmtDate(s.lastExport)) : 'Aucune sauvegarde', due ? '<span class="pill warn">À sauvegarder</span>' : '');
  h += '<p class="muted small prof-ver">Loutrons · version ' + esc(VERSION) + '<br>Loutrons ne remplace pas un avis médical.</p>';
  return h;
}
const THEMES = { auto:'Automatique', light:'Clair', dark:'Sombre' };
// Niveau, XP et barre vers le niveau suivant (en-tête du profil, écran « Niveau et badges », fin de séance)
export function levelBar(){
  const x = xpState(); const pct = Math.round((x.total - x.from) / (x.to - x.from) * 100);
  return '<div class="lvl"><div class="row between"><b>Niveau ' + x.level + '</b><span class="muted small num">' + fmtInt(x.total) + '&nbsp;XP</span></div><div class="bar" aria-hidden="true"><i style="width:' + pct + '%"></i></div><span class="muted small">' + esc(nbsp('Encore ' + fmtInt(x.to - x.total) + ' XP avant le niveau ' + (x.level + 1))) + '</span></div>';
}
// Écran « Niveau et badges » : où en est la personne, d'où vient son XP, comment en gagner, et ses badges (obtenus d'abord)
function viewLevel(){
  const x = xpState(); const p = x.parts; const pl = (n, mot) => n + ' ' + mot + (n > 1 ? 's' : '');
  const ligne = (nom, part) => '<div class="row between"><span>' + nom + '</span><b class="num">' + fmtInt(part.xp) + '&nbsp;XP</b></div>';
  let h = '<section class="card hero">' + levelBar() + '</section>';
  h += '<section class="card"><h3>D’où vient ton XP</h3>' + ligne(pl(p.sessions.n, 'séance'), p.sessions) + ligne('Régularité', p.regular) + ligne(pl(p.records.n, 'record'), p.records) + ligne(pl(p.blocks.n, 'bloc') + (p.blocks.n > 1 ? ' terminés' : ' terminé'), p.blocks)
    + '<p class="muted small">' + esc(nbsp(XP.session + ' XP par séance terminée (une par jour), ' + XP.regular + ' de plus par séance à partir de la 2e de la semaine, ' + XP.record + ' par record (' + XP.recordsMax + ' au plus par séance), ' + XP.block + ' par bloc de 6 semaines mené au bout. L’XP ne baisse jamais.')) + '</p></section>';
  const bs = badges(); const tri = bs.filter(b => b.got).concat(bs.filter(b => !b.got));
  h += '<section class="card"><h3>Tes badges <span class="muted small num">' + bs.filter(b => b.got).length + ' sur ' + bs.length + '</span></h3><div class="badges">' + tri.map(b => '<div class="badge' + (b.got ? ' got' : '') + '">' + ic(b.got ? 'check' : 'trend') + '<span class="stack prof-id"><b>' + esc(b.name) + '</b><span class="muted small">' + esc(b.got ? 'Obtenu' : b.how) + '</span></span></div>').join('') + '</div></section>';
  return h;
}
const row = (v, n, m, pill) => '<button type="button" class="pick" data-act="set-open" data-v="' + v + '"><span class="stack prof-id"><span class="n">' + n + '</span><span class="m">' + esc(m) + '</span>' + (pill || '') + '</span><span aria-hidden="true">›</span></button>';
// Écran d'une rubrique des paramètres (S.set) ; mêmes lignes et champs qu'avant, enregistrés à la sortie du champ
const SET_TITLES = { level:'Niveau et badges', toi:'Informations personnelles', pain:'Douleurs et limitations', sports:'Autres sports', food:'Alimentation', look:'Apparence', data:'Sauvegarde et données' };
export function viewSettings(){
  const k = SET_TITLES[S.set] ? S.set : 'toi';
  let h = '<div class="row"><button type="button" class="link" data-act="profile" data-back>‹ Profil</button></div><h1>' + SET_TITLES[k] + '</h1>';
  return h + (k === 'level' ? viewLevel() : k === 'toi' ? settingsToi() : k === 'pain' ? settingsPain() : k === 'sports' ? settingsSports() : k === 'food' ? goalProfileCard() : k === 'look' ? settingsLook() : viewSettingsCards());
}
function settingsToi(){
  const s = settings(); const pesees = bodyDocs().filter(b => num(b.weight) > 0); const last = pesees[pesees.length - 1]; const who = String(s.name || '').trim();
  const vide = 'À indiquer'; const age = s.birth ? Math.floor((Date.parse(today()) - Date.parse(s.birth)) / 31557600000) : null;
  let h = lineCard('p-name', 'Prénom ou pseudo', who || vide, '', '<label class="f"><span>Prénom ou pseudo (obligatoire)</span><input id="set-name" value="' + esc(s.name || '') + '" autocomplete="nickname"></label>');
  h += lineCard('p-sex', 'Tu es', s.sex === 'm' ? 'Loutron' : s.sex === 'f' ? 'Loutronne' : vide, '', sexChips('set-sex', s.sex));
  h += lineCard('p-birth', 'Date de naissance', s.birth ? fmtDateYear(s.birth) + ' · ' + age + ' ans' : vide, '', '<label class="f"><span>Date de naissance</span><input type="date" id="set-birth" value="' + esc(s.birth || '') + '" max="' + today() + '"></label>');
  h += lineCard('p-height', 'Taille', s.height == null ? vide : fmtKg(num(s.height)) + ' cm', '', '<label class="f"><span>Taille (cm)</span><input class="n" id="set-height" inputmode="decimal" value="' + esc(s.height == null ? '' : fmtKg(num(s.height))) + '" placeholder="ex. 180"></label>');
  return h + lineCard('p-weight', 'Poids', last ? fmtKg(num(last.weight)) + ' kg' : vide, '', '<label class="f"><span>Poids (kg)</span><input class="n" id="set-weight" inputmode="decimal" value="' + esc(last ? fmtKg(num(last.weight)) : '') + '" placeholder="ex. 75"></label><p class="muted small">' + (last ? esc(withDot('Dernière pesée : ' + fmtDate(last.date))) + ' ' : '') + 'Un nouveau poids est noté à la date du jour.</p>');
}
// Apparence : trois vignettes qui montrent chaque thème (automatique : moitié claire, moitié sombre)
function settingsLook(){
  const t = settings().theme || 'auto';
  return '<section class="card"><div class="theme-picks" role="group" aria-label="Apparence">' + Object.keys(THEMES).map(k => '<button type="button" class="theme-pick' + (t === k ? ' on' : '') + '" data-act="theme" data-v="' + k + '" aria-pressed="' + (t === k) + '"><span class="tp tp-' + k + '" aria-hidden="true"><i></i><i></i></span>' + THEMES[k] + '</button>').join('') + '</div><p class="muted small">Automatique : comme le réglage de ton téléphone.</p></section>';
}
// Douleurs et limitations : les zones choisies sont demandées chaque jour dans Aujourd'hui et pendant les séances, et suivies dans Progrès ;
// sans zone choisie, rien de tout cela n'apparaît
function settingsPain(){
  const on = painZones(); const adapt = ZONE_IDS.filter(z => ZONES[z].hits).map(z => ZONES[z].label.toLowerCase()).join(', ');
  return '<section class="card"><p>Choisis les zones qui te gênent : je te demanderai ta douleur chaque jour, de 0 à 10, seulement pour elles.</p>'
    + '<div class="chips" role="group" aria-label="Zones de douleur suivies">' + ZONE_IDS.map(z => '<button type="button" class="chip txt' + (on.indexOf(z) >= 0 ? ' on' : '') + '" data-act="pain-zone" data-v="' + z + '" aria-pressed="' + (on.indexOf(z) >= 0) + '">' + ZONES[z].label + '</button>').join('') + '</div>'
    + '<p class="muted small">' + esc(nbsp('Au-dessus de 3/10, je garde tes charges sur les exercices concernés (' + adapt + ') ; les autres zones sont seulement notées.')) + '</p>'
    + '<p class="muted small">Ce n’est pas un diagnostic : si une douleur dure ou revient, consulte un médecin ou un kiné.</p></section>';
}
// Autres sports : par défaut, l'appli ne parle que de musculation ; les sports choisis ici font apparaître la ligne Activités d'Aujourd'hui,
// l'ajout d'activités dans le calendrier, et sont les seuls proposés dans le formulaire (settings.sports)
function settingsSports(){
  const mine = mySports(); const m = mods(); const sp = sportInfo(); const raw = settings().sport || {};
  const chip = c => '<button type="button" class="chip txt' + (mine.indexOf(c[0]) >= 0 ? ' on' : '') + '" data-act="sport-pick" data-v="' + c[0] + '" aria-pressed="' + (mine.indexOf(c[0]) >= 0) + '">' + c[1] + '</button>';
  const grp = (title, list) => '<div class="stack"><span class="label">' + title + '</span><div class="chips" role="group" aria-label="' + title + '">' + list.map(chip).join('') + '</div></div>';
  const of = g => CHOICES.filter(c => c[0].indexOf('sport:') === 0 && SPORTS[c[0].slice(6)].group === g);
  let h = '<section class="card"><p>Choisis ce que tu pratiques en plus de la musculation : tu pourras noter et prévoir ces activités dans Aujourd’hui.</p>'
    + grp('Endurance', CHOICES.filter(c => ['run', 'bike', 'swim', 'walk'].indexOf(c[0]) >= 0)) + grp('Sports collectifs', of('collectif')) + grp('Sports individuels', of('individuel')) + '<div class="chips">' + chip(['other', 'Autre activité']) + '</div>'
    + (mine.length ? '' : '<p class="muted small">Aucun choisi : Loutrons reste centré sur la musculation.</p>') + '</section>';
  // Sport à jours fixes (option d'origine) : ses jours d'entraînement et de match apparaissent dans la semaine
  h += '<section class="card"><label class="toggle"><input type="checkbox" id="mod-sport" data-act="mod" data-v="sport"' + (m.sport ? ' checked' : '') + '><span><b>Un sport à jours fixes</b><br><span class="muted small">Tes jours d’entraînement et de match apparaissent dans ta semaine.</span></span></label>';
  if (m.sport) {
    const days = k => '<div class="days" role="group" aria-label="' + (k === 'train' ? 'Jours d’entraînement' : 'Jours de match') + '">' + DAY_ORDER.map(wd => '<button type="button" class="chip txt' + (sp[k].indexOf(wd) >= 0 ? ' on' : '') + '" data-act="sport-day" data-k="' + k + '" data-v="' + wd + '" aria-pressed="' + (sp[k].indexOf(wd) >= 0) + '">' + DAY_SHORT[wd] + '</button>').join('') + '</div>';
    h += '<div class="stack"><label class="f"><span>Ton sport</span><input id="set-sport" value="' + esc(raw.name || '') + '" placeholder="ex. Basket, foot, hand"></label><span class="label">Jours d’entraînement</span>' + days('train') + '<span class="label">Jours de match</span>' + days('match') + '</div>';
  }
  return h + '</section>';
}
function viewSettingsCards(){
  const s = settings();
  let h = '';
  // État de la sauvegarde d'un coup d'œil ; l'export JSON passe en orange seulement quand il est à faire (même règle que le rappel d'Aujourd'hui)
  const ws = workouts(); const due = backupDue() || (!s.lastExport && ws.length > 0);
  const pill = s.lastExport ? '<span class="pill ' + (due ? 'warn' : 'good') + '">' + esc(due ? 'À sauvegarder' : 'Sauvegardé') + '</span>' : '<span class="pill ' + (due ? 'warn' : 'court') + '">' + esc(due ? 'Pas encore sauvegardé' : 'Aucune sauvegarde') + '</span>';
  h += '<section class="card">' + pill + '<p class="small">Tes séances sont enregistrées seulement sur cet appareil. Exporte-les régulièrement.</p>';
  h += '<p class="small"><b>' + (s.lastExport ? esc(withDot('Dernière sauvegarde : ' + fmtDateLong(s.lastExport))) : 'Aucune sauvegarde pour l’instant.') + '</b> Seul l’export JSON compte comme sauvegarde.</p>';
  h += '<div class="row"><button type="button" class="btn' + (due ? ' primary' : '') + '" data-act="export" data-v="json">Exporter (JSON)</button><button type="button" class="btn" data-act="export" data-v="csv">Exporter les séries (CSV)</button></div>';
  if (useShare('json')) h += '<p class="muted small">«&nbsp;Exporter&nbsp;» ouvre le menu de partage&nbsp;: choisis «&nbsp;Enregistrer dans Fichiers&nbsp;» pour garder une copie, ou envoie le fichier.</p>';
  h += '<label class="btn file-btn"><input type="file" id="import-file" accept=".json,application/json">Importer une sauvegarde (JSON)</label>';
  h += '</section>';
  return h;
}
