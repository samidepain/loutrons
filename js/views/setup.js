// Premier lancement et changement de programme.
import { esc, today } from '../util.js';
import { DAY_ORDER, DAY_SHORT, PROGRAMS } from '../library.js';
import { S } from '../store.js';
import { settings } from '../data.js';
import { sexChips } from './profile.js';
import { goalForm, setupData } from './goal.js';
import { planFor } from '../nutrition.js';
import { emile } from '../emile.js';

export function newSetup(mode){ return { mode, step:1, name: settings().name || '', sex:null, birth:'', height:'', weight:'', prog:null, progName:'', days:[], restart:true,
  n:{ on:false, activity:null, goal:'keep', target:'', by:'' }, ask:[] }; }
export function viewSetup(){
  const U = S.setup; const first = U.mode === 'welcome';
  let h = '';
  if (first && U.step === 3) return viewSetupFood(U);
  if (first && U.step !== 2) {
    // Écran 1 : bienvenue et « Toi »
    h += '<section class="card welcome"><img class="hero-logo" src="icons/logo.png" alt="La loutre des Loutrons qui soulève une barre" width="128" height="128"><h1>Bienvenue chez les Loutrons</h1><p class="muted small">Tout reste sur ce téléphone, sans compte. Pense à exporter une sauvegarde de temps en temps, depuis ton profil (le rond en haut à droite).</p></section>';
    h += emile('<p>Salut ! Moi, c’est Émile, ton coach. Note tes séances : je calcule tes objectifs de charge et de reps à partir des précédentes, et je te conseille au fil des semaines.</p>');
    h += '<section class="card"><span class="label">Étape 1 sur 3</span><h3>Toi</h3><label class="f"><span>Prénom ou pseudo</span><input id="setup-name" data-u="name" value="' + esc(U.name) + '" autocomplete="nickname" required></label>' + sexChips('setup-sex', U.sex);
    h += '<label class="f"><span>Date de naissance</span><input type="date" id="setup-birth" data-u="birth" value="' + esc(U.birth) + '" max="' + today() + '"></label>';
    h += '<div class="fields"><label class="f"><span>Taille (cm)</span><input class="n" id="setup-height" data-u="height" inputmode="decimal" value="' + esc(U.height) + '" placeholder="ex. 180"></label>';
    h += '<label class="f"><span>Poids (kg)</span><input class="n" id="setup-weight" data-u="weight" inputmode="decimal" value="' + esc(U.weight) + '" placeholder="ex. 75"></label></div>';
    h += '<p class="muted small">Seul le prénom ou pseudo est obligatoire. Le reste aide l’appli à mieux te conseiller ; tu pourras le compléter plus tard dans ton profil.</p></section>';
    return h + '<button type="button" class="btn primary big" data-act="setup-next">Continuer</button>' + importCard();
  }
  // Écran 2 de l'accueil, ou changement de programme
  if (first) {
    h += '<div class="row between"><button type="button" class="link" data-act="setup-back" data-back>‹ Retour</button><span class="label">Étape 2 sur 3</span></div><h1>Ton entraînement</h1>';
  } else {
    h += '<div class="row between"><h1>Changer de programme</h1><button type="button" class="link" data-act="setup-cancel">Annuler</button></div><p class="muted small">Ton historique et les séances que tu as créées sont gardés. Le planning est remplacé.</p>';
  }
  const opt = (k, title, desc) => '<button type="button" class="pick' + (U.prog === k ? ' on' : '') + '" data-act="setup-prog" data-v="' + k + '" aria-pressed="' + (U.prog === k) + '"><span class="stack" style="gap:2px"><span class="n">' + esc(title) + '</span><span class="m">' + esc(desc) + '</span></span><span aria-hidden="true">' + (U.prog === k ? '✓' : '') + '</span></button>';
  h += '<section class="card"><h3>' + (first ? 'Ton programme de départ' : 'Nouveau programme') + '</h3>';
  Object.keys(PROGRAMS).forEach(k => { h += opt(k, PROGRAMS[k].name, PROGRAMS[k].desc); });
  h += opt('custom', 'Créer mon programme', 'Tu le nommes, tu crées tes séances et tu choisis tes exercices.');
  if (U.prog === 'custom') h += '<label class="f"><span>Nom de ton programme</span><input id="setup-pname" data-u="progName" value="' + esc(U.progName) + '" placeholder="ex. Prise de masse"></label><p class="muted small">Tu choisiras tes jours dans Entraînement › Planning, une fois tes séances créées.</p>';
  h += '</section>';
  if (PROGRAMS[U.prog]) {
    const n = PROGRAMS[U.prog].tpls.length;
    h += '<section class="card"><h3>Tes jours de salle</h3><p class="muted small">Ce programme compte ' + n + ' séances : choisis ' + n + ' jours. Elles sont réparties dans l’ordre de la semaine.</p><div class="days" role="group">' +
      DAY_ORDER.map(wd => { const on = U.days.indexOf(wd) >= 0; return '<button type="button" class="chip txt' + (on ? ' on' : '') + '" data-act="setup-day" data-v="' + wd + '" aria-pressed="' + on + '">' + DAY_SHORT[wd] + '</button>'; }).join('') + '</div></section>';
  }
  if (!first) h += '<section class="card"><label class="toggle"><input type="checkbox" id="setup-restart" data-act="setup-restart"' + (U.restart ? ' checked' : '') + '><span><b>Recommencer en semaine 1</b><br><span class="muted small">Nouveau bloc de 6 semaines, en commençant par une semaine de calibration.</span></span></label></section>';
  else h += '<p class="muted small">Suivi du genou, tests de détente, sport collectif à côté : ces options s’activent plus tard dans ton profil.</p>';
  h += first ? '<button type="button" class="btn primary big" data-act="setup-next">Continuer</button>' : '<button type="button" class="btn primary big" data-act="setup-done">Changer de programme</button>';
  return h;
}
// Écran 3 de l'accueil : suivre son alimentation ou non. U.ask : données de l'écran 1 encore manquantes, demandées ici.
function viewSetupFood(U){
  let h = '<div class="row between"><button type="button" class="link" data-act="setup-back" data-back>‹ Retour</button><span class="label">Étape 3 sur 3</span></div><h1>Ton alimentation</h1>';
  h += '<section class="card">' + emile('<p>Veux-tu suivre ton alimentation ? Je calcule tes besoins en calories et en protéines, et un rythme réaliste si tu veux perdre de la masse grasse ou prendre de la masse musculaire.</p>');
  h += '<div class="chips" role="group">' + [['1', 'Oui'], ['0', 'Pas maintenant']].map(o => '<button type="button" class="chip txt' + ((U.n.on ? '1' : '0') === o[0] ? ' on' : '') + '" data-act="setup-n-on" data-v="' + o[0] + '" aria-pressed="' + ((U.n.on ? '1' : '0') === o[0]) + '">' + o[1] + '</button>').join('') + '</div>';
  if (U.n.on) {
    if (U.ask.length) {
      h += '<div class="stack"><span class="label">Pour le calcul</span>';
      if (U.ask.indexOf('sex') >= 0) h += sexChips('setup-sex', U.sex);
      if (U.ask.indexOf('birth') >= 0) h += '<label class="f"><span>Date de naissance</span><input type="date" id="setup-birth" data-u="birth" value="' + esc(U.birth) + '" max="' + today() + '"></label>';
      const f = [['height', 'Taille (cm)', 'ex. 180'], ['weight', 'Poids (kg)', 'ex. 75']].filter(x => U.ask.indexOf(x[0]) >= 0);
      if (f.length) h += '<div class="fields">' + f.map(x => '<label class="f"><span>' + x[1] + '</span><input class="n" id="setup-' + x[0] + '" data-u="' + x[0] + '" inputmode="decimal" value="' + esc(U[x[0]]) + '" placeholder="' + x[2] + '"></label>').join('') + '</div>';
      h += '</div>';
    }
    h += goalForm(U.n, planFor(setupData(U), U.n, today()));
  }
  h += '</section><p class="muted small">Tu pourras activer, modifier ou arrêter ce suivi plus tard dans ton profil.</p>';
  return h + '<button type="button" class="btn primary big" data-act="setup-done">C’est parti</button>';
}
function importCard(){
  return '<section class="card"><h3>Tu as déjà une sauvegarde ?</h3><p class="muted small">Importe ton fichier d’export pour retrouver tes séances et tes réglages.</p><label class="f"><span>Importer un export JSON</span><input type="file" id="import-file" accept=".json,application/json"></label></section>';
}
