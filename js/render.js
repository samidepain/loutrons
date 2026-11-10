// Affichage : barre d’onglets, rond du profil, thème, et choix de l’écran à afficher.
import { $, esc, today } from './util.js';
import { S } from './store.js';
import { activeWorkout, needsSetup, needToday, settings } from './data.js';
import { ensureTick } from './timers.js';
import { viewToday } from './views/today.js';
import { viewEnd, viewSession } from './views/session.js';
import { viewPicker } from './views/picker.js';
import { viewBilan, viewProgressPage } from './views/progress.js';
import { viewProgram } from './views/program.js';
import { viewProfile, viewSciencePage } from './views/profile.js';
import { newSetup, viewSetup } from './views/setup.js';
import { viewDraft } from './views/editors.js';
import { viewFiche } from './views/fiche.js';
import { foodAfterRender, viewFood } from './views/food.js';
import { nutritionOf } from './views/goal.js';
import { navigate, screenOf } from './nav.js';
import { viewActivity } from './views/activity.js';
import { viewDay } from './views/calendar.js';
import { viewMovement } from './views/movement.js';

// Trophée des records (carte dorée d'Aujourd'hui)
export const TROPHY = '<svg viewBox="0 0 24 24"><path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0V4zM7 6H4v1a3 3 0 0 0 3 3M17 6h3v1a3 3 0 0 1-3 3"/></svg>';
const ICONS = {
  today:'<svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>',
  training:'<svg viewBox="0 0 24 24"><path d="M6 7v10M18 7v10M3 10v4M21 10v4M6 12h12"/></svg>',
  progress:'<svg viewBox="0 0 24 24"><path d="M3 20h18M5 16l4-5 4 3 6-8"/></svg>',
  food:'<svg viewBox="0 0 24 24"><path d="M7 3v8M5 3v5a2 2 0 0 0 4 0V3M7 11v10M17 21V3c-2 1-3.5 4-3.5 8h3.5"/></svg>',
  person:'<svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/></svg>'
};
// L'onglet Alimentation n'apparaît que si la personne suit son alimentation
const TABS = [['today','Aujourd’hui'],['training','Entraînement'],['food','Alimentation'],['progress','Progrès']];
const tabsShown = () => TABS.filter(t => t[0] !== 'food' || (S.loaded && nutritionOf().on));
// Roue dentée dessinée par l'appli : un anneau en tirets (les dents) et un petit cercle au centre
const GEAR = '<svg class="gear" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="7" stroke-width="4" stroke-dasharray="3.3 2.2"/><circle cx="12" cy="12" r="2.6" stroke-width="2"/></svg>';
// Point orange de l'onglet Aujourd'hui : il faut venir aujourd'hui (jour prévu, ou autant de séances restantes que de jours)
function sessionDueToday(){ return !!S.loaded && needToday(today()); }
export function renderTabs(){
  const aw = S.loaded && activeWorkout(); const due = sessionDueToday();
  $('#tabs').innerHTML = tabsShown().map(t => '<button type="button" class="tab' + (S.view === t[0] ? ' on' : '') + '" data-act="tab" data-v="' + t[0] + '" aria-current="' + (S.view === t[0] ? 'page' : 'false') + '">' + ICONS[t[0]] + '<span>' + t[1] + '</span>' + ((t[0] === 'training' && aw) || (t[0] === 'today' && due && !aw) ? '<i class="dot" aria-hidden="true"></i>' : '') + '</button>').join('');
  // Rond du profil : l'initiale du prénom ou pseudo, sinon un pictogramme, avec une petite roue dentée (il mène aussi aux réglages)
  const me = $('#me'); const name = String(settings().name || '').trim();
  me.hidden = !S.loaded || !!(S.setup && S.setup.mode === 'welcome');
  me.innerHTML = (name ? esc(name.charAt(0).toUpperCase()) : ICONS.person) + GEAR;
  me.classList.toggle('on', S.view === 'profile' || S.view === 'science');
}
export function render(){
  if (needsSetup() && !S.setup) S.setup = newSetup('welcome');
  navigate(paint);
}
function paint(){
  renderTabs();
  // En-tête « LOUTRONS » seulement sur Aujourd'hui et l'accueil ; ailleurs, le titre de l'écran sert d'en-tête (le rond du profil reste
  // en haut à droite), et dans une fenêtre qui monte du bas il n'y a pas de rond du profil (Dark Glow, version 3.6)
  const sc = screenOf(); document.body.classList.toggle('brandless', !(sc.key === 'today' || (S.setup && S.setup.mode === 'welcome'))); document.body.classList.toggle('in-sheet', !!sc.sheet);
  $('.tabs').hidden = !!(S.setup && S.setup.mode === 'welcome');
  const v = S.view; const aw = activeWorkout();
  $('#app').innerHTML = S.setup ? viewSetup() : S.picker ? viewPicker() : S.draft ? viewDraft() : S.move ? viewMovement() : S.bilan ? viewBilan(S.bilan) : S.summary && S.summary.screen ? viewEnd() : S.act ? viewActivity()
    : v === 'training' ? (aw ? viewSession() : S.fiche ? viewFiche() : viewProgram()) : v === 'progress' ? (S.fiche ? viewFiche() : viewProgressPage())
    : v === 'food' && nutritionOf().on ? viewFood()
    : v === 'profile' ? viewProfile() : v === 'science' ? viewSciencePage() : S.day ? viewDay() : viewToday();
  if (v === 'training' && aw) ensureTick();
  foodAfterRender();
}
// Apparence : automatique (réglage du téléphone), clair ou sombre. Gardée aussi dans localStorage pour s'appliquer dès l'ouverture.
const THEME_COLORS = { light:'#F5F5F4', dark:'#0B0B0D' };
export function applyTheme(t){
  const forced = t === 'light' || t === 'dark'; const root = document.documentElement;
  if (forced) root.dataset.theme = t; else delete root.dataset.theme;
  document.querySelectorAll('meta[name="theme-color"]').forEach(m => { m.content = forced ? THEME_COLORS[t] : (m.media.indexOf('dark') >= 0 ? THEME_COLORS.dark : THEME_COLORS.light); });
  try { if (forced) localStorage.setItem('loutrons-theme', t); else localStorage.removeItem('loutrons-theme'); } catch (e) {}
}
// Échelle de douleur de 0 à 10 ; zone : zone de douleur (data-z), absente pour le genou
export function kneeChips(sel, act, dis, zone){
  let h = '<div class="chips" role="group">';
  for (let i = 0; i <= 10; i++) h += '<button type="button" class="chip' + (sel === i ? ' on' + (i > 3 ? ' hi' : '') : '') + '" data-act="' + act + '" data-v="' + i + '"' + (zone ? ' data-z="' + zone + '"' : '') + (dis ? ' disabled' : '') + ' aria-pressed="' + (sel === i) + '">' + i + '</button>';
  return h + '</div>';
}
