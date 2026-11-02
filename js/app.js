// Point d’entrée : chargement des données, premier affichage, service worker.
import { loadDocs, S, usingIdb } from './store.js';
import { settings, upgradeLegacy } from './data.js';
import { applyTheme, render, renderTabs } from './render.js';
import { initSwipeBack } from './nav.js';
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
if ('serviceWorker' in navigator) window.addEventListener('load', () => { navigator.serviceWorker.register('sw.js').catch(() => {}); });
