// Point d’entrée : chargement des données, premier affichage, service worker.
import { loadDocs, S, usingIdb } from './store.js';
import { settings, upgradeLegacy } from './data.js';
import { applyTheme, render, renderTabs } from './render.js';
import { initSwipeBack, initTabSwipe, screenOf } from './nav.js';
import { greeting } from './util.js';
import { initSwipeRows } from './swipe.js';
import './actions.js'; // écoute les clics, saisies et changements

async function init(){
  renderTabs(); render();
  await loadDocs();
  S.loaded = true;
  upgradeLegacy();
  applyTheme(settings().theme);
  render();
  if (usingIdb() && navigator.storage && navigator.storage.persist) navigator.storage.persisted().then(p => p || navigator.storage.persist()).catch(() => {});
}
init();
initSwipeBack(renderTabs);
initTabSwipe();
initSwipeRows();
// Retour au premier plan sur Aujourd'hui : la salutation suit l'heure (seulement si elle a changé, pour ne pas redessiner pour rien)
document.addEventListener('visibilitychange', () => {
  const g = document.querySelector('.g-hi');
  if (!document.hidden && S.loaded && g && screenOf().key === 'today' && g.textContent.indexOf(greeting(new Date().getHours())) !== 0) render();
});
if ('serviceWorker' in navigator) window.addEventListener('load', () => { navigator.serviceWorker.register('sw.js').catch(() => {}); });
