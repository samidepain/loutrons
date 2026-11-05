# Vérifier une modification d'interface

À faire avant de dire qu'une modification est terminée. Si une étape échoue, on corrige et on recommence l'étape, sans passer à la suivante.

## 1. Tests automatiques

```bash
npm test
```

Tous les tests doivent passer (179 avec la version 2.13). On ajoute un test quand on modifie un calcul, l'accès aux données ou la liste des fichiers mis en cache.

## 2. Servir l'appli

Les modules ES ne marchent pas en `file://`. On sert le dossier en tâche de fond, puis on attend qu'il réponde :

```bash
python3 -m http.server 8123 --bind 127.0.0.1
```

```bash
for i in $(seq 50); do curl -s -o /dev/null http://127.0.0.1:8123/ && break; sleep 0.2; done
```

On arrête le serveur à la fin.

Ce serveur n'accepte que quelques connexions en attente : si l'on coupe le cache du navigateur de test, il en refuse une partie (`ERR_CONNECTION_RESET`) et l'appli reste sur « Chargement du carnet… ». On garde donc le cache. Pour être sûr de tester les fichiers modifiés, on désinscrit le service worker et on vide ses caches, ou on sert l'appli sur un autre port : c'est un autre site, sans service worker ni données.

Pour observer une animation, on la ralentit (`Animation.setPlaybackRate` par une session CDP : `page.context().newCDPSession(page)`), puis on mesure l'opacité ou on prend des captures à plusieurs instants.

Pour montrer l'appli à la personne dans le navigateur intégré de Claude, `.claude/launch.json` (configuration `loutrons`) se branche sur ce serveur déjà lancé. Il ne le démarre pas lui-même : macOS refuse l'accès au dossier Documents aux programmes lancés par le navigateur intégré.

## 3. Rendu à 390 px, en clair puis en sombre (Playwright)

Avec les outils Playwright :

1. `browser_resize` à 390 × 844.
2. `browser_navigate` vers `http://127.0.0.1:8123/`.
3. `browser_emulate_media` avec `colorScheme: 'light'`, puis `'dark'`. Le thème « automatique » suit ce réglage ; pour tester un thème choisi, régler `settings.theme` dans les données de départ.
4. Pour chaque thème : aller jusqu'à l'écran modifié, prendre une capture avec `browser_take_screenshot` et **la regarder**. On vérifie :
   - l'alignement, les espacements et la hiérarchie ;
   - les textes coupés ;
   - le contraste ;
   - l'action principale bien visible ;
   - l'absence de chevauchement avec l'en-tête, les onglets ou le minuteur.
5. `browser_console_messages` : aucune erreur.

Pour un parcours complet, `browser_run_code_unsafe` permet d'enchaîner les étapes :

```js
async (page) => {
  const errors = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', e => errors.push(e.message));
  await page.setViewportSize({ width: 390, height: 844 });
  const out = {};
  for (const scheme of ['light', 'dark']) {
    await page.emulateMedia({ colorScheme: scheme });
    await page.goto('http://127.0.0.1:8123/');
    await page.waitForSelector('.tabs .tab');
    // ... gestes vers l'écran modifié : page.click('[data-act="profile"]'), etc.
    out[scheme] = await page.evaluate(() => ({
      debordement: document.documentElement.scrollWidth > innerWidth,
      titre: document.querySelector('#app h1, #app h2')?.textContent
    }));
    await page.screenshot({ path: '.playwright-mcp/ecran-' + scheme + '.png', fullPage: true });
  }
  return { out, errors };
}
```

Le dossier `.playwright-mcp/` est exclu de Git.

## 4. Petit écran

On refait le rendu à 320 × 568. Il ne doit y avoir ni défilement horizontal (`scrollWidth > innerWidth` doit valoir faux) ni bouton coupé.

Ce test ne voit pas un texte qui sort de sa case sans élargir la page (grands chiffres d'une case `.stat`, nom long dans un bloc). On cherche donc aussi les éléments dont le contenu dépasse, en essayant des valeurs longues réalistes (« +12,5% », « 125-170 g », « 10,5 / 12,5 », un nom de séance d'un seul mot long) :

```js
async (page) => page.evaluate(() => [...document.querySelectorAll('#app *')]
  .filter(e => e.offsetParent && e.children.length === 0 && e.scrollWidth > e.clientWidth + 1 && getComputedStyle(e).overflowX === 'visible')
  .map(e => e.className + ' « ' + e.textContent.trim().slice(0, 30) + ' »'))
```

Les écrans à vérifier comprennent le bilan de bloc (Progrès › Résumé › Bloc), qui a les plus grands chiffres.

## 5. Interactions

On teste chaque geste modifié :
- l'action principale, puis l'annulation ;
- le retour par le bouton `‹ …` ;
- l'action principale touchée deux fois de suite ;
- une saisie suivie d'un nouvel affichage : la valeur doit rester ;
- le retour à la position de défilement.

Pour mesurer les cibles tactiles de l'écran :

```js
async (page) => page.evaluate(() => [...document.querySelectorAll('#app button, #app input, #app select, #app a')]
  .filter(el => el.offsetParent).map(el => { const r = el.getBoundingClientRect(); return { t: (el.textContent || el.getAttribute('aria-label') || el.name || '').trim().slice(0, 30), w: Math.round(r.width), h: Math.round(r.height) }; })
  .filter(x => x.h < 44 || x.w < 44))
```

## 6. Accessibilité automatique (axe-core)

axe-core est la bibliothèque de référence pour tester l'accessibilité. Elle est chargée **seulement dans le navigateur de test**, jamais dans l'appli, ni dans le dépôt, ni dans le cache. La version est fixée ; ne la changer que pour une version parue depuis au moins deux semaines.

On la lance sur chaque écran modifié, en clair et en sombre :

```js
async (page) => {
  if (!(await page.evaluate(() => !!window.axe))) await page.addScriptTag({ url: 'https://cdn.jsdelivr.net/npm/axe-core@4.14.0/axe.min.js' });
  const r = await page.evaluate(() => axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'] } }));
  return r.violations.map(v => ({ id: v.id, impact: v.impact, n: v.nodes.length, ex: v.nodes.slice(0, 3).map(n => n.target.join(' ')) }));
}
```

- Un **nouveau** défaut `critical` ou `serious` se corrige avant de terminer.
- Les autres défauts sont signalés à la personne.
- Défauts connus en novembre 2026, à ne pas confondre avec une régression :
  - champ « Début du programme » sans étiquette liée (`#start-date`, profil) ;
  - jours du calendrier dont le nom accessible ne reprend pas le texte visible (`label-content-name-mismatch`) ;
  - ordre des titres (un `h3` après le `h1`, sans `h2`) ;
  - pas de `h1` sur Aujourd'hui ;
  - séance en cours : barre d'avancement (`.bar`) avec `aria-label` sans rôle (`aria-prohibited-attr`).
- Attendre la fin des animations et des changements de thème avant de lancer axe : pendant un fondu, il signale des contrastes insuffisants qui n'existent pas.
- axe ne voit pas tout : il ne remplace pas la capture regardée, la lecture des textes, ni un essai avec VoiceOver sur iPhone pour un écran important.

## 7. Données de départ

Pour afficher un écran avec des données sans toucher aux vraies, on injecte des documents avant le lancement de l'appli. L'appli recopie l'ancien stockage `carnet_docs_v1` dans IndexedDB quand la base est neuve :

```js
async (page) => {
  const docs = {
    settings: { name: 'Test', start: '2026-09-07', created: '2026-09-07', program: { base: 'exemple', name: 'Programme exemple', days: [1, 2, 5, 0] }, modules: { knee: false, jumps: false, sport: false } },
    'b_2026-11-02': { date: '2026-11-02', weight: 80 }
  };
  await page.context().addInitScript(d => {
    if (sessionStorage.getItem('graine')) return;   // une seule fois par onglet
    sessionStorage.setItem('graine', '1');
    localStorage.setItem('carnet_docs_v1', JSON.stringify(d));
    indexedDB.deleteDatabase('carnet-muscu');        // traité avant l'ouverture de la base par l'appli
  }, docs);
  await page.goto('http://127.0.0.1:8123/');
}
```

Pour des données réalistes, on peut s'inspirer des aides des tests (`tests/aide.js` : `reglages()`, `seance()`).

## 8. Premier lancement d'un ami (stockage vide)

On efface la base et le stockage local depuis une page du même site qui n'ouvre pas la base. Depuis l'appli, la suppression reste bloquée par sa connexion ouverte, puis elle est abandonnée au rechargement :

```js
async (page) => {
  await page.goto('http://127.0.0.1:8123/manifest.webmanifest');
  await page.evaluate(() => new Promise(res => { localStorage.clear(); const r = indexedDB.deleteDatabase('carnet-muscu'); r.onsuccess = r.onerror = r.onblocked = res; }));
  await page.goto('http://127.0.0.1:8123/');
}
```

Si des données de départ ont été injectées avec `addInitScript` (section 7), garder sa marque dans `sessionStorage`, sinon elles reviennent au chargement. Sur la page du manifeste, le navigateur demande `favicon.ico` (erreur 404) : ce n'est pas une erreur de l'appli.

On attend l'écran « Étape 1 sur 3 ». On le parcourt jusqu'à « Aujourd'hui », sans voir aucune donnée ni aucun réglage d'une autre personne.

## 9. Sans connexion

```js
async (page) => {
  await page.goto('http://127.0.0.1:8123/');
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();                    // la page est maintenant servie par le service worker
  await page.context().setOffline(true);
  await page.reload();
  const ok = await page.locator('.tabs .tab').count();
  await page.context().setOffline(false);
  return ok;
}
```

Après ce test, le service worker reste inscrit dans le navigateur de test. Tant que le numéro de version ne change pas, il continue de servir les fichiers de ce moment-là, même si on les corrige ensuite : on le désinscrit et on vide ses caches avant de reprendre les contrôles (`navigator.serviceWorker.getRegistrations()`, puis `unregister()` ; `caches.keys()`, puis `caches.delete()`).

L'appli doit s'ouvrir et l'écran modifié s'afficher. Une fonction qui a besoin du réseau (scan d'un nouveau produit, photo jamais vue) dit ce qui manque, sans erreur.

## 10. Mise en ligne

- Si un fichier mis en cache a changé, changer la version dans `js/version.js` et `sw.js`. `npm test` vérifie qu'elles sont égales et que chaque fichier de `FILES` existe.
- Vérifier que le prénom n'apparaît pas dans le dépôt, avec la commande de `CLAUDE.md` (« Avant un commit ») : elle ne doit rien trouver (code de sortie 1).
- Faire un commit par étape, avec un message en français et « (version X.Y) ».
- Fermer le navigateur Playwright et arrêter le serveur.
